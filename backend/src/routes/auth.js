/**
 * auth.js
 * HiAlice — Authentication Routes
 *
 * Handles parent login, child session selection, logout,
 * current user info, and parent notification inbox.
 *
 * Route summary:
 *   POST /parent-login               Email + password login
 *   POST /child-select               Select a child for a session (parent token required)
 *   POST /logout                     Invalidate Supabase Auth session + clear server state
 *   GET  /me                         Get current user info from JWT
 *   GET  /notifications              Get parent notification inbox
 *   PUT  /notifications/:id/read     Mark a single notification as read
 */

import express from 'express';
import { supabase } from '../lib/supabase.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/sanitize.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Cookie configuration
// ---------------------------------------------------------------------------

/**
 * Options for the httpOnly JWT cookie.
 * The cookie is only transmitted over HTTPS in production; in development it
 * is also sent over plain HTTP so that local testing is not blocked.
 */
function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    path: '/',
  };
}

// ============================================================================
// POST /parent-login
// ============================================================================

/**
 * Email + password login via Supabase Auth.
 * Body: { email, password }
 * Returns: { token, parent: { id, email, display_name }, children: [...] }
 */
router.post('/parent-login', authRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    const { user } = data;

    // Fetch parent profile from our database
    const { data: parentData, error: parentError } = await supabase
      .from('parents')
      .select('id, email, display_name')
      .eq('auth_id', user.id)
      .single();

    if (parentError) {
      return res.status(404).json({ error: 'Parent record not found' });
    }

    // Fetch children associated with this parent
    const { data: childrenData, error: childrenError } = await supabase
      .from('students')
      .select('id, name, age, level, avatar_emoji, current_streak, total_books_read')
      .eq('parent_id', parentData.id);

    if (childrenError && childrenError.code !== 'PGRST116') {
      return res.status(500).json({ error: childrenError.message });
    }

    // Generate our own JWT token with parent claims
    const token = generateToken({
      parentId: parentData.id,
      email: parentData.email,
      type: 'parent',
    });

    // Set the JWT as an httpOnly cookie in addition to returning it in the
    // JSON body so existing clients that read the body continue to work.
    res.cookie('hialice_token', token, cookieOptions());

    return res.status(200).json({
      token,
      parent: parentData,
      children: childrenData || [],
    });
  } catch (err) {
    console.error('Parent login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /child-select
// ============================================================================

/**
 * Select a child for a session.
 * Issues a short-lived student token that the frontend uses for session routes.
 *
 * Requires: Parent Bearer token
 * Body: { studentId }
 * Returns: { token, student: { id, name, age, level } }
 */
router.post('/child-select', authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ error: 'studentId required' });
    }

    // Only parent tokens may select a child
    if (!req.user || req.user.type !== 'parent') {
      return res.status(403).json({ error: 'Parent authentication required' });
    }

    const parentId = req.user.parentId;

    // Fetch student and verify ownership
    const { data: student, error } = await supabase
      .from('students')
      .select('id, name, age, level, parent_id, avatar_emoji, current_streak, total_books_read')
      .eq('id', studentId)
      .single();

    if (error || !student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (student.parent_id !== parentId) {
      return res
        .status(403)
        .json({ error: 'Access denied: student does not belong to this parent' });
    }

    // Issue a student-scoped JWT
    const token = generateToken({
      studentId: student.id,
      name: student.name,
      type: 'student',
    });

    // Replace the parent cookie with a student-scoped cookie for the session.
    res.cookie('hialice_token', token, cookieOptions());

    return res.status(200).json({
      token,
      student: {
        id: student.id,
        name: student.name,
        age: student.age,
        level: student.level,
        avatarEmoji: student.avatar_emoji,
        streak: student.current_streak,
        totalBooksRead: student.total_books_read,
      },
    });
  } catch (err) {
    console.error('Child select error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /logout
// ============================================================================

/**
 * Log out the current user.
 *
 * - Clears the httpOnly `hialice_token` cookie unconditionally so that clients
 *   which authenticate via cookie are always logged out regardless of whether
 *   they also carry a Bearer token.
 * - Calls Supabase Auth signOut as a best-effort remote session invalidation.
 * - Our own JWTs are stateless, so Bearer-only clients must also discard the
 *   token on their side.
 *
 * No authMiddleware guard is applied so that a client with only a cookie (and
 * no stored Bearer token) can still reach this endpoint to clear the cookie.
 *
 * Returns: { success: true }
 */
router.post('/logout', async (req, res) => {
  try {
    // Clear the httpOnly cookie by sending it with maxAge 0.
    res.clearCookie('hialice_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    // Best-effort Supabase Auth session invalidation.
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn('Supabase signOut error (non-fatal):', error.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully. Please clear your client token.',
    });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET /me
// ============================================================================

/**
 * Get current user info decoded from the JWT.
 * For parent tokens: returns parent profile + children list.
 * For student tokens: returns student profile.
 *
 * Requires: Bearer token
 * Returns: { user: { type, ...profile }, children? }
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { type } = req.user;

    if (type === 'parent') {
      const parentId = req.user.parentId;

      // Fetch fresh parent data from DB
      const { data: parent, error: parentError } = await supabase
        .from('parents')
        .select('id, email, display_name, phone, created_at')
        .eq('id', parentId)
        .single();

      if (parentError) {
        return res.status(404).json({ error: 'Parent not found' });
      }

      // Fetch children with stats
      const { data: children } = await supabase
        .from('students')
        .select(
          'id, name, age, level, avatar_emoji, current_streak, total_books_read, total_words_learned, last_session_date'
        )
        .eq('parent_id', parentId);

      return res.status(200).json({
        user: {
          type: 'parent',
          ...parent,
        },
        children: children || [],
      });
    }

    if (type === 'student') {
      const studentId = req.user.studentId;

      const { data: student, error: studentError } = await supabase
        .from('students')
        .select(
          'id, name, age, level, avatar_emoji, bio, current_streak, total_books_read, total_words_learned, last_session_date, created_at'
        )
        .eq('id', studentId)
        .single();

      if (studentError) {
        return res.status(404).json({ error: 'Student not found' });
      }

      return res.status(200).json({
        user: {
          type: 'student',
          ...student,
        },
      });
    }

    // Unknown token type
    return res.status(400).json({ error: 'Invalid token type' });
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET /notifications
// ============================================================================

/**
 * Get parent notification inbox.
 * Returns most recent 50 notifications, unread first, then newest first.
 *
 * Requires: Parent Bearer token
 * Query: ?unreadOnly=true — return only unread notifications
 * Returns: { notifications: [...], unreadCount }
 */
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    // Only parents have a notification inbox
    if (!req.user || req.user.type !== 'parent') {
      return res
        .status(403)
        .json({ error: 'Parent authentication required' });
    }

    const parentId = req.user.parentId;
    const { unreadOnly } = req.query;

    let query = supabase
      .from('parent_notifications')
      .select(
        'id, student_id, type, title, message, is_read, created_at, students(name, avatar_emoji)'
      )
      .eq('parent_id', parentId)
      .order('is_read', { ascending: true })   // unread first
      .order('created_at', { ascending: false }) // newest within each group
      .limit(50);

    // Optionally filter to unread only
    if (unreadOnly === 'true') {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Count unread notifications (may differ if unreadOnly filtered the list)
    const { data: unreadRows } = await supabase
      .from('parent_notifications')
      .select('id', { count: 'exact' })
      .eq('parent_id', parentId)
      .eq('is_read', false);

    return res.status(200).json({
      notifications: (notifications || []).map((n) => ({
        id: n.id,
        studentId: n.student_id,
        studentName: n.students?.name || null,
        studentAvatar: n.students?.avatar_emoji || null,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.is_read,
        createdAt: n.created_at,
      })),
      unreadCount: unreadRows?.length ?? 0,
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// PUT /notifications/:id/read
// ============================================================================

/**
 * Mark a single notification as read.
 * Also supports marking ALL as read when id === 'all'.
 *
 * Requires: Parent Bearer token
 * Returns: { success: true }
 */
router.put('/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.type !== 'parent') {
      return res
        .status(403)
        .json({ error: 'Parent authentication required' });
    }

    const parentId = req.user.parentId;
    const { id: notifId } = req.params;

    // Special case: mark all notifications as read
    if (notifId === 'all') {
      const { error } = await supabase
        .from('parent_notifications')
        .update({ is_read: true })
        .eq('parent_id', parentId)
        .eq('is_read', false);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
      });
    }

    // Mark a single notification as read; verify ownership first
    const { data: notif, error: fetchError } = await supabase
      .from('parent_notifications')
      .select('id, parent_id')
      .eq('id', notifId)
      .single();

    if (fetchError || !notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notif.parent_id !== parentId) {
      return res
        .status(403)
        .json({ error: 'Access denied: notification does not belong to you' });
    }

    const { error: updateError } = await supabase
      .from('parent_notifications')
      .update({ is_read: true })
      .eq('id', notifId);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /consent
// ============================================================================

/**
 * Record verifiable parental consent under COPPA.
 * This endpoint is intentionally unauthenticated — consent must be submittable
 * before a parent account is fully established.
 *
 * Body: { parentEmail, parentName, consentGiven, consentTimestamp, consentVersion }
 * Returns: { success: true, consentDate }
 */
router.post('/consent', async (req, res) => {
  try {
    const { parentEmail, parentName, consentGiven, consentTimestamp, consentVersion } = req.body;

    if (!parentEmail || !parentName || !consentGiven) {
      return res.status(400).json({
        error: 'parentEmail, parentName, and consentGiven are required',
      });
    }

    // Attempt to update the matching parent record with consent metadata.
    // A missing record is non-fatal — the consent is still recorded in the
    // audit log, which is the authoritative compliance ledger.
    const { error: updateError } = await supabase
      .from('parents')
      .update({
        coppa_consent: consentGiven,
        coppa_consent_date: consentTimestamp || new Date().toISOString(),
        coppa_consent_name: parentName,
        coppa_consent_version: consentVersion || '1.0',
        updated_at: new Date().toISOString(),
      })
      .eq('email', parentEmail);

    if (updateError) {
      // Parent not yet created or email mismatch — log a warning and continue.
      // The audit log below is the source of truth.
      console.warn('[consent] Parent record not found for email, proceeding to audit log:', parentEmail);
    }

    // Append an immutable entry to the COPPA consent audit trail.
    // Failure here is surfaced as a 500 because compliance logging must succeed.
    const { error: auditError } = await supabase.from('consent_audit_log').insert({
      parent_email: parentEmail,
      parent_name: parentName,
      consent_given: consentGiven,
      consent_timestamp: consentTimestamp || new Date().toISOString(),
      consent_version: consentVersion || '1.0',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'] || null,
    });

    if (auditError) {
      console.error('[consent] Audit log insert failed:', auditError);
      return res.status(500).json({ error: 'Failed to record consent audit entry' });
    }

    return res.status(200).json({
      success: true,
      message: 'Consent recorded successfully',
      consentDate: consentTimestamp || new Date().toISOString(),
    });
  } catch (err) {
    console.error('Consent error:', err);
    return res.status(500).json({ error: 'Failed to record consent' });
  }
});

export default router;
