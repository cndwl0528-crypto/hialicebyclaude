'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStudentSessions, getVocabStats } from '@/services/api';
import { isParentOrAdmin, LEVELS } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Mock fallback data
// ---------------------------------------------------------------------------

const MOCK_SESSIONS = [
  { id: 1, bookTitle: 'The Very Hungry Caterpillar', date: '2026-03-10', wordsLearned: 18, grammarScore: 78 },
  { id: 2, bookTitle: 'Where the Wild Things Are', date: '2026-03-09', wordsLearned: 22, grammarScore: 82 },
  { id: 3, bookTitle: 'Winnie-the-Pooh', date: '2026-03-08', wordsLearned: 20, grammarScore: 75 },
];

const MOCK_RECENT_WORDS = [
  { word: 'caterpillar', definition: 'A small creature that becomes a butterfly' },
  { word: 'metamorphosis', definition: 'A complete change or transformation' },
  { word: 'cocoon', definition: 'A covering made by a caterpillar' },
  { word: 'beautiful', definition: 'Pleasing to look at' },
  { word: 'hungry', definition: 'Wanting food' },
];

const MOCK_WORKSHEETS = [
  { id: 1, bookTitle: 'The Very Hungry Caterpillar', imageUrl: null, createdAt: '2026-03-10', score: 85 },
  { id: 2, bookTitle: 'Where the Wild Things Are', imageUrl: null, createdAt: '2026-03-09', score: 88 },
  { id: 3, bookTitle: 'Winnie-the-Pooh', imageUrl: null, createdAt: '2026-03-08', score: 80 },
];

// Gradient palettes for worksheet placeholder cards (cycling)
const WORKSHEET_GRADIENTS = [
  'from-[#87CEDB] to-[#5C8B5C]',
  'from-[#D4A843] to-[#D4736B]',
  'from-[#7AC87A] to-[#87CEDB]',
];

// Book cover emojis keyed to common titles
const BOOK_COVER_EMOJIS = {
  'The Very Hungry Caterpillar': '🐛',
  'Where the Wild Things Are': '🦁',
  'Winnie-the-Pooh': '🐻',
};

function getBookEmoji(title) {
  return BOOK_COVER_EMOJIS[title] || '📖';
}

// Normalise a raw session object from the API into the shape used by the UI.
function normalizeSession(s) {
  const startedAt = s.startedAt || s.started_at;
  const completedAt = s.completedAt || s.completed_at;
  return {
    id: s.id,
    bookTitle: s.bookTitle || s.book_title || s.title || 'Unknown Book',
    date: completedAt || startedAt || s.date || new Date().toISOString(),
    wordsLearned: s.wordsLearned || s.words_learned || s.wordCount || 0,
    grammarScore: s.grammarScore ?? s.grammar_score ?? 0,
  };
}

// Calculate reading streak (consecutive days ending today or yesterday)
function calcStreak(sessions) {
  if (!sessions.length) return 0;
  const sorted = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
  let streak = 1;
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = new Date(sorted[i].date);
    const next = new Date(sorted[i + 1].date);
    const diff = Math.round((curr - next) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Ghibli design tokens (inline — mirrors globals.css variables)
// ---------------------------------------------------------------------------
const G = {
  primary: '#5C8B5C',
  primaryDark: '#3D6B3D',
  gold: '#D4A843',
  bg: '#F5F0E8',
  card: '#FFFCF3',
  textDark: '#3D2E1E',
  textMid: '#6B5744',
  textLight: '#6B5744',
  success: '#7AC87A',
  border: '#E8DEC8',
  bgAlt: '#EDE5D4',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, color, icon }) {
  return (
    <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-[#EDE5D4] text-center">
      {icon && <div className="text-xl sm:text-2xl mb-1" aria-hidden="true">{icon}</div>}
      <div className="text-2xl sm:text-3xl font-extrabold leading-none" style={{ color }}>
        {value}
      </div>
      <p className="text-[10px] sm:text-xs font-bold mt-1 leading-tight" style={{ color: G.textMid }}>
        {label}
      </p>
    </div>
  );
}

function SectionHeader({ title, actionLabel, onAction }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xl font-extrabold" style={{ color: G.textDark }}>
        {title}
      </h2>
      {actionLabel && (
        <button
          onClick={onAction}
          className="text-sm font-bold px-3 py-1.5 rounded-xl transition-all hover:-translate-y-0.5"
          style={{ color: G.primary, backgroundColor: '#D6E9D6' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function BookCard({ session }) {
  const dateLabel = new Date(session.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-2xl border hover-lift"
      style={{ backgroundColor: G.card, borderColor: G.border }}
    >
      <div
        className="text-3xl w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ backgroundColor: G.bgAlt }}
        aria-hidden="true"
      >
        {getBookEmoji(session.bookTitle)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-extrabold text-sm truncate" style={{ color: G.textDark }}>
          {session.bookTitle}
        </p>
        <p className="text-xs font-semibold mt-0.5" style={{ color: G.textLight }}>
          {dateLabel}
        </p>
      </div>
      {session.wordsLearned > 0 && (
        <div className="flex-shrink-0 text-right">
          <p className="text-xs font-bold" style={{ color: G.primary }}>
            +{session.wordsLearned}
          </p>
          <p className="text-[10px] font-semibold" style={{ color: G.textLight }}>
            words
          </p>
        </div>
      )}
    </div>
  );
}

function VocabRow({ word, definition }) {
  return (
    <div
      className="flex items-start gap-3 py-2.5 border-b last:border-0"
      style={{ borderColor: G.bgAlt }}
    >
      <span
        className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white"
        style={{ backgroundColor: G.primary }}
        aria-hidden="true"
      >
        W
      </span>
      <div className="min-w-0">
        <p className="font-extrabold text-sm" style={{ color: G.textDark }}>
          {word}
        </p>
        <p className="text-xs font-medium mt-0.5 line-clamp-1" style={{ color: G.textMid }}>
          {definition}
        </p>
      </div>
    </div>
  );
}

function WorksheetCard({ worksheet, gradientClass }) {
  const dateLabel = new Date(worksheet.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className="rounded-2xl overflow-hidden border hover-lift"
      style={{ backgroundColor: G.card, borderColor: G.border }}
    >
      {/* Placeholder image area */}
      <div
        className={`bg-gradient-to-br ${gradientClass} h-28 flex items-center justify-center relative`}
        aria-label={`Worksheet for ${worksheet.bookTitle}`}
      >
        <span className="text-4xl" aria-hidden="true">📝</span>
        {worksheet.score != null && (
          <span
            className="absolute top-2 right-2 text-xs font-extrabold px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
          >
            {worksheet.score}%
          </span>
        )}
      </div>
      {/* Card body */}
      <div className="p-3">
        <p
          className="text-xs font-extrabold line-clamp-2 mb-1"
          style={{ color: G.textDark }}
        >
          {worksheet.bookTitle}
        </p>
        <p className="text-[10px] font-semibold mb-2" style={{ color: G.textLight }}>
          {dateLabel}
        </p>
        <button
          className="w-full text-xs font-bold py-1.5 rounded-xl transition-all hover:-translate-y-0.5"
          style={{ backgroundColor: G.bgAlt, color: G.primary }}
          aria-label={`View worksheet for ${worksheet.bookTitle}`}
        >
          View Worksheet
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();

  // Student info from sessionStorage
  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState('');
  const [studentAge, setStudentAge] = useState(null);
  const [studentLevel, setStudentLevel] = useState('');
  const [showLevelBadge, setShowLevelBadge] = useState(false);

  // Data
  const [sessions, setSessions] = useState([]);
  const [recentWords, setRecentWords] = useState(MOCK_RECENT_WORDS);
  const [totalWords, setTotalWords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  // ---------------------------------------------------------------------------
  // Mount: read sessionStorage, redirect if missing, fetch data
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const id = sessionStorage.getItem('studentId');
    const name = sessionStorage.getItem('studentName');
    const age = sessionStorage.getItem('studentAge');
    const level = sessionStorage.getItem('studentLevel');

    const token = sessionStorage.getItem('token');
    const role = sessionStorage.getItem('userRole');
    if (!token) {
      router.push('/login');
      return;
    }
    // Parent users without a selected child → redirect to login child selection
    if (!id && role === 'parent') {
      router.push('/login');
      return;
    }
    if (!id) {
      router.push('/login');
      return;
    }

    setStudentId(id);
    setStudentName(name || 'Friend');
    setStudentAge(age ? parseInt(age, 10) : null);
    setStudentLevel(level || '');
    setShowLevelBadge(isParentOrAdmin());

    fetchDashboardData(id);
  }, [router]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function fetchDashboardData(id) {
    setLoading(true);
    setUsingFallback(false);

    try {
      let sessionsResult = null;
      let vocabResult = null;

      try {
        [sessionsResult, vocabResult] = await Promise.all([
          getStudentSessions(id),
          getVocabStats(id),
        ]);
      } catch (apiErr) {
        console.warn('Dashboard: API unavailable, falling back to mock data.', apiErr);
        setUsingFallback(true);
      }

      // Sessions
      if (
        sessionsResult &&
        sessionsResult.sessions &&
        sessionsResult.sessions.length > 0
      ) {
        const normalized = sessionsResult.sessions.map(normalizeSession);
        setSessions(normalized);
      } else {
        setUsingFallback(true);
        setSessions(MOCK_SESSIONS);
      }

      // Vocab stats
      if (vocabResult && vocabResult.stats) {
        setTotalWords(vocabResult.stats.totalWords || 0);
      } else {
        // Derive from mock sessions when API unavailable
        setTotalWords(
          MOCK_SESSIONS.reduce((sum, s) => sum + (s.wordsLearned || 0), 0)
        );
      }
    } catch (err) {
      console.error('Dashboard: unexpected fetch error.', err);
      setUsingFallback(true);
      setSessions(MOCK_SESSIONS);
      setTotalWords(MOCK_SESSIONS.reduce((sum, s) => sum + (s.wordsLearned || 0), 0));
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Derived stats
  // ---------------------------------------------------------------------------
  const booksRead = sessions.length;
  const dayStreak = calcStreak(sessions);
  const recentBooks = sessions.slice(0, 3);

  // Level display metadata
  const levelKey = studentLevel ? studentLevel.toLowerCase() : 'beginner';
  const levelMeta = LEVELS[levelKey] || LEVELS.beginner;

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4" style={{ color: G.textMid }}>
        <div className="text-5xl float-animation" aria-hidden="true">🌿</div>
        <p className="text-base font-bold">Loading your dashboard...</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Fallback notice */}
      {usingFallback && (
        <div
          className="px-4 py-3 rounded-xl border-l-4 text-sm font-bold"
          style={{ backgroundColor: '#FFF8E8', borderColor: G.gold, color: '#A8822E' }}
          role="status"
        >
          Showing example data. Connect to the internet to see your real progress.
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 1. Child Profile Section                                            */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="rounded-3xl overflow-hidden shadow-[0_6px_28px_rgba(61,46,30,0.12)]"
        aria-label="Student profile"
      >
        {/* Gradient header — richer multi-stop gradient */}
        <div
          className="p-6 pb-10 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #3D6B3D 0%, #5C8B5C 45%, #87CEDB 100%)',
          }}
        >
          {/* Decorative background glow */}
          <div
            className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(168,222,234,0.25) 0%, transparent 70%)',
              transform: 'translate(20%, -20%)',
            }}
            aria-hidden="true"
          />
          <div className="flex items-center gap-5 relative z-10">
            {/* Avatar */}
            <div
              className="text-7xl flex-shrink-0 float-animation drop-shadow-lg"
              aria-hidden="true"
            >
              🧒
            </div>
            {/* Name, age, level */}
            <div>
              <h1 className="text-3xl font-extrabold text-white leading-tight drop-shadow-sm">
                {studentName}
              </h1>
              {studentAge && (
                <p className="text-white/80 font-semibold text-sm mt-0.5">
                  Age {studentAge}
                </p>
              )}
              {showLevelBadge && studentLevel && (
                <span
                  className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-xs font-extrabold shadow-sm"
                  style={{
                    backgroundColor: levelMeta.color || '#A8E6CF',
                    color: G.textDark,
                  }}
                >
                  {levelMeta.icon} {levelMeta.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Greeting banner — overlaps the gradient slightly with negative margin */}
        <div
          className="px-6 pt-4 pb-3 -mt-4 rounded-t-2xl relative z-10"
          style={{ backgroundColor: G.card, borderBottom: `1px solid ${G.border}` }}
        >
          <p className="text-base font-bold" style={{ color: G.textDark }}>
            Hi, {studentName}! Ready to learn today? ✨
          </p>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* 2. Reading Stats Cards (3-column grid)                           */}
        {/* ---------------------------------------------------------------- */}
        <div
          className="px-4 sm:px-6 py-5"
          style={{ backgroundColor: G.card }}
          aria-label="Reading statistics"
        >
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <StatCard
              label="Books Read"
              value={booksRead}
              color={G.primary}
              icon="📚"
            />
            <StatCard
              label="Words Learned"
              value={totalWords}
              color={G.success}
              icon="💡"
            />
            <StatCard
              label="Day Streak"
              value={dayStreak}
              color={G.gold}
              icon="🔥"
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Recent Books Section                                             */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="ghibli-card p-5"
        aria-label="Recent books"
      >
        <SectionHeader
          title="Recent Books"
          actionLabel="See All"
          onAction={() => router.push('/profile')}
        />
        {recentBooks.length === 0 ? (
          <div className="text-center py-8" style={{ color: G.textLight }}>
            <div className="text-5xl mb-3 float-animation inline-block" aria-hidden="true">📖</div>
            <p className="text-base font-bold mt-1" style={{ color: G.textMid }}>No books read yet.</p>
            <p className="text-sm font-medium mt-1 mb-4">Start a session to see your books here!</p>
            <button
              onClick={() => router.push('/books')}
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: G.primary, boxShadow: '0 4px 12px rgba(92,139,92,0.3)' }}
            >
              Go to Library
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {recentBooks.map((session) => (
              <BookCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Vocabulary Highlights                                            */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="ghibli-card p-5"
        aria-label="Recent vocabulary"
      >
        <SectionHeader
          title="Vocabulary Highlights"
          actionLabel="Practice Words"
          onAction={() => router.push('/vocabulary')}
        />
        <div
          className="rounded-xl overflow-hidden border"
          style={{ borderColor: G.border, backgroundColor: G.card }}
        >
          {recentWords.slice(0, 5).map(({ word, definition }) => (
            <VocabRow key={word} word={word} definition={definition} />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 5. Worksheet Gallery (Gemini Embedding2 results)                   */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="ghibli-card p-5"
        aria-label="Worksheet gallery"
      >
        <SectionHeader title="My Worksheets" />
        {/* Responsive: 3-col on sm+, 2-col on xs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {MOCK_WORKSHEETS.map((ws, idx) => (
            <WorksheetCard
              key={ws.id}
              worksheet={ws}
              gradientClass={WORKSHEET_GRADIENTS[idx % WORKSHEET_GRADIENTS.length]}
            />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 6. Start Learning Button                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="pt-2 pb-4">
        <button
          onClick={() => router.push('/books')}
          className="w-full min-h-[60px] py-4 rounded-2xl font-extrabold text-lg text-white transition-all hover:-translate-y-1 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#3D6B3D] flex items-center justify-center gap-3"
          style={{
            background: `linear-gradient(135deg, ${G.primary} 0%, ${G.primaryDark} 100%)`,
            boxShadow: '0 6px 24px rgba(92, 139, 92, 0.45)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 8px 28px rgba(61, 107, 61, 0.55)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(92, 139, 92, 0.45)';
          }}
          aria-label="Start learning — go to the book library"
        >
          <span aria-hidden="true">📚</span>
          Start Learning
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  );
}
