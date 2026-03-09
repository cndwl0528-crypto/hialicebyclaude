'use client';
import { useState, useEffect } from 'react';

/**
 * Static recommendation catalogue keyed by student level (lowercase).
 * Each entry provides enough data to render a card and navigate to the session.
 * Replace or supplement with an API call to GET /api/books/recommendations/:studentId
 * when the backend is available.
 */
const STATIC_RECOMMENDATIONS = {
  beginner: [
    {
      id: 'rec-beg-1',
      title: 'Where the Wild Things Are',
      author: 'Maurice Sendak',
      emoji: '👹',
      level: 'beginner',
      reason: 'Great for imagination!',
    },
    {
      id: 'rec-beg-2',
      title: 'Goodnight Moon',
      author: 'Margaret Wise Brown',
      emoji: '🌙',
      level: 'beginner',
      reason: 'Perfect bedtime story!',
    },
    {
      id: 'rec-beg-3',
      title: 'The Very Lonely Firefly',
      author: 'Eric Carle',
      emoji: '✨',
      level: 'beginner',
      reason: 'Beautiful and warm!',
    },
  ],
  intermediate: [
    {
      id: 'rec-int-1',
      title: 'The Magic Treehouse: Dinosaurs Before Dark',
      author: 'Mary Pope Osborne',
      emoji: '🦕',
      level: 'intermediate',
      reason: 'Adventure awaits!',
    },
    {
      id: 'rec-int-2',
      title: 'Diary of a Wimpy Kid',
      author: 'Jeff Kinney',
      emoji: '📓',
      level: 'intermediate',
      reason: 'Super funny!',
    },
    {
      id: 'rec-int-3',
      title: 'Matilda',
      author: 'Roald Dahl',
      emoji: '📖',
      level: 'intermediate',
      reason: "You'll LOVE Matilda!",
    },
  ],
  advanced: [
    {
      id: 'rec-adv-1',
      title: 'The Giver',
      author: 'Lois Lowry',
      emoji: '🌈',
      level: 'advanced',
      reason: 'Makes you think!',
    },
    {
      id: 'rec-adv-2',
      title: 'Wonder',
      author: 'R.J. Palacio',
      emoji: '⭐',
      level: 'advanced',
      reason: 'Teaches kindness!',
    },
    {
      id: 'rec-adv-3',
      title: 'Percy Jackson and the Lightning Thief',
      author: 'Rick Riordan',
      emoji: '⚡',
      level: 'advanced',
      reason: 'Epic adventure!',
    },
  ],
};

/** Maximum number of recommendations to display at once */
const MAX_VISIBLE = 3;

/**
 * Attempts to fetch personalized recommendations from the backend.
 * Falls back to the static catalogue on any failure.
 *
 * @param {string} studentId
 * @param {string} studentLevel - 'beginner' | 'intermediate' | 'advanced'
 * @returns {Promise<Array<Object>>}
 */
async function fetchRecommendations(studentId, studentLevel) {
  if (!studentId) return null; // Signal to caller: use static data

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const token = sessionStorage.getItem('authToken') || '';
    const response = await fetch(
      `${apiUrl}/api/books/recommendations/${studentId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.recommendations ?? null;
  } catch {
    return null; // Fall through to static data
  }
}

/**
 * Normalises a book object returned from the API so it matches the shape
 * expected by the card renderer (which was designed around the static catalogue).
 *
 * @param {Object} book - Raw book from API
 * @returns {Object}
 */
function normaliseApiBook(book) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    emoji: book.cover_emoji || '📚',
    level: book.level,
    reason: book.moral_lesson || book.description || 'A great read!',
  };
}

/**
 * BookRecommendation
 *
 * Displays up to 3 level-appropriate "What to Read Next" cards.
 * First attempts a live API fetch; falls back to the static catalogue
 * so the section always renders content regardless of network state.
 *
 * Props:
 *   currentBook   {Object|null}  — current book (filtered from recommendations)
 *   studentId     {string|null}  — used for personalised API fetch
 *   studentLevel  {string}       — 'Beginner' | 'Intermediate' | 'Advanced' (case-insensitive)
 *   onSelectBook  {Function}     — called with the selected book object
 */
export default function BookRecommendation({
  currentBook = null,
  studentId = null,
  studentLevel = 'intermediate',
  onSelectBook,
}) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const levelKey = (studentLevel || 'intermediate').toLowerCase();

    async function load() {
      setLoading(true);

      // 1. Try live API
      const apiBooks = await fetchRecommendations(studentId, levelKey);
      if (cancelled) return;

      let books;
      if (apiBooks && apiBooks.length > 0) {
        books = apiBooks.map(normaliseApiBook);
      } else {
        // 2. Fall back to static catalogue; default to intermediate
        books = STATIC_RECOMMENDATIONS[levelKey] ?? STATIC_RECOMMENDATIONS.intermediate;
      }

      // Filter out the book the student is currently reviewing
      const filtered = currentBook
        ? books.filter((b) => b.title !== currentBook.title && b.id !== currentBook.id)
        : books;

      if (!cancelled) {
        setRecommendations(filtered.slice(0, MAX_VISIBLE));
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [currentBook, studentId, studentLevel]);

  if (loading) {
    return (
      <div className="mt-6">
        <h3 className="text-lg font-bold text-[#2C4A2E] mb-3 flex items-center gap-2">
          <span role="img" aria-label="books">📚</span> What to Read Next?
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white/80 rounded-2xl border border-[#E8DEC8] p-4 h-20 animate-pulse"
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) return null;

  return (
    <section className="mt-6" aria-labelledby="recommendations-heading">
      <h3
        id="recommendations-heading"
        className="text-lg font-bold text-[#2C4A2E] mb-3 flex items-center gap-2"
      >
        <span role="img" aria-label="books">📚</span> What to Read Next?
      </h3>

      <div className="grid grid-cols-1 gap-3" role="list">
        {recommendations.map((book) => (
          <div
            key={book.id}
            className="bg-white/80 backdrop-blur-sm rounded-2xl border border-[#E8DEC8] shadow-sm p-4 flex items-center gap-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 active:scale-[0.98]"
            onClick={() => onSelectBook?.(book)}
            role="listitem button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectBook?.(book);
              }
            }}
            aria-label={`Read next: ${book.title} by ${book.author}`}
          >
            {/* Book emoji cover */}
            <div
              className="text-4xl flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-[#A8DAEA] to-[#C8E6C9] flex items-center justify-center"
              role="img"
              aria-hidden="true"
            >
              {book.emoji}
            </div>

            {/* Book info */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#2C4A2E] text-sm truncate leading-snug">
                {book.title}
              </p>
              <p className="text-xs text-[#6B7280] mt-0.5">{book.author}</p>
              <p className="text-xs text-[#4A7C59] mt-1 font-semibold">
                ✨ {book.reason}
              </p>
            </div>

            {/* Chevron */}
            <div className="text-[#4A7C59] text-xl flex-shrink-0" aria-hidden="true">
              →
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-[#9CA3AF] mt-3">
        Tap a book to start reading! 📖
      </p>
    </section>
  );
}
