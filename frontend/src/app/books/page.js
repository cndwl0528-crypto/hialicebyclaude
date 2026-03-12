'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import VoiceButton from '@/components/VoiceButton';
import useSpeech from '@/hooks/useSpeech';
import { getBooks as fetchBooksApi, startSession, getStudentSessions, resumeSession } from '@/services/api';
import { isParentOrAdmin } from '@/lib/constants';
import { MOCK_BOOK_CATALOG, getBookSearchText, normalizeMockBook } from '@/lib/mockBookCatalog';
import { getItem, setItem } from '@/lib/clientStorage';

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

const DISCOVERY_FILTERS = ['All', 'Adventure', 'Friendship', 'Magic', 'Animals', 'Curiosity'];

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-[#D4A843]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function PreReadingScreen({ book, onReady }) {
  const [step, setStep] = useState(1);
  const [priorKnowledge, setPriorKnowledge] = useState('');
  const [prediction, setPrediction] = useState('');
  const [animating, setAnimating] = useState(false);
  const inputRef = useRef(null);

  // Focus the textarea whenever the step changes
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [step]);

  const goToStep2 = useCallback(() => {
    setAnimating(true);
    setTimeout(() => {
      setStep(2);
      setAnimating(false);
    }, 280);
  }, []);

  const handleReady = useCallback(() => {
    setItem('preReadingResponses', JSON.stringify({
      bookId: book.id,
      priorKnowledge: priorKnowledge.trim(),
      prediction: prediction.trim(),
    }));
    onReady(book.id, book.title);
  }, [book, priorKnowledge, prediction, onReady]);

  const stepLabels = ['Prior Knowledge', 'Prediction'];

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-8">
      {/* Book identity */}
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#E8F5E8] text-5xl shadow-[0_6px_18px_rgba(61,107,61,0.15)]">
          {book.coverEmoji || book.cover || '📖'}
        </div>
        <h2 className="text-xl font-extrabold text-[#3D2E1E] max-w-xs leading-tight">
          {book.title}
        </h2>
        <p className="text-sm font-bold text-[#5C8B5C]">
          Before we start, let&apos;s think about this book!
        </p>
      </div>

      {/* Progress dots */}
      <div className="mb-6 flex items-center gap-2" aria-label={`Step ${step} of 2`}>
        {[1, 2].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`h-3 w-3 rounded-full transition-all duration-300 ${
                n === step
                  ? 'bg-[#5C8B5C] scale-125 shadow-[0_0_0_3px_rgba(92,139,92,0.25)]'
                  : n < step
                  ? 'bg-[#5C8B5C] opacity-50'
                  : 'bg-[#D6C9A8]'
              }`}
              aria-hidden="true"
            />
            {n < 2 && (
              <div className="h-0.5 w-8 rounded-full bg-[#D6C9A8]" aria-hidden="true" />
            )}
          </div>
        ))}
        <span className="ml-2 text-xs font-bold text-[#9C8B74]">
          Step {step} / 2 — {stepLabels[step - 1]}
        </span>
      </div>

      {/* Card */}
      <div
        className={`w-full max-w-lg rounded-3xl border border-[#E8DEC8] bg-[#FFFCF3] p-6 shadow-[0_8px_24px_rgba(61,46,30,0.08)] transition-all duration-280 ${
          animating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
        }`}
      >
        {step === 1 ? (
          <>
            <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.18em] text-[#D4A843]">
              Step 1
            </p>
            <h3 className="mb-4 text-lg font-extrabold leading-snug text-[#3D2E1E]">
              What do you already know about{' '}
              <span className="text-[#5C8B5C]">&ldquo;{book.title}&rdquo;</span>?
            </h3>
            <textarea
              ref={inputRef}
              value={priorKnowledge}
              onChange={(e) => setPriorKnowledge(e.target.value)}
              placeholder="Write what you already know, or just leave it blank!"
              rows={4}
              className="w-full resize-none rounded-2xl border border-[#D6C9A8] bg-[#FFFDF7] px-4 py-3 text-[#3D2E1E] font-semibold placeholder:text-[#C4B49A] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] text-base leading-relaxed"
            />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => { setPriorKnowledge(''); goToStep2(); }}
                className="flex-1 min-h-[48px] rounded-2xl bg-[#EDE5D4] px-4 py-3 text-sm font-bold text-[#6B5744] transition-all hover:-translate-y-0.5 hover:bg-[#D6C9A8]"
              >
                Skip this one
              </button>
              <button
                onClick={goToStep2}
                className="flex-1 min-h-[48px] rounded-2xl bg-[#5C8B5C] px-4 py-3 text-sm font-extrabold text-white shadow-[0_4px_12px_rgba(92,139,92,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#3D6B3D]"
              >
                Next →
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.18em] text-[#D4A843]">
              Step 2
            </p>
            <h3 className="mb-4 text-lg font-extrabold leading-snug text-[#3D2E1E]">
              What do you think this book is about?
            </h3>
            <textarea
              ref={inputRef}
              value={prediction}
              onChange={(e) => setPrediction(e.target.value)}
              placeholder="Make your best guess — there's no wrong answer!"
              rows={4}
              className="w-full resize-none rounded-2xl border border-[#D6C9A8] bg-[#FFFDF7] px-4 py-3 text-[#3D2E1E] font-semibold placeholder:text-[#C4B49A] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] text-base leading-relaxed"
            />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => {
                  setAnimating(true);
                  setTimeout(() => { setStep(1); setAnimating(false); }, 280);
                }}
                className="flex-1 min-h-[48px] rounded-2xl bg-[#EDE5D4] px-4 py-3 text-sm font-bold text-[#6B5744] transition-all hover:-translate-y-0.5 hover:bg-[#D6C9A8]"
              >
                ← Back
              </button>
              <button
                onClick={handleReady}
                className="flex-1 min-h-[48px] rounded-2xl bg-[#3D6B3D] px-4 py-3 text-sm font-extrabold text-white shadow-[0_4px_14px_rgba(61,107,61,0.35)] transition-all hover:-translate-y-0.5 hover:bg-[#2E5230]"
              >
                Ready! Let&apos;s Talk About It! →
              </button>
            </div>
          </>
        )}
      </div>

      {/* Encouraging note */}
      <p className="mt-5 text-xs font-semibold text-[#9C8B74] text-center max-w-xs">
        These warm-up questions help Alice understand what you already know so she can ask you the best questions!
      </p>
    </div>
  );
}

function mergeBooksWithMock(apiBooks = []) {
  const merged = new Map();

  [...apiBooks, ...MOCK_BOOK_CATALOG].forEach((book) => {
    const key = (book.title || '').toLowerCase();
    if (!key) return;

    if (!merged.has(key)) {
      merged.set(key, book);
      return;
    }

    merged.set(key, {
      ...merged.get(key),
      ...book,
    });
  });

  return Array.from(merged.values());
}

export default function BooksPage() {
  const router = useRouter();
  const studentMode = !isParentOrAdmin();
  const [books, setBooks] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [studentLevel, setStudentLevel] = useState('All');
  const [studentId, setStudentId] = useState(null);
  const [pausedSessions, setPausedSessions] = useState([]);
  const [resumingSessionId, setResumingSessionId] = useState(null);
  const [confirmBook, setConfirmBook] = useState(null);
  const [preReadingBook, setPreReadingBook] = useState(null);
  const [discoveryFilter, setDiscoveryFilter] = useState('All');
  const [voiceSearchPromptDismissed, setVoiceSearchPromptDismissed] = useState(false);
  const { isListening, transcript, startListening, stopListening, supported } = useSpeech();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = getItem('token');
    const role = getItem('userRole');
    if (!token) {
      router.replace('/login');
      return;
    }

    if (role === 'parent' && !getItem('studentId')) {
      router.replace('/dashboard');
      return;
    }

    const fetchBooks = async () => {
      try {
        setLoading(true);
        const storedLevel = getItem('studentLevel');
        if (storedLevel) {
          setStudentLevel(storedLevel);
          setSelectedLevel(studentMode ? 'All' : storedLevel);
        }

        const storedStudentId = getItem('studentId');
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
        const apiBooks = (data.books || []).map(normalizeMockBook);
        setBooks(mergeBooksWithMock(apiBooks));
      } catch (err) {
        console.warn('Failed to fetch books from API, using mock data:', err);
        setBooks(MOCK_BOOK_CATALOG);
      } finally {
        setLoading(false);
      }
    };
    fetchBooks();
  }, [router, studentMode]);

  const filteredBooks = useMemo(() => {
    let filtered = books;
    if (!studentMode && selectedLevel !== 'All') {
      filtered = filtered.filter((b) => getDisplayLevel(b.level) === selectedLevel);
    }
    if (discoveryFilter !== 'All') {
      const lowerFilter = discoveryFilter.toLowerCase();
      filtered = filtered.filter((b) => getBookSearchText(b).includes(lowerFilter));
    }
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter((b) => getBookSearchText(b).includes(lower));
    }
    return filtered;
  }, [selectedLevel, searchTerm, discoveryFilter, books, studentMode]);

  const featuredBooks = useMemo(() => books.slice(0, 3), [books]);
  const topVoiceMatches = useMemo(() => filteredBooks.slice(0, 3), [filteredBooks]);
  const exactVoiceMatch = useMemo(() => topVoiceMatches[0] || null, [topVoiceMatches]);

  const handleSelectBook = useCallback(async (bookId, bookTitle) => {
    setItem('bookId', bookId);
    setItem('bookTitle', bookTitle);

    let realSessionId = null;
    try {
      const storedStudentId = getItem('studentId');
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
    setItem('bookId', session.bookId || session.book_id || '');
    setItem('bookTitle', session.bookTitle || session.book_title || '');

    const params = new URLSearchParams({
      bookId: session.bookId || session.book_id || '',
      bookTitle: session.bookTitle || session.book_title || '',
      sessionId: session.id,
    });
    router.push(`/session?${params.toString()}`);
  }, [router]);

  const handleBookClick = useCallback((bookId, bookTitle) => {
    setConfirmBook({ id: bookId, title: bookTitle });
  }, []);

  const handleConfirmYes = useCallback(() => {
    if (confirmBook) {
      // Transition to Pre-Reading screen instead of going straight to session
      setPreReadingBook(confirmBook);
      setConfirmBook(null);
    }
  }, [confirmBook]);

  const handlePreReadingReady = useCallback((bookId, bookTitle) => {
    handleSelectBook(bookId, bookTitle);
  }, [handleSelectBook]);

  const handleVoiceSearch = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }
    startListening();
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    if (transcript?.trim()) {
      setSearchTerm(transcript.trim());
    }
  }, [transcript]);

  // When pre-reading is active, show the pre-reading screen only
  if (preReadingBook) {
    return (
      <div className="py-4 sm:py-8">
        <div className="mx-auto max-w-2xl">
          {/* Back button to cancel pre-reading and return to book list */}
          <button
            onClick={() => setPreReadingBook(null)}
            className="mb-4 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-[#6B5744] bg-[#EDE5D4] hover:bg-[#D6C9A8] transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to book list
          </button>
          <PreReadingScreen book={preReadingBook} onReady={handlePreReadingReady} />
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-8">
      {studentMode ? (
        <section className="hialice-hero mb-6 overflow-hidden p-5 sm:p-7">
          <div className="mx-auto max-w-4xl">
            <p className="hialice-eyebrow mb-2">Start</p>
            <h1 className="text-3xl font-extrabold leading-tight text-[#3D2E1E] sm:text-4xl">
              Tell me the book you read.
            </h1>
            <p className="hialice-support-copy mt-3 max-w-2xl text-sm sm:text-base">
              You can say the title out loud or type it. I will help you find the right book and move you into the worksheet.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="hialice-section-chip">1. Say the title</span>
              <span className="hialice-section-chip">2. Check the match</span>
              <span className="hialice-section-chip">3. Start the worksheet</span>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr,0.9fr]">
              <div className="hialice-panel p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F5E8] text-2xl">🎤</div>
                  <div>
                    <p className="text-sm font-extrabold text-[#3D2E1E]">Step 1. Say the book title</p>
                    <p className="text-xs font-semibold text-[#6B5744]">Example: “I read Charlotte&apos;s Web.”</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col items-center gap-3">
                  <VoiceButton
                    isListening={isListening}
                    onStart={handleVoiceSearch}
                    onStop={handleVoiceSearch}
                    size={96}
                    disabled={loading || !supported}
                  />
                  <p className="text-base font-extrabold text-[#5C8B5C]">
                    {isListening ? 'I am listening...' : 'Tap to speak'}
                  </p>
                  <div className="relative w-full">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C8B74] pointer-events-none" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    </span>
                    <input
                      id="book-search"
                      type="text"
                      placeholder="Or type the book title here"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-2xl border border-[#D6C9A8] bg-[#FFFCF3] pl-10 pr-10 py-3 text-[#3D2E1E] font-semibold focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#5C8B5C]"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-[#D6C9A8]/50 text-[#6B5744] hover:bg-[#D6C9A8] transition-colors"
                        aria-label="Clear search"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>
                  {transcript && (
                    <div className="w-full rounded-2xl border border-[#C8E6C9] bg-[#E8F5E8] px-4 py-3 text-sm font-semibold text-[#3D2E1E]">
                      I heard: <span className="font-extrabold">{transcript}</span>
                    </div>
                  )}
                  {!supported && (
                    <p className="text-xs font-semibold text-[#A8822E]">
                      Voice input is not supported here, so text search is being used.
                    </p>
                  )}
                </div>
              </div>

              <div className="hialice-panel p-5">
                <p className="text-sm font-extrabold text-[#3D2E1E]">Step 2. Check the book</p>
                <p className="mt-1 text-xs font-semibold text-[#6B5744]">
                  I will show the closest match first. If it looks right, you can start the worksheet right away.
                </p>

                {exactVoiceMatch ? (
                  <div className="mt-4 rounded-3xl border border-[#E8DEC8] bg-[#FFFCF3] p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E8F5E8] text-4xl">
                        {exactVoiceMatch.coverEmoji || exactVoiceMatch.cover}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#D4A843]">Best Match</p>
                        <p className="mt-1 text-lg font-extrabold text-[#3D2E1E]">{exactVoiceMatch.title}</p>
                        <p className="text-sm font-semibold text-[#6B5744]">{exactVoiceMatch.author}</p>
                        <p className="mt-2 text-sm font-semibold text-[#6B5744]">{exactVoiceMatch.curiosityHook}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <button
                        onClick={() => handleBookClick(exactVoiceMatch.id, exactVoiceMatch.title)}
                        className="min-h-[48px] rounded-2xl bg-[#5C8B5C] px-4 py-3 text-sm font-extrabold text-white shadow-[0_4px_12px_rgba(92,139,92,0.28)] transition-all hover:-translate-y-0.5"
                      >
                        Yes, I read this book
                      </button>
                      <button
                        onClick={() => setSearchTerm('')}
                        className="min-h-[48px] rounded-2xl bg-[#EDE5D4] px-4 py-3 text-sm font-extrabold text-[#6B5744] transition-all hover:-translate-y-0.5"
                      >
                        Search again
                      </button>
                    </div>
                  </div>
                ) : searchTerm.trim() && filteredBooks.length === 0 ? (
                  <div className="mt-4 rounded-3xl border border-dashed border-[#D4736B]/30 bg-[#FFF5F3] p-5 text-center">
                    <p className="text-sm font-bold text-[#6B5744] mb-3">
                      No books found for &quot;{searchTerm}&quot;
                    </p>
                    <button
                      onClick={() => setSearchTerm('')}
                      className="min-h-[44px] px-5 py-2 rounded-2xl bg-[#EDE5D4] text-sm font-bold text-[#6B5744] hover:bg-[#D6C9A8] transition-all"
                    >
                      Clear and try again
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-3xl border border-dashed border-[#D6C9A8] bg-[#FFFDF7] p-5">
                    <p className="text-sm font-bold text-[#6B5744]">
                      Say the title and I will show the best match here.
                    </p>
                  </div>
                )}

                {topVoiceMatches.length > 1 && (
                  <div className="mt-4">
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#5C8B5C]">
                      Other close matches
                    </p>
                    <div className="mt-2 space-y-2">
                      {topVoiceMatches.slice(1).map((book) => (
                        <button
                          key={`voice-match-${book.id}`}
                          onClick={() => handleBookClick(book.id, book.title)}
                          className="flex w-full items-center gap-3 rounded-2xl border border-[#E8DEC8] bg-[#FFFCF3] px-4 py-3 text-left transition-all hover:-translate-y-0.5"
                        >
                          <span className="text-2xl">{book.coverEmoji || book.cover}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-extrabold text-[#3D2E1E]">{book.title}</span>
                            <span className="block truncate text-xs font-semibold text-[#6B5744]">{book.author}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {!voiceSearchPromptDismissed && (
              <div className="hialice-soft-note mt-4 flex items-start justify-between gap-3 px-4 py-3">
                <p className="text-sm font-semibold leading-6 text-[#6B5744]">
                  Student-friendly flow: login, say the title, confirm the book, then begin the worksheet.
                </p>
                <button
                  onClick={() => setVoiceSearchPromptDismissed(true)}
                  className="rounded-full bg-[#EDE5D4] px-3 py-1 text-xs font-bold text-[#6B5744]"
                >
                  Hide
                </button>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="hialice-hero mb-6 overflow-hidden p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr] lg:items-center">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.2em] text-[#5C8B5C]">
              Story Discovery Lab
            </p>
            <h1 className="max-w-2xl text-3xl font-extrabold leading-tight text-[#3D2E1E] sm:text-4xl">
              아이가 읽은 책을 더 쉽게 찾고, 더 궁금해지게 만드는 책 놀이터
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#6B5744] sm:text-base">
              지금은 실제 책 검색 DB가 부족해도, 제목·주제·감정 키워드 기반 목업 카탈로그로 바로 탐색할 수 있게 바꿨습니다.
              각 책은 아이 호기심을 자극하는 `curiosityHook`과 애니메이션 무드 정보까지 포함해 다음 단계 이미지/모션 작업에 연결됩니다.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {DISCOVERY_FILTERS.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setDiscoveryFilter(filter)}
                  className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-bold transition-all ${
                    discoveryFilter === filter
                      ? 'bg-[#5C8B5C] text-white shadow-[0_6px_18px_rgba(92,139,92,0.28)]'
                      : 'bg-white/75 text-[#6B5744] hover:bg-[#FFFCF3]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {featuredBooks.map((book, index) => (
              <button
                key={book.id}
                onClick={() => handleBookClick(book.id, book.title)}
                className="rounded-2xl border border-white/60 bg-white/70 p-4 text-left shadow-[0_6px_18px_rgba(61,46,30,0.08)] transition-all hover:-translate-y-1"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#D4A843]">
                      Pick {index + 1}
                    </p>
                    <p className="mt-1 text-base font-extrabold text-[#3D2E1E]">{book.title}</p>
                    <p className="mt-1 text-xs font-semibold text-[#6B5744]">{book.curiosityHook}</p>
                  </div>
                  <span className="text-3xl" aria-hidden="true">{book.coverEmoji || book.cover}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        </section>
      )}

      {/* 3-Step Flow Indicator */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold" aria-label="How it works: 3 steps">
        <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 bg-[#5C8B5C] text-white rounded-full shadow-sm">
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-extrabold flex-shrink-0" aria-hidden="true">1</span>
          <span className="hidden sm:inline">{studentMode ? 'Say the book name' : 'Choose a book you&apos;ve read'}</span>
          <span className="sm:hidden">{studentMode ? 'Say' : 'Choose'}</span>
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
          <span className="hidden sm:inline">{studentMode ? 'Start your worksheet' : 'Get your worksheet'}</span>
          <span className="sm:hidden">Worksheet</span>
        </div>
      </div>


      {/* PRIORITY: Continue Review — top of page before any controls */}
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
