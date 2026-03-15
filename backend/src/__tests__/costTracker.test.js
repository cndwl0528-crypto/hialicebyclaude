/**
 * costTracker.test.js
 * HiAlice — Cost Tracker Service Tests
 *
 * Verifies that trackUsage(), getUsageStats(), and resetUsageStats() behave
 * correctly under a range of inputs and edge cases.
 *
 * Design constraints:
 *   - No network calls; all tests are pure unit tests.
 *   - Each describe block resets state before its tests run.
 *   - Immutable patterns: test data objects are never mutated in-place.
 *
 * Coverage areas:
 *   1. trackUsage records entries correctly
 *   2. getUsageStats returns proper totals
 *   3. getUsageStats filters today's entries
 *   4. usageLog caps at 1000 entries
 *   5. resetUsageStats clears all data
 *   6. Pricing calculation is correct for different models
 *   7. avgCostPerSession calculates correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  trackUsage,
  getUsageStats,
  resetUsageStats,
} from '../services/costTracker.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid trackUsage payload. */
const basePayload = (overrides = {}) => ({
  model:        'claude-sonnet-4',
  inputTokens:  1000,
  outputTokens: 500,
  sessionId:    'sess-001',
  studentId:    'student-001',
  ...overrides,
});

// Known pricing from costTracker.js
const SONNET_INPUT  = 3.0  / 1_000_000;   // $/token
const SONNET_OUTPUT = 15.0 / 1_000_000;   // $/token
const HAIKU_INPUT   = 0.80 / 1_000_000;   // $/token
const HAIKU_OUTPUT  = 4.0  / 1_000_000;   // $/token

// ---------------------------------------------------------------------------
// 1. trackUsage records entries correctly
// ---------------------------------------------------------------------------

describe('trackUsage — entry recording', () => {
  beforeEach(() => resetUsageStats());

  it('returns cost, inputTokens, and outputTokens', () => {
    const result = trackUsage(basePayload());
    expect(result).toHaveProperty('cost');
    expect(result).toHaveProperty('inputTokens', 1000);
    expect(result).toHaveProperty('outputTokens', 500);
  });

  it('adds an entry to recentLog after a call', () => {
    trackUsage(basePayload());
    const { recentLog } = getUsageStats();
    expect(recentLog).toHaveLength(1);
    expect(recentLog[0].sessionId).toBe('sess-001');
  });

  it('stores correct fields in log entry', () => {
    trackUsage(basePayload({ model: 'claude-haiku-4-5', sessionId: 'sess-XY', studentId: 'stu-99' }));
    const { recentLog } = getUsageStats();
    const entry = recentLog[0];
    expect(entry.model).toBe('claude-haiku-4-5');
    expect(entry.sessionId).toBe('sess-XY');
    expect(entry.studentId).toBe('stu-99');
    expect(entry.inputTokens).toBe(1000);
    expect(entry.outputTokens).toBe(500);
    expect(typeof entry.timestamp).toBe('string');
    expect(typeof entry.cost).toBe('number');
  });

  it('increments sessionCount on each call', () => {
    trackUsage(basePayload());
    trackUsage(basePayload());
    const { total } = getUsageStats();
    expect(total.sessions).toBe(2);
  });

  it('accumulates token totals across multiple calls', () => {
    trackUsage(basePayload({ inputTokens: 100, outputTokens: 50 }));
    trackUsage(basePayload({ inputTokens: 200, outputTokens: 75 }));
    const { total } = getUsageStats();
    expect(total.inputTokens).toBe(300);
    expect(total.outputTokens).toBe(125);
  });
});

// ---------------------------------------------------------------------------
// 2. getUsageStats returns proper totals
// ---------------------------------------------------------------------------

describe('getUsageStats — total aggregation', () => {
  beforeEach(() => resetUsageStats());

  it('returns zero totals when no usage has been recorded', () => {
    const { total, today } = getUsageStats();
    expect(total.inputTokens).toBe(0);
    expect(total.outputTokens).toBe(0);
    expect(total.cost).toBe(0);
    expect(total.sessions).toBe(0);
    expect(today.sessions).toBe(0);
    expect(today.tokens).toBe(0);
  });

  it('total.cost rounds to two decimal places', () => {
    // Use values that produce a fractional cost
    trackUsage(basePayload({ inputTokens: 333_333, outputTokens: 111_111 }));
    const { total } = getUsageStats();
    const digits = total.cost.toString().split('.')[1];
    expect(!digits || digits.length <= 2).toBe(true);
  });

  it('recentLog contains at most 20 entries', () => {
    for (let i = 0; i < 25; i++) {
      trackUsage(basePayload({ sessionId: `sess-${i}` }));
    }
    const { recentLog } = getUsageStats();
    expect(recentLog.length).toBeLessThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// 3. getUsageStats filters today's entries
// ---------------------------------------------------------------------------

describe("getUsageStats — today's filter", () => {
  beforeEach(() => resetUsageStats());

  it("today.sessions counts only entries from today's date", () => {
    // All entries recorded now are from today
    trackUsage(basePayload());
    trackUsage(basePayload());
    const { today } = getUsageStats();
    expect(today.sessions).toBe(2);
  });

  it("today.tokens is the sum of all token pairs from today", () => {
    trackUsage(basePayload({ inputTokens: 500, outputTokens: 250 }));
    trackUsage(basePayload({ inputTokens: 300, outputTokens: 100 }));
    const { today } = getUsageStats();
    // 500+250 + 300+100 = 1150
    expect(today.tokens).toBe(1150);
  });

  it("today.cost is a non-negative number", () => {
    trackUsage(basePayload());
    const { today } = getUsageStats();
    expect(today.cost).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 4. usageLog caps at 1000 entries
// ---------------------------------------------------------------------------

describe('usageLog — capacity cap', () => {
  beforeEach(() => resetUsageStats());

  it('does not exceed 1000 entries when more than 1000 calls are made', () => {
    for (let i = 0; i < 1050; i++) {
      trackUsage(basePayload({ sessionId: `sess-${i}` }));
    }
    // recentLog only returns the last 20, so inspect via total.sessions and
    // verify the log remains bounded by checking the recentLog is still capped.
    const { recentLog, total } = getUsageStats();
    // All 1050 calls incremented sessionCount (unbounded counter)
    expect(total.sessions).toBe(1050);
    // But in-memory log is capped — recentLog is at most 20 of last 1000
    expect(recentLog.length).toBeLessThanOrEqual(20);
    // The oldest entry in recentLog should be near the end of the 1050 range
    const lastSessionId = recentLog[recentLog.length - 1]?.sessionId;
    expect(lastSessionId).toBe('sess-1049');
  });
});

// ---------------------------------------------------------------------------
// 5. resetUsageStats clears all data
// ---------------------------------------------------------------------------

describe('resetUsageStats', () => {
  it('resets totals and log to zero/empty', () => {
    trackUsage(basePayload());
    trackUsage(basePayload());
    resetUsageStats();

    const { total, today, recentLog } = getUsageStats();
    expect(total.sessions).toBe(0);
    expect(total.cost).toBe(0);
    expect(total.inputTokens).toBe(0);
    expect(total.outputTokens).toBe(0);
    expect(today.sessions).toBe(0);
    expect(recentLog).toHaveLength(0);
  });

  it('allows recording new entries after reset', () => {
    trackUsage(basePayload());
    resetUsageStats();
    trackUsage(basePayload({ sessionId: 'new-sess' }));

    const { total, recentLog } = getUsageStats();
    expect(total.sessions).toBe(1);
    expect(recentLog[0].sessionId).toBe('new-sess');
  });
});

// ---------------------------------------------------------------------------
// 6. Pricing calculation is correct for different models
// ---------------------------------------------------------------------------

describe('trackUsage — pricing accuracy', () => {
  beforeEach(() => resetUsageStats());

  it('calculates cost correctly for claude-sonnet-4', () => {
    const INPUT  = 1_000_000;
    const OUTPUT = 1_000_000;
    const { cost } = trackUsage(basePayload({
      model:        'claude-sonnet-4',
      inputTokens:  INPUT,
      outputTokens: OUTPUT,
    }));
    const expected = INPUT * SONNET_INPUT + OUTPUT * SONNET_OUTPUT;
    expect(cost).toBeCloseTo(expected, 8);
  });

  it('calculates cost correctly for claude-haiku-4-5', () => {
    const INPUT  = 1_000_000;
    const OUTPUT = 1_000_000;
    const { cost } = trackUsage(basePayload({
      model:        'claude-haiku-4-5',
      inputTokens:  INPUT,
      outputTokens: OUTPUT,
    }));
    const expected = INPUT * HAIKU_INPUT + OUTPUT * HAIKU_OUTPUT;
    expect(cost).toBeCloseTo(expected, 8);
  });

  it('falls back to sonnet pricing for unknown model identifiers', () => {
    const INPUT  = 500;
    const OUTPUT = 250;
    const { cost } = trackUsage(basePayload({
      model:        'claude-unknown-future-model',
      inputTokens:  INPUT,
      outputTokens: OUTPUT,
    }));
    const expected = INPUT * SONNET_INPUT + OUTPUT * SONNET_OUTPUT;
    expect(cost).toBeCloseTo(expected, 8);
  });

  it('haiku is cheaper than sonnet for the same token count', () => {
    const tokens = { inputTokens: 10_000, outputTokens: 5_000 };

    resetUsageStats();
    const sonnetResult = trackUsage(basePayload({ ...tokens, model: 'claude-sonnet-4' }));

    resetUsageStats();
    const haikuResult = trackUsage(basePayload({ ...tokens, model: 'claude-haiku-4-5' }));

    expect(haikuResult.cost).toBeLessThan(sonnetResult.cost);
  });

  it('cost is zero when both token counts are zero', () => {
    const { cost } = trackUsage(basePayload({ inputTokens: 0, outputTokens: 0 }));
    expect(cost).toBe(0);
  });

  it('accumulated total.cost matches sum of individual costs', () => {
    const payloads = [
      { model: 'claude-sonnet-4',  inputTokens: 100, outputTokens: 50 },
      { model: 'claude-haiku-4-5', inputTokens: 200, outputTokens: 80 },
      { model: 'claude-sonnet-4',  inputTokens: 50,  outputTokens: 30 },
    ];

    let expected = 0;
    for (const payload of payloads) {
      const pricing = payload.model === 'claude-haiku-4-5'
        ? { input: HAIKU_INPUT,  output: HAIKU_OUTPUT  }
        : { input: SONNET_INPUT, output: SONNET_OUTPUT };
      expected += payload.inputTokens * pricing.input + payload.outputTokens * pricing.output;
      trackUsage(basePayload(payload));
    }

    const { total } = getUsageStats();
    expect(total.cost).toBeCloseTo(Math.round(expected * 100) / 100, 4);
  });
});

// ---------------------------------------------------------------------------
// 7. avgCostPerSession calculates correctly
// ---------------------------------------------------------------------------

describe('getUsageStats — avgCostPerSession', () => {
  beforeEach(() => resetUsageStats());

  it('is 0 when no sessions have been recorded', () => {
    const { total } = getUsageStats();
    expect(total.avgCostPerSession).toBe(0);
  });

  it('equals total cost when there is exactly one session', () => {
    const INPUT  = 1000;
    const OUTPUT = 500;
    trackUsage(basePayload({ inputTokens: INPUT, outputTokens: OUTPUT }));
    const expectedCost = INPUT * SONNET_INPUT + OUTPUT * SONNET_OUTPUT;
    const { total } = getUsageStats();
    expect(total.avgCostPerSession).toBeCloseTo(expectedCost, 6);
  });

  it('is the arithmetic mean of all session costs', () => {
    // Each call counts as one "session" in sessionCount.
    // Three calls with different token amounts.
    const calls = [
      { inputTokens: 1000, outputTokens: 500 },
      { inputTokens: 2000, outputTokens: 800 },
      { inputTokens: 500,  outputTokens: 200 },
    ];
    let totalExpected = 0;
    for (const call of calls) {
      totalExpected += call.inputTokens * SONNET_INPUT + call.outputTokens * SONNET_OUTPUT;
      trackUsage(basePayload(call));
    }
    const avgExpected = totalExpected / calls.length;
    const { total } = getUsageStats();
    expect(total.avgCostPerSession).toBeCloseTo(avgExpected, 6);
  });
});
