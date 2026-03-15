'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getItem } from '@/lib/clientStorage';

// ─────────────────────────────────────────────────────────────────────────────
// Mock data — 9 students with varied performance levels across two classes
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_CLASSES = [
  { id: 'morning', label: 'Morning Class', time: 'Mon / Wed / Fri  9:00 AM' },
  { id: 'afternoon', label: 'Afternoon Class', time: 'Tue / Thu  2:00 PM' },
  { id: 'saturday', label: 'Saturday Group', time: 'Sat  10:00 AM' },
];

const MOCK_STUDENTS = [
  {
    id: 's1',
    classId: 'morning',
    name: 'Mia Chen',
    avatarEmoji: '🌸',
    age: 9,
    level: 'intermediate',
    booksReviewed: 12,
    avgScore: 87,
    lastActive: new Date(Date.now() - 1 * 86400000).toISOString(),
    status: 'active',
    streak: 7,
    totalWords: 142,
    recentSessions: [
      { bookTitle: "Charlotte's Web", grammarScore: 88, completedAt: new Date(Date.now() - 86400000).toISOString(), vocabCount: 14 },
      { bookTitle: 'The Secret Garden', grammarScore: 85, completedAt: new Date(Date.now() - 7 * 86400000).toISOString(), vocabCount: 11 },
      { bookTitle: 'Matilda', grammarScore: 90, completedAt: new Date(Date.now() - 14 * 86400000).toISOString(), vocabCount: 18 },
    ],
    recentWords: ['curious', 'adventure', 'determined', 'magnificent', 'compassion'],
    aiFeedback: "Mia demonstrates excellent critical thinking. Encourage her to use more complex sentence structures.",
  },
  {
    id: 's2',
    classId: 'morning',
    name: 'Leo Park',
    avatarEmoji: '⚡',
    age: 10,
    level: 'intermediate',
    booksReviewed: 8,
    avgScore: 74,
    lastActive: new Date(Date.now() - 3 * 86400000).toISOString(),
    status: 'active',
    streak: 3,
    totalWords: 89,
    recentSessions: [
      { bookTitle: 'Magic Tree House', grammarScore: 76, completedAt: new Date(Date.now() - 3 * 86400000).toISOString(), vocabCount: 8 },
      { bookTitle: 'Diary of a Wimpy Kid', grammarScore: 72, completedAt: new Date(Date.now() - 10 * 86400000).toISOString(), vocabCount: 9 },
      { bookTitle: 'Captain Underpants', grammarScore: 74, completedAt: new Date(Date.now() - 17 * 86400000).toISOString(), vocabCount: 7 },
    ],
    recentWords: ['hilarious', 'obstacle', 'sneaky', 'mischievous', 'embarrassed'],
    aiFeedback: "Leo engages enthusiastically. Focus on expanding vocabulary and using more descriptive language.",
  },
  {
    id: 's3',
    classId: 'morning',
    name: 'Sophie Kim',
    avatarEmoji: '🌙',
    age: 8,
    level: 'beginner',
    booksReviewed: 5,
    avgScore: 65,
    lastActive: new Date(Date.now() - 9 * 86400000).toISOString(),
    status: 'needs_attention',
    streak: 0,
    totalWords: 52,
    recentSessions: [
      { bookTitle: 'The Very Hungry Caterpillar', grammarScore: 68, completedAt: new Date(Date.now() - 9 * 86400000).toISOString(), vocabCount: 5 },
      { bookTitle: 'Where the Wild Things Are', grammarScore: 63, completedAt: new Date(Date.now() - 19 * 86400000).toISOString(), vocabCount: 6 },
      { bookTitle: 'Goodnight Moon', grammarScore: 64, completedAt: new Date(Date.now() - 28 * 86400000).toISOString(), vocabCount: 4 },
    ],
    recentWords: ['peaceful', 'forest', 'journey', 'afraid', 'cozy'],
    aiFeedback: "Sophie is making steady progress. Consistent practice is key — aim for at least 2 sessions per week.",
  },
  {
    id: 's4',
    classId: 'morning',
    name: 'James Yoo',
    avatarEmoji: '🦁',
    age: 12,
    level: 'advanced',
    booksReviewed: 18,
    avgScore: 92,
    lastActive: new Date(Date.now() - 1 * 86400000).toISOString(),
    status: 'active',
    streak: 14,
    totalWords: 231,
    recentSessions: [
      { bookTitle: 'A Wrinkle in Time', grammarScore: 94, completedAt: new Date(Date.now() - 86400000).toISOString(), vocabCount: 22 },
      { bookTitle: 'The Hobbit', grammarScore: 91, completedAt: new Date(Date.now() - 8 * 86400000).toISOString(), vocabCount: 25 },
      { bookTitle: 'Percy Jackson', grammarScore: 90, completedAt: new Date(Date.now() - 15 * 86400000).toISOString(), vocabCount: 20 },
    ],
    recentWords: ['formidable', 'perplexed', 'inevitable', 'tenacious', 'luminous'],
    aiFeedback: "James is an outstanding student. Challenge him with more complex themes and encourage literary analysis.",
  },
  {
    id: 's5',
    classId: 'afternoon',
    name: 'Ava Nguyen',
    avatarEmoji: '🌺',
    age: 9,
    level: 'intermediate',
    booksReviewed: 10,
    avgScore: 81,
    lastActive: new Date(Date.now() - 2 * 86400000).toISOString(),
    status: 'active',
    streak: 5,
    totalWords: 118,
    recentSessions: [
      { bookTitle: 'Winnie-the-Pooh', grammarScore: 82, completedAt: new Date(Date.now() - 2 * 86400000).toISOString(), vocabCount: 12 },
      { bookTitle: 'The BFG', grammarScore: 80, completedAt: new Date(Date.now() - 9 * 86400000).toISOString(), vocabCount: 13 },
      { bookTitle: 'Fantastic Mr Fox', grammarScore: 81, completedAt: new Date(Date.now() - 16 * 86400000).toISOString(), vocabCount: 10 },
    ],
    recentWords: ['elegant', 'peculiar', 'vibrant', 'curious', 'generous'],
    aiFeedback: "Ava shows consistent improvement. Encourage her to connect book themes to personal experiences.",
  },
  {
    id: 's6',
    classId: 'afternoon',
    name: 'Ethan Lim',
    avatarEmoji: '🚀',
    age: 11,
    level: 'intermediate',
    booksReviewed: 7,
    avgScore: 69,
    lastActive: new Date(Date.now() - 6 * 86400000).toISOString(),
    status: 'needs_attention',
    streak: 1,
    totalWords: 73,
    recentSessions: [
      { bookTitle: 'Harry Potter and the Sorcerer Stone', grammarScore: 71, completedAt: new Date(Date.now() - 6 * 86400000).toISOString(), vocabCount: 9 },
      { bookTitle: 'The Lion the Witch and the Wardrobe', grammarScore: 68, completedAt: new Date(Date.now() - 14 * 86400000).toISOString(), vocabCount: 8 },
      { bookTitle: 'Stuart Little', grammarScore: 68, completedAt: new Date(Date.now() - 22 * 86400000).toISOString(), vocabCount: 7 },
    ],
    recentWords: ['brave', 'wizard', 'mysterious', 'discover', 'challenge'],
    aiFeedback: "Ethan needs more encouragement. Try pairing him with a reading buddy to build confidence.",
  },
  {
    id: 's7',
    classId: 'afternoon',
    name: 'Zoe Lin',
    avatarEmoji: '🦋',
    age: 7,
    level: 'beginner',
    booksReviewed: 14,
    avgScore: 79,
    lastActive: new Date(Date.now() - 1 * 86400000).toISOString(),
    status: 'active',
    streak: 9,
    totalWords: 105,
    recentSessions: [
      { bookTitle: 'Elephant and Piggie: Today I Will Fly', grammarScore: 80, completedAt: new Date(Date.now() - 86400000).toISOString(), vocabCount: 10 },
      { bookTitle: 'Frog and Toad Are Friends', grammarScore: 79, completedAt: new Date(Date.now() - 7 * 86400000).toISOString(), vocabCount: 9 },
      { bookTitle: 'Biscuit', grammarScore: 78, completedAt: new Date(Date.now() - 14 * 86400000).toISOString(), vocabCount: 8 },
    ],
    recentWords: ['friendship', 'hopeful', 'gentle', 'playful', 'wonder'],
    aiFeedback: "Zoe is progressing beautifully for her age. Her vocabulary retention is impressive.",
  },
  {
    id: 's8',
    classId: 'saturday',
    name: 'Noah Kang',
    avatarEmoji: '🐉',
    age: 13,
    level: 'advanced',
    booksReviewed: 21,
    avgScore: 89,
    lastActive: new Date(Date.now() - 5 * 86400000).toISOString(),
    status: 'active',
    streak: 6,
    totalWords: 198,
    recentSessions: [
      { bookTitle: 'Inkheart', grammarScore: 90, completedAt: new Date(Date.now() - 5 * 86400000).toISOString(), vocabCount: 19 },
      { bookTitle: 'Eragon', grammarScore: 88, completedAt: new Date(Date.now() - 12 * 86400000).toISOString(), vocabCount: 21 },
      { bookTitle: 'The Giver', grammarScore: 89, completedAt: new Date(Date.now() - 19 * 86400000).toISOString(), vocabCount: 17 },
    ],
    recentWords: ['dystopian', 'resilience', 'identity', 'sacrifice', 'profound'],
    aiFeedback: "Noah demonstrates sophisticated literary comprehension. Encourage him to write short summaries.",
  },
  {
    id: 's9',
    classId: 'saturday',
    name: 'Lily Han',
    avatarEmoji: '🌷',
    age: 10,
    level: 'intermediate',
    booksReviewed: 3,
    avgScore: 58,
    lastActive: new Date(Date.now() - 15 * 86400000).toISOString(),
    status: 'inactive',
    streak: 0,
    totalWords: 31,
    recentSessions: [
      { bookTitle: 'Judy Moody', grammarScore: 60, completedAt: new Date(Date.now() - 15 * 86400000).toISOString(), vocabCount: 6 },
      { bookTitle: 'Ramona Quimby Age 8', grammarScore: 56, completedAt: new Date(Date.now() - 28 * 86400000).toISOString(), vocabCount: 5 },
      { bookTitle: 'Clementine', grammarScore: 58, completedAt: new Date(Date.now() - 40 * 86400000).toISOString(), vocabCount: 5 },
    ],
    recentWords: ['moody', 'bossy', 'clever', 'silly', 'worried'],
    aiFeedback: "Lily has been inactive for 2 weeks. A friendly reminder and encouragement call is recommended.",
  },
];

const MOCK_BOOKS = [
  { id: 'b1', title: "Charlotte's Web", level: 'intermediate', emoji: '🕷️' },
  { id: 'b2', title: 'The Very Hungry Caterpillar', level: 'beginner', emoji: '🐛' },
  { id: 'b3', title: 'A Wrinkle in Time', level: 'advanced', emoji: '✨' },
  { id: 'b4', title: 'Matilda', level: 'intermediate', emoji: '📚' },
  { id: 'b5', title: 'The Hobbit', level: 'advanced', emoji: '🧙' },
  { id: 'b6', title: 'Magic Tree House: Dinosaurs Before Dark', level: 'beginner', emoji: '🦕' },
  { id: 'b7', title: 'Harry Potter and the Sorcerer Stone', level: 'intermediate', emoji: '⚡' },
  { id: 'b8', title: 'The Giver', level: 'advanced', emoji: '🌈' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper utilities
// ─────────────────────────────────────────────────────────────────────────────

function formatRelativeDate(isoString) {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getStatusConfig(status) {
  switch (status) {
    case 'active':
      return { label: 'Active', bg: '#E8F5E8', text: '#2E7D32', dot: '#5C8B5C' };
    case 'needs_attention':
      return { label: 'Needs Attention', bg: '#FFF3E0', text: '#E65100', dot: '#D4A843' };
    case 'inactive':
      return { label: 'Inactive', bg: '#FFEBEE', text: '#C62828', dot: '#D4736B' };
    default:
      return { label: 'Unknown', bg: '#F5F0E8', text: '#6B5744', dot: '#B8AFA0' };
  }
}

function getLevelConfig(level) {
  switch (level) {
    case 'beginner':
      return { label: 'Beginner', bg: '#E8F5E8', text: '#2E7D32' };
    case 'intermediate':
      return { label: 'Intermediate', bg: '#FFF8E1', text: '#8C6D00' };
    case 'advanced':
      return { label: 'Advanced', bg: '#E8EAF6', text: '#283593' };
    default:
      return { label: level, bg: '#F5F0E8', text: '#6B5744' };
  }
}

function getScoreColor(score) {
  if (score >= 85) return '#2E7D32';
  if (score >= 70) return '#8C6D00';
  return '#C62828';
}

function getScoreBg(score) {
  if (score >= 85) return '#E8F5E8';
  if (score >= 70) return '#FFF8E1';
  return '#FFEBEE';
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: StudentCard
// ─────────────────────────────────────────────────────────────────────────────

function StudentCard({ student, isExpanded, onToggle }) {
  const statusCfg = getStatusConfig(student.status);
  const levelCfg = getLevelConfig(student.level);

  return (
    <div
      className="bg-white/80 backdrop-blur-sm rounded-2xl border border-[#E8DEC8] shadow-sm overflow-hidden transition-shadow hover:shadow-md"
      style={isExpanded ? { boxShadow: '0 4px 20px rgba(61,107,61,0.15)', borderColor: '#5C8B5C' } : {}}
    >
      {/* Card header — always visible */}
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details for ${student.name}`}
        className="w-full text-left p-4 hover:bg-[#F9F6EE] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5C8B5C]"
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-2xl bg-[#F5F0E8] flex items-center justify-center text-2xl flex-shrink-0 border border-[#E8DEC8]">
            <span aria-hidden="true">{student.avatarEmoji}</span>
          </div>

          {/* Name + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-[#3D2E1E] text-sm">{student.name}</h3>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: levelCfg.bg, color: levelCfg.text }}
              >
                {levelCfg.label}
              </span>
            </div>
            <p className="text-xs text-[#6B5744] mt-0.5">Age {student.age} &bull; {student.booksReviewed} books reviewed</p>
          </div>

          {/* Status dot + label */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: statusCfg.dot }}
                aria-hidden="true"
              />
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: statusCfg.bg, color: statusCfg.text }}
              >
                {statusCfg.label}
              </span>
            </div>
            <span className="text-[10px] text-[#B8AFA0]">{formatRelativeDate(student.lastActive)}</span>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { label: 'Avg Score', value: `${student.avgScore}%`, color: getScoreColor(student.avgScore), bg: getScoreBg(student.avgScore) },
            { label: 'Words', value: student.totalWords, color: '#5C8B5C', bg: '#E8F5E8' },
            { label: 'Streak', value: `${student.streak}d`, color: student.streak >= 5 ? '#8C6D00' : '#6B5744', bg: student.streak >= 5 ? '#FFF8E1' : '#F5F0E8' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl px-2 py-1.5 text-center"
              style={{ background: stat.bg }}
            >
              <div className="text-sm font-extrabold" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-[10px] text-[#6B5744]">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Expand chevron */}
        <div className="flex justify-center mt-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#B8AFA0"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Expanded drill-down panel */}
      {isExpanded && (
        <div className="border-t border-[#F0EAD8] p-4 space-y-4 bg-[#FDFAF4]">

          {/* AI Feedback */}
          {student.aiFeedback && (
            <div className="bg-gradient-to-br from-[#FFF8E0] to-[#F5E8A8] border border-[#D4A843]/30 rounded-xl p-3">
              <p className="text-xs font-bold text-[#6B5744] mb-1 flex items-center gap-1.5">
                <span aria-hidden="true">🤖</span> HiAlice AI Feedback
              </p>
              <p className="text-xs text-[#3D2E1E] italic">&ldquo;{student.aiFeedback}&rdquo;</p>
            </div>
          )}

          {/* Recent sessions */}
          <div>
            <h4 className="text-xs font-bold text-[#3D2E1E] mb-2">Recent Sessions</h4>
            <div className="space-y-1.5">
              {student.recentSessions.map((session, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-[#F0EAD8]"
                >
                  <span className="text-base flex-shrink-0" aria-hidden="true">📚</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#3D2E1E] truncate">{session.bookTitle}</p>
                    <p className="text-[10px] text-[#B8AFA0]">
                      {formatRelativeDate(session.completedAt)} &bull; {session.vocabCount} new words
                    </p>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                    style={{ background: getScoreBg(session.grammarScore), color: getScoreColor(session.grammarScore) }}
                  >
                    {session.grammarScore}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent vocabulary */}
          <div>
            <h4 className="text-xs font-bold text-[#3D2E1E] mb-2">Recent Vocabulary</h4>
            <div className="flex flex-wrap gap-1.5">
              {student.recentWords.map((word) => (
                <span
                  key={word}
                  className="px-2 py-1 rounded-lg text-xs font-medium bg-[#EEF5F0] text-[#3D6B3D] border border-[#C8E6C9]"
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: ClassStats
// ─────────────────────────────────────────────────────────────────────────────

function ClassStats({ students }) {
  if (students.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-[#E8DEC8] p-8 text-center">
        <p className="text-[#6B5744] text-sm">No students in this class yet.</p>
      </div>
    );
  }

  const avgScore = Math.round(students.reduce((s, st) => s + st.avgScore, 0) / students.length);
  const totalBooks = students.reduce((s, st) => s + st.booksReviewed, 0);
  const totalWords = students.reduce((s, st) => s + st.totalWords, 0);
  const activeCount = students.filter((st) => st.status === 'active').length;
  const completionRate = Math.round((activeCount / students.length) * 100);

  // Most popular books — derived from recent sessions
  const bookFreq = {};
  students.forEach((st) => {
    st.recentSessions.forEach((session) => {
      bookFreq[session.bookTitle] = (bookFreq[session.bookTitle] || 0) + 1;
    });
  });
  const topBooks = Object.entries(bookFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  // Weekly sessions — count sessions in the last 7 days
  const weekAgo = Date.now() - 7 * 86400000;
  const weeklySessions = students.reduce((sum, st) => {
    return sum + st.recentSessions.filter((s) => new Date(s.completedAt).getTime() > weekAgo).length;
  }, 0);

  const statsRow = [
    { label: 'Class Avg Score', value: `${avgScore}%`, icon: '📊', accent: getScoreColor(avgScore), bg: getScoreBg(avgScore) },
    { label: 'Total Books Read', value: totalBooks, icon: '📖', accent: '#5C8B5C', bg: '#E8F5E8' },
    { label: 'Words Learned', value: totalWords, icon: '💡', accent: '#8C6D00', bg: '#FFF8E1' },
    { label: 'Active This Week', value: `${completionRate}%`, icon: '⚡', accent: '#283593', bg: '#E8EAF6' },
  ];

  return (
    <div className="space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {statsRow.map((stat) => (
          <div
            key={stat.label}
            className="bg-white/80 backdrop-blur-sm rounded-2xl border border-[#E8DEC8] p-4 flex items-center gap-3"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: stat.bg }}
              aria-hidden="true"
            >
              {stat.icon}
            </div>
            <div className="min-w-0">
              <div className="text-xl font-extrabold" style={{ color: stat.accent }}>{stat.value}</div>
              <div className="text-xs text-[#6B5744] leading-tight">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Popular books + weekly sessions side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Most popular books */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-[#E8DEC8] p-4">
          <h4 className="text-sm font-bold text-[#3D2E1E] mb-3">Most Popular Books</h4>
          {topBooks.length === 0 ? (
            <p className="text-xs text-[#6B5744]">No sessions yet.</p>
          ) : (
            <div className="space-y-2">
              {topBooks.map(([title, count], i) => (
                <div key={title} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#A8822E] w-4 flex-shrink-0">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#3D2E1E] truncate">{title}</p>
                  </div>
                  <span className="text-[10px] font-bold text-[#5C8B5C] flex-shrink-0">{count} sessions</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weekly activity summary */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-[#E8DEC8] p-4">
          <h4 className="text-sm font-bold text-[#3D2E1E] mb-3">This Week</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6B5744]">Total sessions</span>
              <span className="text-sm font-extrabold text-[#3D2E1E]">{weeklySessions}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6B5744]">Active students</span>
              <span className="text-sm font-extrabold text-[#5C8B5C]">{activeCount} / {students.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6B5744]">Needs attention</span>
              <span
                className="text-sm font-extrabold"
                style={{ color: students.filter((s) => s.status === 'needs_attention').length > 0 ? '#D4736B' : '#5C8B5C' }}
              >
                {students.filter((s) => s.status === 'needs_attention' || s.status === 'inactive').length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: AssignBookModal
// ─────────────────────────────────────────────────────────────────────────────

function AssignBookModal({ className, onClose }) {
  const [selectedBook, setSelectedBook] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [done, setDone] = useState(false);

  const handleAssign = () => {
    if (!selectedBook) return;
    setAssigning(true);
    // Simulate API call
    setTimeout(() => {
      setAssigning(false);
      setDone(true);
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(61,46,30,0.5)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-book-title"
    >
      <div className="bg-[#FDFAF4] rounded-2xl shadow-2xl border border-[#E8DEC8] w-full max-w-sm overflow-hidden">
        <div
          className="px-5 py-4 border-b border-[#E8DEC8] flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #EEF5EE 0%, #FDFAF4 100%)' }}
        >
          <h2 id="assign-book-title" className="font-bold text-[#3D2E1E]">Assign Book to {className}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg hover:bg-[#E8DEC8] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C8B5C]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#6B5744" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {done ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3" aria-hidden="true">✅</div>
              <p className="font-bold text-[#3D6B3D]">Book assigned!</p>
              <p className="text-sm text-[#6B5744] mt-1">All students in {className} can now start reviewing.</p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2.5 bg-[#5C8B5C] text-white rounded-xl text-sm font-bold hover:bg-[#3D6B3D] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3D6B3D]"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-[#6B5744]">Select a book to assign to all students in this class.</p>
              <div className="space-y-2">
                {MOCK_BOOKS.map((book) => {
                  const levelCfg = getLevelConfig(book.level);
                  return (
                    <button
                      key={book.id}
                      onClick={() => setSelectedBook(book.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C8B5C] ${
                        selectedBook === book.id
                          ? 'border-[#5C8B5C] bg-[#EEF5EE] shadow-sm'
                          : 'border-[#E8DEC8] bg-white hover:bg-[#F9F6EE]'
                      }`}
                    >
                      <span className="text-xl flex-shrink-0" aria-hidden="true">{book.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#3D2E1E] truncate">{book.title}</p>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: levelCfg.bg, color: levelCfg.text }}
                      >
                        {levelCfg.label}
                      </span>
                      {selectedBook === book.id && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#5C8B5C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleAssign}
                disabled={!selectedBook || assigning}
                className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3D6B3D] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: selectedBook ? '#3D6B3D' : '#B8AFA0' }}
              >
                {assigning ? 'Assigning…' : 'Assign to Class'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main TeacherDashboard component
// ─────────────────────────────────────────────────────────────────────────────

export default function TeacherDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [teacherName, setTeacherName] = useState('');
  const [academyName, setAcademyName] = useState('Hi Alice Academy');
  const [editingAcademy, setEditingAcademy] = useState(false);
  const [academyDraft, setAcademyDraft] = useState('');

  const [selectedClassId, setSelectedClassId] = useState('morning');
  const [expandedStudentId, setExpandedStudentId] = useState(null);

  const [bulkActionStatus, setBulkActionStatus] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Auth check and initial data load
  useEffect(() => {
    const token = getItem('token');
    if (!token) {
      router.push('/');
      return;
    }
    // Accept teacher, admin, super_admin, or parent roles for demo access
    const role = getItem('userRole');
    const allowedRoles = ['teacher', 'admin', 'super_admin', 'parent'];
    if (role && !allowedRoles.includes(role)) {
      router.push('/');
      return;
    }

    const name = getItem('studentName') || getItem('parentEmail') || 'Teacher';
    setTeacherName(name);

    // Simulate a brief load
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, [router]);

  const classStudents = MOCK_STUDENTS.filter((s) => s.classId === selectedClassId);
  const selectedClass = MOCK_CLASSES.find((c) => c.id === selectedClassId);

  const inactiveStudents = classStudents.filter(
    (s) => s.status === 'inactive' || s.status === 'needs_attention'
  );

  const handleToggleExpand = useCallback((studentId) => {
    setExpandedStudentId((prev) => (prev === studentId ? null : studentId));
  }, []);

  const handleSendReminder = () => {
    if (inactiveStudents.length === 0) return;
    setBulkActionStatus('sending');
    setTimeout(() => {
      setBulkActionStatus('sent');
      setTimeout(() => setBulkActionStatus(''), 3000);
    }, 1400);
  };

  const handleExportReport = () => {
    setBulkActionStatus('exporting');
    setTimeout(() => {
      setBulkActionStatus('exported');
      setTimeout(() => setBulkActionStatus(''), 3000);
    }, 1000);
  };

  const handleSaveAcademy = () => {
    if (academyDraft.trim()) {
      setAcademyName(academyDraft.trim());
    }
    setEditingAcademy(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F0E8] p-4 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-4">
          {/* Header skeleton */}
          <div className="h-16 bg-white/60 rounded-2xl border border-[#E8DEC8]" />
          {/* Class selector skeleton */}
          <div className="h-12 bg-white/60 rounded-2xl border border-[#E8DEC8]" />
          {/* Stats skeleton */}
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-white/60 rounded-2xl border border-[#E8DEC8]" />
            <div className="h-20 bg-white/60 rounded-2xl border border-[#E8DEC8]" />
            <div className="h-20 bg-white/60 rounded-2xl border border-[#E8DEC8]" />
            <div className="h-20 bg-white/60 rounded-2xl border border-[#E8DEC8]" />
          </div>
          {/* Student cards skeleton */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white/60 rounded-2xl border border-[#E8DEC8]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {showAssignModal && (
        <AssignBookModal
          className={selectedClass?.label ?? 'Class'}
          onClose={() => setShowAssignModal(false)}
        />
      )}

      <div className="min-h-screen bg-[#F5F0E8] p-4 max-w-3xl mx-auto space-y-5">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-[#E8DEC8] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-extrabold text-[#3D2E1E]">Teacher Dashboard</h1>
              {editingAcademy ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={academyDraft}
                    onChange={(e) => setAcademyDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveAcademy();
                      if (e.key === 'Escape') setEditingAcademy(false);
                    }}
                    autoFocus
                    placeholder="Academy name..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-[#C8B99A] bg-white text-sm text-[#3D2E1E] placeholder:text-[#B8AFA0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C8B5C]"
                    aria-label="Academy or school name"
                  />
                  <button
                    onClick={handleSaveAcademy}
                    className="px-3 py-1.5 rounded-xl bg-[#3D6B3D] text-white text-xs font-bold hover:bg-[#5C8B5C] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3D6B3D]"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingAcademy(false)}
                    className="px-3 py-1.5 rounded-xl bg-[#F5F0E8] text-[#6B5744] text-xs font-bold hover:bg-[#E8DEC8] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6B5744]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAcademyDraft(academyName);
                    setEditingAcademy(true);
                  }}
                  className="flex items-center gap-1.5 mt-1 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C8B5C] rounded-lg"
                  aria-label={`Edit academy name: ${academyName}`}
                >
                  <p className="text-sm text-[#6B5744] group-hover:text-[#3D2E1E] transition-colors">{academyName}</p>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#B8AFA0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-[#7AC87A]" aria-hidden="true" />
              <span className="text-xs text-[#3D2E1E] font-bold truncate max-w-[80px]">{teacherName}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EEF5EE] text-[#3D6B3D] font-bold border border-[#C8E6C9]">Teacher</span>
            </div>
          </div>
        </div>

        {/* ── Class selector ───────────────────────────────────────────── */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-[#E8DEC8] p-4">
          <label htmlFor="class-select" className="block text-xs font-bold text-[#6B5744] mb-2 uppercase tracking-wide">
            Select Class
          </label>
          <select
            id="class-select"
            value={selectedClassId}
            onChange={(e) => {
              setSelectedClassId(e.target.value);
              setExpandedStudentId(null);
            }}
            className="w-full px-4 py-3 rounded-xl border border-[#C8B99A] bg-[#FDFAF4] text-[#3D2E1E] font-bold text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C8B5C] transition-colors"
          >
            {MOCK_CLASSES.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.label} — {cls.time}
              </option>
            ))}
          </select>

          {/* Student count badge */}
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-xs text-[#6B5744]">
              {classStudents.length} student{classStudents.length !== 1 ? 's' : ''} enrolled
            </span>
            {inactiveStudents.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF3E0] text-[#E65100] border border-[#FFCC80]">
                {inactiveStudents.length} need{inactiveStudents.length === 1 ? 's' : ''} attention
              </span>
            )}
          </div>
        </div>

        {/* ── Class Statistics ─────────────────────────────────────────── */}
        <section aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="text-base font-extrabold text-[#3D2E1E] mb-3 flex items-center gap-2">
            <span aria-hidden="true">📊</span> Class Statistics
          </h2>
          <ClassStats students={classStudents} />
        </section>

        {/* ── Student Overview Grid ────────────────────────────────────── */}
        <section aria-labelledby="students-heading">
          <h2 id="students-heading" className="text-base font-extrabold text-[#3D2E1E] mb-3 flex items-center gap-2">
            <span aria-hidden="true">👨‍🎓</span> Students
            <span className="text-xs font-normal text-[#6B5744]">— click a card to see details</span>
          </h2>

          {classStudents.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-[#E8DEC8] p-10 text-center">
              <div className="text-5xl mb-3" aria-hidden="true">📭</div>
              <p className="text-[#3D2E1E] font-medium">No students in this class</p>
              <p className="text-sm text-[#6B5744] mt-1">Students will appear here once enrolled.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {classStudents.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  isExpanded={expandedStudentId === student.id}
                  onToggle={() => handleToggleExpand(student.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Bulk Actions ─────────────────────────────────────────────── */}
        <section aria-labelledby="actions-heading">
          <h2 id="actions-heading" className="text-base font-extrabold text-[#3D2E1E] mb-3 flex items-center gap-2">
            <span aria-hidden="true">⚡</span> Actions
          </h2>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-[#E8DEC8] p-5 space-y-3">

            {/* Feedback status message */}
            {bulkActionStatus === 'sent' && (
              <div role="status" aria-live="polite" className="flex items-center gap-2 p-3 rounded-xl bg-[#EEF5EE] border border-[#C8E6C9]">
                <span aria-hidden="true">✅</span>
                <p className="text-sm text-[#3D6B3D] font-medium">
                  Reminders sent to {inactiveStudents.length} student{inactiveStudents.length !== 1 ? 's' : ''}.
                </p>
              </div>
            )}
            {bulkActionStatus === 'exported' && (
              <div role="status" aria-live="polite" className="flex items-center gap-2 p-3 rounded-xl bg-[#EEF5EE] border border-[#C8E6C9]">
                <span aria-hidden="true">📄</span>
                <p className="text-sm text-[#3D6B3D] font-medium">
                  Class report exported successfully.
                </p>
              </div>
            )}

            {/* Send reminder */}
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#3D2E1E]">Send Reminder to Inactive Students</p>
                <p className="text-xs text-[#6B5744] mt-0.5">
                  {inactiveStudents.length > 0
                    ? `${inactiveStudents.length} student${inactiveStudents.length !== 1 ? 's' : ''} in ${selectedClass?.label ?? 'this class'} need${inactiveStudents.length === 1 ? 's' : ''} a nudge.`
                    : 'All students are active in this class.'}
                </p>
              </div>
              <button
                onClick={handleSendReminder}
                disabled={inactiveStudents.length === 0 || bulkActionStatus === 'sending'}
                className="flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4736B] disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: inactiveStudents.length > 0 ? '#D4736B' : '#B8AFA0',
                  color: 'white',
                  minHeight: '40px',
                  minWidth: '90px',
                  boxShadow: inactiveStudents.length > 0 ? '0 2px 8px rgba(212,115,107,0.35)' : 'none',
                }}
              >
                {bulkActionStatus === 'sending' ? 'Sending…' : 'Send'}
              </button>
            </div>

            <div className="border-t border-[#F0EAD8]" />

            {/* Export class report */}
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#3D2E1E]">Export Class Report</p>
                <p className="text-xs text-[#6B5744] mt-0.5">
                  Download a summary of scores, vocabulary growth, and session history for {selectedClass?.label ?? 'this class'}.
                </p>
              </div>
              <button
                onClick={handleExportReport}
                disabled={classStudents.length === 0 || bulkActionStatus === 'exporting'}
                className="flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3D6B3D] disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: '#3D6B3D',
                  color: 'white',
                  minHeight: '40px',
                  minWidth: '90px',
                  boxShadow: '0 2px 8px rgba(61,107,61,0.3)',
                }}
              >
                {bulkActionStatus === 'exporting' ? 'Exporting…' : 'Export'}
              </button>
            </div>

            <div className="border-t border-[#F0EAD8]" />

            {/* Assign a book */}
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#3D2E1E]">Assign a Book to Class</p>
                <p className="text-xs text-[#6B5744] mt-0.5">
                  Pick a book from the library and assign it to all students in {selectedClass?.label ?? 'this class'}.
                </p>
              </div>
              <button
                onClick={() => setShowAssignModal(true)}
                disabled={classStudents.length === 0}
                className="flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A843] disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: '#D4A843',
                  color: 'white',
                  minHeight: '40px',
                  minWidth: '90px',
                  boxShadow: '0 2px 8px rgba(212,168,67,0.3)',
                }}
              >
                Assign
              </button>
            </div>
          </div>
        </section>

        {/* Bottom spacing for mobile nav */}
        <div className="h-4" aria-hidden="true" />
      </div>
    </>
  );
}
