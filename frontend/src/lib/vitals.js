/**
 * Core Web Vitals reporting for HiAlice.
 *
 * In development: logs each metric to the console.
 * In production: POSTs to /api/vitals when that endpoint exists (best-effort,
 * errors are silently swallowed so they never affect the user experience).
 *
 * Usage — add to frontend/src/app/layout.js or any root component:
 *
 *   import { reportWebVitals } from '@/lib/vitals';
 *   export { reportWebVitals };        // Next.js App Router re-export
 *
 * Or, for the Pages Router, export directly from pages/_app.js:
 *
 *   export { reportWebVitals } from '@/lib/vitals';
 */

/**
 * Metric names we care about, in order of importance for child-focused UX.
 * - CLS  : Cumulative Layout Shift   (visual stability)
 * - FID  : First Input Delay         (interactivity)
 * - FCP  : First Contentful Paint    (initial render)
 * - LCP  : Largest Contentful Paint  (main content load)
 * - TTFB : Time to First Byte        (server response)
 */
const VITAL_LABELS = {
  CLS: 'Cumulative Layout Shift',
  FID: 'First Input Delay',
  FCP: 'First Contentful Paint',
  LCP: 'Largest Contentful Paint',
  TTFB: 'Time to First Byte',
};

/**
 * Thresholds (from web.dev/vitals) used to colour the console output.
 * green  = good, yellow = needs improvement, red = poor
 */
const THRESHOLDS = {
  CLS:  { good: 0.1,   poor: 0.25  },
  FID:  { good: 100,   poor: 300   },
  FCP:  { good: 1800,  poor: 3000  },
  LCP:  { good: 2500,  poor: 4000  },
  TTFB: { good: 800,   poor: 1800  },
};

/**
 * Returns a console style string based on the metric value vs. thresholds.
 */
function getRatingStyle(name, value) {
  const t = THRESHOLDS[name];
  if (!t) return 'color: #888';
  if (value <= t.good) return 'color: #27AE60; font-weight: bold';
  if (value <= t.poor) return 'color: #F39C12; font-weight: bold';
  return 'color: #E74C3C; font-weight: bold';
}

/**
 * Returns a human-readable rating label.
 */
function getRating(name, value) {
  const t = THRESHOLDS[name];
  if (!t) return '';
  if (value <= t.good) return 'GOOD';
  if (value <= t.poor) return 'NEEDS IMPROVEMENT';
  return 'POOR';
}

/**
 * Core Web Vitals reporter.
 *
 * Called automatically by Next.js (App Router) when exported from layout or
 * instrumentationHook, or manually via the Pages Router _app.js export.
 *
 * @param {import('next').NextWebVitalsMetric} metric
 */
export function reportWebVitals(metric) {
  const { name, value, id, label } = metric;
  const isDev = process.env.NODE_ENV === 'development';

  // Development: pretty-print to console
  if (isDev) {
    const displayValue = name === 'CLS' ? value.toFixed(4) : `${Math.round(value)} ms`;
    const rating = getRating(name, value);
    const style = getRatingStyle(name, value);
    const longName = VITAL_LABELS[name] ?? name;

    console.groupCollapsed(
      `%c[Web Vitals] ${name} — ${displayValue} (${rating})`,
      style
    );
    console.log('Metric :', longName);
    console.log('Value  :', displayValue);
    console.log('Rating :', rating);
    console.log('ID     :', id);
    console.log('Label  :', label);
    console.groupEnd();
    return;
  }

  // Production: POST to /api/vitals best-effort (fire-and-forget)
  const body = JSON.stringify({ name, value, id, label });

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    // sendBeacon works even when the page is unloading
    navigator.sendBeacon('/api/vitals', new Blob([body], { type: 'application/json' }));
  } else {
    // Fallback to fetch with keepalive
    fetch('/api/vitals', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {
      // Endpoint may not exist yet — swallow silently
    });
  }
}
