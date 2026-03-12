'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { parentLogin, parentRegister, childSelect } from '@/services/api';
import { isParentOrAdmin } from '@/lib/constants';
import { getItem, setItem } from '@/lib/clientStorage';

// ---------------------------------------------------------------------------
// Mock data — used when the API has no children registered yet
// ---------------------------------------------------------------------------
const MOCK_CHILDREN = [
  { id: 1, name: 'Alice', age: 8,  level: 'Beginner',     avatar: '👧' },
  { id: 2, name: 'Bob',   age: 11, level: 'Intermediate', avatar: '👦' },
];

const LEVEL_BADGE = {
  Beginner:     { bg: '#C8E6C9', text: '#1B5E20' },
  Intermediate: { bg: '#FFE0B2', text: '#BF360C' },
  Advanced:     { bg: '#E1BEE7', text: '#4A148C' },
};

// ---------------------------------------------------------------------------
// Shared input className — reused throughout all sub-views
// ---------------------------------------------------------------------------
const INPUT_CLASS =
  'w-full px-4 py-3 border border-[#D6C9A8] rounded-xl ' +
  'focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] focus:border-transparent ' +
  'bg-[#FFFCF3] text-[#3D2E1E] font-semibold placeholder:text-[#B8A898] ' +
  'transition-all duration-200';

// ---------------------------------------------------------------------------
// Inner component — must be wrapped in <Suspense> to use useSearchParams
// ---------------------------------------------------------------------------
function LoginPageInner() {
  const router   = useRouter();
  const params   = useSearchParams();

  // viewState drives which panel is visible
  const [viewState, setViewState] = useState(
    params.get('view') === 'register' ? 'register' : 'main'
  );

  // ── Shared form state ────────────────────────────────────────────────────
  const [error,       setError]       = useState('');
  const [isLoading,   setIsLoading]   = useState(false);

  // ── Student-login state ──────────────────────────────────────────────────
  const [studentSearch, setStudentSearch] = useState('');
  const [children,      setChildren]      = useState(MOCK_CHILDREN);

  // ── Parent-login state ───────────────────────────────────────────────────
  const [parentEmail,    setParentEmail]    = useState('');
  const [parentPassword, setParentPassword] = useState('');
  const [showPassword,   setShowPassword]   = useState(false);

  // ── Register state ───────────────────────────────────────────────────────
  const [regName,            setRegName]            = useState('');
  const [regEmail,           setRegEmail]           = useState('');
  const [regPassword,        setRegPassword]        = useState('');
  const [regConfirm,         setRegConfirm]         = useState('');
  const [showRegPassword,    setShowRegPassword]    = useState(false);
  const [showRegConfirm,     setShowRegConfirm]     = useState(false);
  const [successMessage,     setSuccessMessage]     = useState('');

  // Sync viewState with ?view= query param (e.g. router.push('/login?view=register'))
  useEffect(() => {
    const view = params.get('view');
    if (view === 'register' && viewState !== 'register') setViewState('register');
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ──────────────────────────────────────────────────────────────
  const resetAllForms = () => {
    setError('');
    setStudentSearch('');
    setParentEmail('');
    setParentPassword('');
    setShowPassword(false);
    setRegName('');
    setRegEmail('');
    setRegPassword('');
    setRegConfirm('');
    setShowRegPassword(false);
    setShowRegConfirm(false);
    setSuccessMessage('');
  };

  const goTo = (view) => {
    resetAllForms();
    setViewState(view);
    // Keep URL clean – remove the query param when navigating away from register
    if (view !== 'register') {
      router.replace('/login', { scroll: false });
    }
  };

  // ── Student login ─────────────────────────────────────────────────────────
  const filteredChildren = children.filter((c) =>
    c.name.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const handleSelectStudent = async (child) => {
    setIsLoading(true);
    setError('');
    try {
      setItem('studentId', String(child.id));
      setItem('studentName', child.name);
      setItem('studentLevel', child.level);
      setItem('studentAge', String(child.age));
      setItem('userRole', 'student');
      // Ensure a token exists so protected pages don't redirect back to /login
      if (!getItem('token')) {
        setItem('token', 'student-session-' + child.id);
      }

      try { await childSelect(child.id); } catch (_) { /* non-critical */ }

      router.push('/books');
    } catch (err) {
      setError('Could not start session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Parent login ──────────────────────────────────────────────────────────
  const handleParentLogin = async (e) => {
    e.preventDefault();
    if (!parentEmail || !parentPassword) {
      setError('Please fill in all fields.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const result = await parentLogin(parentEmail, parentPassword);
      if (!result || !result.token) throw new Error('Invalid server response.');

      setItem('token', result.token);
      setItem('parentId', result.parent?.id || '');
      setItem('parentEmail', result.parent?.email || parentEmail);
      setItem('userRole', 'parent');

      if (result.children && result.children.length > 0) {
        setItem('children', JSON.stringify(result.children));
      }

      router.push('/dashboard');
    } catch (err) {
      setError('Incorrect email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Register ──────────────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword || !regConfirm) {
      setError('Please fill in all fields.');
      return;
    }
    if (regPassword !== regConfirm) {
      setError('Passwords do not match.');
      return;
    }
    if (regPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const result = await parentRegister(regEmail, regPassword, regName);
      if (!result || !result.token) throw new Error('Registration failed.');

      setItem('token', result.token);
      setItem('parentId', result.parent?.id || '');
      setItem('parentEmail', result.parent?.email || regEmail);
      setItem('userRole', 'parent');

      router.push(`/consent?email=${encodeURIComponent(regEmail)}`);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Shared back button ─────────────────────────────────────────────────────
  const BackButton = () => (
    <button
      type="button"
      onClick={() => goTo('main')}
      className="mt-4 w-full min-h-[48px] py-3 rounded-2xl bg-[#EDE5D4] text-[#6B5744] font-bold
                 hover:bg-[#D6C9A8] transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2
                 focus-visible:ring-2 focus-visible:ring-[#6B5744]"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      Back
    </button>
  );

  // ── Password toggle helper ─────────────────────────────────────────────────
  const EyeIcon = ({ visible }) => (
    <span className="text-[#6B5744] text-sm select-none pointer-events-none">
      {visible ? '🙈' : '👁️'}
    </span>
  );

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col items-center py-6 px-4">

      {/* ── Gradient Banner (always visible) ──────────────────────────── */}
      <div className="hialice-hero w-full max-w-xl text-center px-6 py-10 rounded-3xl mb-6 relative overflow-hidden">
        {/* Decorative background circles */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #87CEDB 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
          aria-hidden="true"
        />
        <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #5C8B5C 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }}
          aria-hidden="true"
        />
        <div
          className="text-6xl mb-3 inline-block relative z-10"
          style={{ animation: 'float 3s ease-in-out infinite' }}
          aria-hidden="true"
        >
          🌿
        </div>
        <h1 className="text-4xl font-extrabold text-[#3D6B3D] mb-1.5 drop-shadow-sm relative z-10 tracking-tight">
          HiMax
        </h1>
        <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#5C8B5C] relative z-10">
          Welcome Back
        </p>
        <p className="mt-2 text-xl font-extrabold text-[#3D2E1E] relative z-10">
          Let us find your next reading talk.
        </p>
        <p className="text-sm font-semibold text-[#6B5744] mt-2 relative z-10 opacity-90">
          Choose your profile to continue your reading adventure with Alice.
        </p>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

      {/* ================================================================
          MAIN VIEW — three large option cards
         ================================================================ */}
      {viewState === 'main' && (
        <div className="w-full max-w-xl animate-fade-in">

          {/* Feature strip */}
          <div className="grid grid-cols-3 gap-3 text-center mb-5">
            {[
              { icon: '🎤', label: 'Voice Learning', color: '#E8F0FC'  },
              { icon: '📚', label: 'Curated Books', color: '#E8F5E8'  },
              { icon: '🌟', label: 'Smart Feedback', color: '#FFF8E0'  },
            ].map((f) => (
              <div
                key={f.label}
                className="hialice-feature-tile py-4 px-2"
                style={{
                  background: f.color,
                }}
              >
                <div className="text-2xl mb-1.5" aria-hidden="true">{f.icon}</div>
                <p className="text-xs font-extrabold text-[#6B5744]">{f.label}</p>
              </div>
            ))}
          </div>

          {/* Option cards */}
          <p className="text-center text-sm text-[#6B5744] font-semibold mb-3">
            Choose who is using HiMax today.
          </p>

          <div className="flex flex-col gap-3">

            {/* Card 1 — Student */}
            <button
              onClick={() => goTo('student')}
              className="hialice-option-card group is-interactive p-5 flex items-center gap-4 text-left
                         min-h-[68px] hover:border-[#5C8B5C] hover:shadow-[0_6px_24px_rgba(92,139,92,0.18)]
                         hover:-translate-y-0.5 transition-all duration-200 cursor-pointer
                         focus-visible:ring-2 focus-visible:ring-[#5C8B5C]"
              style={{ ['--accent-color']: '#5C8B5C' }}
            >
              <div
                className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl
                           transition-transform group-hover:scale-110 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #C8E6C9, #A5D6A7)' }}
                aria-hidden="true"
              >
                🧒
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-extrabold text-[#3D2E1E] leading-tight">
                  I&apos;m a Student
                </h2>
                <p className="text-xs font-semibold text-[#6B5744] mt-0.5">Start with a book you already read</p>
              </div>
              <svg
                className="flex-shrink-0 text-[#5C8B5C] opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>

            {/* Card 2 — Parent */}
            <button
              onClick={() => goTo('parent')}
              className="hialice-option-card group is-interactive p-5 flex items-center gap-4 text-left
                         min-h-[68px] hover:border-[#D4A843] hover:shadow-[0_6px_24px_rgba(212,168,67,0.18)]
                         hover:-translate-y-0.5 transition-all duration-200 cursor-pointer
                         focus-visible:ring-2 focus-visible:ring-[#D4A843]"
              style={{ ['--accent-color']: '#D4A843' }}
            >
              <div
                className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl
                           transition-transform group-hover:scale-110 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #FFF3CD, #FFE082)' }}
                aria-hidden="true"
              >
                👪
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-extrabold text-[#3D2E1E] leading-tight">
                  Parent Login
                </h2>
                <p className="text-xs font-semibold text-[#6B5744] mt-0.5">Sign in to manage your child&apos;s account</p>
              </div>
              <svg
                className="flex-shrink-0 text-[#D4A843] opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>

            {/* Card 3 — Register */}
            <button
              onClick={() => goTo('register')}
              className="hialice-option-card group is-interactive p-5 flex items-center gap-4 text-left
                         min-h-[68px] hover:border-[#87CEDB] hover:shadow-[0_6px_24px_rgba(135,206,219,0.20)]
                         hover:-translate-y-0.5 transition-all duration-200 cursor-pointer
                         focus-visible:ring-2 focus-visible:ring-[#87CEDB]"
              style={{ ['--accent-color']: '#87CEDB' }}
            >
              <div
                className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl
                           transition-transform group-hover:scale-110 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #B3E5FC, #81D4FA)' }}
                aria-hidden="true"
              >
                ✨
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-extrabold text-[#3D2E1E] leading-tight">
                  Create New Account
                </h2>
                <p className="text-xs font-semibold text-[#6B5744] mt-0.5">Set up a new learning journey for your family</p>
              </div>
              <svg
                className="flex-shrink-0 text-[#87CEDB] opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>

          </div>
        </div>
      )}

      {/* ================================================================
          STUDENT VIEW
         ================================================================ */}
      {viewState === 'student' && (
        <div className="w-full max-w-md animate-fade-in">
          <div className="hialice-option-card p-7" style={{ ['--accent-color']: '#5C8B5C' }}>

            {/* Panel header */}
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🧒</div>
              <h2 className="text-2xl font-extrabold text-[#3D2E1E]">Who are you?</h2>
              <p className="text-sm font-semibold text-[#6B5744] mt-1">
                Pick your name and we will help you find the book you read.
              </p>
            </div>

            {/* Search / name filter */}
            <div className="mb-4 relative">
              <label htmlFor="student-search" className="sr-only">Search by name</label>
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B5744] text-sm pointer-events-none">
                🔍
              </span>
              <input
                id="student-search"
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className={INPUT_CLASS + ' pl-9'}
                placeholder="Type your name..."
                autoComplete="off"
              />
            </div>

            {/* Children list */}
            <div className="space-y-3 mb-4">
              {filteredChildren.length === 0 ? (
                <p className="text-center py-6 text-[#6B5744] font-semibold text-sm">
                  No profiles found. Ask a parent to add you!
                </p>
              ) : (
                filteredChildren.map((child) => {
                  const badge = LEVEL_BADGE[child.level] || { bg: '#E8DEC8', text: '#6B5744' };
                  return (
                    <button
                      key={child.id}
                      onClick={() => handleSelectStudent(child)}
                      disabled={isLoading}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border-2
                                 border-[#E8DEC8] bg-[#FFFCF3]
                                 hover:border-[#5C8B5C] hover:bg-[#E8F5E8]
                                 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(92,139,92,0.15)]
                                 transition-all duration-200 text-left
                                 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <span className="text-4xl flex-shrink-0">{child.avatar}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-[#3D2E1E] text-base truncate">
                          {child.name}
                        </p>
                        <p className="text-xs font-semibold text-[#6B5744]">
                          Age {child.age}
                        </p>
                      </div>
                      {isParentOrAdmin() && (
                        <span
                          className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold"
                          style={{ backgroundColor: badge.bg, color: badge.text }}
                        >
                          {child.level}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Loading indicator */}
            {isLoading && (
              <p className="text-center text-sm font-semibold text-[#5C8B5C] mb-3 shimmer">
                Starting session...
              </p>
            )}

            {error && (
              <div role="alert" className="text-[#D4736B] text-sm font-semibold text-center mb-3 px-4 py-3 rounded-xl bg-[#FEF2F1] border border-[#F5C6C2]">
                {error}
              </div>
            )}

            <BackButton />
          </div>
        </div>
      )}

      {/* ================================================================
          PARENT VIEW
         ================================================================ */}
      {viewState === 'parent' && (
        <div className="w-full max-w-md animate-fade-in">
          <div className="hialice-option-card p-7" style={{ ['--accent-color']: '#D4A843' }}>

            <div className="text-center mb-6">
              <div className="text-4xl mb-2">👪</div>
              <h2 className="text-2xl font-extrabold text-[#3D2E1E]">Parent Login</h2>
              <p className="text-sm font-semibold text-[#6B5744] mt-1">
                Sign in to manage your child&apos;s progress
              </p>
            </div>

            <form onSubmit={handleParentLogin} noValidate className="space-y-4">

              {/* Email */}
              <div>
                <label
                  htmlFor="parent-email"
                  className="block text-sm font-bold text-[#6B5744] mb-1.5"
                >
                  Email
                </label>
                <input
                  id="parent-email"
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="parent@example.com"
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="parent-password"
                  className="block text-sm font-bold text-[#6B5744] mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="parent-password"
                    type={showPassword ? 'text' : 'password'}
                    value={parentPassword}
                    onChange={(e) => setParentPassword(e.target.value)}
                    className={INPUT_CLASS + ' pr-12'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded focus-visible:ring-2 focus-visible:ring-[#5C8B5C]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon visible={showPassword} />
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="text-[#D4736B] text-sm font-semibold px-4 py-3 rounded-xl bg-[#FEF2F1] border border-[#F5C6C2]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[52px] py-3 rounded-2xl bg-[#D4A843] text-white font-extrabold text-base
                           hover:bg-[#A8822E] hover:-translate-y-0.5
                           shadow-[0_4px_12px_rgba(212,168,67,0.35)]
                           transition-all disabled:opacity-60 disabled:cursor-not-allowed
                           focus-visible:ring-2 focus-visible:ring-[#D4A843] focus-visible:ring-offset-2
                           flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
                    Signing in...
                  </>
                ) : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-sm text-[#6B5744] font-semibold mt-5">
              No account yet?{' '}
              <button
                type="button"
                onClick={() => goTo('register')}
                className="text-[#5C8B5C] font-bold hover:underline focus-visible:underline"
              >
                Create one
              </button>
            </p>

            <BackButton />
          </div>
        </div>
      )}

      {/* ================================================================
          REGISTER VIEW
         ================================================================ */}
      {viewState === 'register' && (
        <div className="w-full max-w-md animate-fade-in">
          <div className="ghibli-card p-7">

            <div className="text-center mb-6">
              <div className="text-4xl mb-2">✨</div>
              <h2 className="text-2xl font-extrabold text-[#3D2E1E]">Create Account</h2>
              <p className="text-sm font-semibold text-[#6B5744] mt-1">
                Parent registration — free to join
              </p>
            </div>

            <form onSubmit={handleRegister} noValidate className="space-y-4">

              {/* Display name */}
              <div>
                <label
                  htmlFor="reg-name"
                  className="block text-sm font-bold text-[#6B5744] mb-1.5"
                >
                  Your Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Jane Smith"
                  autoComplete="name"
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="reg-email"
                  className="block text-sm font-bold text-[#6B5744] mb-1.5"
                >
                  Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="parent@example.com"
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="reg-password"
                  className="block text-sm font-bold text-[#6B5744] mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="reg-password"
                    type={showRegPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className={INPUT_CLASS + ' pr-12'}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded focus-visible:ring-2 focus-visible:ring-[#5C8B5C]"
                    aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon visible={showRegPassword} />
                  </button>
                </div>

                {/* Password strength hint */}
                {regPassword.length > 0 && (
                  <div className="mt-1.5 flex gap-1" aria-hidden="true">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 h-1 rounded-full transition-all duration-300"
                        style={{
                          background:
                            regPassword.length >= (i + 1) * 2
                              ? i < 1 ? '#D4736B'
                              : i < 2 ? '#D4A843'
                              : i < 3 ? '#7AC87A'
                              : '#5C8B5C'
                              : '#E8DEC8',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label
                  htmlFor="reg-confirm"
                  className="block text-sm font-bold text-[#6B5744] mb-1.5"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="reg-confirm"
                    type={showRegConfirm ? 'text' : 'password'}
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    className={
                      INPUT_CLASS +
                      ' pr-12 ' +
                      (regConfirm.length > 0 && regConfirm !== regPassword
                        ? 'border-[#D4736B] focus:ring-[#D4736B]'
                        : '')
                    }
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded focus-visible:ring-2 focus-visible:ring-[#5C8B5C]"
                    aria-label={showRegConfirm ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon visible={showRegConfirm} />
                  </button>
                </div>
                {regConfirm.length > 0 && regConfirm !== regPassword && (
                  <p className="text-xs text-[#D4736B] font-semibold mt-1">
                    Passwords do not match
                  </p>
                )}
              </div>

              {error && (
                <div role="alert" className="text-[#D4736B] text-sm font-semibold px-4 py-3 rounded-xl bg-[#FEF2F1] border border-[#F5C6C2]">
                  {error}
                </div>
              )}

              {successMessage && (
                <div role="status" className="text-[#3D6B3D] text-sm font-semibold px-4 py-3 rounded-xl bg-[#E8F5E8] border border-[#A5D6A7]">
                  {successMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[52px] py-3 rounded-2xl font-extrabold text-base text-white
                           hover:-translate-y-0.5 transition-all
                           shadow-[0_4px_12px_rgba(135,206,219,0.4)]
                           disabled:opacity-60 disabled:cursor-not-allowed
                           focus-visible:ring-2 focus-visible:ring-[#87CEDB] focus-visible:ring-offset-2
                           flex items-center justify-center gap-2"
                style={{
                  background: isLoading
                    ? '#A8DAEA'
                    : 'linear-gradient(135deg, #87CEDB, #5BB8CC)',
                }}
              >
                {isLoading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
                    Creating account...
                  </>
                ) : 'Create Account'}
              </button>
            </form>

            {/* COPPA notice */}
            <p className="mt-4 text-center text-xs text-[#6B5744] font-medium leading-relaxed">
              By creating an account you agree to our{' '}
              <a
                href="/privacy-policy"
                className="text-[#5C8B5C] font-bold hover:underline focus-visible:underline"
              >
                Privacy Policy
              </a>
              . COPPA parental consent will be collected on the next step.
            </p>

            <p className="text-center text-sm text-[#6B5744] font-semibold mt-4">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => goTo('parent')}
                className="text-[#5C8B5C] font-bold hover:underline focus-visible:underline"
              >
                Sign in
              </button>
            </p>

            <BackButton />
          </div>
        </div>
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export — wraps inner component in Suspense (required for useSearchParams)
// ---------------------------------------------------------------------------
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center gap-4">
          <div className="text-6xl float-animation">🌿</div>
          <p className="text-[#6B5744] font-semibold text-lg shimmer">Loading...</p>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
