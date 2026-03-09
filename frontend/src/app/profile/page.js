'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getStudentSessions,
  getStudentAnalytics,
  logout,
} from '@/services/api';
import LoadingCard from '@/components/LoadingCard';

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
  // Normalise API response fields to match the UI's expected shape
  return {
    id: s.id,
    bookTitle: s.bookTitle || s.book_title || s.title || 'Unknown Book',
    date: s.date || s.completedAt || s.completed_at || s.startedAt || s.started_at || new Date().toISOString(),
    levelScore: s.levelScore || s.level_score || 0,
    grammarScore: s.grammarScore || s.grammar_score || 0,
    wordsLearned: s.wordsLearned || s.words_learned || s.wordCount || 0,
    duration: s.duration || s.durationMinutes || (s.durationSeconds ? Math.round(s.durationSeconds / 60) : 0),
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

      try {
        [sessionsData, analyticsData] = await Promise.all([
          getStudentSessions(studentId),
          getStudentAnalytics(studentId),
        ]);
      } catch (apiErr) {
        console.warn('API unavailable, using fallback data:', apiErr);
        setUsingFallback(true);
      }

      // Process sessions
      if (sessionsData && sessionsData.sessions && sessionsData.sessions.length > 0) {
        const normalized = sessionsData.sessions.map(normalizeSession);
        setSessions(normalized);
      } else if (sessionsData && Array.isArray(sessionsData) && sessionsData.length > 0) {
        setSessions(sessionsData.map(normalizeSession));
      } else {
        setUsingFallback(true);
        setSessions(MOCK_SESSIONS);
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
  const totalWordsLearned = sessions.reduce((sum, s) => sum + (s.wordsLearned || 0), 0);
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
      <div className="min-h-screen py-6 bg-[#F5F0E8]">
        <div className="max-w-4xl mx-auto space-y-6">
          <LoadingCard lines={3} />
          <LoadingCard lines={4} />
          <LoadingCard lines={2} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 bg-[#F5F0E8]">
      <div className="max-w-4xl mx-auto">
        {/* Fallback notice */}
        {usingFallback && (
          <div className="mb-4 px-4 py-3 bg-[#FFF8E8] border-l-4 border-[#D4A843] rounded-xl">
            <p className="text-sm font-bold text-[#A8822E]">
              Showing example data. Sign in or connect to the internet to see your real progress.
            </p>
          </div>
        )}

        {/* Student Profile Card */}
        <div className="rounded-3xl overflow-hidden shadow-[0_4px_20px_rgba(61,46,30,0.10)] mb-6">
          <div className="bg-gradient-to-r from-[#5C8B5C] to-[#87CEDB] p-8">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-6">
                <div
                  className="text-8xl cursor-pointer hover:scale-110 transition-transform"
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                >
                  {student.avatar}
                </div>
                <div>
                  <h2 className="text-4xl font-extrabold text-white">{student.name}</h2>
                  {student.age && (
                    <p className="text-green-100 mb-3 text-base font-semibold">Age {student.age}</p>
                  )}
                  <span className="px-4 py-2 rounded-full bg-white bg-opacity-25 text-white font-extrabold text-sm">
                    {student.level}
                  </span>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex-shrink-0 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
                title="Log out"
              >
                Log out
              </button>
            </div>
          </div>

          <div className="bg-[#FFFCF3] p-6">
            {showAvatarPicker && (
              <div className="mb-6 pb-6 border-b border-[#E8DEC8]">
                <p className="text-[#6B5744] font-extrabold mb-3">Choose Your Avatar:</p>
                <div className="flex gap-3 flex-wrap">
                  {AVATAR_OPTIONS.map((avatar) => (
                    <button
                      key={avatar}
                      onClick={() => handleAvatarChange(avatar)}
                      className={`text-5xl p-2 rounded-xl transition-all hover:-translate-y-0.5 ${
                        selectedAvatar === avatar
                          ? 'ring-4 ring-[#5C8B5C] bg-[#E8F5E8]'
                          : 'hover:bg-[#F5F0E8]'
                      }`}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Books Read', value: totalBooksRead, color: GHIBLI.primary },
                { label: 'Words Learned', value: totalWordsLearned, color: GHIBLI.success },
                { label: 'Day Streak', value: currentStreak, color: GHIBLI.gold },
                { label: 'Grammar Avg', value: hasSessions ? `${avgGrammarScore}%` : '—', color: GHIBLI.primary },
              ].map((stat, idx) => (
                <div key={idx} className="text-center p-4 rounded-2xl bg-[#F5F0E8]">
                  <div className="text-3xl font-extrabold" style={{ color: stat.color }}>
                    {stat.value}
                  </div>
                  <p className="text-[#6B5744] text-xs font-bold mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Level Progress */}
        <div className="ghibli-card p-6 mb-6">
          <h3 className="text-2xl font-extrabold text-[#3D2E1E] mb-4">Level Progress</h3>
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
        <div className="ghibli-card p-6 mb-6">
          <h3 className="text-2xl font-extrabold text-[#3D2E1E] mb-4">Achievements</h3>
          <div className="mb-6">
            <p className="text-[#6B5744] text-sm font-extrabold mb-3">Earned Badges</p>
            {earnedBadges.length === 0 && serverAchievements.length === 0 ? (
              <p className="text-[#9B8777] italic font-semibold">No badges earned yet. Keep learning!</p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {earnedBadges.map((badge) => (
                  <div key={badge.id} className="flex flex-col items-center p-4 rounded-2xl bg-[#F5F0E8] border border-[#E8DEC8]">
                    <div className="text-4xl mb-2">{badge.emoji}</div>
                    <p className="text-sm font-extrabold text-[#3D2E1E] text-center">{badge.label}</p>
                  </div>
                ))}
                {serverAchievements.map((achievement, idx) => (
                  <div key={`server-${idx}`} className="flex flex-col items-center p-4 rounded-2xl bg-[#F5F0E8] border border-[#E8DEC8]">
                    <div className="text-4xl mb-2">{achievement.emoji || '🏆'}</div>
                    <p className="text-sm font-extrabold text-[#3D2E1E] text-center">{achievement.label || achievement.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {unearnedBadges.length > 0 && (
            <div>
              <p className="text-[#6B5744] text-sm font-extrabold mb-3">In Progress</p>
              <div className="flex flex-wrap gap-4">
                {unearnedBadges.map((badge) => (
                  <div key={badge.id} className="flex flex-col items-center p-4 rounded-2xl opacity-50 bg-[#EDE5D4]">
                    <div className="text-4xl mb-2 grayscale">{badge.emoji}</div>
                    <p className="text-sm font-extrabold text-[#6B5744] text-center">{badge.label}</p>
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
                    <span className="text-xs text-[#9B8777] font-medium">W{idx + 1}</span>
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
              <p className="text-xs text-[#9B8777] text-center font-semibold">Last 5 sessions</p>
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
              <p className="text-xs text-[#9B8777] text-center font-semibold">Cumulative words over sessions</p>
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
          <div className="px-6 py-4 border-b border-[#E8DEC8] bg-[#F5F0E8]">
            <h3 className="text-2xl font-extrabold text-[#3D2E1E]">Reading History</h3>
          </div>

          {!hasSessions ? (
            <div className="px-6 py-12 text-center text-[#9B8777]">
              <div className="text-5xl mb-4">📚</div>
              <p className="text-lg font-semibold mb-2">No reading sessions yet.</p>
              <p className="text-sm font-medium mb-6">Start your first book to see your history here!</p>
              <button
                onClick={() => router.push('/books')}
                className="px-6 py-3 bg-[#5C8B5C] text-white rounded-2xl font-bold hover:-translate-y-0.5 transition-all"
              >
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
                      <span className="text-[#9B8777] text-sm font-semibold">
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
        <div className="flex gap-4 justify-center mb-8 flex-wrap">
          <button
            onClick={() => router.push('/books')}
            className="px-8 py-4 text-white rounded-2xl font-extrabold text-base hover:-translate-y-0.5 transition-all shadow-[0_4px_12px_rgba(92,139,92,0.3)]"
            style={{ backgroundColor: GHIBLI.primary }}
          >
            Read a Book
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-8 py-4 rounded-2xl font-extrabold text-base border-2 hover:-translate-y-0.5 transition-all"
            style={{ backgroundColor: GHIBLI.bg, borderColor: GHIBLI.primary, color: GHIBLI.primary }}
          >
            Home
          </button>
          <button
            onClick={handleLogout}
            className="px-8 py-4 rounded-2xl font-extrabold text-base border-2 hover:-translate-y-0.5 transition-all"
            style={{ backgroundColor: GHIBLI.bg, borderColor: '#D4736B', color: '#D4736B' }}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
