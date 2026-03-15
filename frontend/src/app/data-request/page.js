'use client';

import { useState, useEffect, useId } from 'react';
import { useRouter } from 'next/navigation';
import { getItem } from '@/lib/clientStorage';

// ---------------------------------------------------------------------------
// Design tokens — Ghibli palette (mirrors COLORS in constants.js)
// ---------------------------------------------------------------------------
const T = {
  forest: '#3D6B3D',
  leaf: '#5C8B5C',
  cream: '#F5F0E8',
  creamAlt: '#EDE5D4',
  gold: '#D4A843',
  bark: '#3D2E1E',
  textMid: '#6B5744',
  textLight: '#9C8B74',
  border: '#D6C9A8',
  borderLight: '#E8DEC8',
  rose: '#D4736B',
  roseDark: '#B85A53',
  roseLight: '#F9EDEC',
  card: '#FFFCF3',
  successBg: '#EDF6ED',
  infoBg: '#EEF4F8',
  infoText: '#2E5F7A',
};

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_CHILDREN = [
  { id: 'child-001', name: 'Emma', age: 8 },
  { id: 'child-002', name: 'Liam', age: 11 },
];

const MOCK_HISTORY = [
  {
    id: 'REQ-001',
    type: 'export',
    childName: 'Emma',
    requestedAt: '2026-02-20T10:30:00Z',
    status: 'Completed',
    dataTypes: ['Sessions', 'Vocabulary'],
  },
  {
    id: 'REQ-002',
    type: 'export',
    childName: 'Liam',
    requestedAt: '2026-03-01T14:00:00Z',
    status: 'Processing',
    dataTypes: ['All'],
  },
  {
    id: 'DEL-001',
    type: 'deletion',
    childName: 'Emma',
    requestedAt: '2026-03-10T09:15:00Z',
    status: 'Pending',
    dataTypes: [],
  },
];

const DATA_TYPE_OPTIONS = ['Sessions', 'Vocabulary', 'Profile', 'All'];

// Retention info displayed in the info section
const RETENTION_TABLE = [
  { category: 'Reading Sessions', period: '2 years', notes: 'Conversation logs and stage scores' },
  { category: 'Vocabulary', period: '1 year', notes: 'Words learned, mastery levels, context sentences' },
  { category: 'Profile', period: 'Until deleted', notes: "Child's name, age, learning level" },
  { category: 'Voice Recordings', period: 'Not stored', notes: 'Processed in real-time only' },
  { category: 'Parent Email', period: 'Account lifetime', notes: 'Used for authentication and notifications' },
];

// ---------------------------------------------------------------------------
// Mock API functions
// ---------------------------------------------------------------------------

async function requestDataExport(childId, dataTypes) {
  await new Promise((r) => setTimeout(r, 800));
  return {
    success: true,
    requestId: `REQ-${String(Date.now()).slice(-4)}`,
    estimatedDelivery: '48 hours',
  };
}

async function requestAccountDeletion(childId, confirmName) {
  await new Promise((r) => setTimeout(r, 1000));
  return {
    success: true,
    requestId: `DEL-${String(Date.now()).slice(-4)}`,
    coolingOffDays: 30,
  };
}

async function getRequestHistory() {
  await new Promise((r) => setTimeout(r, 400));
  return MOCK_HISTORY;
}

async function cancelRequest(requestId) {
  await new Promise((r) => setTimeout(r, 500));
  return { success: true };
}

// ---------------------------------------------------------------------------
// Shared SVG icons (no emoji — all inline SVG)
// ---------------------------------------------------------------------------

function IconDownload({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconTrash({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function IconInfo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconClock({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconShield({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconCheck({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconX({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconUser({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------

function SectionHeader({ icon, title, subtitle, accentColor }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div
        className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: accentColor + '1A', color: accentColor }}
      >
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-bold" style={{ color: T.bark }}>
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm mt-0.5" style={{ color: T.textMid }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

const STATUS_STYLES = {
  Pending:    { bg: '#FFF8E0', text: '#A8822E', border: '#F0D580' },
  Processing: { bg: T.infoBg, text: T.infoText, border: '#A0C4DA' },
  Completed:  { bg: T.successBg, text: '#2D6B2D', border: '#A0CCA0' },
  Cancelled:  { bg: '#F5F0F0', text: '#8B5E5E', border: '#D4B0B0' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Pending;
  return (
    <span
      className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border"
      style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border }}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// SuccessMessage — inline banner shown after a successful action
// ---------------------------------------------------------------------------

function SuccessMessage({ message, onDismiss }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-xl border p-4"
      style={{
        backgroundColor: T.successBg,
        borderColor: '#A0CCA0',
        color: '#2D6B2D',
      }}
    >
      <span className="flex-shrink-0 mt-0.5" style={{ color: '#2D6B2D' }}>
        <IconCheck size={18} />
      </span>
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3D6B3D]"
        aria-label="Dismiss message"
        style={{ color: '#2D6B2D' }}
      >
        <IconX size={16} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ErrorMessage
// ---------------------------------------------------------------------------

function ErrorMessage({ id, message }) {
  return (
    <p
      id={id}
      role="alert"
      className="text-sm font-medium mt-1"
      style={{ color: T.roseDark }}
    >
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// ChildSelect — reusable dropdown for selecting a child
// ---------------------------------------------------------------------------

function ChildSelect({ id, childProfiles, value, onChange, errorId, describedBy }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-describedby={describedBy}
      className="w-full border rounded-xl px-4 py-3 text-sm appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C8B5C]"
      style={{
        borderColor: T.border,
        backgroundColor: '#FFFFFF',
        color: T.bark,
      }}
    >
      <option value="">-- Select a child --</option>
      {childProfiles.map((child) => (
        <option key={child.id} value={child.id}>
          {child.name} (age {child.age})
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// DataExportSection
// ---------------------------------------------------------------------------

function DataExportSection({ childProfiles }) {
  const selectId = useId();
  const errorSelectId = useId();
  const errorTypesId = useId();

  const [selectedChild, setSelectedChild] = useState('');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');
  const [typeError, setTypeError] = useState('');

  function toggleType(type) {
    if (type === 'All') {
      setSelectedTypes((prev) =>
        prev.includes('All') ? [] : ['All']
      );
      return;
    }
    setSelectedTypes((prev) => {
      const without = prev.filter((t) => t !== 'All');
      return without.includes(type)
        ? without.filter((t) => t !== type)
        : [...without, type];
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setTypeError('');

    if (!selectedChild) {
      setError('Please select a child.');
      return;
    }
    if (selectedTypes.length === 0) {
      setTypeError('Please select at least one data type.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestDataExport(selectedChild, selectedTypes);
      if (result.success) {
        const childName = childProfiles.find((c) => c.id === selectedChild)?.name ?? 'your child';
        setSuccess(
          `Export request submitted for ${childName} (Request ID: ${result.requestId}). ` +
          `Your data will be emailed within ${result.estimatedDelivery}.`
        );
        setSelectedChild('');
        setSelectedTypes([]);
      } else {
        setError('Request failed. Please try again or contact privacy@hialice.com.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="rounded-2xl border p-6 print:border-[#CCC]"
      style={{ backgroundColor: T.card, borderColor: T.borderLight }}
      aria-labelledby="export-heading"
    >
      <SectionHeader
        icon={<IconDownload size={20} />}
        title="Request Data Export"
        subtitle="Receive a copy of your child's learning data via email within 48 hours."
        accentColor={T.forest}
      />

      {success && (
        <div className="mb-4">
          <SuccessMessage message={success} onDismiss={() => setSuccess(null)} />
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Child selector */}
        <div className="mb-4">
          <label
            htmlFor={selectId}
            className="block text-sm font-semibold mb-1.5"
            style={{ color: T.bark }}
          >
            Select Child <span aria-hidden="true" style={{ color: T.roseDark }}>*</span>
          </label>
          <ChildSelect
            id={selectId}
            childProfiles={childProfiles}
            value={selectedChild}
            onChange={setSelectedChild}
            describedBy={error ? errorSelectId : undefined}
          />
          {error && <ErrorMessage id={errorSelectId} message={error} />}
        </div>

        {/* Data types */}
        <fieldset className="mb-5">
          <legend
            className="text-sm font-semibold mb-2"
            style={{ color: T.bark }}
          >
            Data Types to Export <span aria-hidden="true" style={{ color: T.roseDark }}>*</span>
          </legend>
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            aria-describedby={typeError ? errorTypesId : undefined}
          >
            {DATA_TYPE_OPTIONS.map((type) => {
              const checked = selectedTypes.includes(type);
              return (
                <label
                  key={type}
                  className="flex items-center gap-2 cursor-pointer rounded-xl border px-3 py-2.5 transition-colors select-none"
                  style={{
                    borderColor: checked ? T.leaf : T.border,
                    backgroundColor: checked ? '#EDF6ED' : '#FFFFFF',
                    color: T.bark,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleType(type)}
                    className="w-4 h-4 accent-[#5C8B5C] flex-shrink-0"
                  />
                  <span className="text-sm font-medium">{type}</span>
                </label>
              );
            })}
          </div>
          {typeError && <ErrorMessage id={errorTypesId} message={typeError} />}
        </fieldset>

        {/* Info box */}
        <div
          className="flex items-start gap-2 rounded-xl border p-3 mb-5 text-xs"
          style={{
            backgroundColor: T.infoBg,
            borderColor: '#A0C4DA',
            color: T.infoText,
          }}
        >
          <span className="flex-shrink-0 mt-0.5"><IconInfo size={14} /></span>
          <p>
            The export will be sent to your registered email address. Selecting "All" includes
            every data category. Data is delivered as a structured JSON file.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto min-h-[48px] px-8 py-3 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#3D6B3D] focus-visible:ring-offset-2"
          style={{
            backgroundColor: T.forest,
            boxShadow: '0 4px 14px rgba(61,107,61,0.28)',
          }}
        >
          {submitting ? 'Submitting...' : 'Request Export'}
        </button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// DeletionDialog — role="alertdialog" confirmation overlay
// ---------------------------------------------------------------------------

function DeletionDialog({ childName, onConfirm, onCancel, submitting }) {
  const inputId = useId();
  const errorId = useId();
  const [confirmValue, setConfirmValue] = useState('');
  const [inputError, setInputError] = useState('');

  const trimmed = confirmValue.trim();
  const matches = trimmed.toLowerCase() === childName.toLowerCase();

  function handleConfirm(e) {
    e.preventDefault();
    if (!matches) {
      setInputError(`Type "${childName}" exactly to confirm.`);
      return;
    }
    setInputError('');
    onConfirm();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(61,46,30,0.55)', backdropFilter: 'blur(2px)' }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-desc"
        className="w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden"
        style={{ backgroundColor: T.card, borderColor: T.border }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b flex items-center gap-3"
          style={{ borderColor: T.borderLight, backgroundColor: T.roseLight }}
        >
          <span style={{ color: T.roseDark }}>
            <IconTrash size={22} />
          </span>
          <h3
            id="dialog-title"
            className="font-bold text-base"
            style={{ color: T.bark }}
          >
            Confirm Account Deletion
          </h3>
        </div>

        <div className="px-6 py-5">
          {/* Step 1 warning */}
          <div
            className="rounded-xl border p-4 mb-4"
            style={{
              backgroundColor: T.roseLight,
              borderColor: '#F0B8B4',
            }}
          >
            <p id="dialog-desc" className="text-sm font-semibold" style={{ color: T.roseDark }}>
              This will permanently delete all of <strong>{childName}</strong>&apos;s data,
              including sessions, vocabulary progress, and profile information. This action
              cannot be undone after the 30-day cooling-off period.
            </p>
          </div>

          {/* Step 2 name confirmation */}
          <form onSubmit={handleConfirm} noValidate>
            <label
              htmlFor={inputId}
              className="block text-sm font-semibold mb-1.5"
              style={{ color: T.bark }}
            >
              Type <strong>{childName}</strong> to confirm
            </label>
            <input
              id={inputId}
              type="text"
              value={confirmValue}
              onChange={(e) => setConfirmValue(e.target.value)}
              placeholder={childName}
              aria-describedby={inputError ? errorId : undefined}
              autoComplete="off"
              className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4736B]"
              style={{
                borderColor: inputError ? T.rose : T.border,
                color: T.bark,
                backgroundColor: '#FFFFFF',
              }}
            />
            {inputError && <ErrorMessage id={errorId} message={inputError} />}

            {/* Cooling-off notice */}
            <div
              className="flex items-start gap-2 rounded-xl border p-3 mt-4 text-xs"
              style={{
                backgroundColor: '#FFF8E0',
                borderColor: '#F0D580',
                color: '#7A6010',
              }}
            >
              <span className="flex-shrink-0 mt-0.5"><IconClock size={14} /></span>
              <p>
                You have <strong>30 days</strong> to cancel this request after submission.
                After that, all data will be irreversibly deleted.
              </p>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="flex-1 min-h-[48px] rounded-xl border font-semibold text-sm transition-colors hover:bg-[#EDE5D4] focus-visible:ring-2 focus-visible:ring-[#6B5744] focus-visible:ring-offset-2 disabled:opacity-50"
                style={{ borderColor: T.border, color: T.bark }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !matches}
                className="flex-1 min-h-[48px] rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#D4736B] focus-visible:ring-offset-2"
                style={{ backgroundColor: T.rose, boxShadow: '0 4px 14px rgba(212,115,107,0.3)' }}
              >
                {submitting ? 'Processing...' : 'Delete Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AccountDeletionSection
// ---------------------------------------------------------------------------

function AccountDeletionSection({ childProfiles }) {
  const selectId = useId();
  const errorId = useId();

  const [selectedChild, setSelectedChild] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');

  function handleOpenDialog(e) {
    e.preventDefault();
    setError('');
    if (!selectedChild) {
      setError('Please select a child before proceeding.');
      return;
    }
    setShowDialog(true);
  }

  async function handleConfirmDeletion() {
    const child = childProfiles.find((c) => c.id === selectedChild);
    if (!child) return;

    setSubmitting(true);
    try {
      const result = await requestAccountDeletion(selectedChild, child.name);
      if (result.success) {
        setSuccess(
          `Deletion request submitted for ${child.name} (Request ID: ${result.requestId}). ` +
          `You have ${result.coolingOffDays} days to cancel this request.`
        );
        setSelectedChild('');
        setShowDialog(false);
      } else {
        setError('Deletion request failed. Please contact privacy@hialice.com.');
        setShowDialog(false);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setShowDialog(false);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedChildName = childProfiles.find((c) => c.id === selectedChild)?.name ?? '';

  return (
    <>
      {showDialog && (
        <DeletionDialog
          childName={selectedChildName}
          onConfirm={handleConfirmDeletion}
          onCancel={() => setShowDialog(false)}
          submitting={submitting}
        />
      )}

      <section
        className="rounded-2xl border p-6 print:border-[#CCC]"
        style={{
          backgroundColor: T.card,
          borderColor: '#F0B8B4',
          borderLeftWidth: '4px',
          borderLeftColor: T.rose,
        }}
        aria-labelledby="deletion-heading"
      >
        <SectionHeader
          icon={<IconTrash size={20} />}
          title="Request Account Deletion"
          subtitle="Permanently remove your child's account and all associated data."
          accentColor={T.rose}
        />

        {success && (
          <div className="mb-4">
            <SuccessMessage message={success} onDismiss={() => setSuccess(null)} />
          </div>
        )}

        <form onSubmit={handleOpenDialog} noValidate>
          <div className="mb-5">
            <label
              htmlFor={selectId}
              className="block text-sm font-semibold mb-1.5"
              style={{ color: T.bark }}
            >
              Select Child to Delete <span aria-hidden="true" style={{ color: T.roseDark }}>*</span>
            </label>
            <ChildSelect
              id={selectId}
              childProfiles={childProfiles}
              value={selectedChild}
              onChange={setSelectedChild}
              describedBy={error ? errorId : undefined}
            />
            {error && <ErrorMessage id={errorId} message={error} />}
          </div>

          {/* Consequences summary */}
          <div
            className="rounded-xl border p-4 mb-5"
            style={{ backgroundColor: T.roseLight, borderColor: '#F0B8B4' }}
          >
            <p className="text-xs font-bold mb-2" style={{ color: T.roseDark }}>
              What will be permanently deleted:
            </p>
            <ul className="space-y-1" aria-label="Deletion consequences">
              {[
                'All reading session transcripts and scores',
                'Complete vocabulary learning history',
                'Child profile (name, age, level)',
                'All associated worksheets and creations',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs" style={{ color: T.roseDark }}>
                  <span className="flex-shrink-0 mt-0.5"><IconX size={12} /></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto min-h-[48px] px-8 py-3 rounded-xl border-2 font-bold text-sm transition-all hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#D4736B] focus-visible:ring-offset-2"
            style={{
              borderColor: T.rose,
              color: T.rose,
              backgroundColor: 'transparent',
            }}
          >
            Proceed to Delete
          </button>
        </form>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// DataRetentionSection
// ---------------------------------------------------------------------------

function DataRetentionSection() {
  return (
    <section
      className="rounded-2xl border p-6 print:border-[#CCC]"
      style={{ backgroundColor: T.card, borderColor: T.borderLight }}
      aria-labelledby="retention-heading"
    >
      <SectionHeader
        icon={<IconShield size={20} />}
        title="Data Retention Information"
        subtitle="A summary of what data we store and for how long."
        accentColor={T.gold}
      />

      {/* Retention table */}
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: T.borderLight }}>
        <table className="w-full text-sm" aria-label="Data retention periods">
          <thead>
            <tr style={{ backgroundColor: T.creamAlt }}>
              <th
                scope="col"
                className="text-left px-4 py-3 font-semibold text-xs"
                style={{ color: T.textMid }}
              >
                Data Category
              </th>
              <th
                scope="col"
                className="text-left px-4 py-3 font-semibold text-xs"
                style={{ color: T.textMid }}
              >
                Retention Period
              </th>
              <th
                scope="col"
                className="text-left px-4 py-3 font-semibold text-xs hidden sm:table-cell"
                style={{ color: T.textMid }}
              >
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {RETENTION_TABLE.map((row, idx) => (
              <tr
                key={row.category}
                style={{
                  backgroundColor: idx % 2 === 0 ? '#FFFFFF' : T.cream,
                  borderTop: `1px solid ${T.borderLight}`,
                }}
              >
                <td className="px-4 py-3 font-medium" style={{ color: T.bark }}>
                  {row.category}
                </td>
                <td className="px-4 py-3" style={{ color: T.textMid }}>
                  {row.period}
                </td>
                <td
                  className="px-4 py-3 hidden sm:table-cell text-xs"
                  style={{ color: T.textLight }}
                >
                  {row.notes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Deletion consequences */}
      <div
        className="flex items-start gap-3 rounded-xl border p-4 mt-4 text-sm"
        style={{ backgroundColor: T.infoBg, borderColor: '#A0C4DA', color: T.infoText }}
      >
        <span className="flex-shrink-0 mt-0.5"><IconInfo size={16} /></span>
        <div>
          <p className="font-semibold mb-1">After Deletion</p>
          <p className="text-xs">
            Account deletion is irreversible after the 30-day cooling-off window. All data
            is permanently removed from our servers with no possibility of recovery.
            Deletion cascades to all linked records including sessions, vocabulary, and
            generated worksheets.
          </p>
        </div>
      </div>

      {/* Consent audit */}
      <div
        className="flex items-start gap-3 rounded-xl border p-4 mt-3 text-sm"
        style={{ backgroundColor: T.successBg, borderColor: '#A0CCA0', color: '#2D6B2D' }}
      >
        <span className="flex-shrink-0 mt-0.5"><IconCheck size={16} /></span>
        <div>
          <p className="font-semibold mb-1">Consent Audit Trail</p>
          <p className="text-xs">
            COPPA-required parental consent was recorded at account creation. Your consent
            version, timestamp, and legal guardian name are retained for compliance purposes
            for a minimum of 3 years, even after account deletion.
          </p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// RequestHistorySection
// ---------------------------------------------------------------------------

function RequestHistorySection() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    getRequestHistory()
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleCancel(requestId) {
    setCancelling(requestId);
    try {
      const result = await cancelRequest(requestId);
      if (result.success) {
        setHistory((prev) =>
          prev.map((r) =>
            r.id === requestId ? { ...r, status: 'Cancelled' } : r
          )
        );
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setCancelling(null);
    }
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <section
      className="rounded-2xl border p-6 print:border-[#CCC]"
      style={{ backgroundColor: T.card, borderColor: T.borderLight }}
      aria-labelledby="history-heading"
    >
      <SectionHeader
        icon={<IconClock size={20} />}
        title="Request History"
        subtitle="A log of all past data export and deletion requests."
        accentColor={T.textMid}
      />

      {loading ? (
        <div className="text-center py-8" style={{ color: T.textLight }}>
          <p className="text-sm">Loading request history...</p>
        </div>
      ) : history.length === 0 ? (
        <div
          className="rounded-xl border p-6 text-center"
          style={{ borderColor: T.borderLight, backgroundColor: T.cream }}
        >
          <p className="text-sm" style={{ color: T.textMid }}>
            No previous requests found.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: T.borderLight }}>
          <table className="w-full text-sm" aria-label="Request history">
            <thead>
              <tr style={{ backgroundColor: T.creamAlt }}>
                {['Request ID', 'Type', 'Child', 'Date', 'Status', 'Action'].map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className="text-left px-4 py-3 font-semibold text-xs whitespace-nowrap"
                    style={{ color: T.textMid }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((req, idx) => (
                <tr
                  key={req.id}
                  style={{
                    backgroundColor: idx % 2 === 0 ? '#FFFFFF' : T.cream,
                    borderTop: `1px solid ${T.borderLight}`,
                  }}
                >
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: T.bark }}>
                    {req.id}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-medium"
                      style={{ color: req.type === 'deletion' ? T.roseDark : T.forest }}
                    >
                      {req.type === 'deletion'
                        ? <IconTrash size={12} />
                        : <IconDownload size={12} />}
                      {req.type === 'deletion' ? 'Deletion' : 'Export'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: T.bark }}>
                    {req.childName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: T.textMid }}>
                    {formatDate(req.requestedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="px-4 py-3">
                    {req.status === 'Pending' ? (
                      <button
                        onClick={() => handleCancel(req.id)}
                        disabled={cancelling === req.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:bg-[#F9EDEC] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#D4736B]"
                        style={{ borderColor: T.rose, color: T.rose }}
                        aria-label={`Cancel request ${req.id}`}
                      >
                        {cancelling === req.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    ) : (
                      <span className="text-xs" style={{ color: T.textLight }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// AccessDenied — shown to non-parent visitors
// ---------------------------------------------------------------------------

function AccessDenied() {
  const router = useRouter();
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: T.cream }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-8 text-center shadow-md"
        style={{ backgroundColor: T.card, borderColor: T.border }}
      >
        <div className="flex justify-center mb-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: T.roseLight, color: T.roseDark }}
          >
            <IconShield size={32} />
          </div>
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ color: T.bark }}>
          Parents Only
        </h1>
        <p className="text-sm mb-6" style={{ color: T.textMid }}>
          This page is restricted to verified parents and legal guardians. Please log in
          with a parent account to manage your child&apos;s data.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="w-full min-h-[48px] rounded-xl font-bold text-sm text-white focus-visible:ring-2 focus-visible:ring-[#3D6B3D] focus-visible:ring-offset-2"
          style={{ backgroundColor: T.forest }}
        >
          Go to Login
        </button>
        <a
          href="/privacy-policy"
          className="block mt-3 text-xs underline"
          style={{ color: T.leaf }}
        >
          Read our Privacy Policy
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page — DataRequestPage
// ---------------------------------------------------------------------------

export default function DataRequestPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState('loading'); // 'loading' | 'denied' | 'allowed'
  const [parentEmail, setParentEmail] = useState('');
  const [children, setChildren] = useState(MOCK_CHILDREN);

  // Auth guard — check role on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const role = getItem('userRole');
    const email = getItem('parentEmail');
    const token = getItem('token');

    if (!token) {
      router.push('/login');
      return;
    }
    if (role !== 'parent') {
      setAuthState('denied');
      return;
    }

    setParentEmail(email || '');
    setAuthState('allowed');

    // In a real implementation this would fetch children from the API
    // using parentId from sessionStorage. Mock data is used here.
  }, [router]);

  if (authState === 'loading') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: T.cream }}
      >
        <p className="text-sm font-medium" style={{ color: T.textMid }}>
          Verifying access...
        </p>
      </div>
    );
  }

  if (authState === 'denied') {
    return <AccessDenied />;
  }

  return (
    <div
      className="min-h-screen py-10 px-4 print:py-4 print:px-0"
      style={{ backgroundColor: T.cream }}
    >
      <div className="max-w-2xl mx-auto space-y-8">

        {/* ---------------------------------------------------------------- */}
        {/* Page header                                                       */}
        {/* ---------------------------------------------------------------- */}
        <header>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium mb-5 focus-visible:ring-2 focus-visible:ring-[#5C8B5C] rounded print:hidden"
            style={{ color: T.leaf }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Dashboard
          </a>

          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: '#E8F0E8', color: T.forest }}
            >
              <IconUser size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: T.bark }}>
                Data Management
              </h1>
              <p className="text-sm" style={{ color: T.textMid }}>
                COPPA-compliant data rights for parents and legal guardians
              </p>
            </div>
          </div>

          {/* Parent identity confirmation bar */}
          <div
            className="flex items-center gap-2 rounded-xl border px-4 py-3 mt-4 text-xs"
            style={{
              backgroundColor: T.successBg,
              borderColor: '#A0CCA0',
              color: '#2D6B2D',
            }}
          >
            <IconShield size={14} />
            <span>
              <strong>Verified parent account</strong>
              {parentEmail ? ` — ${parentEmail}` : ''}
              . All actions on this page are logged for compliance.
            </span>
          </div>

          {/* Print button — compliance records */}
          <div className="flex justify-end mt-3 print:hidden">
            <button
              onClick={() => window.print()}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-[#EDE5D4] focus-visible:ring-2 focus-visible:ring-[#6B5744]"
              style={{ borderColor: T.border, color: T.textMid }}
              aria-label="Print this page for compliance records"
            >
              Print for records
            </button>
          </div>
        </header>

        {/* ---------------------------------------------------------------- */}
        {/* Section 1: Data Export                                           */}
        {/* ---------------------------------------------------------------- */}
        <DataExportSection childProfiles={children} />

        {/* ---------------------------------------------------------------- */}
        {/* Section 2: Account Deletion                                      */}
        {/* ---------------------------------------------------------------- */}
        <AccountDeletionSection childProfiles={children} />

        {/* ---------------------------------------------------------------- */}
        {/* Section 3: Data Retention Information                            */}
        {/* ---------------------------------------------------------------- */}
        <DataRetentionSection />

        {/* ---------------------------------------------------------------- */}
        {/* Section 4: Request History                                       */}
        {/* ---------------------------------------------------------------- */}
        <RequestHistorySection />

        {/* ---------------------------------------------------------------- */}
        {/* Footer — contact and policy links                                */}
        {/* ---------------------------------------------------------------- */}
        <footer
          className="rounded-2xl border p-5 text-center text-sm"
          style={{ backgroundColor: T.card, borderColor: T.borderLight, color: T.textMid }}
        >
          <p className="mb-2">
            For additional assistance or urgent requests, contact our Privacy Team:
          </p>
          <a
            href="mailto:privacy@hialice.com"
            className="font-semibold underline focus-visible:ring-2 focus-visible:ring-[#5C8B5C] rounded"
            style={{ color: T.leaf }}
          >
            privacy@hialice.com
          </a>
          <div className="mt-3 flex justify-center gap-4 text-xs">
            <a
              href="/privacy-policy"
              className="underline focus-visible:ring-2 focus-visible:ring-[#5C8B5C] rounded"
              style={{ color: T.leaf }}
            >
              Privacy Policy
            </a>
            <span aria-hidden="true" style={{ color: T.borderLight }}>|</span>
            <a
              href="/consent"
              className="underline focus-visible:ring-2 focus-visible:ring-[#5C8B5C] rounded"
              style={{ color: T.leaf }}
            >
              Consent Settings
            </a>
          </div>
          <p className="mt-3 text-xs" style={{ color: T.textLight }}>
            HiAlice is COPPA-compliant. Last updated: March 2026 | Version 1.0
          </p>
        </footer>
      </div>
    </div>
  );
}
