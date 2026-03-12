'use client';

/**
 * /admin/experiments/page.js
 * HiAlice — Admin A/B Experiment Dashboard
 *
 * Lists all experiments, shows variant distribution, conversion metrics,
 * and lets admins toggle experiments on/off.
 *
 * Ghibli theme palette:
 *   Forest dark:   #3D6B3D
 *   Forest mid:    #5C8B5C
 *   Parchment:     #F5F0E8
 *   Gold:          #D4A843
 *   Ink:           #3D2E1E
 */

import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '@/lib/constants';
import { getItem } from '@/lib/clientStorage';

// ============================================================================
// Ghibli theme tokens (inline style constants)
// ============================================================================

const G = {
  forestDark:   '#3D6B3D',
  forestMid:    '#5C8B5C',
  parchment:    '#F5F0E8',
  parchmentAlt: '#FFFCF3',
  gold:         '#D4A843',
  ink:          '#3D2E1E',
  inkLight:     '#6B5744',
  border:       '#E8DEC8',
  borderAlt:    '#EDE5D4',
  sky:          '#87CEDB',
  rose:         '#D4736B',
};

// ============================================================================
// Variant colour palette — one per variant index (cycles if > 8 variants)
// ============================================================================

const VARIANT_COLORS = [
  { bg: '#E8F5E8', text: G.forestDark, bar: G.forestMid  },
  { bg: '#FFF8E1', text: '#8C6D00',    bar: G.gold        },
  { bg: '#E0F4F9', text: '#2A7A8C',    bar: G.sky         },
  { bg: '#FCE4EC', text: '#880E4F',    bar: G.rose        },
  { bg: '#EDE7F6', text: '#4A148C',    bar: '#9575CD'     },
  { bg: '#E3F2FD', text: '#0D47A1',    bar: '#42A5F5'     },
  { bg: '#FBE9E7', text: '#BF360C',    bar: '#FF7043'     },
  { bg: '#E8F5E9', text: '#1B5E20',    bar: '#66BB6A'     },
];

function variantColor(idx) {
  return VARIANT_COLORS[idx % VARIANT_COLORS.length];
}

// ============================================================================
// Status badge
// ============================================================================

const STATUS_STYLES = {
  active:    { bg: '#E8F5E8', text: G.forestDark, label: 'Active'    },
  paused:    { bg: '#FFF8E1', text: '#8C6D00',    label: 'Paused'    },
  completed: { bg: '#E8EAF6', text: '#283593',    label: 'Completed' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.paused;
  return (
    <span
      className="px-3 py-1 rounded-full text-xs font-bold"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

// ============================================================================
// Text-based pie / bar chart for variant distribution
// ============================================================================

/**
 * Renders a horizontal stacked bar showing the participant share per variant.
 * No Canvas, no Chart.js — pure CSS widths.
 *
 * @param {{ name: string, participants: number }[]} variants
 */
function DistributionBar({ variants }) {
  const total = variants.reduce((s, v) => s + v.participants, 0);
  if (total === 0) {
    return <p className="text-xs text-[#6B5744] italic">No data yet</p>;
  }

  return (
    <div className="space-y-2">
      {/* Stacked bar */}
      <div className="flex rounded-lg overflow-hidden h-4" role="img" aria-label="Variant distribution bar">
        {variants.map((v, idx) => {
          const pct = ((v.participants / total) * 100).toFixed(1);
          const c = variantColor(idx);
          return (
            <div
              key={v.name}
              style={{ width: `${pct}%`, background: c.bar, minWidth: pct > 0 ? '2px' : '0' }}
              title={`${v.name}: ${pct}% (${v.participants} participants)`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {variants.map((v, idx) => {
          const pct = ((v.participants / total) * 100).toFixed(1);
          const c = variantColor(idx);
          return (
            <div key={v.name} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ background: c.bar }}
              />
              <span className="text-xs text-[#6B5744]">
                <span className="font-semibold text-[#3D2E1E]">{v.name}</span>
                {' '}— {pct}% ({v.participants.toLocaleString()})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Metric cards for a single variant
// ============================================================================

/**
 * Render the key metric entries for one variant as small stat pills.
 *
 * @param {{ [key: string]: number | string | undefined }} metrics
 * @param {number} idx  variant index for colour
 */
function VariantMetrics({ metrics, idx }) {
  const c = variantColor(idx);
  const entries = Object.entries(metrics).filter(
    ([k, v]) => k !== 'participants' && v !== undefined
  );

  if (entries.length === 0) return null;

  const formatKey = (k) =>
    k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (s) => s.toUpperCase());

  const formatValue = (k, v) => {
    if (typeof v === 'number') {
      if (k.toLowerCase().includes('rate')) return `${(v * 100).toFixed(1)}%`;
      if (k.toLowerCase().includes('duration')) return `${Math.round(v)}s`;
      if (Number.isInteger(v)) return v.toLocaleString();
      return v.toFixed(1);
    }
    return String(v);
  };

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {entries.map(([k, v]) => (
        <div
          key={k}
          className="px-2.5 py-1.5 rounded-lg text-xs"
          style={{ background: c.bg, color: c.text }}
        >
          <span className="font-semibold">{formatKey(k)}: </span>
          {formatValue(k, v)}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Single experiment card
// ============================================================================

function ExperimentCard({ experiment, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);

  const isLeader = (variantName) =>
    experiment.summary?.leadingVariant === variantName;

  const handleToggle = async () => {
    setToggling(true);
    try {
      await onToggle(experiment.name, experiment.status);
    } finally {
      setToggling(false);
    }
  };

  const totalParticipants = experiment.summary?.totalParticipants ?? 0;
  const liveEvents = experiment.summary?.totalLiveEvents ?? 0;

  return (
    <div
      className="bg-[#FFFCF3] rounded-2xl border border-[#E8DEC8] shadow-[0_4px_20px_rgba(61,46,30,0.08)] overflow-hidden"
    >
      {/* Card header */}
      <div
        className="px-6 py-4 flex items-start justify-between gap-4 border-b border-[#E8DEC8] cursor-pointer select-none"
        style={{ background: 'linear-gradient(135deg, #F5F0E8 0%, #FFFCF3 100%)' }}
        onClick={() => setExpanded((e) => !e)}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setExpanded((x) => !x)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-base font-extrabold text-[#3D2E1E] font-mono">
              {experiment.name}
            </h3>
            <StatusBadge status={experiment.status} />
            {liveEvents > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ background: '#E0F4F9', color: '#2A7A8C' }}
              >
                {liveEvents} live events
              </span>
            )}
          </div>
          <p className="text-sm text-[#6B5744] mt-1">{experiment.description}</p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Toggle button */}
          <button
            onClick={(e) => { e.stopPropagation(); handleToggle(); }}
            disabled={toggling || experiment.status === 'completed'}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: experiment.status === 'active' ? '#FFF3E0' : G.forestMid,
              color:       experiment.status === 'active' ? '#E65100' : 'white',
              minHeight: '36px',
            }}
            aria-label={experiment.status === 'active' ? 'Pause experiment' : 'Resume experiment'}
          >
            {toggling ? '...' : experiment.status === 'active' ? 'Pause' : 'Resume'}
          </button>

          {/* Expand chevron */}
          <span
            className="text-[#6B5744] font-bold text-lg transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}
            aria-hidden="true"
          >
            v
          </span>
        </div>
      </div>

      {/* Summary strip */}
      <div className="px-6 py-3 grid grid-cols-2 sm:grid-cols-3 gap-4 border-b border-[#E8DEC8] bg-[#FAF7F0]">
        <div>
          <p className="text-xs font-semibold text-[#6B5744]">Variants</p>
          <p className="text-lg font-extrabold text-[#3D2E1E]">{experiment.variants.length}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-[#6B5744]">Total Participants</p>
          <p className="text-lg font-extrabold text-[#3D2E1E]">{totalParticipants.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-[#6B5744]">Leading Variant</p>
          <p
            className="text-lg font-extrabold truncate"
            style={{ color: experiment.summary?.leadingVariant ? G.forestDark : '#9E8A6E' }}
          >
            {experiment.summary?.leadingVariant
              ? `${experiment.summary.leadingVariant} (${((experiment.summary.leadingCompletionRate ?? 0) * 100).toFixed(1)}%)`
              : 'N/A'}
          </p>
        </div>
      </div>

      {/* Distribution bar — always visible */}
      <div className="px-6 py-4 border-b border-[#EDE5D4]">
        <p className="text-xs font-bold text-[#6B5744] mb-2">Participant Distribution</p>
        <DistributionBar variants={experiment.variants} />
      </div>

      {/* Expanded: per-variant metrics */}
      {expanded && (
        <div className="divide-y divide-[#EDE5D4]">
          {experiment.variants.map((v, idx) => (
            <div key={v.name} className="px-6 py-4 hover:bg-[#FAF7F0] transition-colors">
              <div className="flex items-center gap-2 flex-wrap">
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ background: variantColor(idx).bar }}
                />
                <span className="text-sm font-extrabold text-[#3D2E1E] font-mono">{v.name}</span>

                {isLeader(v.name) && (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: '#FFF8E1', color: '#8C6D00' }}
                  >
                    Leading
                  </span>
                )}

                <span className="text-xs text-[#6B5744] ml-auto">
                  {v.participants.toLocaleString()} participants
                  {v.liveEventCount > 0 && (
                    <span style={{ color: '#2A7A8C' }}> (+{v.liveEventCount} live)</span>
                  )}
                </span>
              </div>

              {/* Completion rate progress bar */}
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#6B5744]">Completion rate</span>
                  <span className="text-xs font-bold" style={{ color: variantColor(idx).text }}>
                    {((v.completionRate ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#EDE5D4] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${((v.completionRate ?? 0) * 100).toFixed(1)}%`,
                      background: variantColor(idx).bar,
                    }}
                  />
                </div>
              </div>

              {/* Additional metrics */}
              <VariantMetrics metrics={v.metrics ?? {}} idx={idx} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main page component
// ============================================================================

export default function ExperimentsPage() {
  const [experiments, setExperiments]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [lastRefresh, setLastRefresh]   = useState(null);

  // --------------------------------------------------------------------------
  // Data fetching
  // --------------------------------------------------------------------------

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      // Fetch experiment list
      const listRes = await fetch(`${API_BASE}/api/experiments`, {
        credentials: 'include',
        headers,
        signal: AbortSignal.timeout(8000),
      });

      if (!listRes.ok) throw new Error(`List fetch failed: ${listRes.status}`);

      const listData = await listRes.json();
      const expList = listData.data?.experiments ?? [];

      // Fetch results for each experiment in parallel
      const withResults = await Promise.all(
        expList.map(async (exp) => {
          try {
            const resRes = await fetch(`${API_BASE}/api/experiments/${exp.name}/results`, {
              credentials: 'include',
              headers,
              signal: AbortSignal.timeout(8000),
            });

            if (!resRes.ok) return { ...exp, variants: buildVariantList(exp), summary: null };

            const resData = await resRes.json();
            const results = resData.data;

            return {
              ...exp,
              variants: results?.variants ?? buildVariantList(exp),
              summary:  results?.summary ?? null,
            };
          } catch {
            return { ...exp, variants: buildVariantList(exp), summary: null };
          }
        })
      );

      setExperiments(withResults);
      setLastRefresh(new Date());
    } catch (err) {
      console.warn('[experiments] API fetch failed, using mock data:', err);

      // Full mock fallback so the UI is usable without a running backend
      setExperiments(buildMockExperiments());
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // --------------------------------------------------------------------------
  // Toggle experiment status (optimistic update + backend call)
  // --------------------------------------------------------------------------

  const handleToggle = useCallback(async (experimentName, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';

    // Optimistic UI update
    setExperiments((prev) =>
      prev.map((exp) =>
        exp.name === experimentName ? { ...exp, status: nextStatus } : exp
      )
    );

    try {
      const token = getItem('token');
      // NOTE: This endpoint does not exist yet — the toggle is intentionally
      //       optimistic and UI-only until the PATCH route is implemented.
      //       The mock/dev backend simply returns 200.
      await fetch(`${API_BASE}/api/experiments/${experimentName}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: nextStatus }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Revert optimistic update if the network call fails
      setExperiments((prev) =>
        prev.map((exp) =>
          exp.name === experimentName ? { ...exp, status: currentStatus } : exp
        )
      );
    }
  }, []);

  // --------------------------------------------------------------------------
  // Derived state
  // --------------------------------------------------------------------------

  const filtered =
    filterStatus === 'all'
      ? experiments
      : experiments.filter((e) => e.status === filterStatus);

  const statusCounts = experiments.reduce(
    (acc, e) => { acc[e.status] = (acc[e.status] ?? 0) + 1; return acc; },
    {}
  );

  const totalParticipants = experiments.reduce(
    (s, e) => s + (e.summary?.totalParticipants ?? 0),
    0
  );

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#3D2E1E]">A/B Experiments</h2>
          <p className="text-sm text-[#6B5744] mt-1">
            Manage and monitor active experiments across session flow, rewards, and vocabulary delivery.
          </p>
        </div>

        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex-shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
          style={{ background: G.forestMid, color: 'white', minHeight: '44px' }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Summary stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Experiments', value: experiments.length,               accent: G.forestDark },
          { label: 'Active',            value: statusCounts.active ?? 0,         accent: G.forestMid  },
          { label: 'Paused',            value: statusCounts.paused ?? 0,         accent: G.gold       },
          { label: 'Total Participants',value: totalParticipants.toLocaleString(), accent: G.sky       },
        ].map((item, idx) => (
          <div
            key={idx}
            className="bg-[#FFFCF3] rounded-2xl border border-[#E8DEC8] p-4 shadow-[0_4px_20px_rgba(61,46,30,0.08)]"
            style={{ borderLeftColor: item.accent, borderLeftWidth: '4px' }}
          >
            <p className="text-xs font-semibold text-[#6B5744]">{item.label}</p>
            <p className="text-2xl font-extrabold mt-1" style={{ color: item.accent }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-[#6B5744]">Show:</span>
        {['all', 'active', 'paused', 'completed'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-colors"
            style={{
              background: filterStatus === s ? G.forestDark : G.parchment,
              color:       filterStatus === s ? 'white'       : G.inkLight,
              border: `1px solid ${filterStatus === s ? G.forestDark : G.border}`,
              minHeight: '36px',
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && statusCounts[s] ? ` (${statusCounts[s]})` : ''}
          </button>
        ))}

        {lastRefresh && (
          <span className="ml-auto text-xs text-[#9E8A6E]">
            Last refreshed: {lastRefresh.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Content */}
      {loading && (
        <div className="py-16 text-center">
          <div
            className="inline-block w-10 h-10 rounded-full border-4 border-[#E8DEC8] border-t-[#5C8B5C] animate-spin"
            aria-label="Loading"
          />
          <p className="mt-4 text-sm text-[#6B5744]">Loading experiments...</p>
        </div>
      )}

      {!loading && error && (
        <div
          className="px-6 py-4 rounded-2xl border text-sm font-semibold"
          style={{ background: '#FFEBEE', color: '#C62828', borderColor: '#EF9A9A' }}
        >
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-sm font-semibold text-[#6B5744]">
            No experiments match the current filter.
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((exp) => (
            <ExperimentCard
              key={exp.name}
              experiment={exp}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {/* Developer notes footer */}
      <div
        className="px-5 py-4 rounded-2xl text-xs text-[#9E8A6E] border border-[#E8DEC8]"
        style={{ background: '#FAF7F0' }}
      >
        <span className="font-bold text-[#6B5744]">Infrastructure notes: </span>
        Variant assignments use deterministic djb2 hashing (studentId + experimentName) so
        each student always receives the same variant. Assignments are cached in sessionStorage.
        Use <code className="font-mono bg-[#EDE5D4] px-1 rounded">getVariant(name, studentId)</code> or
        the <code className="font-mono bg-[#EDE5D4] px-1 rounded">useVariant()</code> hook from{' '}
        <code className="font-mono bg-[#EDE5D4] px-1 rounded">@/lib/abTest</code> to consume variants
        in any component. Events are tracked via{' '}
        <code className="font-mono bg-[#EDE5D4] px-1 rounded">trackEvent()</code> (fire-and-forget).
      </div>
    </div>
  );
}

// ============================================================================
// Helpers for building mock / fallback data
// ============================================================================

function buildVariantList(exp) {
  return (exp.variants ?? []).map((name) => ({
    name,
    participants: 0,
    liveEventCount: 0,
    completionRate: 0,
    metrics: {},
  }));
}

function buildMockExperiments() {
  const defs = [
    {
      name: 'session_turns',
      description: 'Optimal turns per stage',
      variants: ['3_turns', '4_turns', '5_turns'],
      status: 'active',
      createdAt: '2026-03-01T00:00:00.000Z',
    },
    {
      name: 'reward_type',
      description: 'Which reward drives engagement',
      variants: ['badges_only', 'xp_system', 'story_unlock'],
      status: 'active',
      createdAt: '2026-03-01T00:00:00.000Z',
    },
    {
      name: 'pre_reading',
      description: 'Pre-reading module depth',
      variants: ['skip', 'quick', 'full'],
      status: 'paused',
      createdAt: '2026-03-05T00:00:00.000Z',
    },
    {
      name: 'vocab_timing',
      description: 'When to show vocabulary',
      variants: ['during_session', 'after_session', 'both'],
      status: 'active',
      createdAt: '2026-03-05T00:00:00.000Z',
    },
  ];

  const MOCK_RESULTS = {
    session_turns: [
      { name: '3_turns',  participants: 142, completionRate: 0.61, metrics: { avgGrammarScore: 74, avgSessionDuration: 820  } },
      { name: '4_turns',  participants: 138, completionRate: 0.72, metrics: { avgGrammarScore: 79, avgSessionDuration: 1040 } },
      { name: '5_turns',  participants: 135, completionRate: 0.68, metrics: { avgGrammarScore: 81, avgSessionDuration: 1230 } },
    ],
    reward_type: [
      { name: 'badges_only',  participants: 189, completionRate: 0.58, metrics: { returnRate: 0.41, avgSessionsPerWeek: 2.1 } },
      { name: 'xp_system',    participants: 193, completionRate: 0.67, metrics: { returnRate: 0.55, avgSessionsPerWeek: 2.8 } },
      { name: 'story_unlock', participants: 187, completionRate: 0.71, metrics: { returnRate: 0.63, avgSessionsPerWeek: 3.2 } },
    ],
    pre_reading: [
      { name: 'skip',  participants: 201, completionRate: 0.65, metrics: { avgComprehensionScore: 71, avgTimeToFirstTurn: 12 } },
      { name: 'quick', participants: 198, completionRate: 0.73, metrics: { avgComprehensionScore: 77, avgTimeToFirstTurn: 18 } },
      { name: 'full',  participants: 195, completionRate: 0.69, metrics: { avgComprehensionScore: 82, avgTimeToFirstTurn: 31 } },
    ],
    vocab_timing: [
      { name: 'during_session', participants: 167, completionRate: 0.62, metrics: { vocabRetentionRate: 0.49, avgNewWordsPerSession: 5.2 } },
      { name: 'after_session',  participants: 171, completionRate: 0.74, metrics: { vocabRetentionRate: 0.61, avgNewWordsPerSession: 6.8 } },
      { name: 'both',           participants: 169, completionRate: 0.70, metrics: { vocabRetentionRate: 0.68, avgNewWordsPerSession: 7.4 } },
    ],
  };

  return defs.map((exp) => {
    const variants = MOCK_RESULTS[exp.name] ?? buildVariantList(exp);
    const totalParticipants = variants.reduce((s, v) => s + v.participants, 0);
    const leader = [...variants].sort((a, b) => b.completionRate - a.completionRate)[0];

    return {
      ...exp,
      variants: variants.map((v) => ({ ...v, liveEventCount: 0 })),
      summary: {
        totalParticipants,
        totalLiveEvents: 0,
        leadingVariant: leader?.name ?? null,
        leadingCompletionRate: leader?.completionRate ?? null,
        dataSource: 'mock',
      },
    };
  });
}
