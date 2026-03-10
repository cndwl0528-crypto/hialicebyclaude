'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * AdminStudentsPage — /admin/students
 *
 * Full CRUD interface for student records with search, sort, and filtering.
 * Persists all mutations via the backend REST API.
 * Reads auth token from sessionStorage('authToken').
 * Gracefully degrades when the API is unavailable.
 */

// ── Constants ──────────────────────────────────────────────────────────────

const LEVELS = ['beginner', 'intermediate', 'advanced'];

const LEVEL_BADGE = {
  beginner:     { bg: '#C8E6C9', text: '#2E7D32' },
  intermediate: { bg: '#FFE0B2', text: '#E65100' },
  advanced:     { bg: '#E1BEE7', text: '#6A1B9A' },
};

const SORT_COLUMNS = ['name', 'age', 'level', 'booksRead'];

const EMPTY_FORM = {
  name:      '',
  age:       '',
  level:     'beginner',
  parent_id: '',
};

// ── Helpers ────────────────────────────────────────────────────────────────

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

function relativeTime(timestamp) {
  if (!timestamp) return '—';
  const diff = Date.now() - new Date(timestamp).getTime();
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (h < 1)  return 'Just now';
  if (h < 24) return `${h}h ago`;
  if (d < 7)  return `${d}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function grammarDisplay(score) {
  if (score == null) return null;
  // Accept both 0–10 scale and 0–100 scale from the API
  const normalised = score > 10 ? score : score * 10;
  return Math.round(normalised);
}

// ── Skeleton loader ────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] overflow-hidden border border-[#E8DEC8]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#E8DEC8] bg-[#F5F0E8]">
              {['Name', 'Age', 'Level', 'Books', 'Avg Grammar', 'Vocab', 'Last Active', 'Actions'].map(
                (col) => (
                  <th
                    key={col}
                    className="text-left py-4 px-4 font-bold text-[#6B5744]"
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-[#EDE5D4]">
                {Array.from({ length: 8 }).map((__, j) => (
                  <td key={j} className="py-4 px-4">
                    <div
                      className="h-4 rounded animate-shimmer bg-gradient-to-r from-[#EDE5D4] via-[#F5F0E8] to-[#EDE5D4] bg-[length:200%_100%]"
                      style={{ width: j === 0 ? '80%' : j === 7 ? '100%' : '60%' }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sort indicator ─────────────────────────────────────────────────────────

function SortIcon({ column, sortKey, sortDir }) {
  if (sortKey !== column) {
    return <span className="ml-1 text-[#C4B49A] text-xs select-none">↕</span>;
  }
  return (
    <span className="ml-1 text-[#5C8B5C] text-xs select-none">
      {sortDir === 'asc' ? '↑' : '↓'}
    </span>
  );
}

// ── Main Page Component ────────────────────────────────────────────────────

export default function AdminStudentsPage() {
  const router = useRouter();

  // Data state
  const [students,  setStudents]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [apiError,  setApiError]  = useState(null);

  // Filter / sort state
  const [searchTerm,     setSearchTerm]     = useState('');
  const [selectedLevel,  setSelectedLevel]  = useState('All');
  const [sortKey,        setSortKey]        = useState('name');
  const [sortDir,        setSortDir]        = useState('asc');

  // Add / edit form state
  const [showForm,   setShowForm]   = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [formError,  setFormError]  = useState(null);
  const [saving,     setSaving]     = useState(false);

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting,      setDeleting]      = useState(false);

  // API base + token helper
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const getToken = useCallback(
    () =>
      typeof window !== 'undefined'
        ? sessionStorage.getItem('authToken')
        : null,
    []
  );

  // ── Fetch students ───────────────────────────────────────────────────────

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setApiError(null);

    try {
      const res = await fetch(`${API}/api/admin/students`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (res.status === 401 || res.status === 403) {
        router.push('/');
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      // Tolerate { students }, { data: { students } } or { data: [] }
      const list =
        data.students ??
        data.data?.students ??
        (Array.isArray(data.data) ? data.data : []);
      setStudents(list);
    } catch (err) {
      console.warn('Fetch students failed:', err);
      setApiError('Could not load students. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [API, getToken, router]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // ── Derived: filter + sort ───────────────────────────────────────────────

  const displayStudents = React.useMemo(() => {
    let list = students.filter((s) => {
      const matchLevel =
        selectedLevel === 'All' ||
        (s.level ?? '').toLowerCase() === selectedLevel.toLowerCase();
      const term = searchTerm.trim().toLowerCase();
      const matchSearch =
        !term || (s.name ?? '').toLowerCase().includes(term);
      return matchLevel && matchSearch;
    });

    list = [...list].sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case 'age':
          av = a.age ?? 0;
          bv = b.age ?? 0;
          break;
        case 'level': {
          const order = { beginner: 0, intermediate: 1, advanced: 2 };
          av = order[(a.level ?? '').toLowerCase()] ?? 0;
          bv = order[(b.level ?? '').toLowerCase()] ?? 0;
          break;
        }
        case 'booksRead':
          av = a.booksRead ?? a.total_books_read ?? 0;
          bv = b.booksRead ?? b.total_books_read ?? 0;
          break;
        case 'name':
        default:
          av = (a.name ?? '').toLowerCase();
          bv = (b.name ?? '').toLowerCase();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [students, searchTerm, selectedLevel, sortKey, sortDir]);

  // ── Sort toggle ──────────────────────────────────────────────────────────

  const toggleSort = (col) => {
    if (sortKey === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col);
      setSortDir('asc');
    }
  };

  // ── Form helpers ─────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (student) => {
    setEditingId(student.id);
    setForm({
      name:      student.name  ?? '',
      age:       student.age   ?? '',
      level:     student.level ?? 'beginner',
      parent_id: '',
    });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  };

  const handleFieldChange = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ── Save (create / update) ───────────────────────────────────────────────

  const handleSave = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setFormError('Name is required.');
      return;
    }
    const ageNum = parseInt(form.age, 10);
    if (isNaN(ageNum) || ageNum < 6 || ageNum > 13) {
      setFormError('Age must be between 6 and 13.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId
        ? `${API}/api/admin/students/${editingId}`
        : `${API}/api/admin/students`;

      const body = {
        name:  form.name.trim(),
        age:   ageNum,
        level: form.level,
      };
      if (!editingId && form.parent_id.trim()) {
        body.parent_id = form.parent_id.trim();
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || `HTTP ${res.status}`);
      }

      closeForm();
      fetchStudents();
    } catch (err) {
      setFormError(err.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = async (studentId) => {
    setDeleting(true);
    try {
      const res = await fetch(`${API}/api/admin/students/${studentId}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDeleteConfirm(null);
      fetchStudents();
    } catch (err) {
      console.warn('Delete failed:', err);
      setApiError('Delete failed. Please try again.');
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex items-center justify-center rounded-xl text-[#5C8B5C] hover:bg-[#C8E6C9] transition-all font-bold"
            style={{ minHeight: '48px', minWidth: '48px' }}
            aria-label="Back to Admin Dashboard"
          >
            ←
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold text-[#3D2E1E]">
              Student Management
            </h1>
            {!loading && (
              <p className="text-sm text-[#9B8777] font-semibold mt-0.5">
                {students.length} student{students.length !== 1 ? 's' : ''} registered
              </p>
            )}
          </div>
        </div>

        <button
          onClick={openCreateForm}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] transition-all font-bold shadow-[0_2px_8px_rgba(61,107,61,0.3)] hover:-translate-y-0.5"
          style={{ minHeight: '48px' }}
        >
          <span aria-hidden="true">+</span> Add Student
        </button>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B8777] text-base pointer-events-none"
            aria-hidden="true"
          >
            🔍
          </span>
          <input
            type="search"
            placeholder="Search by name…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#FFFCF3] text-[#3D2E1E] placeholder-[#9B8777] font-semibold"
            style={{ minHeight: '48px' }}
          />
        </div>

        {/* Level filter buttons */}
        <div className="flex gap-2 flex-wrap">
          {['All', ...LEVELS].map((level) => {
            const active = selectedLevel.toLowerCase() === level.toLowerCase();
            const colourMap = {
              All:          '#5C8B5C',
              beginner:     '#2E7D32',
              intermediate: '#E65100',
              advanced:     '#6A1B9A',
            };
            return (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className="px-4 py-2 rounded-xl font-bold transition-all"
                style={{
                  minHeight: '48px',
                  backgroundColor: active ? colourMap[level] : '#EDE5D4',
                  color: active ? '#FFFFFF' : '#3D2E1E',
                }}
                aria-pressed={active}
              >
                {cap(level)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Error Banner ─────────────────────────────────────────────────── */}
      {apiError && (
        <div
          role="alert"
          className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-semibold"
        >
          <span aria-hidden="true">⚠️</span>
          <span>{apiError}</span>
          <button
            onClick={() => setApiError(null)}
            className="ml-auto text-red-400 hover:text-red-700 transition-colors"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Add / Edit Modal ──────────────────────────────────────────────── */}
      {showForm && (
        <div
          className="fixed inset-0 bg-[#3D2E1E]/60 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? 'Edit student' : 'Add student'}
        >
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_8px_40px_rgba(61,46,30,0.25)] max-w-md w-full p-6 border border-[#E8DEC8]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-extrabold text-[#3D2E1E]">
                {editingId ? 'Edit Student' : 'Add New Student'}
              </h2>
              <button
                onClick={closeForm}
                className="flex items-center justify-center rounded-xl text-[#9B8777] hover:text-[#3D2E1E] hover:bg-[#EDE5D4] transition-all"
                style={{ minHeight: '48px', minWidth: '48px' }}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4" noValidate>

              {/* Name */}
              <div>
                <label
                  htmlFor="student-name"
                  className="block text-sm font-bold text-[#6B5744] mb-2"
                >
                  Name <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="student-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  className="w-full px-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E]"
                  placeholder="Student's full name"
                  autoFocus
                  required
                  style={{ minHeight: '48px' }}
                />
              </div>

              {/* Age + Level */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="student-age"
                    className="block text-sm font-bold text-[#6B5744] mb-2"
                  >
                    Age <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="student-age"
                    type="number"
                    min={6}
                    max={13}
                    value={form.age}
                    onChange={(e) => handleFieldChange('age', e.target.value)}
                    className="w-full px-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E]"
                    placeholder="6 – 13"
                    required
                    style={{ minHeight: '48px' }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="student-level"
                    className="block text-sm font-bold text-[#6B5744] mb-2"
                  >
                    Level
                  </label>
                  <select
                    id="student-level"
                    value={form.level}
                    onChange={(e) => handleFieldChange('level', e.target.value)}
                    className="w-full px-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E]"
                    style={{ minHeight: '48px' }}
                  >
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {cap(l)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Parent ID (create only) */}
              {!editingId && (
                <div>
                  <label
                    htmlFor="student-parent-id"
                    className="block text-sm font-bold text-[#6B5744] mb-2"
                  >
                    Parent ID{' '}
                    <span className="font-normal text-[#9B8777]">
                      (optional — links to existing parent account)
                    </span>
                  </label>
                  <input
                    id="student-parent-id"
                    type="text"
                    value={form.parent_id}
                    onChange={(e) => handleFieldChange('parent_id', e.target.value)}
                    className="w-full px-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E]"
                    placeholder="parent-uuid or leave blank"
                    style={{ minHeight: '48px' }}
                  />
                </div>
              )}

              {/* Inline form error */}
              {formError && (
                <p role="alert" className="text-red-600 text-sm font-semibold">
                  {formError}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ minHeight: '48px' }}
                >
                  {saving
                    ? 'Saving…'
                    : editingId
                    ? 'Update Student'
                    : 'Add Student'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-[#EDE5D4] text-[#3D2E1E] rounded-xl hover:bg-[#D6C9A8] transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ minHeight: '48px' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────────────────── */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-[#3D2E1E]/60 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Delete student confirmation"
        >
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_8px_40px_rgba(61,46,30,0.25)] max-w-sm w-full p-6 border border-[#E8DEC8]">
            <div className="text-center mb-4">
              <span className="text-4xl" aria-hidden="true">⚠️</span>
            </div>
            <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-3 text-center">
              Delete Student?
            </h3>
            <p className="text-[#6B5744] font-semibold text-sm text-center mb-6">
              This will permanently delete the student and{' '}
              <strong className="text-[#B85A53]">all their session data</strong>.
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-[#D4736B] text-white rounded-xl hover:bg-[#B85A53] transition-all font-bold disabled:opacity-50"
                style={{ minHeight: '48px' }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
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

      {/* ── Table / Loading / Empty ───────────────────────────────────────── */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] overflow-hidden border border-[#E8DEC8]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#E8DEC8] bg-[#F5F0E8]">

                  {/* Sortable: Name */}
                  <th className="text-left py-4 px-4">
                    <button
                      onClick={() => toggleSort('name')}
                      className="flex items-center font-bold text-[#6B5744] hover:text-[#3D2E1E] transition-colors"
                      style={{ minHeight: '32px' }}
                    >
                      Name
                      <SortIcon column="name" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>

                  {/* Sortable: Age */}
                  <th className="text-left py-4 px-4">
                    <button
                      onClick={() => toggleSort('age')}
                      className="flex items-center font-bold text-[#6B5744] hover:text-[#3D2E1E] transition-colors"
                      style={{ minHeight: '32px' }}
                    >
                      Age
                      <SortIcon column="age" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>

                  {/* Sortable: Level */}
                  <th className="text-left py-4 px-4">
                    <button
                      onClick={() => toggleSort('level')}
                      className="flex items-center font-bold text-[#6B5744] hover:text-[#3D2E1E] transition-colors"
                      style={{ minHeight: '32px' }}
                    >
                      Level
                      <SortIcon column="level" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>

                  {/* Sortable: Books Read */}
                  <th className="text-left py-4 px-4">
                    <button
                      onClick={() => toggleSort('booksRead')}
                      className="flex items-center font-bold text-[#6B5744] hover:text-[#3D2E1E] transition-colors"
                      style={{ minHeight: '32px' }}
                    >
                      Books Read
                      <SortIcon column="booksRead" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>

                  {/* Non-sortable columns */}
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">
                    Avg Grammar
                  </th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">
                    Vocabulary
                  </th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">
                    Last Active
                  </th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {displayStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-5xl" aria-hidden="true">🌿</span>
                        <p className="text-[#6B5744] text-lg font-bold">
                          {searchTerm || selectedLevel !== 'All'
                            ? 'No students match your filters'
                            : 'No students yet'}
                        </p>
                        <p className="text-[#9B8777] text-sm font-semibold">
                          {searchTerm || selectedLevel !== 'All'
                            ? 'Try adjusting your search or level filter.'
                            : 'Click "Add Student" to register the first student.'}
                        </p>
                        {(searchTerm || selectedLevel !== 'All') && (
                          <button
                            onClick={() => {
                              setSearchTerm('');
                              setSelectedLevel('All');
                            }}
                            className="mt-2 px-4 py-2 bg-[#EDE5D4] text-[#3D2E1E] rounded-xl hover:bg-[#D6C9A8] transition-all font-bold text-sm"
                            style={{ minHeight: '40px' }}
                          >
                            Clear Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayStudents.map((student) => {
                    const levelKey = (student.level ?? 'beginner').toLowerCase();
                    const badge    = LEVEL_BADGE[levelKey] ?? LEVEL_BADGE.beginner;
                    const grammar  = grammarDisplay(
                      student.averageGrammarScore ?? student.avgGrammar ?? student.average_grammar_score
                    );
                    const booksRead =
                      student.booksRead ?? student.total_books_read ?? 0;
                    const vocabCount =
                      student.vocabularyCount ?? student.total_words_learned ?? student.vocabulary_count ?? 0;
                    const lastActive =
                      student.lastActive ?? student.last_session_date ?? student.last_active;

                    return (
                      <tr
                        key={student.id}
                        className="border-b border-[#EDE5D4] hover:bg-[#F5F0E8] transition-colors"
                      >
                        {/* Name */}
                        <td className="py-4 px-4 font-bold text-[#3D2E1E] max-w-[160px] truncate">
                          {student.name}
                        </td>

                        {/* Age */}
                        <td className="py-4 px-4 text-[#6B5744] font-semibold">
                          {student.age}
                        </td>

                        {/* Level badge */}
                        <td className="py-4 px-4">
                          <span
                            className="inline-block px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
                            style={{ backgroundColor: badge.bg, color: badge.text }}
                          >
                            {cap(student.level)}
                          </span>
                        </td>

                        {/* Books Read */}
                        <td className="py-4 px-4 text-[#6B5744] font-bold">
                          {booksRead}
                        </td>

                        {/* Avg Grammar */}
                        <td className="py-4 px-4">
                          {grammar != null ? (
                            <span
                              className="inline-block px-3 py-1 rounded-full text-xs font-bold"
                              style={{
                                backgroundColor: grammar >= 70 ? '#C8E6C9' : '#FFF8E1',
                                color:           grammar >= 70 ? '#2E7D32' : '#8C6D00',
                              }}
                            >
                              {grammar}%
                            </span>
                          ) : (
                            <span className="text-[#9CA3AF] text-xs font-semibold">—</span>
                          )}
                        </td>

                        {/* Vocabulary */}
                        <td className="py-4 px-4 text-[#6B5744] font-semibold">
                          {vocabCount > 0 ? (
                            <span className="flex items-center gap-1">
                              <span
                                className="inline-block w-2 h-2 rounded-full bg-[#5C8B5C]"
                                aria-hidden="true"
                              />
                              {vocabCount}
                            </span>
                          ) : (
                            <span className="text-[#9CA3AF] text-xs font-semibold">—</span>
                          )}
                        </td>

                        {/* Last Active */}
                        <td className="py-4 px-4 text-[#9B8777] text-xs font-semibold whitespace-nowrap">
                          {relativeTime(lastActive)}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4">
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => openEditForm(student)}
                              className="px-3 py-2 rounded-lg text-xs font-bold transition-all hover:-translate-y-0.5"
                              style={{
                                minHeight: '36px',
                                backgroundColor: '#E0F4F9',
                                color: '#2A7A8C',
                              }}
                              aria-label={`Edit ${student.name}`}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(student.id)}
                              className="px-3 py-2 rounded-lg text-xs font-bold transition-all hover:-translate-y-0.5"
                              style={{
                                minHeight: '36px',
                                backgroundColor: '#FCE8E6',
                                color: '#B85A53',
                              }}
                              aria-label={`Delete ${student.name}`}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Footer count ─────────────────────────────────────────────────── */}
      {!loading && displayStudents.length > 0 && (
        <p className="text-xs text-[#9B8777] text-right font-semibold">
          Showing{' '}
          <span className="text-[#5C8B5C] font-extrabold">{displayStudents.length}</span>
          {' '}of{' '}
          <span className="font-extrabold">{students.length}</span>
          {' '}student{students.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
