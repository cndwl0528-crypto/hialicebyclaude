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
import { generateToken, authMiddleware, COOKIE_OPTIONS, COOKIE_NAME } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/sanitize.js';
import logger from '../lib/logger.js';

const router = express.Router();

// ============================================================================
// POST /register
// ============================================================================

/**
 * Register a new parent account via Supabase Auth.
 * Body: { email, password, displayName }
 * Returns: { token, parent: { id, email, display_name } }
 */
router.post('/register', authRateLimiter, async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'email, password, and displayName are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { user } = data;

    // Insert parent record into our database
    const { data: parentData, error: parentError } = await supabase
      .from('parents')
      .insert({
        auth_id: user.id,
        email,
        display_name: displayName,
        created_at: new Date().toISOString(),
      })
      .select('id, email, display_name')
      .single();

    if (parentError) {
      logger.error({ err: parentError }, 'Failed to insert parent record');
      return res.status(500).json({ error: 'Account created but profile setup failed. Please try logging in.' });
    }

    // Generate JWT token
    const token = generateToken({
      parentId: parentData.id,
      email: parentData.email,
      type: 'parent',
    });

    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    return res.status(201).json({
      token,
      parent: parentData,
      children: [],
    });
  } catch (err) {
    logger.error({ err }, 'Register error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /children
// ============================================================================

/**
 * Add a child to the authenticated parent's account.
 * Requires: Parent Bearer token
 * Body: { name, age, avatarEmoji }
 * Returns: { student: { id, name, age, level, avatarEmoji } }
 */
router.post('/children', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.type !== 'parent') {
      return res.status(403).json({ error: 'Parent authentication required' });
    }

    const { name, age, avatarEmoji } = req.body;

    if (!name || !age) {
      return res.status(400).json({ error: 'name and age are required' });
    }

    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 4 || ageNum > 18) {
      return res.status(400).json({ error: 'age must be between 4 and 18' });
    }

    // Auto-assign level based on age
    let level = 'beginner';
    if (ageNum >= 12) level = 'advanced';
    else if (ageNum >= 9) level = 'intermediate';

    const parentId = req.user.parentId;

    const { data: student, error } = await supabase
      .from('students')
      .insert({
        parent_id: parentId,
        name,
        age: ageNum,
        level,
        avatar_emoji: avatarEmoji || '🧒',
        created_at: new Date().toISOString(),
      })
      .select('id, name, age, level, avatar_emoji')
      .single();

    if (error) {
      logger.error({ err: error }, 'Failed to insert student');
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({
      student: {
        id: student.id,
        name: student.name,
        age: student.age,
        level: student.level,
        avatarEmoji: student.avatar_emoji,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Add child error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

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

    // Set httpOnly cookie
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    return res.status(200).json({
      token,
      parent: parentData,
      children: childrenData || [],
    });
  } catch (err) {
    logger.error({ err }, 'Parent login error');
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

    // Set httpOnly cookie
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

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
    logger.error({ err }, 'Child select error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /refresh
// ============================================================================

/**
 * Refresh the current JWT token.
 * Issues a new token with a fresh 24h expiry using the same claims.
 * Requires a valid (non-expired) Bearer token.
 *
 * Returns: { token, expiresIn: 86400 }
 */
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    const { type } = req.user;

    let newPayload;

    if (type === 'parent') {
      newPayload = {
        parentId: req.user.parentId,
        email: req.user.email,
        type: 'parent',
      };
    } else if (type === 'student') {
      newPayload = {
        studentId: req.user.studentId,
        name: req.user.name,
        type: 'student',
      };
    } else {
      return res.status(400).json({ error: 'Invalid token type' });
    }

    const token = generateToken(newPayload);

    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    return res.status(200).json({
      token,
      expiresIn: 86400,
    });
  } catch (err) {
    logger.error({ err }, 'Token refresh error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /logout
// ============================================================================

/**
 * Log out the current user.
 * Calls Supabase Auth signOut to invalidate the remote session.
 * Our own JWTs are stateless — the client should discard the token.
 *
 * Returns: { success: true }
 */
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    // Sign out from Supabase Auth to invalidate any active Supabase sessions.
    // This is a best-effort call; our JWTs are stateless so the client must
    // also clear its stored token.
    const { error } = await supabase.auth.signOut();

    if (error) {
      // Log but do not surface to client — the signOut is best-effort
      logger.warn({ error: error.message }, 'Supabase signOut error (non-fatal)');
    }

    // Clear the auth cookie — must use the same options that were used to set
    // it (minus maxAge/expires) so the browser actually removes it.
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully. Please clear your client token.',
    });
  } catch (err) {
    logger.error({ err }, 'Logout error');
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
    logger.error({ err }, 'Get me error');
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
    logger.error({ err }, 'Get notifications error');
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
    logger.error({ err }, 'Mark read error');
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
      logger.warn({ parentEmail }, 'Consent: parent record not found, proceeding to audit log');
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
      logger.error({ err: auditError }, 'Consent audit log insert failed');
      return res.status(500).json({ error: 'Failed to record consent audit entry' });
    }

    return res.status(200).json({
      success: true,
      message: 'Consent recorded successfully',
      consentDate: consentTimestamp || new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, 'Consent error');
    return res.status(500).json({ error: 'Failed to record consent' });
  }
});

export default router;
