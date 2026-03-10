/**
 * coppa.js
 * HiAlice — COPPA Verifiable Parental Consent Routes
 *
 * Implements VPC via Stripe $0.50 micro-charge as per FTC COPPA guidelines.
 * The micro-charge serves as identity verification — it is refunded immediately.
 *
 * Route summary:
 *   POST /verify-intent       Create a Stripe PaymentIntent for $0.50 VPC
 *   POST /verify-confirm      Confirm payment succeeded -> mark consent verified
 *   GET  /status/:email       Check VPC status for a parent email
 */

import express from 'express';
import Stripe from 'stripe';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

// Stripe initialization (lazy — null when key absent)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const VPC_AMOUNT = 50; // $0.50 in cents
const VPC_CURRENCY = 'usd';

// ============================================================================
// POST /verify-intent
// ============================================================================

/**
 * Create a Stripe PaymentIntent for COPPA VPC.
 * The $0.50 charge is immediately refundable after verification.
 *
 * Body: { parentEmail, parentName }
 * Returns: { clientSecret, paymentIntentId }
 */
router.post('/verify-intent', async (req, res) => {
  try {
    const { parentEmail, parentName } = req.body;

    if (!parentEmail || !parentName) {
      return res.status(400).json({ error: 'parentEmail and parentName required' });
    }

    if (!stripe) {
      // Dev mode — return mock intent
      return res.status(200).json({
        clientSecret: 'pi_mock_secret_dev',
        paymentIntentId: 'pi_mock_dev_' + Date.now(),
        isMock: true,
        message: 'Stripe not configured. Using mock VPC for development.',
      });
    }

    // Check if already verified
    const { data: existing } = await supabase
      .from('parents')
      .select('coppa_consent')
      .eq('email', parentEmail)
      .single();

    if (existing?.coppa_consent === true) {
      return res.status(200).json({
        alreadyVerified: true,
        message: 'Parental consent already verified for this email.',
      });
    }

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: VPC_AMOUNT,
      currency: VPC_CURRENCY,
      metadata: {
        purpose: 'coppa_vpc',
        parent_email: parentEmail,
        parent_name: parentName,
      },
      description: 'HiAlice — COPPA Parental Consent Verification ($0.50 refundable)',
      receipt_email: parentEmail,
    });

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error('[COPPA] Create intent error:', err.message);
    return res.status(500).json({ error: 'Failed to create verification intent' });
  }
});

// ============================================================================
// POST /verify-confirm
// ============================================================================

/**
 * Confirm that the VPC payment succeeded, then:
 * 1. Update parent record with verified consent
 * 2. Log to consent_audit_log
 * 3. Issue automatic refund
 *
 * Body: { paymentIntentId, parentEmail, parentName }
 * Returns: { verified: true, refundId }
 */
router.post('/verify-confirm', async (req, res) => {
  try {
    const { paymentIntentId, parentEmail, parentName } = req.body;

    if (!paymentIntentId || !parentEmail || !parentName) {
      return res.status(400).json({
        error: 'paymentIntentId, parentEmail, and parentName required',
      });
    }

    // Dev mode — skip Stripe verification
    if (!stripe || paymentIntentId.startsWith('pi_mock_')) {
      await recordConsent(parentEmail, parentName, 'mock_dev', req);
      return res.status(200).json({
        verified: true,
        refundId: 'refund_mock_dev',
        isMock: true,
      });
    }

    // Verify payment succeeded with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        error: `Payment not completed. Status: ${paymentIntent.status}`,
      });
    }

    // Verify metadata matches
    if (paymentIntent.metadata?.parent_email !== parentEmail) {
      return res.status(403).json({ error: 'Email mismatch with payment record' });
    }

    // Record verified consent
    await recordConsent(parentEmail, parentName, paymentIntentId, req);

    // Issue immediate refund
    let refundId = null;
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        reason: 'requested_by_customer',
        metadata: { purpose: 'coppa_vpc_refund' },
      });
      refundId = refund.id;
    } catch (refundErr) {
      // Refund failure is non-fatal — consent is already recorded
      console.error('[COPPA] Refund failed (non-fatal):', refundErr.message);
    }

    return res.status(200).json({
      verified: true,
      refundId,
      message: 'Parental consent verified. The $0.50 charge will be refunded.',
    });
  } catch (err) {
    console.error('[COPPA] Verify confirm error:', err.message);
    return res.status(500).json({ error: 'Failed to verify consent' });
  }
});

// ============================================================================
// GET /status/:email
// ============================================================================

/**
 * Check VPC status for a parent email.
 * Returns: { verified: boolean, consentDate, consentVersion }
 */
router.get('/status/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const { data: parent, error } = await supabase
      .from('parents')
      .select('coppa_consent, coppa_consent_date, coppa_consent_version')
      .eq('email', decodeURIComponent(email))
      .single();

    if (error || !parent) {
      return res.status(200).json({ verified: false });
    }

    return res.status(200).json({
      verified: parent.coppa_consent === true,
      consentDate: parent.coppa_consent_date,
      consentVersion: parent.coppa_consent_version,
    });
  } catch (err) {
    console.error('[COPPA] Status check error:', err.message);
    return res.status(500).json({ error: 'Failed to check consent status' });
  }
});

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Record verified parental consent in both the parent record and audit log.
 * @private
 */
async function recordConsent(parentEmail, parentName, paymentIntentId, req) {
  const now = new Date().toISOString();

  // Update parent record
  await supabase
    .from('parents')
    .update({
      coppa_consent: true,
      coppa_consent_date: now,
      coppa_consent_name: parentName,
      coppa_consent_version: '2.0-vpc',
    })
    .eq('email', parentEmail);

  // Append to consent audit log
  await supabase.from('consent_audit_log').insert({
    parent_email: parentEmail,
    parent_name: parentName,
    consent_given: true,
    consent_timestamp: now,
    consent_version: '2.0-vpc',
    ip_address: req.ip,
    user_agent: req.headers['user-agent'] || null,
  });
}

export default router;
