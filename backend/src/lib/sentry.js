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

/**
 * Capture an exception manually.
 */
export function captureException(err) {
  if (Sentry) {
    Sentry.captureException(err);
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
