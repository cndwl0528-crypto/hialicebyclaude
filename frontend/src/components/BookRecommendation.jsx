'use client';
import { useState, useEffect } from 'react';
import BookCoverIllustration from './BookCoverIllustration';
import { getItem } from '@/lib/clientStorage';

const STATIC_RECOMMENDATIONS = {
  beginner: [
    { id: 'rec-beg-1', title: 'Where the Wild Things Are', author: 'Maurice Sendak', cover: '👹', level: 'beginner', reason: 'Great for imagination!', rating: 4.7 },
    { id: 'rec-beg-2', title: 'Goodnight Moon', author: 'Margaret Wise Brown', cover: '🌙', level: 'beginner', reason: 'Perfect bedtime story!', rating: 4.6 },
    { id: 'rec-beg-3', title: 'The Very Lonely Firefly', author: 'Eric Carle', cover: '✨', level: 'beginner', reason: 'Beautiful and warm!', rating: 4.5 },
  ],
  intermediate: [
    { id: 'rec-int-1', title: 'The Magic Treehouse: Dinosaurs Before Dark', author: 'Mary Pope Osborne', cover: '🦕', level: 'intermediate', reason: 'Adventure awaits!', rating: 4.6 },
    { id: 'rec-int-2', title: 'Diary of a Wimpy Kid', author: 'Jeff Kinney', cover: '📓', level: 'intermediate', reason: 'Super funny!', rating: 4.5 },
    { id: 'rec-int-3', title: 'Matilda', author: 'Roald Dahl', cover: '📖', level: 'intermediate', reason: "You'll LOVE Matilda!", rating: 4.7 },
  ],
  advanced: [
    { id: 'rec-adv-1', title: 'The Giver', author: 'Lois Lowry', cover: '🌈', level: 'advanced', reason: 'Makes you think!', rating: 4.6 },
    { id: 'rec-adv-2', title: 'Wonder', author: 'R.J. Palacio', cover: '⭐', level: 'advanced', reason: 'Teaches kindness!', rating: 4.8 },
    { id: 'rec-adv-3', title: 'Percy Jackson and the Lightning Thief', author: 'Rick Riordan', cover: '⚡', level: 'advanced', reason: 'Epic adventure!', rating: 4.7 },
  ],
};

const MAX_VISIBLE = 3;

async function fetchRecommendations(studentId, studentLevel) {
  if (!studentId) return null;
  if (typeof window === 'undefined') return null;

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const token = getItem('token') || '';
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
    return null;
  }
}

function normaliseApiBook(book) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    cover: book.cover_emoji || '📚',
    level: book.level,
    reason: book.moral_lesson || book.description || 'A great read!',
    rating: book.rating || null,
  };
}

function MiniStarRating({ rating }) {
  if (!rating) return null;
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.3;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  return (
    <span className="star-rating text-[10px]" aria-label={`${rating.toFixed(1)} out of 5 stars`} role="img">
      {'★'.repeat(full)}
      {hasHalf && (
        <span className="relative inline-block" style={{ width: '0.5em' }}>
          <span className="text-[#EDE5D4]">★</span>
          <span className="absolute left-0 top-0 overflow-hidden" style={{ width: '50%' }}>★</span>
        </span>
      )}
      <span className="text-[#EDE5D4]">{'★'.repeat(empty)}</span>
      {' '}
      <span className="text-[#5D4037]">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function BookRecommendation({
  currentBook = null,
  studentId = null,
  studentLevel = 'intermediate',
  onSelectBook,
  excludeBookIds = [],
}) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const levelKey = (studentLevel || 'intermediate').toLowerCase();

    async function load() {
      setLoading(true);
      const apiBooks = await fetchRecommendations(studentId, levelKey);
      if (cancelled) return;

      let books;
      if (apiBooks && apiBooks.length > 0) {
        books = apiBooks.map(normaliseApiBook);
      } else {
        books = STATIC_RECOMMENDATIONS[levelKey] ?? STATIC_RECOMMENDATIONS.intermediate;
      }

      // Filter out current book and any books already visible in the grid
      const filtered = books.filter((b) => {
        if (currentBook && (b.title === currentBook.title || b.id === currentBook.id)) return false;
        if (excludeBookIds.length > 0 && excludeBookIds.includes(b.id)) return false;
        return true;
      });

      if (!cancelled) {
        setRecommendations(filtered.slice(0, MAX_VISIBLE));
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [currentBook, studentId, studentLevel, excludeBookIds]);

  if (loading) {
    return (
      <div className="mt-6">
        <h3 className="text-lg font-bold text-[#3D2E1E] mb-3 flex items-center gap-2">
          <span role="img" aria-label="books">📚</span> What to Read Next?
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/80 rounded-2xl border border-[#E8DEC8] p-4 h-20 animate-pulse" aria-hidden="true" />
          ))}
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) return null;

  return (
    <section className="mt-6" aria-labelledby="recommendations-heading">
      <h3 id="recommendations-heading" className="text-lg font-bold text-[#3D2E1E] mb-3 flex items-center gap-2">
        <span role="img" aria-label="books">📚</span> What to Read Next?
      </h3>

      <ul className="grid grid-cols-1 gap-3">
        {recommendations.map((book) => (
          <li key={book.id}>
            <button
              className="w-full bg-white/80 backdrop-blur-sm rounded-2xl border border-[#E8DEC8] shadow-sm p-3 flex items-center gap-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 active:scale-[0.98] text-left"
              onClick={() => onSelectBook?.(book)}
              aria-label={`Review next: ${book.title} by ${book.author}`}
            >
              {/* Mini book cover — no SVG text overlay at this size */}
              <div className="flex-shrink-0 w-14 h-[72px] rounded-md overflow-hidden shadow-sm border border-[#E8DEC8]">
                <BookCoverIllustration book={book} className="w-full h-full" />
              </div>

              {/* Book info */}
              <div className="flex-1 min-w-0">
                <p className="font-serif font-bold text-[#3D2E1E] text-sm truncate leading-snug">
                  {book.title}
                </p>
                <p className="text-xs text-[#6B5744] mt-0.5">{book.author}</p>
                <div className="flex items-center gap-2 mt-1">
                  <MiniStarRating rating={book.rating} />
                </div>
                <p className="text-xs text-[#5C8B5C] mt-0.5 font-semibold truncate">
                  {book.reason}
                </p>
              </div>

              {/* Chevron */}
              <div className="text-[#5C8B5C] text-xl flex-shrink-0" aria-hidden="true">→</div>
            </button>
          </li>
        ))}
      </ul>

      <p className="text-center text-xs text-[#6B5744] mt-3">
        Tap a book to start your review!
      </p>
    </section>
  );
}
