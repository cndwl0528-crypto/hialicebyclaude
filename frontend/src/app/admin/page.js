'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

export default function AdminDashboard() {
  const [stats, setStats] = useState(MOCK_STATS);
  const [sessions, setSessions] = useState(MOCK_RECENT_SESSIONS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const token =
          typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
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
    </div>
  );
}
