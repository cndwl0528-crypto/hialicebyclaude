/**
 * Sentry error tracking — thin wrapper for @sentry/node v8.
 *
 * This module is a graceful no-op when:
 *   - SENTRY_DSN is not set, OR
 *   - @sentry/node is not installed
 *
 * Usage in app.js:
 *   import { initSentry } from './lib/sentry.js';
 *   const { errorHandler } = initSentry(app);
 *   // add errorHandler AFTER all routes and BEFORE custom error handler
 *   app.use(errorHandler);
 */

let Sentry = null;
let _initialized = false;

// Attempt to load @sentry/node — silently skip if not installed.
try {
  Sentry = await import('@sentry/node');
} catch {
  // Package not installed — all exports become no-ops.
}

// eslint-disable-next-line no-unused-vars
const noopErrorHandler = (err, req, res, next) => next(err);

/**
 * Initialize Sentry and attach the request handler to the given Express app.
 *
 * @param {import('express').Application} app  Express application instance
 * @returns {{ errorHandler: import('express').ErrorRequestHandler }}
 */
export function initSentry(app) {
  const dsn = process.env.SENTRY_DSN;

  if (!Sentry || !dsn) {
    if (process.env.NODE_ENV !== 'test') {
      console.info(`[Sentry] ${!Sentry ? '@sentry/node not installed' : 'SENTRY_DSN not set'} — error tracking disabled.`);
    }
    return { errorHandler: noopErrorHandler };
  }

  if (!_initialized) {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      sendDefaultPii: false, // COPPA compliance
    });
    _initialized = true;
    console.info(`[Sentry] Initialized — environment: ${process.env.NODE_ENV || 'development'}`);
  }

  app.use(Sentry.Handlers.requestHandler());

  return {
    errorHandler: Sentry.Handlers.errorHandler(),
  };
}

/**
 * Manually capture an exception. Safe no-op when not initialized.
 */
export function captureException(error, context = {}) {
  if (!_initialized || !Sentry) return;
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => scope.setExtra(key, value));
    Sentry.captureException(error);
  });
}

/**
 * Manually capture a message. Safe no-op when not initialized.
 */
export function captureMessage(message, level = 'info') {
  if (!_initialized || !Sentry) return;
  Sentry.captureMessage(message, level);
}
