'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BookCard from '@/components/BookCard';
import BookRecommendation from '@/components/BookRecommendation';
import { getBooks as fetchBooksApi, startSession, getStudentSessions, resumeSession } from '@/services/api';
import { isParentOrAdmin } from '@/lib/constants';

const MOCK_BOOKS = [
  {
    id: 1, title: 'The Very Hungry Caterpillar', author: 'Eric Carle',
    level: 'Beginner', genre: 'Picture Book', cover: '🐛',
    description: 'A tiny caterpillar eats his way through a week of food.',
    rating: 4.8, reviewCount: 2340, badge: 'Bestseller',
    ageRange: 'Ages 3-6', gradeLevel: 'Grade Pre-K', progress: 0,
  },
  {
    id: 2, title: 'Where the Wild Things Are', author: 'Maurice Sendak',
    level: 'Beginner', genre: 'Picture Book', cover: '👹',
    description: 'Max sails away to an island of wild creatures.',
    rating: 4.7, reviewCount: 1890, badge: 'Award Winner',
    ageRange: 'Ages 4-8', gradeLevel: 'Grade K-2', progress: 0,
  },
  {
    id: 3, title: "Charlotte's Web", author: 'E.B. White',
    level: 'Intermediate', genre: 'Chapter Book', cover: '🕷️',
    description: 'A pig and a spider form an unforgettable friendship.',
    rating: 4.9, reviewCount: 3120, badge: 'Award Winner',
    ageRange: 'Ages 7-10', gradeLevel: 'Grade 2-4', progress: 35,
  },
  {
    id: 4, title: 'The Lion, the Witch and the Wardrobe', author: 'C.S. Lewis',
    level: 'Intermediate', genre: 'Fantasy', cover: '🦁',
    description: 'Children discover a magical world inside a wardrobe.',
    rating: 4.8, reviewCount: 2780, badge: 'Bestseller',
    ageRange: 'Ages 8-12', gradeLevel: 'Grade 3-5', progress: 0,
  },
  {
    id: 5, title: 'Magic Tree House: Dinosaurs Before Dark', author: 'Mary Pope Osborne',
    level: 'Intermediate', genre: 'Adventure', cover: '🌳',
    description: 'Jack and Annie travel back to the time of dinosaurs.',
    rating: 4.6, reviewCount: 1560, badge: 'Popular',
    ageRange: 'Ages 6-9', gradeLevel: 'Grade 1-3', progress: 60,
  },
  {
    id: 6, title: 'A Wrinkle in Time', author: "Madeleine L'Engle",
    level: 'Advanced', genre: 'Science Fiction', cover: '⭐',
    description: 'A girl searches for her missing father across the universe.',
    rating: 4.5, reviewCount: 1980, badge: 'Award Winner',
    ageRange: 'Ages 10-14', gradeLevel: 'Grade 5-8', progress: 0,
  },
  {
    id: 7, title: 'Inkheart', author: 'Cornelia Funke',
    level: 'Advanced', genre: 'Fantasy', cover: '📖',
    description: 'A girl discovers her father can read fictional characters into reality.',
    rating: 4.4, reviewCount: 890,
    ageRange: 'Ages 10-14', gradeLevel: 'Grade 5-7', progress: 0,
  },
  {
    id: 8, title: 'The Book Thief', author: 'Markus Zusak',
    level: 'Advanced', genre: 'Historical Fiction', cover: '📚',
    description: 'A girl steals books and shares them during wartime.',
    rating: 4.7, reviewCount: 2150, badge: 'Bestseller',
    ageRange: 'Ages 12+', gradeLevel: 'Grade 6-8', progress: 15,
  },
  {
    id: 9, title: 'Winnie-the-Pooh', author: 'A.A. Milne',
    level: 'Beginner', genre: 'Picture Book', cover: '🐻',
    description: 'The adventures of a lovable bear and his friends.',
    rating: 4.8, reviewCount: 3450, badge: 'Popular',
    ageRange: 'Ages 3-7', gradeLevel: 'Grade Pre-K-1', progress: 0,
  },
  {
    id: 10, title: 'Matilda', author: 'Roald Dahl',
    level: 'Intermediate', genre: 'Fiction', cover: '👧',
    description: 'A young genius girl discovers she has telekinetic powers.',
    rating: 4.7, reviewCount: 2670, badge: 'Popular',
    ageRange: 'Ages 7-11', gradeLevel: 'Grade 2-5', progress: 0,
  },
];

const CEFR_TO_DISPLAY = {
  A1: 'Beginner', A2: 'Beginner', B1: 'Intermediate', B2: 'Intermediate', C1: 'Advanced', C2: 'Advanced',
};

function getDisplayLevel(level) {
  if (!level) return 'Beginner';
  if (CEFR_TO_DISPLAY[level]) return CEFR_TO_DISPLAY[level];
  const capitalized = level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
  if (['Beginner', 'Intermediate', 'Advanced'].includes(capitalized)) return capitalized;
  return level;
}

const LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced'];

const LEVEL_FILTER_STYLES = {
  All: { active: 'bg-[#5C8B5C] text-white shadow-[0_2px_8px_rgba(92,139,92,0.3)]', inactive: 'bg-[#EDE5D4] text-[#3D2E1E] hover:bg-[#D6C9A8]' },
  Beginner: { active: 'bg-[#C8E6C9] text-[#1B5E20] border-2 border-[#7AC87A]', inactive: 'bg-[#EDE5D4] text-[#3D2E1E] hover:bg-[#D6C9A8]' },
  Intermediate: { active: 'bg-[#FFE0B2] text-[#BF360C] border-2 border-[#D4A843]', inactive: 'bg-[#EDE5D4] text-[#3D2E1E] hover:bg-[#D6C9A8]' },
  Advanced: { active: 'bg-[#E1BEE7] text-[#4A148C] border-2 border-[#C8A0D0]', inactive: 'bg-[#EDE5D4] text-[#3D2E1E] hover:bg-[#D6C9A8]' },
};

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-[#D4A843]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function BooksPage() {
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [studentLevel, setStudentLevel] = useState('All');
  const [studentId, setStudentId] = useState(null);
  const [pausedSessions, setPausedSessions] = useState([]);
  const [resumingSessionId, setResumingSessionId] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [confirmBook, setConfirmBook] = useState(null);

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoading(true);
        const storedLevel = sessionStorage.getItem('studentLevel');
        if (storedLevel) {
          setStudentLevel(storedLevel);
          setSelectedLevel(storedLevel);
        }

        const storedStudentId = sessionStorage.getItem('studentId');
        if (storedStudentId) {
          setStudentId(storedStudentId);
          try {
            const sessionsData = await getStudentSessions(storedStudentId);
            const paused = (sessionsData.sessions || []).filter(
              (s) => s.status === 'paused' || s.status === 'in_progress'
            );
            setPausedSessions(paused);
          } catch (sessErr) {
            console.warn('Failed to fetch paused sessions:', sessErr);
          }
        }

        const data = await fetchBooksApi(storedLevel);
        setBooks(data.books || MOCK_BOOKS);
      } catch (err) {
        console.warn('Failed to fetch books from API, using mock data:', err);
        setBooks(MOCK_BOOKS);
      } finally {
        setLoading(false);
      }
    };
    fetchBooks();
  }, []);

  const filteredBooks = useMemo(() => {
    let filtered = books;
    if (selectedLevel !== 'All') filtered = filtered.filter((b) => getDisplayLevel(b.level) === selectedLevel);
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter((b) =>
        b.title.toLowerCase().includes(lower) ||
        b.author?.toLowerCase().includes(lower) ||
        b.genre?.toLowerCase().includes(lower)
      );
    }
    return filtered;
  }, [selectedLevel, searchTerm, books]);

  const shelfRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < filteredBooks.length; i += 3) {
      rows.push(filteredBooks.slice(i, i + 3));
    }
    return rows;
  }, [filteredBooks]);

  const handleSelectBook = useCallback(async (bookId, bookTitle) => {
    sessionStorage.setItem('bookId', bookId);
    sessionStorage.setItem('bookTitle', bookTitle);

    let realSessionId = null;
    try {
      const storedStudentId = sessionStorage.getItem('studentId');
      if (storedStudentId) {
        const result = await startSession(storedStudentId, bookId);
        realSessionId = result?.session?.id || null;
      }
    } catch (err) {
      console.warn('startSession API failed, session page will retry:', err);
    }

    const params = new URLSearchParams({
      bookId,
      bookTitle,
      ...(realSessionId ? { sessionId: realSessionId } : {}),
    });
    router.push(`/session?${params.toString()}`);
  }, [router]);

  const handleResumeSession = useCallback(async (session) => {
    setResumingSessionId(session.id);
    try {
      await resumeSession(session.id);
    } catch (err) {
      console.warn('Resume session API failed (continuing with redirect):', err);
    }
    sessionStorage.setItem('bookId', session.bookId || session.book_id || '');
    sessionStorage.setItem('bookTitle', session.bookTitle || session.book_title || '');

    const params = new URLSearchParams({
      bookId: session.bookId || session.book_id || '',
      bookTitle: session.bookTitle || session.book_title || '',
      sessionId: session.id,
    });
    router.push(`/session?${params.toString()}`);
  }, [router]);

  const bookIds = useMemo(() => filteredBooks.map((b) => b.id), [filteredBooks]);

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
    <div className="py-4 sm:py-8">
      {/* 3-Step Flow Indicator */}
      <div className="mb-6 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold" aria-label="How it works: 3 steps">
        <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 bg-[#5C8B5C] text-white rounded-full shadow-sm">
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-extrabold flex-shrink-0" aria-hidden="true">1</span>
          <span className="hidden sm:inline">Choose a book you&apos;ve read</span>
          <span className="sm:hidden">Choose</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4B49A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
        <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 bg-[#EDE5D4] text-[#6B5744] rounded-full">
          <span className="w-5 h-5 rounded-full bg-[#D6C9A8] flex items-center justify-center text-xs font-extrabold flex-shrink-0" aria-hidden="true">2</span>
          <span className="hidden sm:inline">Talk about it with Alice</span>
          <span className="sm:hidden">Talk</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4B49A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
        <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 bg-[#EDE5D4] text-[#6B5744] rounded-full">
          <span className="w-5 h-5 rounded-full bg-[#D6C9A8] flex items-center justify-center text-xs font-extrabold flex-shrink-0" aria-hidden="true">3</span>
          <span className="hidden sm:inline">Get your worksheet</span>
          <span className="sm:hidden">Worksheet</span>
        </div>
      </div>

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-3xl font-extrabold text-[#3D2E1E] mb-1 leading-tight">
          {studentLevel !== 'All' ? 'Which book did you read?' : 'Pick a Book'}
        </h1>
        {studentLevel !== 'All' && (
          <p className="text-[#6B5744] font-semibold text-sm">
            Showing books for <span className="text-[#5C8B5C] font-extrabold">{studentLevel}</span> readers
          </p>
        )}
      </div>

      {/* PRIORITY: Continue Reading — top of page before any controls */}
      {pausedSessions.length > 0 && !loading && (
        <div className="mb-6">
          <h3 className="text-lg font-extrabold text-[#3D2E1E] mb-3 flex items-center gap-2">
            <span role="img" aria-label="bookmark">📌</span> Continue Your Review
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pausedSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => handleResumeSession(session)}
                disabled={resumingSessionId === session.id}
                className="bg-gradient-to-r from-[#FFF8E0] to-[#F5E8A8] border-2 border-[#D4A843]/30 rounded-2xl p-4 flex items-center gap-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-[0.98] disabled:opacity-60 min-h-[56px]"
                aria-label={`Resume review of ${session.bookTitle || session.book_title || 'your book'}`}
              >
                <div className="text-3xl flex-shrink-0 w-12 h-12 rounded-xl bg-white/60 flex items-center justify-center" aria-hidden="true">
                  {session.coverEmoji || session.cover_emoji || '📖'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#6B5744] text-sm truncate">
                    {session.bookTitle || session.book_title || 'In Progress'}
                  </p>
                  <p className="text-xs text-[#6B5744] mt-0.5">
                    {session.stage || 'Paused'} — tap to continue!
                  </p>
                </div>
                <div className="text-[#D4A843] text-xl flex-shrink-0" aria-hidden="true">
                  {resumingSessionId === session.id ? <LoadingSpinner /> : '→'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations — surfaced above the grid for discoverability */}
      {studentLevel !== 'All' && !loading && (
        <div className="mb-8">
          <BookRecommendation
            studentId={studentId}
            studentLevel={studentLevel}
            onSelectBook={(book) => handleBookClick(book.id, book.title)}
            excludeBookIds={bookIds}
          />
        </div>
      )}

      {/* Search + View Toggle + Filters */}
      <div className="mb-6">
        <div className="mb-4 flex gap-3">
          <div className="flex-1 relative">
            <label htmlFor="book-search" className="sr-only">Search books</label>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B5744] pointer-events-none" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              id="book-search"
              type="text"
              placeholder="Find a book..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-3 border border-[#D6C9A8] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] focus:border-transparent bg-[#FFFCF3] text-[#3D2E1E] font-semibold shadow-[0_2px_8px_rgba(61,46,30,0.06)]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B5744] hover:text-[#3D2E1E] transition-colors p-1"
                aria-label="Clear search"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          <fieldset className="flex bg-[#EDE5D4] rounded-2xl p-1 gap-1">
            <legend className="sr-only">View mode</legend>
            <button
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className={`px-3 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 min-h-[44px] ${
                viewMode === 'grid'
                  ? 'bg-[#5C8B5C] text-white shadow-sm'
                  : 'text-[#6B5744] hover:bg-[#D6C9A8]'
              }`}
              aria-label="Grid view"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <rect x="11" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <rect x="1" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span className="hidden sm:inline text-xs">Grid</span>
            </button>
            <button
              onClick={() => setViewMode('shelf')}
              aria-pressed={viewMode === 'shelf'}
              className={`px-3 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 min-h-[44px] ${
                viewMode === 'shelf'
                  ? 'bg-[#5C8B5C] text-white shadow-sm'
                  : 'text-[#6B5744] hover:bg-[#D6C9A8]'
              }`}
              aria-label="Shelf view"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="2" width="3" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="6" y="4" width="3" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="11" y="1" width="3" height="15" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <line x1="0" y1="17" x2="18" y2="17" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span className="hidden sm:inline text-xs">Shelf</span>
            </button>
          </fieldset>
        </div>

        {/* Level Filter — only visible to parents/admins */}
        {isParentOrAdmin() && (
          <fieldset>
            <legend className="sr-only">Filter by reading level</legend>
            <div className="flex gap-2 flex-wrap" role="group">
              {LEVELS.map((level) => {
                const styles = LEVEL_FILTER_STYLES[level] || LEVEL_FILTER_STYLES['All'];
                return (
                  <button
                    key={level}
                    onClick={() => setSelectedLevel(level)}
                    aria-pressed={selectedLevel === level}
                    aria-label={`Filter by ${level} level`}
                    className={`px-5 py-2.5 rounded-2xl font-bold transition-all hover:-translate-y-0.5 min-h-[44px] ${
                      selectedLevel === level ? styles.active : styles.inactive
                    }`}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {/* Result count */}
        {!loading && (
          <p className="text-xs text-[#8D6E63] mt-3 font-semibold">
            Showing {filteredBooks.length} book{filteredBooks.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Book list */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <div className="text-4xl mb-3 float-animation inline-block">🌿</div>
            <p className="text-[#6B5744] font-bold text-lg">Loading books...</p>
          </div>
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onClick={() => handleBookClick(book.id, book.title)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {shelfRows.map((row, rowIndex) => (
                <div key={row.map((b) => b.id).join('-')} className="shelf-row">
                  <div className="flex gap-4 items-end justify-start px-4 overflow-x-auto pb-1">
                    {row.map((book) => (
                      <div key={book.id} className="w-[120px] sm:w-[140px] flex-shrink-0">
                        <BookCard
                          book={book}
                          onClick={() => handleBookClick(book.id, book.title)}
                          compact
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Confirmation Modal */}
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
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmBook(null)}
                    className="flex-1 py-3 px-4 bg-[#EDE5D4] text-[#6B5744] rounded-2xl font-bold hover:bg-[#D6C9A8] transition-all hover:-translate-y-0.5"
                  >
                    Pick another book
                  </button>
                  <button
                    onClick={handleConfirmYes}
                    className="flex-1 py-3 px-4 bg-[#5C8B5C] text-white rounded-2xl font-bold hover:bg-[#3D6B3D] transition-all hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(92,139,92,0.3)]"
                  >
                    Yes, let&apos;s go!
                  </button>
                </div>
              </div>
            </div>
          )}

          {filteredBooks.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-3 float-animation inline-block" aria-hidden="true">🌿</div>
              <p className="text-[#6B5744] font-bold text-xl mb-2">No books found!</p>
              <p className="text-[#6B5744] text-sm font-medium mb-5">Try searching for something else or clear the filters.</p>
              <button
                onClick={() => { setSelectedLevel('All'); setSearchTerm(''); }}
                className="px-6 min-h-[48px] py-3 bg-[#5C8B5C] text-white rounded-xl font-bold text-sm hover:bg-[#3D6B3D] transition-all hover:-translate-y-0.5 shadow-sm inline-flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Clear filters
              </button>
              {books.length > 0 && (
                <div className="mt-8">
                  <p className="text-[#6B5744] text-sm font-semibold mb-3">Popular books you might like:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {books.slice(0, 3).map((book) => (
                      <button
                        key={book.id}
                        onClick={() => { setSearchTerm(''); setSelectedLevel('All'); handleBookClick(book.id, book.title); }}
                        className="px-4 py-2 min-h-[44px] bg-[#EDE5D4] text-[#6B5744] rounded-xl font-bold text-sm hover:bg-[#D6C9A8] transition-colors inline-flex items-center"
                      >
                        {book.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
