'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MOCK_CHILDREN = [
  {
    id: 1,
    name: 'Alice',
    age: 7,
    level: 'Beginner',
    avatar: '👧',
    color: '#FF6B9D',
  },
  {
    id: 2,
    name: 'Bob',
    age: 11,
    level: 'Intermediate',
    avatar: '👦',
    color: '#4A90D9',
  },
];

const LEVEL_COLORS = {
  Beginner: '#FF6B9D',
  Intermediate: '#4A90D9',
  Advanced: '#27AE60',
};

export default function Home() {
  const router = useRouter();
  const [showLogin, setShowLogin] = useState(false);
  const [parentEmail, setParentEmail] = useState('');
  const [parentPassword, setParentPassword] = useState('');
  const [selectedChild, setSelectedChild] = useState(null);
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (!parentEmail || !parentPassword) {
      setError('Please fill in all fields');
      return;
    }
    // Mock login - just proceed
    setShowLogin(false);
    setError('');
  };

  const handleSelectChild = (child) => {
    setSelectedChild(child);
    // Store selected child in sessionStorage for use in other pages
    sessionStorage.setItem('selectedChild', JSON.stringify(child));
    router.push('/books');
  };

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center py-12">
      {!showLogin && !selectedChild && (
        <div className="w-full max-w-2xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-primary mb-4">Welcome to HiAlice</h2>
            <p className="text-gray-600 text-lg">
              AI-powered English reading for children aged 6-13
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Select Your Child</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {MOCK_CHILDREN.map((child) => (
                <div
                  key={child.id}
                  onClick={() => handleSelectChild(child)}
                  className="p-6 border-2 border-gray-200 rounded-lg hover:shadow-lg cursor-pointer transition-smooth hover:border-blue-400"
                >
                  <div className="text-5xl mb-4 text-center">{child.avatar}</div>
                  <h4 className="text-xl font-bold text-center text-gray-800 mb-2">
                    {child.name}
                  </h4>
                  <p className="text-center text-gray-600 mb-3">Age {child.age}</p>
                  <div className="flex justify-center">
                    <span
                      className="px-4 py-1 rounded-full text-white text-sm font-semibold"
                      style={{ backgroundColor: LEVEL_COLORS[child.level] }}
                    >
                      {child.level}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowLogin(true)}
              className="w-full py-3 px-6 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-smooth font-semibold"
            >
              Parent Login
            </button>
          </div>
        </div>
      )}

      {showLogin && (
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-md p-8">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Parent Login</h3>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="parent@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={parentPassword}
                  onChange={(e) => setParentPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="••••••••"
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                className="w-full py-3 px-6 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-smooth font-semibold"
              >
                Login
              </button>
            </form>

            <button
              onClick={() => setShowLogin(false)}
              className="w-full mt-4 py-3 px-6 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-smooth font-semibold"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
