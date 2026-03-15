/**
 * Sentry error tracking for HiMax frontend.
 *
 * Only active when NEXT_PUBLIC_SENTRY_DSN env var is set.
 * When the DSN is absent every export is a safe no-op.
 */

let Sentry = null;
const dsn = typeof window !== 'undefined'
  ? process.env.NEXT_PUBLIC_SENTRY_DSN
  : null;

/**
 * Initialize Sentry. Call once at app startup (e.g. in _app.js or layout.js).
 * Safe to call even when @sentry/nextjs is not installed.
 */
export async function initSentry() {
  if (!dsn) return;

  try {
    // Use an indirect dynamic import so webpack does not attempt to statically
    // bundle @sentry/nextjs when the package is not installed.
    // eslint-disable-next-line no-new-func
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    Sentry = await dynamicImport('@sentry/nextjs');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
    console.log('[Sentry] Frontend initialized');
  } catch (err) {
    console.warn('[Sentry] Frontend init failed (@sentry/nextjs may not be installed):', err.message);
  }
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
