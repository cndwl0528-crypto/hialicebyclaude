'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import LoadingCard from '@/components/LoadingCard';
import { getItem, setItem } from '@/lib/clientStorage';
import { getToken, API_BASE } from '@/lib/auth';
import {
  updateNotificationPrefs,
  getParentNotifications,
  markNotificationRead,
} from '@/services/api';

/**
 * ParentDashboard — /parent
 *
 * Displays a summary of each linked child's reading progress, recent sessions,
 * the latest HiMax AI feedback, unread parent notifications, and a
 * collapsible Notification Settings panel.
 *
 * Auth: requires a valid JWT stored under sessionStorage key "token".
 * The decoded payload must carry role === "parent" (or admin variants).
 */

// ── Accessible toggle switch ──────────────────────────────────────────────────
function ToggleSwitch({ id, checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#F0EAD8] last:border-0">
      <div className="flex-1 pr-4">
        <label
          htmlFor={id}
          className="text-sm font-medium text-[#3D2E1E] cursor-pointer select-none"
        >
          {label}
        </label>
        {description && (
          <p className="text-xs text-[#6B5744] mt-0.5">{description}</p>
        )}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2
          focus-visible:ring-[#5C8B5C] focus-visible:ring-offset-2
          ${checked ? 'bg-[#5C8B5C]' : 'bg-[#B8AFA0]'}`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
            transition duration-200 ease-in-out
            ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  );
}

// ── Bell icon button with optional unread badge ───────────────────────────────
function BellButton({ count, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={count > 0 ? `${count} unread notifications` : 'Notifications'}
      className="relative p-2 rounded-full hover:bg-[#E8DEC8] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C8B5C]"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke={count > 0 ? '#3D6B3D' : '#6B5744'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-7 h-7"
        aria-hidden="true"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center
            rounded-full bg-red-500 text-[10px] font-bold text-white leading-none"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ParentDashboard() {
  const router = useRouter();

  // Child / session data
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [childData, setChildData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Notification inbox
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);

  // Notification preferences
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [prefsError, setPrefsError] = useState('');
  const [prefs, setPrefs] = useState({
    emailEnabled: true,
    sessionAlerts: true,
    weeklyReport: false,
    notificationEmail: '',
  });

  const savedTimerRef = useRef(null);

  const API = API_BASE;

  // ── Load preferences from clientStorage on mount ──────────────────────────
  useEffect(() => {
    const stored = getItem('notificationPrefs');
    if (stored) {
      try {
        setPrefs((prev) => ({ ...prev, ...JSON.parse(stored) }));
      } catch {
        // Ignore malformed stored value
      }
    }
    const storedEmail = getItem('parentEmail');
    if (storedEmail) {
      setPrefs((prev) => ({
        ...prev,
        notificationEmail: prev.notificationEmail || storedEmail,
      }));
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearTimeout(savedTimerRef.current);
  }, []);

  // ── Fetch parent profile & linked children ─────────────────────────────
  const fetchChildren = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.push('/');
      return;
    }
    try {
      const r = await fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        router.push('/');
        return;
      }
      const data = await r.json();
      const kids = data.children || [];
      setChildren(kids);
      if (kids.length > 0) {
        setSelectedChild(kids[0]);
      } else {
        setLoading(false);
      }
    } catch {
      router.push('/');
    }
  }, [API, router]);

  // ── Fetch analytics + notifications for the selected child ────────────
  const fetchChildData = useCallback(
    async (childId) => {
      if (!childId) return;
      const token = getToken();
      setLoading(true);
      try {
        const [analyticsRes, notifData] = await Promise.all([
          fetch(`${API}/api/admin/students/${childId}/analytics`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          getParentNotifications(),
        ]);

        if (analyticsRes.ok) {
          const analytics = await analyticsRes.json();
          // Support both response shapes: { data: {...} } and flat { student, ... }
          setChildData(analytics.data || analytics);
        }

        if (notifData) {
          const list = notifData.notifications || [];
          setNotifications(list);
          setUnreadCount(
            notifData.unreadCount ?? list.filter((n) => !n.isRead).length
          );
          // Hydrate server-side preferences into local state
          if (notifData.prefs) {
            setPrefs((prev) => ({ ...prev, ...notifData.prefs }));
          }
        }
      } catch (e) {
        console.warn('Parent dashboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    },
    [API]
  );

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  useEffect(() => {
    if (selectedChild) {
      fetchChildData(selectedChild.id);
    }
  }, [selectedChild, fetchChildData]);

  // ── Mark a single notification as read ────────────────────────────────────
  const markNotifRead = async (notifId) => {
    try {
      await markNotificationRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Notification read-state failures are non-fatal.
    }
  };

  // ── Mark all notifications as read ────────────────────────────────────────
  const markAllRead = async () => {
    try {
      await markNotificationRead('all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Non-fatal
    }
  };

  // ── Save notification preferences ─────────────────────────────────────────
  const savePrefs = async () => {
    if (prefs.emailEnabled && prefs.notificationEmail) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(prefs.notificationEmail)) {
        setPrefsError('Please enter a valid email address.');
        return;
      }
    }
    setPrefsError('');
    setPrefsSaving(true);
    try {
      await updateNotificationPrefs(prefs);
      setItem('notificationPrefs', JSON.stringify(prefs));
      setPrefsSaved(true);
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setPrefsSaved(false), 3000);
    } catch (err) {
      setPrefsError('Failed to save preferences. Please try again.');
      console.error('Save prefs error:', err);
    } finally {
      setPrefsSaving(false);
    }
  };

  // ── Notification type icon helper ──────────────────────────────────────────
  const notifIcon = (type) => {
    if (type === 'session_complete') return '✅';
    if (type === 'achievement') return '🏆';
    if (type === 'weekly_report') return '📊';
    return '📬';
  };

  // ── Derived values ─────────────────────────────────────────────────────
  const studentProfile = childData?.student;
  const recentSessions = childData?.sessions || [];
  const vocabSummary = childData?.vocabulary;

  // ── Print handler — opens browser print/save-as-PDF dialog ────────────
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // ── Derived report values ───────────────────────────────────────────────
  const printDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Date range label: last 7 days
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekRangeLabel = `${weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const sessionsThisWeek = recentSessions.filter((s) => {
    if (!s.completedAt) return false;
    return new Date(s.completedAt) >= weekAgo;
  });

  const avgGrammarScore =
    recentSessions.length > 0
      ? Math.round(
          recentSessions.reduce((sum, s) => sum + (s.grammarScore ?? 0), 0) /
            recentSessions.length
        )
      : null;

  // Simple growth trend: compare first half vs second half grammar scores
  const computeTrendText = () => {
    if (recentSessions.length < 4) return 'Not enough data yet — keep reading!';
    const mid = Math.floor(recentSessions.length / 2);
    const olderAvg =
      recentSessions.slice(mid).reduce((s, r) => s + (r.grammarScore ?? 0), 0) /
      (recentSessions.length - mid);
    const recentAvg =
      recentSessions.slice(0, mid).reduce((s, r) => s + (r.grammarScore ?? 0), 0) / mid;
    const diff = recentAvg - olderAvg;
    if (diff >= 5) return `Improving — grammar score is up approximately ${Math.round(diff)} points over recent sessions.`;
    if (diff <= -5) return `Needs attention — grammar score has dipped approximately ${Math.round(Math.abs(diff))} points recently. More practice recommended.`;
    return 'Steady — performance is consistent across recent sessions.';
  };

  const recommendedNextSteps = [
    avgGrammarScore !== null && avgGrammarScore < 70
      ? 'Focus on sentence structure: encourage your child to speak in full sentences during everyday conversation.'
      : 'Keep up the great grammar work! Introduce more complex sentence patterns.',
    sessionsThisWeek.length < 2
      ? 'Aim for at least 2 reading sessions per week to build consistent habits.'
      : 'Excellent consistency this week! Try a slightly harder book next session.',
    (vocabSummary?.total ?? studentProfile?.totalWords ?? 0) < 20
      ? 'Review vocabulary flashcards together to reinforce new words from sessions.'
      : 'Practice using learned vocabulary in short journal entries or daily conversations.',
  ];

  return (
    <div className="min-h-screen bg-[#F5F0E8] p-4 max-w-2xl mx-auto">

      {/* ── PRINT-ONLY: Report header ───────────────────────────────────── */}
      <div className="print-only print-report-header" aria-hidden="true">
        <div className="print-logo">HiMax — Weekly Learning Report</div>
        <div className="print-meta">
          {studentProfile ? (
            <>
              <strong>{studentProfile.name}</strong><br />
              Level: {studentProfile.level} &bull; Age: {studentProfile.age}<br />
            </>
          ) : (
            <strong>{selectedChild?.name || 'Student'}</strong>
          )}
          Report period: {weekRangeLabel}<br />
          Generated: {printDate}
        </div>
      </div>

      {/* ── PRINT-ONLY: Weekly report content ──────────────────────────── */}
      <div className="print-only" aria-hidden="true">

        {/* Summary stats */}
        <div className="print-section">
          <h2>Weekly Summary</h2>
          <div className="print-stat-grid">
            <div className="print-stat-cell">
              <span className="stat-value">{sessionsThisWeek.length}</span>
              <span className="stat-label">Sessions This Week</span>
            </div>
            <div className="print-stat-cell">
              <span className="stat-value">
                {vocabSummary?.total ?? studentProfile?.totalWords ?? 0}
              </span>
              <span className="stat-label">Total Words Learned</span>
            </div>
            <div className="print-stat-cell">
              <span className="stat-value">
                {avgGrammarScore !== null ? `${avgGrammarScore}%` : '—'}
              </span>
              <span className="stat-label">Avg Grammar Score</span>
            </div>
          </div>
          {avgGrammarScore !== null && (
            <div style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '9pt', color: '#555', marginBottom: '4px' }}>
                Average Grammar Score
              </p>
              <div className="print-score-bar">
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${avgGrammarScore}%` }} />
                </div>
                <span className="bar-label">{avgGrammarScore}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Growth Trend */}
        <div className="print-section">
          <h2>Growth Trend</h2>
          <p>{computeTrendText()}</p>
          {recentSessions.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '9pt' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ccc' }}>
                  <th style={{ textAlign: 'left', padding: '3px 6px' }}>Book</th>
                  <th style={{ textAlign: 'center', padding: '3px 6px' }}>Date</th>
                  <th style={{ textAlign: 'center', padding: '3px 6px' }}>Grammar</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.slice(0, 8).map((session, i) => (
                  <tr key={session.id ?? i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '3px 6px' }}>
                      {session.bookTitle || 'Reading Session'}
                    </td>
                    <td style={{ padding: '3px 6px', textAlign: 'center' }}>
                      {session.completedAt
                        ? new Date(session.completedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'In progress'}
                    </td>
                    <td style={{ padding: '3px 6px', textAlign: 'center' }}>
                      {session.grammarScore != null ? `${session.grammarScore}/10` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Latest AI Feedback */}
        {recentSessions[0]?.ai_feedback && (
          <div className="print-section">
            <h2>Latest HiMax AI Feedback</h2>
            <p style={{ fontStyle: 'italic' }}>
              &ldquo;{recentSessions[0].ai_feedback}&rdquo;
            </p>
          </div>
        )}

        {/* Recommended Next Steps */}
        <div className="print-section">
          <h2>Recommended Next Steps</h2>
          <ul style={{ paddingLeft: '16px', margin: 0 }}>
            {recommendedNextSteps.map((step, i) => (
              <li key={i} style={{ marginBottom: '6px', fontSize: '10pt', color: '#222' }}>
                {step}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── PRINT-ONLY: Footer ─────────────────────────────────────────── */}
      <div className="print-only print-report-footer" aria-hidden="true">
        Generated by Hi Alice Reading Program &bull; himax.app &bull; {printDate}
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-[#3D2E1E]">Parent Dashboard</h1>
          <p className="text-sm text-[#6B5744]">Track your child's reading journey</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Download Weekly Report button */}
          <button
            onClick={handlePrint}
            aria-label="Download or print the weekly learning report as PDF"
            className="flex items-center gap-2 min-h-[40px] px-4 py-2 bg-[#3D2E1E] text-white rounded-xl hover:bg-[#6B5744] transition-all font-bold hover:-translate-y-0.5 shadow-[0_3px_10px_rgba(61,46,30,0.3)] focus-visible:ring-2 focus-visible:ring-[#3D2E1E] text-sm"
          >
            {/* Printer SVG icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Weekly Report
          </button>

          {/* Bell button — always visible, badge shows unread count */}
          <BellButton
            count={unreadCount}
            onClick={() => setNotifPanelOpen((v) => !v)}
          />
        </div>
      </div>

      {/* ── Inline notification panel (toggled by bell button) ───────────── */}
      {notifPanelOpen && (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-[#E8DEC8] p-4 mb-4 no-print">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-[#3D2E1E] text-sm">Notifications</h2>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-[#5C8B5C] hover:underline focus:outline-none
                  focus-visible:ring-1 focus-visible:ring-[#5C8B5C] rounded"
              >
                Mark all as read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-[#6B5744] text-center py-4">
              No notifications yet
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {notifications.slice(0, 10).map((notif) => (
                <div
                  key={notif.id}
                  role="button"
                  tabIndex={0}
                  aria-label={notif.isRead ? notif.title : `Unread: ${notif.title}`}
                  onClick={() => !notif.isRead && markNotifRead(notif.id)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !notif.isRead) {
                      markNotifRead(notif.id);
                    }
                  }}
                  className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                    notif.isRead
                      ? 'bg-[#F9FAFB] cursor-default'
                      : 'bg-[#EEF5F0] border border-[#5C8B5C]/20 cursor-pointer hover:bg-[#E0EDE6]'
                  }`}
                >
                  <span className="text-xl flex-shrink-0" aria-hidden="true">
                    {notifIcon(notif.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#3D2E1E] leading-snug">
                      {notif.title || 'New Update'}
                    </p>
                    <p className="text-xs text-[#6B5744] mt-0.5 leading-snug">
                      {notif.message}
                    </p>
                    <p className="text-[10px] text-[#B8AFA0] mt-1">
                      {notif.createdAt
                        ? new Date(notif.createdAt).toLocaleString()
                        : ''}
                    </p>
                  </div>
                  {!notif.isRead && (
                    <span className="w-2 h-2 bg-[#5C8B5C] rounded-full flex-shrink-0 mt-1.5" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Child selector tabs (only when multiple children) ───────────── */}
      {children.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-print">
          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => setSelectedChild(child)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedChild?.id === child.id
                  ? 'bg-[#5C8B5C] text-white'
                  : 'bg-white text-[#5C8B5C] border border-[#5C8B5C]'
              }`}
            >
              {child.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Main content (screen only) ───────────────────────────────────── */}
      <div className="no-print">
      {loading ? (
        <div className="space-y-4">
          <LoadingCard lines={4} />
          <LoadingCard lines={3} />
        </div>
      ) : selectedChild && studentProfile ? (
        <div className="space-y-4">

          {/* Stats overview card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-[#E8DEC8] p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl" aria-hidden="true">
                {studentProfile.avatarEmoji || '📚'}
              </span>
              <div>
                <h2 className="text-lg font-bold text-[#3D2E1E]">{studentProfile.name}</h2>
                <p className="text-sm text-[#6B5744] capitalize">
                  {studentProfile.level} level &bull; Age {studentProfile.age}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Books Read', value: studentProfile.totalBooks ?? 0, icon: '📖' },
                { label: 'Words Learned', value: vocabSummary?.total ?? studentProfile.totalWords ?? 0, icon: '💡' },
                { label: 'Day Streak', value: studentProfile.streak ?? 0, icon: '🔥' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-[#F5F0E8] rounded-xl p-3 text-center"
                >
                  <div className="text-2xl mb-1" aria-hidden="true">{stat.icon}</div>
                  <div className="text-xl font-bold text-[#3D2E1E]">{stat.value}</div>
                  <div className="text-xs text-[#6B5744]">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent sessions */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-[#E8DEC8] p-5">
            <h3 className="font-bold text-[#3D2E1E] mb-3">Recent Sessions</h3>
            <div className="space-y-2">
              {recentSessions.slice(0, 5).map((session, i) => (
                <div
                  key={session.id ?? i}
                  className="flex items-center gap-3 py-2 border-b border-[#F5F0E8] last:border-0"
                >
                  <span className="text-2xl" aria-hidden="true">📚</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#3D2E1E] truncate">
                      {session.bookTitle || 'Book Session'}
                    </p>
                    <p className="text-xs text-[#6B5744]">
                      {session.completedAt
                        ? new Date(session.completedAt).toLocaleDateString()
                        : 'In progress'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-[#5C8B5C]">
                      {session.grammarScore != null ? `${session.grammarScore}/10` : '—'}
                    </div>
                    <div className="text-xs text-[#6B5744]">grammar</div>
                  </div>
                </div>
              ))}
              {recentSessions.length === 0 && (
                <p className="text-sm text-[#6B5744] text-center py-4">
                  No sessions yet — time to start reviewing!
                </p>
              )}
            </div>
          </div>

          {/* Latest HiMax AI feedback */}
          {recentSessions[0]?.ai_feedback && (
            <div className="bg-gradient-to-br from-[#FFF8E0] to-[#F5E8A8] border border-[#D4A843]/30 rounded-2xl shadow-md p-5">
              <h3 className="font-bold text-[#6B5744] mb-2 flex items-center gap-2">
                <span aria-hidden="true">🤖</span> HiMax&apos;s Latest Feedback
              </h3>
              <p className="text-sm text-[#3D2E1E] italic">
                &ldquo;{recentSessions[0].ai_feedback}&rdquo;
              </p>
            </div>
          )}

          {/* ── Notification Settings (collapsible) ──────────────────── */}
          <details className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-[#E8DEC8] overflow-hidden group">
            <summary
              className="flex items-center justify-between px-5 py-4 cursor-pointer list-none
                hover:bg-[#F5F0E8] transition-colors focus:outline-none
                focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5C8B5C]"
            >
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3D6B3D"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5 flex-shrink-0"
                  aria-hidden="true"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span className="font-bold text-[#3D2E1E]">Notification Settings</span>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6B5744"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </summary>

            <div className="px-5 pb-5 pt-1 border-t border-[#F0EAD8]">
              <ToggleSwitch
                id="toggle-email-enabled"
                checked={prefs.emailEnabled}
                onChange={(val) => setPrefs((p) => ({ ...p, emailEnabled: val }))}
                label="Email notifications"
                description="Receive updates about your child's progress by email"
              />
              <ToggleSwitch
                id="toggle-session-alerts"
                checked={prefs.sessionAlerts}
                onChange={(val) => setPrefs((p) => ({ ...p, sessionAlerts: val }))}
                label="Session completion alerts"
                description="Get notified each time your child finishes a reading session"
              />
              <ToggleSwitch
                id="toggle-weekly-report"
                checked={prefs.weeklyReport}
                onChange={(val) => setPrefs((p) => ({ ...p, weeklyReport: val }))}
                label="Weekly progress report"
                description="A weekly summary of books read, words learned, and streaks"
              />

              <div className="mt-4">
                <label
                  htmlFor="notification-email"
                  className="block text-sm font-medium text-[#3D2E1E] mb-1"
                >
                  Notification email address
                </label>
                <input
                  id="notification-email"
                  type="email"
                  autoComplete="email"
                  disabled={!prefs.emailEnabled}
                  value={prefs.notificationEmail}
                  onChange={(e) =>
                    setPrefs((p) => ({ ...p, notificationEmail: e.target.value }))
                  }
                  placeholder="parent@example.com"
                  className={`w-full px-3 py-2 rounded-xl border text-sm transition-colors
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C8B5C]
                    ${prefs.emailEnabled
                      ? 'border-[#C8B99A] bg-white text-[#3D2E1E] placeholder:text-[#B8AFA0]'
                      : 'border-[#E8DEC8] bg-[#F5F0E8] text-[#B8AFA0] cursor-not-allowed'
                    }`}
                />
                {!prefs.emailEnabled && (
                  <p className="text-xs text-[#B8AFA0] mt-1">
                    Enable &ldquo;Email notifications&rdquo; above to edit this field.
                  </p>
                )}
              </div>

              {prefsError && (
                <p role="alert" className="text-xs text-red-600 mt-2">
                  {prefsError}
                </p>
              )}

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={savePrefs}
                  disabled={prefsSaving}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white
                    bg-[#3D6B3D] hover:bg-[#5C8B5C] active:bg-[#2E5230]
                    disabled:opacity-60 disabled:cursor-not-allowed
                    transition-colors focus:outline-none focus-visible:ring-2
                    focus-visible:ring-[#3D6B3D] focus-visible:ring-offset-2"
                >
                  {prefsSaving ? 'Saving…' : 'Save Preferences'}
                </button>
                {prefsSaved && (
                  <p role="status" aria-live="polite" className="text-sm text-[#3D6B3D] font-medium">
                    Saved!
                  </p>
                )}
              </div>
            </div>
          </details>

          {/* Notification list — shown when bell panel is closed */}
          {notifications.length > 0 && !notifPanelOpen && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-[#E8DEC8] p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-[#3D2E1E]">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-[#5C8B5C] hover:underline focus:outline-none
                      focus-visible:ring-1 focus-visible:ring-[#5C8B5C] rounded"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {notifications.slice(0, 5).map((notif) => (
                  <div
                    key={notif.id}
                    role="button"
                    tabIndex={0}
                    aria-label={notif.isRead ? notif.title : `Unread: ${notif.title}`}
                    onClick={() => !notif.isRead && markNotifRead(notif.id)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !notif.isRead) {
                        markNotifRead(notif.id);
                      }
                    }}
                    className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                      notif.isRead
                        ? 'bg-[#F9FAFB] cursor-default'
                        : 'bg-[#EEF5F0] border border-[#5C8B5C]/20 cursor-pointer hover:bg-[#E0EDE6]'
                    }`}
                  >
                    <span className="text-xl flex-shrink-0" aria-hidden="true">
                      {notifIcon(notif.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#3D2E1E]">
                        {notif.title || 'New Update'}
                      </p>
                      <p className="text-xs text-[#6B5744]">{notif.message}</p>
                    </div>
                    {!notif.isRead && (
                      <span className="w-2 h-2 bg-[#5C8B5C] rounded-full flex-shrink-0 mt-1" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty state — no children linked */
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-[#E8DEC8] p-8 text-center">
          <div className="text-5xl mb-3" aria-hidden="true">👨‍👩‍👧</div>
          <p className="text-[#3D2E1E] font-medium">No children registered yet</p>
          <p className="text-sm text-[#6B5744] mt-1">
            Ask your admin to link your children&apos;s accounts
          </p>
        </div>
      )}
      </div>{/* end no-print wrapper */}

      {/* ── Navigation ─────────────────────────────────────────────────── */}
    </div>
  );
}
