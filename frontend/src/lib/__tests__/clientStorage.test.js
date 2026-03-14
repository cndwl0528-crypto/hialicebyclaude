/**
 * clientStorage.test.js
 * Tests for /src/lib/clientStorage.js
 *
 * Covers:
 *  - getItem() — sessionStorage-first fallback to localStorage
 *  - setItem() — writes to sessionStorage; mirrors to localStorage for persisted keys
 *  - removeItem() — removes from both storages
 *  - hydrateSessionFromLocal() — copies localStorage values into sessionStorage
 *  - clearPersistedSession() — clears sessionStorage and persisted localStorage keys
 *  - PERSISTED_KEYS list presence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Storage mock factory
// ---------------------------------------------------------------------------
function makeStorageMock() {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value) }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    _store: () => store,
    _seed: (obj) => { store = { ...obj } },
  }
}

const sessionMock = makeStorageMock()
const localMock = makeStorageMock()

Object.defineProperty(globalThis, 'sessionStorage', { value: sessionMock, writable: true })
Object.defineProperty(globalThis, 'localStorage', { value: localMock, writable: true })

// Import after mocks are attached to globalThis
import {
  PERSISTED_KEYS,
  getItem,
  setItem,
  removeItem,
  hydrateSessionFromLocal,
  clearPersistedSession,
} from '../clientStorage.js'

// ---------------------------------------------------------------------------
// Setup — clear both stores before every test
// ---------------------------------------------------------------------------
beforeEach(() => {
  sessionMock.clear()
  localMock.clear()
  vi.clearAllMocks()

  // Re-attach implementations after clear() reset the store reference
  sessionMock.getItem.mockImplementation((key) => sessionMock._store()[key] ?? null)
  sessionMock.setItem.mockImplementation((key, value) => { sessionMock._store()[key] = String(value) })
  sessionMock.removeItem.mockImplementation((key) => { delete sessionMock._store()[key] })

  localMock.getItem.mockImplementation((key) => localMock._store()[key] ?? null)
  localMock.setItem.mockImplementation((key, value) => { localMock._store()[key] = String(value) })
  localMock.removeItem.mockImplementation((key) => { delete localMock._store()[key] })
})

// ---------------------------------------------------------------------------
// PERSISTED_KEYS
// ---------------------------------------------------------------------------
describe('PERSISTED_KEYS', () => {
  it('is an array with at least one entry', () => {
    expect(Array.isArray(PERSISTED_KEYS)).toBe(true)
    expect(PERSISTED_KEYS.length).toBeGreaterThan(0)
  })

  it('contains token and userRole', () => {
    expect(PERSISTED_KEYS).toContain('token')
    expect(PERSISTED_KEYS).toContain('userRole')
  })

  it('contains studentId and parentId', () => {
    expect(PERSISTED_KEYS).toContain('studentId')
    expect(PERSISTED_KEYS).toContain('parentId')
  })
})

// ---------------------------------------------------------------------------
// getItem()
// ---------------------------------------------------------------------------
describe('getItem()', () => {
  it('returns the value from sessionStorage when present', () => {
    sessionMock._seed({ token: 'session-token-abc' })
    expect(getItem('token')).toBe('session-token-abc')
  })

  it('falls back to localStorage when sessionStorage has no value', () => {
    localMock._seed({ token: 'local-token-xyz' })
    expect(getItem('token')).toBe('local-token-xyz')
  })

  it('returns null when neither storage has the key', () => {
    expect(getItem('nonExistentKey')).toBeNull()
  })

  it('prefers sessionStorage over localStorage when both have a value', () => {
    sessionMock._seed({ userRole: 'admin' })
    localMock._seed({ userRole: 'student' })
    expect(getItem('userRole')).toBe('admin')
  })
})

// ---------------------------------------------------------------------------
// setItem()
// ---------------------------------------------------------------------------
describe('setItem()', () => {
  it('writes the value to sessionStorage', () => {
    setItem('studentName', 'Alice')
    expect(sessionMock.setItem).toHaveBeenCalledWith('studentName', 'Alice')
  })

  it('also writes to localStorage for a persisted key', () => {
    // 'token' is in PERSISTED_KEYS
    setItem('token', 'my-jwt')
    expect(localMock.setItem).toHaveBeenCalledWith('token', 'my-jwt')
  })

  it('does NOT write to localStorage for a non-persisted key', () => {
    // 'tempData' is not in PERSISTED_KEYS
    setItem('tempData', 'someValue')
    expect(localMock.setItem).not.toHaveBeenCalled()
  })

  it('converts value to string when storing', () => {
    setItem('studentAge', 10)
    expect(sessionMock.setItem).toHaveBeenCalledWith('studentAge', 10)
    // The underlying mock stores as string via String(value)
    expect(sessionMock._store()['studentAge']).toBe('10')
  })
})

// ---------------------------------------------------------------------------
// removeItem()
// ---------------------------------------------------------------------------
describe('removeItem()', () => {
  it('removes the key from sessionStorage', () => {
    sessionMock._seed({ token: 'abc' })
    removeItem('token')
    expect(sessionMock.removeItem).toHaveBeenCalledWith('token')
    expect(sessionMock._store()['token']).toBeUndefined()
  })

  it('removes the key from localStorage', () => {
    localMock._seed({ token: 'abc' })
    removeItem('token')
    expect(localMock.removeItem).toHaveBeenCalledWith('token')
    expect(localMock._store()['token']).toBeUndefined()
  })

  it('does not throw when removing a key that does not exist', () => {
    expect(() => removeItem('keyThatNeverExisted')).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// hydrateSessionFromLocal()
// ---------------------------------------------------------------------------
describe('hydrateSessionFromLocal()', () => {
  it('copies persisted localStorage values into sessionStorage when session is empty', () => {
    localMock._seed({ token: 'local-token', userRole: 'parent' })

    hydrateSessionFromLocal()

    expect(sessionMock.setItem).toHaveBeenCalledWith('token', 'local-token')
    expect(sessionMock.setItem).toHaveBeenCalledWith('userRole', 'parent')
  })

  it('does not overwrite existing sessionStorage values', () => {
    sessionMock._seed({ token: 'session-token' })
    localMock._seed({ token: 'local-token' })

    hydrateSessionFromLocal()

    // sessionStorage already has token — should not be overwritten
    expect(sessionMock._store()['token']).toBe('session-token')
  })

  it('does nothing when localStorage has no persisted values', () => {
    hydrateSessionFromLocal()
    // setItem should not be called because there is nothing to hydrate
    expect(sessionMock.setItem).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// clearPersistedSession()
// ---------------------------------------------------------------------------
describe('clearPersistedSession()', () => {
  it('clears all of sessionStorage', () => {
    sessionMock._seed({ token: 'abc', studentId: '123' })

    clearPersistedSession()

    expect(sessionMock.clear).toHaveBeenCalled()
  })

  it('removes each persisted key from localStorage', () => {
    const seedObj = {}
    PERSISTED_KEYS.forEach((key) => { seedObj[key] = 'value' })
    localMock._seed(seedObj)

    clearPersistedSession()

    PERSISTED_KEYS.forEach((key) => {
      expect(localMock.removeItem).toHaveBeenCalledWith(key)
    })
  })

  it('does not remove non-persisted localStorage entries', () => {
    localMock._seed({ customAppSetting: 'keep-me' })

    clearPersistedSession()

    expect(localMock.removeItem).not.toHaveBeenCalledWith('customAppSetting')
  })
})
