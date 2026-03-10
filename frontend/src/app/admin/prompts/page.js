'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ─── Constants ────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const getToken = () =>
  typeof window !== 'undefined' ? sessionStorage.getItem('authToken') : null;

const STAGES = ['title', 'introduction', 'body', 'conclusion'];

const STAGE_DISPLAY = {
  title:        { label: 'Title',        color: '#4A7C59' },
  introduction: { label: 'Introduction', color: '#5BA8B8' },
  body:         { label: 'Body',         color: '#D4A843' },
  conclusion:   { label: 'Conclusion',   color: '#7AC87A' },
};

const LEVELS = ['beginner', 'intermediate', 'advanced'];

const DEFAULT_PROMPTS = {
  title: `Current Stage: TITLE (Explore the title)\n\nMain Question: "What do you think the title means? Why did the author choose this title?"\n\nFollow-up prompts if student struggles:\n1. "Does the title give you any hints about what the book is about?"\n2. "How does the title make you feel?"\n3. "Can you think of an alternative title for this book?"`,
  introduction: `Current Stage: INTRODUCTION (Meet the characters)\n\nMain Question: "Who is the main character? How would you describe them?"\n\nFollow-up prompts if student struggles:\n1. "What does the character look like?"\n2. "What is the character's personality like?"\n3. "How do you think the character feels at the beginning of the story?"`,
  body: `Current Stage: BODY (Share your thoughts)\n\nMain Question: "Can you give me three reasons why you think that? Let's start with your first reason."\n\nFollow-up prompts:\n1. First reason: "What's one reason you liked/didn't like the book?"\n2. Second reason: "What's another reason? Can you find evidence in the book?"\n3. Third reason: "What's your third reason? How does this connect to the story?"`,
  conclusion: `Current Stage: CONCLUSION (Wrap up)\n\nMain Question: "What did this book teach you? Would you recommend it to a friend?"\n\nFollow-up prompts:\n1. "What was the most important lesson from this book?"\n2. "How did reading this book make you feel?"\n3. "Who do you think would enjoy reading this book? Why?"`,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Auto-dismissing toast. */
function Toast({ message, type, onDismiss }) {
  if (!message) return null;
  const bg   = type === 'error' ? '#FCE8E6' : '#E8F5E8';
  const text = type === 'error' ? '#B85A53' : '#2E7D32';
  const icon = type === 'error' ? '⚠' : '✓';
  return (
    <div
      role="alert"
      className="fixed top-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg font-bold text-sm animate-fade-in cursor-pointer"
      style={{ backgroundColor: bg, color: text, border: `1px solid ${text}40`, maxWidth: 360 }}
      onClick={onDismiss}
    >
      <span>{icon}</span>
      <span className="flex-1">{message}</span>
      <span className="ml-2 opacity-60 text-xs">click to dismiss</span>
    </div>
  );
}

/** Chat bubble for AI response preview. */
function AliceBubble({ text, loading }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-extrabold text-white shadow-ghibli"
        style={{ background: 'linear-gradient(135deg, #4A7C59, #2C4A2E)' }}
        aria-hidden="true"
      >
        A
      </div>
      <div
        className="flex-1 px-5 py-4 rounded-2xl rounded-tl-sm text-sm font-semibold leading-relaxed shadow-sm"
        style={{
          backgroundColor: '#E8F5E8',
          borderColor: '#C8E6C9',
          border: '1px solid',
          color: '#2C4A2E',
          minHeight: 56,
        }}
      >
        {loading ? (
          <span className="flex items-center gap-2" style={{ color: '#9B8777' }}>
            <span className="animate-pulse">HiAlice is thinking</span>
            <span className="animate-bounce">...</span>
          </span>
        ) : (
          text || <span style={{ color: '#9B8777' }}>Response will appear here</span>
        )}
      </div>
    </div>
  );
}

/** Textarea editor with character count. */
function PromptEditor({ label, value, onChange, rows = 12, description }) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-bold" style={{ color: '#6B5744' }}>{label}</label>
      )}
      {description && (
        <p className="text-xs font-semibold" style={{ color: '#9B8777' }}>{description}</p>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A7C59] font-mono text-sm resize-y"
        style={{ backgroundColor: '#F5F0E8', color: '#3D2E1E', minHeight: rows * 24 }}
        spellCheck={false}
      />
      <p className="text-right text-xs font-semibold" style={{ color: '#9B8777' }}>
        {value.length} characters
      </p>
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

export default function PromptsPage() {
  // Prompt state: object with keys title | introduction | body | conclusion
  const [prompts, setPrompts] = useState(DEFAULT_PROMPTS);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [saveLoading, setSaveLoading]       = useState(false);

  // Active stage editor tab
  const [activeStage, setActiveStage] = useState('title');

  // Test section state
  const [testStage,       setTestStage]       = useState('title');
  const [testStudentName, setTestStudentName] = useState('');
  const [testBookTitle,   setTestBookTitle]   = useState('');
  const [testLevel,       setTestLevel]       = useState('intermediate');
  const [testMessage,     setTestMessage]     = useState('');
  const [testResponse,    setTestResponse]    = useState('');
  const [testLoading,     setTestLoading]     = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Load prompts ─────────────────────────────────────────────────────────
  const fetchPrompts = useCallback(async () => {
    setPromptsLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/prompts`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = json.data?.prompts ?? json.data ?? json.prompts ?? {};
      // Merge with defaults so we always have all 4 keys
      const merged = {};
      STAGES.forEach((stage) => {
        merged[stage] = data[stage]?.template ?? data[stage] ?? DEFAULT_PROMPTS[stage];
      });
      setPrompts(merged);
    } catch (err) {
      console.warn('Prompts fetch failed:', err);
      // Silently keep defaults — no error toast on load
    } finally {
      setPromptsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  // ── Save prompts ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaveLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/prompts`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(prompts),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('Prompts saved successfully.');
    } catch (err) {
      console.warn('Save prompts failed:', err);
      showToast('Failed to save prompts. Please try again.', 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  // ── Test prompt ──────────────────────────────────────────────────────────
  const handleTest = async () => {
    if (!testStudentName.trim() || !testBookTitle.trim() || !testMessage.trim()) {
      showToast('Please fill in student name, book title, and student message to test.', 'error');
      return;
    }
    setTestLoading(true);
    setTestResponse('');
    try {
      const res = await fetch(`${API}/api/admin/prompts/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          stage:         testStage,
          studentName:   testStudentName.trim(),
          bookTitle:     testBookTitle.trim(),
          level:         testLevel,
          studentMessage: testMessage.trim(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const reply = json.data?.response ?? json.response ?? '(No response returned)';
      setTestResponse(reply);
    } catch (err) {
      console.warn('Test prompt failed:', err);
      showToast('Test failed. Please check the API connection.', 'error');
      setTestResponse('');
    } finally {
      setTestLoading(false);
    }
  };

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <>
      <Toast
        message={toast?.message}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />

      <div className="space-y-6">
        {/* Back link + heading */}
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
            style={{
              backgroundColor: '#EDE5D4',
              color: '#3D2E1E',
              minHeight: '40px',
            }}
          >
            <span aria-hidden="true">←</span> Back to Admin
          </Link>
          <h1 className="text-3xl font-extrabold" style={{ color: '#3D2E1E' }}>
            HiAlice AI Prompt Management
          </h1>
        </div>

        {/* Info banner */}
        <div
          className="rounded-2xl p-4 border text-sm font-semibold"
          style={{ backgroundColor: '#E8F5E8', borderColor: '#C8E6C9', color: '#2C4A2E' }}
        >
          Edit the four stage-specific prompts below. These templates guide HiAlice's
          behavior during each phase of the Socratic Q&amp;A session. Use the Test section to
          preview AI responses before saving.
        </div>

        {/* Loading shimmer */}
        {promptsLoading && (
          <div className="space-y-3">
            {[100, 80, 90].map((w, i) => (
              <div
                key={i}
                className="h-5 rounded-xl animate-shimmer"
                style={{ backgroundColor: '#EDE5D4', width: `${w}%` }}
              />
            ))}
          </div>
        )}

        {/* Stage editor */}
        {!promptsLoading && (
          <div className="bg-[#FFFCF3] rounded-2xl border border-[#E8DEC8] shadow-ghibli overflow-hidden">
            {/* Stage tab bar */}
            <div className="flex border-b border-[#E8DEC8]" style={{ backgroundColor: '#F5F0E8' }}>
              {STAGES.map((stage) => {
                const info      = STAGE_DISPLAY[stage];
                const isActive  = activeStage === stage;
                return (
                  <button
                    key={stage}
                    onClick={() => setActiveStage(stage)}
                    className="flex-1 px-4 py-3 font-bold text-sm border-b-4 transition-all"
                    style={{
                      minHeight: '48px',
                      color: isActive ? info.color : '#6B5744',
                      borderBottomColor: isActive ? info.color : 'transparent',
                      backgroundColor: isActive ? '#FFFCF3' : 'transparent',
                    }}
                  >
                    {info.label}
                  </button>
                );
              })}
            </div>

            {/* Active stage editor */}
            <div className="p-6">
              {STAGES.map((stage) =>
                activeStage === stage ? (
                  <PromptEditor
                    key={stage}
                    label={`${STAGE_DISPLAY[stage].label} Stage Template`}
                    description={`This prompt is injected when the student reaches the ${STAGE_DISPLAY[stage].label} stage of the session.`}
                    value={prompts[stage]}
                    onChange={(val) => setPrompts((prev) => ({ ...prev, [stage]: val }))}
                    rows={14}
                  />
                ) : null
              )}

              {/* Save button */}
              <div className="flex items-center gap-4 mt-5 flex-wrap">
                <button
                  onClick={handleSave}
                  disabled={saveLoading}
                  className="px-7 py-3 rounded-xl font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                  style={{
                    minHeight: '48px',
                    backgroundColor: '#4A7C59',
                    color: '#fff',
                    boxShadow: '0 2px 8px rgba(74,124,89,0.3)',
                  }}
                >
                  {saveLoading ? 'Saving…' : 'Save All Prompts'}
                </button>
                <p className="text-xs font-semibold" style={{ color: '#9B8777' }}>
                  Saves all four stage templates at once.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Test section ──────────────────────────────────────────────── */}
        <div className="bg-[#FFFCF3] rounded-2xl border border-[#E8DEC8] shadow-ghibli overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E8DEC8]" style={{ backgroundColor: '#F5F0E8' }}>
            <h2 className="font-extrabold text-lg" style={{ color: '#3D2E1E' }}>
              Test a Prompt
            </h2>
            <p className="text-sm font-semibold mt-1" style={{ color: '#9B8777' }}>
              Simulate a student message and preview HiAlice's live response.
            </p>
          </div>

          <div className="p-6 space-y-5">
            {/* Stage selector */}
            <div>
              <label className="block text-sm font-bold mb-2" style={{ color: '#6B5744' }}>
                Stage
              </label>
              <div className="flex flex-wrap gap-2">
                {STAGES.map((stage) => {
                  const info    = STAGE_DISPLAY[stage];
                  const isActive = testStage === stage;
                  return (
                    <button
                      key={stage}
                      onClick={() => setTestStage(stage)}
                      className="px-4 py-2 rounded-xl font-bold text-sm transition-all"
                      style={{
                        minHeight: '40px',
                        backgroundColor: isActive ? info.color : '#EDE5D4',
                        color: isActive ? '#fff' : '#3D2E1E',
                      }}
                    >
                      {info.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Student info row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="test-student" className="block text-sm font-bold mb-2" style={{ color: '#6B5744' }}>
                  Student Name
                </label>
                <input
                  id="test-student"
                  type="text"
                  value={testStudentName}
                  onChange={(e) => setTestStudentName(e.target.value)}
                  placeholder="e.g. Emma"
                  className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A7C59] font-semibold"
                  style={{ backgroundColor: '#F5F0E8', color: '#3D2E1E', minHeight: '44px' }}
                />
              </div>
              <div>
                <label htmlFor="test-book" className="block text-sm font-bold mb-2" style={{ color: '#6B5744' }}>
                  Book Title
                </label>
                <input
                  id="test-book"
                  type="text"
                  value={testBookTitle}
                  onChange={(e) => setTestBookTitle(e.target.value)}
                  placeholder="e.g. Charlotte's Web"
                  className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A7C59] font-semibold"
                  style={{ backgroundColor: '#F5F0E8', color: '#3D2E1E', minHeight: '44px' }}
                />
              </div>
              <div>
                <label htmlFor="test-level" className="block text-sm font-bold mb-2" style={{ color: '#6B5744' }}>
                  Student Level
                </label>
                <select
                  id="test-level"
                  value={testLevel}
                  onChange={(e) => setTestLevel(e.target.value)}
                  className="w-full px-4 py-2 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A7C59] font-semibold"
                  style={{ backgroundColor: '#F5F0E8', color: '#3D2E1E', minHeight: '44px' }}
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l.charAt(0).toUpperCase() + l.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Student message */}
            <div>
              <label htmlFor="test-message" className="block text-sm font-bold mb-2" style={{ color: '#6B5744' }}>
                Student Message
              </label>
              <textarea
                id="test-message"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Type what the student says to HiAlice…"
                rows={3}
                className="w-full px-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A7C59] font-semibold resize-y"
                style={{ backgroundColor: '#F5F0E8', color: '#3D2E1E' }}
              />
            </div>

            {/* Student bubble preview */}
            {testMessage.trim() && (
              <div className="flex items-start gap-3 flex-row-reverse">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-extrabold text-white"
                  style={{ background: 'linear-gradient(135deg, #D4A843, #A8822E)' }}
                  aria-hidden="true"
                >
                  {testStudentName.trim().charAt(0).toUpperCase() || 'S'}
                </div>
                <div
                  className="px-5 py-3 rounded-2xl rounded-tr-sm text-sm font-semibold"
                  style={{
                    backgroundColor: '#FFF8E1',
                    border: '1px solid #FFE0B2',
                    color: '#3D2E1E',
                    maxWidth: '70%',
                  }}
                >
                  {testMessage}
                </div>
              </div>
            )}

            {/* HiAlice bubble */}
            {(testLoading || testResponse) && (
              <AliceBubble text={testResponse} loading={testLoading} />
            )}

            {/* Test button */}
            <button
              onClick={handleTest}
              disabled={testLoading}
              className="px-7 py-3 rounded-xl font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50 flex items-center gap-2"
              style={{
                minHeight: '48px',
                backgroundColor: '#5BA8B8',
                color: '#fff',
                boxShadow: '0 2px 8px rgba(91,168,184,0.3)',
              }}
            >
              {testLoading ? (
                <>
                  <span className="animate-pulse">Testing</span>
                  <span className="animate-bounce">...</span>
                </>
              ) : (
                'Test Prompt'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
