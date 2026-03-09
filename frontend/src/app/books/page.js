'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BookCard from '@/components/BookCard';

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
    title: 'Charlotte\'s Web',
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
    author: 'Madeleine L\'Engle',
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

const LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced'];

export default function BooksPage() {
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [studentLevel, setStudentLevel] = useState('All');
  const [error, setError] = useState('');

  // Fetch books on component mount
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoading(true);
        
        // Read student level from sessionStorage
        const storedLevel = sessionStorage.getItem('studentLevel');
        if (storedLevel) {
          setStudentLevel(storedLevel);
          setSelectedLevel(storedLevel);
        }

        // Try to fetch from API
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(
          `${apiUrl}/api/books${storedLevel ? `?level=${storedLevel}` : ''}`,
          { signal: AbortSignal.timeout(5000) }
        );

        if (response.ok) {
          const data = await response.json();
          setBooks(data.books || MOCK_BOOKS);
          setError('');
        } else {
          // Fall back to mock data if API fails
          setBooks(MOCK_BOOKS);
        }
      } catch (err) {
        console.warn('Failed to fetch books from API, using mock data:', err);
        setBooks(MOCK_BOOKS);
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, []);

  // Filter books by level and search term
  useEffect(() => {
    let filtered = books;

    if (selectedLevel !== 'All') {
      filtered = filtered.filter((book) => book.level === selectedLevel);
    }

    if (searchTerm.trim()) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (book) =>
          book.title.toLowerCase().includes(lowerSearchTerm) ||
          book.author.toLowerCase().includes(lowerSearchTerm) ||
          book.genre.toLowerCase().includes(lowerSearchTerm)
      );
    }

    setFilteredBooks(filtered);
  }, [selectedLevel, searchTerm, books]);

  const handleSelectBook = (bookId, bookTitle) => {
    // Save book data to sessionStorage
    sessionStorage.setItem('bookId', bookId);
    sessionStorage.setItem('bookTitle', bookTitle);
    sessionStorage.setItem('sessionId', 'session-' + Date.now());
    
    router.push(`/session?bookId=${bookId}&bookTitle=${encodeURIComponent(bookTitle)}`);
  };

  const LEVEL_COLORS = {
    Beginner: 'bg-pink-100 text-pink-700 border-pink-300',
    Intermediate: 'bg-blue-100 text-blue-700 border-blue-300',
    Advanced: 'bg-green-100 text-green-700 border-green-300',
  };

  return (
    <div className="py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Select a Book</h2>
        <p className="text-gray-600 mb-6">
          {studentLevel !== 'All' && `Recommended for ${studentLevel} level`}
        </p>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by title, author, or genre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Level Filter */}
        <div className="flex gap-3 flex-wrap">
          {LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              className={`px-6 py-2 rounded-full font-semibold transition-all ${
                selectedLevel === level
                  ? `${LEVEL_COLORS[level] || 'bg-gray-300 text-gray-700'} border-2`
                  : 'bg-gray-200 text-gray-700 border-2 border-gray-300 hover:bg-gray-300'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <p className="text-gray-500 text-lg">Loading books...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBooks.map((book) => (
              <div
                key={book.id}
                onClick={() => handleSelectBook(book.id, book.title)}
                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-200 transform hover:scale-105 cursor-pointer overflow-hidden"
              >
                <div className="p-6">
                  <div className="text-6xl mb-4 text-center">{book.cover}</div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2 line-clamp-2">
                    {book.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3">{book.author}</p>
                  <p className="text-gray-700 text-sm mb-4 line-clamp-2">
                    {book.description}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        LEVEL_COLORS[book.level] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {book.level}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                      {book.genre}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredBooks.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No books found. Try adjusting your filters.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
