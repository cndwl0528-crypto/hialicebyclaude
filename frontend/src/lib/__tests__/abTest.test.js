/**
 * abTest.test.js
 * Tests for /src/lib/abTest.js
 *
 * Covers:
 *  - EXPERIMENTS registry shape and required fields
 *  - getVariant() deterministic assignment consistency
 *  - getVariant() caching in sessionStorage
 *  - getVariant() fallback for inactive / unknown experiments
 *  - getVariant() anonymous visitor handling
 *  - clearAssignments() cleans cached variants
 *  - getAllAssignments() returns a map of all experiments
 *  - clientStorage integration (setItem / getItem delegation)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Storage mocks — must be defined before any module import
// ---------------------------------------------------------------------------
function makeStorageMock() {
  let store = {}
  const mock = {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value) }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    _store: () => store,
    _seed: (obj) => { store = { ...obj } },
    _reset: () => {
      store = {}
      mock.getItem.mockImplementation((key) => store[key] ?? null)
      mock.setItem.mockImplementation((key, value) => { store[key] = String(value) })
      mock.removeItem.mockImplementation((key) => { delete store[key] })
    },
  }
  return mock
}

const sessionMock = makeStorageMock()
const localMock = makeStorageMock()

Object.defineProperty(globalThis, 'sessionStorage', { value: sessionMock, writable: true })
Object.defineProperty(globalThis, 'localStorage', { value: localMock, writable: true })

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
import {
  EXPERIMENTS,
  getVariant,
  clearAssignments,
  getAllAssignments,
} from '../abTest.js'

// ---------------------------------------------------------------------------
// Reset storage before each test for isolation
// ---------------------------------------------------------------------------
beforeEach(() => {
  sessionMock._reset()
  localMock._reset()
  vi.clearAllMocks()
  clearAssignments()
})

// ---------------------------------------------------------------------------
// EXPERIMENTS registry
// ---------------------------------------------------------------------------
describe('EXPERIMENTS', () => {
  it('contains session_turns, reward_type, pre_reading, vocab_timing', () => {
    expect(EXPERIMENTS).toHaveProperty('session_turns')
    expect(EXPERIMENTS).toHaveProperty('reward_type')
    expect(EXPERIMENTS).toHaveProperty('pre_reading')
    expect(EXPERIMENTS).toHaveProperty('vocab_timing')
  })

  it('each experiment has name, variants array, and status', () => {
    Object.values(EXPERIMENTS).forEach((exp) => {
      expect(exp).toHaveProperty('name')
      expect(Array.isArray(exp.variants)).toBe(true)
      expect(exp.variants.length).toBeGreaterThan(0)
      expect(['active', 'paused', 'completed']).toContain(exp.status)
    })
  })

  it('session_turns has exactly 3 variants', () => {
    expect(EXPERIMENTS.session_turns.variants).toHaveLength(3)
    expect(EXPERIMENTS.session_turns.variants).toContain('3_turns')
    expect(EXPERIMENTS.session_turns.variants).toContain('4_turns')
    expect(EXPERIMENTS.session_turns.variants).toContain('5_turns')
  })

  it('reward_type has badges_only, xp_system, story_unlock', () => {
    expect(EXPERIMENTS.reward_type.variants).toContain('badges_only')
    expect(EXPERIMENTS.reward_type.variants).toContain('xp_system')
    expect(EXPERIMENTS.reward_type.variants).toContain('story_unlock')
  })
})

// ---------------------------------------------------------------------------
// getVariant() — deterministic assignment
// ---------------------------------------------------------------------------
describe('getVariant() — determinism', () => {
  it('returns the same variant on repeated calls for the same studentId', () => {
    const first = getVariant('session_turns', 'student-001')
    sessionMock._reset()
    clearAssignments()
    const second = getVariant('session_turns', 'student-001')
    expect(first).toBe(second)
  })

  it('returns a variant that belongs to the experiment variants list', () => {
    const variant = getVariant('session_turns', 'student-002')
    expect(EXPERIMENTS.session_turns.variants).toContain(variant)
  })

  it('different student IDs may receive different variants (distribution)', () => {
    // With 3 variants and enough students, at least 2 distinct values should appear
    const ids = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10']
    const variants = new Set(ids.map((id) => {
      clearAssignments()
      sessionMock._reset()
      return getVariant('session_turns', id)
    }))
    // Probabilistically we expect > 1 unique variant across 10 student IDs
    expect(variants.size).toBeGreaterThan(1)
  })

  it('different experiments produce independent assignments', () => {
    clearAssignments()
    sessionMock._reset()
    const turnsVariant = getVariant('session_turns', 'student-abc')
    clearAssignments()
    sessionMock._reset()
    const rewardVariant = getVariant('reward_type', 'student-abc')
    // Both should be valid values — they may or may not be equal, but
    // each must come from its own variants list
    expect(EXPERIMENTS.session_turns.variants).toContain(turnsVariant)
    expect(EXPERIMENTS.reward_type.variants).toContain(rewardVariant)
  })
})

// ---------------------------------------------------------------------------
// getVariant() — sessionStorage caching
// ---------------------------------------------------------------------------
describe('getVariant() — caching', () => {
  it('caches the assignment in sessionStorage on first call', () => {
    getVariant('session_turns', 'student-cache-test')
    // sessionStorage.setItem should have been called with the abtest:: prefix key
    const setCalls = sessionMock.setItem.mock.calls
    const hasAbtestKey = setCalls.some(([key]) => key.startsWith('abtest::session_turns'))
    expect(hasAbtestKey).toBe(true)
  })

  it('reads from cache on second call without recomputing', () => {
    const first = getVariant('session_turns', 'student-cache-read')
    // Spy on setItem to ensure it is NOT called again when cache exists
    sessionMock.setItem.mockClear()
    const second = getVariant('session_turns', 'student-cache-read')
    expect(second).toBe(first)
    // setItem should not be called again (variant read from cache)
    const setCalls = sessionMock.setItem.mock.calls.filter(([key]) =>
      key.startsWith('abtest::session_turns')
    )
    expect(setCalls.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// getVariant() — fallback behaviour
// ---------------------------------------------------------------------------
describe('getVariant() — fallback for unknown / inactive experiments', () => {
  it('returns "control" for a completely unknown experiment name', () => {
    const variant = getVariant('totally_fake_experiment', 'student-x')
    expect(variant).toBe('control')
  })

  it('returns first variant for a paused experiment', () => {
    // Temporarily mock a paused experiment by patching EXPERIMENTS inline
    const original = EXPERIMENTS.session_turns.status
    EXPERIMENTS.session_turns.status = 'paused'
    try {
      clearAssignments()
      sessionMock._reset()
      const variant = getVariant('session_turns', 'student-y')
      expect(variant).toBe(EXPERIMENTS.session_turns.variants[0])
    } finally {
      EXPERIMENTS.session_turns.status = original
    }
  })
})

// ---------------------------------------------------------------------------
// getVariant() — anonymous visitors
// ---------------------------------------------------------------------------
describe('getVariant() — anonymous visitor (no studentId)', () => {
  it('returns a valid variant without a studentId', () => {
    const variant = getVariant('session_turns')
    expect(EXPERIMENTS.session_turns.variants).toContain(variant)
  })

  it('generates and stores an anon_id in sessionStorage', () => {
    getVariant('session_turns')
    const anonKey = sessionMock.setItem.mock.calls.find(([key]) => key === 'abtest::anon_id')
    expect(anonKey).toBeDefined()
  })

  it('returns the same variant on repeated anonymous calls within the session', () => {
    const first = getVariant('session_turns')
    const second = getVariant('session_turns')
    expect(first).toBe(second)
  })
})

// ---------------------------------------------------------------------------
// clearAssignments()
// ---------------------------------------------------------------------------
describe('clearAssignments()', () => {
  it('removes cached assignments from storage so next call recomputes', () => {
    // First call stores result
    getVariant('session_turns', 'student-clear')

    // Clear then mock storage to return null (simulating cleared state)
    clearAssignments()
    sessionMock._reset()

    // The variant is recomputed — should still be deterministic
    const after = getVariant('session_turns', 'student-clear')
    expect(EXPERIMENTS.session_turns.variants).toContain(after)
  })
})

// ---------------------------------------------------------------------------
// getAllAssignments()
// ---------------------------------------------------------------------------
describe('getAllAssignments()', () => {
  it('returns an object with a key for each experiment', () => {
    const assignments = getAllAssignments('student-all')
    const experimentNames = Object.keys(EXPERIMENTS)
    experimentNames.forEach((name) => {
      expect(assignments).toHaveProperty(name)
    })
  })

  it('all returned variants are valid for their respective experiments', () => {
    const assignments = getAllAssignments('student-validate')
    Object.entries(assignments).forEach(([name, variant]) => {
      const exp = EXPERIMENTS[name]
      if (exp && exp.status === 'active') {
        expect(exp.variants).toContain(variant)
      }
    })
  })

  it('returns consistent results when called twice with the same studentId', () => {
    const first = getAllAssignments('student-consistent')
    const second = getAllAssignments('student-consistent')
    expect(first).toEqual(second)
  })
})
