'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingCard from '@/components/LoadingCard';

// ── Constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const LEVEL_BADGE = {
  beginner:     { bg: '#C8E6C9', text: '#2E7D32', label: 'Beginner' },
  intermediate: { bg: '#FFE0B2', text: '#E65100', label: 'Intermediate' },
  advanced:     { bg: '#E1BEE7', text: '#6A1B9A', label: 'Advanced' },
};

const STAGE_META = [
  { key: 'title',        label: 'Title',        color: '#4A7C59', bg: '#E8F5E8' },
  { key: 'introduction', label: 'Introduction',  color: '#2A7A8C', bg: '#E0F4F9' },
  { key: 'body',         label: 'Body',          color: '#8C6D00', bg: '#FFF8E1' },
  { key: 'conclusion',   label: 'Conclusion',    color: '#6A3D9A', bg: '#EDE7F6' },
];

const ENCOURAGING_MESSAGES = [
  "Your child is making wonderful progress!",
  "What a fantastic reading journey so far!",
  "Their vocabulary is growing beautifully!",
  "Keep up the great work together!",
  "Every book brings new adventures and learning!",
];

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Loading dashboard">
      {/* Profile skeleton */}
      <div className="ghibli-card p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-full bg-[#EDE5D4]" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-[#EDE5D4] rounded-xl w-1/3" />
            <div className="h-4 bg-[#EDE5D4] rounded-xl w-1/4" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-[#EDE5D4] rounded-2xl" />
          ))}
        </div>
      </div>
      {/* Sessions skeleton */}
      <LoadingCard lines={4} />
      {/* Chart skeleton */}
      <div className="ghibli-card p-6">
        <div className="h-5 bg-[#EDE5D4] rounded-xl w-1/4 mb-4" />
        <div className="flex items-end gap-2 h-32">
          {[60, 80, 45, 70, 90, 55, 75].map((h, i) => (
            <div key={i} className="flex-1 bg-[#EDE5D4] rounded-t-xl" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      {/* Achievements skeleton */}
      <LoadingCard lines={2} />
    </div>
  );
}

// ── Child Selector ────────────────────────────────────────────────────────────

function ChildSelector({ children, selectedId, onSelect }) {
  if (!children || children.length <= 1) return null;

  return (
    <div
      role="tablist"
      aria-label="Select child"
      className="flex gap-2 mb-5 overflow-x-auto pb-1"
    >
      {children.map((child) => {
        const isActive = child.id === selectedId;
        return (
          <button
            key={child.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(child)}
            className={[
              'flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold',
              'transition-all focus-visible:outline-2 focus-visible:outline-[#4A7C59]',
              'min-h-[44px]',
              isActive
                ? 'bg-[#4A7C59] text-white shadow-[0_4px_12px_rgba(74,124,89,0.35)]'
                : 'bg-[#FFFCF3] text-[#4A7C59] border border-[#4A7C59]/30 hover:border-[#4A7C59] hover:bg-[#E8F5E8]',
            ].join(' ')}
          >
            <span aria-hidden="true">{child.avatarEmoji || '👶'}</span>
            {child.name}
          </button>
        );
      })}
    </div>
  );
}

// ── Profile Card ──────────────────────────────────────────────────────────────

function ProfileCard({ student, vocab }) {
  const levelKey = (student.level || 'beginner').toLowerCase();
  const levelStyle = LEVEL_BADGE[levelKey] || LEVEL_BADGE.beginner;
  const totalWords = vocab?.total ?? student.totalWords ?? 0;
  const encourageMsg = ENCOURAGING_MESSAGES[
    Math.abs((student.name || '').charCodeAt(0) ?? 0) % ENCOURAGING_MESSAGES.length
  ];

  return (
    <div className="ghibli-card overflow-hidden">
      {/* Header gradient */}
      <div className="bg-gradient-to-r from-[#4A7C59] to-[#2C4A2E] px-6 pt-6 pb-8">
        <div className="flex items-start gap-4">
          <div className="text-6xl drop-shadow-sm flex-shrink-0" aria-hidden="true">
            {student.avatarEmoji || '📚'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-extrabold text-white truncate">{student.name}</h2>
            <p className="text-green-100 text-sm font-medium mt-0.5">
              Age {student.age} &bull; Reading with HiAlice
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className="px-3 py-1 rounded-full text-xs font-extrabold"
                style={{ backgroundColor: levelStyle.bg, color: levelStyle.text }}
              >
                {levelStyle.label}
              </span>
              {(student.streak ?? 0) > 0 && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#F59E0B]/20 text-[#F59E0B]"
                  aria-label={`${student.streak} day streak`}
                >
                  {'\uD83D\uDD25'} {student.streak}-day streak
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="bg-[#FFFCF3] -mt-4 mx-3 mb-3 rounded-2xl shadow-[0_2px_12px_rgba(61,46,30,0.08)] grid grid-cols-3 divide-x divide-[#E8DEC8]">
        {[
          { icon: '📖', value: student.totalBooks ?? 0, label: 'Books Read' },
          { icon: '💡', value: totalWords, label: 'Words Learned' },
          { icon: '🔥', value: student.streak ?? 0, label: 'Day Streak' },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col items-center py-4 px-2">
            <span className="text-2xl mb-1" aria-hidden="true">{stat.icon}</span>
            <span className="text-xl font-extrabold text-[#2C4A2E]">{stat.value}</span>
            <span className="text-[10px] text-[#6B5744] font-semibold text-center leading-tight mt-0.5">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Encouraging message */}
      <div className="px-5 pb-5">
        <p className="text-center text-sm font-semibold text-[#4A7C59] italic">
          {'\u2728'} {encourageMsg}
        </p>
      </div>
    </div>
  );
}

// ── Recent Sessions ───────────────────────────────────────────────────────────

function RecentSessions({ sessions }) {
  const recent = (sessions || []).slice(0, 5);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'In progress';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const scoreColor = (score) => {
    if (score == null) return '#9CA3AF';
    if (score >= 80) return '#4A7C59';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="ghibli-card p-5">
      <h3 className="text-base font-extrabold text-[#2C4A2E] mb-4 flex items-center gap-2">
        <span aria-hidden="true">📋</span> Recent Reading Sessions
      </h3>

      {recent.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-3xl mb-2" aria-hidden="true">📚</p>
          <p className="text-sm font-semibold text-[#9B8777]">No sessions yet</p>
          <p className="text-xs text-[#9CA3AF] mt-1">Time to start reading!</p>
        </div>
      ) : (
        <div className="space-y-0 divide-y divide-[#F5F0E8]">
          {recent.map((session, i) => {
            const dateStr = formatDate(session.completedAt || session.startedAt);
            const grammar = session.grammarScore;
            const isComplete = session.isComplete || !!session.completedAt;

            return (
              <div
                key={session.id ?? i}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                  style={{ backgroundColor: isComplete ? '#E8F5E8' : '#FFF8E1' }}
                  aria-hidden="true"
                >
                  {isComplete ? '✅' : '⏳'}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#3D2E1E] truncate">
                    {session.bookTitle || 'Book Session'}
                  </p>
                  <p className="text-xs text-[#9B8777] font-medium mt-0.5">
                    {dateStr}
                    {session.bookLevel && (
                      <span className="ml-2 capitalize text-[#6B5744]">
                        {session.bookLevel}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex-shrink-0 text-right">
                  <p
                    className="text-sm font-extrabold"
                    style={{ color: scoreColor(grammar) }}
                    aria-label={grammar != null ? `Grammar score ${grammar} out of 10` : 'No score'}
                  >
                    {grammar != null ? `${grammar}/10` : '—'}
                  </p>
                  <p className="text-[10px] text-[#9B8777] font-medium">grammar</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Weekly Progress Chart (pure CSS bars) ────────────────────────────────────

function WeeklyChart({ weeklyProgress }) {
  const weeks = weeklyProgress || [];
  const maxBooks = Math.max(...weeks.map((w) => w.booksRead ?? 0), 1);

  if (weeks.length === 0) {
    return (
      <div className="ghibli-card p-5">
        <h3 className="text-base font-extrabold text-[#2C4A2E] mb-4 flex items-center gap-2">
          <span aria-hidden="true">📊</span> Weekly Reading Progress
        </h3>
        <p className="text-center text-sm text-[#9B8777] py-4">No data available yet</p>
      </div>
    );
  }

  return (
    <div className="ghibli-card p-5">
      <h3 className="text-base font-extrabold text-[#2C4A2E] mb-4 flex items-center gap-2">
        <span aria-hidden="true">📊</span> Weekly Reading Progress
      </h3>

      {/* Bar chart */}
      <div
        role="img"
        aria-label="Weekly books read chart"
        className="flex items-end gap-2 h-32 mt-2"
      >
        {weeks.map((week, i) => {
          const booksRead = week.booksRead ?? 0;
          const heightPct = Math.max((booksRead / maxBooks) * 100, 4);
          const label = week.week
            ? `W${String(week.week).split('-').pop() || i + 1}`
            : `W${i + 1}`;

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-bold text-[#4A7C59]">{booksRead}</span>
              <div className="w-full flex items-end justify-center">
                <div
                  className="w-full rounded-t-lg transition-all"
                  style={{
                    height: `${(heightPct / 100) * 96}px`,
                    backgroundColor: i === weeks.length - 1 ? '#4A7C59' : '#A8D5B5',
                  }}
                  title={`${label}: ${booksRead} book${booksRead !== 1 ? 's' : ''}`}
                />
              </div>
              <span className="text-[10px] font-semibold text-[#9B8777]">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Words legend row */}
      {weeks.some((w) => (w.wordsLearned ?? 0) > 0) && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
          {weeks.map((week, i) => {
            const label = week.week
              ? `W${String(week.week).split('-').pop() || i + 1}`
              : `W${i + 1}`;
            return (
              <span key={i} className="text-xs text-[#6B5744] font-medium">
                {label}: <strong className="text-[#4A7C59]">{week.wordsLearned ?? 0}</strong> words
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Achievements ──────────────────────────────────────────────────────────────

function AchievementsSection({ achievements }) {
  const list = achievements || [];

  return (
    <div className="ghibli-card p-5">
      <h3 className="text-base font-extrabold text-[#2C4A2E] mb-1 flex items-center gap-2">
        <span aria-hidden="true">🏆</span> Achievements Earned
        <span className="ml-auto text-xs font-semibold text-[#9B8777]">
          {list.length} badge{list.length !== 1 ? 's' : ''}
        </span>
      </h3>

      {list.length === 0 ? (
        <div className="text-center py-5">
          <p className="text-2xl mb-1" aria-hidden="true">🎯</p>
          <p className="text-sm text-[#9B8777] font-medium">No achievements yet</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">Keep reading to earn badges!</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 mt-3 sm:grid-cols-4">
          {list.map((ach, i) => (
            <div
              key={ach.achievement_key ?? i}
              className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-[#F5F0E8] hover:bg-[#E8F5E8] transition-colors"
              title={ach.achievement_label || 'Achievement'}
            >
              <span className="text-2xl" aria-hidden="true">
                {ach.achievement_emoji || '🏅'}
              </span>
              <span className="text-[10px] text-center text-[#6B5744] font-semibold leading-tight">
                {ach.achievement_label || 'Achievement'}
              </span>
              {ach.earned_at && (
                <span className="text-[9px] text-[#9B8777]">
                  {new Date(ach.earned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Vocabulary Summary ────────────────────────────────────────────────────────

function VocabSummary({ vocabulary }) {
  const vocab = vocabulary || {};
  const total    = vocab.total    ?? 0;
  const mastered = vocab.mastered ?? 0;
  const learning = vocab.learning ?? 0;
  const recent   = vocab.recentWords || [];
  const masteredPct = total > 0 ? Math.round((mastered / total) * 100) : 0;

  const POS_COLORS = {
    noun:        '#4A7C59',
    verb:        '#2A7A8C',
    adjective:   '#8C6D00',
    adverb:      '#6A3D9A',
    other:       '#9B8777',
  };

  return (
    <div className="ghibli-card p-5">
      <h3 className="text-base font-extrabold text-[#2C4A2E] mb-4 flex items-center gap-2">
        <span aria-hidden="true">💡</span> Vocabulary Progress
      </h3>

      {/* Counts row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Total Words', value: total,    color: '#4A7C59', bg: '#E8F5E8' },
          { label: 'Mastered',    value: mastered, color: '#27AE60', bg: '#C8E6C9' },
          { label: 'Learning',    value: learning, color: '#F59E0B', bg: '#FFF8E1' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl p-3 text-center"
            style={{ backgroundColor: stat.bg }}
          >
            <p className="text-xl font-extrabold" style={{ color: stat.color }}>
              {stat.value}
            </p>
            <p className="text-[10px] font-semibold text-[#6B5744] leading-tight mt-0.5">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Mastery progress bar */}
      {total > 0 && (
        <div className="mb-4">
          <div className="flex justify-between mb-1">
            <span className="text-xs font-bold text-[#6B5744]">Mastery</span>
            <span className="text-xs font-extrabold text-[#4A7C59]">{masteredPct}%</span>
          </div>
          <div
            className="w-full bg-[#EDE5D4] rounded-full h-3 overflow-hidden"
            role="progressbar"
            aria-valuenow={masteredPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${masteredPct}% of words mastered`}
          >
            <div
              className="h-3 rounded-full transition-all duration-700"
              style={{ width: `${masteredPct}%`, backgroundColor: '#27AE60' }}
            />
          </div>
        </div>
      )}

      {/* Recent words */}
      {recent.length > 0 && (
        <div>
          <p className="text-xs font-extrabold text-[#6B5744] uppercase tracking-wide mb-2">
            Recent Words
          </p>
          <div className="flex flex-wrap gap-1.5">
            {recent.slice(0, 10).map((w, i) => {
              const posKey = (w.pos || 'other').toLowerCase();
              const color = POS_COLORS[posKey] || POS_COLORS.other;
              return (
                <span
                  key={w.word ?? i}
                  className="px-2.5 py-1 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: color }}
                  title={`${w.pos || ''} — used ${w.useCount ?? 1}x`}
                >
                  {w.word}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stage Breakdown ───────────────────────────────────────────────────────────

function StageBreakdown({ stageBreakdown }) {
  const breakdown = stageBreakdown || {};

  const stagesWithValues = STAGE_META.map((s) => ({
    ...s,
    score: breakdown[s.key] ?? null,
  }));

  const hasData = stagesWithValues.some((s) => s.score != null);

  return (
    <div className="ghibli-card p-5">
      <h3 className="text-base font-extrabold text-[#2C4A2E] mb-4 flex items-center gap-2">
        <span aria-hidden="true">📐</span> Stage Performance
      </h3>

      {!hasData ? (
        <p className="text-center text-sm text-[#9B8777] py-4">
          Complete sessions to see stage scores
        </p>
      ) : (
        <div className="space-y-3">
          {stagesWithValues.map((stage) => {
            const score = stage.score;
            const displayScore = score != null ? Math.round(score) : null;
            const barWidth = displayScore != null ? `${Math.min(displayScore, 100)}%` : '0%';

            return (
              <div key={stage.key}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stage.color }}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-bold text-[#3D2E1E]">{stage.label}</span>
                  </div>
                  <span
                    className="text-sm font-extrabold"
                    style={{ color: displayScore != null ? stage.color : '#9CA3AF' }}
                    aria-label={displayScore != null ? `${stage.label} score ${displayScore}%` : `${stage.label} not yet attempted`}
                  >
                    {displayScore != null ? `${displayScore}%` : '—'}
                  </span>
                </div>
                <div
                  className="w-full rounded-full h-2.5 overflow-hidden"
                  style={{ backgroundColor: stage.bg }}
                  role="progressbar"
                  aria-valuenow={displayScore ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-2.5 rounded-full transition-all duration-700"
                    style={{ width: barWidth, backgroundColor: stage.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="ghibli-card p-10 text-center">
      <p className="text-5xl mb-4" aria-hidden="true">👨‍👩‍👧</p>
      <h2 className="text-lg font-extrabold text-[#2C4A2E] mb-2">No children linked yet</h2>
      <p className="text-sm text-[#9B8777] max-w-xs mx-auto">
        Ask your admin to link your children's accounts so you can track their reading journey.
      </p>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function ParentDashboard() {
  const router = useRouter();

  const [children, setChildren]         = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [childData, setChildData]       = useState(null);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingChild, setLoadingChild]  = useState(false);
  const [error, setError]               = useState(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getAuth = () => {
    if (typeof window === 'undefined') return { token: null, parentId: null };
    return {
      token:    sessionStorage.getItem('authToken'),
      parentId: sessionStorage.getItem('parentId'),
    };
  };

  const authHeaders = (token) => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  // ── Fetch children list ───────────────────────────────────────────────────

  const fetchChildren = useCallback(async () => {
    setLoadingChildren(true);
    setError(null);

    const { token, parentId } = getAuth();

    if (!token && !parentId) {
      // Not logged in — redirect to home
      router.push('/');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/students`, {
        headers: authHeaders(token),
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/');
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      const allStudents = json?.data?.students || json?.students || [];

      // Filter to only the students belonging to this parent
      const myChildren = parentId
        ? allStudents.filter(
            (s) =>
              String(s.parent_id) === String(parentId) ||
              String(s.parentId)  === String(parentId)
          )
        : allStudents;

      setChildren(myChildren);

      if (myChildren.length > 0) {
        setSelectedChild(myChildren[0]);
      }
    } catch (err) {
      console.warn('Parent dashboard: failed to load children', err);
      setError('Could not load your children. Please try again.');
    } finally {
      setLoadingChildren(false);
    }
  }, [router]);

  // ── Fetch analytics for selected child ───────────────────────────────────

  const fetchChildAnalytics = useCallback(async (childId) => {
    if (!childId) return;

    setLoadingChild(true);
    setChildData(null);

    const { token } = getAuth();

    try {
      const res = await fetch(
        `${API_BASE}/api/admin/students/${childId}/analytics`,
        { headers: authHeaders(token) }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      // Support both { data: {...} } and flat response shapes
      setChildData(json?.data || json);
    } catch (err) {
      console.warn('Parent dashboard: failed to load analytics', err);
      // Non-fatal — show empty state sections rather than an error page
      setChildData({});
    } finally {
      setLoadingChild(false);
    }
  }, []);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  useEffect(() => {
    if (selectedChild?.id) {
      fetchChildAnalytics(selectedChild.id);
    }
  }, [selectedChild, fetchChildAnalytics]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const student         = childData?.student;
  const sessions        = childData?.sessions        || [];
  const vocabulary      = childData?.vocabulary;
  const achievements    = childData?.achievements    || [];
  const weeklyProgress  = childData?.weeklyProgress  || [];
  const stageBreakdown  = childData?.stageBreakdown;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      <div className="max-w-xl mx-auto px-4 py-6 pb-28 md:pb-8">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-[#2C4A2E] leading-tight">
              Parent Dashboard
            </h1>
            <p className="text-sm text-[#6B5744] font-medium mt-0.5">
              Your child's reading journey
            </p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#FFFCF3] border border-[#D6C9A8] text-[#4A7C59] text-sm font-bold hover:bg-[#E8F5E8] hover:border-[#4A7C59] transition-colors min-h-[44px]"
            aria-label="Go back to home"
          >
            <span aria-hidden="true">🏠</span>
            <span className="hidden sm:inline">Home</span>
          </Link>
        </header>

        {/* ── Error Banner ────────────────────────────────────────────────── */}
        {error && (
          <div
            role="alert"
            className="mb-4 px-4 py-3 rounded-2xl bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-sm font-semibold flex items-center gap-2"
          >
            <span aria-hidden="true">⚠️</span>
            {error}
            <button
              onClick={fetchChildren}
              className="ml-auto underline font-bold hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Loading state ────────────────────────────────────────────────── */}
        {loadingChildren ? (
          <DashboardSkeleton />
        ) : children.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* ── Child tabs (multi-child) ─────────────────────────────────── */}
            <ChildSelector
              children={children}
              selectedId={selectedChild?.id}
              onSelect={setSelectedChild}
            />

            {/* ── Child data sections ──────────────────────────────────────── */}
            {loadingChild ? (
              <DashboardSkeleton />
            ) : !student ? (
              /* Analytics not yet returned — show minimal placeholder */
              <div className="space-y-4">
                <div className="ghibli-card p-8 text-center">
                  <p className="text-3xl mb-3" aria-hidden="true">⏳</p>
                  <p className="text-sm font-semibold text-[#9B8777]">Loading data…</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">

                {/* Profile Card */}
                <ProfileCard student={student} vocab={vocabulary} />

                {/* Recent Sessions */}
                <RecentSessions sessions={sessions} />

                {/* Weekly Progress Chart */}
                <WeeklyChart weeklyProgress={weeklyProgress} />

                {/* Vocabulary Summary */}
                <VocabSummary vocabulary={vocabulary} />

                {/* Stage Breakdown */}
                <StageBreakdown stageBreakdown={stageBreakdown} />

                {/* Achievements */}
                <AchievementsSection achievements={achievements} />

                {/* Refresh button */}
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => selectedChild?.id && fetchChildAnalytics(selectedChild.id)}
                    className="px-6 py-3 rounded-2xl border-2 border-[#4A7C59] text-[#4A7C59] text-sm font-bold hover:bg-[#E8F5E8] transition-colors min-h-[48px]"
                  >
                    Refresh Data
                  </button>
                </div>

              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
