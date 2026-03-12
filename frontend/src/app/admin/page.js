'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getItem } from '@/lib/clientStorage';
import { getSafetyLogs, getSafetyStats, reviewSafetyLog } from '@/services/api';

// Mock data
const MOCK_STATS = {
  totalStudents: 24,
  totalBooks: 18,
  activeSessions: 3,
  avgGrammarScore: 81,
};

const MOCK_RECENT_SESSIONS = [
  {
    id: 1,
    studentName: 'Alice',
    bookTitle: 'The Very Hungry Caterpillar',
    stage: 'Conclusion',
    grammarScore: 85,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    status: 'completed',
  },
  {
    id: 2,
    studentName: 'Bob',
    bookTitle: "Charlotte's Web",
    stage: 'Body',
    grammarScore: 78,
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    status: 'in-progress',
  },
  {
    id: 3,
    studentName: 'Carol',
    bookTitle: 'The Lion, the Witch and the Wardrobe',
    stage: 'Introduction',
    grammarScore: 82,
    timestamp: new Date(Date.now() - 10800000).toISOString(),
    status: 'in-progress',
  },
  {
    id: 4,
    studentName: 'David',
    bookTitle: 'Where the Wild Things Are',
    stage: 'Title',
    grammarScore: 88,
    timestamp: new Date(Date.now() - 14400000).toISOString(),
    status: 'completed',
  },
  {
    id: 5,
    studentName: 'Emma',
    bookTitle: 'Winnie-the-Pooh',
    stage: 'Conclusion',
    grammarScore: 79,
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    status: 'completed',
  },
  {
    id: 6,
    studentName: 'Frank',
    bookTitle: 'Matilda',
    stage: 'Body',
    grammarScore: 83,
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    status: 'completed',
  },
  {
    id: 7,
    studentName: 'Grace',
    bookTitle: 'Magic Tree House: Dinosaurs Before Dark',
    stage: 'Introduction',
    grammarScore: 75,
    timestamp: new Date(Date.now() - 259200000).toISOString(),
    status: 'completed',
  },
  {
    id: 8,
    studentName: 'Henry',
    bookTitle: 'A Wrinkle in Time',
    stage: 'Conclusion',
    grammarScore: 91,
    timestamp: new Date(Date.now() - 345600000).toISOString(),
    status: 'completed',
  },
  {
    id: 9,
    studentName: 'Iris',
    bookTitle: 'The Hobbit',
    stage: 'Body',
    grammarScore: 86,
    timestamp: new Date(Date.now() - 432000000).toISOString(),
    status: 'completed',
  },
  {
    id: 10,
    studentName: 'Jack',
    bookTitle: 'Inkheart',
    stage: 'Title',
    grammarScore: 80,
    timestamp: new Date(Date.now() - 518400000).toISOString(),
    status: 'completed',
  },
];

// Level distribution data
const LEVEL_DISTRIBUTION = {
  Beginner: 8,
  Intermediate: 12,
  Advanced: 4,
};

// Weekly sessions data (for bar chart)
const WEEKLY_SESSIONS = [
  { day: 'Mon', sessions: 12 },
  { day: 'Tue', sessions: 15 },
  { day: 'Wed', sessions: 9 },
  { day: 'Thu', sessions: 18 },
  { day: 'Fri', sessions: 21 },
  { day: 'Sat', sessions: 8 },
  { day: 'Sun', sessions: 5 },
];

const maxSessions = Math.max(...WEEKLY_SESSIONS.map((d) => d.sessions));

// Stage badge colors
const STAGE_BADGE_STYLES = {
  Title: { bg: '#E8F5E8', text: '#3D6B3D' },
  Introduction: { bg: '#E0F4F9', text: '#2A7A8C' },
  Body: { bg: '#FFF8E1', text: '#8C6D00' },
  Conclusion: { bg: '#E8F5E8', text: '#2E7D32' },
};

// ============================================================================
// Safety Monitor — flag type display helpers
// ============================================================================

/**
 * Human-readable label and severity colour for each flag type.
 * Falls back to a generic style for unknown flag types.
 */
const FLAG_META = {
  self_harm_signal:          { label: 'Self-Harm Signal',    bg: '#FFEBEE', text: '#C62828', border: '#EF9A9A' },
  abuse_disclosure:          { label: 'Abuse Disclosure',    bg: '#FFEBEE', text: '#C62828', border: '#EF9A9A' },
  extreme_distress:          { label: 'Extreme Distress',    bg: '#FFEBEE', text: '#C62828', border: '#EF9A9A' },
  bullying_report:           { label: 'Bullying Report',     bg: '#FFF3E0', text: '#E65100', border: '#FFCC80' },
  pii_sharing:               { label: 'PII Sharing',         bg: '#FFF3E0', text: '#E65100', border: '#FFCC80' },
  student_pii_phone_number:  { label: 'Student Phone #',     bg: '#FFF3E0', text: '#E65100', border: '#FFCC80' },
  student_pii_email_address: { label: 'Student Email',       bg: '#FFF3E0', text: '#E65100', border: '#FFCC80' },
  student_pii_credit_card:   { label: 'Student CC #',        bg: '#FFEBEE', text: '#C62828', border: '#EF9A9A' },
  profanity:                 { label: 'Profanity',           bg: '#FFF8E1', text: '#F57F17', border: '#FFE082' },
  violence:                  { label: 'Violence',            bg: '#FFF3E0', text: '#BF360C', border: '#FFAB91' },
  adult_content:             { label: 'Adult Content',       bg: '#FFEBEE', text: '#880E4F', border: '#F48FB1' },
  pii_email_address:         { label: 'AI PII: Email',       bg: '#E8EAF6', text: '#283593', border: '#9FA8DA' },
  pii_phone_number:          { label: 'AI PII: Phone',       bg: '#E8EAF6', text: '#283593', border: '#9FA8DA' },
  pii_ssn:                   { label: 'AI PII: SSN',         bg: '#FFEBEE', text: '#C62828', border: '#EF9A9A' },
  pii_credit_card:           { label: 'AI PII: Credit Card', bg: '#FFEBEE', text: '#C62828', border: '#EF9A9A' },
  pii_physical_address:      { label: 'AI PII: Address',     bg: '#E8EAF6', text: '#283593', border: '#9FA8DA' },
};

function getFlagMeta(flagKey) {
  return FLAG_META[flagKey] ?? { label: flagKey.replace(/_/g, ' '), bg: '#F5F5F5', text: '#424242', border: '#BDBDBD' };
}

/**
 * Whether a flag type represents a critical / urgent situation.
 */
function isCriticalFlag(flagKey) {
  return ['self_harm_signal', 'abuse_disclosure', 'extreme_distress'].includes(flagKey);
}

// ============================================================================
// SafetyMonitor sub-component
// ============================================================================

function SafetyMonitor() {
  const [safetyStats, setSafetyStats]       = useState(null);
  const [safetyLogs, setSafetyLogs]         = useState([]);
  const [pagination, setPagination]         = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [filterFlagType, setFilterFlagType] = useState('');
  const [filterSource, setFilterSource]     = useState('');
  const [filterReviewed, setFilterReviewed] = useState('false');  // Default: show unreviewed
  const [loadingLogs, setLoadingLogs]       = useState(false);
  const [loadingStats, setLoadingStats]     = useState(false);
  const [reviewingId, setReviewingId]       = useState(null);
  const [error, setError]                   = useState(null);

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const res = await getSafetyStats(7);
      if (res.success) setSafetyStats(res.data);
    } catch (err) {
      console.warn('Safety stats fetch failed, mock data in use:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchLogs = useCallback(async (page = 1) => {
    try {
      setLoadingLogs(true);
      setError(null);
      const res = await getSafetyLogs(page, pagination.limit, {
        flagType: filterFlagType,
        source:   filterSource,
        reviewed: filterReviewed,
        days:     7,
      });
      if (res.success) {
        setSafetyLogs(res.data.logs);
        setPagination((prev) => ({ ...prev, ...res.data.pagination }));
      }
    } catch (err) {
      setError('Failed to load safety logs.');
      console.error('Safety logs fetch error:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [pagination.limit, filterFlagType, filterSource, filterReviewed]);

  useEffect(() => {
    fetchStats();
    fetchLogs(1);
  }, [fetchStats, fetchLogs]);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  const handleMarkReviewed = async (logId) => {
    setReviewingId(logId);
    try {
      const res = await reviewSafetyLog(logId);
      if (res.success) {
        // Optimistically update local state
        setSafetyLogs((prev) =>
          prev.map((entry) =>
            entry.id === logId
              ? { ...entry, reviewed: true, reviewedAt: res.data.reviewedAt, reviewedBy: res.data.reviewedBy }
              : entry
          )
        );
        // Refresh stats to update unreviewed count
        fetchStats();
      }
    } catch (err) {
      console.error('Mark as reviewed failed:', err);
    } finally {
      setReviewingId(null);
    }
  };

  const handleFilterChange = () => {
    fetchLogs(1);
  };

  const handlePageChange = (newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
    fetchLogs(newPage);
  };

  // ------------------------------------------------------------------
  // Rendering helpers
  // ------------------------------------------------------------------

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7)  return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const unreviewedCount = safetyStats?.unreviewed_count ?? 0;
  const totalFlags      = safetyStats?.total_flags ?? 0;

  return (
    <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] border border-[#E8DEC8] overflow-hidden">

      {/* Panel header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b border-[#E8DEC8]"
        style={{ background: 'linear-gradient(135deg, #FFF5F5 0%, #FFFCF3 100%)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold"
            style={{ background: '#FFEBEE', color: '#C62828' }}
            aria-hidden="true"
          >
            S
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-[#3D2E1E]">Safety Monitor</h3>
            <p className="text-xs text-[#6B5744]">AI response and student input flags — last 7 days</p>
          </div>
        </div>

        {/* Summary badges */}
        {!loadingStats && (
          <div className="flex items-center gap-3">
            <div
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: unreviewedCount > 0 ? '#FFEBEE' : '#E8F5E8', color: unreviewedCount > 0 ? '#C62828' : '#2E7D32' }}
            >
              {unreviewedCount} unreviewed
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-bold bg-[#F5F0E8] text-[#6B5744]">
              {totalFlags} total flags
            </div>
          </div>
        )}
      </div>

      {/* Stats summary row */}
      {safetyStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-[#E8DEC8]">
          {[
            { label: 'Total Flags (7d)',     value: safetyStats.total_flags,               accent: '#D4736B' },
            { label: 'Unreviewed',           value: safetyStats.unreviewed_count,           accent: safetyStats.unreviewed_count > 0 ? '#C62828' : '#5C8B5C' },
            { label: 'AI Response Flags',    value: safetyStats.by_source.ai_response,      accent: '#87CEDB' },
            { label: 'Student Input Flags',  value: safetyStats.by_source.student_input,    accent: '#D4A843' },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-4 border-r border-[#E8DEC8] last:border-r-0"
            >
              <p className="text-xs font-semibold text-[#6B5744]">{item.label}</p>
              <p className="text-2xl font-extrabold mt-1" style={{ color: item.accent }}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Top flag types */}
      {safetyStats?.by_flag_type?.length > 0 && (
        <div className="px-6 py-3 border-b border-[#E8DEC8] flex flex-wrap gap-2 items-center">
          <span className="text-xs font-bold text-[#6B5744] mr-1">Top flags:</span>
          {safetyStats.by_flag_type.slice(0, 5).map(({ flag, count }) => {
            const meta = getFlagMeta(flag);
            return (
              <button
                key={flag}
                onClick={() => {
                  setFilterFlagType(flag);
                  handleFilterChange();
                }}
                className="px-2 py-0.5 rounded-full text-xs font-bold border transition-opacity hover:opacity-80 cursor-pointer"
                style={{ background: meta.bg, color: meta.text, borderColor: meta.border }}
                title={`Filter by: ${meta.label}`}
              >
                {meta.label} ({count})
              </button>
            );
          })}
          {filterFlagType && (
            <button
              onClick={() => { setFilterFlagType(''); handleFilterChange(); }}
              className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#F5F0E8] text-[#6B5744] border border-[#E8DEC8] hover:opacity-80"
            >
              Clear filter x
            </button>
          )}
        </div>
      )}

      {/* Filters row */}
      <div className="px-6 py-3 border-b border-[#E8DEC8] flex flex-wrap items-center gap-3 bg-[#FAF7F0]">
        <span className="text-xs font-bold text-[#6B5744]">Filter:</span>

        {/* Flag type text filter */}
        <input
          type="text"
          value={filterFlagType}
          onChange={(e) => setFilterFlagType(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleFilterChange()}
          placeholder="Flag type..."
          className="px-3 py-1.5 rounded-lg border border-[#E8DEC8] bg-white text-xs text-[#3D2E1E] outline-none focus:border-[#87CEDB] transition-colors"
          style={{ minWidth: '130px' }}
        />

        {/* Source filter */}
        <select
          value={filterSource}
          onChange={(e) => { setFilterSource(e.target.value); handleFilterChange(); }}
          className="px-3 py-1.5 rounded-lg border border-[#E8DEC8] bg-white text-xs text-[#3D2E1E] outline-none focus:border-[#87CEDB] transition-colors"
        >
          <option value="">All sources</option>
          <option value="ai_response">AI Response</option>
          <option value="student_input">Student Input</option>
        </select>

        {/* Reviewed filter */}
        <select
          value={filterReviewed}
          onChange={(e) => { setFilterReviewed(e.target.value); handleFilterChange(); }}
          className="px-3 py-1.5 rounded-lg border border-[#E8DEC8] bg-white text-xs text-[#3D2E1E] outline-none focus:border-[#87CEDB] transition-colors"
        >
          <option value="">All</option>
          <option value="false">Unreviewed</option>
          <option value="true">Reviewed</option>
        </select>

        <button
          onClick={() => fetchLogs(1)}
          className="px-4 py-1.5 rounded-lg bg-[#5C8B5C] text-white text-xs font-bold hover:bg-[#3D6B3D] transition-colors"
          style={{ minHeight: '32px' }}
        >
          Apply
        </button>
      </div>

      {/* Log list */}
      <div className="divide-y divide-[#EDE5D4]">
        {loadingLogs && (
          <div className="py-12 text-center text-sm text-[#6B5744]">Loading safety logs...</div>
        )}

        {!loadingLogs && error && (
          <div className="py-8 text-center text-sm text-[#C62828]">{error}</div>
        )}

        {!loadingLogs && !error && safetyLogs.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-[#5C8B5C]">No flagged items match the current filter.</p>
            <p className="text-xs text-[#6B5744] mt-1">That is a good sign!</p>
          </div>
        )}

        {!loadingLogs && safetyLogs.map((entry) => {
          const hasCritical = entry.flags.some(isCriticalFlag);

          return (
            <div
              key={entry.id}
              className="px-6 py-4 hover:bg-[#FAF7F0] transition-colors"
              style={hasCritical ? { borderLeft: '4px solid #C62828', paddingLeft: '20px' } : {}}
            >
              {/* Top row: timestamp, source badge, student info */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Source badge */}
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={
                      entry.source === 'student_input'
                        ? { background: '#FFF3E0', color: '#E65100' }
                        : { background: '#E8EAF6', color: '#283593' }
                    }
                  >
                    {entry.source === 'student_input' ? 'Student Input' : 'AI Response'}
                  </span>

                  {/* Time */}
                  <span className="text-xs text-[#6B5744]">{formatTime(entry.timestamp)}</span>

                  {/* Student info */}
                  {entry.studentId && (
                    <span className="text-xs text-[#6B5744]">
                      Student: <span className="font-semibold text-[#3D2E1E]">{entry.studentId}</span>
                      {entry.studentAge ? ` (age ${entry.studentAge})` : ''}
                    </span>
                  )}
                </div>

                {/* Review button / reviewed stamp */}
                <div className="flex-shrink-0">
                  {entry.reviewed ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E8F5E8] text-[#2E7D32] border border-[#A5D6A7]">
                      Reviewed
                    </span>
                  ) : (
                    <button
                      onClick={() => handleMarkReviewed(entry.id)}
                      disabled={reviewingId === entry.id}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      style={{
                        background: hasCritical ? '#C62828' : '#5C8B5C',
                        color: 'white',
                        minHeight: '32px',
                      }}
                    >
                      {reviewingId === entry.id ? 'Saving...' : 'Mark as Reviewed'}
                    </button>
                  )}
                </div>
              </div>

              {/* Flag badges */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {entry.flags.map((flag) => {
                  const meta = getFlagMeta(flag);
                  return (
                    <span
                      key={flag}
                      className="px-2 py-0.5 rounded-full text-xs font-bold border"
                      style={{ background: meta.bg, color: meta.text, borderColor: meta.border }}
                    >
                      {meta.label}
                    </span>
                  );
                })}
              </div>

              {/* Content preview */}
              {entry.preview && (
                <p className="mt-2 text-xs text-[#6B5744] font-mono bg-[#F5F0E8] rounded-lg px-3 py-2 border border-[#E8DEC8] break-words">
                  {entry.preview}
                </p>
              )}

              {/* Filtered version (for AI responses) */}
              {entry.filteredText && entry.filteredText !== entry.preview && (
                <div className="mt-1.5">
                  <p className="text-xs text-[#5C8B5C] font-semibold mb-1">Filtered version sent to student:</p>
                  <p className="text-xs text-[#6B5744] font-mono bg-[#F0F8F0] rounded-lg px-3 py-2 border border-[#C8E6C9] break-words">
                    {entry.filteredText}
                  </p>
                </div>
              )}

              {/* Reviewed metadata */}
              {entry.reviewed && entry.reviewedAt && (
                <p className="mt-1.5 text-xs text-[#9E8A6E]">
                  Reviewed {formatTime(entry.reviewedAt)}{entry.reviewedBy ? ` by ${entry.reviewedBy}` : ''}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination footer */}
      {pagination.totalPages > 1 && (
        <div className="px-6 py-3 border-t border-[#E8DEC8] flex items-center justify-between bg-[#FAF7F0]">
          <p className="text-xs text-[#6B5744]">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} entries)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 rounded-lg border border-[#E8DEC8] bg-white text-xs font-bold text-[#6B5744] hover:bg-[#F5F0E8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              style={{ minHeight: '32px', minWidth: '80px' }}
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 rounded-lg border border-[#E8DEC8] bg-white text-xs font-bold text-[#6B5744] hover:bg-[#F5F0E8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              style={{ minHeight: '32px', minWidth: '80px' }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main admin dashboard component
// ============================================================================

export default function AdminDashboard() {
  const [stats, setStats] = useState(MOCK_STATS);
  const [sessions, setSessions] = useState(MOCK_RECENT_SESSIONS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const token = getItem('token');
        const response = await fetch(`${apiUrl}/api/admin/dashboard`, {
          signal: AbortSignal.timeout(5000),
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (response.ok) {
          const data = await response.json();
          const d = data.data || data;
          setStats({
            totalStudents: d.totalStudents ?? MOCK_STATS.totalStudents,
            totalBooks: d.totalBooks ?? MOCK_STATS.totalBooks,
            activeSessions: d.activeSessions ?? MOCK_STATS.activeSessions,
            avgGrammarScore: d.avgGrammarScore ?? MOCK_STATS.avgGrammarScore,
          });
          // Use real recent sessions if available
          if (d.recentSessions && d.recentSessions.length > 0) {
            setSessions(
              d.recentSessions.map((s, idx) => ({
                id: s.id || idx,
                studentName: s.studentName || 'Unknown',
                bookTitle: s.bookTitle || 'Unknown',
                stage: s.stage || 'Body',
                grammarScore: s.grammarScore || 0,
                timestamp: s.date || new Date().toISOString(),
                status: s.status || 'completed',
              }))
            );
          }
        } else {
          setStats(MOCK_STATS);
        }
      } catch (err) {
        console.warn('Failed to fetch stats, using mock data:', err);
        setStats(MOCK_STATS);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const statCards = [
    { label: 'Total Students', value: stats.totalStudents, icon: '👨‍🎓', color: '#5C8B5C' },
    { label: 'Total Books', value: stats.totalBooks, icon: '📚', color: '#D4A843' },
    { label: 'Active Sessions', value: stats.activeSessions, icon: '⏳', color: '#87CEDB' },
    { label: 'Avg Grammar Score', value: `${stats.avgGrammarScore}%`, icon: '📝', color: '#D4736B' },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => (
          <div
            key={idx}
            className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border-l-4 border-[#E8DEC8] hover:-translate-y-0.5 transition-transform"
            style={{ borderLeftColor: stat.color }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#6B5744] text-sm font-semibold">{stat.label}</p>
                <p className="text-3xl font-extrabold text-[#3D2E1E] mt-2">{stat.value}</p>
              </div>
              <span className="text-4xl">{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4">
        <Link
          href="/admin/analytics"
          className="px-6 py-3 bg-[#3D6B3D] text-white rounded-xl hover:bg-[#2E5230] transition-all font-bold shadow-[0_2px_8px_rgba(61,46,30,0.25)] hover:-translate-y-0.5"
          style={{ minHeight: '48px', minWidth: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <span>Analytics Dashboard</span>
          <span style={{ opacity: 0.8 }}>→</span>
        </Link>
        <Link
          href="/admin/students"
          className="px-6 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] transition-all font-bold shadow-[0_2px_8px_rgba(61,107,61,0.3)] hover:-translate-y-0.5"
          style={{ minHeight: '48px', minWidth: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          Add Student
        </Link>
        <Link
          href="/admin/books"
          className="px-6 py-3 bg-[#D4A843] text-white rounded-xl hover:bg-[#B8903A] transition-all font-bold shadow-[0_2px_8px_rgba(212,168,67,0.3)] hover:-translate-y-0.5"
          style={{ minHeight: '48px', minWidth: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          Add Book
        </Link>
        <Link
          href="/admin/reports"
          className="px-6 py-3 bg-[#87CEDB] text-[#3D2E1E] rounded-xl hover:bg-[#5BA8B8] hover:text-white transition-all font-bold shadow-[0_2px_8px_rgba(135,206,219,0.3)] hover:-translate-y-0.5"
          style={{ minHeight: '48px', minWidth: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          View Reports
        </Link>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessions Per Week Chart */}
        <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
          <h3 className="text-lg font-extrabold text-[#3D2E1E] mb-4">Sessions Per Week</h3>
          <div className="flex items-end justify-around h-64 gap-2">
            {WEEKLY_SESSIONS.map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                <div
                  className="rounded-t-lg w-full transition-all hover:opacity-80"
                  style={{
                    height: `${(item.sessions / maxSessions) * 200}px`,
                    minHeight: '20px',
                    backgroundColor: '#D4A843',
                  }}
                  title={`${item.sessions} sessions`}
                />
                <span className="text-xs font-bold text-[#6B5744]">{item.day}</span>
                <span className="text-xs text-[#6B5744]">{item.sessions}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Level Distribution Chart */}
        <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
          <h3 className="text-lg font-extrabold text-[#3D2E1E] mb-4">Level Distribution</h3>
          <div className="flex items-center justify-center gap-8 h-64">
            <svg viewBox="0 0 200 200" className="w-48 h-48">
              <circle cx="100" cy="100" r="80" fill="#C8E6C9" />
              <circle cx="100" cy="100" r="70" fill="#FFFCF3" />
              <circle
                cx="100"
                cy="100"
                r="80"
                fill="none"
                stroke="#FFE0B2"
                strokeWidth="16"
                strokeDasharray={`${(LEVEL_DISTRIBUTION.Intermediate / 24) * 502} 502`}
              />
              <text
                x="100"
                y="100"
                textAnchor="middle"
                dy="0.3em"
                fontSize="18"
                fontWeight="bold"
                fill="#3D2E1E"
              >
                {LEVEL_DISTRIBUTION.Beginner}
              </text>
            </svg>
            <div className="space-y-3">
              {Object.entries(LEVEL_DISTRIBUTION).map(([level, count], idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{
                      backgroundColor:
                        level === 'Beginner'
                          ? '#C8E6C9'
                          : level === 'Intermediate'
                          ? '#FFE0B2'
                          : '#E1BEE7',
                    }}
                  />
                  <span className="text-sm font-semibold text-[#6B5744]">
                    {level}: {count} students
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-extrabold text-[#3D2E1E]">Recent Sessions</h3>
          <Link
            href="/admin/reports"
            className="text-[#5C8B5C] hover:text-[#3D6B3D] text-sm font-bold transition-colors"
          >
            View All
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#E8DEC8]">
                <th className="text-left py-3 px-4 font-bold text-[#6B5744]">Student</th>
                <th className="text-left py-3 px-4 font-bold text-[#6B5744]">Book</th>
                <th className="text-left py-3 px-4 font-bold text-[#6B5744]">Stage</th>
                <th className="text-left py-3 px-4 font-bold text-[#6B5744]">Grammar</th>
                <th className="text-left py-3 px-4 font-bold text-[#6B5744]">Status</th>
                <th className="text-left py-3 px-4 font-bold text-[#6B5744]">Time</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr
                  key={session.id}
                  className="border-b border-[#EDE5D4] hover:bg-[#F5F0E8] transition-colors"
                >
                  <td className="py-3 px-4 font-semibold text-[#3D2E1E]">{session.studentName}</td>
                  <td className="py-3 px-4 text-[#6B5744] max-w-xs truncate">
                    {session.bookTitle}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: (STAGE_BADGE_STYLES[session.stage] || { bg: '#E8F5E8' }).bg,
                        color: (STAGE_BADGE_STYLES[session.stage] || { text: '#3D6B3D' }).text,
                      }}
                    >
                      {session.stage}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: session.grammarScore >= 80 ? '#C8E6C9' : '#FFF8E1',
                        color: session.grammarScore >= 80 ? '#2E7D32' : '#8C6D00',
                      }}
                    >
                      {session.grammarScore}%
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: session.status === 'completed' ? '#C8E6C9' : '#E0F4F9',
                        color: session.status === 'completed' ? '#2E7D32' : '#2A7A8C',
                      }}
                    >
                      {session.status === 'completed' ? 'Done' : 'Active'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#6B5744] text-xs">
                    {formatTime(session.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safety Monitor */}
      <SafetyMonitor />
    </div>
  );
}
