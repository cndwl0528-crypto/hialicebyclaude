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
  const [books, setBooks] = useState(MOCK_BOOKS);
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [filteredBooks, setFilteredBooks] = useState(MOCK_BOOKS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const filtered =
      selectedLevel === 'All'
        ? books
        : books.filter((book) => book.level === selectedLevel);
    setFilteredBooks(filtered);
  }, [selectedLevel, books]);

  const handleSelectBook = (bookId) => {
    sessionStorage.setItem('selectedBook', JSON.stringify(bookId));
    router.push(`/session?bookId=${bookId}`);
  };

  const LEVEL_COLORS = {
    Beginner: 'bg-pink-100 text-pink-700 border-pink-300',
    Intermediate: 'bg-blue-100 text-blue-700 border-blue-300',
    Advanced: 'bg-green-100 text-green-700 border-green-300',
  };

  return (
    <div className="py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Select a Book</h2>

        <div className="flex gap-3 flex-wrap">
          {LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              className={`px-6 py-2 rounded-full font-semibold transition-smooth ${
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBooks.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onClick={() => handleSelectBook(book.id)}
          />
        ))}
      </div>

      {filteredBooks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No books found in this level.</p>
        </div>
      )}
    </div>
  );
}
