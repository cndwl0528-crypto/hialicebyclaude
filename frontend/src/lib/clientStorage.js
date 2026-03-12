'use client';

// ============================================================================
// PERSISTED KEYS
// Keys in this list are mirrored to localStorage so they survive tab close.
// All other keys live only in sessionStorage.
// ============================================================================

export const PERSISTED_KEYS = [
  'token',
  'parentId',
  'parentEmail',
  'userRole',
  'studentId',
  'studentName',
  'studentLevel',
  'studentAge',
  'bookId',
  'bookTitle',
  'children',
  'lastSessionData',
  'lastReviewData',
  'dueVocabIds',
];

// ============================================================================
// BASE STORAGE — original API, fully backward-compatible
// ============================================================================

export function hydrateSessionFromLocal() {
  if (typeof window === 'undefined') return;

  PERSISTED_KEYS.forEach((key) => {
    const sessionValue = window.sessionStorage.getItem(key);
    if (sessionValue !== null) return;

    const localValue = window.localStorage.getItem(key);
    if (localValue !== null) {
      window.sessionStorage.setItem(key, localValue);
    }
  });
}

export function getItem(key) {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
}

export function setItem(key, value) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(key, value);
  if (PERSISTED_KEYS.includes(key)) {
    window.localStorage.setItem(key, value);
  }
}

export function removeItem(key) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(key);
  window.localStorage.removeItem(key);
}

export function clearPersistedSession() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.clear();
  PERSISTED_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}

// ============================================================================
// SYNCED STORAGE — multi-device sync layer
//
// Usage:
//   import { syncedStorage } from '@/lib/clientStorage';
//
//   // Enable sync (call once on login with the real student ID)
//   syncedStorage.enable('student-uuid-123');
//
//   // Works exactly like the base API — sync happens transparently
//   syncedStorage.setItem('bookId', 'book-42');
//   const id = syncedStorage.getItem('studentId');
//
//   // On app init, pull everything from the server and merge locally
//   await syncedStorage.syncAll('student-uuid-123');
//
//   // Clean up heartbeat timer on logout
//   syncedStorage.stopHeartbeat();
// ============================================================================

/**
 * Master feature flag. Set to true to activate server sync.
 * When false, SyncedStorage is a thin pass-through to the base API
 * with zero network overhead — safe to ship disabled.
 */
export const SYNC_ENABLED = false;

// Backend base URL. Reads from env var if available, falls back to localhost.
const SYNC_BASE_URL =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) ||
  'http://localhost:4000';

// localStorage key where the permanent device ID is persisted
const DEVICE_ID_STORAGE_KEY = '__hialice_device_id__';

// Heartbeat interval in milliseconds
const HEARTBEAT_INTERVAL_MS = 60 * 1000;

// ============================================================================
// SyncedStorage class
// ============================================================================

class SyncedStorage {
  constructor() {
    /** Whether sync is currently active (requires SYNC_ENABLED + studentId) */
    this._active = false;

    /** Student ID set by enable() */
    this._studentId = null;

    /** Stable identifier for this browser/device */
    this._deviceId = null;

    /** setInterval handle for the heartbeat */
    this._heartbeatTimer = null;

    /** Tracks the most recent activeSession value for heartbeat payloads */
    this._activeSession = null;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Activate syncing for the given student.
   * Call this once the student has been identified (e.g. after login or
   * student-select screen). Safe to call multiple times — re-entrant.
   *
   * @param {string} studentId
   */
  enable(studentId) {
    if (!SYNC_ENABLED || !studentId) return;
    this._studentId = studentId;
    this._deviceId = this.generateDeviceId();
    this._active = true;
  }

  /**
   * Deactivate syncing (e.g. on logout). Does not clear local storage.
   */
  disable() {
    this.stopHeartbeat();
    this._active = false;
    this._studentId = null;
    this._activeSession = null;
  }

  /**
   * Get a value. Reads from local storage only (fast path).
   * To pull the latest from the server first, call syncAll() on init.
   *
   * @param {string} key
   * @returns {string|null}
   */
  getItem(key) {
    return getItem(key);
  }

  /**
   * Set a value locally and fire-and-forget push to the server.
   * Never blocks the caller — network failures are silently swallowed
   * so the app never degrades due to sync issues.
   *
   * @param {string} key
   * @param {string} value
   */
  setItem(key, value) {
    // Write locally first — this is always synchronous and reliable
    setItem(key, value);

    // Push to server in the background when sync is active
    if (this._active && this._studentId) {
      this._pushToServer(key, value).catch(() => {
        // Intentional no-op: server push is best-effort
      });
    }
  }

  /**
   * Remove a value locally and delete it from the server.
   *
   * @param {string} key
   */
  removeItem(key) {
    removeItem(key);

    if (this._active && this._studentId) {
      this._deleteFromServer(key).catch(() => {
        // Intentional no-op
      });
    }
  }

  /**
   * Pull all server-side state for the student and merge into local storage.
   * Uses last-write-wins: the server value is accepted only when its
   * `updatedAt` timestamp is newer than a locally-stored sentinel, OR when
   * no local value exists at all.
   *
   * Call this once on app init / device switch, not on every page load.
   *
   * @param {string} studentId  — can differ from this._studentId (e.g. before enable())
   * @returns {Promise<void>}
   */
  async syncAll(studentId) {
    if (!SYNC_ENABLED || !studentId) return;

    try {
      const response = await fetch(
        `${SYNC_BASE_URL}/api/sync/state/${encodeURIComponent(studentId)}`,
        { credentials: 'include' }
      );

      if (!response.ok) return;

      const data = await response.json();
      if (!data.success || !data.state) return;

      const serverState = data.state;

      for (const [key, entry] of Object.entries(serverState)) {
        const localValue = getItem(key);

        if (localValue === null) {
          // No local value — accept the server value unconditionally
          setItem(key, entry.value);
          continue;
        }

        // Compare timestamps using the sentinel stored alongside local data.
        // If we have never stored a timestamp for this key, treat local as older.
        const localTimestampKey = `__sync_ts_${key}__`;
        const localTs = window.localStorage.getItem(localTimestampKey);

        if (!localTs || new Date(entry.updatedAt) > new Date(localTs)) {
          setItem(key, entry.value);
          // Record the server timestamp so future syncs can compare correctly
          window.localStorage.setItem(localTimestampKey, entry.updatedAt);
        }
      }
    } catch {
      // Network unavailable — continue with local state
    }
  }

  /**
   * Generate (or retrieve from localStorage) a stable device identifier.
   * The ID is a random hex string prefixed with the device type hint.
   *
   * @returns {string}
   */
  generateDeviceId() {
    if (typeof window === 'undefined') return 'ssr-device';

    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;

    // Build a reasonably unique ID without depending on crypto.randomUUID()
    // to maintain compatibility with older WebViews on tablets.
    const array = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(array);
    } else {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }

    const hex = Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Prefix with a rough device-type hint for debugging
    const hint = /Mobi|Android/i.test(navigator.userAgent ?? '')
      ? 'mob'
      : /Tablet|iPad/i.test(navigator.userAgent ?? '')
      ? 'tab'
      : 'web';

    const deviceId = `${hint}-${hex}`;
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    return deviceId;
  }

  /**
   * Update the active session ID reported in heartbeat payloads.
   * Call this when a session starts or ends.
   *
   * @param {string|null} sessionId
   */
  setActiveSession(sessionId) {
    this._activeSession = sessionId ?? null;
  }

  /**
   * Start sending periodic heartbeats to keep the device listed as active.
   * Sends immediately, then repeats every HEARTBEAT_INTERVAL_MS.
   * Calling this multiple times is safe — the previous timer is cleared first.
   *
   * @param {string} studentId
   */
  startHeartbeat(studentId) {
    if (!SYNC_ENABLED || !studentId) return;

    this.stopHeartbeat();

    if (!this._deviceId) {
      this._deviceId = this.generateDeviceId();
    }

    const sendBeat = () => {
      this._sendHeartbeat(studentId).catch(() => {
        // Intentional no-op
      });
    };

    // Send first beat immediately, then schedule repeats
    sendBeat();
    this._heartbeatTimer = setInterval(sendBeat, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stop the heartbeat timer. Call on logout or component unmount.
   */
  stopHeartbeat() {
    if (this._heartbeatTimer !== null) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------

  /**
   * POST a single key/value to the server (fire-and-forget).
   * Also stores the server-acknowledged timestamp locally for future
   * conflict resolution during syncAll().
   *
   * @param {string} key
   * @param {string} value
   */
  async _pushToServer(key, value) {
    const response = await fetch(`${SYNC_BASE_URL}/api/sync/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        studentId: this._studentId,
        key,
        value: String(value),
        deviceId: this._deviceId,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.updatedAt && typeof window !== 'undefined') {
        window.localStorage.setItem(`__sync_ts_${key}__`, data.updatedAt);
      }
    }
  }

  /**
   * DELETE a single key from the server.
   *
   * @param {string} key
   */
  async _deleteFromServer(key) {
    await fetch(
      `${SYNC_BASE_URL}/api/sync/state/${encodeURIComponent(this._studentId)}/${encodeURIComponent(key)}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );
  }

  /**
   * POST a heartbeat to the server.
   *
   * @param {string} studentId
   */
  async _sendHeartbeat(studentId) {
    await fetch(`${SYNC_BASE_URL}/api/sync/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        studentId,
        deviceId: this._deviceId,
        activeSession: this._activeSession,
      }),
    });
  }
}

// Export a shared singleton instance — import the same object everywhere
export const syncedStorage = new SyncedStorage();
