'use client';

import { useState, useEffect, useCallback } from 'react';
import { getToken, API_BASE } from '@/lib/auth';

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const GENRES = ['Picture Book', 'Chapter Book', 'Fantasy', 'Adventure', 'Science Fiction', 'Historical Fiction'];

/** Capitalise first letter for display. */
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const LEVEL_BADGE_STYLES = {
  beginner: { bg: '#C8E6C9', text: '#2E7D32' },
  intermediate: { bg: '#FFE0B2', text: '#E65100' },
  advanced: { bg: '#E1BEE7', text: '#6A1B9A' },
};

const EMOJI_OPTIONS = ['📚', '🐛', '👹', '🕷️', '🦁', '🌳', '⭐', '📖', '✨', '🎭', '🗺️', '🔮', '🧙', '⚔️'];

const EMPTY_FORM = {
  title: '',
  author: '',
  level: 'beginner',
  genre: 'Picture Book',
  cover_emoji: '📚',
  description: '',
};

export default function BooksPage() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  // Filter / search state
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Add / edit form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const API = API_BASE;

  // -- Fetch all books --
  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const r = await fetch(`${API}/api/admin/books`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setBooks(data.data?.books || data.books || []);
    } catch (e) {
      console.warn('Fetch books failed:', e);
      setApiError('Could not load books. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [API]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // -- Derived filtered list --
  const filteredBooks = books.filter((b) => {
    const matchesLevel =
      selectedLevel === 'All' ||
      b.level?.toLowerCase() === selectedLevel.toLowerCase();
    const matchesSearch =
      !searchTerm.trim() ||
      b.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.author?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.genre?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  // -- Open form for create --
  const openCreateForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  // -- Open form for edit --
  const openEditForm = (book) => {
    setEditingId(book.id);
    setForm({
      title: book.title || '',
      author: book.author || '',
      level: book.level || 'beginner',
      genre: book.genre || 'Picture Book',
      cover_emoji: book.cover_emoji || '📚',
      description: book.description || '',
    });
    setFormError(null);
    setShowForm(true);
  };

  // -- Close form --
  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  };

  // -- Save (create or update) --
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.author.trim()) {
      setFormError('Title and author are required.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId
        ? `${API}/api/admin/books/${editingId}`
        : `${API}/api/admin/books`;

      const body = {
        title: form.title.trim(),
        author: form.author.trim(),
        level: form.level,
        genre: form.genre,
        cover_emoji: form.cover_emoji,
        description: form.description.trim(),
      };

      const r = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${r.status}`);
      }

      closeForm();
      fetchBooks();
    } catch (err) {
      setFormError(err.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // -- Delete --
  const handleDelete = async (bookId) => {
    setDeleting(true);
    try {
      const r = await fetch(`${API}/api/admin/books/${bookId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setDeleteConfirm(null);
      fetchBooks();
    } catch (err) {
      console.warn('Delete failed:', err);
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  // -- Export books as CSV --
  const handleExportCSV = () => {
    const csvRows = books.map((b) =>
      [b.title, b.author, b.level, b.genre, b.cover_emoji, b.description]
        .map((v) => `"${String(v || '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = ['title,author,level,genre,cover_emoji,description', ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'books-export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // -- Import books from CSV --
  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const r = await fetch(`${API}/api/admin/import/books`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ csv: text }),
      });

      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${r.status}`);
      }

      const data = await r.json();
      setImportResult(data.data || data);
      fetchBooks();
    } catch (err) {
      setImportResult({ error: err.message });
    } finally {
      setImporting(false);
      // Reset file input
      e.target.value = '';
    }
  };

  // -- RENDER --
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-extrabold text-[#3D2E1E]">Book Management</h1>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="px-4 py-3 bg-[#87CEDB] text-[#3D2E1E] rounded-xl hover:bg-[#5BA8B8] hover:text-white transition-all font-bold shadow-[0_2px_8px_rgba(135,206,219,0.3)] hover:-translate-y-0.5"
            style={{ minHeight: '48px' }}
          >
            Export CSV
          </button>
          <label
            className="px-4 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] transition-all font-bold shadow-[0_2px_8px_rgba(61,107,61,0.3)] hover:-translate-y-0.5 cursor-pointer flex items-center"
            style={{ minHeight: '48px' }}
          >
            {importing ? 'Importing...' : 'Import CSV'}
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
              disabled={importing}
            />
          </label>
          <button
            onClick={openCreateForm}
            className="px-5 py-3 bg-[#D4A843] text-white rounded-xl hover:bg-[#B8903A] transition-all font-bold shadow-[0_2px_8px_rgba(212,168,67,0.3)] hover:-translate-y-0.5"
            style={{ minHeight: '48px' }}
          >
            Add New Book
          </button>
        </div>
      </div>

      {/* Import Result Banner */}
      {importResult && (
        <div
          className="rounded-xl px-4 py-3 text-sm font-semibold flex items-center justify-between"
          style={{
            backgroundColor: importResult.error ? '#FCE8E6' : '#E8F5E8',
            color: importResult.error ? '#B85A53' : '#2E7D32',
            border: `1px solid ${importResult.error ? '#F5C6C2' : '#C8E6C9'}`,
          }}
        >
          <span>
            {importResult.error
              ? `Import failed: ${importResult.error}`
              : `Imported ${importResult.imported || 0} of ${importResult.total || 0} books${importResult.errors?.length > 0 ? ` (${importResult.errors.length} errors)` : ''}`}
          </span>
          <button
            onClick={() => setImportResult(null)}
            className="text-lg font-bold opacity-60 hover:opacity-100 transition-opacity"
          >
            x
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by title, author, or genre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4A843] bg-[#FFFCF3] text-[#3D2E1E] placeholder-[#6B5744] font-semibold"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['All', ...LEVELS].map((level) => {
            const isActive =
              selectedLevel.toLowerCase() === level.toLowerCase();
            return (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className="px-4 py-2 rounded-xl font-bold transition-all"
                style={{
                  minHeight: '48px',
                  backgroundColor: isActive ? '#D4A843' : '#EDE5D4',
                  color: isActive ? '#FFFFFF' : '#3D2E1E',
                }}
              >
                {capitalize(level)}
              </button>
            );
          })}
        </div>
      </div>

      {/* API Error Banner */}
      {apiError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-semibold flex items-center gap-2">
          <span aria-hidden="true">!</span> {apiError}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-[#3D2E1E]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_8px_40px_rgba(61,46,30,0.25)] max-w-2xl w-full max-h-screen overflow-y-auto p-6 border border-[#E8DEC8]">
            <h2 className="text-2xl font-extrabold text-[#3D2E1E] mb-4">
              {editingId ? 'Edit Book' : 'Add New Book'}
            </h2>

            <form onSubmit={handleSave} className="space-y-4" noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#6B5744] mb-2">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4A843] bg-[#F5F0E8] text-[#3D2E1E]"
                    placeholder="Book title"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#6B5744] mb-2">
                    Author <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.author}
                    onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                    className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4A843] bg-[#F5F0E8] text-[#3D2E1E]"
                    placeholder="Author name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#6B5744] mb-2">Level</label>
                  <select
                    value={form.level}
                    onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                    className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4A843] bg-[#F5F0E8] text-[#3D2E1E]"
                  >
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {capitalize(l)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#6B5744] mb-2">Genre</label>
                  <select
                    value={form.genre}
                    onChange={(e) => setForm((f) => ({ ...f, genre: e.target.value }))}
                    className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4A843] bg-[#F5F0E8] text-[#3D2E1E]"
                  >
                    {GENRES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#6B5744] mb-2">Cover Emoji</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, cover_emoji: e }))}
                      className="text-3xl p-2 rounded-lg transition-all"
                      style={{
                        minHeight: '48px',
                        minWidth: '48px',
                        backgroundColor: form.cover_emoji === e ? '#D4A843' : '#EDE5D4',
                        boxShadow: form.cover_emoji === e ? '0 0 0 2px #B8903A' : 'none',
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#6B5744] mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4A843] bg-[#F5F0E8] text-[#3D2E1E]"
                  placeholder="Book description"
                  rows="3"
                />
              </div>

              {/* Inline form error */}
              {formError && (
                <p className="text-red-600 text-sm font-semibold">{formError}</p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-[#D4A843] text-white rounded-xl hover:bg-[#B8903A] transition-all font-bold disabled:opacity-50"
                  style={{ minHeight: '48px' }}
                >
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

      {/* Books Table */}
      {loading ? (
        <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-12 text-center border border-[#E8DEC8]">
          <p className="text-[#6B5744] text-lg font-semibold">Loading books...</p>
        </div>
      ) : (
        <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] overflow-hidden border border-[#E8DEC8]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#E8DEC8] bg-[#F5F0E8]">
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Title</th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Author</th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Level</th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Genre</th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Emoji</th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Sessions</th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBooks.map((book) => {
                  const levelKey = book.level?.toLowerCase() || 'beginner';
                  const badge = LEVEL_BADGE_STYLES[levelKey] || LEVEL_BADGE_STYLES.beginner;

                  return (
                    <tr
                      key={book.id}
                      className="border-b border-[#EDE5D4] hover:bg-[#F5F0E8] transition-colors"
                    >
                      <td className="py-4 px-4 font-bold text-[#3D2E1E] max-w-xs truncate">
                        {book.title}
                      </td>
                      <td className="py-4 px-4 text-[#6B5744] font-semibold">{book.author}</td>
                      <td className="py-4 px-4">
                        <span
                          className="px-3 py-1 rounded-full text-xs font-bold"
                          style={{ backgroundColor: badge.bg, color: badge.text }}
                        >
                          {capitalize(book.level)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-[#6B5744] text-xs font-semibold">{book.genre}</td>
                      <td className="py-4 px-4 text-2xl">{book.cover_emoji}</td>
                      <td className="py-4 px-4 text-[#6B5744] font-bold">
                        {book.sessionCount ?? 0}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditForm(book)}
                            className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                            style={{ backgroundColor: '#E0F4F9', color: '#2A7A8C', minHeight: '36px' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(book.id)}
                            className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                            style={{ backgroundColor: '#FCE8E6', color: '#B85A53', minHeight: '36px' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredBooks.length === 0 && (
            <div className="text-center py-12">
              <span className="text-4xl block mb-3" aria-hidden="true">📚</span>
              <p className="text-[#6B5744] text-lg font-semibold">No books found</p>
            </div>
          )}
        </div>
      )}

      {/* Count footer */}
      {!loading && filteredBooks.length > 0 && (
        <p className="text-xs text-[#6B5744] text-right font-semibold">
          Showing {filteredBooks.length} of {books.length} books
        </p>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-[#3D2E1E]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_8px_40px_rgba(61,46,30,0.25)] max-w-sm w-full p-6 border border-[#E8DEC8]">
            <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-4">Delete Book?</h3>
            <p className="text-[#6B5744] mb-6 font-semibold">
              Are you sure you want to delete this book? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-[#D4736B] text-white rounded-xl hover:bg-[#B85A53] transition-all font-bold disabled:opacity-50"
                style={{ minHeight: '48px' }}
              >
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
