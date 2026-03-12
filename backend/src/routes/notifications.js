/**
 * notifications.js
 * HiAlice — Notification Routes
 *
 * Handles parent notification preferences, notification inbox, and
 * the internal trigger used by session completion to dispatch alerts.
 *
 * Route summary:
 *   POST  /preferences              Save parent notification preferences
 *   GET   /                         Get parent notification inbox
 *   PATCH /:id/read                 Mark a single notification as read
 *   POST  /send                     Internal: queue/send a notification (session completion hook)
 */

import express from 'express';
import { supabase } from '../lib/supabase.js';
import { authMiddleware } from '../middleware/auth.js';
import logger from '../lib/logger.js';

const router = express.Router();

// ============================================================================
// POST /preferences
// ============================================================================

/**
 * Save (upsert) parent notification preferences.
 * Creates a row in parent_notification_prefs if none exists, otherwise updates.
 *
 * Requires: Parent Bearer token
 * Body: {
 *   emailEnabled:        boolean,
 *   sessionAlerts:       boolean,
 *   weeklyReport:        boolean,
 *   notificationEmail:   string   (the address to send alerts to)
 * }
 * Returns: { success: true, prefs: { ... } }
 */
router.post('/preferences', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.type !== 'parent') {
      return res.status(403).json({ error: 'Parent authentication required' });
    }

    const parentId = req.user.parentId;
    const { emailEnabled, sessionAlerts, weeklyReport, notificationEmail } = req.body;

    // Basic validation
    if (notificationEmail !== undefined && notificationEmail !== '') {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(notificationEmail)) {
        return res.status(400).json({ error: 'Invalid notificationEmail format' });
      }
    }

    const prefsPayload = {
      parent_id: parentId,
      email_enabled: emailEnabled ?? true,
      session_alerts: sessionAlerts ?? true,
      weekly_report: weeklyReport ?? false,
      notification_email: notificationEmail ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data: prefs, error } = await supabase
      .from('parent_notification_prefs')
      .upsert(prefsPayload, { onConflict: 'parent_id' })
      .select()
      .single();

    if (error) {
      logger.error({ err: error }, 'Failed to upsert notification prefs');
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      prefs: {
        parentId: prefs.parent_id,
        emailEnabled: prefs.email_enabled,
        sessionAlerts: prefs.session_alerts,
        weeklyReport: prefs.weekly_report,
        notificationEmail: prefs.notification_email,
        updatedAt: prefs.updated_at,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Save notification prefs error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET /preferences
// ============================================================================

/**
 * Get parent notification preferences.
 *
 * Requires: Parent Bearer token
 * Returns: { prefs: { emailEnabled, sessionAlerts, weeklyReport, notificationEmail } }
 */
router.get('/preferences', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.type !== 'parent') {
      return res.status(403).json({ error: 'Parent authentication required' });
    }

    const parentId = req.user.parentId;

    // Try Supabase first
    try {
      const { data, error } = await supabase
        .from('parent_notification_prefs')
        .select('email_enabled, session_alerts, weekly_report, notification_email')
        .eq('parent_id', parentId)
        .single();

      if (!error && data) {
        return res.json({
          prefs: {
            emailEnabled: data.email_enabled ?? true,
            sessionAlerts: data.session_alerts ?? true,
            weeklyReport: data.weekly_report ?? false,
            notificationEmail: data.notification_email || '',
          },
        });
      }
    } catch (dbErr) {
      logger.warn({ err: dbErr }, 'DB prefs lookup failed, returning defaults');
    }

    // Return sensible defaults if no record found
    return res.json({
      prefs: {
        emailEnabled: true,
        sessionAlerts: true,
        weeklyReport: false,
        notificationEmail: '',
      },
    });
  } catch (err) {
    logger.error({ err }, 'Get notification prefs error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET /
// ============================================================================

/**
 * Get parent notification inbox.
 * Returns most recent 50 notifications, unread first, then newest first.
 *
 * Requires: Parent Bearer token
 * Query: ?unreadOnly=true  — return only unread notifications
 * Returns: { notifications: [...], unreadCount, prefs: { ... } }
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.type !== 'parent') {
      return res.status(403).json({ error: 'Parent authentication required' });
    }

    const parentId = req.user.parentId;
    const { unreadOnly } = req.query;

    // Fetch notifications and preferences in parallel
    let notifQuery = supabase
      .from('parent_notifications')
      .select(
        'id, student_id, type, title, message, is_read, created_at, students(name, avatar_emoji)'
      )
      .eq('parent_id', parentId)
      .order('is_read', { ascending: true })    // unread first
      .order('created_at', { ascending: false }) // newest within each group
      .limit(50);

    if (unreadOnly === 'true') {
      notifQuery = notifQuery.eq('is_read', false);
    }

    const [{ data: notifications, error: notifError }, { data: prefsRow }] = await Promise.all([
      notifQuery,
      supabase
        .from('parent_notification_prefs')
        .select('email_enabled, session_alerts, weekly_report, notification_email')
        .eq('parent_id', parentId)
        .maybeSingle(),
    ]);

    if (notifError) {
      return res.status(500).json({ error: notifError.message });
    }

    // Count unread separately (may differ when unreadOnly=true filtered the list)
    const { data: unreadRows } = await supabase
      .from('parent_notifications')
      .select('id', { count: 'exact' })
      .eq('parent_id', parentId)
      .eq('is_read', false);

    return res.status(200).json({
      notifications: (notifications || []).map((n) => ({
        id: n.id,
        studentId: n.student_id,
        studentName: n.students?.name ?? null,
        studentAvatar: n.students?.avatar_emoji ?? null,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.is_read,
        createdAt: n.created_at,
      })),
      unreadCount: unreadRows?.length ?? 0,
      prefs: prefsRow
        ? {
            emailEnabled: prefsRow.email_enabled,
            sessionAlerts: prefsRow.session_alerts,
            weeklyReport: prefsRow.weekly_report,
            notificationEmail: prefsRow.notification_email,
          }
        : null,
    });
  } catch (err) {
    logger.error({ err }, 'Get notifications error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// PATCH /:id/read
// ============================================================================

/**
 * Mark a single notification as read.
 * Supports id === 'all' to mark every unread notification for this parent.
 *
 * Requires: Parent Bearer token
 * Returns: { success: true }
 */
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.type !== 'parent') {
      return res.status(403).json({ error: 'Parent authentication required' });
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

    // Fetch and verify ownership before updating
    const { data: notif, error: fetchError } = await supabase
      .from('parent_notifications')
      .select('id, parent_id')
      .eq('id', notifId)
      .single();

    if (fetchError || !notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notif.parent_id !== parentId) {
      return res.status(403).json({
        error: 'Access denied: notification does not belong to you',
      });
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
    logger.error({ err }, 'Mark notification read error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /send
// ============================================================================

/**
 * Internal endpoint: create a notification for a parent.
 * Called by the session completion flow (or other server-side triggers).
 *
 * This route intentionally accepts a service token OR a parent token so that
 * the sessions route can call it server-side without a parent JWT.
 *
 * Body: {
 *   parentId:    string  (required),
 *   studentId:   string  (required),
 *   type:        string  — 'session_complete' | 'achievement' | 'weekly_report',
 *   title:       string,
 *   message:     string
 * }
 * Returns: { success: true, notification: { id, ... } }
 */
router.post('/send', authMiddleware, async (req, res) => {
  try {
    // Allow parent tokens or admin tokens to trigger notifications.
    // In a full implementation a shared service secret would be used here.
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { parentId, studentId, type, title, message } = req.body;

    if (!parentId || !studentId || !type || !title || !message) {
      return res.status(400).json({
        error: 'parentId, studentId, type, title, and message are required',
      });
    }

    // Check whether the parent has opted in to this notification type
    const { data: prefs } = await supabase
      .from('parent_notification_prefs')
      .select('email_enabled, session_alerts, weekly_report')
      .eq('parent_id', parentId)
      .maybeSingle();

    // Apply preference filtering; default to allowing when no prefs row yet
    if (prefs) {
      if (type === 'session_complete' && !prefs.session_alerts) {
        return res.status(200).json({
          success: true,
          skipped: true,
          reason: 'Parent has disabled session completion alerts',
        });
      }
      if (type === 'weekly_report' && !prefs.weekly_report) {
        return res.status(200).json({
          success: true,
          skipped: true,
          reason: 'Parent has disabled weekly report notifications',
        });
      }
    }

    // Insert notification
    const { data: notif, error } = await supabase
      .from('parent_notifications')
      .insert({
        parent_id: parentId,
        student_id: studentId,
        type,
        title,
        message,
        is_read: false,
        created_at: new Date().toISOString(),
      })
      .select('id, type, title, message, is_read, created_at')
      .single();

    if (error) {
      logger.error({ err: error }, 'Failed to insert notification');
      return res.status(500).json({ error: error.message });
    }

    logger.info(
      { notifId: notif.id, parentId, studentId, type },
      'Notification dispatched'
    );

    return res.status(201).json({
      success: true,
      notification: {
        id: notif.id,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        isRead: notif.is_read,
        createdAt: notif.created_at,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Send notification error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
