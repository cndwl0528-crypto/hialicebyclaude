/**
 * safety.js
 * HiAlice — Safety Monitoring Routes
 *
 * Admin-only endpoints for reviewing flagged AI responses and student inputs.
 * All routes require admin or super_admin role in production.
 *
 * Route summary:
 *   GET  /api/safety/logs            — Paginated list of safety log entries
 *   GET  /api/safety/stats           — Aggregated safety statistics (last 7 days)
 *   POST /api/safety/review/:logId   — Mark a specific log entry as reviewed
 */

import express from 'express';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import { safetyLogs } from '../middleware/contentFilter.js';
import logger from '../lib/logger.js';

const router = express.Router();

// ============================================================================
// Auth Guard
// ============================================================================

/**
 * In development: skips token verification so the admin UI can be tested
 *                 without setting up full auth.
 * In production:  enforces authMiddleware → requireAdmin chain.
 */
function adminAuth(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
    // Inject a synthetic admin identity so downstream code can reference req.user
    req.user = { id: 'dev-admin', role: 'admin', email: 'dev@hialice.local' };
    return next();
  }
  authMiddleware(req, res, (err) => {
    if (err) return next(err);
    requireAdmin(req, res, next);
  });
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse a positive integer query param.  Returns defaultVal if absent or invalid.
 *
 * @param {string|undefined} raw
 * @param {number}           defaultVal
 * @param {number}           maxVal
 * @returns {number}
 */
function parsePositiveInt(raw, defaultVal, maxVal = Infinity) {
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 1) return defaultVal;
  return Math.min(n, maxVal);
}

/**
 * Return true if `timestamp` falls within the last `days` calendar days.
 *
 * @param {string} timestamp  — ISO-8601
 * @param {number} days
 * @returns {boolean}
 */
function isWithinDays(timestamp, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(timestamp).getTime() >= cutoff;
}

/**
 * Build a short content preview safe to expose in the admin UI.
 * Truncates to 200 chars and strips newlines for compact display.
 *
 * @param {string|null} text
 * @returns {string}
 */
function buildPreview(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 200);
}

// ============================================================================
// GET /api/safety/logs
// ============================================================================

/**
 * Returns a paginated, optionally filtered slice of the in-process safety log.
 *
 * Query params:
 *   page        {number}  — 1-based page number (default: 1)
 *   limit       {number}  — items per page 1-100 (default: 20)
 *   flagType    {string}  — filter by flag label substring (e.g. "pii", "profanity")
 *   source      {string}  — "ai_response" | "student_input"
 *   reviewed    {string}  — "true" | "false" | omit for all
 *   days        {number}  — restrict to last N days (default: 7, max: 90)
 *
 * Response:
 *   { success, data: { logs, pagination: { page, limit, total, totalPages } } }
 */
router.get('/logs', adminAuth, (req, res) => {
  try {
    const page     = parsePositiveInt(req.query.page, 1);
    const limit    = parsePositiveInt(req.query.limit, 20, 100);
    const days     = parsePositiveInt(req.query.days, 7, 90);
    const flagType = req.query.flagType?.trim().toLowerCase() ?? null;
    const source   = req.query.source?.trim() ?? null;
    const reviewed = req.query.reviewed;  // 'true' | 'false' | undefined

    // Work with a copy so we can sort without mutating the shared store
    let filtered = safetyLogs.slice();

    // Date window filter
    filtered = filtered.filter((entry) => isWithinDays(entry.timestamp, days));

    // Source filter
    if (source && ['ai_response', 'student_input'].includes(source)) {
      filtered = filtered.filter((entry) => entry.source === source);
    }

    // Reviewed status filter
    if (reviewed === 'true') {
      filtered = filtered.filter((entry) => entry.reviewed === true);
    } else if (reviewed === 'false') {
      filtered = filtered.filter((entry) => entry.reviewed === false);
    }

    // Flag type filter (substring match on any flag label)
    if (flagType) {
      filtered = filtered.filter((entry) =>
        entry.flags.some((f) => f.toLowerCase().includes(flagType))
      );
    }

    // Sort most-recent first
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const total      = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset     = (page - 1) * limit;
    const page_data  = filtered.slice(offset, offset + limit);

    // Shape each entry for the client — omit raw originalText, provide preview
    const logs = page_data.map((entry) => ({
      id:           entry.id,
      timestamp:    entry.timestamp,
      source:       entry.source,
      studentId:    entry.studentId,
      studentAge:   entry.studentAge,
      sessionId:    entry.sessionId,
      flags:        entry.flags,
      preview:      buildPreview(entry.originalText),
      filteredText: entry.filteredText ? buildPreview(entry.filteredText) : null,
      reviewed:     entry.reviewed,
      reviewedAt:   entry.reviewedAt,
      reviewedBy:   entry.reviewedBy,
    }));

    return res.json({
      success: true,
      data: {
        logs,
        pagination: { page, limit, total, totalPages },
      },
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/safety/logs error');
    return res.status(500).json({ error: 'Failed to retrieve safety logs' });
  }
});

// ============================================================================
// GET /api/safety/stats
// ============================================================================

/**
 * Returns aggregated safety statistics for the last 7 days.
 *
 * Query params:
 *   days  {number}  — lookback window (default: 7, max: 90)
 *
 * Response:
 *   { success, data: { window_days, total_flags, by_source, by_flag_type,
 *                      unreviewed_count, daily_counts } }
 */
router.get('/stats', adminAuth, (req, res) => {
  try {
    const days = parsePositiveInt(req.query.days, 7, 90);

    const recent = safetyLogs.filter((entry) => isWithinDays(entry.timestamp, days));

    // Aggregate by source
    const bySource = { ai_response: 0, student_input: 0 };
    for (const entry of recent) {
      if (entry.source === 'ai_response')  bySource.ai_response++;
      if (entry.source === 'student_input') bySource.student_input++;
    }

    // Aggregate by flag type
    const byFlagType = {};
    for (const entry of recent) {
      for (const flag of entry.flags) {
        byFlagType[flag] = (byFlagType[flag] ?? 0) + 1;
      }
    }

    // Sort flag types by frequency descending
    const byFlagTypeSorted = Object.entries(byFlagType)
      .sort(([, a], [, b]) => b - a)
      .map(([flag, count]) => ({ flag, count }));

    // Unreviewed count
    const unreviewedCount = recent.filter((e) => !e.reviewed).length;

    // Daily counts for the past `days` days
    const dailyCounts = [];
    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = recent.filter((entry) => {
        const t = new Date(entry.timestamp).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      }).length;

      dailyCounts.push({
        date:  dayStart.toISOString().split('T')[0],
        count,
      });
    }

    return res.json({
      success: true,
      data: {
        window_days:      days,
        total_flags:      recent.length,
        by_source:        bySource,
        by_flag_type:     byFlagTypeSorted,
        unreviewed_count: unreviewedCount,
        daily_counts:     dailyCounts,
      },
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/safety/stats error');
    return res.status(500).json({ error: 'Failed to retrieve safety stats' });
  }
});

// ============================================================================
// POST /api/safety/review/:logId
// ============================================================================

/**
 * Mark a safety log entry as reviewed by the current admin.
 *
 * Params:
 *   logId  {number}  — id field of the log entry
 *
 * Response:
 *   { success, data: { id, reviewed, reviewedAt, reviewedBy } }
 */
router.post('/review/:logId', adminAuth, (req, res) => {
  try {
    const logId = parseInt(req.params.logId, 10);

    if (isNaN(logId) || logId < 1) {
      return res.status(400).json({ error: 'Invalid logId — must be a positive integer' });
    }

    const entry = safetyLogs.find((e) => e.id === logId);

    if (!entry) {
      return res.status(404).json({ error: `Safety log entry ${logId} not found` });
    }

    if (entry.reviewed) {
      // Idempotent — already reviewed, return current state
      return res.json({
        success: true,
        data: {
          id:         entry.id,
          reviewed:   entry.reviewed,
          reviewedAt: entry.reviewedAt,
          reviewedBy: entry.reviewedBy,
        },
        message: 'Already reviewed',
      });
    }

    entry.reviewed   = true;
    entry.reviewedAt = new Date().toISOString();
    entry.reviewedBy = req.user?.id ?? 'unknown';

    logger.info(
      { logId, reviewedBy: entry.reviewedBy },
      '[SafetyFilter] Log entry marked as reviewed'
    );

    return res.json({
      success: true,
      data: {
        id:         entry.id,
        reviewed:   entry.reviewed,
        reviewedAt: entry.reviewedAt,
        reviewedBy: entry.reviewedBy,
      },
    });
  } catch (err) {
    logger.error({ err }, 'POST /api/safety/review/:logId error');
    return res.status(500).json({ error: 'Failed to update review status' });
  }
});

export default router;
