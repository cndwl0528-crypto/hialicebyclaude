'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getStudentSessions,
  getStudentAnalytics,
  getVocabStats,
  logout,
} from '@/services/api';
import LoadingCard from '@/components/LoadingCard';
import { isParentOrAdmin } from '@/lib/constants';

const MOCK_STUDENT = {
  id: 'demo-1',
  name: 'Alice',
  age: 7,
  level: 'Beginner',
  avatar: '👧',
  current_streak: 0,
};

const MOCK_SESSIONS = [
  { id: 1, bookTitle: 'The Very Hungry Caterpillar', date: '2026-03-08', levelScore: 85, grammarScore: 78, wordsLearned: 18, duration: 12, stages: { Title: 85, Introduction: 80, Body: 78, Conclusion: 85 } },
  { id: 2, bookTitle: 'Where the Wild Things Are', date: '2026-03-07', levelScore: 88, grammarScore: 82, wordsLearned: 22, duration: 15, stages: { Title: 88, Introduction: 85, Body: 82, Conclusion: 88 } },
  { id: 3, bookTitle: 'Winnie-the-Pooh', date: '2026-03-06', levelScore: 80, grammarScore: 75, wordsLearned: 20, duration: 14, stages: { Title: 80, Introduction: 78, Body: 75, Conclusion: 80 } },
];

const AVATAR_OPTIONS = ['👧', '👦', '🧒', '👩', '🧑', '😊', '🌟', '🎓'];

/**
 * Mirrors the ACHIEVEMENT_CATALOGUE from AchievementUnlock.jsx.
 * Keyed by the same achievement_type strings so earned badges can
 * be resolved to display metadata without importing the component.
 */
const ACHIEVEMENT_CATALOGUE = {
  'first-book':      { icon: '📚', label: 'First Book!' },
  'five-books':      { icon: '📚', label: 'Bookshelf Builder' },
  'ten-books':       { icon: '🏆', label: 'Reading Champion' },
  'word-50':         { icon: '💡', label: 'Word Wizard' },
  'word-100':        { icon: '🧠', label: 'Vocabulary Master' },
  'streak-3':        { icon: '🔥', label: '3-Day Streak!' },
  'streak-7':        { icon: '🌟', label: 'Week Warrior' },
  'grammar-90':      { icon: '✨', label: 'Grammar Star' },
  'perfect-session': { icon: '🎯', label: 'Perfect Session!' },
  'early-bird':      { icon: '🌅', label: 'Early Bird' },
  'night-owl':       { icon: '🦉', label: 'Night Owl' },
  'speed-reader':    { icon: '⚡', label: 'Speed Reader' },
  'deep-thinker':    { icon: '🤔', label: 'Deep Thinker' },
  'bookworm':        { icon: '🐛', label: 'Bookworm' },
};

const BADGES = [
  { id: 'first-book', label: 'First Book', emoji: '📚', condition: (sessions) => sessions.length >= 1 },
  { id: 'five-books', label: '5 Books', emoji: '📖', condition: (sessions) => sessions.length >= 5 },
  { id: 'word-master', label: 'Word Master', emoji: '📝', condition: (sessions) => sessions.reduce((sum, s) => sum + (s.wordsLearned || 0), 0) >= 50 },
  { id: 'grammar-pro', label: 'Grammar Pro', emoji: '✨', condition: (sessions) => sessions.length > 0 && sessions.reduce((sum, s) => sum + s.grammarScore, 0) / sessions.length >= 90 },
  { id: 'streak-3', label: '3-Day Streak', emoji: '🔥', condition: (sessions) => {
    if (sessions.length < 3) return false;
    const dates = sessions.slice(0, 3).map((s) => new Date(s.date));
    for (let i = 0; i < dates.length - 1; i++) {
      const diff = (dates[i].getTime() - dates[i + 1].getTime()) / (1000 * 60 * 60 * 24);
      if (diff !== 1) return false;
    }
    return true;
  }},
];

const GHIBLI = {
  primary: '#5C8B5C',
  primaryDark: '#3D6B3D',
  sky: '#87CEDB',
  gold: '#D4A843',
  success: '#7AC87A',
  bg: '#F5F0E8',
  card: '#FFFCF3',
  textDark: '#3D2E1E',
  textMid: '#6B5744',
};

function normalizeSession(s) {
  // Normalise API response fields to match the UI's expected shape.
  // Backend GET /sessions/student/:studentId returns camelCase fields:
  // { id, bookTitle, bookLevel, stage, isComplete, startedAt, completedAt, grammarScore, levelScore }
  const startedAt = s.startedAt || s.started_at;
  const completedAt = s.completedAt || s.completed_at;

  // Approximate duration in minutes from started/completed timestamps
  let duration = s.duration || s.durationMinutes || 0;
  if (!duration && startedAt && completedAt) {
    const diffMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    if (diffMs > 0) {
      duration = Math.round(diffMs / 60000);
    }
  }
  if (!duration && s.durationSeconds) {
    duration = Math.round(s.durationSeconds / 60);
  }

  return {
    id: s.id,
    bookTitle: s.bookTitle || s.book_title || s.title || 'Unknown Book',
    date: completedAt || startedAt || s.date || new Date().toISOString(),
    levelScore: s.levelScore ?? s.level_score ?? 0,
    grammarScore: s.grammarScore ?? s.grammar_score ?? 0,
    wordsLearned: s.wordsLearned || s.words_learned || s.wordCount || 0,
    duration,
    stage: s.stage || '',
    isComplete: s.isComplete ?? s.is_complete ?? false,
    stages: s.stages || s.stageScores || {},
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const [student, setStudent] = useState(MOCK_STUDENT);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(MOCK_STUDENT.avatar);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [analyticsAchievements, setAnalyticsAchievements] = useState([]);

  useEffect(() => {
    const storedName = sessionStorage.getItem('studentName');
    const storedLevel = sessionStorage.getItem('studentLevel');
    const storedId = sessionStorage.getItem('studentId');

    setStudent((prev) => ({
      ...prev,
      id: storedId || prev.id,
      name: storedName || prev.name,
      level: storedLevel || prev.level,
    }));

    fetchProfileData(storedId);
  }, []);

  async function fetchProfileData(studentId) {
    try {
      setLoading(true);
      setUsingFallback(false);

      if (!studentId) {
        setUsingFallback(true);
        setSessions(MOCK_SESSIONS);
        setLoading(false);
        return;
      }

      let sessionsData = null;
      let analyticsData = null;
      let vocabStatsData = null;

      try {
        [sessionsData, analyticsData, vocabStatsData] = await Promise.all([
          getStudentSessions(studentId),
          getStudentAnalytics(studentId),
          getVocabStats(studentId),
        ]);
      } catch (apiErr) {
        console.warn('API unavailable, using fallback data:', apiErr);
        setUsingFallback(true);
      }

      // Process sessions — backend returns { sessions: [...], stats: { ... } }
      if (sessionsData && sessionsData.sessions && sessionsData.sessions.length > 0) {
        const normalized = sessionsData.sessions.map(normalizeSession);
        setSessions(normalized);

        // Use aggregate stats from the sessions endpoint to update student info
        if (sessionsData.stats) {
          const apiStats = sessionsData.stats;
          setStudent((prev) => ({
            ...prev,
            current_streak: apiStats.streak ?? prev.current_streak,
          }));
        }
      } else if (sessionsData && Array.isArray(sessionsData) && sessionsData.length > 0) {
        setSessions(sessionsData.map(normalizeSession));
      } else {
        setUsingFallback(true);
        setSessions(MOCK_SESSIONS);
      }

      // Process vocabulary stats for total words learned
      if (vocabStatsData && vocabStatsData.stats) {
        const vStats = vocabStatsData.stats;
        // Update student's total words from vocab stats endpoint
        setStudent((prev) => ({
          ...prev,
          totalWordsFromAPI: vStats.totalWords || 0,
        }));
      }

      // Process analytics
      if (analyticsData && analyticsData.analytics) {
        const { achievements, student: analyticsStudent } = analyticsData.analytics;

        if (achievements && achievements.length > 0) {
          setAnalyticsAchievements(achievements);
        }

        // Update student streak from server if available
        if (analyticsStudent && analyticsStudent.current_streak !== undefined) {
          setStudent((prev) => ({
            ...prev,
            current_streak: analyticsStudent.current_streak,
          }));
        }
      }
    } catch (err) {
      console.error('Unexpected error loading profile:', err);
      setUsingFallback(true);
      setSessions(MOCK_SESSIONS);
    } finally {
      setLoading(false);
    }
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.warn('Logout error:', e);
    } finally {
      router.push('/');
    }
  };

  // Guard against empty sessions for computed values
  const hasSessions = sessions.length > 0;
  const totalBooksRead = sessions.length;
  // Prefer vocab stats from API; fall back to session-derived count
  const totalWordsLearned = student.totalWordsFromAPI
    || sessions.reduce((sum, s) => sum + (s.wordsLearned || 0), 0);
  const avgGrammarScore = hasSessions
    ? Math.round(sessions.reduce((sum, s) => sum + (s.grammarScore || 0), 0) / sessions.length)
    : 0;

  const calculateStreak = () => {
    if (!hasSessions) return student.current_streak || 0;
    const sortedSessions = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
    let streak = 1;
    for (let i = 0; i < sortedSessions.length - 1; i++) {
      const curr = new Date(sortedSessions[i].date);
      const next = new Date(sortedSessions[i + 1].date);
      const diff = (curr.getTime() - next.getTime()) / (1000 * 60 * 60 * 24);
      if (Math.round(diff) === 1) { streak++; } else { break; }
    }
    return Math.max(streak, student.current_streak || 0);
  };

  const currentStreak = calculateStreak();

  const getLevelProgress = () => {
    const levelMap = { Beginner: 1, beginner: 1, Intermediate: 2, intermediate: 2, Advanced: 3, advanced: 3 };
    const currentLevelNum = levelMap[student.level] || 1;
    const booksForNextLevel = currentLevelNum * 5;
    const progress = Math.min((totalBooksRead / booksForNextLevel) * 100, 100);
    return { progress: Math.round(progress), booksNeeded: Math.max(0, booksForNextLevel - totalBooksRead) };
  };

  const { progress: levelProgress, booksNeeded } = getLevelProgress();

  const getWeeklyData = () => {
    const weeks = [0, 0, 0, 0];
    const today = new Date();
    sessions.forEach((session) => {
      const sessionDate = new Date(session.date);
      const daysAgo = Math.floor((today.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(daysAgo / 7);
      if (weekIndex < 4) { weeks[weekIndex]++; }
    });
    return weeks.reverse();
  };

  const weeklyData = getWeeklyData();
  const maxWeeklyBooks = Math.max(...weeklyData, 1);

  const getGrammarTrend = () => sessions.slice().reverse().slice(0, 5).map((s) => s.grammarScore || 0);
  const grammarTrend = getGrammarTrend();

  const generateVocabChart = () => {
    const cumulativeWords = [];
    let total = 0;
    sessions.slice().reverse().forEach((s) => { total += s.wordsLearned || 0; cumulativeWords.push(total); });
    const maxWords = Math.max(...cumulativeWords, 1);
    const points = cumulativeWords.map((words, idx) => {
      const x = (idx / Math.max(cumulativeWords.length - 1, 1)) * 200;
      const y = 120 - (words / maxWords) * 100;
      return `${x},${y}`;
    }).join(' ');
    return { points, maxWords, count: cumulativeWords.length };
  };

  const { points: vocabPoints, maxWords } = generateVocabChart();

  const generateGrammarChart = () => {
    return grammarTrend.map((score, idx) => {
      const x = (idx / Math.max(grammarTrend.length - 1, 1)) * 200;
      const y = 120 - (score / 100) * 100;
      return `${x},${y}`;
    }).join(' ');
  };

  const grammarPoints = generateGrammarChart();

  // Merge BADGE conditions with server analytics achievements
  const earnedBadges = BADGES.filter((badge) => badge.condition(sessions));
  const unearnedBadges = BADGES.filter((badge) => !badge.condition(sessions));
  const serverAchievements = analyticsAchievements.filter(
    (a) => !earnedBadges.find((b) => b.id === a.id)
  );

  const handleAvatarChange = (avatar) => {
    setSelectedAvatar(avatar);
    setStudent((prev) => ({ ...prev, avatar }));
    setShowAvatarPicker(false);
  };

  if (loading) {
    return (
      <div className="py-6">
        <div className="space-y-6">
          <LoadingCard lines={3} />
          <LoadingCard lines={4} />
          <LoadingCard lines={2} />
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6">
      <div className="w-full">
        {/* Fallback notice */}
        {usingFallback && (
          <div
            className="mb-4 px-4 py-3 rounded-xl border-l-4 text-sm font-bold flex items-center gap-2"
            style={{ backgroundColor: '#FFF8E8', borderColor: '#D4A843', color: '#A8822E' }}
            role="status"
          >
            <span aria-hidden="true">💡</span>
            Showing example data. Sign in or connect to the internet to see your real progress.
          </div>
        )}

        {/* Student Profile Card */}
        <div className="rounded-3xl overflow-hidden shadow-[0_6px_28px_rgba(61,46,30,0.12)] mb-6">
          {/* Gradient header — richer multi-stop */}
          <div
            className="p-6 sm:p-8 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #3D6B3D 0%, #5C8B5C 45%, #87CEDB 100%)',
            }}
          >
            {/* Decorative background glow */}
            <div
              className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(168,222,234,0.2) 0%, transparent 70%)',
                transform: 'translate(20%, -20%)',
              }}
              aria-hidden="true"
            />
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-4 sm:gap-6">
                <button
                  className="text-7xl sm:text-8xl cursor-pointer hover:scale-110 transition-transform focus-visible:ring-2 focus-visible:ring-white rounded-2xl flex-shrink-0"
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  aria-label="Change avatar"
                  title="Click to change avatar"
                >
                  {student.avatar}
                </button>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-white drop-shadow-sm">{student.name}</h1>
                  {student.age && (
                    <p className="text-white/80 mt-0.5 sm:mb-3 text-sm font-semibold">Age {student.age}</p>
                  )}
                  {isParentOrAdmin() && (
                    <span className="inline-block mt-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-white/20 text-white font-extrabold text-xs sm:text-sm border border-white/30">
                      {student.level}
                    </span>
                  )}
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex-shrink-0 px-3 sm:px-4 py-2 min-h-[40px] bg-white/15 hover:bg-white/25 border border-white/30 text-white rounded-xl font-bold text-xs sm:text-sm transition-all hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Log out of HiAlice"
              >
                Log out
              </button>
            </div>
          </div>

          <div className="bg-[#FFFCF3] p-4 sm:p-6">
            {showAvatarPicker && (
              <div className="mb-6 pb-6 border-b border-[#E8DEC8]">
                <p className="text-[#6B5744] font-extrabold mb-3 text-sm">Choose Your Avatar:</p>
                <div className="flex gap-2 sm:gap-3 flex-wrap">
                  {AVATAR_OPTIONS.map((avatar) => (
                    <button
                      key={avatar}
                      onClick={() => handleAvatarChange(avatar)}
                      className={`text-4xl sm:text-5xl p-2 min-w-[52px] min-h-[52px] rounded-xl transition-all hover:-translate-y-0.5 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#5C8B5C] ${
                        selectedAvatar === avatar
                          ? 'ring-4 ring-[#5C8B5C] bg-[#E8F5E8]'
                          : 'hover:bg-[#F5F0E8]'
                      }`}
                      aria-label={`Select ${avatar} avatar`}
                      aria-pressed={selectedAvatar === avatar}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stats Grid — 4-col on sm+, 2-col on xs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {[
                { label: 'Books Read', value: totalBooksRead, color: GHIBLI.primary, icon: '📚' },
                { label: 'Words Learned', value: totalWordsLearned, color: GHIBLI.success, icon: '💡' },
                { label: 'Day Streak', value: currentStreak, color: GHIBLI.gold, icon: '🔥' },
                { label: 'Grammar Avg', value: hasSessions ? `${avgGrammarScore}%` : '—', color: GHIBLI.primary, icon: '✨' },
              ].map((stat, idx) => (
                <div key={idx} className="text-center p-3 sm:p-4 rounded-2xl bg-[#F5F0E8]">
                  <div className="text-lg sm:text-xl mb-1" aria-hidden="true">{stat.icon}</div>
                  <div className="text-2xl sm:text-3xl font-extrabold leading-none" style={{ color: stat.color }}>
                    {stat.value}
                  </div>
                  <p className="text-[#6B5744] text-[10px] sm:text-xs font-bold mt-1 leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Level Progress */}
        <div className="ghibli-card p-5 sm:p-6 mb-6">
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#3D2E1E] mb-4 flex items-center gap-2">
            <span aria-hidden="true">⬆️</span> Level Progress
          </h2>
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <div className="w-full bg-[#EDE5D4] rounded-full h-4 overflow-hidden">
                <div
                  className="h-4 rounded-full transition-all duration-500"
                  style={{ width: `${levelProgress}%`, backgroundColor: GHIBLI.success }}
                />
              </div>
              <p className="text-[#6B5744] text-sm font-semibold mt-2">
                {booksNeeded === 0
                  ? 'Ready to level up!'
                  : `${levelProgress}% to next level — ${booksNeeded} more books to go`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold" style={{ color: GHIBLI.primary }}>
                {levelProgress}%
              </p>
            </div>
          </div>
        </div>

        {/* Achievement Badges */}
        <div className="ghibli-card p-5 mb-6">
          <h2 className="font-extrabold text-[#3D2E1E] mb-4 flex items-center gap-2 text-xl sm:text-2xl">
            <span aria-hidden="true">🏆</span>
            Your Badges
            <span className="text-xs text-[#6B5744] font-normal ml-auto">
              {earnedBadges.length + serverAchievements.length} earned
            </span>
          </h2>

          {/* Compact grid of earned badges — merges local BADGES + server achievements */}
          <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-3 mb-5">
            {earnedBadges.map((badge) => (
              <div
                key={badge.id}
                className="flex flex-col items-center gap-1 p-2 sm:p-3 rounded-xl bg-[#E8F5E8] border border-[#C8E6C9]"
                title={badge.label}
                aria-label={`${badge.label} badge earned`}
              >
                <span className="text-2xl sm:text-3xl" aria-hidden="true">{badge.emoji}</span>
                <span className="text-[10px] text-center text-[#3D6B3D] font-bold leading-tight">{badge.label}</span>
              </div>
            ))}
            {serverAchievements.map((achievement, idx) => {
              const meta = ACHIEVEMENT_CATALOGUE[achievement.achievement_type || achievement.id] || {};
              return (
                <div
                  key={`server-${idx}`}
                  className="flex flex-col items-center gap-1 p-2 sm:p-3 rounded-xl bg-[#E8F5E8] border border-[#C8E6C9]"
                  title={meta.label || achievement.label || achievement.name || 'Achievement'}
                >
                  <span className="text-2xl sm:text-3xl" aria-hidden="true">{meta.icon || achievement.emoji || '🏅'}</span>
                  <span className="text-[10px] text-center text-[#3D6B3D] font-bold leading-tight">
                    {meta.label || achievement.label || achievement.name || 'Achievement'}
                  </span>
                </div>
              );
            })}
            {earnedBadges.length === 0 && serverAchievements.length === 0 && (
              <div className="col-span-full text-center py-6">
                <div className="text-4xl mb-2" aria-hidden="true">🌱</div>
                <p className="text-sm font-semibold text-[#6B5744]">Complete sessions to earn badges!</p>
              </div>
            )}
          </div>

          {/* Locked / in-progress badges */}
          {unearnedBadges.length > 0 && (
            <div>
              <p className="text-[#6B5744] text-xs font-extrabold mb-2 uppercase tracking-wide">In Progress</p>
              <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-3">
                {unearnedBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex flex-col items-center gap-1 p-2 sm:p-3 rounded-xl opacity-40 bg-[#EDE5D4] border border-[#D6C9A8]"
                    title={badge.label}
                    aria-label={`${badge.label} badge — not yet earned`}
                  >
                    <span className="text-2xl grayscale" aria-hidden="true">{badge.emoji}</span>
                    <span className="text-[10px] text-center text-[#6B5744] leading-tight">{badge.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Growth Charts — only show when there is real data */}
        {hasSessions && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Books Per Week */}
            <div className="ghibli-card p-6">
              <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-4">Books per Week (4 weeks)</h3>
              <div className="flex items-end gap-2 h-40 justify-around">
                {weeklyData.map((count, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex items-end justify-center mb-2">
                      <div
                        className="w-12 rounded-t-xl transition-all"
                        style={{
                          height: `${(count / maxWeeklyBooks) * 120}px`,
                          backgroundColor: GHIBLI.gold,
                          minHeight: '8px',
                        }}
                      />
                    </div>
                    <span className="text-sm font-extrabold text-[#6B5744]">{count}</span>
                    <span className="text-xs text-[#6B5744] font-medium">W{idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Grammar Trend */}
            <div className="ghibli-card p-6">
              <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-4">Grammar Trend</h3>
              <svg width="100%" height="160" viewBox="0 0 220 140" className="mb-2">
                <line x1="20" y1="120" x2="200" y2="120" stroke="#EDE5D4" strokeWidth="1" />
                <line x1="20" y1="20" x2="20" y2="120" stroke="#EDE5D4" strokeWidth="1" />
                {grammarTrend.length > 0 && (
                  <>
                    <polyline
                      points={grammarPoints}
                      fill="none"
                      stroke={GHIBLI.success}
                      strokeWidth="2"
                      style={{ transform: 'translate(20px, 0)' }}
                    />
                    {grammarTrend.map((score, idx) => {
                      const x = 20 + (idx / Math.max(grammarTrend.length - 1, 1)) * 180;
                      const y = 120 - (score / 100) * 100;
                      return <circle key={idx} cx={x} cy={y} r="4" fill={GHIBLI.success} />;
                    })}
                  </>
                )}
              </svg>
              <p className="text-xs text-[#6B5744] text-center font-semibold">Last 5 sessions</p>
            </div>

            {/* Vocabulary Growth */}
            <div className="ghibli-card p-6">
              <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-4">Cumulative Words</h3>
              <svg width="100%" height="160" viewBox="0 0 220 140" className="mb-2">
                <line x1="20" y1="120" x2="200" y2="120" stroke="#EDE5D4" strokeWidth="1" />
                <line x1="20" y1="20" x2="20" y2="120" stroke="#EDE5D4" strokeWidth="1" />
                {vocabPoints && (
                  <>
                    <polyline
                      points={vocabPoints}
                      fill="none"
                      stroke={GHIBLI.gold}
                      strokeWidth="2"
                      style={{ transform: 'translate(20px, 0)' }}
                    />
                    {sessions.slice().reverse().map((s, idx) => {
                      const sessionsReversed = sessions.slice().reverse();
                      if (idx >= sessionsReversed.length) return null;
                      const x = 20 + (idx / Math.max(sessionsReversed.length - 1, 1)) * 180;
                      let total = 0;
                      for (let i = 0; i <= idx; i++) { total += sessionsReversed[i].wordsLearned || 0; }
                      const y = 120 - (total / maxWords) * 100;
                      return <circle key={idx} cx={x} cy={y} r="4" fill={GHIBLI.gold} />;
                    })}
                  </>
                )}
              </svg>
              <p className="text-xs text-[#6B5744] text-center font-semibold">Cumulative words over sessions</p>
            </div>

            {/* Summary */}
            <div className="ghibli-card p-6">
              <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-4">Summary</h3>
              <div className="space-y-3">
                {[
                  { label: 'Total Sessions', value: sessions.length },
                  {
                    label: 'Avg Session Length',
                    value: `${Math.round(sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length)} min`,
                  },
                  { label: 'Best Grammar Score', value: `${Math.max(...sessions.map((s) => s.grammarScore || 0))}%` },
                  {
                    label: 'Avg Level Score',
                    value: `${Math.round(sessions.reduce((sum, s) => sum + (s.levelScore || 0), 0) / sessions.length)}%`,
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-[#EDE5D4] last:border-0">
                    <span className="text-[#6B5744] font-semibold">{item.label}</span>
                    <span className="font-extrabold text-lg text-[#5C8B5C]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Session History */}
        <div className="ghibli-card overflow-hidden mb-6">
          <div className="px-5 sm:px-6 py-4 border-b border-[#E8DEC8] bg-[#F5F0E8]">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#3D2E1E] flex items-center gap-2">
              <span aria-hidden="true">📋</span> Review History
            </h2>
          </div>

          {!hasSessions ? (
            <div className="px-6 py-12 text-center text-[#6B5744]">
              <div className="text-5xl mb-4 float-animation inline-block" aria-hidden="true">📚</div>
              <p className="text-lg font-bold mb-2 text-[#6B5744]">No reading sessions yet.</p>
              <p className="text-sm font-medium mb-6">Start your first book to see your history here!</p>
              <button
                onClick={() => router.push('/books')}
                className="min-h-[48px] px-6 py-3 bg-[#5C8B5C] text-white rounded-2xl font-bold hover:-translate-y-0.5 transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-[#3D6B3D] inline-flex items-center gap-2"
              >
                <span aria-hidden="true">📚</span>
                Choose a Book
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#EDE5D4]">
              {sessions.map((session) => (
                <div key={session.id}>
                  <button
                    onClick={() => setExpandedSessionId(expandedSessionId === session.id ? null : session.id)}
                    className="w-full px-6 py-4 hover:bg-[#F5F0E8] transition-colors text-left"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-extrabold text-[#3D2E1E] text-base">{session.bookTitle}</h4>
                      <span className="text-[#6B5744] text-sm font-semibold">
                        {new Date(session.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex gap-6 flex-wrap">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-bold text-[#6B5744]">Level Score</span>
                          <span className="text-xs font-extrabold text-[#5C8B5C]">{session.levelScore}%</span>
                        </div>
                        <div className="w-full bg-[#EDE5D4] rounded-full h-2">
                          <div className="h-2 rounded-full bg-[#5C8B5C]" style={{ width: `${session.levelScore}%` }} />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-bold text-[#6B5744]">Grammar Score</span>
                          <span className="text-xs font-extrabold text-[#7AC87A]">{session.grammarScore}%</span>
                        </div>
                        <div className="w-full bg-[#EDE5D4] rounded-full h-2">
                          <div className="h-2 rounded-full bg-[#7AC87A]" style={{ width: `${session.grammarScore}%` }} />
                        </div>
                      </div>
                    </div>
                  </button>

                  {expandedSessionId === session.id && (
                    <div className="px-6 py-4 border-t border-[#EDE5D4] bg-[#F5F0E8]">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-[#6B5744] font-bold mb-1">Words Learned</p>
                          <p className="text-2xl font-extrabold text-[#3D2E1E]">{session.wordsLearned}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6B5744] font-bold mb-1">Session Duration</p>
                          <p className="text-2xl font-extrabold text-[#3D2E1E]">{session.duration} min</p>
                        </div>
                      </div>

                      {session.stages && Object.keys(session.stages).length > 0 && (
                        <div>
                          <p className="text-xs text-[#6B5744] font-bold mb-3">Stage Scores</p>
                          <div className="space-y-2">
                            {Object.entries(session.stages).map(([stage, scoreVal]) => (
                              <div key={stage}>
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm font-extrabold text-[#6B5744]">{stage}</span>
                                  <span className="text-sm font-extrabold text-[#5C8B5C]">{scoreVal}%</span>
                                </div>
                                <div className="w-full bg-[#EDE5D4] rounded-full h-2">
                                  <div className="h-2 rounded-full bg-[#5C8B5C]" style={{ width: `${scoreVal}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-center mb-8">
          <button
            onClick={() => router.push('/books')}
            className="flex-1 sm:flex-initial min-h-[52px] px-8 py-3 text-white rounded-2xl font-extrabold text-base hover:-translate-y-0.5 transition-all shadow-[0_4px_12px_rgba(92,139,92,0.3)] focus-visible:ring-2 focus-visible:ring-[#3D6B3D] flex items-center justify-center gap-2"
            style={{ backgroundColor: GHIBLI.primary }}
          >
            <span aria-hidden="true">📚</span>
            Go to Library
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex-1 sm:flex-initial min-h-[52px] px-8 py-3 rounded-2xl font-extrabold text-base border-2 hover:-translate-y-0.5 transition-all focus-visible:ring-2 focus-visible:ring-[#5C8B5C] flex items-center justify-center gap-2"
            style={{ backgroundColor: GHIBLI.bg, borderColor: GHIBLI.primary, color: GHIBLI.primary }}
          >
            <span aria-hidden="true">🏠</span>
            Home
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 sm:flex-initial min-h-[52px] px-8 py-3 rounded-2xl font-extrabold text-base border-2 hover:-translate-y-0.5 transition-all focus-visible:ring-2 focus-visible:ring-[#D4736B] flex items-center justify-center gap-2"
            style={{ backgroundColor: GHIBLI.bg, borderColor: '#D4736B', color: '#D4736B' }}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
