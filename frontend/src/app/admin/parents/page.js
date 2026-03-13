'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, API_BASE } from '@/lib/auth';

/**
 * AdminParentsPage — /admin/parents
 *
 * Full CRUD interface for parent accounts.
 * Supports listing, searching, viewing details (children),
 * editing, deleting, and resetting passwords.
 */

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

/** Format date as a readable string (e.g., "Mar 13, 2026"). */
function formatDate(timestamp) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AdminParentsPage() {
  const router = useRouter();
  const API = API_BASE;

  // ── State ─────────────────────────────────────────────────────────────
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  // Search / filter
  const [searchTerm, setSearchTerm] = useState('');

  // View details
  const [selectedParent, setSelectedParent] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Edit modal
  const [editParent, setEditParent] = useState(null);
  const [editForm, setEditForm] = useState({ display_name: '', phone: '' });
  const [editError, setEditError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Reset password
  const [showResetPassword, setShowResetPassword] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState(null);
  const [resetting, setResetting] = useState(false);

  // Toast
  const [toast, setToast] = useState('');

  // ── Toast auto-dismiss ────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // ── Fetch all parents ─────────────────────────────────────────────────
  const fetchParents = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const r = await fetch(`${API}/api/admin/parents`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (r.status === 401 || r.status === 403) {
        router.push('/');
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setParents(data.parents || data.data?.parents || []);
    } catch (e) {
      console.warn('Fetch parents failed:', e);
      setApiError('Could not load parents. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [API, router]);

  useEffect(() => {
    fetchParents();
  }, [fetchParents]);

  // ── Derived filtered list ─────────────────────────────────────────────
  const filteredParents = parents.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.email?.toLowerCase().includes(term) ||
      p.display_name?.toLowerCase().includes(term) ||
      p.displayName?.toLowerCase().includes(term)
    );
  });

  // ── View details (fetch parent + children) ────────────────────────────
  const handleViewDetails = async (parent) => {
    if (selectedParent?.id === parent.id) {
      setSelectedParent(null);
      return;
    }
    setDetailsLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/parents/${parent.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setSelectedParent(data.parent || data.data?.parent || data);
    } catch (err) {
      console.warn('Fetch parent details failed:', err);
      // Fall back to showing the parent data we already have
      setSelectedParent({ ...parent, children: [] });
      setToast('Could not load full details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  // ── Edit parent ───────────────────────────────────────────────────────
  const openEditModal = (parent) => {
    setEditParent(parent);
    setEditForm({
      display_name: parent.display_name || parent.displayName || '',
      phone: parent.phone || '',
    });
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditParent(null);
    setEditError(null);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editParent) return;

    setSaving(true);
    setEditError(null);
    try {
      const r = await fetch(`${API}/api/admin/parents/${editParent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          display_name: editForm.display_name.trim(),
          phone: editForm.phone.trim(),
        }),
      });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${r.status}`);
      }
      closeEditModal();
      setToast('Parent updated successfully.');
      fetchParents();
    } catch (err) {
      setEditError(err.message || 'Update failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete parent ─────────────────────────────────────────────────────
  const handleDelete = async (parentId) => {
    setDeleting(true);
    try {
      const r = await fetch(`${API}/api/admin/parents/${parentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setDeleteConfirm(null);
      setToast('Parent deleted successfully.');
      // Clear details if we deleted the currently viewed parent
      if (selectedParent?.id === parentId) setSelectedParent(null);
      fetchParents();
    } catch (err) {
      console.warn('Delete failed:', err);
      setToast('Delete failed. Please try again.');
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  // ── Reset password ────────────────────────────────────────────────────
  const openResetPasswordModal = (parent) => {
    setShowResetPassword(parent);
    setNewPassword('');
    setResetError(null);
  };

  const closeResetPasswordModal = () => {
    setShowResetPassword(null);
    setNewPassword('');
    setResetError(null);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!showResetPassword) return;

    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }

    setResetting(true);
    setResetError(null);
    try {
      const r = await fetch(
        `${API}/api/admin/parents/${showResetPassword.id}/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ new_password: newPassword }),
        }
      );
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${r.status}`);
      }
      closeResetPasswordModal();
      setToast('Password reset successfully.');
    } catch (err) {
      setResetError(err.message || 'Reset failed. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  // ── Helper: get display name ──────────────────────────────────────────
  const getDisplayName = (parent) =>
    parent.display_name || parent.displayName || '—';

  const getChildrenCount = (parent) =>
    parent.childrenCount ?? parent.children_count ?? parent.children?.length ?? 0;

  const getCoppaConsent = (parent) =>
    parent.coppa_consent ?? parent.coppaConsent ?? false;

  // ────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Toast notification ──────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-6 right-6 z-[60] animate-fade-in">
          <div className="bg-[#3D6B3D] text-white px-6 py-3 rounded-xl shadow-[0_4px_20px_rgba(61,46,30,0.25)] font-bold text-sm flex items-center gap-2">
            <span>{toast}</span>
            <button
              onClick={() => setToast('')}
              className="ml-2 text-green-200 hover:text-white transition-colors"
            >
              x
            </button>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link
            href="/admin"
            className="text-[#5C8B5C] hover:text-[#3D6B3D] text-sm font-bold transition-colors"
          >
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-3xl font-extrabold text-[#3D2E1E] mt-1">
            Parent Management
          </h1>
        </div>
      </div>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by email or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#FFFCF3] text-[#3D2E1E] placeholder-[#6B5744] font-semibold"
          />
        </div>
      </div>

      {/* ── API Error Banner ────────────────────────────────────────────── */}
      {apiError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-semibold flex items-center gap-2">
          <span aria-hidden="true">!</span> {apiError}
          <button
            onClick={fetchParents}
            className="ml-auto px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-bold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Edit Modal ──────────────────────────────────────────────────── */}
      {editParent && (
        <div className="fixed inset-0 bg-[#3D2E1E]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_8px_40px_rgba(61,46,30,0.25)] max-w-md w-full p-6 border border-[#E8DEC8]">
            <h2 className="text-2xl font-extrabold text-[#3D2E1E] mb-1">
              Edit Parent
            </h2>
            <p className="text-sm text-[#6B5744] font-semibold mb-4">
              {editParent.email}
            </p>

            <form onSubmit={handleEdit} className="space-y-4" noValidate>
              {/* Display Name */}
              <div>
                <label className="block text-sm font-bold text-[#6B5744] mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editForm.display_name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, display_name: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E]"
                  placeholder="Parent name"
                  autoFocus
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-bold text-[#6B5744] mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E]"
                  placeholder="Phone number"
                />
              </div>

              {/* Inline form error */}
              {editError && (
                <p className="text-red-600 text-sm font-semibold">{editError}</p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] transition-all font-bold disabled:opacity-50"
                  style={{ minHeight: '48px' }}
                >
                  {saving ? 'Saving...' : 'Update Parent'}
                </button>
                <button
                  type="button"
                  onClick={closeEditModal}
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

      {/* ── Reset Password Modal ────────────────────────────────────────── */}
      {showResetPassword && (
        <div className="fixed inset-0 bg-[#3D2E1E]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_8px_40px_rgba(61,46,30,0.25)] max-w-md w-full p-6 border border-[#E8DEC8]">
            <h2 className="text-2xl font-extrabold text-[#3D2E1E] mb-1">
              Reset Password
            </h2>
            <p className="text-sm text-[#6B5744] font-semibold mb-4">
              {showResetPassword.email}
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
              <div>
                <label className="block text-sm font-bold text-[#6B5744] mb-2">
                  New Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E]"
                  placeholder="Minimum 6 characters"
                  minLength={6}
                  autoFocus
                />
                <p className="text-xs text-[#6B5744] mt-1 font-semibold">
                  Must be at least 6 characters.
                </p>
              </div>

              {/* Inline error */}
              {resetError && (
                <p className="text-red-600 text-sm font-semibold">{resetError}</p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={resetting || newPassword.length < 6}
                  className="flex-1 px-4 py-3 bg-[#D4A843] text-white rounded-xl hover:bg-[#B8903A] transition-all font-bold disabled:opacity-50"
                  style={{ minHeight: '48px' }}
                >
                  {resetting ? 'Resetting...' : 'Reset Password'}
                </button>
                <button
                  type="button"
                  onClick={closeResetPasswordModal}
                  disabled={resetting}
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

      {/* ── Delete Confirmation Modal ───────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-[#3D2E1E]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_8px_40px_rgba(61,46,30,0.25)] max-w-sm w-full p-6 border border-[#E8DEC8]">
            <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-4">
              Delete Parent?
            </h3>
            <p className="text-[#6B5744] mb-6 font-semibold">
              Are you sure you want to delete{' '}
              <span className="text-[#3D2E1E] font-extrabold">
                {deleteConfirm.email}
              </span>
              ? This will also delete all their children.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
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

      {/* ── Parents Table ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
          <div className="space-y-4 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 bg-[#EDE5D4] rounded w-1/4" />
                <div className="h-4 bg-[#EDE5D4] rounded w-1/5" />
                <div className="h-4 bg-[#EDE5D4] rounded w-1/6" />
                <div className="h-4 bg-[#EDE5D4] rounded w-1/6" />
                <div className="h-4 bg-[#EDE5D4] rounded w-1/5" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] overflow-hidden border border-[#E8DEC8]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#E8DEC8] bg-[#F5F0E8]">
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">
                    Email
                  </th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">
                    Display Name
                  </th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">
                    Children
                  </th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">
                    COPPA Consent
                  </th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">
                    Created
                  </th>
                  <th className="text-left py-4 px-4 font-bold text-[#6B5744]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredParents.map((parent) => {
                  const isExpanded = selectedParent?.id === parent.id;
                  const consent = getCoppaConsent(parent);

                  return (
                    <React.Fragment key={parent.id}>
                      <tr
                        className={`border-b border-[#EDE5D4] hover:bg-[#F5F0E8] transition-colors ${
                          isExpanded ? 'bg-[#F5F0E8]' : ''
                        }`}
                      >
                        <td className="py-4 px-4 font-bold text-[#3D2E1E]">
                          {parent.email}
                        </td>
                        <td className="py-4 px-4 text-[#6B5744] font-semibold">
                          {getDisplayName(parent)}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className="px-3 py-1 rounded-full text-xs font-bold"
                            style={{
                              backgroundColor: '#E0F4F9',
                              color: '#2A7A8C',
                            }}
                          >
                            {getChildrenCount(parent)}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className="px-3 py-1 rounded-full text-xs font-bold"
                            style={{
                              backgroundColor: consent ? '#C8E6C9' : '#FFF8E1',
                              color: consent ? '#2E7D32' : '#8C6D00',
                            }}
                          >
                            {consent ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-[#6B5744] text-xs font-semibold">
                          {formatDate(parent.created_at || parent.createdAt)}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => handleViewDetails(parent)}
                              className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                              style={{
                                backgroundColor: isExpanded
                                  ? '#5C8B5C'
                                  : '#C8E6C9',
                                color: isExpanded ? '#FFFFFF' : '#2E7D32',
                                minHeight: '36px',
                              }}
                            >
                              {isExpanded ? 'Close' : 'View'}
                            </button>
                            <button
                              onClick={() => openEditModal(parent)}
                              className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                              style={{
                                backgroundColor: '#E0F4F9',
                                color: '#2A7A8C',
                                minHeight: '36px',
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => openResetPasswordModal(parent)}
                              className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                              style={{
                                backgroundColor: '#FFF8E1',
                                color: '#8C6D00',
                                minHeight: '36px',
                              }}
                            >
                              Reset PW
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(parent)}
                              className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                              style={{
                                backgroundColor: '#FCE8E6',
                                color: '#B85A53',
                                minHeight: '36px',
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail row — children list */}
                      {isExpanded && (
                        <tr className="bg-[#F5F0E8] border-b border-[#E8DEC8]">
                          <td colSpan={6} className="py-4 px-6">
                            {detailsLoading ? (
                              <div className="text-sm text-[#6B5744] font-semibold animate-pulse">
                                Loading details...
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {/* Parent info summary */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <h4 className="font-bold text-[#3D2E1E] mb-1 text-xs uppercase tracking-wide">
                                      Email
                                    </h4>
                                    <p className="text-sm text-[#6B5744] font-semibold">
                                      {selectedParent.email}
                                    </p>
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-[#3D2E1E] mb-1 text-xs uppercase tracking-wide">
                                      Phone
                                    </h4>
                                    <p className="text-sm text-[#6B5744] font-semibold">
                                      {selectedParent.phone || '—'}
                                    </p>
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-[#3D2E1E] mb-1 text-xs uppercase tracking-wide">
                                      Joined
                                    </h4>
                                    <p className="text-sm text-[#6B5744] font-semibold">
                                      {formatDate(
                                        selectedParent.created_at ||
                                          selectedParent.createdAt
                                      )}
                                    </p>
                                  </div>
                                </div>

                                {/* Children list */}
                                <div>
                                  <h4 className="font-bold text-[#3D2E1E] mb-2 text-xs uppercase tracking-wide">
                                    Children (
                                    {selectedParent.children?.length ?? 0})
                                  </h4>
                                  {selectedParent.children?.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {selectedParent.children.map((child) => (
                                        <div
                                          key={child.id}
                                          className="bg-[#FFFCF3] rounded-xl p-3 border border-[#E8DEC8] flex items-center justify-between"
                                        >
                                          <div>
                                            <p className="font-bold text-[#3D2E1E] text-sm">
                                              {child.name}
                                            </p>
                                            <p className="text-xs text-[#6B5744] font-semibold">
                                              Age {child.age} &middot;{' '}
                                              {child.level
                                                ? child.level
                                                    .charAt(0)
                                                    .toUpperCase() +
                                                  child.level.slice(1)
                                                : 'Beginner'}
                                            </p>
                                          </div>
                                          <Link
                                            href={`/admin/students/${child.id}`}
                                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#E0F4F9] text-[#2A7A8C] hover:bg-[#C0E9F3] transition-colors"
                                          >
                                            View
                                          </Link>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-[#6B5744] font-semibold">
                                      No children linked to this account.
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Empty state */}
          {filteredParents.length === 0 && (
            <div className="text-center py-12">
              <span className="text-4xl block mb-3" aria-hidden="true">
                {searchTerm ? '🔍' : '🌿'}
              </span>
              <p className="text-[#6B5744] text-lg font-semibold">
                {searchTerm
                  ? 'No parents match your search'
                  : 'No parent accounts found'}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-3 px-4 py-2 bg-[#EDE5D4] text-[#3D2E1E] rounded-xl hover:bg-[#D6C9A8] transition-all font-bold text-sm"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Count footer */}
      {!loading && filteredParents.length > 0 && (
        <p className="text-xs text-[#6B5744] text-right font-semibold">
          Showing {filteredParents.length} of {parents.length} parents
        </p>
      )}
    </div>
  );
}
