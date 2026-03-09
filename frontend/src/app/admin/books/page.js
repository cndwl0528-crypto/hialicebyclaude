'use client';

import { useState, useEffect } from 'react';

// Mock data
const MOCK_BOOKS = [
  {
    id: 1,
    title: 'The Very Hungry Caterpillar',
    author: 'Eric Carle',
    level: 'Beginner',
    genre: 'Picture Book',
    emoji: '🐛',
    description: 'A tiny caterpillar eats his way through a week of food.',
    sessionsCount: 15,
  },
  {
    id: 2,
    title: 'Where the Wild Things Are',
    author: 'Maurice Sendak',
    level: 'Beginner',
    genre: 'Picture Book',
    emoji: '👹',
    description: 'Max sails away to an island of wild creatures.',
    sessionsCount: 12,
  },
  {
    id: 3,
    title: 'Charlotte\'s Web',
    author: 'E.B. White',
    level: 'Intermediate',
    genre: 'Chapter Book',
    emoji: '🕷️',
    description: 'A pig and a spider form an unforgettable friendship.',
    sessionsCount: 18,
  },
  {
    id: 4,
    title: 'The Lion, the Witch and the Wardrobe',
    author: 'C.S. Lewis',
    level: 'Intermediate',
    genre: 'Fantasy',
    emoji: '🦁',
    description: 'Children discover a magical world inside a wardrobe.',
    sessionsCount: 14,
  },
  {
    id: 5,
    title: 'A Wrinkle in Time',
    author: 'Madeleine L\'Engle',
    level: 'Advanced',
    genre: 'Science Fiction',
    emoji: '⭐',
    description: 'A girl searches for her missing father across the universe.',
    sessionsCount: 8,
  },
  {
    id: 6,
    title: 'Inkheart',
    author: 'Cornelia Funke',
    level: 'Advanced',
    genre: 'Fantasy',
    emoji: '📖',
    description: 'A girl discovers her father can read fictional characters into reality.',
    sessionsCount: 6,
  },
];

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const GENRES = ['Picture Book', 'Chapter Book', 'Fantasy', 'Adventure', 'Science Fiction', 'Historical Fiction'];

export default function BooksPage() {
  const [books, setBooks] = useState(MOCK_BOOKS);
  const [filteredBooks, setFilteredBooks] = useState(MOCK_BOOKS);
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editingBook, setEditingBook] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    level: 'Beginner',
    genre: 'Picture Book',
    emoji: '📚',
    description: '',
  });

  useEffect(() => {
    let filtered = books;

    if (selectedLevel !== 'All') {
      filtered = filtered.filter((b) => b.level === selectedLevel);
    }

    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.title.toLowerCase().includes(lower) ||
          b.author.toLowerCase().includes(lower) ||
          b.genre.toLowerCase().includes(lower)
      );
    }

    setFilteredBooks(filtered);
  }, [selectedLevel, searchTerm, books]);

  const handleAddBook = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.author) {
      alert('Please fill in title and author');
      return;
    }

    const newBook = {
      id: Math.max(...books.map((b) => b.id), 0) + 1,
      title: formData.title,
      author: formData.author,
      level: formData.level,
      genre: formData.genre,
      emoji: formData.emoji,
      description: formData.description,
      sessionsCount: 0,
    };

    setBooks([...books, newBook]);
    setFormData({
      title: '',
      author: '',
      level: 'Beginner',
      genre: 'Picture Book',
      emoji: '📚',
      description: '',
    });
    setShowAddForm(false);
  };

  const handleDeleteBook = (bookId) => {
    setBooks(books.filter((b) => b.id !== bookId));
    setDeleteConfirm(null);
  };

  const handleEditBook = (book) => {
    setEditingBook(book.id);
    setFormData({
      title: book.title,
      author: book.author,
      level: book.level,
      genre: book.genre,
      emoji: book.emoji,
      description: book.description,
    });
    setShowAddForm(true);
  };

  const handleUpdateBook = (e) => {
    e.preventDefault();
    setBooks(
      books.map((b) =>
        b.id === editingBook
          ? {
              ...b,
              title: formData.title,
              author: formData.author,
              level: formData.level,
              genre: formData.genre,
              emoji: formData.emoji,
              description: formData.description,
            }
          : b
      )
    );
    setFormData({
      title: '',
      author: '',
      level: 'Beginner',
      genre: 'Picture Book',
      emoji: '📚',
      description: '',
    });
    setShowAddForm(false);
    setEditingBook(null);
  };

  const LEVEL_COLORS = {
    Beginner: 'bg-green-100 text-green-700',
    Intermediate: 'bg-blue-100 text-blue-700',
    Advanced: 'bg-purple-100 text-purple-700',
  };

  const EMOJI_OPTIONS = ['📚', '🐛', '👹', '🕷️', '🦁', '🌳', '⭐', '📖', '✨', '🎭', '🗺️', '🔮', '🧙', '⚔️'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Book Management</h1>
        <button
          onClick={() => {
            setShowAddForm(true);
            setEditingBook(null);
            setFormData({
              title: '',
              author: '',
              level: 'Beginner',
              genre: 'Picture Book',
              emoji: '📚',
              description: '',
            });
          }}
          className="px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-semibold"
          style={{ minHeight: '48px' }}
        >
          ➕ Add New Book
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by title, author, or genre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['All', ...LEVELS].map((level) => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                selectedLevel === level
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              style={{ minHeight: '48px' }}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {editingBook ? 'Edit Book' : 'Add New Book'}
            </h2>

            <form
              onSubmit={editingBook ? handleUpdateBook : handleAddBook}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Book title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Author *
                  </label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Author name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Level
                  </label>
                  <select
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Genre
                  </label>
                  <select
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {GENRES.map((genre) => (
                      <option key={genre} value={genre}>
                        {genre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cover Emoji
                </label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setFormData({ ...formData, emoji: e })}
                      className={`text-3xl p-2 rounded-lg transition-all ${
                        formData.emoji === e
                          ? 'bg-blue-500 ring-2 ring-blue-700'
                          : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                      style={{ minHeight: '48px', minWidth: '48px' }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Book description"
                  rows="3"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all font-semibold"
                  style={{ minHeight: '48px' }}
                >
                  {editingBook ? 'Update' : 'Add'} Book
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingBook(null);
                    setFormData({
                      title: '',
                      author: '',
                      level: 'Beginner',
                      genre: 'Picture Book',
                      emoji: '📚',
                      description: '',
                    });
                  }}
                  className="flex-1 px-4 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all font-semibold"
                  style={{ minHeight: '48px' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Books Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200 bg-gray-50">
                <th className="text-left py-4 px-4 font-semibold text-gray-700">Title</th>
                <th className="text-left py-4 px-4 font-semibold text-gray-700">Author</th>
                <th className="text-left py-4 px-4 font-semibold text-gray-700">Level</th>
                <th className="text-left py-4 px-4 font-semibold text-gray-700">Genre</th>
                <th className="text-left py-4 px-4 font-semibold text-gray-700">Emoji</th>
                <th className="text-left py-4 px-4 font-semibold text-gray-700">Sessions</th>
                <th className="text-left py-4 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBooks.map((book) => (
                <tr
                  key={book.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-4 px-4 font-medium text-gray-800 max-w-xs truncate">
                    {book.title}
                  </td>
                  <td className="py-4 px-4 text-gray-700">{book.author}</td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        LEVEL_COLORS[book.level]
                      }`}
                    >
                      {book.level}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-gray-700 text-xs">{book.genre}</td>
                  <td className="py-4 px-4 text-2xl">{book.emoji}</td>
                  <td className="py-4 px-4 text-gray-700 font-medium">
                    {book.sessionsCount}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditBook(book)}
                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-all text-xs font-semibold"
                        style={{ minHeight: '36px' }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(book.id)}
                        className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-all text-xs font-semibold"
                        style={{ minHeight: '36px' }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredBooks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No books found</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Delete Book?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this book? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDeleteBook(deleteConfirm)}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all font-semibold"
                style={{ minHeight: '48px' }}
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all font-semibold"
                style={{ minHeight: '48px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
