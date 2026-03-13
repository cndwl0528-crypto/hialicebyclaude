/**
 * Sentry error tracking for HiAlice backend.
 *
 * Only active when SENTRY_DSN env var is set.
 * When SENTRY_DSN is absent every export is a safe no-op so the rest of the
 * codebase can call these functions unconditionally.
 */

let Sentry = null;
const enabled = !!process.env.SENTRY_DSN;

if (enabled) {
  try {
    // Dynamic import would be cleaner but top-level await is not universal.
    // Use createRequire as a fallback-safe approach for ESM.
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    Sentry = require('@sentry/node');

    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    });

    console.log('[Sentry] Initialized successfully');
  } catch (err) {
    console.warn('[Sentry] Failed to initialize (@sentry/node may not be installed):', err.message);
  }
}

/**
 * Express error handler middleware for Sentry.
 * Place this BEFORE the generic errorHandler but AFTER all routes.
 */
export function sentryErrorHandler(err, req, res, next) {
  if (Sentry) {
    Sentry.captureException(err);
  }
  next(err);
}

// ---------------------------------------------------------------------------
// COPPA PII scrubber — strip child / parent PII before it reaches Sentry.
// Keys are checked case-insensitively against this set.
// ---------------------------------------------------------------------------
const PII_KEYS = new Set([
  'name', 'email', 'studentname', 'parentname', 'parentemail',
  'student_name', 'parent_name', 'parent_email',
  'password', 'token', 'children', 'child',
]);

function scrubPii(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(scrubPii);
  if (typeof obj !== 'object') return obj;

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = scrubPii(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Capture an exception manually.
 * Any PII keys in `context` are scrubbed before sending to Sentry (COPPA).
 */
export function captureException(err, context) {
  if (Sentry) {
    if (context) {
      Sentry.withScope((scope) => {
        scope.setContext('extra', scrubPii(context));
        Sentry.captureException(err);
      });
    } else {
      Sentry.captureException(err);
    }
  }
}

/**
 * Capture a message manually.
 */
export function captureMessage(msg, level = 'info') {
  if (Sentry) {
    Sentry.captureMessage(msg, level);
  }
}

export { Sentry };
export default { sentryErrorHandler, captureException, captureMessage, Sentry };
