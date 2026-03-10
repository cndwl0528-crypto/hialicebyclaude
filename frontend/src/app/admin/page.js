'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const NAV_LINKS = [
  { href: '/admin/students', label: 'Students', icon: '👨‍🎓' },
  { href: '/admin/books', label: 'Books', icon: '📚' },
  { href: '/admin/reports', label: 'Reports', icon: '📈' },
  { href: '/admin/prompts', label: 'AI Prompts', icon: '🤖' },
];

const LEVEL_CONFIG = {
  beginner: {
    label: 'Beginner',
    bg: '#C8E6C9',
    text: '#2E7D32',
    barColor: '#4CAF50',
    icon: '🌱',
  },
  intermediate: {
    label: 'Intermediate',
    bg: '#FFE0B2',
    text: '#E65100',
    barColor: '#FF9800',
    icon: '🌿',
  },
  advanced: {
    label: 'Advanced',
    bg: '#E1BEE7',
    text: '#6A1B9A',
    barColor: '#9C27B0',
    icon: '🌳',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeDate(dateString) {
  if (!dateString) return '—';
  const diff = Date.now() - new Date(dateString).getTime();
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

function grammarScoreStyle(score) {
  if (score === null || score === undefined) return { bg: '#EDE5D4', text: '#9B8777' };
  if (score >= 85) return { bg: '#C8E6C9', text: '#2E7D32' };
  if (score >= 70) return { bg: '#FFF8E1', text: '#8C6D00' };
  return { bg: '#FFEBEE', text: '#C62828' };
}

// ---------------------------------------------------------------------------
// Skeleton sub-components
// ---------------------------------------------------------------------------

function SkeletonPulse({ className = '' }) {
  return (
    <div
      className={`rounded animate-pulse bg-gradient-to-r from-[#E8DEC8] via-[#F0EAD8] to-[#E8DEC8] ${className}`}
      style={{ backgroundSize: '200% 100%' }}
    />
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-[#FFFCF3] rounded-2xl shadow-ghibli p-6 border border-[#E8DEC8] border-l-4 border-l-[#D6C9A8]">
      <div className="flex items-center justify-between">
        <div className="space-y-3 flex-1">
          <SkeletonPulse className="h-3.5 w-28" />
          <SkeletonPulse className="h-8 w-16" />
        </div>
        <SkeletonPulse className="w-10 h-10 rounded-full" />
      </div>
    </div>
  );
}

function ChartSkeleton({ height = 'h-48' }) {
  return (
    <div className={`flex items-end justify-around gap-2 ${height}`}>
      {[60, 80, 45, 95, 70, 55, 85].map((pct, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <SkeletonPulse className="w-full rounded-t" style={{ height: `${pct}%` }} />
          <SkeletonPulse className="h-3 w-6" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 7 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3 px-4 border-b border-[#EDE5D4]">
          <SkeletonPulse className="h-4 w-20 shrink-0" />
          <SkeletonPulse className="h-4 flex-1" />
          <SkeletonPulse className="h-4 w-16 shrink-0" />
          <SkeletonPulse className="h-4 w-16 shrink-0" />
          <SkeletonPulse className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top Navigation Bar
// ---------------------------------------------------------------------------

function TopBar() {
  return (
    <header className="bg-[#D6C9A8] border-b border-[#C4B49A] shadow-[0_2px_12px_rgba(61,46,30,0.10)] sticky top-0 z-30">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-2xl animate-leaf-sway">🌿</span>
          <span className="font-extrabold text-[#3D2E1E] text-lg leading-none">
            HiAlice
            <span className="ml-1.5 text-[#6B5744] text-sm font-semibold">Admin</span>
          </span>
        </div>

        {/* Navigation links */}
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[#3D2E1E] font-bold text-sm
                         hover:bg-[#C4B49A] transition-colors whitespace-nowrap"
              style={{ minHeight: '44px' }}
            >
              <span>{link.icon}</span>
              <span className="hidden sm:inline">{link.label}</span>
            </Link>
          ))}
        </nav>

        {/* Back to app */}
        <Link
          href="/"
          className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-[#6B5744] font-semibold text-sm
                     hover:bg-[#C4B49A] transition-colors shrink-0 whitespace-nowrap"
          style={{ minHeight: '44px' }}
        >
          ← App
        </Link>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({ label, value, icon, accentColor, loading }) {
  return (
    <div
      className="bg-[#FFFCF3] rounded-2xl shadow-ghibli p-6 border border-[#E8DEC8] border-l-4
                 hover:-translate-y-0.5 transition-transform"
      style={{ borderLeftColor: accentColor }}
    >
      {loading ? (
        <div className="flex items-center justify-between">
          <div className="space-y-3 flex-1">
            <SkeletonPulse className="h-3.5 w-28" />
            <SkeletonPulse className="h-8 w-16" />
          </div>
          <SkeletonPulse className="w-10 h-10 rounded-full shrink-0" />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[#6B5744] text-xs font-bold uppercase tracking-wide">{label}</p>
            <p className="text-3xl font-extrabold text-[#3D2E1E] mt-1.5">{value ?? '—'}</p>
          </div>
          <span className="text-4xl shrink-0" aria-hidden="true">{icon}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sessions Per Week Bar Chart (pure CSS)
// ---------------------------------------------------------------------------

function SessionsBarChart({ data, loading }) {
  const weeks = data ?? [0, 0, 0, 0];
  const max = Math.max(...weeks, 1);
  const labels = ['3w ago', '2w ago', 'Last wk', 'This wk'];

  return (
    <div className="bg-[#FFFCF3] rounded-2xl shadow-ghibli p-6 border border-[#E8DEC8]">
      <h3 className="text-base font-extrabold text-[#3D2E1E] mb-5">Sessions per Week</h3>
      {loading ? (
        <ChartSkeleton height="h-44" />
      ) : (
        <div className="flex items-end justify-around gap-3 h-44" role="img" aria-label="Sessions per week bar chart">
          {weeks.map((count, idx) => {
            const heightPct = Math.max((count / max) * 100, 4);
            return (
              <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                <span className="text-xs font-bold text-[#6B5744] tabular-nums">{count}</span>
                <div className="w-full flex items-end justify-center" style={{ height: '120px' }}>
                  <div
                    className="w-full rounded-t-lg transition-all duration-500 hover:opacity-80 cursor-default"
                    style={{
                      height: `${heightPct}%`,
                      minHeight: '6px',
                      backgroundColor: '#D4A843',
                      boxShadow: '0 -2px 6px rgba(212,168,67,0.3)',
                    }}
                    title={`${count} session${count !== 1 ? 's' : ''}`}
                  />
                </div>
                <span className="text-xs text-[#9B8777] font-semibold text-center leading-tight">
                  {labels[idx]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Level Distribution
// ---------------------------------------------------------------------------

function LevelDistribution({ data, loading }) {
  const dist = data ?? { beginner: 0, intermediate: 0, advanced: 0 };
  const total = Object.values(dist).reduce((s, v) => s + v, 0) || 1;

  return (
    <div className="bg-[#FFFCF3] rounded-2xl shadow-ghibli p-6 border border-[#E8DEC8]">
      <h3 className="text-base font-extrabold text-[#3D2E1E] mb-5">Level Distribution</h3>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <SkeletonPulse className="h-4 w-24" />
                <SkeletonPulse className="h-4 w-10" />
              </div>
              <SkeletonPulse className="h-3 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Summary badges row */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(LEVEL_CONFIG).map(([key, cfg]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ backgroundColor: cfg.bg, color: cfg.text }}
              >
                {cfg.icon} {cfg.label}
                <span className="ml-1 bg-white bg-opacity-60 rounded-full px-1.5 py-0.5 text-xs font-extrabold">
                  {dist[key] ?? 0}
                </span>
              </span>
            ))}
          </div>

          {/* Stacked progress bars */}
          <div className="space-y-3">
            {Object.entries(LEVEL_CONFIG).map(([key, cfg]) => {
              const count = dist[key] ?? 0;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={key}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-[#6B5744]">
                      {cfg.icon} {cfg.label}
                    </span>
                    <span className="text-sm font-extrabold text-[#3D2E1E]">
                      {count} <span className="text-xs text-[#9B8777] font-semibold">({pct}%)</span>
                    </span>
                  </div>
                  <div
                    className="w-full bg-[#EDE5D4] rounded-full overflow-hidden"
                    style={{ height: '10px' }}
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${cfg.label}: ${count} students (${pct}%)`}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: cfg.barColor,
                        minWidth: count > 0 ? '6px' : '0',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-[#9B8777] font-semibold pt-1">
            Total: {total === 1 && dist.beginner === 0 && dist.intermediate === 0 && dist.advanced === 0 ? 0 : total} students
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent Sessions Table
// ---------------------------------------------------------------------------

function RecentSessionsTable({ sessions, loading }) {
  return (
    <div className="bg-[#FFFCF3] rounded-2xl shadow-ghibli border border-[#E8DEC8] overflow-hidden">
      {/* Table header row */}
      <div className="px-6 py-4 border-b border-[#E8DEC8] flex items-center justify-between bg-[#F5F0E8]">
        <h3 className="text-base font-extrabold text-[#3D2E1E]">Recent Sessions</h3>
        <Link
          href="/admin/reports"
          className="text-xs font-bold text-[#5C8B5C] hover:text-[#3D6B3D] transition-colors"
        >
          View all reports →
        </Link>
      </div>

      {loading ? (
        <div className="p-6">
          <TableSkeleton rows={8} />
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-[#6B5744] font-semibold">No sessions yet</p>
          <p className="text-[#9B8777] text-sm mt-1">Sessions will appear here once students start reading.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Recent sessions">
            <thead>
              <tr className="bg-[#F5F0E8] border-b border-[#E8DEC8]">
                <th className="text-left py-3 px-4 font-bold text-[#6B5744] text-xs uppercase tracking-wide whitespace-nowrap">
                  Student
                </th>
                <th className="text-left py-3 px-4 font-bold text-[#6B5744] text-xs uppercase tracking-wide">
                  Book
                </th>
                <th className="text-left py-3 px-4 font-bold text-[#6B5744] text-xs uppercase tracking-wide whitespace-nowrap">
                  Grammar
                </th>
                <th className="text-left py-3 px-4 font-bold text-[#6B5744] text-xs uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">
                  Level Score
                </th>
                <th className="text-left py-3 px-4 font-bold text-[#6B5744] text-xs uppercase tracking-wide whitespace-nowrap">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.slice(0, 10).map((session) => {
                const gStyle = grammarScoreStyle(session.grammarScore);
                return (
                  <tr
                    key={session.id}
                    className="border-b border-[#EDE5D4] hover:bg-[#F5F0E8] transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-[#3D2E1E] whitespace-nowrap">
                      {session.studentName ?? '—'}
                    </td>
                    <td className="py-3 px-4 text-[#6B5744] max-w-[220px] truncate" title={session.bookTitle}>
                      {session.bookTitle ?? '—'}
                    </td>
                    <td className="py-3 px-4">
                      {session.grammarScore !== null && session.grammarScore !== undefined ? (
                        <span
                          className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap"
                          style={{ backgroundColor: gStyle.bg, color: gStyle.text }}
                        >
                          {session.grammarScore}%
                        </span>
                      ) : (
                        <span className="text-[#9B8777] text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      {session.levelScore !== null && session.levelScore !== undefined ? (
                        <span
                          className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap"
                          style={{ backgroundColor: '#E0F4F9', color: '#2A7A8C' }}
                        >
                          {session.levelScore}%
                        </span>
                      ) : (
                        <span className="text-[#9B8777] text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#9B8777] text-xs whitespace-nowrap">
                      {formatRelativeDate(session.date)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error Banner
// ---------------------------------------------------------------------------

function ErrorBanner({ message, onRetry }) {
  return (
    <div
      className="bg-[#FFEBEE] border border-[#FFCDD2] rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
      role="alert"
    >
      <div className="flex items-start gap-3 flex-1">
        <span className="text-2xl shrink-0" aria-hidden="true">⚠️</span>
        <div>
          <p className="font-bold text-[#C62828] text-sm">Failed to load dashboard data</p>
          <p className="text-[#6B5744] text-xs mt-0.5">{message}</p>
        </div>
      </div>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-[#C62828] text-white text-sm font-bold rounded-xl
                   hover:bg-[#A31818] active:scale-95 transition-all shrink-0"
        style={{ minHeight: '44px', minWidth: '100px' }}
      >
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Action Buttons
// ---------------------------------------------------------------------------

function QuickActions() {
  return (
    <div className="flex flex-wrap gap-3">
      <Link
        href="/admin/students"
        className="px-5 py-2.5 bg-[#5C8B5C] text-white rounded-xl font-bold text-sm
                   hover:bg-[#3D6B3D] active:scale-95 transition-all
                   shadow-[0_2px_8px_rgba(61,107,61,0.3)] hover:-translate-y-0.5"
        style={{ minHeight: '48px', display: 'inline-flex', alignItems: 'center' }}
      >
        + Add Student
      </Link>
      <Link
        href="/admin/books"
        className="px-5 py-2.5 bg-[#D4A843] text-white rounded-xl font-bold text-sm
                   hover:bg-[#B8903A] active:scale-95 transition-all
                   shadow-[0_2px_8px_rgba(212,168,67,0.3)] hover:-translate-y-0.5"
        style={{ minHeight: '48px', display: 'inline-flex', alignItems: 'center' }}
      >
        + Add Book
      </Link>
      <Link
        href="/admin/reports"
        className="px-5 py-2.5 bg-[#87CEDB] text-[#3D2E1E] rounded-xl font-bold text-sm
                   hover:bg-[#5BA8B8] hover:text-white active:scale-95 transition-all
                   shadow-[0_2px_8px_rgba(135,206,219,0.3)] hover:-translate-y-0.5"
        style={{ minHeight: '48px', display: 'inline-flex', alignItems: 'center' }}
      >
        View Reports
      </Link>
      <Link
        href="/admin/prompts"
        className="px-5 py-2.5 bg-[#FFFCF3] text-[#3D2E1E] border border-[#E8DEC8] rounded-xl font-bold text-sm
                   hover:bg-[#F5F0E8] active:scale-95 transition-all hover:-translate-y-0.5"
        style={{ minHeight: '48px', display: 'inline-flex', alignItems: 'center' }}
      >
        AI Prompts
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------

export default function AdminDashboard() {
  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    const token =
      typeof window !== 'undefined' ? sessionStorage.getItem('authToken') : null;

    try {
      const res = await fetch(`${API_BASE}/api/admin/dashboard`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server responded with ${res.status}`);
      }

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error ?? 'Unexpected response from server');
      }

      setDashData(json.data);
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        setError('Request timed out. Please check the server and try again.');
      } else {
        setError(err.message || 'Unknown error');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Derived values — safe to access even when dashData is null (loading state)
  const totalStudents = dashData?.totalStudents ?? null;
  const totalBooks = dashData?.totalBooks ?? null;
  const activeSessions = dashData?.activeSessions ?? null;
  const avgGrammarScore =
    dashData?.avgGrammarScore != null ? `${dashData.avgGrammarScore}%` : null;

  const statCards = [
    {
      label: 'Total Students',
      value: totalStudents,
      icon: '👨‍🎓',
      accentColor: '#5C8B5C',
    },
    {
      label: 'Total Books',
      value: totalBooks,
      icon: '📚',
      accentColor: '#D4A843',
    },
    {
      label: 'Active Sessions (7d)',
      value: activeSessions,
      icon: '⏳',
      accentColor: '#87CEDB',
    },
    {
      label: 'Avg Grammar Score',
      value: avgGrammarScore,
      icon: '📝',
      accentColor: '#D4736B',
    },
  ];

  return (
    <>
      <TopBar />

      <main className="min-h-screen bg-[#F5F0E8]">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">

          {/* Page title */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#3D2E1E]">
              Dashboard
            </h1>
            <p className="text-[#6B5744] text-sm mt-1 font-semibold">
              Overview of HiAlice learning activity
            </p>
          </div>

          {/* Error banner */}
          {error && !loading && (
            <ErrorBanner message={error} onRetry={fetchDashboard} />
          )}

          {/* Stat cards grid */}
          <section aria-label="Key metrics">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {statCards.map((card) => (
                <StatCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  icon={card.icon}
                  accentColor={card.accentColor}
                  loading={loading}
                />
              ))}
            </div>
          </section>

          {/* Quick actions */}
          <section aria-label="Quick actions">
            <QuickActions />
          </section>

          {/* Charts row */}
          <section
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            aria-label="Analytics charts"
          >
            <SessionsBarChart
              data={dashData?.sessionsPerWeek}
              loading={loading}
            />
            <LevelDistribution
              data={dashData?.levelDistribution}
              loading={loading}
            />
          </section>

          {/* Recent sessions table */}
          <section aria-label="Recent sessions">
            <RecentSessionsTable
              sessions={dashData?.recentSessions}
              loading={loading}
            />
          </section>

        </div>
      </main>
    </>
  );
}
