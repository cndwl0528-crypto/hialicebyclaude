/**
 * abTest.js
 * HiAlice — Client-side A/B Testing Utility
 *
 * Provides deterministic variant assignment based on a hash of the student ID
 * and experiment name, ensuring a student always sees the same variant within
 * a session and across sessions on the same device.
 *
 * Usage:
 *   import { getVariant, trackEvent, EXPERIMENTS } from '@/lib/abTest';
 *
 *   const variant = getVariant('session_turns', studentId);
 *   // => 'control' | '3_turns' | '4_turns' | '5_turns'
 *
 *   trackEvent('session_turns', variant, 'session_complete', { score: 88 });
 */

import { API_BASE } from '@/lib/constants';
import { getItem, setItem, removeItem } from './clientStorage.js';

// ============================================================================
// Experiment definitions
// ============================================================================

/**
 * Active experiments registry.
 *
 * Each experiment has:
 *   variants   — ordered list of variant names; index 0 is conventionally 'control'
 *   description — human-readable description for the admin UI
 *   status     — 'active' | 'paused' | 'completed'
 */
export const EXPERIMENTS = {
  session_turns: {
    name: 'session_turns',
    description: 'Optimal turns per stage',
    variants: ['3_turns', '4_turns', '5_turns'],
    status: 'active',
  },
  reward_type: {
    name: 'reward_type',
    description: 'Which reward drives engagement',
    variants: ['badges_only', 'xp_system', 'story_unlock'],
    status: 'active',
  },
  pre_reading: {
    name: 'pre_reading',
    description: 'Pre-reading module depth',
    variants: ['skip', 'quick', 'full'],
    status: 'active',
  },
  vocab_timing: {
    name: 'vocab_timing',
    description: 'When to show vocabulary',
    variants: ['during_session', 'after_session', 'both'],
    status: 'active',
  },
};

// ============================================================================
// Deterministic hashing
// ============================================================================

/**
 * Simple djb2-style string hash — produces a stable non-negative integer for
 * any string input.  Lightweight, no crypto dependency required.
 *
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // hash * 33 XOR charCode  (djb2)
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // Ensure non-negative 32-bit integer
  return hash >>> 0;
}

/**
 * Derive a deterministic variant index for a given student + experiment pair.
 *
 * @param {string} studentId
 * @param {string} experimentName
 * @param {number} variantCount
 * @returns {number}  0-based index into the variants array
 */
function deriveVariantIndex(studentId, experimentName, variantCount) {
  const seed = `${studentId}::${experimentName}`;
  return hashString(seed) % variantCount;
}

// ============================================================================
// Storage helpers (sessionStorage-first with safe fallback)
// ============================================================================

const STORAGE_PREFIX = 'abtest::';

/**
 * Tracks every storage key written by writeAssignment() so that
 * clearAssignments() can remove them without iterating sessionStorage
 * directly (which has no equivalent in the clientStorage wrapper API).
 *
 * @type {Set<string>}
 */
const _writtenAssignmentKeys = new Set();

function readAssignment(experimentName) {
  if (typeof window === 'undefined') return null;
  try {
    return getItem(`${STORAGE_PREFIX}${experimentName}`);
  } catch {
    return null;
  }
}

function writeAssignment(experimentName, variant) {
  if (typeof window === 'undefined') return;
  try {
    const key = `${STORAGE_PREFIX}${experimentName}`;
    setItem(key, variant);
    _writtenAssignmentKeys.add(key);
  } catch {
    // Storage may be unavailable in private mode on some browsers
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Returns the variant assigned to the current student for a given experiment.
 *
 * Assignment is deterministic — the same studentId + experimentName always
 * produces the same variant.  The result is cached in sessionStorage so the
 * assignment persists for the full browser session without re-computing.
 *
 * If the experiment does not exist or is paused/completed, returns 'control'.
 * If studentId is not provided, a random temporary ID is generated and stored
 * so anonymous visitors still receive consistent assignments within a session.
 *
 * @param {string} experimentName  — Key from EXPERIMENTS
 * @param {string} [studentId]     — Student's unique identifier
 * @returns {string}               — Variant name (e.g. '4_turns', 'xp_system')
 */
export function getVariant(experimentName, studentId) {
  const experiment = EXPERIMENTS[experimentName];

  // Unknown or inactive experiment — fall back to first variant (control-like)
  if (!experiment || experiment.status !== 'active') {
    return experiment?.variants?.[0] ?? 'control';
  }

  // Check for a previously cached assignment in sessionStorage
  const cached = readAssignment(experimentName);
  if (cached && experiment.variants.includes(cached)) {
    return cached;
  }

  // Resolve or generate a stable identity for anonymous visitors
  let effectiveId = studentId;
  if (!effectiveId) {
    if (typeof window !== 'undefined') {
      const anonKey = 'abtest::anon_id';
      let anonId = getItem(anonKey);
      if (!anonId) {
        anonId = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        try {
          setItem(anonKey, anonId);
          _writtenAssignmentKeys.add(anonKey);
        } catch { /* ignore */ }
      }
      effectiveId = anonId;
    } else {
      effectiveId = 'server-render';
    }
  }

  // Deterministically pick a variant
  const idx = deriveVariantIndex(effectiveId, experimentName, experiment.variants.length);
  const variant = experiment.variants[idx];

  // Cache for session consistency
  writeAssignment(experimentName, variant);

  return variant;
}

/**
 * Clear all cached A/B assignments from storage.
 * Useful when a student logs out or switches profiles.
 *
 * Keys are tracked in _writtenAssignmentKeys as they are written, so we
 * never need to iterate sessionStorage directly — the clientStorage
 * removeItem() wrapper handles the actual deletion.
 */
export function clearAssignments() {
  if (typeof window === 'undefined') return;
  try {
    _writtenAssignmentKeys.forEach((key) => removeItem(key));
    _writtenAssignmentKeys.clear();
  } catch { /* ignore */ }
}

/**
 * Get a map of all current experiment assignments for the active student.
 * Useful for including in analytics payloads.
 *
 * @param {string} [studentId]
 * @returns {Record<string, string>}  e.g. { session_turns: '4_turns', ... }
 */
export function getAllAssignments(studentId) {
  return Object.keys(EXPERIMENTS).reduce((acc, name) => {
    acc[name] = getVariant(name, studentId);
    return acc;
  }, {});
}

// ============================================================================
// Event tracking
// ============================================================================

/**
 * Track an experiment event by posting to the backend.
 *
 * This is fire-and-forget — failures are logged but never rethrow so that
 * analytics errors never block the user experience.
 *
 * @param {string} experimentName  — Key from EXPERIMENTS
 * @param {string} eventName       — Descriptive event label (e.g. 'session_complete')
 * @param {object} [metadata]      — Additional payload (scores, duration, etc.)
 * @param {string} [studentId]     — Student's unique identifier
 * @returns {Promise<void>}
 */
export async function trackEvent(experimentName, eventName, metadata = {}, studentId = null) {
  try {
    const variant = getVariant(experimentName, studentId);
    const experiment = EXPERIMENTS[experimentName];

    if (!experiment) {
      console.warn(`[abTest] trackEvent: unknown experiment "${experimentName}"`);
      return;
    }

    const payload = {
      experimentName,
      variant,
      event: eventName,
      metadata,
      studentId,
      timestamp: new Date().toISOString(),
    };

    const token = typeof window !== 'undefined' ? getItem('token') : null;

    await fetch(`${API_BASE}/api/experiments/track`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Non-critical — analytics should never break the app
    console.warn('[abTest] trackEvent failed (non-critical):', err);
  }
}

// ============================================================================
// React hook (convenience wrapper)
// ============================================================================

/**
 * React hook for consuming an experiment variant in a component.
 *
 * @example
 *   const variant = useVariant('session_turns', studentId);
 *   const maxTurns = variant === '5_turns' ? 5 : variant === '4_turns' ? 4 : 3;
 *
 * @param {string} experimentName
 * @param {string} [studentId]
 * @returns {string}
 */
export function useVariant(experimentName, studentId) {
  // Variant is fully deterministic from inputs — no async work needed.
  // We call getVariant directly so this is safe in SSR (returns first variant
  // when window is undefined, hydrates to correct value on the client).
  return getVariant(experimentName, studentId);
}

export default {
  EXPERIMENTS,
  getVariant,
  trackEvent,
  getAllAssignments,
  clearAssignments,
  useVariant,
};
