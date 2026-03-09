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
    bookTitle: 'Charlotte\'s Web',
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

const maxSessions = Math.max(...WEEKLY_SESSIONS.map(d => d.sessions));

export default function AdminDashboard() {
  const [stats, setStats] = useState(MOCK_STATS);
  const [sessions, setSessions] = useState(MOCK_RECENT_SESSIONS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Try to fetch from API
    const fetchStats = async () => {
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/admin/stats`, {
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const data = await response.json();
          setStats(data.stats || MOCK_STATS);
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

  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Students', value: stats.totalStudents, icon: '👨‍🎓', color: '#4A90D9' },
          { label: 'Total Books', value: stats.totalBooks, icon: '📚', color: '#F39C12' },
          { label: 'Active Sessions', value: stats.activeSessions, icon: '⏳', color: '#27AE60' },
          { label: 'Avg Grammar Score', value: `${stats.avgGrammarScore}%`, icon: '📝', color: '#E74C3C' },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="bg-white rounded-lg shadow-md p-6 border-l-4"
            style={{ borderLeftColor: stat.color }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">{stat.value}</p>
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
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all font-semibold"
          style={{ minHeight: '48px', minWidth: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ➕ Add Student
        </Link>
        <Link
          href="/admin/books"
          className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-semibold"
          style={{ minHeight: '48px', minWidth: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ➕ Add Book
        </Link>
        <Link
          href="/admin/reports"
          className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all font-semibold"
          style={{ minHeight: '48px', minWidth: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          📊 View Reports
        </Link>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessions Per Week Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Sessions Per Week</h3>
          <div className="flex items-end justify-around h-64 gap-2">
            {WEEKLY_SESSIONS.map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                <div
                  className="bg-blue-400 rounded-t-lg w-full transition-all hover:bg-blue-500"
                  style={{
                    height: `${(item.sessions / maxSessions) * 200}px`,
                    minHeight: '20px',
                  }}
                  title={`${item.sessions} sessions`}
                />
                <span className="text-xs font-semibold text-gray-600">{item.day}</span>
                <span className="text-xs text-gray-400">{item.sessions}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Level Distribution Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Level Distribution</h3>
          <div className="flex items-center justify-center gap-8 h-64">
            <svg viewBox="0 0 200 200" className="w-48 h-48">
              {/* Pie Chart - Simplified */}
              <circle cx="100" cy="100" r="80" fill="#A8E6CF" />
              <circle cx="100" cy="100" r="70" fill="white" />
              <circle
                cx="100"
                cy="100"
                r="80"
                fill="none"
                stroke="#FFD3B6"
                strokeWidth="16"
                strokeDasharray={`${(LEVEL_DISTRIBUTION.Intermediate / 24) * 502} 502`}
              />
              <text
                x="100"
                y="100"
                textAnchor="middle"
                dy="0.3em"
                className="text-sm font-bold"
                fill="#333"
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
                          ? '#A8E6CF'
                          : level === 'Intermediate'
                          ? '#FFD3B6'
                          : '#F8B195',
                    }}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {level}: {count} students
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">Recent Sessions</h3>
          <Link
            href="/admin/reports"
            className="text-blue-500 hover:text-blue-700 text-sm font-semibold"
          >
            View All →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Student</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Book</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Stage</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Grammar</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Time</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr
                  key={session.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 px-4 font-medium text-gray-800">{session.studentName}</td>
                  <td className="py-3 px-4 text-gray-700 max-w-xs truncate">
                    {session.bookTitle}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                      {session.stage}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        session.grammarScore >= 80
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {session.grammarScore}%
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        session.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {session.status === 'completed' ? '✓ Done' : '⏳ Active'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
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
