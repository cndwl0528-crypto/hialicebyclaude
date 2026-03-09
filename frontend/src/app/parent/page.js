'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import LoadingCard from '@/components/LoadingCard';

/**
 * ParentDashboard — /parent
 *
 * Displays a summary of each linked child's reading progress, recent sessions,
 * the latest HiAlice AI feedback, and unread parent notifications.
 *
 * Auth: requires a valid JWT stored under sessionStorage key "token".
 * The decoded payload must carry role === "parent" (or admin variants).
 */
export default function ParentDashboard() {
  const router = useRouter();

  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [childData, setChildData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Safely read sessionStorage only on the client.
  const getToken = () =>
    typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;

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
        const [analyticsRes, notifRes] = await Promise.all([
          fetch(`${API}/api/admin/students/${childId}/analytics`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API}/api/auth/notifications`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (analyticsRes.ok) {
          const analytics = await analyticsRes.json();
          // Support both response shapes: { data: {...} } and flat { student, ... }
          setChildData(analytics.data || analytics);
        }

        if (notifRes.ok) {
          const notifData = await notifRes.json();
          const list = notifData.notifications || [];
          setNotifications(list);
          setUnreadCount(list.filter((n) => !n.is_read).length);
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

  // ── Mark a notification as read ───────────────────────────────────────
  const markNotifRead = async (notifId) => {
    const token = getToken();
    try {
      await fetch(`${API}/api/auth/notifications/${notifId}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Notification read-state failures are non-fatal.
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────
  const studentProfile = childData?.student;
  const recentSessions = childData?.sessions || [];
  const vocabSummary = childData?.vocabulary;

  return (
    <div className="min-h-screen bg-[#F5F0E8] p-4 max-w-2xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2C4A2E]">Parent Dashboard</h1>
          <p className="text-sm text-[#6B7280]">Track your child's reading journey</p>
        </div>
        {unreadCount > 0 && (
          <div className="relative">
            <span className="text-2xl" aria-label="Notifications">🔔</span>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          </div>
        )}
      </div>

      {/* ── Child selector tabs (only when multiple children) ───────────── */}
      {children.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => setSelectedChild(child)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedChild?.id === child.id
                  ? 'bg-[#4A7C59] text-white'
                  : 'bg-white text-[#4A7C59] border border-[#4A7C59]'
              }`}
            >
              {child.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────── */}
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
                <h2 className="text-lg font-bold text-[#2C4A2E]">{studentProfile.name}</h2>
                <p className="text-sm text-[#6B7280] capitalize">
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
                  <div className="text-xl font-bold text-[#2C4A2E]">{stat.value}</div>
                  <div className="text-xs text-[#6B7280]">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent sessions */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-[#E8DEC8] p-5">
            <h3 className="font-bold text-[#2C4A2E] mb-3">Recent Sessions</h3>
            <div className="space-y-2">
              {recentSessions.slice(0, 5).map((session, i) => (
                <div
                  key={session.id ?? i}
                  className="flex items-center gap-3 py-2 border-b border-[#F5F0E8] last:border-0"
                >
                  <span className="text-2xl" aria-hidden="true">📚</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#2C4A2E] truncate">
                      {session.bookTitle || 'Book Session'}
                    </p>
                    <p className="text-xs text-[#9CA3AF]">
                      {session.completedAt
                        ? new Date(session.completedAt).toLocaleDateString()
                        : 'In progress'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-[#4A7C59]">
                      {session.grammarScore != null ? `${session.grammarScore}/10` : '—'}
                    </div>
                    <div className="text-xs text-[#9CA3AF]">grammar</div>
                  </div>
                </div>
              ))}
              {recentSessions.length === 0 && (
                <p className="text-sm text-[#9CA3AF] text-center py-4">
                  No sessions yet — time to start reading!
                </p>
              )}
            </div>
          </div>

          {/* Latest HiAlice AI feedback */}
          {recentSessions[0]?.ai_feedback && (
            <div className="bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] border border-[#F59E0B]/30 rounded-2xl shadow-md p-5">
              <h3 className="font-bold text-[#92400E] mb-2 flex items-center gap-2">
                <span aria-hidden="true">🤖</span> HiAlice&apos;s Latest Feedback
              </h3>
              <p className="text-sm text-[#78350F] italic">
                &ldquo;{recentSessions[0].ai_feedback}&rdquo;
              </p>
            </div>
          )}

          {/* Notifications */}
          {notifications.length > 0 && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-[#E8DEC8] p-5">
              <h3 className="font-bold text-[#2C4A2E] mb-3">Notifications</h3>
              <div className="space-y-2">
                {notifications.slice(0, 5).map((notif) => (
                  <div
                    key={notif.id}
                    role="button"
                    tabIndex={0}
                    aria-label={notif.is_read ? notif.title : `Unread: ${notif.title}`}
                    onClick={() => !notif.is_read && markNotifRead(notif.id)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !notif.is_read) {
                        markNotifRead(notif.id);
                      }
                    }}
                    className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                      notif.is_read
                        ? 'bg-[#F9FAFB] cursor-default'
                        : 'bg-[#EEF5F0] border border-[#4A7C59]/20 cursor-pointer hover:bg-[#E0EDE6]'
                    }`}
                  >
                    <span className="text-xl flex-shrink-0" aria-hidden="true">
                      {notif.type === 'session_complete'
                        ? '✅'
                        : notif.type === 'achievement'
                        ? '🏆'
                        : '📊'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#2C4A2E]">
                        {notif.title || 'New Update'}
                      </p>
                      <p className="text-xs text-[#6B7280]">{notif.message}</p>
                    </div>
                    {!notif.is_read && (
                      <span className="w-2 h-2 bg-[#4A7C59] rounded-full flex-shrink-0 mt-1" />
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
          <p className="text-[#2C4A2E] font-medium">No children registered yet</p>
          <p className="text-sm text-[#9CA3AF] mt-1">
            Ask your admin to link your children&apos;s accounts
          </p>
        </div>
      )}

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => router.push('/')}
          className="flex-1 bg-[#4A7C59] text-white rounded-2xl py-3 font-bold hover:bg-[#2C4A2E] transition-colors"
          style={{ minHeight: '48px' }}
        >
          Home
        </button>
      </div>
    </div>
  );
}
