'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import LoadingCard from '@/components/LoadingCard';

/**
 * AdminStudentsPage — /admin/students
 *
 * Full CRUD interface for student records.
 * All mutations are persisted via the backend API.
 * Falls back gracefully when the API is unavailable.
 */

const LEVELS = ['beginner', 'intermediate', 'advanced'];

/** Capitalise first letter for display. */
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const LEVEL_BADGE_STYLES = {
  beginner: { bg: '#C8E6C9', text: '#2E7D32' },
  intermediate: { bg: '#FFE0B2', text: '#E65100' },
  advanced: { bg: '#E1BEE7', text: '#6A1B9A' },
};

/** Format a UTC timestamp into a human-readable relative string. */
function formatRelativeTime(timestamp) {
  if (!timestamp) return '—';
  const diff = Date.now() - new Date(timestamp).getTime();
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const EMPTY_FORM = { name: '', age: '', level: 'beginner', parentEmail: '' };

export default function AdminStudentsPage() {
  const router = useRouter();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  // Filter / search state
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Expanded row state (for inline reading-history / vocab preview)
  const [expandedStudent, setExpandedStudent] = useState(null);

  // Add / edit form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const getToken = () =>
    typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;

  // ── Fetch all students ──────────────────────────────────────────────────
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const r = await fetch(`${API}/api/admin/students`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (r.status === 401 || r.status === 403) {
        router.push('/');
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      // Support both { students } and { data: { students } } response shapes.
      setStudents(data.students || data.data?.students || []);
    } catch (e) {
      console.warn('Fetch students failed:', e);
      setApiError('Could not load students. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [API, router]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // ── Derived filtered list ───────────────────────────────────────────────
  const filteredStudents = students.filter((s) => {
    const matchesLevel =
      selectedLevel === 'All' ||
      s.level?.toLowerCase() === selectedLevel.toLowerCase();
    const matchesSearch =
      !searchTerm.trim() ||
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.parentEmail?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  // ── Open form for create ────────────────────────────────────────────────
  const openCreateForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  // ── Open form for edit ──────────────────────────────────────────────────
  const openEditForm = (student) => {
    setEditingId(student.id);
    setForm({
      name: student.name || '',
      age: student.age ?? '',
      level: student.level || 'beginner',
      parentEmail: '',
    });
    setFormError(null);
    setShowForm(true);
  };

  // ── Close form ──────────────────────────────────────────────────────────
  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  };

  // ── Save (create or update) ─────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.age) {
      setFormError('Name and age are required.');
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
        name: form.name.trim(),
        age: ageNum,
        level: form.level,
      };
      if (!editingId && form.parentEmail.trim()) {
        body.parentEmail = form.parentEmail.trim();
      }

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
      fetchStudents();
    } catch (err) {
      setFormError(err.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async (studentId) => {
    setDeleting(true);
    try {
      const r = await fetch(`${API}/api/admin/students/${studentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setDeleteConfirm(null);
      fetchStudents();
    } catch (err) {
      console.warn('Delete failed:', err);
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  // ── Toggle expanded row ─────────────────────────────────────────────────
  const toggleExpand = (studentId) =>
    setExpandedStudent((prev) => (prev === studentId ? null : studentId));

  // ────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-extrabold text-[#3D2E1E]">Student Management</h1>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => {
              const url = `${API}/api/admin/export/students`;
              const a = document.createElement('a');
              a.href = url;
              a.download = 'students.csv';
              // Use fetch to include auth token
              fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
                .then(r => r.blob())
                .then(blob => {
                  const blobUrl = URL.createObjectURL(blob);
                  a.href = blobUrl;
                  a.click();
                  URL.revokeObjectURL(blobUrl);
                })
                .catch(err => console.warn('Export failed:', err));
            }}
            className="px-4 py-3 bg-[#87CEDB] text-[#3D2E1E] rounded-xl hover:bg-[#5BA8B8] hover:text-white transition-all font-bold shadow-[0_2px_8px_rgba(135,206,219,0.3)] hover:-translate-y-0.5"
            style={{ minHeight: '48px' }}
          >
            Export CSV
          </button>
          <button
            onClick={openCreateForm}
            className="px-5 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] transition-all font-bold shadow-[0_2px_8px_rgba(61,107,61,0.3)] hover:-translate-y-0.5"
            style={{ minHeight: '48px' }}
          >
            Add New Student
          </button>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#FFFCF3] text-[#3D2E1E] placeholder-[#6B5744] font-semibold"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['All', ...LEVELS].map((level) => {
            const isActive =
              selectedLevel.toLowerCase() === level.toLowerCase();
            const colours = {
              All: '#5C8B5C',
              beginner: '#2E7D32',
              intermediate: '#E65100',
              advanced: '#6A1B9A',
            };
            return (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className="px-4 py-2 rounded-xl font-bold transition-all"
                style={{
                  minHeight: '48px',
                  backgroundColor: isActive ? colours[level] : '#EDE5D4',
                  color: isActive ? '#FFFFFF' : '#3D2E1E',
                }}
              >
                {capitalize(level)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── API Error Banner ─────────────────────────────────────────────── */}
      {apiError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-semibold flex items-center gap-2">
          <span aria-hidden="true">⚠️</span> {apiError}
        </div>
      )}

      {/* ── Add / Edit Modal ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-[#3D2E1E]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_8px_40px_rgba(61,46,30,0.25)] max-w-md w-full p-6 border border-[#E8DEC8]">
            <h2 className="text-2xl font-extrabold text-[#3D2E1E] mb-4">
              {editingId ? 'Edit Student' : 'Add New Student'}
            </h2>

            <form onSubmit={handleSave} className="space-y-4" noValidate>
              {/* Name */}
              <div>
                <label className="block text-sm font-bold text-[#6B5744] mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E]"
                  placeholder="Student name"
                  autoFocus
                />
              </div>

              {/* Age + Level */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#6B5744] mb-2">
                    Age <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={6}
                    max={13}
                    value={form.age}
                    onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                    className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E]"
                    placeholder="6–13"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#6B5744] mb-2">Level</label>
                  <select
                    value={form.level}
                    onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                    className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E]"
                  >
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {capitalize(l)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Parent email (create only) */}
              {!editingId && (
                <div>
                  <label className="block text-sm font-bold text-[#6B5744] mb-2">
                    Parent Email{' '}
                    <span className="font-normal text-[#6B5744]">(optional — links to existing account)</span>
                  </label>
                  <input
                    type="email"
                    value={form.parentEmail}
                    onChange={(e) => setForm((f) => ({ ...f, parentEmail: e.target.value }))}
                    className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E]"
                    placeholder="parent@example.com"
                  />
                </div>
              )}

              {/* Inline form error */}
              {formError && (
                <p className="text-red-600 text-sm font-semibold">{formError}</p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] transition-all font-bold disabled:opacity-50"
                  style={{ minHeight: '48px' }}
                >
                  {saving ? 'Saving…' : editingId ? 'Update Student' : 'Add Student'}
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

      {/* ── Students table ───────────────────────────────────────────────── */}
      {loading ? (
        <LoadingCard lines={5} />
      ) : (
        <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] overflow-hidden border border-[#E8DEC8]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#E8DEC8] bg-[#F5F0E8]">
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Name</th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Age</th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Level</th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Books</th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Avg Grammar</th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Last Active</th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const levelKey = student.level?.toLowerCase() || 'beginner';
                  const badge = LEVEL_BADGE_STYLES[levelKey] || LEVEL_BADGE_STYLES.beginner;
                  const isExpanded = expandedStudent === student.id;
                  const grammarScore = student.averageGrammarScore ?? student.avgGrammar;

                  return (
                    <React.Fragment key={student.id}>
                      <tr
                        className="border-b border-[#EDE5D4] hover:bg-[#F5F0E8] transition-colors cursor-pointer"
                        onClick={() => toggleExpand(student.id)}
                      >
                        <td className="py-4 px-4 font-bold text-[#3D2E1E]">
                          {student.name}
                        </td>
                        <td className="py-4 px-4 text-[#6B5744] font-semibold">
                          {student.age}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className="px-3 py-1 rounded-full text-xs font-bold"
                            style={{ backgroundColor: badge.bg, color: badge.text }}
                          >
                            {capitalize(student.level)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-[#6B5744] font-bold">
                          {student.booksRead ?? student.total_books_read ?? 0}
                        </td>
                        <td className="py-4 px-4">
                          {grammarScore != null ? (
                            <span
                              className="px-3 py-1 rounded-full text-xs font-bold"
                              style={{
                                backgroundColor: grammarScore >= 7 ? '#C8E6C9' : '#FFF8E1',
                                color: grammarScore >= 7 ? '#2E7D32' : '#8C6D00',
                              }}
                            >
                              {grammarScore}/10
                            </span>
                          ) : (
                            <span className="text-[#6B5744] text-xs">—</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-[#6B5744] text-xs font-semibold">
                          {formatRelativeTime(student.lastActive || student.last_session_date)}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditForm(student);
                              }}
                              className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                              style={{ backgroundColor: '#E0F4F9', color: '#2A7A8C', minHeight: '36px' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/admin/students/${student.id}`);
                              }}
                              className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                              style={{ backgroundColor: '#C8E6C9', color: '#2E7D32', minHeight: '36px' }}
                            >
                              View
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm(student.id);
                              }}
                              className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                              style={{ backgroundColor: '#FCE8E6', color: '#B85A53', minHeight: '36px' }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr className="bg-[#F5F0E8] border-b border-[#E8DEC8]">
                          <td colSpan={7} className="py-4 px-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <h4 className="font-bold text-[#3D2E1E] mb-2">
                                  Vocabulary
                                </h4>
                                <p className="text-sm text-[#6B5744]">
                                  <span className="font-bold text-[#5C8B5C]">
                                    {student.vocabularyCount ?? student.total_words_learned ?? 0}
                                  </span>{' '}
                                  words learned
                                </p>
                              </div>
                              <div>
                                <h4 className="font-bold text-[#3D2E1E] mb-2">
                                  Sessions
                                </h4>
                                <p className="text-sm text-[#6B5744]">
                                  <span className="font-bold text-[#5C8B5C]">
                                    {student.totalSessions ?? 0}
                                  </span>{' '}
                                  total sessions
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredStudents.length === 0 && (
            <div className="text-center py-12">
              <span className="text-4xl block mb-3" aria-hidden="true">🌿</span>
              <p className="text-[#6B5744] text-lg font-semibold">No students found</p>
            </div>
          )}
        </div>
      )}

      {/* Count footer */}
      {!loading && filteredStudents.length > 0 && (
        <p className="text-xs text-[#6B5744] text-right font-semibold">
          Showing {filteredStudents.length} of {students.length} students
        </p>
      )}

      {/* ── Delete confirmation modal ────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-[#3D2E1E]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_8px_40px_rgba(61,46,30,0.25)] max-w-sm w-full p-6 border border-[#E8DEC8]">
            <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-4">Delete Student?</h3>
            <p className="text-[#6B5744] mb-6 font-semibold">
              This will permanently delete the student and all their session data.
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
    </div>
  );
}
