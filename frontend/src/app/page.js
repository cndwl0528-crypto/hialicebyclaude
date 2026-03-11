'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = sessionStorage.getItem('token');
      if (token) {
        router.push('/dashboard');
      }
    }
  }, [router]);

  const handleDemoMode = () => {
    sessionStorage.setItem('parentId', 'demo-parent');
    sessionStorage.setItem('token', 'demo-token');
    sessionStorage.setItem('parentEmail', 'demo@hialice.com');
    sessionStorage.setItem('userRole', 'student');
    sessionStorage.setItem('studentId', '1');
    sessionStorage.setItem('studentName', 'Alice');
    sessionStorage.setItem('studentLevel', 'Beginner');
    sessionStorage.setItem('studentAge', '8');
    router.push('/dashboard');
  };

  const features = [
    { icon: '🎤', label: 'Voice Learning', description: 'Practice speaking with AI' },
    { icon: '📚', label: 'Curated Books', description: 'Level-matched reading list' },
    { icon: '🌟', label: 'Smart Feedback', description: 'Instant grammar guidance' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex flex-col items-center justify-center py-10 px-4">
      <div className="w-full max-w-2xl flex flex-col items-center gap-7">

        {/* Hero Section */}
        <div
          className="w-full text-center px-6 py-12 rounded-3xl relative overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #A8DAEA 0%, #C8E6C9 40%, #F5F0E8 100%)',
            border: '1px solid #C8E6C9',
            boxShadow: '0 8px 40px rgba(61,46,30,0.10), inset 0 1px 0 rgba(255,255,255,0.6)',
          }}
        >
          {/* Decorative elements */}
          <div
            className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(92,139,92,0.12) 0%, transparent 70%)', transform: 'translate(25%, -25%)' }}
            aria-hidden="true"
          />
          <div
            className="absolute bottom-0 left-0 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(135,206,219,0.15) 0%, transparent 70%)', transform: 'translate(-25%, 25%)' }}
            aria-hidden="true"
          />
          <div
            className="text-7xl mb-4 inline-block relative z-10"
            style={{ animation: 'float 3s ease-in-out infinite' }}
            aria-hidden="true"
          >
            🌿
          </div>
          <h1 className="text-5xl font-extrabold text-[#3D6B3D] mb-2 drop-shadow-sm relative z-10 tracking-tight">
            HiAlice
          </h1>
          <h2 className="text-xl font-bold text-[#5C8B5C] mb-3 relative z-10">
            English Reading Adventure
          </h2>
          <p className="text-[#6B5744] text-sm font-semibold relative z-10 max-w-sm mx-auto leading-relaxed">
            AI-powered English reading for children aged 6–13.
            Talk about books, learn new words, grow smarter.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="w-full grid grid-cols-3 gap-3 sm:gap-4">
          {features.map((feat, idx) => {
            const bgs = ['#E8F5E8', '#E8F0FC', '#FFF8E0'];
            return (
              <div
                key={idx}
                className="rounded-2xl p-4 sm:p-5 flex flex-col items-center text-center transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{
                  background: bgs[idx],
                  border: '1px solid #E8DEC8',
                  boxShadow: '0 2px 8px rgba(61,46,30,0.06)',
                }}
              >
                <div className="text-3xl mb-2" aria-hidden="true">{feat.icon}</div>
                <p className="text-xs sm:text-sm font-extrabold text-[#3D2E1E] mb-1 leading-tight">{feat.label}</p>
                <p className="text-xs font-medium text-[#6B5744] leading-tight hidden sm:block">{feat.description}</p>
              </div>
            );
          })}
        </div>

        {/* CTA Buttons */}
        <div className="w-full flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={() => router.push('/login')}
            className="flex-1 min-h-[56px] py-4 px-8 text-white rounded-2xl font-extrabold text-lg transition-all hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#3D6B3D] flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #5C8B5C, #3D6B3D)',
              boxShadow: '0 6px 20px rgba(92,139,92,0.40)',
            }}
          >
            Get Started
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
          <button
            onClick={handleDemoMode}
            className="flex-1 min-h-[56px] py-4 px-8 bg-[#FFFCF3] text-[#5C8B5C] border-2 border-[#5C8B5C] rounded-2xl font-extrabold text-lg hover:bg-[#E8F5E8] transition-all hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-[#5C8B5C] flex items-center justify-center gap-2"
            style={{ boxShadow: '0 4px 16px rgba(92,139,92,0.12)' }}
          >
            <span aria-hidden="true">🎮</span>
            Try Demo
          </button>
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-2 text-xs text-[#6B5744] font-medium text-center">
          <span aria-hidden="true">💡</span>
          Demo mode: explore as Alice, age 8, Beginner level — no account needed.
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
