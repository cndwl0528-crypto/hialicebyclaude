/**
 * sessionPipeline.js
 * HiAlice — Session Pipeline Orchestrator
 *
 * Orchestrates the full reading-review session lifecycle with:
 *   - Age-adaptive stage management (beginner / intermediate / advanced)
 *   - A state machine that tracks stage and turn progression
 *   - Quality gates that determine early advancement or continued probing
 *   - Engagement detection driven entirely by string analysis (no API calls)
 *   - Model selection hints that integrate with the existing modelRouter
 *   - Fully serialisable state for Supabase / sessionStorage persistence
 *
 * This module is a SERVICE, not a route. It is consumed by sessions.js but
 * never writes to the database itself — it only computes and advises.
 *
 * Usage from sessions.js:
 *   import { SessionPipeline, createPipelineMiddleware } from '../services/sessionPipeline.js';
 *
 * ES Modules — compatible with the rest of the HiAlice backend.
 */

import { classifyAnswerDepth } from '../alice/levelDetector.js';
import { selectModel } from './modelRouter.js';

// ============================================================================
// STAGE CONSTANTS
// ============================================================================

/**
 * Canonical stage order for a full HiAlice session.
 * This matches the stage sequence enforced by sessions.js and the dialogues table.
 */
export const STAGE_ORDER = [
  'warm_connection',
  'title',
  'introduction',
  'body',
  'conclusion',
  'cross_book',
];

// ============================================================================
// AGE-ADAPTIVE STAGE CONFIGURATION
// ============================================================================

/**
 * Per-level configuration that controls which stages run, how many turns each
 * stage allows, and which stages are conditionally or unconditionally skipped.
 *
 * skipConditions values:
 *   'always'         — stage is never included for this level
 *   'first_session'  — stage is skipped when options.isFirstSession === true
 *
 * totalMaxTurns acts as a hard ceiling: if the cumulative turn count across all
 * stages reaches this value, the session is marked complete regardless of
 * which stage is current.
 */
export const STAGE_CONFIG = {
  /**
   * Beginner — 6-8 year olds
   * Shorter sessions with fewer stages to keep young learners engaged.
   * Introduction is merged into the title stage; cross_book is too complex.
   */
  beginner: {
    stages: ['warm_connection', 'title', 'body', 'conclusion'],
    maxTurnsPerStage: 2,
    totalMaxTurns: 8,
    skipConditions: {
      cross_book: 'always',
      introduction: 'always',
    },
  },

  /**
   * Intermediate — 9-11 year olds
   * Standard session covering five stages. cross_book is skipped on the
   * very first session to avoid overwhelming first-time users.
   */
  intermediate: {
    stages: ['warm_connection', 'title', 'introduction', 'body', 'conclusion'],
    maxTurnsPerStage: 3,
    totalMaxTurns: 15,
    skipConditions: {
      cross_book: 'first_session',
    },
  },

  /**
   * Advanced — 12-13 year olds
   * Full session with all six stages and no skips. Analytical and
   * cross-text thinking is expected and encouraged.
   */
  advanced: {
    stages: STAGE_ORDER,
    maxTurnsPerStage: 3,
    totalMaxTurns: 18,
    skipConditions: {},
  },
};

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Resolve the effective stage list for a session, applying skip conditions.
 *
 * @param {string} level           - 'beginner' | 'intermediate' | 'advanced'
 * @param {boolean} isFirstSession - Whether this is the student's first session
 * @returns {string[]} Ordered list of stages that will actually run
 * @private
 */
function resolveStages(level, isFirstSession) {
  const config = STAGE_CONFIG[level] || STAGE_CONFIG.intermediate;
  return config.stages.filter((stage) => {
    const condition = config.skipConditions[stage];
    if (!condition) return true;
    if (condition === 'always') return false;
    if (condition === 'first_session' && isFirstSession) return false;
    return true;
  });
}

/**
 * Return the maxTurnsPerStage ceiling for a given level, with a special
 * override for the 'body' stage which traditionally allows one extra turn
 * because students must provide three supporting reasons.
 *
 * @param {string} level - Student level
 * @param {string} stage - Current stage name
 * @returns {number} Maximum turns allowed for this stage
 * @private
 */
function maxTurnsForStage(level, stage) {
  const config = STAGE_CONFIG[level] || STAGE_CONFIG.intermediate;
  // Body stage always gets the full maxTurnsPerStage regardless of level,
  // since three-reason elaboration requires at least three turns.
  return config.maxTurnsPerStage;
}

// ============================================================================
// SESSION STATE MACHINE
// ============================================================================

/**
 * Finite-state machine that models a single HiAlice reading-review session.
 *
 * The machine tracks:
 *   - Which stages are active (resolved at construction from level + options)
 *   - The current stage index within those stages
 *   - The turn number within the current stage (1-indexed)
 *   - The history of all completed stages, with their per-stage quality scores
 *   - The total turn count across the whole session (for ceiling enforcement)
 *
 * The machine ADVISES but does not enforce — callers (sessions.js) decide
 * whether to act on shouldAdvanceStage() recommendations.
 */
export class SessionStateMachine {
  /**
   * @param {string} sessionId
   * @param {string} level       - 'beginner' | 'intermediate' | 'advanced'
   * @param {object} [options={}]
   * @param {boolean} [options.isFirstSession=false]
   * @param {string[]} [options.previousBooks=[]]  - Titles of books the student has discussed before
   * @param {number}   [options.studentAge]        - Exact age, used for future fine-grained tuning
   */
  constructor(sessionId, level, options = {}) {
    const { isFirstSession = false, previousBooks = [], studentAge } = options;

    this.sessionId        = sessionId;
    this.level            = level;
    this.options          = { isFirstSession, previousBooks, studentAge };
    this.config           = STAGE_CONFIG[level] || STAGE_CONFIG.intermediate;
    this.stages           = resolveStages(level, isFirstSession);

    this.currentStageIndex = 0;
    this.currentTurn       = 0;    // turns taken inside the current stage (student messages only)
    this.totalTurns        = 0;    // cumulative student turns across all stages
    this.stageHistory      = [];   // completed stage summaries
    this.qualityScores     = [];   // ordered stage quality scores (0-100), parallel to stageHistory
    this._complete         = false;

    // Per-turn depth score log for the current stage (reset on advance).
    this._currentStageDepthScores = [];
  }

  // --------------------------------------------------------------------------
  // ACCESSORS
  // --------------------------------------------------------------------------

  /** Return the name of the stage currently being processed. */
  getCurrentStage() {
    if (this._complete || this.currentStageIndex >= this.stages.length) {
      return null;
    }
    return this.stages[this.currentStageIndex];
  }

  /** Return true when all stages have been completed. */
  isComplete() {
    return this._complete || this.currentStageIndex >= this.stages.length;
  }

  // --------------------------------------------------------------------------
  // STAGE ADVANCEMENT DECISION
  // --------------------------------------------------------------------------

  /**
   * Determine whether the session should move to the next stage.
   *
   * This method is pure — it does not mutate state. It returns an advisory
   * object so that callers can decide whether to act.
   *
   * Advancement triggers (evaluated in priority order):
   *   1. Hard ceiling: totalMaxTurns reached (always advance / complete)
   *   2. Stage turn ceiling: maxTurnsPerStage reached for this stage
   *   3. Depth signal: two or more analytical/deep responses in this stage
   *   4. Explicit move-on intent detected in the student message
   *   5. Quality gate: running stage quality score is consistently high (>= 80)
   *
   * @param {object} context
   * @param {string} [context.studentMessage=''] - Latest student message text
   * @param {object} [context.depthAnalysis]     - Output of classifyAnswerDepth()
   * @returns {{ advance: boolean, reason: string }}
   */
  shouldAdvanceStage(context = {}) {
    const { studentMessage = '', depthAnalysis } = context;
    const stage   = this.getCurrentStage();
    const maxTurns = maxTurnsForStage(this.level, stage);

    // 1. Hard session ceiling — always advance (to complete).
    if (this.totalTurns >= this.config.totalMaxTurns) {
      return { advance: true, reason: 'total_max_turns_reached' };
    }

    // 2. Stage turn ceiling.
    if (this.currentTurn >= maxTurns) {
      return { advance: true, reason: 'stage_max_turns_reached' };
    }

    // 3. Depth signal: count analytical/deep responses within this stage.
    const allScores = [...this._currentStageDepthScores];
    if (depthAnalysis?.score !== undefined) {
      allScores.push(depthAnalysis.score);
    }
    const deepResponses = allScores.filter((s) => s >= 55).length;
    if (deepResponses >= 2) {
      return { advance: true, reason: 'high_depth_responses' };
    }

    // 4. Explicit move-on intent.
    if (studentMessage && _detectMoveOnIntent(studentMessage)) {
      return { advance: true, reason: 'student_requested_advance' };
    }

    // 5. Sustained high quality gate.
    if (allScores.length >= 2) {
      const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
      if (avgScore >= 80) {
        return { advance: true, reason: 'quality_gate_passed' };
      }
    }

    return { advance: false, reason: 'stage_in_progress' };
  }

  /**
   * Record a student turn within the current stage.
   * Updates turn counters and depth-score log.
   * Must be called BEFORE shouldAdvanceStage() for the current turn to be
   * included in depth scoring.
   *
   * @param {object} [depthAnalysis] - Optional output from classifyAnswerDepth()
   */
  recordTurn(depthAnalysis) {
    this.currentTurn += 1;
    this.totalTurns  += 1;

    if (depthAnalysis?.score !== undefined) {
      this._currentStageDepthScores.push(depthAnalysis.score);
    }
  }

  /**
   * Advance to the next stage in the session.
   *
   * Seals the current stage into stageHistory, resets per-stage counters,
   * and moves the stage index forward. If there are no more stages, the
   * session is marked complete.
   *
   * @returns {{
   *   newStage: string|null,   // Name of the stage just entered (null if complete)
   *   isComplete: boolean,
   *   stageReport: object      // Summary of the stage that just finished
   * }}
   */
  advanceStage() {
    const completedStage = this.getCurrentStage();
    const stageReport    = this.getStageReport();

    // Archive the completed stage.
    this.stageHistory.push(stageReport);
    this.qualityScores.push(stageReport.stageScore);

    // Move forward.
    this.currentStageIndex        += 1;
    this.currentTurn               = 0;
    this._currentStageDepthScores  = [];

    // Check completion.
    if (this.currentStageIndex >= this.stages.length
        || this.totalTurns >= this.config.totalMaxTurns) {
      this._complete = true;
      return {
        newStage: null,
        isComplete: true,
        stageReport,
        completedStage,
      };
    }

    return {
      newStage: this.stages[this.currentStageIndex],
      isComplete: false,
      stageReport,
      completedStage,
    };
  }

  // --------------------------------------------------------------------------
  // REPORTING
  // --------------------------------------------------------------------------

  /**
   * Generate a summary of the stage currently in progress (or just completed
   * before advanceStage() clears counters).
   *
   * @returns {{
   *   stage: string,
   *   turnsCompleted: number,
   *   avgDepthScore: number,
   *   stageScore: number,
   *   depthScores: number[]
   * }}
   */
  getStageReport() {
    const scores = [...this._currentStageDepthScores];
    const avg    = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

    return {
      stage:          this.getCurrentStage(),
      turnsCompleted: this.currentTurn,
      avgDepthScore:  avg,
      stageScore:     avg,      // alias used by qualityScores[] and quality gate
      depthScores:    scores,
    };
  }

  /**
   * Generate a full session summary including all completed stages plus the
   * current stage-in-progress.
   *
   * @returns {{
   *   sessionId: string,
   *   level: string,
   *   stages: string[],
   *   stageHistory: object[],
   *   currentStage: string|null,
   *   totalTurns: number,
   *   overallScore: number,
   *   isComplete: boolean
   * }}
   */
  getSessionReport() {
    const allScores = [...this.qualityScores];
    const currentReport = this.isComplete() ? null : this.getStageReport();
    if (currentReport) {
      allScores.push(currentReport.stageScore);
    }

    const overallScore = allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : 0;

    return {
      sessionId:    this.sessionId,
      level:        this.level,
      stages:       this.stages,
      stageHistory: this.stageHistory,
      currentStage: this.getCurrentStage(),
      totalTurns:   this.totalTurns,
      overallScore,
      isComplete:   this.isComplete(),
    };
  }

  // --------------------------------------------------------------------------
  // SERIALISATION
  // --------------------------------------------------------------------------

  /**
   * Return a plain JSON-serialisable object representing the full machine state.
   * Safe to store in Supabase session metadata or Express session storage.
   *
   * @returns {object}
   */
  serialize() {
    return {
      sessionId:                this.sessionId,
      level:                    this.level,
      options:                  this.options,
      stages:                   this.stages,
      currentStageIndex:        this.currentStageIndex,
      currentTurn:              this.currentTurn,
      totalTurns:               this.totalTurns,
      stageHistory:             this.stageHistory,
      qualityScores:            this.qualityScores,
      _complete:                this._complete,
      _currentStageDepthScores: this._currentStageDepthScores,
    };
  }

  /**
   * Reconstruct a SessionStateMachine from a previously serialised snapshot.
   *
   * @param {object} data - Output of a prior serialize() call
   * @returns {SessionStateMachine}
   */
  static deserialize(data) {
    const machine = new SessionStateMachine(data.sessionId, data.level, data.options || {});

    // Overwrite the fields computed by the constructor with persisted values.
    machine.stages                   = data.stages;
    machine.currentStageIndex        = data.currentStageIndex;
    machine.currentTurn              = data.currentTurn;
    machine.totalTurns               = data.totalTurns;
    machine.stageHistory             = data.stageHistory;
    machine.qualityScores            = data.qualityScores;
    machine._complete                = data._complete;
    machine._currentStageDepthScores = data._currentStageDepthScores;

    return machine;
  }
}

// ============================================================================
// QUALITY GATE
// ============================================================================

/**
 * Evaluate the quality of student responses within the current stage and
 * return an advisory on whether to advance, continue probing, or simplify.
 *
 * This function is stateless and pure — it accepts the collected depth scores
 * for the stage and the configured ceiling, and computes an opinion.
 *
 * Decision matrix:
 *   - 2+ analytical/deep responses (score >= 55)  → suggest 'advance'
 *   - All responses surface-level (score < 15)    → suggest 'simplify'
 *   - Max turns reached                           → force 'advance'
 *   - Student is engaged (long responses, avg > 35) → suggest 'continue'
 *   - Otherwise                                   → suggest 'continue'
 *
 * @param {Array<{ score: number, depth: string, indicators: string[] }>} stageHistory
 *   Depth analysis objects collected so far in the current stage.
 * @param {string} level - 'beginner' | 'intermediate' | 'advanced'
 * @param {number} currentTurn  - Current turn number within the stage (1-indexed)
 * @returns {{
 *   canAdvance: boolean,
 *   suggestion: 'advance' | 'continue' | 'simplify',
 *   reason: string,
 *   stageScore: number
 * }}
 */
export function qualityGate(stageHistory, level, currentTurn) {
  const config   = STAGE_CONFIG[level] || STAGE_CONFIG.intermediate;
  const maxTurns = config.maxTurnsPerStage;
  const scores   = stageHistory.map((h) => h.score ?? 0);

  // Compute aggregate score for the stage so far.
  const stageScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  // Force advance when the stage ceiling is reached.
  if (currentTurn >= maxTurns) {
    return {
      canAdvance: true,
      suggestion: 'advance',
      reason:     'max_turns_reached',
      stageScore,
    };
  }

  // Count analytical/deep responses (score >= 55 maps to 'analytical' or 'deep').
  const deepCount = scores.filter((s) => s >= 55).length;
  if (deepCount >= 2) {
    return {
      canAdvance: true,
      suggestion: 'advance',
      reason:     'sufficient_analytical_responses',
      stageScore,
    };
  }

  // All responses are surface-level — recommend simplification.
  const allSurface = scores.length >= 1 && scores.every((s) => s < 15);
  if (allSurface) {
    return {
      canAdvance: false,
      suggestion: 'simplify',
      reason:     'all_surface_responses',
      stageScore,
    };
  }

  // Student is engaged but hasn't hit the depth threshold yet — continue.
  if (stageScore >= 35) {
    return {
      canAdvance: false,
      suggestion: 'continue',
      reason:     'engaged_developing_responses',
      stageScore,
    };
  }

  // Default: let the conversation continue.
  return {
    canAdvance: false,
    suggestion: 'continue',
    reason:     'stage_in_progress',
    stageScore,
  };
}

// ============================================================================
// ENGAGEMENT DETECTOR
// ============================================================================

// Minimum word counts used as engagement thresholds.
// These are tuned for native-ish child English (not native speakers).
const ENGAGEMENT_WORD_THRESHOLDS = {
  high:       25,   // >= 25 words: rich, extended response
  medium:     10,   // >= 10 words: standard response
  low:         3,   // 3-9 words: brief
  disengaged:  0,   // 0-2 words: minimal or no response
};

// Patterns that signal high engagement.
const HIGH_ENGAGEMENT_PATTERNS = [
  /\bbecause\b/i,                         // causal reasoning
  /\bI think|I feel|I believe\b/i,        // personal stance
  /\bin the (book|story)\b/i,             // text reference
  /\bwhat if|I wonder\b/i,               // hypothetical thinking
  /\b(but|however|although)\b/i,          // contrastive thinking
  /\bfor example|like when\b/i,           // evidence citation
  /\b(should|shouldn't|right|wrong|fair|unfair)\b/i, // evaluative
];

// Phrases that strongly signal disengagement.
const DISENGAGED_PATTERNS = [
  /^(i don'?t know\.?|idk\.?|no\.?|yes\.?|ok\.?|okay\.?)$/i,
  /\bi (don'?t|do not) (want|like|care)\b/i,
  /\bcan we (stop|finish|end|quit)\b/i,
  /\bthis is (boring|hard|stupid|dumb)\b/i,
];

// Counter-question indicators — high engagement signal.
const COUNTER_QUESTION_PATTERN = /\?/;

/**
 * Analyse a collection of student messages and return an engagement assessment.
 *
 * This function runs entirely on string analysis — no API calls. It is
 * designed to be fast (< 1 ms) so it can safely run synchronously per turn.
 *
 * @param {string[]} studentMessages - Array of student message strings for this stage.
 *   At minimum, pass the messages for the current stage. For better trend
 *   detection, include all messages for the session so far.
 * @returns {{
 *   level: 'high' | 'medium' | 'low' | 'disengaged',
 *   indicators: string[],
 *   recommendation: string
 * }}
 */
export function detectEngagement(studentMessages) {
  if (!Array.isArray(studentMessages) || studentMessages.length === 0) {
    return {
      level:          'medium',
      indicators:     [],
      recommendation: 'No messages yet — apply standard approach.',
    };
  }

  // Work from the most recent messages (up to last 5) for responsiveness.
  const recent   = studentMessages.slice(-5);
  const combined = recent.join(' ');
  const words    = combined.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const avgWords  = Math.round(wordCount / recent.length);

  const indicators = [];

  // --- Disengagement check (evaluated first, highest priority) ---
  const disengagedCount = recent.filter(
    (msg) => DISENGAGED_PATTERNS.some((p) => p.test(msg.trim()))
  ).length;

  if (disengagedCount >= 2 || (recent.length === 1 && DISENGAGED_PATTERNS.some((p) => p.test(recent[0].trim())))) {
    indicators.push('refuses_or_avoids');
    return {
      level:          'disengaged',
      indicators,
      recommendation: 'Switch to choice-based questions ("Was it funny or sad?"). Consider ending the session early if disengagement persists.',
    };
  }

  // --- Very short responses ---
  const shortResponseCount = recent.filter((msg) => {
    const wc = msg.trim().split(/\s+/).filter(Boolean).length;
    return wc <= 2;
  }).length;

  if (shortResponseCount >= Math.ceil(recent.length * 0.6)) {
    indicators.push('short_responses');
  }

  // --- High-engagement linguistic patterns ---
  let patternHits = 0;
  HIGH_ENGAGEMENT_PATTERNS.forEach((pattern) => {
    if (pattern.test(combined)) {
      patternHits += 1;
    }
  });

  if (patternHits >= 3) indicators.push('rich_language');
  if (patternHits >= 2) indicators.push('causal_or_evaluative_language');

  // --- Counter-questions (student asks Alice something back) ---
  const counterQuestionCount = recent.filter((msg) => COUNTER_QUESTION_PATTERN.test(msg)).length;
  if (counterQuestionCount >= 1) indicators.push('asks_counter_questions');

  // --- Vocabulary novelty proxy: unique-word ratio ---
  const uniqueWords    = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z]/g, '')));
  const uniqueRatio    = uniqueWords.size / Math.max(wordCount, 1);
  if (uniqueRatio > 0.75 && wordCount >= 15) indicators.push('diverse_vocabulary');

  // --- Classify engagement level ---
  let engagementLevel;

  if (avgWords >= ENGAGEMENT_WORD_THRESHOLDS.high
      && (patternHits >= 2 || counterQuestionCount >= 1)) {
    engagementLevel = 'high';
  } else if (avgWords >= ENGAGEMENT_WORD_THRESHOLDS.medium || patternHits >= 1) {
    engagementLevel = 'medium';
  } else if (avgWords >= ENGAGEMENT_WORD_THRESHOLDS.low) {
    engagementLevel = 'low';
  } else {
    engagementLevel = 'disengaged';
  }

  // --- Recommendation per level ---
  const recommendations = {
    high:       'Continue with current approach. Deepen questions with "Why?" and "What evidence from the story supports that?"',
    medium:     'Standard approach. Add occasional encouragement ("That\'s a great start!") and gentle prompts for more detail.',
    low:        'Simplify questions, offer two-choice prompts ("Was it funny or scary?"), and add extra praise for any response.',
    disengaged: 'Switch to choice-based questions ("Was it funny or sad?"). Consider ending the session early if disengagement persists.',
  };

  return {
    level:          engagementLevel,
    indicators,
    recommendation: recommendations[engagementLevel],
  };
}

// ============================================================================
// INTERNAL — MOVE-ON INTENT DETECTION
// ============================================================================

/**
 * Detect whether the student is explicitly signalling they want to move on.
 * Matched against common child-language expressions.
 *
 * @param {string} message
 * @returns {boolean}
 * @private
 */
function _detectMoveOnIntent(message) {
  if (!message || typeof message !== 'string') return false;
  const MOVE_ON_PATTERNS = [
    /\b(next|continue|move on|go on|go ahead|let'?s continue|next question|next part|next stage)\b/i,
    /\bI'?m (done|finished|ready)\b/i,
    /\bcan we (go|move|continue|do the next)\b/i,
    /\bwhat'?s next\b/i,
  ];
  return MOVE_ON_PATTERNS.some((p) => p.test(message));
}

// ============================================================================
// MODEL HINT HELPER
// ============================================================================

/**
 * Map a pipeline engagement level and session context to a model hint.
 * The hint is a string that sessions.js can pass to modelRouter.selectModel().
 *
 * Escalation logic:
 *   - Disengaged student → HAIKU (simpler, faster prompts needed)
 *   - Low engagement    → HAIKU for beginners, SONNET otherwise
 *   - High engagement   → SONNET for intermediate/advanced (richer follow-up)
 *   - Default           → defer to modelRouter.selectModel('session_response')
 *
 * @param {string} engagementLevel - 'high' | 'medium' | 'low' | 'disengaged'
 * @param {string} level           - Student level
 * @param {number} turn            - Current turn number
 * @param {number} historyLength   - Number of prior dialogue rows
 * @returns {string} Model identifier string from MODELS in modelRouter.js
 * @private
 */
function _resolveModelHint(engagementLevel, level, turn, historyLength) {
  const { model } = selectModel('session_response', { level, turn, historyLength });

  // Disengaged: always use Haiku — short, choice-based questions are simpler.
  if (engagementLevel === 'disengaged') {
    const { model: haiku } = selectModel('rephrase');
    return haiku;
  }

  // Low engagement for beginner: fast Haiku response is best.
  if (engagementLevel === 'low' && level === 'beginner') {
    const { model: haiku } = selectModel('rephrase');
    return haiku;
  }

  // High engagement for intermediate/advanced: Sonnet for richer depth.
  if (engagementLevel === 'high' && (level === 'intermediate' || level === 'advanced')) {
    const { model: sonnet } = selectModel('metacognitive');
    return sonnet;
  }

  // Default: use modelRouter's own judgement.
  return model;
}

// ============================================================================
// SESSION PIPELINE (MAIN ORCHESTRATOR)
// ============================================================================

/**
 * SessionPipeline is the top-level orchestrator consumed by sessions.js.
 *
 * One instance per active session. It wraps:
 *   - SessionStateMachine (stage and turn tracking)
 *   - detectEngagement()  (per-turn engagement analysis)
 *   - qualityGate()       (stage advancement advisory)
 *   - modelHint           (integration point for modelRouter)
 *
 * The pipeline does NOT call the database. All state is serialisable for
 * storage in session metadata (e.g. sessions.pipeline_state in Supabase).
 *
 * @example
 * // In sessions.js POST /:id/message handler:
 * const pipeline = req.pipeline; // attached by createPipelineMiddleware()
 * const result   = await pipeline.processTurn(content, {
 *   conversationHistory: dialogues,
 *   stage,
 * });
 * // result.stageAdvanced, result.engagement, result.modelHint, etc.
 */
export class SessionPipeline {
  /**
   * @param {string} sessionId
   * @param {string} level     - 'beginner' | 'intermediate' | 'advanced'
   * @param {object} [options={}]
   * @param {boolean} [options.isFirstSession=false]
   * @param {string[]} [options.previousBooks=[]]
   * @param {number}   [options.studentAge]
   */
  constructor(sessionId, level, options = {}) {
    this.stateMachine      = new SessionStateMachine(sessionId, level, options);
    this.engagementHistory = [];   // All engagement assessments, one per turn
    this._studentMessages  = [];   // All student message strings this session
  }

  // --------------------------------------------------------------------------
  // MAIN TURN PROCESSOR
  // --------------------------------------------------------------------------

  /**
   * Process a single student turn and return orchestration metadata.
   *
   * This is the primary method called by sessions.js after storing the
   * student's message in the database. It:
   *   1. Classifies the answer depth (reusing levelDetector.js)
   *   2. Records the turn in the state machine
   *   3. Detects engagement from all student messages so far
   *   4. Evaluates the quality gate
   *   5. Determines whether to advance the stage
   *   6. Selects a model hint
   *
   * NOTE: The pipeline does NOT advance the state machine automatically.
   * It returns stageAdvanced=false and lets sessions.js call
   * pipeline.commitAdvance() when it is ready to transition the DB stage.
   *
   * @param {string} studentMessage - The raw student message text
   * @param {object} [context={}]
   * @param {string[]} [context.conversationHistory=[]] - Prior dialogue rows (student messages only or all)
   * @param {string}   [context.stage]                 - Stage name (for cross-validation)
   * @returns {{
   *   stage: string,
   *   turn: number,
   *   stageAdvanced: boolean,
   *   advanceReason: string|null,
   *   nextStage: string|null,
   *   engagement: { level: string, indicators: string[], recommendation: string },
   *   qualityGateResult: { canAdvance: boolean, suggestion: string, reason: string, stageScore: number },
   *   modelHint: string,
   *   sessionComplete: boolean,
   *   pipelineMetadata: object
   * }}
   */
  async processTurn(studentMessage, context = {}) {
    const { conversationHistory = [] } = context;
    const currentStage = this.stateMachine.getCurrentStage();

    // --- 1. Classify answer depth ---
    const depthAnalysis = studentMessage
      ? classifyAnswerDepth(studentMessage, this.stateMachine.level)
      : { depth: 'surface', score: 0, indicators: [] };

    // --- 2. Record turn in the state machine ---
    this.stateMachine.recordTurn(depthAnalysis);
    this._studentMessages.push(studentMessage || '');

    // --- 3. Engagement detection ---
    const engagement = detectEngagement(this._studentMessages);
    this.engagementHistory.push({
      turn:        this.stateMachine.totalTurns,
      stage:       currentStage,
      engagement:  engagement.level,
      indicators:  engagement.indicators,
    });

    // --- 4. Quality gate evaluation ---
    const stageDepthHistory = this.stateMachine._currentStageDepthScores.map((score) => ({
      score,
    }));
    const qualityGateResult = qualityGate(
      stageDepthHistory,
      this.stateMachine.level,
      this.stateMachine.currentTurn
    );

    // --- 5. Stage advancement decision ---
    const adviceResult = this.stateMachine.shouldAdvanceStage({
      studentMessage,
      depthAnalysis,
    });

    let stageAdvanced = false;
    let advanceReason = null;
    let nextStage     = null;
    let sessionComplete = this.stateMachine.isComplete();

    if (adviceResult.advance && !sessionComplete) {
      // Commit the advance immediately — the pipeline owns stage transitions.
      const advanceResult = this.stateMachine.advanceStage();
      stageAdvanced   = true;
      advanceReason   = adviceResult.reason;
      nextStage       = advanceResult.newStage;
      sessionComplete = advanceResult.isComplete;
    }

    // --- 6. Model hint ---
    const historyLength = Array.isArray(conversationHistory) ? conversationHistory.length : 0;
    const modelHint = _resolveModelHint(
      engagement.level,
      this.stateMachine.level,
      this.stateMachine.currentTurn,
      historyLength
    );

    // --- Build pipeline metadata for logging / analytics ---
    const pipelineMetadata = {
      sessionId:       this.stateMachine.sessionId,
      level:           this.stateMachine.level,
      totalTurns:      this.stateMachine.totalTurns,
      stageTurn:       this.stateMachine.currentTurn,
      depthAnalysis,
      qualityGate:     qualityGateResult,
      adviceReason:    adviceResult.reason,
      engagementTrail: this.engagementHistory.slice(-3),   // last 3 for conciseness
    };

    return {
      stage:             stageAdvanced ? (nextStage ?? currentStage) : currentStage,
      previousStage:     stageAdvanced ? currentStage : null,
      turn:              this.stateMachine.currentTurn,
      stageAdvanced,
      advanceReason,
      nextStage,
      engagement,
      qualityGateResult,
      modelHint,
      sessionComplete,
      pipelineMetadata,
    };
  }

  // --------------------------------------------------------------------------
  // STATE ACCESS
  // --------------------------------------------------------------------------

  /**
   * Return a serialisable snapshot of the full pipeline state.
   * Store this in sessions.pipeline_state (JSONB) in Supabase.
   *
   * @returns {{ stateMachine: object, engagementHistory: object[], studentMessages: string[] }}
   */
  getState() {
    return {
      stateMachine:      this.stateMachine.serialize(),
      engagementHistory: this.engagementHistory,
      studentMessages:   this._studentMessages,
    };
  }

  /**
   * Reconstruct a SessionPipeline from a previously saved state snapshot.
   *
   * @param {object} state - Output of a prior getState() call
   * @returns {SessionPipeline}
   */
  static fromState(state) {
    // Reconstruct state machine.
    const machine = SessionStateMachine.deserialize(state.stateMachine);

    // Build a shell pipeline and inject the restored machine + history.
    const pipeline = new SessionPipeline(
      machine.sessionId,
      machine.level,
      machine.options
    );
    pipeline.stateMachine      = machine;
    pipeline.engagementHistory = state.engagementHistory || [];
    pipeline._studentMessages  = state.studentMessages   || [];

    return pipeline;
  }

  /**
   * Convenience accessor for the current stage name.
   * @returns {string|null}
   */
  getCurrentStage() {
    return this.stateMachine.getCurrentStage();
  }

  /**
   * Convenience accessor for the full session report.
   * @returns {object}
   */
  getSessionReport() {
    return this.stateMachine.getSessionReport();
  }
}

// ============================================================================
// EXPRESS MIDDLEWARE FACTORY
// ============================================================================

/**
 * Create an Express middleware that attaches a SessionPipeline instance to
 * every request as req.pipeline.
 *
 * The middleware:
 *   1. Reads the pipeline state from req.session.pipelineState (if present)
 *      and reconstructs the pipeline via SessionPipeline.fromState().
 *   2. If no saved state exists, instantiates a fresh pipeline using
 *      req.pipelineInit (which sessions.js must populate before this runs).
 *   3. After the route handler sends its response, persists the updated
 *      pipeline state back to req.session.pipelineState.
 *
 * sessions.js usage:
 *   // Before calling createPipelineMiddleware, attach init params:
 *   router.post('/:id/message', optionalAuth, async (req, res, next) => {
 *     req.pipelineInit = { sessionId, level, options };
 *     next();
 *   }, createPipelineMiddleware(), actualMessageHandler);
 *
 * Alternatively, sessions.js can instantiate the pipeline directly and skip
 * the middleware entirely — the middleware is purely a convenience helper.
 *
 * @returns {Function} Express middleware function
 */
export function createPipelineMiddleware() {
  return function pipelineMiddleware(req, res, next) {
    // Attempt to restore pipeline from saved session state.
    const savedState = req.session?.pipelineState;

    if (savedState) {
      try {
        req.pipeline = SessionPipeline.fromState(savedState);
      } catch (err) {
        console.warn('[SessionPipeline] Failed to deserialise saved state — starting fresh.', err.message);
        req.pipeline = null;
      }
    }

    // If no saved state (or deserialisation failed), initialise a fresh pipeline.
    if (!req.pipeline) {
      const init = req.pipelineInit || {};
      const { sessionId, level = 'intermediate', options = {} } = init;

      if (sessionId) {
        req.pipeline = new SessionPipeline(sessionId, level, options);
      } else {
        // pipelineInit was not set — attach a no-op sentinel so callers
        // can always dereference req.pipeline without a null check crashing.
        req.pipeline = null;
      }
    }

    // Intercept res.json / res.send to save state after the response is built.
    // This is a lightweight after-hook; it does NOT delay the response.
    const originalJson = res.json.bind(res);
    res.json = function persistStateAndRespond(body) {
      if (req.pipeline && req.session) {
        try {
          req.session.pipelineState = req.pipeline.getState();
        } catch (err) {
          console.warn('[SessionPipeline] State persistence failed (non-fatal):', err.message);
        }
      }
      return originalJson(body);
    };

    next();
  };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  STAGE_ORDER,
  STAGE_CONFIG,
  SessionStateMachine,
  SessionPipeline,
  qualityGate,
  detectEngagement,
  createPipelineMiddleware,
};
