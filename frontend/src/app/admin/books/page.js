'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ─── Constants ──────────────────────────────────────────────────────────────

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

const GENRES = [
  'Picture Book',
  'Chapter Book',
  'Fantasy',
  'Adventure',
  'Science Fiction',
  'Historical Fiction',
  'Mystery',
  'Non-Fiction',
  'Graphic Novel',
  'Poetry',
];

const EMOJI_OPTIONS = [
  '📚', '📖', '📝', '✏️', '🎭',
  '🐛', '👹', '🕷️', '🦁', '🐉',
  '🌳', '🌿', '🍀', '🌸', '🌙',
  '⭐', '✨', '🔮', '🗺️', '🏰',
  '🧙', '⚔️', '🦊', '🐻', '🦋',
  '🚀', '🌈', '🎪', '🎨', '🎵',
];

const LEVEL_BADGE = {
  Beginner: { bg: '#C8E6C9', text: '#2E7D32' },
  Intermediate: { bg: '#FFE0B2', text: '#E65100' },
  Advanced: { bg: '#E1BEE7', text: '#6A1B9A' },
};

const LEVEL_TAB_COLOR = {
  All: '#5C8B5C',
  Beginner: '#2E7D32',
  Intermediate: '#E65100',
  Advanced: '#6A1B9A',
};

const EMPTY_FORM = {
  title: '',
  author: '',
  level: 'Beginner',
  genre: 'Picture Book',
  cover_emoji: '📚',
  description: '',
  page_count: '',
  published_year: '',
};

// ─── Skeleton card component ─────────────────────────────────────────────────

function BookCardSkeleton() {
  return (
    <div className="bg-[#FFFCF3] rounded-2xl border border-[#E8DEC8] shadow-ghibli p-5 animate-pulse">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-16 h-16 rounded-xl bg-[#EDE5D4] flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-[#EDE5D4] rounded-lg w-3/4" />
          <div className="h-4 bg-[#EDE5D4] rounded-lg w-1/2" />
        </div>
      </div>
      <div className="h-4 bg-[#EDE5D4] rounded-lg w-full mb-2" />
      <div className="h-4 bg-[#EDE5D4] rounded-lg w-5/6 mb-4" />
      <div className="flex gap-2">
        <div className="h-6 bg-[#EDE5D4] rounded-full w-24" />
        <div className="h-6 bg-[#EDE5D4] rounded-full w-20" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminBooksPage() {
  // ── API helpers ──────────────────────────────────────────────────────────
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const getToken = () =>
    typeof window !== 'undefined' ? sessionStorage.getItem('authToken') : null;

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  });

  // ── State ────────────────────────────────────────────────────────────────
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  // Filter / search
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Add / edit modal
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Active toggle (per-book pending state)
  const [togglingId, setTogglingId] = useState(null);

  // ── Fetch books ──────────────────────────────────────────────────────────
  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetch(`${API}/api/admin/books`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Support { books } or { data: { books } } shapes
      setBooks(data.books || data.data?.books || []);
    } catch (err) {
      console.warn('Failed to fetch books:', err);
      setApiError('Could not load books. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [API]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // ── Derived filtered list ────────────────────────────────────────────────
  const filteredBooks = books.filter((b) => {
    const matchesLevel =
      selectedLevel === 'All' ||
      (b.level || '').toLowerCase() === selectedLevel.toLowerCase();
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      (b.title || '').toLowerCase().includes(term) ||
      (b.author || '').toLowerCase().includes(term);
    return matchesLevel && matchesSearch;
  });

  // ── Form helpers ─────────────────────────────────────────────────────────
  const openCreateForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (book) => {
    setEditingId(book.id);
    setForm({
      title: book.title || '',
      author: book.author || '',
      level: book.level || 'Beginner',
      genre: book.genre || 'Picture Book',
      cover_emoji: book.cover_emoji || '📚',
      description: book.description || '',
      page_count: book.page_count != null ? String(book.page_count) : '',
      published_year: book.published_year != null ? String(book.published_year) : '',
    });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // ── Save (create or update) ──────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();

    if (!form.title.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (!form.author.trim()) {
      setFormError('Author is required.');
      return;
    }
    if (form.page_count && (isNaN(Number(form.page_count)) || Number(form.page_count) < 1)) {
      setFormError('Page count must be a positive number.');
      return;
    }
    const currentYear = new Date().getFullYear();
    if (
      form.published_year &&
      (isNaN(Number(form.published_year)) ||
        Number(form.published_year) < 1000 ||
        Number(form.published_year) > currentYear)
    ) {
      setFormError(`Published year must be between 1000 and ${currentYear}.`);
      return;
    }

    setSaving(true);
    setFormError(null);

    const body = {
      title: form.title.trim(),
      author: form.author.trim(),
      level: form.level,
      genre: form.genre,
      cover_emoji: form.cover_emoji,
      description: form.description.trim(),
    };
    if (form.page_count) body.page_count = Number(form.page_count);
    if (form.published_year) body.published_year = Number(form.published_year);

    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId
        ? `${API}/api/admin/books/${editingId}`
        : `${API}/api/admin/books`;

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || `HTTP ${res.status}`);
      }

      closeForm();
      fetchBooks();
    } catch (err) {
      setFormError(err.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (bookId) => {
    setDeleting(true);
    try {
      const res = await fetch(`${API}/api/admin/books/${bookId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDeleteConfirm(null);
      fetchBooks();
    } catch (err) {
      console.warn('Delete failed:', err);
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  // ── Toggle active / inactive ─────────────────────────────────────────────
  const handleToggleActive = async (book) => {
    setTogglingId(book.id);
    try {
      const res = await fetch(`${API}/api/admin/books/${book.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ is_active: !book.is_active }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Optimistically update local state
      setBooks((prev) =>
        prev.map((b) => (b.id === book.id ? { ...b, is_active: !b.is_active } : b))
      );
    } catch (err) {
      console.warn('Toggle active failed:', err);
    } finally {
      setTogglingId(null);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const bookBeingDeleted = deleteConfirm
    ? books.find((b) => b.id === deleteConfirm)
    : null;

  // ────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#EDE5D4] hover:bg-[#D6C9A8] text-[#3D2E1E] transition-all font-bold"
            aria-label="Back to Admin Dashboard"
          >
            ←
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold text-[#3D2E1E]">Book Management</h1>
            <p className="text-sm text-[#9B8777] font-semibold mt-0.5">
              {books.length} book{books.length !== 1 ? 's' : ''} in library
            </p>
          </div>
        </div>

        <button
          onClick={openCreateForm}
          className="px-5 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] transition-all font-bold shadow-[0_2px_8px_rgba(61,107,61,0.3)] hover:-translate-y-0.5 flex items-center gap-2"
          style={{ minHeight: '48px' }}
        >
          <span aria-hidden="true">+</span>
          Add New Book
        </button>
      </div>

      {/* ── Filters row ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <span
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9B8777] pointer-events-none"
            aria-hidden="true"
          >
            🔍
          </span>
          <input
            type="text"
            placeholder="Search by title or author..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#FFFCF3] text-[#3D2E1E] placeholder-[#9B8777] font-semibold"
          />
        </div>

        {/* Level tabs */}
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter by level">
          {['All', ...LEVELS].map((level) => {
            const isActive = selectedLevel === level;
            return (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className="px-4 py-2 rounded-xl font-bold transition-all"
                style={{
                  minHeight: '48px',
                  backgroundColor: isActive ? LEVEL_TAB_COLOR[level] : '#EDE5D4',
                  color: isActive ? '#FFFFFF' : '#3D2E1E',
                }}
              >
                {level}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── API error banner ─────────────────────────────────────────────── */}
      {apiError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-semibold flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <span aria-hidden="true">⚠️</span>
            {apiError}
          </span>
          <button
            onClick={fetchBooks}
            className="text-red-700 underline underline-offset-2 hover:no-underline text-xs font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Book grid ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <BookCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredBooks.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 bg-[#FFFCF3] rounded-2xl border border-[#E8DEC8] shadow-ghibli">
          <span className="text-6xl mb-4 animate-float" aria-hidden="true">
            {searchTerm || selectedLevel !== 'All' ? '🔍' : '📚'}
          </span>
          <p className="text-xl font-extrabold text-[#3D2E1E] mb-2">
            {searchTerm || selectedLevel !== 'All' ? 'No books match your filters' : 'No books yet'}
          </p>
          <p className="text-[#9B8777] font-semibold mb-6 text-center max-w-xs">
            {searchTerm || selectedLevel !== 'All'
              ? 'Try adjusting your search or level filter.'
              : 'Add your first book to get started!'}
          </p>
          {!searchTerm && selectedLevel === 'All' && (
            <button
              onClick={openCreateForm}
              className="px-5 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] transition-all font-bold"
              style={{ minHeight: '48px' }}
            >
              Add First Book
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBooks.map((book) => {
            const badge = LEVEL_BADGE[book.level] || LEVEL_BADGE.Beginner;
            const isToggling = togglingId === book.id;

            return (
              <article
                key={book.id}
                className={`bg-[#FFFCF3] rounded-2xl border border-[#E8DEC8] shadow-ghibli hover:shadow-ghibli-hover hover:-translate-y-0.5 transition-all flex flex-col ${
                  !book.is_active ? 'opacity-60' : ''
                }`}
              >
                {/* Card body */}
                <div className="p-5 flex-1">
                  {/* Emoji + title + author */}
                  <div className="flex items-start gap-4 mb-3">
                    <div
                      className="w-16 h-16 rounded-xl flex items-center justify-center text-4xl flex-shrink-0 shadow-[inset_0_2px_6px_rgba(61,46,30,0.08)]"
                      style={{ backgroundColor: badge.bg }}
                      aria-hidden="true"
                    >
                      {book.cover_emoji || '📚'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h2
                        className="font-extrabold text-[#3D2E1E] text-base leading-tight truncate"
                        title={book.title}
                      >
                        {book.title}
                      </h2>
                      <p className="text-sm text-[#6B5744] font-semibold mt-0.5 truncate">
                        {book.author}
                      </p>

                      {/* Level + genre badges */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span
                          className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                          style={{ backgroundColor: badge.bg, color: badge.text }}
                        >
                          {book.level}
                        </span>
                        {book.genre && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F5F0E8] text-[#6B5744]">
                            {book.genre}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {book.description && (
                    <p className="text-sm text-[#6B5744] leading-relaxed line-clamp-2 mb-3">
                      {book.description}
                    </p>
                  )}

                  {/* Meta info row */}
                  <div className="flex items-center gap-4 text-xs text-[#9B8777] font-semibold">
                    {book.page_count != null && (
                      <span>{book.page_count} pages</span>
                    )}
                    {book.published_year != null && (
                      <span>{book.published_year}</span>
                    )}
                    <span className="ml-auto">
                      {book.sessionCount != null ? (
                        <span className="text-[#5C8B5C]">
                          {book.sessionCount} session{book.sessionCount !== 1 ? 's' : ''}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>

                {/* Card footer — actions */}
                <div className="px-5 pb-4 pt-3 border-t border-[#EDE5D4] flex items-center gap-2">
                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggleActive(book)}
                    disabled={isToggling}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                    style={{
                      minHeight: '36px',
                      backgroundColor: book.is_active ? '#C8E6C9' : '#EDE5D4',
                      color: book.is_active ? '#2E7D32' : '#6B5744',
                    }}
                    aria-pressed={book.is_active}
                    aria-label={`${book.is_active ? 'Deactivate' : 'Activate'} ${book.title}`}
                  >
                    {isToggling ? (
                      <span className="animate-spin inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                    ) : (
                      <span aria-hidden="true">{book.is_active ? '✓' : '○'}</span>
                    )}
                    {book.is_active ? 'Active' : 'Inactive'}
                  </button>

                  <div className="flex-1" />

                  {/* Edit */}
                  <button
                    onClick={() => openEditForm(book)}
                    className="px-3 py-2 rounded-lg text-xs font-bold transition-all hover:bg-[#5BA8B8] hover:text-white"
                    style={{
                      minHeight: '36px',
                      backgroundColor: '#E0F4F9',
                      color: '#2A7A8C',
                    }}
                    aria-label={`Edit ${book.title}`}
                  >
                    Edit
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => setDeleteConfirm(book.id)}
                    className="px-3 py-2 rounded-lg text-xs font-bold transition-all hover:bg-[#D4736B] hover:text-white"
                    style={{
                      minHeight: '36px',
                      backgroundColor: '#FCE8E6',
                      color: '#B85A53',
                    }}
                    aria-label={`Delete ${book.title}`}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Count footer */}
      {!loading && filteredBooks.length > 0 && (
        <p className="text-xs text-[#9B8777] text-right font-semibold">
          Showing {filteredBooks.length} of {books.length}{' '}
          book{books.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* ── Add / Edit modal ─────────────────────────────────────────────── */}
      {showForm && (
        <div
          className="fixed inset-0 bg-[#3D2E1E]/60 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="book-form-title"
        >
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_8px_40px_rgba(61,46,30,0.25)] max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#E8DEC8]">
            {/* Modal header */}
            <div className="sticky top-0 bg-[#FFFCF3] border-b border-[#E8DEC8] px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2
                id="book-form-title"
                className="text-2xl font-extrabold text-[#3D2E1E]"
              >
                {editingId ? 'Edit Book' : 'Add New Book'}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#EDE5D4] hover:bg-[#D6C9A8] text-[#3D2E1E] transition-all font-bold text-lg"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5" noValidate>
              {/* Title + Author */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="book-title"
                    className="block text-sm font-bold text-[#6B5744] mb-2"
                  >
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="book-title"
                    type="text"
                    value={form.title}
                    onChange={(e) => setField('title', e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E] font-semibold"
                    placeholder="e.g. Charlotte's Web"
                    autoFocus
                  />
                </div>

                <div>
                  <label
                    htmlFor="book-author"
                    className="block text-sm font-bold text-[#6B5744] mb-2"
                  >
                    Author <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="book-author"
                    type="text"
                    value={form.author}
                    onChange={(e) => setField('author', e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E] font-semibold"
                    placeholder="e.g. E.B. White"
                  />
                </div>
              </div>

              {/* Level + Genre */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="book-level"
                    className="block text-sm font-bold text-[#6B5744] mb-2"
                  >
                    Level
                  </label>
                  <select
                    id="book-level"
                    value={form.level}
                    onChange={(e) => setField('level', e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E] font-semibold"
                  >
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="book-genre"
                    className="block text-sm font-bold text-[#6B5744] mb-2"
                  >
                    Genre
                  </label>
                  <select
                    id="book-genre"
                    value={form.genre}
                    onChange={(e) => setField('genre', e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E] font-semibold"
                  >
                    {GENRES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Page count + Published year */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="book-pages"
                    className="block text-sm font-bold text-[#6B5744] mb-2"
                  >
                    Page Count <span className="text-[#9B8777] font-normal">(optional)</span>
                  </label>
                  <input
                    id="book-pages"
                    type="number"
                    min={1}
                    value={form.page_count}
                    onChange={(e) => setField('page_count', e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E] font-semibold"
                    placeholder="e.g. 192"
                  />
                </div>

                <div>
                  <label
                    htmlFor="book-year"
                    className="block text-sm font-bold text-[#6B5744] mb-2"
                  >
                    Published Year <span className="text-[#9B8777] font-normal">(optional)</span>
                  </label>
                  <input
                    id="book-year"
                    type="number"
                    min={1000}
                    max={new Date().getFullYear()}
                    value={form.published_year}
                    onChange={(e) => setField('published_year', e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E] font-semibold"
                    placeholder="e.g. 1952"
                  />
                </div>
              </div>

              {/* Cover emoji picker */}
              <div>
                <label className="block text-sm font-bold text-[#6B5744] mb-2">
                  Cover Emoji
                </label>
                {/* Quick picker grid */}
                <div className="flex flex-wrap gap-2 p-3 bg-[#F5F0E8] rounded-xl border border-[#D6C9A8]">
                  {EMOJI_OPTIONS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setField('cover_emoji', em)}
                      className="text-2xl p-1.5 rounded-lg transition-all"
                      style={{
                        minHeight: '44px',
                        minWidth: '44px',
                        backgroundColor: form.cover_emoji === em ? '#5C8B5C' : 'transparent',
                        outline: form.cover_emoji === em ? '2px solid #3D6B3D' : 'none',
                        outlineOffset: '1px',
                      }}
                      aria-pressed={form.cover_emoji === em}
                      aria-label={`Select emoji ${em}`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
                {/* Custom emoji text input */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#6B5744]">Custom:</span>
                  <input
                    type="text"
                    value={form.cover_emoji}
                    onChange={(e) => setField('cover_emoji', e.target.value)}
                    maxLength={2}
                    className="w-20 px-3 py-1.5 text-center text-xl border border-[#D6C9A8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8]"
                    aria-label="Type a custom emoji"
                  />
                  <span className="text-3xl" aria-hidden="true">{form.cover_emoji}</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="book-description"
                  className="block text-sm font-bold text-[#6B5744] mb-2"
                >
                  Description <span className="text-[#9B8777] font-normal">(optional)</span>
                </label>
                <textarea
                  id="book-description"
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  className="w-full px-4 py-2.5 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E] font-semibold resize-none"
                  placeholder="A short summary of the book..."
                  rows={3}
                />
              </div>

              {/* Inline form error */}
              {formError && (
                <p role="alert" className="text-red-600 text-sm font-semibold flex items-center gap-1">
                  <span aria-hidden="true">⚠️</span> {formError}
                </p>
              )}

              {/* Form actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] transition-all font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ minHeight: '48px' }}
                >
                  {saving && (
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  )}
                  {saving ? 'Saving...' : editingId ? 'Update Book' : 'Add Book'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-[#EDE5D4] text-[#3D2E1E] rounded-xl hover:bg-[#D6C9A8] transition-all font-bold disabled:opacity-50"
                  style={{ minHeight: '48px' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ────────────────────────────────────── */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-[#3D2E1E]/60 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
        >
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_8px_40px_rgba(61,46,30,0.25)] max-w-sm w-full p-6 border border-[#E8DEC8]">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl" aria-hidden="true">🗑️</span>
              <h3
                id="delete-title"
                className="text-xl font-extrabold text-[#3D2E1E]"
              >
                Delete Book?
              </h3>
            </div>

            {bookBeingDeleted && (
              <div className="flex items-center gap-3 bg-[#F5F0E8] rounded-xl p-3 mb-4">
                <span className="text-2xl" aria-hidden="true">
                  {bookBeingDeleted.cover_emoji || '📚'}
                </span>
                <div>
                  <p className="font-bold text-[#3D2E1E] text-sm">
                    {bookBeingDeleted.title}
                  </p>
                  <p className="text-xs text-[#6B5744] font-semibold">
                    {bookBeingDeleted.author}
                  </p>
                </div>
              </div>
            )}

            <p className="text-[#6B5744] font-semibold mb-6 text-sm">
              This will permanently remove the book and all associated session data.
              This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-[#D4736B] text-white rounded-xl hover:bg-[#B85A53] transition-all font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ minHeight: '48px' }}
              >
                {deleting && (
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                )}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-[#EDE5D4] text-[#3D2E1E] rounded-xl hover:bg-[#D6C9A8] transition-all font-bold disabled:opacity-50"
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
