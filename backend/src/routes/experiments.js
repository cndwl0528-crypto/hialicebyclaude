/**
 * experiments.js
 * HiAlice — A/B Experiment Routes
 *
 * Lightweight infrastructure for running controlled experiments across
 * AI prompts, session turn counts, reward systems, and more.
 *
 * Route summary:
 *   GET  /api/experiments                     — List all active experiments
 *   GET  /api/experiments/:name/variant       — Get assigned variant for a student
 *   POST /api/experiments/track               — Record an experiment event
 *   GET  /api/experiments/:name/results       — Get experiment results (admin only)
 */

import express from 'express';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import logger from '../lib/logger.js';

const router = express.Router();

// ============================================================================
// In-process event store
// (Replace with a proper DB table when scaling beyond prototype)
// ============================================================================

/** @type {Array<ExperimentEvent>} */
const eventStore = [];

let nextEventId = 1;

// ============================================================================
// Experiment definitions (single source of truth for the backend)
// ============================================================================

export const EXPERIMENTS = {
  session_turns: {
    name: 'session_turns',
    description: 'Optimal turns per stage',
    variants: ['3_turns', '4_turns', '5_turns'],
    status: 'active',
    createdAt: '2026-03-01T00:00:00.000Z',
  },
  reward_type: {
    name: 'reward_type',
    description: 'Which reward drives engagement',
    variants: ['badges_only', 'xp_system', 'story_unlock'],
    status: 'active',
    createdAt: '2026-03-01T00:00:00.000Z',
  },
  pre_reading: {
    name: 'pre_reading',
    description: 'Pre-reading module depth',
    variants: ['skip', 'quick', 'full'],
    status: 'active',
    createdAt: '2026-03-05T00:00:00.000Z',
  },
  vocab_timing: {
    name: 'vocab_timing',
    description: 'When to show vocabulary',
    variants: ['during_session', 'after_session', 'both'],
    status: 'active',
    createdAt: '2026-03-05T00:00:00.000Z',
  },
};

// ============================================================================
// Deterministic hashing (mirrors the frontend implementation)
// ============================================================================

/**
 * djb2 hash — same algorithm as the frontend abTest.js utility so that
 * server-side assignment always matches what the client computed.
 *
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // unsigned 32-bit
}

/**
 * Return the variant name assigned to a (studentId, experimentName) pair.
 *
 * @param {string} studentId
 * @param {string} experimentName
 * @returns {string}
 */
function assignVariant(studentId, experimentName) {
  const experiment = EXPERIMENTS[experimentName];
  if (!experiment || experiment.status !== 'active') {
    return experiment?.variants?.[0] ?? 'control';
  }
  const seed = `${studentId}::${experimentName}`;
  const idx = hashString(seed) % experiment.variants.length;
  return experiment.variants[idx];
}

// ============================================================================
// Auth guard
// ============================================================================

/**
 * Development: injects a synthetic admin so the admin UI works without auth.
 * Production: requires a valid JWT with admin/super_admin role.
 */
function adminAuth(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
    req.user = { id: 'dev-admin', role: 'admin', email: 'dev@hialice.local' };
    return next();
  }
  authMiddleware(req, res, (err) => {
    if (err) return next(err);
    requireAdmin(req, res, next);
  });
}

/**
 * Soft auth: populate req.user when a valid token is present, but continue
 * without error if no token is provided.  Used on public-ish endpoints where
 * we want the user context when available.
 */
function softAuth(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
    req.user = req.user || { id: 'dev-user', role: 'student' };
    return next();
  }
  // Try to extract the user from cookie or header; ignore failures
  authMiddleware(req, res, (err) => {
    if (err) {
      req.user = null;
    }
    next();
  });
}

// ============================================================================
// GET /api/experiments
// ============================================================================

/**
 * Returns the list of all experiments with their current status and metadata.
 *
 * Response:
 *   { success, data: { experiments: ExperimentSummary[] } }
 */
router.get('/', (req, res) => {
  try {
    const experiments = Object.values(EXPERIMENTS).map((exp) => ({
      name: exp.name,
      description: exp.description,
      variants: exp.variants,
      status: exp.status,
      createdAt: exp.createdAt,
      participantCount: eventStore.filter((e) => e.experimentName === exp.name).length,
    }));

    return res.json({
      success: true,
      data: { experiments },
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/experiments error');
    return res.status(500).json({ error: 'Failed to retrieve experiments' });
  }
});

// ============================================================================
// GET /api/experiments/:name/variant
// ============================================================================

/**
 * Returns the variant assigned to the given studentId for the named experiment.
 * Implements the same deterministic hashing as the client so assignments are
 * always consistent regardless of whether the client or server resolves them.
 *
 * Query params:
 *   studentId  {string}  — Student's unique identifier (required)
 *
 * Response:
 *   { success, data: { experiment, variant, studentId } }
 */
router.get('/:name/variant', softAuth, (req, res) => {
  try {
    const { name } = req.params;
    const studentId = req.query.studentId?.trim();

    const experiment = EXPERIMENTS[name];

    if (!experiment) {
      return res.status(404).json({
        error: `Experiment "${name}" not found`,
        availableExperiments: Object.keys(EXPERIMENTS),
      });
    }

    if (!studentId) {
      return res.status(400).json({ error: 'studentId query parameter is required' });
    }

    const variant = assignVariant(studentId, name);

    logger.debug(
      { experimentName: name, studentId, variant },
      '[experiments] Variant assigned'
    );

    return res.json({
      success: true,
      data: {
        experiment: name,
        variant,
        studentId,
        status: experiment.status,
      },
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/experiments/:name/variant error');
    return res.status(500).json({ error: 'Failed to resolve variant' });
  }
});

// ============================================================================
// POST /api/experiments/track
// ============================================================================

/**
 * Records an experiment event.  Called by the client-side trackEvent() utility.
 *
 * Body:
 *   {
 *     experimentName {string}  — Experiment key
 *     variant        {string}  — Variant name
 *     event          {string}  — Event name (e.g. 'session_complete')
 *     metadata       {object}  — Arbitrary additional data
 *     studentId      {string}  — Student's unique identifier (may be null)
 *     timestamp      {string}  — ISO-8601 client timestamp
 *   }
 *
 * Response:
 *   { success, data: { id } }
 */
router.post('/track', softAuth, (req, res) => {
  try {
    const {
      experimentName,
      variant,
      event,
      metadata = {},
      studentId = null,
      timestamp,
    } = req.body;

    // Basic input validation
    if (!experimentName || typeof experimentName !== 'string') {
      return res.status(400).json({ error: 'experimentName is required and must be a string' });
    }
    if (!variant || typeof variant !== 'string') {
      return res.status(400).json({ error: 'variant is required and must be a string' });
    }
    if (!event || typeof event !== 'string') {
      return res.status(400).json({ error: 'event is required and must be a string' });
    }

    const experiment = EXPERIMENTS[experimentName];
    if (!experiment) {
      return res.status(400).json({ error: `Unknown experiment: "${experimentName}"` });
    }

    if (!experiment.variants.includes(variant)) {
      return res.status(400).json({
        error: `Invalid variant "${variant}" for experiment "${experimentName}"`,
        validVariants: experiment.variants,
      });
    }

    const record = {
      id: nextEventId++,
      experimentName,
      variant,
      event,
      metadata: typeof metadata === 'object' && metadata !== null ? metadata : {},
      studentId: studentId ?? (req.user?.id || null),
      timestamp: timestamp || new Date().toISOString(),
      receivedAt: new Date().toISOString(),
    };

    eventStore.push(record);

    logger.info(
      { id: record.id, experimentName, variant, event, studentId: record.studentId },
      '[experiments] Event tracked'
    );

    return res.status(201).json({
      success: true,
      data: { id: record.id },
    });
  } catch (err) {
    logger.error({ err }, 'POST /api/experiments/track error');
    return res.status(500).json({ error: 'Failed to track event' });
  }
});

// ============================================================================
// GET /api/experiments/:name/results
// ============================================================================

/**
 * Returns aggregated results for the named experiment (admin only).
 *
 * The response mixes real tracked-event counts from the in-process store with
 * realistic mock conversion metrics so the admin UI is fully exercisable
 * even before real traffic has accumulated.
 *
 * Response:
 *   { success, data: { experiment, variants: VariantResult[], summary } }
 */
router.get('/:name/results', adminAuth, (req, res) => {
  try {
    const { name } = req.params;
    const experiment = EXPERIMENTS[name];

    if (!experiment) {
      return res.status(404).json({
        error: `Experiment "${name}" not found`,
        availableExperiments: Object.keys(EXPERIMENTS),
      });
    }

    // --- Real event counts from the in-process store ---
    const experimentEvents = eventStore.filter((e) => e.experimentName === name);

    // Build per-variant real counts
    const realCounts = {};
    for (const variant of experiment.variants) {
      realCounts[variant] = experimentEvents.filter((e) => e.variant === variant).length;
    }

    const totalRealEvents = experimentEvents.length;

    // --- Mock conversion data (realistic, seeded so it looks stable) ---
    const MOCK_METRICS = {
      session_turns: {
        '3_turns':  { participants: 142, completionRate: 0.61, avgGrammarScore: 74, avgSessionDuration: 820  },
        '4_turns':  { participants: 138, completionRate: 0.72, avgGrammarScore: 79, avgSessionDuration: 1040 },
        '5_turns':  { participants: 135, completionRate: 0.68, avgGrammarScore: 81, avgSessionDuration: 1230 },
      },
      reward_type: {
        badges_only:   { participants: 189, completionRate: 0.58, returnRate: 0.41, avgSessionsPerWeek: 2.1 },
        xp_system:     { participants: 193, completionRate: 0.67, returnRate: 0.55, avgSessionsPerWeek: 2.8 },
        story_unlock:  { participants: 187, completionRate: 0.71, returnRate: 0.63, avgSessionsPerWeek: 3.2 },
      },
      pre_reading: {
        skip:  { participants: 201, completionRate: 0.65, avgComprehensionScore: 71, avgTimeToFirstTurn: 12 },
        quick: { participants: 198, completionRate: 0.73, avgComprehensionScore: 77, avgTimeToFirstTurn: 18 },
        full:  { participants: 195, completionRate: 0.69, avgComprehensionScore: 82, avgTimeToFirstTurn: 31 },
      },
      vocab_timing: {
        during_session: { participants: 167, completionRate: 0.62, vocabRetentionRate: 0.49, avgNewWordsPerSession: 5.2 },
        after_session:  { participants: 171, completionRate: 0.74, vocabRetentionRate: 0.61, avgNewWordsPerSession: 6.8 },
        both:           { participants: 169, completionRate: 0.70, vocabRetentionRate: 0.68, avgNewWordsPerSession: 7.4 },
      },
    };

    const mockForExperiment = MOCK_METRICS[name] ?? {};

    const variants = experiment.variants.map((variantName) => {
      const mock = mockForExperiment[variantName] ?? {
        participants: Math.floor(Math.random() * 100 + 100),
        completionRate: Math.random() * 0.3 + 0.5,
      };

      const liveEventCount = realCounts[variantName] ?? 0;

      return {
        name: variantName,
        // Merge real-time event count into the participant total for display
        participants: mock.participants + liveEventCount,
        liveEventCount,
        metrics: { ...mock, participants: undefined },
        completionRate: mock.completionRate,
      };
    });

    // Identify winning variant by completionRate
    const winner = [...variants].sort((a, b) => b.completionRate - a.completionRate)[0];

    return res.json({
      success: true,
      data: {
        experiment: {
          name: experiment.name,
          description: experiment.description,
          status: experiment.status,
          createdAt: experiment.createdAt,
        },
        variants,
        summary: {
          totalParticipants: variants.reduce((s, v) => s + v.participants, 0),
          totalLiveEvents: totalRealEvents,
          leadingVariant: winner?.name ?? null,
          leadingCompletionRate: winner?.completionRate ?? null,
          dataSource: totalRealEvents > 0 ? 'mixed' : 'mock',
        },
      },
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/experiments/:name/results error');
    return res.status(500).json({ error: 'Failed to retrieve experiment results' });
  }
});

export default router;
