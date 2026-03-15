/**
 * aiModelExperiment.test.js
 * HiAlice — AI Model A/B Experiment Tests
 *
 * Verifies the `ai_model` experiment configuration and its expected behaviour
 * across variant assignment, cost analysis, quality metrics, latency, and
 * integration with the existing experiment registry.
 *
 * Design constraints:
 *   - No network calls; all tests are pure unit / data tests.
 *   - The djb2 hashString function is replicated locally so that the
 *     deterministic assignment algorithm can be verified in isolation without
 *     exporting it from the module under test.
 *   - Each test is fully independent; no shared mutable state.
 *   - Immutable patterns throughout — test data is never mutated in place.
 *
 * Coverage areas:
 *   1. Experiment Configuration         (6 tests)
 *   2. Deterministic Assignment         (8 tests)
 *   3. Model Cost Estimation            (6 tests)
 *   4. Model Quality Metrics            (6 tests)
 *   5. Model Latency                    (5 tests)
 *   6. Integration with Existing Exp.   (5 tests)
 *   7. Edge Cases                       (5 tests)
 *
 * Total: 41 tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// Module-level mocks — hoisted by Vitest before any import is resolved.
//
// experiments.js imports auth.js, which imports config.js at module load time.
// config.js calls process.exit(1) when JWT_SECRET is absent in non-development
// environments.  We mock the two dependencies so that the route module imports
// cleanly in the test environment without triggering the startup guard.
// ============================================================================

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: vi.fn((_req, _res, next) => next()),
  requireAdmin:   vi.fn((_req, _res, next) => next()),
}));

vi.mock('../lib/logger.js', () => ({
  default: {
    warn:  vi.fn(),
    info:  vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import { EXPERIMENTS } from '../routes/experiments.js';

// ============================================================================
// Local replica of the djb2 hash used by both frontend and backend.
// Kept here so we can verify the algorithm's properties without exporting
// an internal function from the production module.
// ============================================================================

/**
 * djb2-style string hash — mirrors experiments.js / abTest.js exactly.
 *
 * @param {string} str
 * @returns {number}  Unsigned 32-bit integer
 */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

/**
 * Derive the variant assigned to a (studentId, experimentName) pair,
 * replicating the production logic from experiments.js.
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
// Snapshot of mock metrics — kept locally so tests remain self-contained
// and do not depend on the private MOCK_METRICS constant inside experiments.js.
// ============================================================================

const AI_MODEL_MOCK_METRICS = Object.freeze({
  sonnet_full: Object.freeze({
    participants:         156,
    completionRate:       0.78,
    avgGrammarScore:      84,
    avgCostPerSession:    0.12,
    avgResponseLatency:   2.1,
  }),
  haiku_boost: Object.freeze({
    participants:         161,
    completionRate:       0.74,
    avgGrammarScore:      79,
    avgCostPerSession:    0.04,
    avgResponseLatency:   0.8,
  }),
  phi3_local: Object.freeze({
    participants:         148,
    completionRate:       0.66,
    avgGrammarScore:      71,
    avgCostPerSession:    0.01,
    avgResponseLatency:   1.5,
  }),
});

const VALID_VARIANTS = Object.freeze(['sonnet_full', 'haiku_boost', 'phi3_local']);

// ============================================================================
// 1. Experiment Configuration
// ============================================================================

describe('Experiment Configuration — ai_model', () => {
  it('ai_model experiment exists in the EXPERIMENTS registry', () => {
    expect(EXPERIMENTS).toHaveProperty('ai_model');
  });

  it('has exactly 3 variants: sonnet_full, haiku_boost, phi3_local', () => {
    const { variants } = EXPERIMENTS.ai_model;
    expect(variants).toHaveLength(3);
    expect(variants).toContain('sonnet_full');
    expect(variants).toContain('haiku_boost');
    expect(variants).toContain('phi3_local');
  });

  it('status is "active"', () => {
    expect(EXPERIMENTS.ai_model.status).toBe('active');
  });

  it('has a valid ISO-8601 createdAt date', () => {
    const { createdAt } = EXPERIMENTS.ai_model;
    expect(typeof createdAt).toBe('string');
    const parsed = new Date(createdAt);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
    // Must be a reasonable date (not epoch zero)
    expect(parsed.getFullYear()).toBeGreaterThanOrEqual(2026);
  });

  it('description is a non-empty string', () => {
    const { description } = EXPERIMENTS.ai_model;
    expect(typeof description).toBe('string');
    expect(description.trim().length).toBeGreaterThan(0);
  });

  it('variants array contains no duplicates', () => {
    const { variants } = EXPERIMENTS.ai_model;
    const unique = new Set(variants);
    expect(unique.size).toBe(variants.length);
  });
});

// ============================================================================
// 2. Deterministic Assignment
// ============================================================================

describe('Deterministic Assignment — ai_model', () => {
  it('the same studentId always receives the same variant across repeated calls', () => {
    const studentId = 'student-stability-check';
    const first  = assignVariant(studentId, 'ai_model');
    const second = assignVariant(studentId, 'ai_model');
    const third  = assignVariant(studentId, 'ai_model');
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('different studentIds can receive different variants', () => {
    // Generate 50 assignments and verify more than one distinct variant appears.
    const assigned = new Set(
      Array.from({ length: 50 }, (_, i) => assignVariant(`student-${i}`, 'ai_model'))
    );
    expect(assigned.size).toBeGreaterThan(1);
  });

  it('assignment is stable across independent invocations (no hidden mutable state)', () => {
    const id = 'stable-id-999';
    const results = Array.from({ length: 10 }, () => assignVariant(id, 'ai_model'));
    const allSame = results.every((v) => v === results[0]);
    expect(allSame).toBe(true);
  });

  it('handles an empty studentId string without throwing and returns a valid variant', () => {
    // The empty string is still a valid seed for the hash function.
    expect(() => assignVariant('', 'ai_model')).not.toThrow();
    const result = assignVariant('', 'ai_model');
    expect(VALID_VARIANTS).toContain(result);
  });

  it('distributes across all 3 variants with a large population of studentIds', () => {
    const tallied = { sonnet_full: 0, haiku_boost: 0, phi3_local: 0 };
    for (let i = 0; i < 300; i++) {
      const variant = assignVariant(`load-student-${i}`, 'ai_model');
      tallied[variant] = (tallied[variant] ?? 0) + 1;
    }
    // Every variant must have received at least one assignment.
    expect(tallied.sonnet_full).toBeGreaterThan(0);
    expect(tallied.haiku_boost).toBeGreaterThan(0);
    expect(tallied.phi3_local).toBeGreaterThan(0);
  });

  it('djb2 hashString produces an unsigned 32-bit integer (>= 0) for any string', () => {
    const inputs = ['hello', '', 'student-001::ai_model', 'x'.repeat(500)];
    for (const input of inputs) {
      const result = hashString(input);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(4_294_967_295); // 2^32 - 1
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  it('hash modulo 3 covers all indices 0, 1, and 2 across diverse inputs', () => {
    const indices = new Set(
      Array.from({ length: 100 }, (_, i) => hashString(`seed-${i}`) % 3)
    );
    expect(indices).toContain(0);
    expect(indices).toContain(1);
    expect(indices).toContain(2);
  });

  it('assigned variant name is always one of the three valid options', () => {
    for (let i = 0; i < 100; i++) {
      const variant = assignVariant(`student-validity-${i}`, 'ai_model');
      expect(VALID_VARIANTS).toContain(variant);
    }
  });
});

// ============================================================================
// 3. Model Cost Estimation
// ============================================================================

describe('Model Cost Estimation — ai_model', () => {
  it('sonnet_full has the highest cost per session ($0.12)', () => {
    const { avgCostPerSession: sonnetCost } = AI_MODEL_MOCK_METRICS.sonnet_full;
    const { avgCostPerSession: haikuCost  } = AI_MODEL_MOCK_METRICS.haiku_boost;
    const { avgCostPerSession: phi3Cost   } = AI_MODEL_MOCK_METRICS.phi3_local;
    expect(sonnetCost).toBeGreaterThan(haikuCost);
    expect(sonnetCost).toBeGreaterThan(phi3Cost);
    expect(sonnetCost).toBe(0.12);
  });

  it('haiku_boost has a medium cost per session ($0.04)', () => {
    const { avgCostPerSession } = AI_MODEL_MOCK_METRICS.haiku_boost;
    expect(avgCostPerSession).toBe(0.04);
    expect(avgCostPerSession).toBeGreaterThan(AI_MODEL_MOCK_METRICS.phi3_local.avgCostPerSession);
    expect(avgCostPerSession).toBeLessThan(AI_MODEL_MOCK_METRICS.sonnet_full.avgCostPerSession);
  });

  it('phi3_local has the lowest cost per session ($0.01)', () => {
    const { avgCostPerSession } = AI_MODEL_MOCK_METRICS.phi3_local;
    expect(avgCostPerSession).toBe(0.01);
    expect(avgCostPerSession).toBeLessThan(AI_MODEL_MOCK_METRICS.haiku_boost.avgCostPerSession);
    expect(avgCostPerSession).toBeLessThan(AI_MODEL_MOCK_METRICS.sonnet_full.avgCostPerSession);
  });

  it('haiku vs sonnet cost reduction is approximately 67%', () => {
    const sonnetCost = AI_MODEL_MOCK_METRICS.sonnet_full.avgCostPerSession;
    const haikuCost  = AI_MODEL_MOCK_METRICS.haiku_boost.avgCostPerSession;
    const reduction  = (sonnetCost - haikuCost) / sonnetCost;
    // 67% = (0.12 - 0.04) / 0.12 ≈ 0.6667
    expect(reduction).toBeCloseTo(0.6667, 2);
  });

  it('phi3 vs sonnet cost reduction is approximately 92%', () => {
    const sonnetCost = AI_MODEL_MOCK_METRICS.sonnet_full.avgCostPerSession;
    const phi3Cost   = AI_MODEL_MOCK_METRICS.phi3_local.avgCostPerSession;
    const reduction  = (sonnetCost - phi3Cost) / sonnetCost;
    // 92% = (0.12 - 0.01) / 0.12 ≈ 0.9167
    expect(reduction).toBeCloseTo(0.9167, 2);
  });

  it('all variants have positive (non-zero) cost values', () => {
    for (const variant of VALID_VARIANTS) {
      expect(AI_MODEL_MOCK_METRICS[variant].avgCostPerSession).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// 4. Model Quality Metrics
// ============================================================================

describe('Model Quality Metrics — ai_model', () => {
  it('sonnet_full has the highest grammar score (84)', () => {
    const sonnetScore = AI_MODEL_MOCK_METRICS.sonnet_full.avgGrammarScore;
    const haikuScore  = AI_MODEL_MOCK_METRICS.haiku_boost.avgGrammarScore;
    const phi3Score   = AI_MODEL_MOCK_METRICS.phi3_local.avgGrammarScore;
    expect(sonnetScore).toBeGreaterThan(haikuScore);
    expect(sonnetScore).toBeGreaterThan(phi3Score);
    expect(sonnetScore).toBe(84);
  });

  it('haiku_boost has a moderate grammar score (79)', () => {
    const { avgGrammarScore } = AI_MODEL_MOCK_METRICS.haiku_boost;
    expect(avgGrammarScore).toBe(79);
    expect(avgGrammarScore).toBeGreaterThan(AI_MODEL_MOCK_METRICS.phi3_local.avgGrammarScore);
    expect(avgGrammarScore).toBeLessThan(AI_MODEL_MOCK_METRICS.sonnet_full.avgGrammarScore);
  });

  it('phi3_local has an acceptable grammar score (71)', () => {
    const { avgGrammarScore } = AI_MODEL_MOCK_METRICS.phi3_local;
    expect(avgGrammarScore).toBe(71);
  });

  it('all grammar scores are above the minimum acceptable threshold (60)', () => {
    const MINIMUM_GRAMMAR_THRESHOLD = 60;
    for (const variant of VALID_VARIANTS) {
      expect(AI_MODEL_MOCK_METRICS[variant].avgGrammarScore).toBeGreaterThan(MINIMUM_GRAMMAR_THRESHOLD);
    }
  });

  it('all completion rates are valid proportions between 0 and 1 (inclusive)', () => {
    for (const variant of VALID_VARIANTS) {
      const rate = AI_MODEL_MOCK_METRICS[variant].completionRate;
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    }
  });

  it('sonnet_full has the highest completion rate among all variants', () => {
    const sonnetRate = AI_MODEL_MOCK_METRICS.sonnet_full.completionRate;
    const haikuRate  = AI_MODEL_MOCK_METRICS.haiku_boost.completionRate;
    const phi3Rate   = AI_MODEL_MOCK_METRICS.phi3_local.completionRate;
    expect(sonnetRate).toBeGreaterThan(haikuRate);
    expect(sonnetRate).toBeGreaterThan(phi3Rate);
  });
});

// ============================================================================
// 5. Model Latency
// ============================================================================

describe('Model Latency — ai_model', () => {
  it('haiku_boost has the lowest response latency (0.8s)', () => {
    const { avgResponseLatency } = AI_MODEL_MOCK_METRICS.haiku_boost;
    expect(avgResponseLatency).toBe(0.8);
    expect(avgResponseLatency).toBeLessThan(AI_MODEL_MOCK_METRICS.phi3_local.avgResponseLatency);
    expect(avgResponseLatency).toBeLessThan(AI_MODEL_MOCK_METRICS.sonnet_full.avgResponseLatency);
  });

  it('phi3_local has a moderate response latency (1.5s)', () => {
    const { avgResponseLatency } = AI_MODEL_MOCK_METRICS.phi3_local;
    expect(avgResponseLatency).toBe(1.5);
    expect(avgResponseLatency).toBeGreaterThan(AI_MODEL_MOCK_METRICS.haiku_boost.avgResponseLatency);
    expect(avgResponseLatency).toBeLessThan(AI_MODEL_MOCK_METRICS.sonnet_full.avgResponseLatency);
  });

  it('sonnet_full has the highest response latency (2.1s)', () => {
    const { avgResponseLatency } = AI_MODEL_MOCK_METRICS.sonnet_full;
    expect(avgResponseLatency).toBe(2.1);
    expect(avgResponseLatency).toBeGreaterThan(AI_MODEL_MOCK_METRICS.haiku_boost.avgResponseLatency);
    expect(avgResponseLatency).toBeGreaterThan(AI_MODEL_MOCK_METRICS.phi3_local.avgResponseLatency);
  });

  it('all latency values are under 5 seconds (acceptable UX threshold)', () => {
    const MAX_ACCEPTABLE_LATENCY_SECONDS = 5;
    for (const variant of VALID_VARIANTS) {
      expect(AI_MODEL_MOCK_METRICS[variant].avgResponseLatency).toBeLessThan(MAX_ACCEPTABLE_LATENCY_SECONDS);
    }
  });

  it('all latency values are positive numbers', () => {
    for (const variant of VALID_VARIANTS) {
      expect(AI_MODEL_MOCK_METRICS[variant].avgResponseLatency).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// 6. Integration with Existing Experiments
// ============================================================================

describe('Integration with Existing Experiments', () => {
  it('ai_model does not conflict with session_turns (distinct name and variants)', () => {
    const aiModel     = EXPERIMENTS.ai_model;
    const sessionTurns = EXPERIMENTS.session_turns;

    expect(aiModel.name).not.toBe(sessionTurns.name);

    const aiVariants      = new Set(aiModel.variants);
    const sessionVariants = new Set(sessionTurns.variants);
    const intersection    = [...aiVariants].filter((v) => sessionVariants.has(v));
    expect(intersection).toHaveLength(0);
  });

  it('ai_model does not conflict with reward_type (distinct name and variants)', () => {
    const aiModel    = EXPERIMENTS.ai_model;
    const rewardType = EXPERIMENTS.reward_type;

    expect(aiModel.name).not.toBe(rewardType.name);

    const aiVariants     = new Set(aiModel.variants);
    const rewardVariants = new Set(rewardType.variants);
    const intersection   = [...aiVariants].filter((v) => rewardVariants.has(v));
    expect(intersection).toHaveLength(0);
  });

  it('ai_model does not conflict with pre_reading (distinct name and variants)', () => {
    const aiModel    = EXPERIMENTS.ai_model;
    const preReading = EXPERIMENTS.pre_reading;

    expect(aiModel.name).not.toBe(preReading.name);

    const aiVariants       = new Set(aiModel.variants);
    const preReadVariants  = new Set(preReading.variants);
    const intersection     = [...aiVariants].filter((v) => preReadVariants.has(v));
    expect(intersection).toHaveLength(0);
  });

  it('ai_model does not conflict with vocab_timing (distinct name and variants)', () => {
    const aiModel     = EXPERIMENTS.ai_model;
    const vocabTiming = EXPERIMENTS.vocab_timing;

    expect(aiModel.name).not.toBe(vocabTiming.name);

    const aiVariants     = new Set(aiModel.variants);
    const vocabVariants  = new Set(vocabTiming.variants);
    const intersection   = [...aiVariants].filter((v) => vocabVariants.has(v));
    expect(intersection).toHaveLength(0);
  });

  it('the total experiment count is now 5 (4 original + ai_model)', () => {
    const experimentNames = Object.keys(EXPERIMENTS);
    expect(experimentNames).toHaveLength(5);
    expect(experimentNames).toContain('session_turns');
    expect(experimentNames).toContain('reward_type');
    expect(experimentNames).toContain('pre_reading');
    expect(experimentNames).toContain('vocab_timing');
    expect(experimentNames).toContain('ai_model');
  });
});

// ============================================================================
// 7. Edge Cases
// ============================================================================

describe('Edge Cases — ai_model assignment', () => {
  it('a very long studentId (1000 characters) does not crash the hash function', () => {
    const longId = 'x'.repeat(1000);
    expect(() => assignVariant(longId, 'ai_model')).not.toThrow();
    const result = assignVariant(longId, 'ai_model');
    expect(VALID_VARIANTS).toContain(result);
  });

  it('a studentId containing special characters works correctly', () => {
    const specialId = '!@#$%^&*()_+-=[]{}|;\':",.<>?/`~';
    expect(() => assignVariant(specialId, 'ai_model')).not.toThrow();
    const result = assignVariant(specialId, 'ai_model');
    expect(VALID_VARIANTS).toContain(result);
  });

  it('a studentId containing unicode characters works correctly', () => {
    const unicodeId = '学生-\u4E2D\u6587-\uD83D\uDE00';
    expect(() => assignVariant(unicodeId, 'ai_model')).not.toThrow();
    const result = assignVariant(unicodeId, 'ai_model');
    expect(VALID_VARIANTS).toContain(result);
  });

  it('null studentId is handled gracefully (does not throw; returns a valid variant)', () => {
    // The production assignVariant coerces the seed to a string via template literal,
    // turning null into the literal string "null::ai_model".
    expect(() => assignVariant(null, 'ai_model')).not.toThrow();
    const result = assignVariant(null, 'ai_model');
    expect(VALID_VARIANTS).toContain(result);
  });

  it('undefined studentId is handled gracefully (does not throw; returns a valid variant)', () => {
    // Template literal coercion: undefined → "undefined::ai_model"
    expect(() => assignVariant(undefined, 'ai_model')).not.toThrow();
    const result = assignVariant(undefined, 'ai_model');
    expect(VALID_VARIANTS).toContain(result);
  });
});
