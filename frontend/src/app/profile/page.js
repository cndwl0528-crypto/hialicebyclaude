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
  },
  {
    id: 2,
    bookTitle: 'Where the Wild Things Are',
    date: '2026-03-07',
    levelScore: 88,
    grammarScore: 82,
  },
  {
    id: 3,
    bookTitle: 'Winnie-the-Pooh',
    date: '2026-03-06',
    levelScore: 80,
    grammarScore: 75,
  },
];

export default function ProfilePage() {
  const router = useRouter();
  const [student, setStudent] = useState(MOCK_STUDENT);
  const [sessions, setSessions] = useState(MOCK_SESSIONS);

  const totalBooksRead = sessions.length;
  const totalWordsLearned = totalBooksRead * 15; // Mock calculation
  const currentStreak = 3; // Mock streak

  const LEVEL_COLORS = {
    Beginner: 'bg-pink-100 text-pink-700',
    Intermediate: 'bg-blue-100 text-blue-700',
    Advanced: 'bg-green-100 text-green-700',
  };

  return (
    <div className="py-8">
      {/* Student Profile Card */}
      <div className="bg-white rounded-lg shadow-md p-8 mb-8">
        <div className="flex items-center gap-6 mb-6">
          <div className="text-7xl">{student.avatar}</div>
          <div>
            <h2 className="text-3xl font-bold text-gray-800">{student.name}</h2>
            <p className="text-gray-600 mb-3">Age {student.age}</p>
            <span
              className={`px-4 py-2 rounded-full text-white font-semibold ${
                student.level === 'Beginner'
                  ? 'bg-pink-500'
                  : student.level === 'Intermediate'
                  ? 'bg-blue-500'
                  : 'bg-green-500'
              }`}
            >
              {student.level}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 border-t border-gray-200 pt-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-500">{totalBooksRead}</div>
            <p className="text-gray-600 text-sm">Books Read</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-500">{totalWordsLearned}</div>
            <p className="text-gray-600 text-sm">Words Learned</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-orange-500">{currentStreak}</div>
            <p className="text-gray-600 text-sm">Day Streak</p>
          </div>
        </div>
      </div>

      {/* Reading History */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-2xl font-bold text-gray-800">Reading History</h3>
        </div>

        {sessions.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            <p>No reading sessions yet. Start your first book!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="px-6 py-4 hover:bg-gray-50 transition-smooth"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-800">{session.bookTitle}</h4>
                  <span className="text-gray-500 text-sm">
                    {new Date(session.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-600">
                        Level Score
                      </span>
                      <span className="text-xs font-bold text-blue-600">
                        {session.levelScore}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${session.levelScore}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-600">
                        Grammar Score
                      </span>
                      <span className="text-xs font-bold text-green-600">
                        {session.grammarScore}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${session.grammarScore}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex gap-4 justify-center">
        <button
          onClick={() => router.push('/books')}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-smooth font-semibold"
        >
          Read a Book
        </button>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-smooth font-semibold"
        >
          Home
        </button>
      </div>
    </div>
  );
}
