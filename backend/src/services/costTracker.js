/**
 * costTracker.js — Claude API usage and cost monitoring
 *
 * Tracks token consumption per session/student.
 * Stores metrics in-memory with periodic flush to logs.
 * When Supabase is connected, persists to ai_usage_log table.
 */

// Token pricing (Claude Sonnet 4 as of March 2026)
const PRICING = {
  'claude-sonnet-4':    { input: 3.0  / 1_000_000, output: 15.0 / 1_000_000 },
  'claude-haiku-4-5':   { input: 0.80 / 1_000_000, output: 4.0  / 1_000_000 },
};

// In-memory accumulator (resets on server restart)
let usageLog = [];
let totalTokens = { input: 0, output: 0 };
let totalCost = 0;
let sessionCount = 0;

/**
 * Record a single Claude API call's token usage.
 *
 * @param {object} params
 * @param {string} params.model         - Model identifier (e.g. 'claude-sonnet-4')
 * @param {number} params.inputTokens   - Tokens consumed from the prompt
 * @param {number} params.outputTokens  - Tokens produced in the completion
 * @param {string} [params.sessionId]   - Optional session UUID
 * @param {string} [params.studentId]   - Optional student UUID
 * @returns {{ cost: number, inputTokens: number, outputTokens: number }}
 */
export function trackUsage({ model, inputTokens, outputTokens, sessionId, studentId }) {
  const pricing = PRICING[model] || PRICING['claude-sonnet-4'];
  const cost = (inputTokens * pricing.input) + (outputTokens * pricing.output);

  totalTokens = {
    input:  totalTokens.input  + inputTokens,
    output: totalTokens.output + outputTokens,
  };
  totalCost    += cost;
  sessionCount += 1;

  const entry = {
    timestamp:    new Date().toISOString(),
    model,
    inputTokens,
    outputTokens,
    cost:         Math.round(cost * 10000) / 10000,
    sessionId:    sessionId  || null,
    studentId:    studentId  || null,
  };

  usageLog = [...usageLog, entry];

  // Keep only last 1000 entries in memory
  if (usageLog.length > 1000) {
    usageLog = usageLog.slice(-1000);
  }

  return { cost, inputTokens, outputTokens };
}

/**
 * Compute aggregate usage statistics for the lifetime of this server process.
 *
 * @returns {{
 *   total: { inputTokens: number, outputTokens: number, cost: number, sessions: number, avgCostPerSession: number },
 *   today: { cost: number, tokens: number, sessions: number },
 *   recentLog: Array<object>
 * }}
 */
export function getUsageStats() {
  const today = new Date().toISOString().split('T')[0];
  const todayEntries = usageLog.filter((e) => e.timestamp.startsWith(today));

  const todayCost   = todayEntries.reduce((sum, e) => sum + e.cost, 0);
  const todayTokens = todayEntries.reduce(
    (sum, e) => sum + e.inputTokens + e.outputTokens,
    0
  );

  const avgCostPerSession = sessionCount > 0 ? totalCost / sessionCount : 0;

  return {
    total: {
      inputTokens:       totalTokens.input,
      outputTokens:      totalTokens.output,
      cost:              Math.round(totalCost * 100) / 100,
      sessions:          sessionCount,
      avgCostPerSession: Math.round(avgCostPerSession * 10000) / 10000,
    },
    today: {
      cost:     Math.round(todayCost * 100) / 100,
      tokens:   todayTokens,
      sessions: todayEntries.length,
    },
    recentLog: usageLog.slice(-20),
  };
}

/**
 * Reset all in-memory usage state.
 * Intended for testing or manual admin resets only.
 */
export function resetUsageStats() {
  usageLog     = [];
  totalTokens  = { input: 0, output: 0 };
  totalCost    = 0;
  sessionCount = 0;
}
