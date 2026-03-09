'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MOCK_CHILDREN = [
  {
    id: 1,
    name: 'Alice',
    age: 8,
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
    // Save parent auth data to sessionStorage
    sessionStorage.setItem('parentId', 'parent-' + Date.now());
    sessionStorage.setItem('authToken', 'token-' + Date.now());
    sessionStorage.setItem('parentEmail', parentEmail);
    setShowLogin(false);
    setError('');
  };

  const handleSelectChild = (child) => {
    setSelectedChild(child);
    // Store selected child data in sessionStorage for use in other pages
    sessionStorage.setItem('studentId', child.id);
    sessionStorage.setItem('studentName', child.name);
    sessionStorage.setItem('studentLevel', child.level);
    sessionStorage.setItem('studentAge', child.age);
    router.push('/books');
  };

  const handleDemoMode = () => {
    // Skip login and use mock student data
    sessionStorage.setItem('parentId', 'demo-parent');
    sessionStorage.setItem('authToken', 'demo-token');
    sessionStorage.setItem('parentEmail', 'demo@hialice.com');
    
    // Use first child as demo student
    const demoChild = MOCK_CHILDREN[0];
    sessionStorage.setItem('studentId', demoChild.id);
    sessionStorage.setItem('studentName', demoChild.name);
    sessionStorage.setItem('studentLevel', demoChild.level);
    sessionStorage.setItem('studentAge', demoChild.age);
    
    router.push('/books');
  };

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center py-12">
      {!showLogin && !selectedChild && (
        <div className="w-full max-w-2xl">
          {/* Logo Area */}
          <div className="text-center mb-12">
            <div className="text-8xl mb-4">📚</div>
            <h1 className="text-5xl font-bold text-primary mb-2">HiAlice</h1>
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">English Reading Adventure</h2>
            <p className="text-gray-600 text-lg">
              AI-powered English reading for children aged 6-13
            </p>
          </div>

          {/* Card Layout */}
          <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">Select Your Child</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {MOCK_CHILDREN.map((child) => (
                <div
                  key={child.id}
                  onClick={() => handleSelectChild(child)}
                  className="p-6 border-2 border-gray-200 rounded-lg hover:shadow-xl hover:border-blue-400 cursor-pointer transition-all duration-200 transform hover:scale-105"
                >
                  <div className="text-6xl mb-4 text-center">{child.avatar}</div>
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

            <div className="space-y-3">
              <button
                onClick={() => setShowLogin(true)}
                className="w-full py-3 px-6 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-semibold"
              >
                Parent Login
              </button>
              
              <button
                onClick={handleDemoMode}
                className="w-full py-3 px-6 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-semibold"
              >
                Demo Mode (Try as Alice)
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogin && (
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg p-8">
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
                className="w-full py-3 px-6 bg-primary text-white rounded-lg hover:bg-blue-600 transition-all font-semibold"
              >
                Login
              </button>
            </form>

            <button
              onClick={() => {
                setShowLogin(false);
                setError('');
                setParentEmail('');
                setParentPassword('');
              }}
              className="w-full mt-4 py-3 px-6 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-semibold"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
