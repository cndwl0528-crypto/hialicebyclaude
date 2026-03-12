/**
 * sync.js
 * HiAlice — Multi-Device Session Sync Routes
 *
 * Provides server-side state storage so students can switch devices
 * (tablet → phone → desktop) without losing session progress.
 *
 * All state is kept in-memory (Map) for now. Replace with Supabase
 * persistence once the schema is confirmed in production.
 *
 * Conflict resolution strategy: last-write-wins, based on `updatedAt`
 * ISO timestamp. Clients must send a deviceId so the server can track
 * which device holds the freshest copy of each key.
 *
 * Route summary:
 *   POST   /api/sync/state                       Save a single state key
 *   GET    /api/sync/state/:studentId/:key       Read one key for a student
 *   GET    /api/sync/state/:studentId            Read all keys for a student
 *   DELETE /api/sync/state/:studentId/:key       Clear one key for a student
 *   POST   /api/sync/heartbeat                   Record active device presence
 *   GET    /api/sync/devices/:studentId          List recently active devices
 */

import express from 'express';

const router = express.Router();

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

/**
 * stateStore — nested Map structure:
 *   studentId (string)
 *     -> key (string)
 *        -> { value: string, deviceId: string, updatedAt: string (ISO) }
 */
const stateStore = new Map();

/**
 * deviceStore — nested Map structure:
 *   studentId (string)
 *     -> deviceId (string)
 *        -> { activeSession: string|null, lastSeen: string (ISO) }
 *
 * A device is considered "active" if its lastSeen is within 5 minutes.
 */
const deviceStore = new Map();

const DEVICE_ACTIVE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the student sub-map from stateStore, creating it if absent.
 */
function getStudentState(studentId) {
  if (!stateStore.has(studentId)) {
    stateStore.set(studentId, new Map());
  }
  return stateStore.get(studentId);
}

/**
 * Return the student sub-map from deviceStore, creating it if absent.
 */
function getStudentDevices(studentId) {
  if (!deviceStore.has(studentId)) {
    deviceStore.set(studentId, new Map());
  }
  return deviceStore.get(studentId);
}

/**
 * Validate that required string fields are present and non-empty.
 * Returns an error message string, or null if everything is fine.
 */
function validateRequired(body, fields) {
  for (const field of fields) {
    if (!body[field] || typeof body[field] !== 'string' || !body[field].trim()) {
      return `Missing or empty required field: ${field}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// POST /api/sync/state
// Save (or overwrite) a single state key for a student.
//
// Body: { studentId, key, value, deviceId }
//   - value must be a string (callers should JSON.stringify objects)
//   - Uses last-write-wins: the server always accepts the new value
// ---------------------------------------------------------------------------
router.post('/state', (req, res) => {
  const { studentId, key, value, deviceId } = req.body ?? {};

  const validationError = validateRequired(req.body ?? {}, ['studentId', 'key', 'deviceId']);
  if (validationError) {
    return res.status(400).json({ success: false, error: validationError });
  }

  // value may be an empty string — that is valid (e.g. clearing text input)
  if (value === undefined || value === null) {
    return res.status(400).json({ success: false, error: 'Missing required field: value' });
  }

  const studentState = getStudentState(studentId.trim());
  const updatedAt = new Date().toISOString();

  studentState.set(key.trim(), {
    value: String(value),
    deviceId: deviceId.trim(),
    updatedAt,
  });

  return res.status(200).json({
    success: true,
    studentId: studentId.trim(),
    key: key.trim(),
    updatedAt,
  });
});

// ---------------------------------------------------------------------------
// GET /api/sync/state/:studentId/:key
// Retrieve the current value of one key for a student.
// ---------------------------------------------------------------------------
router.get('/state/:studentId/:key', (req, res) => {
  const { studentId, key } = req.params;

  const studentState = stateStore.get(studentId);
  if (!studentState) {
    return res.status(404).json({ success: false, error: 'No state found for student' });
  }

  const entry = studentState.get(key);
  if (!entry) {
    return res.status(404).json({ success: false, error: `Key "${key}" not found for student` });
  }

  return res.status(200).json({
    success: true,
    studentId,
    key,
    value: entry.value,
    deviceId: entry.deviceId,
    updatedAt: entry.updatedAt,
  });
});

// ---------------------------------------------------------------------------
// GET /api/sync/state/:studentId
// Retrieve all stored state entries for a student as a flat object.
// Useful on app init to bulk-hydrate local storage from the server.
// ---------------------------------------------------------------------------
router.get('/state/:studentId', (req, res) => {
  const { studentId } = req.params;

  const studentState = stateStore.get(studentId);
  if (!studentState || studentState.size === 0) {
    return res.status(200).json({ success: true, studentId, state: {} });
  }

  // Convert the inner Map to a plain object for JSON serialisation
  const state = {};
  for (const [k, entry] of studentState.entries()) {
    state[k] = {
      value: entry.value,
      deviceId: entry.deviceId,
      updatedAt: entry.updatedAt,
    };
  }

  return res.status(200).json({ success: true, studentId, state });
});

// ---------------------------------------------------------------------------
// DELETE /api/sync/state/:studentId/:key
// Remove one specific state key for a student.
// ---------------------------------------------------------------------------
router.delete('/state/:studentId/:key', (req, res) => {
  const { studentId, key } = req.params;

  const studentState = stateStore.get(studentId);
  if (!studentState || !studentState.has(key)) {
    return res.status(404).json({ success: false, error: `Key "${key}" not found for student` });
  }

  studentState.delete(key);

  return res.status(200).json({
    success: true,
    studentId,
    key,
    deleted: true,
  });
});

// ---------------------------------------------------------------------------
// POST /api/sync/heartbeat
// Register that a device is currently active for a student session.
// The frontend calls this every 60 seconds via SyncedStorage.startHeartbeat().
//
// Body: { studentId, deviceId, activeSession }
//   - activeSession: session ID string, or null if no session is running
// ---------------------------------------------------------------------------
router.post('/heartbeat', (req, res) => {
  const { studentId, deviceId, activeSession } = req.body ?? {};

  const validationError = validateRequired(req.body ?? {}, ['studentId', 'deviceId']);
  if (validationError) {
    return res.status(400).json({ success: false, error: validationError });
  }

  const devices = getStudentDevices(studentId.trim());
  const lastSeen = new Date().toISOString();

  devices.set(deviceId.trim(), {
    activeSession: activeSession ?? null,
    lastSeen,
  });

  return res.status(200).json({
    success: true,
    studentId: studentId.trim(),
    deviceId: deviceId.trim(),
    lastSeen,
  });
});

// ---------------------------------------------------------------------------
// GET /api/sync/devices/:studentId
// Return all devices that have sent a heartbeat within the active TTL window.
// ---------------------------------------------------------------------------
router.get('/devices/:studentId', (req, res) => {
  const { studentId } = req.params;

  const devices = deviceStore.get(studentId);
  if (!devices || devices.size === 0) {
    return res.status(200).json({ success: true, studentId, devices: [] });
  }

  const now = Date.now();
  const activeDevices = [];

  for (const [deviceId, info] of devices.entries()) {
    const age = now - new Date(info.lastSeen).getTime();
    if (age <= DEVICE_ACTIVE_TTL_MS) {
      activeDevices.push({
        deviceId,
        activeSession: info.activeSession,
        lastSeen: info.lastSeen,
      });
    }
  }

  // Sort most-recently-seen first
  activeDevices.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

  return res.status(200).json({ success: true, studentId, devices: activeDevices });
});

export default router;
