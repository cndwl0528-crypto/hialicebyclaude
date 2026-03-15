'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { parentLogin, parentRegister, childSelect, addChild, verifyStudentPin, getChildrenList } from '@/services/api';
import { isParentOrAdmin, API_BASE } from '@/lib/constants';
import { getItem, setItem } from '@/lib/clientStorage';

// ---------------------------------------------------------------------------
// Mock data — used ONLY when NEXT_PUBLIC_USE_MOCK=true
// ---------------------------------------------------------------------------
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

const MOCK_CHILDREN = [
  { id: 1, name: 'Alice', age: 8,  level: 'Beginner',     avatar: '👧' },
  { id: 2, name: 'Bob',   age: 11, level: 'Intermediate', avatar: '👦' },
];

/**
 * Normalize a child record from the API (snake_case) or addChild response
 * (camelCase) into the shape the UI expects: { id, name, age, level, avatar }.
 */
const normalizeChild = (c) => ({
  id: c.id,
  name: c.name,
  age: c.age,
  level: c.level
    ? c.level.charAt(0).toUpperCase() + c.level.slice(1).toLowerCase()
    : 'Beginner',
  avatar: c.avatar || c.avatar_emoji || c.avatarEmoji || '🧒',
});

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
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [children,      setChildren]      = useState(() => {
    // Use mock data only when explicitly enabled
    if (USE_MOCK) return MOCK_CHILDREN;
    // Try to restore children from a previous parent login session
    if (typeof window !== 'undefined') {
      try {
        const stored = getItem('children');
        if (stored) return JSON.parse(stored).map(normalizeChild);
      } catch (_) { /* ignore parse errors */ }
    }
    return [];
  });

  // Fetch children list from API when entering student login view
  useEffect(() => {
    if (viewState !== 'student' || USE_MOCK) return;
    setChildrenLoading(true);
    getChildrenList()
      .then((result) => {
        if (result?.children?.length > 0) {
          const normalized = result.children.map(normalizeChild);
          setChildren(normalized);
          setItem('children', JSON.stringify(normalized));
        }
      })
      .catch(() => { /* keep existing children list */ })
      .finally(() => setChildrenLoading(false));
  }, [viewState]);

  // ── PIN authentication state ─────────────────────────────────────────────
  // selectedChild holds the child that was tapped; once PIN is verified it
  // gets passed to the actual handleSelectStudent logic.
  const [selectedChild, setSelectedChild] = useState(null);
  const [pinDigits,     setPinDigits]     = useState(['', '', '', '']);
  const [pinError,      setPinError]      = useState('');
  const pinRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

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

  // ── Forgot-password state ──────────────────────────────────────────────
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail,        setForgotEmail]        = useState('');
  const [forgotStatus,       setForgotStatus]       = useState(''); // 'sending', 'sent', 'error'

  // ── Add-child state ────────────────────────────────────────────────────
  const AVATAR_OPTIONS = ['👧', '👦', '🧒', '👶', '🐱', '🐶', '🦊', '🐼'];
  const [childName,   setChildName]   = useState('');
  const [childAge,    setChildAge]    = useState('');
  const [childAvatar, setChildAvatar] = useState('👧');
  const [childPin,    setChildPin]    = useState('');

  // Sync viewState with ?view= query param (e.g. router.push('/login?view=register'))
  useEffect(() => {
    const view = params.get('view');
    if (view === 'register' && viewState !== 'register') setViewState('register');
    if (view === 'addChild' && viewState !== 'addChild') setViewState('addChild');
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
    setChildName('');
    setChildAge('');
    setChildAvatar('👧');
    setChildPin('');
    // Reset PIN state
    setSelectedChild(null);
    setPinDigits(['', '', '', '']);
    setPinError('');
  };

  const goTo = (view) => {
    resetAllForms();
    setViewState(view);
    // Keep URL clean – remove the query param when navigating away from special views
    if (view === 'register') {
      router.replace('/login?view=register', { scroll: false });
    } else if (view === 'addChild') {
      router.replace('/login?view=addChild', { scroll: false });
    } else {
      router.replace('/login', { scroll: false });
    }
  };

  // ── Student login ─────────────────────────────────────────────────────────
  const filteredChildren = children.filter((c) =>
    c.name.toLowerCase().includes(studentSearch.toLowerCase())
  );

  // Step 1 — child taps their name card: show PIN entry instead of logging in
  const handleSelectStudent = (child) => {
    setSelectedChild(child);
    setPinDigits(['', '', '', '']);
    setPinError('');
    // Focus the first digit box on the next render tick
    setTimeout(() => { pinRefs[0].current?.focus(); }, 50);
  };

  // Step 2 — PIN digit input handler: auto-advance, auto-submit on last digit
  const handlePinDigitChange = (index, value) => {
    // Accept only a single numeric character
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...pinDigits];
    next[index] = digit;
    setPinDigits(next);
    setPinError('');

    if (digit && index < 3) {
      // Advance focus to the next box
      pinRefs[index + 1].current?.focus();
    }
    if (index === 3 && digit) {
      // All four digits entered — trigger validation
      handlePinSubmit(next);
    }
  };

  // Backspace support: move focus back when a box is cleared
  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinRefs[index - 1].current?.focus();
    }
  };

  // Step 3 — validate PIN via API and proceed to session setup
  const handlePinSubmit = async (digits = pinDigits) => {
    const pin = digits.join('');
    if (pin.length < 4) {
      setPinError('Please enter all 4 digits.');
      return;
    }

    try {
      const result = await verifyStudentPin(selectedChild.id, pin);
      if (result?.token) {
        // PIN accepted — store token and proceed
        setItem('token', result.token);
        await completeStudentLogin(selectedChild);
      } else {
        setPinError('Wrong PIN. Try again!');
        setPinDigits(['', '', '', '']);
        setTimeout(() => { pinRefs[0].current?.focus(); }, 50);
      }
    } catch (err) {
      setPinError(err.message?.includes('Incorrect') ? 'Wrong PIN. Try again!' : 'Could not verify PIN. Please try again.');
      setPinDigits(['', '', '', '']);
      setTimeout(() => { pinRefs[0].current?.focus(); }, 50);
    }
  };

  // Step 4 — the original login logic, now called after PIN is verified
  const completeStudentLogin = async (child) => {
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

  // "Not you? Go back" — return to the children list without fully resetting
  const handleCancelPin = () => {
    setSelectedChild(null);
    setPinDigits(['', '', '', '']);
    setPinError('');
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

      // Primary auth is now via httpOnly cookie (set automatically by the
      // server response). We still persist the token in client storage as a
      // backward-compatible fallback for API clients that cannot send cookies.
      setItem('token', result.token);
      setItem('parentId', result.parent?.id || '');
      setItem('parentEmail', result.parent?.email || parentEmail);
      setItem('userRole', 'parent');

      if (result.children && result.children.length > 0) {
        const normalized = result.children.map(normalizeChild);
        setChildren(normalized);
        setItem('children', JSON.stringify(normalized));
        router.push('/dashboard');
      } else {
        // No children registered yet — guide parent to add a child
        setChildren([]);
        setItem('children', JSON.stringify([]));
        goTo('addChild');
      }
    } catch (err) {
      setError('Incorrect email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Forgot password ──────────────────────────────────────────────────────
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotStatus('sending');
    try {
      await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotStatus('sent');
    } catch (err) {
      setForgotStatus('error');
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

      // Primary auth is now via httpOnly cookie (set automatically by the
      // server response). We still persist the token in client storage as a
      // backward-compatible fallback for API clients that cannot send cookies.
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

  // ── Add Child ────────────────────────────────────────────────────────────
  const handleAddChild = async (e) => {
    e.preventDefault();
    if (!childName.trim() || !childAge) {
      setError('Please enter your child\'s name and age.');
      return;
    }
    if (!childPin || !/^\d{4}$/.test(childPin)) {
      setError('Please set a 4-digit PIN for your child.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const result = await addChild(childName.trim(), Number(childAge), childAvatar, childPin);
      const raw = result?.student || result?.child || {
        id: Date.now(),
        name: childName.trim(),
        age: Number(childAge),
        level: Number(childAge) <= 8 ? 'Beginner' : Number(childAge) <= 11 ? 'Intermediate' : 'Advanced',
        avatar: childAvatar,
      };
      const newChild = normalizeChild(raw);

      // Update local children list
      setChildren((prev) => [...prev, newChild]);

      // Also persist to storage
      const stored = getItem('children');
      const existing = stored ? JSON.parse(stored) : [];
      existing.push(newChild);
      setItem('children', JSON.stringify(existing));

      setSuccessMessage(`${newChild.name} has been added!`);
      setChildName('');
      setChildAge('');
      setChildAvatar('👧');
      setChildPin('');
    } catch (err) {
      setError(err.message || 'Failed to add child. Please try again.');
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

            {/* ── PIN entry — shown after a child taps their name ────────── */}
            {selectedChild ? (
              <div className="animate-fade-in">

                {/* Child identity badge */}
                <div className="text-center mb-7">
                  <div
                    className="inline-flex items-center justify-center w-20 h-20 rounded-3xl text-5xl mb-3 shadow-md"
                    style={{ background: 'linear-gradient(135deg, #C8E6C9, #A5D6A7)' }}
                    aria-hidden="true"
                  >
                    {selectedChild.avatar}
                  </div>
                  <h2 className="text-2xl font-extrabold text-[#3D2E1E]">
                    Hi, {selectedChild.name}!
                  </h2>
                  <p className="text-sm font-semibold text-[#6B5744] mt-1">
                    Enter your 4-digit PIN to continue
                  </p>
                </div>

                {/* 4 digit boxes */}
                <div className="flex justify-center gap-3 mb-5" role="group" aria-label="4-digit PIN entry">
                  {pinDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={pinRefs[i]}
                      id={`pin-digit-${i}`}
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handlePinKeyDown(i, e)}
                      aria-label={`PIN digit ${i + 1}`}
                      className={
                        'w-16 h-16 text-center text-3xl font-extrabold rounded-2xl border-2 ' +
                        'focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] focus:border-transparent ' +
                        'transition-all duration-200 bg-[#FFFCF3] text-[#3D2E1E] ' +
                        (pinError
                          ? 'border-[#D4736B] bg-[#FEF2F1]'
                          : digit
                          ? 'border-[#5C8B5C] bg-[#E8F5E8]'
                          : 'border-[#D6C9A8]')
                      }
                      disabled={isLoading}
                    />
                  ))}
                </div>

                {/* PIN error message */}
                {pinError && (
                  <div
                    role="alert"
                    className="text-[#D4736B] text-sm font-semibold text-center mb-4 px-4 py-3 rounded-xl bg-[#FEF2F1] border border-[#F5C6C2]"
                  >
                    {pinError}
                  </div>
                )}

                {/* Loading state */}
                {isLoading && (
                  <p className="text-center text-sm font-semibold text-[#5C8B5C] mb-4 shimmer">
                    Starting session...
                  </p>
                )}

                {/* Submit PIN button */}
                <button
                  type="button"
                  onClick={() => handlePinSubmit()}
                  disabled={isLoading || pinDigits.some((d) => !d)}
                  className="w-full min-h-[52px] py-3 rounded-2xl bg-[#3D6B3D] text-white font-extrabold text-base
                             hover:bg-[#2E5230] hover:-translate-y-0.5
                             shadow-[0_4px_12px_rgba(61,107,61,0.35)]
                             transition-all disabled:opacity-50 disabled:cursor-not-allowed
                             focus-visible:ring-2 focus-visible:ring-[#3D6B3D] focus-visible:ring-offset-2
                             flex items-center justify-center gap-2 mb-3"
                >
                  {isLoading ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      Let me in!
                    </>
                  )}
                </button>

                {/* Forgot PIN helper */}
                <p className="text-center text-xs text-[#6B5744] font-semibold mb-4">
                  Forgot your PIN?{' '}
                  <span className="text-[#A8822E] font-bold">Ask a parent</span>{' '}
                  to help you.
                </p>

                {/* "Not you?" — return to name list */}
                <button
                  type="button"
                  onClick={handleCancelPin}
                  disabled={isLoading}
                  className="w-full min-h-[48px] py-3 rounded-2xl bg-[#EDE5D4] text-[#6B5744] font-bold
                             hover:bg-[#D6C9A8] transition-all hover:-translate-y-0.5
                             flex items-center justify-center gap-2
                             focus-visible:ring-2 focus-visible:ring-[#6B5744]
                             disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  Not you? Go back
                </button>

              </div>
            ) : (
              <>
                {/* ── Children list — shown when no child is selected ─────── */}

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

                {/* Children list — only shown when searching */}
                <div className="space-y-3 mb-4">
                  {!studentSearch.trim() ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-3">👆</div>
                      <p className="text-[#6B5744] font-semibold text-sm">
                        Type your name above to find your profile!
                      </p>
                    </div>
                  ) : childrenLoading ? (
                    <div className="text-center py-6">
                      <div className="text-2xl animate-spin inline-block mb-2">⏳</div>
                      <p className="text-[#6B5744] font-semibold text-sm">Searching...</p>
                    </div>
                  ) : filteredChildren.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-[#6B5744] font-semibold text-sm mb-3">
                        No profiles found for &ldquo;{studentSearch}&rdquo;
                      </p>
                      <p className="text-xs text-[#8B7D6B]">
                        Ask a parent to add your profile first.
                      </p>
                    </div>
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

                  {/* Add Child card — visible to parents */}
                  {isParentOrAdmin() && (
                    <button
                      onClick={() => goTo('addChild')}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed
                                 border-[#D6C9A8] bg-[#FFFCF3]
                                 hover:border-[#5C8B5C] hover:bg-[#E8F5E8]
                                 hover:-translate-y-0.5 transition-all duration-200 text-left"
                    >
                      <span className="text-3xl flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-[#E8F5E8]">➕</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-[#5C8B5C] text-base">Add a Child</p>
                        <p className="text-xs font-semibold text-[#6B5744]">Register a new child profile</p>
                      </div>
                    </button>
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
              </>
            )}

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
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs text-[#5C8B5C] hover:text-[#3D6B3D] underline mt-1 font-semibold"
                >
                  Forgot Password?
                </button>
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

      {/* ================================================================
          FORGOT PASSWORD MODAL
         ================================================================ */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-[#F5F0E8] rounded-2xl p-6 max-w-sm w-full shadow-xl border-2 border-[#D6C9A8]">
            <h3 className="text-lg font-bold text-[#3D2E1E] mb-3">Reset Password</h3>
            {forgotStatus === 'sent' ? (
              <div>
                <p className="text-sm text-[#3D6B3D] mb-4">
                  If an account exists with that email, a password reset link has been sent. Check your inbox.
                </p>
                <button
                  onClick={() => { setShowForgotPassword(false); setForgotStatus(''); setForgotEmail(''); }}
                  className="w-full py-2 rounded-xl bg-[#5C8B5C] text-white font-bold hover:bg-[#3D6B3D] transition"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <p className="text-sm text-[#6B5744] mb-3">
                  Enter your email address and we&apos;ll send you a link to reset your password.
                </p>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full px-4 py-3 rounded-xl border-2 border-[#D6C9A8] bg-white text-[#3D2E1E] mb-3 focus:border-[#5C8B5C] focus:outline-none"
                  required
                />
                {forgotStatus === 'error' && (
                  <p className="text-xs text-red-600 mb-2">Something went wrong. Please try again.</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(false); setForgotStatus(''); setForgotEmail(''); }}
                    className="flex-1 py-2 rounded-xl bg-[#EDE5D4] text-[#6B5744] font-bold hover:bg-[#D6C9A8] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotStatus === 'sending'}
                    className="flex-1 py-2 rounded-xl bg-[#5C8B5C] text-white font-bold hover:bg-[#3D6B3D] transition disabled:opacity-50"
                  >
                    {forgotStatus === 'sending' ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ================================================================
          ADD CHILD VIEW
         ================================================================ */}
      {viewState === 'addChild' && (
        <div className="w-full max-w-md animate-fade-in">
          <div className="hialice-option-card p-7" style={{ ['--accent-color']: '#5C8B5C' }}>

            <div className="text-center mb-6">
              <div className="text-4xl mb-2">👶</div>
              <h2 className="text-2xl font-extrabold text-[#3D2E1E]">Add Your Child</h2>
              <p className="text-sm font-semibold text-[#6B5744] mt-1">
                Create a profile for your child to start learning
              </p>
            </div>

            <form onSubmit={handleAddChild} noValidate className="space-y-4">

              {/* Child name */}
              <div>
                <label htmlFor="child-name" className="block text-sm font-bold text-[#6B5744] mb-1.5">
                  Child&apos;s Name
                </label>
                <input
                  id="child-name"
                  type="text"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="e.g. Emma"
                  autoComplete="off"
                />
              </div>

              {/* Age dropdown */}
              <div>
                <label htmlFor="child-age" className="block text-sm font-bold text-[#6B5744] mb-1.5">
                  Age
                </label>
                <select
                  id="child-age"
                  value={childAge}
                  onChange={(e) => setChildAge(e.target.value)}
                  className={INPUT_CLASS + ' appearance-none cursor-pointer'}
                >
                  <option value="">Select age...</option>
                  {[6, 7, 8, 9, 10, 11, 12, 13].map((age) => (
                    <option key={age} value={age}>{age} years old</option>
                  ))}
                </select>
              </div>

              {/* Avatar selection */}
              <div>
                <label className="block text-sm font-bold text-[#6B5744] mb-2">
                  Choose an Avatar
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {AVATAR_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setChildAvatar(emoji)}
                      className={`text-3xl p-3 rounded-2xl border-2 transition-all duration-200
                        ${childAvatar === emoji
                          ? 'border-[#5C8B5C] bg-[#E8F5E8] scale-110 shadow-md'
                          : 'border-[#E8DEC8] bg-[#FFFCF3] hover:border-[#D6C9A8]'
                        }`}
                      aria-label={`Select avatar ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4-digit PIN */}
              <div>
                <label htmlFor="child-pin" className="block text-sm font-bold text-[#6B5744] mb-1.5">
                  Set a 4-Digit PIN
                </label>
                <p className="text-xs text-[#8B7D6B] mb-2">
                  Your child will use this PIN to log in independently.
                </p>
                <input
                  id="child-pin"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={childPin}
                  onChange={(e) => setChildPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className={INPUT_CLASS + ' text-center text-2xl tracking-[0.5em] font-mono'}
                  placeholder="0000"
                  autoComplete="off"
                />
              </div>

              {/* Level hint (read-only) */}
              {childAge && (
                <div className="text-xs font-semibold text-[#6B5744] bg-[#F5F0E8] px-4 py-2 rounded-xl">
                  Level will be automatically assigned based on age.
                </div>
              )}

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
                disabled={isLoading || !childName.trim() || !childAge}
                className="w-full min-h-[52px] py-3 rounded-2xl bg-[#5C8B5C] text-white font-extrabold text-base
                           hover:bg-[#4A7A4A] hover:-translate-y-0.5
                           shadow-[0_4px_12px_rgba(92,139,92,0.35)]
                           transition-all disabled:opacity-60 disabled:cursor-not-allowed
                           focus-visible:ring-2 focus-visible:ring-[#5C8B5C] focus-visible:ring-offset-2
                           flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
                    Adding child...
                  </>
                ) : 'Add Child'}
              </button>
            </form>

            {/* After adding at least one child, show option to go to student select */}
            {children.length > 0 && (
              <button
                type="button"
                onClick={() => goTo('student')}
                className="mt-3 w-full min-h-[48px] py-3 rounded-2xl bg-[#D4A843] text-white font-extrabold text-base
                           hover:bg-[#A8822E] hover:-translate-y-0.5
                           shadow-[0_4px_12px_rgba(212,168,67,0.35)]
                           transition-all flex items-center justify-center gap-2"
              >
                Done — Choose a Student
              </button>
            )}

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
