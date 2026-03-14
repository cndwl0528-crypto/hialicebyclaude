/**
 * HiAlice Cost-Aware LLM Model Router
 *
 * Routes Claude API calls to the most cost-appropriate model based on task
 * type and session context. Tracks per-session token costs, provides prompt
 * caching hints for system prompts, and wraps every API call in a retry
 * strategy with exponential backoff.
 *
 * Exports:
 *  - MODELS          — Model identifier constants
 *  - selectModel()   — Task-to-model mapping with explanatory reason string
 *  - CostTracker     — Per-session cost accumulator
 *  - buildCachedMessages() — Adds cache_control hints for long system prompts
 *  - callWithRetry() — Retry wrapper with transient-error detection
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// MODEL CONSTANTS
// ============================================================================

/**
 * Canonical model identifiers used throughout the HiAlice backend.
 * Update version suffixes here when Anthropic releases new snapshots.
 */
export const MODELS = {
  /** Fast and cheap — best for simple, template-driven tasks. */
  HAIKU:  'claude-haiku-4-5-20251001',
  /** Balanced default — handles most conversational and analytical tasks. */
  SONNET: 'claude-sonnet-4-20250514',
  /** Deep reasoning — reserved for highly complex analysis (rarely used). */
  OPUS:   'claude-opus-4-6',
};

// ============================================================================
// PRICING TABLE  (USD per 1 million tokens, as of 2025-2026)
// ============================================================================

/**
 * Token pricing used by CostTracker.record() to compute USD cost per call.
 * Values are per-1M-token rates; the tracker converts to per-token internally.
 *
 * @type {Record<string, { input: number, output: number }>}
 */
const PRICING = {
  [MODELS.HAIKU]:  { input: 0.80,  output: 4.00  },
  [MODELS.SONNET]: { input: 3.00,  output: 15.00 },
  [MODELS.OPUS]:   { input: 15.00, output: 75.00 },
};

// ============================================================================
// MODEL SELECTION
// ============================================================================

/**
 * Select the most cost-appropriate model for a given task type.
 *
 * Decision logic per task:
 *
 *  rephrase          → HAIKU   (simple reformatting, speed matters)
 *  feedback          → HAIKU   (template-style text, low reasoning load)
 *  grammar_check     → HAIKU   (pattern matching, no context window needed)
 *  evaluation        → HAIKU   (quality checks, heuristic-level reasoning)
 *  metacognitive     → SONNET  (needs conversation context and nuance)
 *  session_response  → depends on level and turn:
 *    beginner + turn 1          → HAIKU   (simple opening question)
 *    beginner + turn 2-3        → SONNET  (context-awareness required)
 *    intermediate (any turn)    → SONNET  (standard complexity)
 *    advanced    (any turn)     → SONNET  (higher complexity, Sonnet handles well)
 *    any level + history > 10   → SONNET  (long context processing)
 *
 * @param {string} taskType - One of: 'rephrase' | 'feedback' | 'grammar_check' |
 *   'evaluation' | 'metacognitive' | 'session_response'
 * @param {object} [options={}]
 * @param {string} [options.level]          - 'beginner' | 'intermediate' | 'advanced'
 * @param {number} [options.turn]           - Turn number within the current stage (1-indexed)
 * @param {number} [options.historyLength]  - Number of prior dialogue turns in the session
 * @param {string} [options.forceModel]     - Override all logic and use this model identifier
 * @returns {{ model: string, reason: string }}
 */
export function selectModel(taskType, options = {}) {
  const { level, turn = 1, historyLength = 0, forceModel } = options;

  // Hard override — allows per-call escalation without changing routing logic.
  if (forceModel && Object.values(MODELS).includes(forceModel)) {
    const reason = `forced override to ${forceModel}`;
    console.log(`[ModelRouter] Task: ${taskType} → Model: ${forceModel} (reason: ${reason})`);
    return { model: forceModel, reason };
  }

  let model;
  let reason;

  switch (taskType) {
    // ---- Always HAIKU: low-reasoning, template-driven tasks ----------------
    case 'rephrase':
      model  = MODELS.HAIKU;
      reason = 'simple rephrasing — fast response, low complexity';
      break;

    case 'feedback':
      model  = MODELS.HAIKU;
      reason = 'template-based session feedback — low reasoning load';
      break;

    case 'grammar_check':
      model  = MODELS.HAIKU;
      reason = 'pattern-matching grammar check — lightweight';
      break;

    case 'evaluation':
      model  = MODELS.HAIKU;
      reason = 'quality evaluation check — heuristic-level reasoning sufficient';
      break;

    // ---- Always SONNET: context-dependent conversational tasks -------------
    case 'metacognitive':
      model  = MODELS.SONNET;
      reason = 'metacognitive closing — requires conversation context and emotional nuance';
      break;

    // ---- SONNET or HAIKU: main session turns depend on level and history ---
    case 'session_response': {
      // Long conversation history always justifies Sonnet for context handling.
      if (historyLength > 10) {
        model  = MODELS.SONNET;
        reason = `long conversation history (${historyLength} turns) — Sonnet handles context better`;
        break;
      }

      if (level === 'beginner' && turn === 1) {
        model  = MODELS.HAIKU;
        reason = 'beginner opening question (turn 1) — simple, fast response preferred';
      } else if (level === 'beginner' && turn >= 2) {
        model  = MODELS.SONNET;
        reason = `beginner turn ${turn} — context-awareness required for follow-up`;
      } else if (level === 'intermediate') {
        model  = MODELS.SONNET;
        reason = 'intermediate level — standard conversational complexity';
      } else if (level === 'advanced') {
        model  = MODELS.SONNET;
        reason = 'advanced level — higher complexity, Sonnet handles well';
      } else {
        // Unrecognised level — safe default.
        model  = MODELS.SONNET;
        reason = `unrecognised level "${level}" — defaulting to Sonnet`;
      }
      break;
    }

    // ---- Unknown task type: safe default -----------------------------------
    default:
      model  = MODELS.SONNET;
      reason = `unknown task type "${taskType}" — defaulting to Sonnet`;
  }

  console.log(`[ModelRouter] Task: ${taskType} → Model: ${model} (reason: ${reason})`);
  return { model, reason };
}

// ============================================================================
// COST TRACKER
// ============================================================================

/**
 * Per-session cost accumulator.
 *
 * Instantiate once per user session (keyed by sessionId) and call .record()
 * after every successful Claude API response. Access .getSummary() to include
 * cost data in API responses or server-side logs.
 *
 * Token costs are calculated using the PRICING table at the top of this module.
 *
 * @example
 * const tracker = new CostTracker(sessionId);
 * const { cost } = tracker.record(model, response.usage.input_tokens, response.usage.output_tokens);
 * const summary  = tracker.getSummary();
 */
export class CostTracker {
  /**
   * @param {string} sessionId - Unique session identifier for logging context
   */
  constructor(sessionId) {
    this.sessionId        = sessionId;
    this.totalCost        = 0;
    this.totalInputTokens  = 0;
    this.totalOutputTokens = 0;
    this.callCount        = 0;

    /**
     * Per-model breakdown accumulated over the session lifetime.
     * @type {Record<string, { inputTokens: number, outputTokens: number, cost: number, calls: number }>}
     */
    this.modelBreakdown = {};
  }

  /**
   * Record a completed API call and accumulate cost.
   *
   * @param {string} model        - Model identifier (one of MODELS.*)
   * @param {number} inputTokens  - input_tokens from response.usage
   * @param {number} outputTokens - output_tokens from response.usage
   * @returns {{ cost: number, totalCost: number }} Cost for this call and running total
   */
  record(model, inputTokens, outputTokens) {
    const pricing = PRICING[model] || PRICING[MODELS.SONNET];

    // Convert per-1M rate to per-token, then multiply by actual token counts.
    const inputCost  = (inputTokens  / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    const callCost   = inputCost + outputCost;

    // Update session totals.
    this.totalCost         += callCost;
    this.totalInputTokens  += inputTokens;
    this.totalOutputTokens += outputTokens;
    this.callCount         += 1;

    // Update per-model breakdown.
    if (!this.modelBreakdown[model]) {
      this.modelBreakdown[model] = { inputTokens: 0, outputTokens: 0, cost: 0, calls: 0 };
    }
    this.modelBreakdown[model].inputTokens  += inputTokens;
    this.modelBreakdown[model].outputTokens += outputTokens;
    this.modelBreakdown[model].cost         += callCost;
    this.modelBreakdown[model].calls        += 1;

    return {
      cost:      callCost,
      totalCost: this.totalCost,
    };
  }

  /**
   * Return a complete summary of token usage and USD cost for the session.
   *
   * @returns {{
   *   sessionId: string,
   *   totalCost: number,
   *   totalInputTokens: number,
   *   totalOutputTokens: number,
   *   callCount: number,
   *   modelBreakdown: Record<string, { inputTokens: number, outputTokens: number, cost: number, calls: number }>
   * }}
   */
  getSummary() {
    return {
      sessionId:          this.sessionId,
      totalCost:          this.totalCost,
      totalInputTokens:   this.totalInputTokens,
      totalOutputTokens:  this.totalOutputTokens,
      callCount:          this.callCount,
      modelBreakdown:     { ...this.modelBreakdown },
    };
  }
}

// ============================================================================
// PROMPT CACHING SUPPORT
// ============================================================================

/**
 * Approximate token count for a string using a conservative 4 chars-per-token
 * heuristic. Sufficient for the cache-threshold decision; not used for billing.
 *
 * @param {string} text
 * @returns {number}
 */
function estimateTokenCount(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Build a messages array with Anthropic prompt-caching hints applied to the
 * system prompt when it exceeds the minimum cacheable size (1024 tokens).
 *
 * When the system prompt is long enough, this function returns it as a
 * structured content block with `cache_control: { type: 'ephemeral' }` so
 * the Anthropic API can cache it across repeated calls within the same
 * session — reducing both latency and input token costs.
 *
 * @param {string} systemPrompt - The full system prompt string
 * @param {Array<{ role: string, content: string }>} userMessages - Conversation messages
 * @returns {{
 *   system: string | Array<{ type: string, text: string, cache_control?: object }>,
 *   messages: Array<{ role: string, content: string }>,
 *   cacheApplied: boolean
 * }}
 */
export function buildCachedMessages(systemPrompt, userMessages) {
  const CACHE_MIN_TOKENS = 1024;
  const estimatedTokens  = estimateTokenCount(systemPrompt);
  const cacheApplied     = estimatedTokens >= CACHE_MIN_TOKENS;

  if (cacheApplied) {
    // Return system prompt as a structured block with cache_control hint.
    return {
      system: [
        {
          type:          'text',
          text:          systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages:     userMessages,
      cacheApplied: true,
    };
  }

  // System prompt is short enough that caching brings no benefit — pass as plain string.
  return {
    system:       systemPrompt,
    messages:     userMessages,
    cacheApplied: false,
  };
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

/**
 * Classify an Anthropic SDK error as transient (retryable) or terminal.
 *
 * Transient errors are infrastructure-level problems that often self-resolve:
 *  - APIConnectionError  — network timeout / socket drop
 *  - RateLimitError      — 429 from Anthropic — back off and retry
 *  - InternalServerError — 5xx from Anthropic — transient service issue
 *
 * Terminal errors indicate a programming or configuration mistake and
 * should never be retried because they will never self-resolve:
 *  - AuthenticationError — bad API key
 *  - BadRequestError     — malformed request payload
 *
 * @param {Error} error - An error thrown by the Anthropic SDK
 * @returns {boolean} true when the call should be retried
 */
function isRetryableError(error) {
  if (!error) return false;

  // Anthropic SDK attaches a `status` property to HTTP errors.
  const status = error.status;

  // 429 Rate Limit and 5xx Server Errors are transient.
  if (status === 429 || (status >= 500 && status <= 599)) return true;

  // Network-level errors (no HTTP status) are also transient.
  if (error instanceof Anthropic.APIConnectionError) return true;

  // Named error classes for belt-and-suspenders coverage.
  const transientNames = ['APIConnectionError', 'RateLimitError', 'InternalServerError'];
  if (transientNames.includes(error.constructor?.name))  return true;
  if (transientNames.some(name => error.name === name))  return true;

  return false;
}

/**
 * Wrap an async Anthropic API call with exponential-backoff retry logic.
 *
 * Behaviour:
 *  - Transient errors → retry up to maxRetries times with 2^attempt second delays
 *  - Terminal errors  → throw immediately (no retries wasted)
 *  - All attempts exhausted → throw the last error
 *
 * @param {() => Promise<any>} apiCall - Zero-argument async function that calls the Anthropic SDK
 * @param {object} [opts={}]
 * @param {number} [opts.maxRetries=3] - Maximum retry attempts after the initial try
 * @returns {Promise<any>} Resolves with the API response on success
 * @throws {Error} The last error encountered after all retries are exhausted,
 *   or the terminal error on first failure
 *
 * @example
 * const response = await callWithRetry(
 *   () => anthropic.messages.create({ model, max_tokens, messages }),
 *   { maxRetries: 3 }
 * );
 */
export async function callWithRetry(apiCall, { maxRetries = 3 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;

      // Terminal errors: fail immediately — retrying won't help.
      if (!isRetryableError(error)) {
        console.error(
          `[ModelRouter] Terminal error on attempt ${attempt + 1} — not retrying:`,
          error.message
        );
        throw error;
      }

      // Last attempt exhausted — stop the loop.
      if (attempt === maxRetries) {
        console.error(
          `[ModelRouter] All ${maxRetries + 1} attempts failed. Last error:`,
          error.message
        );
        break;
      }

      // Exponential backoff: 2^attempt seconds (1s, 2s, 4s).
      const delayMs = Math.pow(2, attempt) * 1000;
      console.warn(
        `[ModelRouter] Transient error on attempt ${attempt + 1}/${maxRetries + 1} — ` +
        `retrying in ${delayMs}ms. Error: ${error.message}`
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  MODELS,
  selectModel,
  CostTracker,
  buildCachedMessages,
  callWithRetry,
};
