/**
 * Sentry client-side initialisation for Next.js.
 * Auto-imported by Next.js when @sentry/nextjs is installed.
 */
try {
  const { initSentry } = require('./src/lib/sentry.js');
  initSentry();
} catch {
  // @sentry/nextjs not installed — skip silently.
}
