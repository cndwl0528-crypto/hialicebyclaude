/**
 * constants.test.js
 * Tests for /src/lib/constants.js
 *
 * Covers:
 *  - COLORS object key existence and Ghibli palette values
 *  - LEVELS and STAGES shape
 *  - getLevelByAge() helper
 *  - getStagesInOrder() ordering
 *  - getNextStage() / isLastStage() helpers
 *  - isParentOrAdmin() with mocked sessionStorage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// clientStorage uses window.sessionStorage / localStorage — provide mocks
// before importing the module under test so that module-level code is safe.
const sessionStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value) }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    _store: () => store,
  }
})()

const localStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value) }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock, writable: true })
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

import {
  COLORS,
  LEVELS,
  STAGES,
  FEATURES,
  UI,
  SPEECH,
  SESSION,
  getLevelByAge,
  getStageById,
  getStagesInOrder,
  getNextStage,
  isLastStage,
  isParentOrAdmin,
} from '../constants.js'

// ---------------------------------------------------------------------------
// COLORS
// ---------------------------------------------------------------------------
describe('COLORS', () => {
  it('contains all required keys', () => {
    const requiredKeys = [
      'primary',
      'primaryLight',
      'primaryDark',
      'background',
      'backgroundAlt',
      'accent',
      'accentLight',
      'accentDark',
      'success',
      'successLight',
      'successDark',
      'danger',
      'dangerLight',
      'dangerDark',
      'textPrimary',
      'textSecondary',
      'border',
      'borderLight',
    ]
    requiredKeys.forEach((key) => {
      expect(COLORS).toHaveProperty(key)
    })
  })

  it('primary is the Ghibli forest green #5C8B5C', () => {
    expect(COLORS.primary).toBe('#5C8B5C')
  })

  it('background is the warm cream #F5F0E8', () => {
    expect(COLORS.background).toBe('#F5F0E8')
  })

  it('accent is the Ghibli gold #D4A843', () => {
    expect(COLORS.accent).toBe('#D4A843')
  })

  it('all color values are valid hex strings', () => {
    const hexPattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/
    Object.entries(COLORS).forEach(([key, value]) => {
      expect(value, `COLORS.${key} should be a valid hex color`).toMatch(hexPattern)
    })
  })
})

// ---------------------------------------------------------------------------
// LEVELS
// ---------------------------------------------------------------------------
describe('LEVELS', () => {
  it('has beginner, intermediate, advanced keys', () => {
    expect(LEVELS).toHaveProperty('beginner')
    expect(LEVELS).toHaveProperty('intermediate')
    expect(LEVELS).toHaveProperty('advanced')
  })

  it('each level has required shape', () => {
    Object.values(LEVELS).forEach((level) => {
      expect(level).toHaveProperty('id')
      expect(level).toHaveProperty('label')
      expect(level).toHaveProperty('ageMin')
      expect(level).toHaveProperty('ageMax')
      expect(level).toHaveProperty('color')
    })
  })

  it('age ranges do not overlap', () => {
    const sorted = Object.values(LEVELS).sort((a, b) => a.ageMin - b.ageMin)
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].ageMax).toBeLessThan(sorted[i + 1].ageMin)
    }
  })
})

// ---------------------------------------------------------------------------
// STAGES
// ---------------------------------------------------------------------------
describe('STAGES', () => {
  it('contains the six expected stage keys', () => {
    const expected = ['warm_connection', 'title', 'introduction', 'body', 'conclusion', 'cross_book']
    expected.forEach((key) => expect(STAGES).toHaveProperty(key))
  })

  it('each stage has id, label, order, and description', () => {
    Object.values(STAGES).forEach((stage) => {
      expect(stage).toHaveProperty('id')
      expect(stage).toHaveProperty('label')
      expect(typeof stage.order).toBe('number')
      expect(stage).toHaveProperty('description')
    })
  })

  it('stage orders are unique', () => {
    const orders = Object.values(STAGES).map((s) => s.order)
    const unique = new Set(orders)
    expect(unique.size).toBe(orders.length)
  })
})

// ---------------------------------------------------------------------------
// getLevelByAge()
// ---------------------------------------------------------------------------
describe('getLevelByAge()', () => {
  it('returns beginner for age 6', () => {
    expect(getLevelByAge(6)).toBe('beginner')
  })

  it('returns beginner for age 8', () => {
    expect(getLevelByAge(8)).toBe('beginner')
  })

  it('returns intermediate for age 9', () => {
    expect(getLevelByAge(9)).toBe('intermediate')
  })

  it('returns intermediate for age 11', () => {
    expect(getLevelByAge(11)).toBe('intermediate')
  })

  it('returns advanced for age 12', () => {
    expect(getLevelByAge(12)).toBe('advanced')
  })

  it('returns advanced for age 13', () => {
    expect(getLevelByAge(13)).toBe('advanced')
  })

  it('returns beginner as default for out-of-range age', () => {
    expect(getLevelByAge(3)).toBe('beginner')
    expect(getLevelByAge(99)).toBe('beginner')
  })
})

// ---------------------------------------------------------------------------
// getStageById()
// ---------------------------------------------------------------------------
describe('getStageById()', () => {
  it('returns the correct stage object for a valid id', () => {
    const stage = getStageById('title')
    expect(stage).toBeDefined()
    expect(stage.id).toBe('title')
  })

  it('returns undefined for an unknown stage id', () => {
    expect(getStageById('nonexistent')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// getStagesInOrder()
// ---------------------------------------------------------------------------
describe('getStagesInOrder()', () => {
  it('returns stages sorted by order ascending', () => {
    const stages = getStagesInOrder()
    for (let i = 0; i < stages.length - 1; i++) {
      expect(stages[i].order).toBeLessThan(stages[i + 1].order)
    }
  })

  it('first stage is warm_connection (order 1)', () => {
    const stages = getStagesInOrder()
    expect(stages[0].id).toBe('warm_connection')
  })

  it('last stage is cross_book (order 6)', () => {
    const stages = getStagesInOrder()
    expect(stages[stages.length - 1].id).toBe('cross_book')
  })
})

// ---------------------------------------------------------------------------
// getNextStage()
// ---------------------------------------------------------------------------
describe('getNextStage()', () => {
  it('returns the stage after warm_connection', () => {
    const next = getNextStage('warm_connection')
    expect(next).toBeDefined()
    expect(next.id).toBe('title')
  })

  it('returns null for the last stage (cross_book)', () => {
    expect(getNextStage('cross_book')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// isLastStage()
// ---------------------------------------------------------------------------
describe('isLastStage()', () => {
  it('returns true for cross_book', () => {
    expect(isLastStage('cross_book')).toBe(true)
  })

  it('returns false for title', () => {
    expect(isLastStage('title')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isParentOrAdmin()
// ---------------------------------------------------------------------------
describe('isParentOrAdmin()', () => {
  beforeEach(() => {
    sessionStorageMock.clear()
    localStorageMock.clear()
    sessionStorageMock.getItem.mockImplementation((key) => sessionStorageMock._store()[key] ?? null)
    localStorageMock.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true when userRole is parent', () => {
    sessionStorageMock.getItem.mockImplementation((key) =>
      key === 'userRole' ? 'parent' : null
    )
    expect(isParentOrAdmin()).toBe(true)
  })

  it('returns true when userRole is admin', () => {
    sessionStorageMock.getItem.mockImplementation((key) =>
      key === 'userRole' ? 'admin' : null
    )
    expect(isParentOrAdmin()).toBe(true)
  })

  it('returns true when userRole is super_admin', () => {
    sessionStorageMock.getItem.mockImplementation((key) =>
      key === 'userRole' ? 'super_admin' : null
    )
    expect(isParentOrAdmin()).toBe(true)
  })

  it('returns false when userRole is student', () => {
    sessionStorageMock.getItem.mockImplementation((key) =>
      key === 'userRole' ? 'student' : null
    )
    expect(isParentOrAdmin()).toBe(false)
  })

  it('returns false when userRole is not set', () => {
    sessionStorageMock.getItem.mockReturnValue(null)
    expect(isParentOrAdmin()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Misc constants shape
// ---------------------------------------------------------------------------
describe('FEATURES', () => {
  it('has enableVoiceInput and enableTextInput as booleans', () => {
    expect(typeof FEATURES.enableVoiceInput).toBe('boolean')
    expect(typeof FEATURES.enableTextInput).toBe('boolean')
  })
})

describe('UI', () => {
  it('touchTargetMinSize is at least 48px (WCAG AA)', () => {
    expect(FEATURES.enableVoiceInput).toBeDefined()
    expect(UI.touchTargetMinSize).toBeGreaterThanOrEqual(48)
  })
})

describe('SPEECH', () => {
  it('language is en-US', () => {
    expect(SPEECH.language).toBe('en-US')
  })
})

describe('SESSION', () => {
  it('maxTurnsPerStage is a positive number', () => {
    expect(SESSION.maxTurnsPerStage).toBeGreaterThan(0)
  })
})
