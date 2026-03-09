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
    color: '#5C8B5C',
  },
  {
    id: 2,
    name: 'Bob',
    age: 11,
    level: 'Intermediate',
    avatar: '👦',
    color: '#D4A843',
  },
];

const LEVEL_STYLES = {
  Beginner: { bg: '#C8E6C9', text: '#2E7D32' },
  Intermediate: { bg: '#FFE0B2', text: '#E65100' },
  Advanced: { bg: '#E1BEE7', text: '#6A1B9A' },
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
    sessionStorage.setItem('parentId', 'parent-' + Date.now());
    sessionStorage.setItem('authToken', 'token-' + Date.now());
    sessionStorage.setItem('parentEmail', parentEmail);
    setShowLogin(false);
    setError('');
  };

  const handleSelectChild = (child) => {
    setSelectedChild(child);
    sessionStorage.setItem('studentId', child.id);
    sessionStorage.setItem('studentName', child.name);
    sessionStorage.setItem('studentLevel', child.level);
    sessionStorage.setItem('studentAge', child.age);
    router.push('/books');
  };

  const handleDemoMode = () => {
    sessionStorage.setItem('parentId', 'demo-parent');
    sessionStorage.setItem('authToken', 'demo-token');
    sessionStorage.setItem('parentEmail', 'demo@hialice.com');

    const demoChild = MOCK_CHILDREN[0];
    sessionStorage.setItem('studentId', demoChild.id);
    sessionStorage.setItem('studentName', demoChild.name);
    sessionStorage.setItem('studentLevel', demoChild.level);
    sessionStorage.setItem('studentAge', demoChild.age);

    router.push('/books');
  };

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center py-8">
      {!showLogin && !selectedChild && (
        <div className="w-full max-w-2xl">
          {/* Hero Section — Sky to Earth Gradient */}
          <div className="text-center mb-10 px-4 py-10 rounded-3xl bg-gradient-to-b from-[#A8DAEA] to-[#F5F0E8] border-b-4 border-[#C8E6C9] shadow-[0_4px_20px_rgba(61,46,30,0.08)]">
            <div className="text-7xl mb-4 float-animation inline-block">🌿</div>
            <h1 className="text-5xl font-extrabold text-[#3D6B3D] mb-2 drop-shadow-sm">
              HiAlice
            </h1>
            <h2 className="text-xl font-bold text-[#6B5744] mb-3">
              English Reading Adventure
            </h2>
            <p className="text-[#6B5744] text-base font-medium">
              AI-powered English reading for children aged 6-13
            </p>
          </div>

          {/* Student Selection Card */}
          <div className="ghibli-card p-8 mb-5">
            <h3 className="text-2xl font-extrabold text-[#3D2E1E] mb-6 text-center">
              Who is reading today?
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {MOCK_CHILDREN.map((child) => {
                const levelStyle = LEVEL_STYLES[child.level] || { bg: '#E8DEC8', text: '#6B5744' };
                return (
                  <div
                    key={child.id}
                    onClick={() => handleSelectChild(child)}
                    className="p-6 border-2 border-[#E8DEC8] rounded-2xl hover:border-[#5C8B5C] hover:bg-[#E8F5E8] cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(92,139,92,0.15)] bg-[#FFFCF3]"
                  >
                    <div className="text-6xl mb-4 text-center">{child.avatar}</div>
                    <h4 className="text-xl font-extrabold text-center text-[#3D2E1E] mb-2">
                      {child.name}
                    </h4>
                    <p className="text-center text-[#6B5744] font-semibold mb-3">Age {child.age}</p>
                    <div className="flex justify-center">
                      <span
                        className="px-4 py-1.5 rounded-full text-sm font-bold"
                        style={{ backgroundColor: levelStyle.bg, color: levelStyle.text }}
                      >
                        {child.level}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setShowLogin(true)}
                className="w-full py-3 px-6 bg-[#EDE5D4] text-[#6B5744] rounded-2xl hover:bg-[#D6C9A8] transition-all font-bold hover:-translate-y-0.5"
              >
                Parent Login
              </button>

              <button
                onClick={handleDemoMode}
                className="w-full py-3 px-6 bg-[#5C8B5C] text-white rounded-2xl hover:bg-[#3D6B3D] transition-all font-bold hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(92,139,92,0.3)]"
              >
                Demo Mode — Try as Alice
              </button>
            </div>
          </div>

          {/* Feature Hints */}
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { icon: '🎤', label: 'Voice Learning' },
              { icon: '📚', label: 'Curated Books' },
              { icon: '🌟', label: 'Smart Feedback' },
            ].map((feat, idx) => (
              <div key={idx} className="bg-[#FFFCF3] border border-[#E8DEC8] rounded-2xl p-3">
                <div className="text-2xl mb-1">{feat.icon}</div>
                <p className="text-xs font-bold text-[#6B5744]">{feat.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showLogin && (
        <div className="w-full max-w-md">
          <div className="ghibli-card p-8">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🌿</div>
              <h3 className="text-2xl font-extrabold text-[#3D2E1E]">Parent Login</h3>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#6B5744] mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] focus:border-transparent bg-[#FFFCF3] text-[#3D2E1E] font-semibold"
                  placeholder="parent@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#6B5744] mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={parentPassword}
                  onChange={(e) => setParentPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] focus:border-transparent bg-[#FFFCF3] text-[#3D2E1E] font-semibold"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-[#D4736B] text-sm font-semibold">{error}</p>
              )}

              <button
                type="submit"
                className="w-full py-3 px-6 bg-[#5C8B5C] text-white rounded-2xl hover:bg-[#3D6B3D] transition-all font-bold hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(92,139,92,0.3)]"
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
              className="w-full mt-4 py-3 px-6 bg-[#EDE5D4] text-[#6B5744] rounded-2xl hover:bg-[#D6C9A8] transition-all font-bold hover:-translate-y-0.5"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
