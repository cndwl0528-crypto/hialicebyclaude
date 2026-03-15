'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BookCard from '@/components/BookCard';
import { getBooks as fetchBooksApi, getStudentSessions, startSession } from '@/services/api';
import { MOCK_BOOK_CATALOG, getBookSearchText, normalizeMockBook } from '@/lib/mockBookCatalog';
import { getItem, setItem } from '@/lib/clientStorage';

const CEFR_TO_DISPLAY = {
  A1: 'Beginner', A2: 'Beginner', B1: 'Intermediate', B2: 'Intermediate', C1: 'Advanced', C2: 'Advanced',
};

function getDisplayLevel(level) {
  if (!level) return 'Beginner';
  if (CEFR_TO_DISPLAY[level]) return CEFR_TO_DISPLAY[level];
  const cap = level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
  if (['Beginner', 'Intermediate', 'Advanced'].includes(cap)) return cap;
  return level;
}

function mergeBooksWithMock(apiBooks = []) {
  const merged = new Map();
  [...apiBooks, ...MOCK_BOOK_CATALOG].forEach((book) => {
    const key = (book.title || '').toLowerCase();
    if (!key) return;
    if (!merged.has(key)) { merged.set(key, book); return; }
    merged.set(key, { ...merged.get(key), ...book });
  });
  return Array.from(merged.values());
}

const LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced'];

const MOCK_LIBRARY_SESSIONS = [
  { id: 1, bookTitle: 'The Very Hungry Caterpillar', completedAt: '2026-03-10', grammarScore: 82, coverEmoji: '🐛' },
  { id: 2, bookTitle: 'Where the Wild Things Are', completedAt: '2026-03-09', grammarScore: 79, coverEmoji: '👹' },
  { id: 3, bookTitle: 'Winnie-the-Pooh', completedAt: '2026-03-08', grammarScore: 85, coverEmoji: '🐻' },
];

const MOCK_LIBRARY_CREATIONS = [
  { id: 'art-1', title: 'Favorite Scene Poster', bookTitle: 'The Very Hungry Caterpillar', emoji: '🎨', tone: 'from-[#FFE7A8] to-[#F8C8D8]' },
  { id: 'art-2', title: 'Story Avatar', bookTitle: 'Where the Wild Things Are', emoji: '✨', tone: 'from-[#D6F0E0] to-[#BCE3F1]' },
  { id: 'art-3', title: 'Memory Card', bookTitle: 'Winnie-the-Pooh', emoji: '🖼️', tone: 'from-[#F8E3B8] to-[#F4D8A8]' },
];

function normalizeSession(session) {
  return {
    id: session.id,
    bookTitle: session.bookTitle || session.book_title || 'Unknown Book',
    completedAt: session.completedAt || session.completed_at || session.startedAt || session.started_at || new Date().toISOString(),
    grammarScore: session.grammarScore ?? session.grammar_score ?? 0,
    coverEmoji: session.coverEmoji || session.cover_emoji || '📚',
  };
}

export default function LibraryPage() {
  const router = useRouter();

  // Session library state
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('books');

  // Book catalog state
  const [books, setBooks] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [studentLevel, setStudentLevel] = useState('All');
  const [confirmBook, setConfirmBook] = useState(null);

  // Load library sessions
  useEffect(() => {
    async function loadLibrary() {
      try {
        setLoading(true);
        const token = getItem('token');
        if (!token) { router.replace('/login'); return; }
        const studentId = getItem('studentId');
        if (!studentId) { setSessions(MOCK_LIBRARY_SESSIONS); return; }
        try {
          const data = await getStudentSessions(studentId);
          const normalized = (data.sessions || []).map(normalizeSession);
          setSessions(normalized.length > 0 ? normalized : MOCK_LIBRARY_SESSIONS);
        } catch {
          setSessions(MOCK_LIBRARY_SESSIONS);
        }
      } finally { setLoading(false); }
    }
    loadLibrary();
  }, [router]);

  // Load book catalog
  useEffect(() => {
    async function loadBooks() {
      try {
        setLoadingBooks(true);
        const storedLevel = getItem('studentLevel');
        if (storedLevel) setStudentLevel(storedLevel);
        const data = await fetchBooksApi(storedLevel);
        const apiBooks = (data.books || []).map(normalizeMockBook);
        setBooks(mergeBooksWithMock(apiBooks));
      } catch {
        setBooks(MOCK_BOOK_CATALOG);
      } finally {
        setLoadingBooks(false);
      }
    }
    if (getItem('token')) loadBooks();
    else setLoadingBooks(false);
  }, []);

  const filteredBooks = useMemo(() => {
    let filtered = books;
    if (selectedLevel !== 'All') {
      filtered = filtered.filter((b) => getDisplayLevel(b.level) === selectedLevel);
    }
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter((b) => getBookSearchText(b).includes(lower));
    }
    return filtered;
  }, [selectedLevel, searchTerm, books]);

  const latestBooks = useMemo(() => sessions.slice(0, 6), [sessions]);

  const handleSelectBook = useCallback(async (bookId, bookTitle) => {
    setItem('bookId', bookId);
    setItem('bookTitle', bookTitle);
    try {
      const sid = getItem('studentId');
      if (sid) {
        const result = await startSession(sid, bookId);
        const sessionId = result?.session?.id;
        if (sessionId) {
          router.push(`/session?bookId=${bookId}&bookTitle=${encodeURIComponent(bookTitle)}&sessionId=${sessionId}`);
          return;
        }
      }
    } catch (err) { console.warn('startSession failed:', err); }
    router.push(`/session?bookId=${bookId}&bookTitle=${encodeURIComponent(bookTitle)}`);
  }, [router]);

  const handleBookClick = useCallback((bookId, bookTitle) => {
    setConfirmBook({ id: bookId, title: bookTitle });
  }, []);

  const handleConfirmYes = useCallback(() => {
    if (confirmBook) {
      handleSelectBook(confirmBook.id, confirmBook.title);
      setConfirmBook(null);
    }
  }, [confirmBook, handleSelectBook]);

  return (
    <div className="space-y-6">

      {/* ── Which book did you read? ─────────────────────────────────── */}
      <section className="overflow-hidden rounded-[28px] border border-[#D6C9A8] bg-[linear-gradient(135deg,#eef5dc_0%,#fff8df_45%,#e0eef9_100%)] p-6 shadow-[0_10px_30px_rgba(61,46,30,0.08)]">
        <p className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.2em] text-[#5C8B5C]">
          Book Library
        </p>
        <h1 className="mt-3 text-3xl font-extrabold text-[#3D2E1E]">Which book did you read?</h1>
        <p className="mt-2 text-sm font-semibold text-[#6B5744]">
          {studentLevel !== 'All'
            ? <>Showing books for <span className="text-[#5C8B5C] font-extrabold">{studentLevel}</span> readers</>
            : 'Search by title, author, theme, or keyword.'}
        </p>
      </section>

      {/* ── Search + Level Filter ────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B5744] pointer-events-none" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </div>
          <input
            type="text"
            placeholder="Find a book, feeling, character, or topic..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-3 border border-[#D6C9A8] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] focus:border-transparent bg-[#FFFCF3] text-[#3D2E1E] font-semibold shadow-[0_2px_8px_rgba(61,46,30,0.06)]"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B5744] hover:text-[#3D2E1E] p-1" aria-label="Clear search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              className={`px-4 py-2 rounded-2xl font-bold text-sm transition-all min-h-[40px] ${
                selectedLevel === level
                  ? 'bg-[#5C8B5C] text-white shadow-[0_2px_8px_rgba(92,139,92,0.3)]'
                  : 'bg-[#EDE5D4] text-[#3D2E1E] hover:bg-[#D6C9A8]'
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        {!loadingBooks && (
          <p className="text-xs text-[#8D6E63] font-semibold">
            Showing {filteredBooks.length} book{filteredBooks.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* ── Book Grid ────────────────────────────────────────────────── */}
      {loadingBooks ? (
        <div className="flex justify-center py-12">
          <div className="text-center">
            <div className="text-4xl mb-3 float-animation inline-block">🌿</div>
            <p className="text-[#6B5744] font-bold">Loading books...</p>
          </div>
        </div>
      ) : filteredBooks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onClick={() => handleBookClick(book.id, book.title)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-5xl mb-3 float-animation inline-block" aria-hidden="true">🌿</div>
          <p className="text-[#6B5744] font-bold text-lg mb-2">No books found</p>
          <p className="text-[#6B5744] text-sm font-medium mb-4">Try a different search or clear the filters.</p>
          <button
            onClick={() => { setSelectedLevel('All'); setSearchTerm(''); }}
            className="px-5 py-2.5 bg-[#5C8B5C] text-white rounded-xl font-bold text-sm hover:bg-[#3D6B3D] transition-all min-h-[44px]"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── Past Sessions & Creations ────────────────────────────────── */}
      <section className="ghibli-card p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#A8822E]">My Library</p>
            <h2 className="mt-1 text-xl font-extrabold text-[#3D2E1E]">Past sessions &amp; creations</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#EFE6D7] p-1">
            <button
              onClick={() => setActiveTab('books')}
              className={`min-h-[44px] rounded-xl px-4 py-2 text-sm font-extrabold transition-all ${
                activeTab === 'books' ? 'bg-[#5C8B5C] text-white' : 'text-[#6B5744]'
              }`}
            >
              Read Books
            </button>
            <button
              onClick={() => setActiveTab('creations')}
              className={`min-h-[44px] rounded-xl px-4 py-2 text-sm font-extrabold transition-all ${
                activeTab === 'creations' ? 'bg-[#5C8B5C] text-white' : 'text-[#6B5744]'
              }`}
            >
              Creations
            </button>
          </div>
        </div>

        {activeTab === 'books' ? (
          <>
            {loading ? (
              <p className="text-sm font-semibold text-[#6B5744]">Loading your reading library...</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {latestBooks.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => router.push('/review')}
                    className="flex items-center gap-4 rounded-[24px] border border-[#E8DEC8] bg-[#FFFCF3] p-4 text-left shadow-[0_6px_18px_rgba(61,46,30,0.05)] transition-all hover:-translate-y-0.5"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E8F5E8] text-4xl">
                      {session.coverEmoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-extrabold text-[#3D2E1E]">{session.bookTitle}</p>
                      <p className="text-sm font-semibold text-[#6B5744]">
                        {new Date(session.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#5C8B5C]">Grammar score {session.grammarScore}%</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {MOCK_LIBRARY_CREATIONS.map((item) => (
              <button
                key={item.id}
                onClick={() => router.push('/review')}
                className="overflow-hidden rounded-[24px] border border-[#E8DEC8] bg-[#FFFCF3] text-left shadow-[0_6px_18px_rgba(61,46,30,0.05)] transition-all hover:-translate-y-0.5"
              >
                <div className={`bg-gradient-to-br ${item.tone} p-5`}>
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{item.emoji}</span>
                    <span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#6B5744]">
                      Saved
                    </span>
                  </div>
                  <p className="mt-8 text-base font-extrabold text-[#3D2E1E]">{item.title}</p>
                  <p className="mt-2 text-xs font-semibold text-[#6B5744]">{item.bookTitle}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Confirmation Modal ───────────────────────────────────────── */}
      {confirmBook && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setConfirmBook(null)}>
          <div className="ghibli-card p-8 max-w-md w-full text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-4xl mb-4">📖</div>
            <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-2">
              Did you finish reading
            </h3>
            <p className="text-lg font-bold text-[#5C8B5C] mb-6">
              &quot;{confirmBook.title}&quot;?
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setConfirmBook(null)}
                className="flex-1 py-3 px-4 bg-[#EDE5D4] text-[#6B5744] rounded-2xl font-bold hover:bg-[#D6C9A8] transition-all hover:-translate-y-0.5 min-h-[48px]"
              >
                Pick another book
              </button>
              <button
                onClick={handleConfirmYes}
                className="flex-1 py-3 px-4 bg-[#5C8B5C] text-white rounded-2xl font-bold hover:bg-[#3D6B3D] transition-all hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(92,139,92,0.3)] min-h-[48px]"
              >
                Yes, let&apos;s go!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
