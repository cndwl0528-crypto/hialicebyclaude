/**
 * Sentry error tracking — thin wrapper for @sentry/nextjs v8 (client side).
 *
 * Graceful no-op when:
 *   - NEXT_PUBLIC_SENTRY_DSN is not set, OR
 *   - @sentry/nextjs is not installed
 */

let Sentry = null;
try {
  Sentry = require('@sentry/nextjs');
} catch {
  // @sentry/nextjs not installed — all exports become no-ops.
}

const dsn = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SENTRY_DSN : undefined;
const isEnabled = Boolean(dsn && Sentry);

/**
 * Initialise Sentry for the browser bundle.
 * Called once from sentry.client.config.js.
 */
export function initSentry() {
  if (!isEnabled) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: false, // COPPA compliance
  });
}

/** Manually capture an exception. Safe no-op when not initialized. */
export function captureException(error, context = {}) {
  if (!isEnabled) return;
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => scope.setExtra(key, value));
    Sentry.captureException(error);
  });
}

/** Manually capture a message. Safe no-op when not initialized. */
export function captureMessage(message, level = 'info') {
  if (!isEnabled) return;
  Sentry.captureMessage(message, level);
}

/** Set user context for events. Pass null on logout. */
export function setUser(user) {
  if (!isEnabled) return;
  Sentry.setUser(user);
}
