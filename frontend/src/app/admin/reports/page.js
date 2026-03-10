'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ─── Constants ────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const getToken = () =>
  typeof window !== 'undefined' ? sessionStorage.getItem('authToken') : null;

const LEVEL_CARD_STYLES = {
  beginner:     { bg: '#C8E6C9', text: '#2E7D32', valueBg: '#E8F5E8', border: '#A5D6A7' },
  intermediate: { bg: '#FFE0B2', text: '#E65100', valueBg: '#FFF8E1', border: '#FFCC80' },
  advanced:     { bg: '#E1BEE7', text: '#6A1B9A', valueBg: '#F3E5F5', border: '#CE93D8' },
};

// ─── Utility helpers ──────────────────────────────────────────────────────────

/** Convert a nested object / array to flat CSV rows. */
function exportDataToCSV(exportPayload) {
  const { students = [], books = [], sessions = [], vocabulary = [] } = exportPayload;

  const buildSection = (title, rows, keys) => {
    if (!rows.length) return '';
    const header = keys.join(',');
    const body = rows
      .map((r) => keys.map((k) => JSON.stringify(r[k] ?? '')).join(','))
      .join('\n');
    return `${title}\n${header}\n${body}\n\n`;
  };

  const studentKeys   = ['id', 'name', 'age', 'level', 'created_at'];
  const bookKeys      = ['id', 'title', 'author', 'level', 'genre'];
  const sessionKeys   = ['id', 'student_id', 'book_id', 'stage', 'completed_at', 'grammar_score'];
  const vocabKeys     = ['id', 'student_id', 'word', 'pos', 'mastery_level', 'use_count'];

  return (
    buildSection('STUDENTS', students, studentKeys) +
    buildSection('BOOKS', books, bookKeys) +
    buildSection('SESSIONS', sessions, sessionKeys) +
    buildSection('VOCABULARY', vocabulary, vocabKeys)
  );
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** SVG line chart — pure CSS-free, no external deps. */
function LineChart({ data, color = '#4A7C59', height = 180 }) {
  if (!data || data.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl text-sm font-semibold"
        style={{ height, backgroundColor: '#F5F0E8', color: '#9B8777' }}
      >
        Not enough data
      </div>
    );
  }
  const maxVal = Math.max(...data);
  const minVal = Math.min(...data);
  const range  = maxVal - minVal || 1;
  const W = 300;
  const H = height;
  const pad = 20;

  const pts = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (W - pad * 2);
      const y = H - pad - ((v - minVal) / range) * (H - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints =
    `${pad},${H - pad} ` +
    pts +
    ` ${pad + ((data.length - 1) / (data.length - 1)) * (W - pad * 2)},${H - pad}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height, background: '#FFFCF3', borderRadius: 12, border: '1px solid #E8DEC8' }}
      aria-label="Line chart"
    >
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
        <line
          key={i}
          x1={pad} y1={H - pad - pct * (H - pad * 2)}
          x2={W - pad} y2={H - pad - pct * (H - pad * 2)}
          stroke="#EDE5D4" strokeWidth="1"
        />
      ))}
      {/* Filled area */}
      <polygon points={areaPoints} fill={color} fillOpacity="0.08" />
      {/* Line */}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Dots */}
      {data.map((v, i) => {
        const x = pad + (i / (data.length - 1)) * (W - pad * 2);
        const y = H - pad - ((v - minVal) / range) * (H - pad * 2);
        return <circle key={i} cx={x} cy={y} r="4" fill={color} stroke="#FFFCF3" strokeWidth="2" />;
      })}
      {/* Min / max labels */}
      <text x={pad + 2} y={pad - 4} fontSize="9" fill="#9B8777">{maxVal}</text>
      <text x={pad + 2} y={H - 4} fontSize="9" fill="#9B8777">{minVal}</text>
    </svg>
  );
}

/** Horizontal progress bar row. */
function HorizontalBar({ label, value, max = 100, color = '#4A7C59', suffix = '%' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm font-semibold" style={{ color: '#6B5744' }}>
        <span>{label}</span>
        <span style={{ color: '#3D2E1E' }}>{value}{suffix}</span>
      </div>
      <div className="w-full h-3 rounded-full" style={{ backgroundColor: '#E8DEC8' }}>
        <div
          className="h-3 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/** Small toast notification. */
function Toast({ message, type }) {
  if (!message) return null;
  const bg   = type === 'error' ? '#FCE8E6' : '#E8F5E8';
  const text = type === 'error' ? '#B85A53' : '#2E7D32';
  const icon = type === 'error' ? '⚠' : '✓';
  return (
    <div
      className="fixed top-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg font-bold text-sm animate-fade-in"
      style={{ backgroundColor: bg, color: text, border: `1px solid ${text}30` }}
      role="alert"
    >
      <span>{icon}</span>
      {message}
    </div>
  );
}

/** Loading skeleton card. */
function SkeletonCard({ lines = 3 }) {
  return (
    <div className="bg-[#FFFCF3] rounded-2xl p-6 border border-[#E8DEC8] space-y-3 animate-shimmer">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 rounded-lg" style={{ backgroundColor: '#EDE5D4', width: `${80 - i * 10}%` }} />
      ))}
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

export default function ReportsPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState('overview');

  // Overview data
  const [overview, setOverview]     = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError]     = useState(null);

  // Student list
  const [students, setStudents]         = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  // Selected student report
  const [selectedStudentId, setSelectedStudentId]     = useState('');
  const [studentReport, setStudentReport]             = useState(null);
  const [studentReportLoading, setStudentReportLoading] = useState(false);
  const [studentReportError, setStudentReportError]     = useState(null);

  // Export
  const [exportLoading, setExportLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch overview ───────────────────────────────────────────────────────
  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await fetch(`${API}/api/admin/reports/overview`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setOverview(json.data);
    } catch (err) {
      console.warn('Overview fetch failed:', err);
      setOverviewError('Could not load overview data. Please try again.');
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  // ── Fetch student list ───────────────────────────────────────────────────
  const fetchStudents = useCallback(async () => {
    setStudentsLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/students`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setStudents(json.students || json.data?.students || []);
    } catch (err) {
      console.warn('Students fetch failed:', err);
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    fetchStudents();
  }, [fetchOverview, fetchStudents]);

  // ── Fetch individual student report ─────────────────────────────────────
  const fetchStudentReport = useCallback(async (studentId) => {
    if (!studentId) return;
    setStudentReportLoading(true);
    setStudentReportError(null);
    setStudentReport(null);
    try {
      const res = await fetch(`${API}/api/admin/reports/student/${studentId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setStudentReport(json.data);
    } catch (err) {
      console.warn('Student report fetch failed:', err);
      setStudentReportError('Could not load student report. Please try again.');
    } finally {
      setStudentReportLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStudentId) {
      fetchStudentReport(selectedStudentId);
    }
  }, [selectedStudentId, fetchStudentReport]);

  // ── Export as JSON ───────────────────────────────────────────────────────
  const handleExportJSON = async () => {
    setExportLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/reports/export`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const exportData = json.data?.export ?? json.data ?? json;
      const timestamp = exportData.timestamp || new Date().toISOString().slice(0, 10);
      downloadBlob(
        JSON.stringify(exportData, null, 2),
        `hialice-export-${timestamp}.json`,
        'application/json'
      );
      showToast('JSON export downloaded.');
    } catch (err) {
      console.warn('Export failed:', err);
      showToast('Export failed. Please try again.', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  // ── Export as CSV ────────────────────────────────────────────────────────
  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/reports/export`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const exportData = json.data?.export ?? json.data ?? json;
      const csv = exportDataToCSV(exportData);
      const timestamp = exportData.timestamp || new Date().toISOString().slice(0, 10);
      downloadBlob(csv, `hialice-export-${timestamp}.csv`, 'text/csv');
      showToast('CSV export downloaded.');
    } catch (err) {
      console.warn('CSV export failed:', err);
      showToast('Export failed. Please try again.', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────

  const renderOverview = () => {
    if (overviewLoading) {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={4} />)}
        </div>
      );
    }
    if (overviewError) {
      return (
        <div
          className="rounded-2xl p-6 border text-sm font-semibold flex items-center gap-3"
          style={{ backgroundColor: '#FCE8E6', borderColor: '#FFCDD2', color: '#B85A53' }}
        >
          <span aria-hidden="true">⚠</span>
          {overviewError}
          <button
            onClick={fetchOverview}
            className="ml-auto px-4 py-2 rounded-xl font-bold transition-all"
            style={{ backgroundColor: '#B85A53', color: '#fff', minHeight: '40px' }}
          >
            Retry
          </button>
        </div>
      );
    }
    if (!overview) return null;

    const { averageScoresByLevel = {}, completionRates = {}, vocabularyStats = {}, totalStudents = 0, totalSessions = 0 } = overview;

    return (
      <div className="space-y-6">
        {/* Summary stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Students', value: totalStudents, icon: '👨‍🎓', color: '#4A7C59' },
            { label: 'Total Sessions',  value: totalSessions,  icon: '📖', color: '#D4A843' },
            { label: 'Total Words',     value: vocabularyStats.totalWordsLearned ?? '—', icon: '💬', color: '#5BA8B8' },
            { label: 'Avg per Student', value: vocabularyStats.averageWordsPerStudent ?? '—', icon: '📈', color: '#7AC87A' },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-[#FFFCF3] rounded-2xl p-5 border-l-4 shadow-ghibli"
              style={{ borderLeftColor: stat.color }}
            >
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#9B8777' }}>{stat.label}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-3xl" aria-hidden="true">{stat.icon}</span>
                <span className="text-2xl font-extrabold" style={{ color: '#3D2E1E' }}>{stat.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Average scores by level — horizontal bars */}
        <div className="bg-[#FFFCF3] rounded-2xl p-6 border border-[#E8DEC8] shadow-ghibli">
          <h2 className="text-lg font-extrabold mb-5" style={{ color: '#3D2E1E' }}>
            Average Grammar Scores by Level
          </h2>
          <div className="space-y-5">
            {Object.entries(averageScoresByLevel).map(([level, score]) => {
              const style = LEVEL_CARD_STYLES[level.toLowerCase()] || LEVEL_CARD_STYLES.beginner;
              return (
                <HorizontalBar
                  key={level}
                  label={level.charAt(0).toUpperCase() + level.slice(1)}
                  value={typeof score === 'number' ? score : score?.grammarScore ?? 0}
                  max={100}
                  color={style.text}
                />
              );
            })}
            {Object.keys(averageScoresByLevel).length === 0 && (
              <p className="text-sm font-semibold" style={{ color: '#9B8777' }}>No data available.</p>
            )}
          </div>
        </div>

        {/* Completion rates */}
        <div className="bg-[#FFFCF3] rounded-2xl p-6 border border-[#E8DEC8] shadow-ghibli">
          <h2 className="text-lg font-extrabold mb-5" style={{ color: '#3D2E1E' }}>
            Session Completion Rates by Level
          </h2>
          <div className="space-y-5">
            {Object.entries(completionRates).map(([level, rate]) => (
              <HorizontalBar
                key={level}
                label={level.charAt(0).toUpperCase() + level.slice(1)}
                value={typeof rate === 'number' ? Math.round(rate) : 0}
                max={100}
                color="#4A7C59"
              />
            ))}
            {Object.keys(completionRates).length === 0 && (
              <p className="text-sm font-semibold" style={{ color: '#9B8777' }}>No data available.</p>
            )}
          </div>
        </div>

        {/* Vocabulary stats — word cloud style */}
        {vocabularyStats.mostCommonWords?.length > 0 && (
          <div className="bg-[#FFFCF3] rounded-2xl p-6 border border-[#E8DEC8] shadow-ghibli">
            <h2 className="text-lg font-extrabold mb-4" style={{ color: '#3D2E1E' }}>
              Most Common Words Across All Students
            </h2>
            <div className="flex flex-wrap gap-2">
              {vocabularyStats.mostCommonWords.map((word, i) => (
                <span
                  key={i}
                  className="px-4 py-2 rounded-full font-bold text-sm text-white"
                  style={{ background: `linear-gradient(135deg, #4A7C59, #2C4A2E)` }}
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStudentReport = () => {
    return (
      <div className="space-y-6">
        {/* Student selector */}
        <div className="bg-[#FFFCF3] rounded-2xl p-6 border border-[#E8DEC8] shadow-ghibli">
          <label htmlFor="student-select" className="block text-sm font-bold mb-3" style={{ color: '#6B5744' }}>
            Select a Student
          </label>
          {studentsLoading ? (
            <div className="h-12 rounded-xl animate-shimmer" style={{ backgroundColor: '#EDE5D4' }} />
          ) : (
            <select
              id="student-select"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full px-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A7C59] font-semibold"
              style={{
                backgroundColor: '#F5F0E8',
                color: '#3D2E1E',
                minHeight: '48px',
              }}
            >
              <option value="">-- Choose a student --</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.level ? s.level.charAt(0).toUpperCase() + s.level.slice(1) : 'Unknown'})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Loading state */}
        {studentReportLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={5} />)}
          </div>
        )}

        {/* Error */}
        {studentReportError && (
          <div
            className="rounded-2xl p-4 border text-sm font-semibold flex items-center gap-2"
            style={{ backgroundColor: '#FCE8E6', borderColor: '#FFCDD2', color: '#B85A53' }}
          >
            <span>⚠</span> {studentReportError}
          </div>
        )}

        {/* No selection prompt */}
        {!selectedStudentId && !studentReportLoading && (
          <div className="text-center py-16">
            <span className="text-5xl block mb-3" aria-hidden="true">🌿</span>
            <p className="font-semibold" style={{ color: '#9B8777' }}>
              Select a student above to view their report
            </p>
          </div>
        )}

        {/* Report data */}
        {studentReport && !studentReportLoading && (() => {
          const { student, sessionsHistory = [], vocabularyGrowth = [], grammarTrend = [], topWords = [], weakAreas = [] } = studentReport;

          return (
            <>
              {/* Student header */}
              {student && (
                <div
                  className="rounded-2xl p-5 border shadow-ghibli flex flex-wrap items-center gap-4"
                  style={{ backgroundColor: '#FFFCF3', borderColor: '#E8DEC8' }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-extrabold text-white"
                    style={{ background: 'linear-gradient(135deg, #4A7C59, #2C4A2E)' }}
                    aria-hidden="true"
                  >
                    {student.name?.charAt(0) ?? '?'}
                  </div>
                  <div>
                    <p className="font-extrabold text-lg" style={{ color: '#3D2E1E' }}>{student.name}</p>
                    <p className="text-sm font-semibold" style={{ color: '#9B8777' }}>
                      Age {student.age} &middot; {student.level ? student.level.charAt(0).toUpperCase() + student.level.slice(1) : 'Unknown'} level
                    </p>
                  </div>
                  <div className="ml-auto flex gap-6 text-center">
                    {[
                      { label: 'Sessions', value: sessionsHistory.length },
                      { label: 'Words',    value: vocabularyGrowth[vocabularyGrowth.length - 1] ?? '—' },
                    ].map((s, i) => (
                      <div key={i}>
                        <p className="text-xl font-extrabold" style={{ color: '#4A7C59' }}>{s.value}</p>
                        <p className="text-xs font-bold" style={{ color: '#9B8777' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#FFFCF3] rounded-2xl p-6 border border-[#E8DEC8] shadow-ghibli">
                  <h3 className="font-extrabold mb-4" style={{ color: '#3D2E1E' }}>Grammar Accuracy Trend (%)</h3>
                  <LineChart data={grammarTrend} color="#4A7C59" height={180} />
                  <p className="text-xs font-semibold text-center mt-2" style={{ color: '#9B8777' }}>
                    Last {grammarTrend.length} sessions
                  </p>
                </div>

                <div className="bg-[#FFFCF3] rounded-2xl p-6 border border-[#E8DEC8] shadow-ghibli">
                  <h3 className="font-extrabold mb-4" style={{ color: '#3D2E1E' }}>Vocabulary Growth</h3>
                  <LineChart data={vocabularyGrowth} color="#D4A843" height={180} />
                  <p className="text-xs font-semibold text-center mt-2" style={{ color: '#9B8777' }}>
                    Last {vocabularyGrowth.length} sessions
                  </p>
                </div>
              </div>

              {/* Top 10 words */}
              {topWords.length > 0 && (
                <div className="bg-[#FFFCF3] rounded-2xl p-6 border border-[#E8DEC8] shadow-ghibli">
                  <h3 className="font-extrabold mb-4" style={{ color: '#3D2E1E' }}>
                    Most Used Words (Top {Math.min(topWords.length, 10)})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {topWords.slice(0, 10).map((item, i) => (
                      <div
                        key={i}
                        className="rounded-xl p-3 text-center border"
                        style={{ backgroundColor: '#E8F5E8', borderColor: '#C8E6C9' }}
                      >
                        <p className="font-extrabold" style={{ color: '#2C4A2E' }}>
                          {item.word ?? item}
                        </p>
                        {item.count != null && (
                          <p className="text-xs mt-1" style={{ color: '#6B5744' }}>
                            {item.count}x
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weak areas */}
              {weakAreas.length > 0 && (
                <div className="bg-[#FFFCF3] rounded-2xl p-6 border border-[#E8DEC8] shadow-ghibli">
                  <h3 className="font-extrabold mb-4" style={{ color: '#3D2E1E' }}>Areas for Improvement</h3>
                  <div className="space-y-3">
                    {weakAreas.map((area, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-4 rounded-xl border"
                        style={{ backgroundColor: '#FFF8E1', borderColor: '#FFE0B2' }}
                      >
                        <span aria-hidden="true">⚠</span>
                        <span className="font-semibold" style={{ color: '#3D2E1E' }}>{area}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sessions history mini-table */}
              {sessionsHistory.length > 0 && (
                <div className="bg-[#FFFCF3] rounded-2xl border border-[#E8DEC8] shadow-ghibli overflow-hidden">
                  <div className="p-5 border-b border-[#E8DEC8]">
                    <h3 className="font-extrabold" style={{ color: '#3D2E1E' }}>Session History</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: '#F5F0E8', borderBottom: '2px solid #E8DEC8' }}>
                          {['Book', 'Stage', 'Grammar', 'Date'].map((h) => (
                            <th key={h} className="text-left py-3 px-4 font-bold" style={{ color: '#6B5744' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sessionsHistory.slice(0, 10).map((s, i) => (
                          <tr key={i} className="border-b border-[#EDE5D4] hover:bg-[#F5F0E8] transition-colors">
                            <td className="py-3 px-4 font-semibold max-w-xs truncate" style={{ color: '#3D2E1E' }}>
                              {s.bookTitle ?? s.book_title ?? '—'}
                            </td>
                            <td className="py-3 px-4" style={{ color: '#6B5744' }}>
                              {s.stage ?? '—'}
                            </td>
                            <td className="py-3 px-4">
                              {s.grammarScore != null ? (
                                <span
                                  className="px-2 py-1 rounded-full text-xs font-bold"
                                  style={{
                                    backgroundColor: s.grammarScore >= 75 ? '#C8E6C9' : '#FFF8E1',
                                    color: s.grammarScore >= 75 ? '#2E7D32' : '#8C6D00',
                                  }}
                                >
                                  {s.grammarScore}%
                                </span>
                              ) : '—'}
                            </td>
                            <td className="py-3 px-4 text-xs" style={{ color: '#9B8777' }}>
                              {s.completedAt || s.completed_at
                                ? new Date(s.completedAt || s.completed_at).toLocaleDateString()
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>
    );
  };

  // ─── JSX ────────────────────────────────────────────────────────────────────
  return (
    <>
      <Toast message={toast?.message} type={toast?.type} />

      <div className="space-y-6">
        {/* Back link + page heading */}
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
            Reports &amp; Analytics
          </h1>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-2" style={{ borderBottom: '2px solid #E8DEC8' }}>
          {[
            { key: 'overview', label: 'Class Overview' },
            { key: 'student',  label: 'Student Report' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-6 py-3 font-bold border-b-4 transition-all"
              style={{
                minHeight: '48px',
                color: activeTab === tab.key ? '#4A7C59' : '#6B5744',
                borderBottomColor: activeTab === tab.key ? '#4A7C59' : 'transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'student'  && renderStudentReport()}

        {/* Export section */}
        <div
          className="bg-[#FFFCF3] rounded-2xl p-6 border border-[#E8DEC8] shadow-ghibli flex flex-wrap items-center justify-between gap-4"
        >
          <div>
            <p className="font-extrabold" style={{ color: '#3D2E1E' }}>Export All Data</p>
            <p className="text-sm font-semibold" style={{ color: '#9B8777' }}>
              Download a full snapshot of students, books, sessions, and vocabulary.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleExportJSON}
              disabled={exportLoading}
              className="px-6 py-3 rounded-xl font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
              style={{
                minHeight: '48px',
                backgroundColor: '#4A7C59',
                color: '#fff',
                boxShadow: '0 2px 8px rgba(74,124,89,0.3)',
              }}
            >
              {exportLoading ? 'Exporting…' : 'Download JSON'}
            </button>
            <button
              onClick={handleExportCSV}
              disabled={exportLoading}
              className="px-6 py-3 rounded-xl font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
              style={{
                minHeight: '48px',
                backgroundColor: '#2C4A2E',
                color: '#fff',
                boxShadow: '0 2px 8px rgba(44,74,46,0.3)',
              }}
            >
              {exportLoading ? 'Exporting…' : 'Download CSV'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
