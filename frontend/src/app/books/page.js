'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import BookCard from '@/components/BookCard';
import BookRecommendation from '@/components/BookRecommendation';
import BookCoverIllustration from '@/components/BookCoverIllustration';
import { getBooks as fetchBooksApi, startSession } from '@/services/api';

const MOCK_BOOKS = [
  {
    id: 1,
    title: 'The Very Hungry Caterpillar',
    author: 'Eric Carle',
    level: 'Beginner',
    genre: 'Picture Book',
    cover: '🐛',
    description: 'A tiny caterpillar eats his way through a week of food.',
  },
  {
    id: 2,
    title: 'Where the Wild Things Are',
    author: 'Maurice Sendak',
    level: 'Beginner',
    genre: 'Picture Book',
    cover: '👹',
    description: 'Max sails away to an island of wild creatures.',
  },
  {
    id: 3,
    title: "Charlotte's Web",
    author: 'E.B. White',
    level: 'Intermediate',
    genre: 'Chapter Book',
    cover: '🕷️',
    description: 'A pig and a spider form an unforgettable friendship.',
  },
  {
    id: 4,
    title: 'The Lion, the Witch and the Wardrobe',
    author: 'C.S. Lewis',
    level: 'Intermediate',
    genre: 'Fantasy',
    cover: '🦁',
    description: 'Children discover a magical world inside a wardrobe.',
  },
  {
    id: 5,
    title: 'Magic Tree House: Dinosaurs Before Dark',
    author: 'Mary Pope Osborne',
    level: 'Intermediate',
    genre: 'Adventure',
    cover: '🌳',
    description: 'Jack and Annie travel back to the time of dinosaurs.',
  },
  {
    id: 6,
    title: 'A Wrinkle in Time',
    author: "Madeleine L'Engle",
    level: 'Advanced',
    genre: 'Science Fiction',
    cover: '⭐',
    description: 'A girl searches for her missing father across the universe.',
  },
  {
    id: 7,
    title: 'Inkheart',
    author: 'Cornelia Funke',
    level: 'Advanced',
    genre: 'Fantasy',
    cover: '📖',
    description: 'A girl discovers her father can read fictional characters into reality.',
  },
  {
    id: 8,
    title: 'The Book Thief',
    author: 'Markus Zusak',
    level: 'Advanced',
    genre: 'Historical Fiction',
    cover: '📚',
    description: 'A girl steals books and shares them during wartime.',
  },
  {
    id: 9,
    title: 'Winnie-the-Pooh',
    author: 'A.A. Milne',
    level: 'Beginner',
    genre: 'Picture Book',
    cover: '🐻',
    description: 'The adventures of a lovable bear and his friends.',
  },
  {
    id: 10,
    title: 'Matilda',
    author: 'Roald Dahl',
    level: 'Intermediate',
    genre: 'Fiction',
    cover: '👧',
    description: 'A young genius girl discovers she has telekinetic powers.',
  },
];

const CEFR_TO_DISPLAY = {
  A1: 'Beginner',
  A2: 'Beginner',
  B1: 'Intermediate',
  B2: 'Intermediate',
  C1: 'Advanced',
  C2: 'Advanced',
};

function getDisplayLevel(level) {
  if (!level) return 'Beginner';
  if (CEFR_TO_DISPLAY[level]) return CEFR_TO_DISPLAY[level];
  // Normalize lowercase API levels → capitalized display levels
  const capitalized = level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
  if (['Beginner', 'Intermediate', 'Advanced'].includes(capitalized)) return capitalized;
  return level;
}

const LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced'];

const LEVEL_FILTER_STYLES = {
  All: { active: 'bg-[#5C8B5C] text-white shadow-[0_2px_8px_rgba(92,139,92,0.3)]', inactive: 'bg-[#EDE5D4] text-[#3D2E1E] hover:bg-[#D6C9A8]' },
  Beginner: { active: 'bg-[#C8E6C9] text-[#2E7D32] border-2 border-[#7AC87A]', inactive: 'bg-[#EDE5D4] text-[#3D2E1E] hover:bg-[#D6C9A8]' },
  Intermediate: { active: 'bg-[#FFE0B2] text-[#E65100] border-2 border-[#D4A843]', inactive: 'bg-[#EDE5D4] text-[#3D2E1E] hover:bg-[#D6C9A8]' },
  Advanced: { active: 'bg-[#E1BEE7] text-[#6A1B9A] border-2 border-[#C8A0D0]', inactive: 'bg-[#EDE5D4] text-[#3D2E1E] hover:bg-[#D6C9A8]' },
};

const LEVEL_BADGE_STYLES = {
  Beginner: 'bg-[#C8E6C9] text-[#2E7D32]',
  Intermediate: 'bg-[#FFE0B2] text-[#E65100]',
  Advanced: 'bg-[#E1BEE7] text-[#6A1B9A]',
  A1: 'bg-[#C8E6C9] text-[#2E7D32]',
  A2: 'bg-[#C8E6C9] text-[#2E7D32]',
  B1: 'bg-[#FFE0B2] text-[#E65100]',
  B2: 'bg-[#FFE0B2] text-[#E65100]',
  C1: 'bg-[#E1BEE7] text-[#6A1B9A]',
  C2: 'bg-[#E1BEE7] text-[#6A1B9A]',
};

export default function BooksPage() {
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [studentLevel, setStudentLevel] = useState('All');
  const [studentId, setStudentId] = useState(null);
  const [error, setError] = useState('');

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
        }

        // Use api.js client (includes auth token + timeout + error handling)
        const data = await fetchBooksApi(storedLevel);
        setBooks(data.books || MOCK_BOOKS);
        setError('');
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

  const handleSelectBook = async (bookId, bookTitle) => {
    // Cache book info for fallback
    sessionStorage.setItem('bookId', bookId);
    sessionStorage.setItem('bookTitle', bookTitle);

    // Create a real session via API (so session/page.js doesn't need to create one)
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
  };

  return (
    <div className="py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-[#3D2E1E] mb-1">Select a Book</h2>
        <p className="text-[#6B5744] font-semibold mb-6">
          {studentLevel !== 'All' && `Recommended for ${studentLevel} level`}
        </p>

        {/* Search Bar */}
        <div className="mb-5">
          <input
            type="text"
            placeholder="Search by title, author, or genre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-[#D6C9A8] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] focus:border-transparent bg-[#FFFCF3] text-[#3D2E1E] font-semibold shadow-[0_2px_8px_rgba(61,46,30,0.06)]"
          />
        </div>

        {/* Level Filter Buttons */}
        <div className="flex gap-2 flex-wrap">
          {LEVELS.map((level) => {
            const styles = LEVEL_FILTER_STYLES[level] || LEVEL_FILTER_STYLES['All'];
            return (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`px-5 py-2 rounded-2xl font-bold transition-all hover:-translate-y-0.5 ${
                  selectedLevel === level ? styles.active : styles.inactive
                }`}
              >
                {level}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <div className="text-4xl mb-3 float-animation inline-block">🌿</div>
            <p className="text-[#6B5744] font-bold text-lg">Loading books...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onClick={() => handleSelectBook(book.id, book.title)}
              />
            ))}
          </div>

          {filteredBooks.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🌿</div>
              <p className="text-[#6B5744] font-bold text-lg">No books found. Try adjusting your filters.</p>
            </div>
          )}
        </>
      )}

      {/* What to Read Next — shown when a student level is known */}
      {studentLevel !== 'All' && !loading && (
        <div className="mt-10 pt-8 border-t border-[#E8DEC8]">
          <BookRecommendation
            studentId={studentId}
            studentLevel={studentLevel}
            onSelectBook={(book) => handleSelectBook(book.id, book.title)}
          />
        </div>
      )}
    </div>
  );
}
