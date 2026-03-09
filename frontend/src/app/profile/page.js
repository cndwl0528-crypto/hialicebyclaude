'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const MOCK_STUDENT = {
  id: 1,
  name: 'Alice',
  age: 7,
  level: 'Beginner',
  avatar: '👧',
};

const MOCK_SESSIONS = [
  {
    id: 1,
    bookTitle: 'The Very Hungry Caterpillar',
    date: '2026-03-08',
    levelScore: 85,
    grammarScore: 78,
    wordsLearned: 18,
    duration: 12,
    stages: { Title: 85, Introduction: 80, Body: 78, Conclusion: 85 },
  },
  {
    id: 2,
    bookTitle: 'Where the Wild Things Are',
    date: '2026-03-07',
    levelScore: 88,
    grammarScore: 82,
    wordsLearned: 22,
    duration: 15,
    stages: { Title: 88, Introduction: 85, Body: 82, Conclusion: 88 },
  },
  {
    id: 3,
    bookTitle: 'Winnie-the-Pooh',
    date: '2026-03-06',
    levelScore: 80,
    grammarScore: 75,
    wordsLearned: 20,
    duration: 14,
    stages: { Title: 80, Introduction: 78, Body: 75, Conclusion: 80 },
  },
  {
    id: 4,
    bookTitle: 'Charlotte\'s Web',
    date: '2026-03-05',
    levelScore: 82,
    grammarScore: 79,
    wordsLearned: 19,
    duration: 13,
    stages: { Title: 82, Introduction: 80, Body: 79, Conclusion: 82 },
  },
  {
    id: 5,
    bookTitle: 'The Giving Tree',
    date: '2026-03-04',
    levelScore: 79,
    grammarScore: 76,
    wordsLearned: 17,
    duration: 11,
    stages: { Title: 79, Introduction: 77, Body: 76, Conclusion: 79 },
  },
];

const AVATAR_OPTIONS = ['👧', '👦', '🧒', '👩', '🧑', '😊', '🌟', '🎓'];

const BADGES = [
  { id: 'first-book', label: 'First Book', emoji: '📚', condition: (sessions) => sessions.length >= 1 },
  { id: 'five-books', label: '5 Books', emoji: '📖', condition: (sessions) => sessions.length >= 5 },
  { id: 'word-master', label: 'Word Master', emoji: '📝', condition: (sessions) => {
    const total = sessions.reduce((sum, s) => sum + (s.wordsLearned || 0), 0);
    return total >= 50;
  }},
  { id: 'grammar-pro', label: 'Grammar Pro', emoji: '✨', condition: (sessions) => {
    const avg = sessions.reduce((sum, s) => sum + s.grammarScore, 0) / sessions.length;
    return avg >= 90;
  }},
  { id: 'streak-3', label: '3-Day Streak', emoji: '🔥', condition: (sessions) => {
    if (sessions.length < 3) return false;
    const dates = sessions.slice(0, 3).map(s => new Date(s.date));
    for (let i = 0; i < dates.length - 1; i++) {
      const diff = (dates[i].getTime() - dates[i + 1].getTime()) / (1000 * 60 * 60 * 24);
      if (diff !== 1) return false;
    }
    return true;
  }},
];

const HIALICE_COLORS = {
  primary: '#4A90D9',
  bg: '#F5F7FA',
  accent: '#F39C12',
  success: '#27AE60',
};

export default function ProfilePage() {
  const router = useRouter();
  const [student, setStudent] = useState(MOCK_STUDENT);
  const [sessions, setSessions] = useState(MOCK_SESSIONS);
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(MOCK_STUDENT.avatar);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  useEffect(() => {
    // Try to fetch from sessionStorage
    const storedStudentId = sessionStorage.getItem('studentId');
    const storedStudentName = sessionStorage.getItem('studentName');
    const storedLevel = sessionStorage.getItem('studentLevel');

    if (storedStudentName) {
      setStudent((prev) => ({
        ...prev,
        name: storedStudentName,
        level: storedLevel || prev.level,
      }));
    }

    // Try API calls (with fallback to mock data)
    fetchSessionsData();
    fetchVocabularyStats();
  }, []);

  const fetchSessionsData = async () => {
    try {
      const response = await fetch('/api/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.log('Using mock session data');
    }
  };

  const fetchVocabularyStats = async () => {
    try {
      const response = await fetch('/api/vocabulary');
      if (response.ok) {
        const data = await response.json();
        // Process vocabulary stats as needed
      }
    } catch (error) {
      console.log('Using mock vocabulary data');
    }
  };

  const totalBooksRead = sessions.length;
  const totalWordsLearned = sessions.reduce((sum, s) => sum + (s.wordsLearned || 0), 0);
  const avgGrammarScore = Math.round(
    sessions.reduce((sum, s) => sum + s.grammarScore, 0) / sessions.length
  );

  // Calculate streak
  const calculateStreak = () => {
    if (sessions.length === 0) return 0;
    const sortedSessions = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
    let streak = 1;
    for (let i = 0; i < sortedSessions.length - 1; i++) {
      const curr = new Date(sortedSessions[i].date);
      const next = new Date(sortedSessions[i + 1].date);
      const diff = (curr.getTime() - next.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  const currentStreak = calculateStreak();

  // Calculate level progress
  const getLevelProgress = () => {
    const levelMap = { Beginner: 1, Intermediate: 2, Advanced: 3 };
    const currentLevelNum = levelMap[student.level] || 1;
    const booksForNextLevel = currentLevelNum * 5;
    const progress = Math.min((totalBooksRead / booksForNextLevel) * 100, 100);
    return { progress: Math.round(progress), booksNeeded: Math.max(0, booksForNextLevel - totalBooksRead) };
  };

  const { progress: levelProgress, booksNeeded } = getLevelProgress();

  // Get reading data for last 4 weeks
  const getWeeklyData = () => {
    const weeks = [0, 0, 0, 0];
    const today = new Date();
    sessions.forEach((session) => {
      const sessionDate = new Date(session.date);
      const daysAgo = Math.floor((today.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(daysAgo / 7);
      if (weekIndex < 4) {
        weeks[weekIndex]++;
      }
    });
    return weeks.reverse();
  };

  const weeklyData = getWeeklyData();
  const maxWeeklyBooks = Math.max(...weeklyData, 1);

  // Get grammar trend
  const getGrammarTrend = () => {
    return sessions
      .slice()
      .reverse()
      .slice(0, 5)
      .map((s) => s.grammarScore);
  };

  const grammarTrend = getGrammarTrend();

  // Generate SVG line chart for vocabulary growth
  const generateVocabChart = () => {
    const cumulativeWords = [];
    let total = 0;
    sessions
      .slice()
      .reverse()
      .forEach((s) => {
        total += s.wordsLearned || 0;
        cumulativeWords.push(total);
      });

    const maxWords = Math.max(...cumulativeWords, 1);
    const points = cumulativeWords
      .map((words, idx) => {
        const x = (idx / Math.max(cumulativeWords.length - 1, 1)) * 200;
        const y = 120 - (words / maxWords) * 100;
        return `${x},${y}`;
      })
      .join(' ');

    return { points, maxWords, count: cumulativeWords.length };
  };

  const { points: vocabPoints, maxWords } = generateVocabChart();

  // Grammar trend SVG
  const generateGrammarChart = () => {
    const points = grammarTrend
      .map((score, idx) => {
        const x = (idx / Math.max(grammarTrend.length - 1, 1)) * 200;
        const y = 120 - (score / 100) * 100;
        return `${x},${y}`;
      })
      .join(' ');
    return points;
  };

  const grammarPoints = generateGrammarChart();

  // Earned badges
  const earnedBadges = BADGES.filter((badge) => badge.condition(sessions));
  const unearnedBadges = BADGES.filter((badge) => !badge.condition(sessions));

  const handleAvatarChange = (avatar) => {
    setSelectedAvatar(avatar);
    setStudent((prev) => ({ ...prev, avatar }));
    setShowAvatarPicker(false);
  };

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: HIALICE_COLORS.bg }}>
      <div className="max-w-4xl mx-auto">
        {/* Student Profile Card */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-6">
              <div
                className="text-8xl cursor-pointer hover:scale-110 transition-transform"
                onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              >
                {student.avatar}
              </div>
              <div>
                <h2 className="text-4xl font-bold text-gray-800">{student.name}</h2>
                <p className="text-gray-600 mb-4 text-lg">Age {student.age}</p>
                <span
                  className="px-4 py-2 rounded-full text-white font-bold text-lg"
                  style={{ backgroundColor: HIALICE_COLORS.primary }}
                >
                  {student.level}
                </span>
              </div>
            </div>
          </div>

          {showAvatarPicker && (
            <div className="mb-6 pb-6 border-b border-gray-200">
              <p className="text-gray-700 font-semibold mb-3">Choose Your Avatar:</p>
              <div className="flex gap-3 flex-wrap">
                {AVATAR_OPTIONS.map((avatar) => (
                  <button
                    key={avatar}
                    onClick={() => handleAvatarChange(avatar)}
                    className={`text-5xl p-2 rounded-lg transition-all ${
                      selectedAvatar === avatar ? 'ring-4' : 'hover:bg-gray-100'
                    }`}
                    style={selectedAvatar === avatar ? { ringColor: HIALICE_COLORS.primary } : {}}
                  >
                    {avatar}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: HIALICE_COLORS.bg }}>
              <div className="text-3xl font-bold" style={{ color: HIALICE_COLORS.primary }}>
                {totalBooksRead}
              </div>
              <p className="text-gray-600 text-sm font-semibold">Books Read</p>
            </div>
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: HIALICE_COLORS.bg }}>
              <div className="text-3xl font-bold" style={{ color: HIALICE_COLORS.success }}>
                {totalWordsLearned}
              </div>
              <p className="text-gray-600 text-sm font-semibold">Words Learned</p>
            </div>
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: HIALICE_COLORS.bg }}>
              <div className="text-3xl font-bold" style={{ color: HIALICE_COLORS.accent }}>
                {currentStreak}
              </div>
              <p className="text-gray-600 text-sm font-semibold">Day Streak</p>
            </div>
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: HIALICE_COLORS.bg }}>
              <div className="text-3xl font-bold" style={{ color: HIALICE_COLORS.primary }}>
                {avgGrammarScore}%
              </div>
              <p className="text-gray-600 text-sm font-semibold">Grammar Avg</p>
            </div>
          </div>
        </div>

        {/* Level Progress */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Level Progress</h3>
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="h-4 rounded-full transition-all duration-500"
                  style={{ width: `${levelProgress}%`, backgroundColor: HIALICE_COLORS.success }}
                ></div>
              </div>
              <p className="text-gray-600 text-sm mt-2">
                {booksNeeded === 0
                  ? '🎉 Ready to level up!'
                  : `${levelProgress}% to next level · ${booksNeeded} more books to go`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold" style={{ color: HIALICE_COLORS.primary }}>
                {levelProgress}%
              </p>
            </div>
          </div>
        </div>

        {/* Achievement Badges */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Achievements</h3>
          <div className="mb-6">
            <p className="text-gray-600 text-sm font-semibold mb-3">Earned Badges</p>
            {earnedBadges.length === 0 ? (
              <p className="text-gray-500 italic">No badges earned yet. Keep learning!</p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {earnedBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex flex-col items-center p-4 rounded-lg"
                    style={{ backgroundColor: HIALICE_COLORS.bg }}
                  >
                    <div className="text-4xl mb-2">{badge.emoji}</div>
                    <p className="text-sm font-bold text-gray-700 text-center">{badge.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {unearnedBadges.length > 0 && (
            <div>
              <p className="text-gray-600 text-sm font-semibold mb-3">In Progress</p>
              <div className="flex flex-wrap gap-4">
                {unearnedBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex flex-col items-center p-4 rounded-lg opacity-50"
                    style={{ backgroundColor: '#E0E0E0' }}
                  >
                    <div className="text-4xl mb-2 grayscale">{badge.emoji}</div>
                    <p className="text-sm font-bold text-gray-500 text-center">{badge.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Growth Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Reading Progress Chart */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">📚 Books per Week (4 weeks)</h3>
            <div className="flex items-end gap-2 h-40 justify-around">
              {weeklyData.map((count, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex items-end justify-center mb-2">
                    <div
                      className="w-12 rounded-t-lg transition-all"
                      style={{
                        height: `${(count / maxWeeklyBooks) * 120}px`,
                        backgroundColor: HIALICE_COLORS.primary,
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-600">{count}</span>
                  <span className="text-xs text-gray-500">W{idx + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Grammar Score Trend */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">📈 Grammar Trend</h3>
            <svg width="100%" height="160" viewBox="0 0 220 140" className="mb-2">
              <line x1="20" y1="120" x2="200" y2="120" stroke="#ddd" strokeWidth="1" />
              <line x1="20" y1="20" x2="20" y2="120" stroke="#ddd" strokeWidth="1" />
              {grammarTrend.length > 0 && (
                <>
                  <polyline
                    points={grammarPoints}
                    fill="none"
                    stroke={HIALICE_COLORS.success}
                    strokeWidth="2"
                    style={{ transform: 'translate(20px, 0)' }}
                  />
                  {grammarTrend.map((score, idx) => {
                    const x = 20 + (idx / Math.max(grammarTrend.length - 1, 1)) * 180;
                    const y = 120 - (score / 100) * 100;
                    return (
                      <circle
                        key={idx}
                        cx={x}
                        cy={y}
                        r="3"
                        fill={HIALICE_COLORS.success}
                      />
                    );
                  })}
                </>
              )}
            </svg>
            <p className="text-xs text-gray-500 text-center">Last 5 sessions</p>
          </div>

          {/* Vocabulary Growth */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">📝 Cumulative Words</h3>
            <svg width="100%" height="160" viewBox="0 0 220 140" className="mb-2">
              <line x1="20" y1="120" x2="200" y2="120" stroke="#ddd" strokeWidth="1" />
              <line x1="20" y1="20" x2="20" y2="120" stroke="#ddd" strokeWidth="1" />
              {vocabPoints && (
                <>
                  <polyline
                    points={vocabPoints}
                    fill="none"
                    stroke={HIALICE_COLORS.accent}
                    strokeWidth="2"
                    style={{ transform: 'translate(20px, 0)' }}
                  />
                  {grammarTrend.map((_, idx) => {
                    const sessionsReversed = sessions.slice().reverse();
                    if (idx >= sessionsReversed.length) return null;
                    const x = 20 + (idx / Math.max(sessionsReversed.length - 1, 1)) * 180;
                    let total = 0;
                    for (let i = 0; i <= idx; i++) {
                      total += sessionsReversed[i].wordsLearned || 0;
                    }
                    const y = 120 - (total / maxWords) * 100;
                    return (
                      <circle key={idx} cx={x} cy={y} r="3" fill={HIALICE_COLORS.accent} />
                    );
                  })}
                </>
              )}
            </svg>
            <p className="text-xs text-gray-500 text-center">Cumulative words over sessions</p>
          </div>

          {/* Overall Progress Summary */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">🎯 Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Sessions</span>
                <span className="font-bold text-lg text-gray-800">{sessions.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Avg Session Length</span>
                <span className="font-bold text-lg text-gray-800">
                  {Math.round(sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length)} min
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Best Grammar Score</span>
                <span className="font-bold text-lg text-gray-800">
                  {Math.max(...sessions.map((s) => s.grammarScore))}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Avg Level Score</span>
                <span className="font-bold text-lg text-gray-800">
                  {Math.round(sessions.reduce((sum, s) => sum + s.levelScore, 0) / sessions.length)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Session History */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200" style={{ backgroundColor: HIALICE_COLORS.bg }}>
            <h3 className="text-2xl font-bold text-gray-800">Reading History</h3>
          </div>

          {sessions.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <p className="text-lg">No reading sessions yet. Start your first book!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {sessions.map((session) => (
                <div key={session.id}>
                  <button
                    onClick={() =>
                      setExpandedSessionId(
                        expandedSessionId === session.id ? null : session.id
                      )
                    }
                    className="w-full px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-gray-800 text-lg">{session.bookTitle}</h4>
                      <span className="text-gray-500 text-sm">
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
                          <span className="text-xs font-semibold text-gray-600">Level Score</span>
                          <span className="text-xs font-bold" style={{ color: HIALICE_COLORS.primary }}>
                            {session.levelScore}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${session.levelScore}%`,
                              backgroundColor: HIALICE_COLORS.primary,
                            }}
                          ></div>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-600">Grammar Score</span>
                          <span className="text-xs font-bold" style={{ color: HIALICE_COLORS.success }}>
                            {session.grammarScore}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${session.grammarScore}%`,
                              backgroundColor: HIALICE_COLORS.success,
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {expandedSessionId === session.id && (
                    <div
                      className="px-6 py-4 border-t border-gray-100"
                      style={{ backgroundColor: HIALICE_COLORS.bg }}
                    >
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-600 font-semibold mb-1">Words Learned</p>
                          <p className="text-2xl font-bold text-gray-800">{session.wordsLearned}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 font-semibold mb-1">Session Duration</p>
                          <p className="text-2xl font-bold text-gray-800">{session.duration} min</p>
                        </div>
                      </div>

                      {session.stages && (
                        <div>
                          <p className="text-xs text-gray-600 font-semibold mb-3">Stage Scores</p>
                          <div className="space-y-2">
                            {Object.entries(session.stages).map(([stage, score]) => (
                              <div key={stage}>
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm font-semibold text-gray-700">{stage}</span>
                                  <span className="text-sm font-bold text-gray-700">{score}%</span>
                                </div>
                                <div className="w-full bg-gray-300 rounded-full h-2">
                                  <div
                                    className="h-2 rounded-full"
                                    style={{
                                      width: `${score}%`,
                                      backgroundColor: HIALICE_COLORS.primary,
                                    }}
                                  ></div>
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
        <div className="flex gap-4 justify-center mb-8">
          <button
            onClick={() => router.push('/books')}
            className="px-8 py-4 text-white rounded-lg hover:shadow-lg transition-shadow font-bold text-lg"
            style={{ backgroundColor: HIALICE_COLORS.primary }}
          >
            📚 Read a Book
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-8 py-4 text-gray-800 rounded-lg hover:shadow-lg transition-shadow font-bold text-lg"
            style={{ backgroundColor: HIALICE_COLORS.bg, border: `2px solid ${HIALICE_COLORS.primary}` }}
          >
            🏠 Home
          </button>
        </div>
      </div>
    </div>
  );
}
