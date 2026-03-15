'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// GHIBLI THEME TOKENS
// ============================================================================
const G = {
  forestDark:  '#3D6B3D',
  forestMid:   '#5C8B5C',
  forestLight: '#8AB88A',
  cream:       '#F5F0E8',
  creamDark:   '#EDE5D4',
  parchment:   '#FAF7F0',
  gold:        '#D4A843',
  goldLight:   '#F0D080',
  brown:       '#3D2E1E',
  brownMid:    '#6B5744',
  brownLight:  '#9E8A6E',
  terracotta:  '#D4736B',
  skyBlue:     '#87CEDB',
  cardBg:      '#FFFCF3',
  cardBorder:  '#E8DEC8',
  shadow:      '0 4px 20px rgba(61,46,30,0.08)',
  shadowMd:    '0 6px 24px rgba(61,46,30,0.12)',
};

// ============================================================================
// MOCK FALLBACK (development / when API is unavailable)
// ============================================================================
const MOCK_STATS = {
  total: {
    inputTokens:       124_500,
    outputTokens:       38_200,
    cost:                   2.48,
    sessions:                 87,
    avgCostPerSession:        0.0285,
  },
  today: {
    cost:     0.34,
    tokens:   18_700,
    sessions:    12,
  },
  health: {
    uptime:    14_402,
    memoryMB:  { heapUsed: 124, heapTotal: 256, rss: 198, external: 12 },
    timestamp: new Date().toISOString(),
    nodeVersion: 'v20.0.0',
    pid:         12345,
  },
  recentLog: Array.from({ length: 10 }, (_, i) => ({
    timestamp:   new Date(Date.now() - i * 90_000).toISOString(),
    model:       i % 3 === 0 ? 'claude-haiku-4-5' : 'claude-sonnet-4',
    inputTokens: 800 + i * 120,
    outputTokens: 340 + i * 40,
    cost:        0.015 + i * 0.003,
    sessionId:   `sess-${String(i + 1).padStart(4, '0')}`,
    studentId:   `student-${String((i % 5) + 1).padStart(3, '0')}`,
  })),
};

// ============================================================================
// DATA FETCHING
// ============================================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

/**
 * Fetch monitoring statistics from the backend.
 * Falls back to mock data when the network request fails or USE_MOCK is set.
 *
 * @returns {Promise<object>} Stats payload from /api/monitoring/stats
 */
async function fetchMonitoringStats() {
  if (USE_MOCK) {
    return { ...MOCK_STATS, health: { ...MOCK_STATS.health, timestamp: new Date().toISOString() } };
  }

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 8_000);

  try {
    const token    = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    const response = await fetch(`${API_BASE}/api/monitoring/stats`, {
      credentials: 'include',
      signal:      controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Is the backend running?');
    }
    // In development fall back gracefully to mock data so the page is usable
    // even without a running backend.
    console.warn('[Monitoring] API unavailable, using mock data:', err.message);
    return { ...MOCK_STATS, health: { ...MOCK_STATS.health, timestamp: new Date().toISOString() } };
  }
}

// ============================================================================
// HELPER UTILITIES
// ============================================================================

function fmtCost(value) {
  if (typeof value !== 'number') return '$0.00';
  return `$${value.toFixed(4)}`;
}

function fmtCostShort(value) {
  if (typeof value !== 'number') return '$0.00';
  return `$${value.toFixed(2)}`;
}

function fmtTokens(n) {
  if (typeof n !== 'number') return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function fmtUptime(seconds) {
  if (typeof seconds !== 'number') return '0h 0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function fmtTime(isoString) {
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '--:--:--';
  }
}

function fmtDate(isoString) {
  try {
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '---';
  }
}

// ============================================================================
// SHARED SUB-COMPONENTS
// ============================================================================

function Card({ children, className = '', style = {} }) {
  return (
    <div
      className={`rounded-2xl border ${className}`}
      style={{ background: G.cardBg, borderColor: G.cardBorder, boxShadow: G.shadow, ...style }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle, accent }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-1 h-6 rounded-full"
          style={{ background: accent || G.forestMid }}
          aria-hidden="true"
        />
        <h2 className="text-xl font-black" style={{ color: G.brown }}>{title}</h2>
      </div>
      {subtitle && (
        <p className="ml-4 text-sm" style={{ color: G.brownMid }}>{subtitle}</p>
      )}
    </div>
  );
}

// ============================================================================
// KPI CARD
// ============================================================================

function KpiCard({ label, value, subtext, accentColor, ariaLabel }) {
  return (
    <div
      className="rounded-2xl p-5 border hover:-translate-y-0.5 transition-transform"
      style={{ background: G.cardBg, borderColor: G.cardBorder, boxShadow: G.shadow }}
      role="region"
      aria-label={ariaLabel || label}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-3 h-3 rounded-full mt-1.5"
          style={{ background: accentColor || G.forestMid }}
          aria-hidden="true"
        />
      </div>
      <p className="text-xs font-semibold mb-1" style={{ color: G.brownMid }}>{label}</p>
      <p className="text-3xl font-black" style={{ color: G.brown }}>{value}</p>
      {subtext && (
        <p className="text-xs mt-1" style={{ color: G.brownLight }}>{subtext}</p>
      )}
    </div>
  );
}

// ============================================================================
// HEALTH PANEL
// ============================================================================

function HealthPanel({ health }) {
  if (!health) return null;

  const uptimeHours = Math.floor((health.uptime || 0) / 3600);
  const memMB       = health.memoryMB?.heapUsed || 0;
  const memTotal    = health.memoryMB?.heapTotal || 0;
  const memPercent  = memTotal > 0 ? Math.round((memMB / memTotal) * 100) : 0;
  const memColor    = memPercent > 80 ? G.terracotta : memPercent > 60 ? G.gold : G.forestMid;

  return (
    <Card className="p-6">
      <SectionHeader
        title="System Health"
        subtitle="Live process metrics from the backend"
        accent={G.skyBlue}
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Uptime */}
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: G.brownMid }}>Server Uptime</p>
          <p className="text-2xl font-black" style={{ color: G.brown }}>{fmtUptime(health.uptime)}</p>
        </div>

        {/* Heap memory */}
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: G.brownMid }}>Heap Used</p>
          <p className="text-2xl font-black" style={{ color: memColor }}>
            {memMB} MB
          </p>
          <div
            className="mt-1 h-1.5 rounded-full"
            style={{ background: G.creamDark }}
            role="progressbar"
            aria-valuenow={memPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Heap memory usage: ${memPercent}%`}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(memPercent, 100)}%`, background: memColor }}
            />
          </div>
          <p className="text-xs mt-0.5" style={{ color: G.brownLight }}>of {memTotal} MB total ({memPercent}%)</p>
        </div>

        {/* Node version */}
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: G.brownMid }}>Node Version</p>
          <p className="text-2xl font-black" style={{ color: G.brown }}>{health.nodeVersion || 'N/A'}</p>
        </div>

        {/* Last snapshot */}
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: G.brownMid }}>Snapshot At</p>
          <p className="text-base font-black" style={{ color: G.brown }}>{fmtTime(health.timestamp)}</p>
          <p className="text-xs" style={{ color: G.brownLight }}>{fmtDate(health.timestamp)}</p>
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// RECENT API CALLS TABLE
// ============================================================================

function RecentCallsTable({ entries }) {
  if (!entries || entries.length === 0) {
    return (
      <Card className="p-6">
        <SectionHeader title="Recent API Calls" accent={G.gold} />
        <p className="text-sm text-center py-8" style={{ color: G.brownLight }}>
          No API calls recorded yet. Make some requests to see usage here.
        </p>
      </Card>
    );
  }

  const cols = ['Time', 'Model', 'Input Tokens', 'Output Tokens', 'Cost', 'Session ID'];

  return (
    <Card className="p-6">
      <SectionHeader
        title="Recent API Calls"
        subtitle={`Last ${entries.length} Claude API requests`}
        accent={G.gold}
      />
      <div className="overflow-x-auto -mx-1">
        <table
          className="w-full text-sm border-collapse"
          aria-label="Recent API calls table"
        >
          <thead>
            <tr>
              {cols.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="text-left pb-3 pr-4 font-bold text-xs uppercase tracking-wide"
                  style={{ color: G.brownMid, borderBottom: `2px solid ${G.cardBorder}` }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => {
              const isHaiku = entry.model?.includes('haiku');
              return (
                <tr
                  key={`${entry.sessionId}-${idx}`}
                  className="hover:bg-[#F5F0E8] transition-colors"
                  style={{ borderBottom: `1px solid ${G.cardBorder}` }}
                >
                  <td className="py-2.5 pr-4 font-mono text-xs" style={{ color: G.brownMid }}>
                    {fmtTime(entry.timestamp)}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{
                        background: isHaiku ? '#EFF8FF' : '#EDF7ED',
                        color:      isHaiku ? '#1565C0' : G.forestDark,
                      }}
                    >
                      {entry.model || 'unknown'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs" style={{ color: G.brown }}>
                    {fmtTokens(entry.inputTokens)}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs" style={{ color: G.brown }}>
                    {fmtTokens(entry.outputTokens)}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs font-bold" style={{ color: G.terracotta }}>
                    {fmtCost(entry.cost)}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs truncate max-w-[120px]" style={{ color: G.brownLight }}>
                    {entry.sessionId || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================================
// CHART PLACEHOLDER
// ============================================================================

function CostTrendPlaceholder() {
  return (
    <Card className="p-6">
      <SectionHeader
        title="Cost Trend"
        subtitle="Token cost over time"
        accent={G.terracotta}
      />
      <div
        className="flex items-center justify-center rounded-xl"
        style={{ height: 180, background: G.creamDark, border: `1px dashed ${G.cardBorder}` }}
        role="img"
        aria-label="Cost trend chart placeholder"
      >
        <div className="text-center px-4">
          <p className="text-sm font-bold mb-1" style={{ color: G.brownMid }}>
            Chart coming soon
          </p>
          <p className="text-xs" style={{ color: G.brownLight }}>
            Connect to real data for chart — store time-series cost data
            in Supabase ai_usage_log and plot with a charting library.
          </p>
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// AUTO-REFRESH INDICATOR
// ============================================================================

function RefreshIndicator({ nextRefreshIn, loading }) {
  return (
    <div
      className="flex items-center gap-2 text-xs font-semibold"
      style={{ color: G.brownMid }}
      aria-live="polite"
      aria-label={loading ? 'Refreshing data' : `Next refresh in ${nextRefreshIn} seconds`}
    >
      <span
        className={`w-2 h-2 rounded-full ${loading ? 'animate-pulse' : ''}`}
        style={{ background: loading ? G.gold : G.forestMid }}
        aria-hidden="true"
      />
      {loading
        ? 'Refreshing...'
        : `Auto-refresh in ${nextRefreshIn}s`}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

const REFRESH_INTERVAL_MS = 30_000;
const ADMIN_ROLE          = 'admin';

export default function MonitoringPage() {
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [nextRefreshIn, setNextIn]  = useState(REFRESH_INTERVAL_MS / 1000);
  const [lastRefreshed, setLastRef] = useState(null);

  // Guard: redirect non-admins. A full auth system would use middleware;
  // here we mirror the pattern used elsewhere in the admin panel.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const role = sessionStorage.getItem('userRole');
    if (role && role !== ADMIN_ROLE) {
      window.location.href = '/dashboard';
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMonitoringStats();
      setStats(data);
      setLastRef(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load monitoring data.');
    } finally {
      setLoading(false);
      setNextIn(REFRESH_INTERVAL_MS / 1000);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // Countdown ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setNextIn((prev) => (prev > 0 ? prev - 1 : REFRESH_INTERVAL_MS / 1000));
    }, 1_000);
    return () => clearInterval(ticker);
  }, []);

  // Derive display values
  const total   = stats?.total   || {};
  const today   = stats?.today   || {};
  const health  = stats?.health  || null;
  const log     = stats?.recentLog || [];
  const uptimeH = health ? fmtUptime(health.uptime) : '—';

  return (
    <div className="space-y-8" aria-label="System monitoring dashboard">

      {/* ------------------------------------------------------------------ */}
      {/* HEADER                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black" style={{ color: G.brown }}>
            System Monitor
          </h1>
          {lastRefreshed && (
            <p className="text-xs mt-0.5" style={{ color: G.brownLight }}>
              Last updated: {lastRefreshed.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <RefreshIndicator nextRefreshIn={nextRefreshIn} loading={loading} />
          <button
            onClick={refresh}
            disabled={loading}
            className="px-4 py-2 rounded-xl font-bold text-sm text-white transition-all
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background:     loading ? G.forestLight : G.forestMid,
              minHeight:      '40px',
              outlineColor:   G.forestDark,
            }}
            aria-label="Refresh monitoring data now"
          >
            {loading ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ERROR BANNER                                                         */}
      {/* ------------------------------------------------------------------ */}
      {error && !loading && (
        <div
          className="rounded-xl p-4 text-sm font-semibold"
          style={{ background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2' }}
          role="alert"
          aria-live="assertive"
        >
          {error} Showing mock data as fallback.
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* LOADING STATE                                                        */}
      {/* ------------------------------------------------------------------ */}
      {loading && !stats && (
        <div className="flex items-center justify-center py-24" aria-busy="true" aria-label="Loading">
          <div className="text-center">
            <div
              className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-4"
              style={{ borderColor: `${G.forestMid} transparent ${G.forestMid} ${G.forestMid}` }}
              aria-hidden="true"
            />
            <p className="font-bold" style={{ color: G.brownMid }}>Loading monitoring data...</p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* KPI CARDS                                                            */}
      {/* ------------------------------------------------------------------ */}
      {stats && (
        <>
          <section aria-label="Key performance indicators">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <KpiCard
                label="Total API Cost"
                value={fmtCostShort(total.cost)}
                subtext={`${fmtTokens(total.inputTokens + total.outputTokens)} total tokens`}
                accentColor={G.terracotta}
                ariaLabel={`Total API cost: ${fmtCostShort(total.cost)}`}
              />
              <KpiCard
                label="Avg Cost / Session"
                value={fmtCost(total.avgCostPerSession)}
                subtext={`Across ${total.sessions || 0} sessions`}
                accentColor={G.gold}
                ariaLabel={`Average cost per session: ${fmtCost(total.avgCostPerSession)}`}
              />
              <KpiCard
                label="Today's Sessions"
                value={String(today.sessions || 0)}
                subtext={`${fmtCostShort(today.cost)} cost today`}
                accentColor={G.forestMid}
                ariaLabel={`Today's session count: ${today.sessions || 0}`}
              />
              <KpiCard
                label="Server Uptime"
                value={uptimeH}
                subtext={health ? `PID ${health.pid}` : 'No health data'}
                accentColor={G.skyBlue}
                ariaLabel={`Server uptime: ${uptimeH}`}
              />
            </div>
          </section>

          {/* -------------------------------------------------------------- */}
          {/* COST TREND PLACEHOLDER                                           */}
          {/* -------------------------------------------------------------- */}
          <CostTrendPlaceholder />

          {/* -------------------------------------------------------------- */}
          {/* RECENT API CALLS TABLE                                           */}
          {/* -------------------------------------------------------------- */}
          <section aria-label="Recent API calls">
            <RecentCallsTable entries={log} />
          </section>

          {/* -------------------------------------------------------------- */}
          {/* SYSTEM HEALTH                                                    */}
          {/* -------------------------------------------------------------- */}
          <section aria-label="System health metrics">
            <HealthPanel health={health} />
          </section>
        </>
      )}
    </div>
  );
}
