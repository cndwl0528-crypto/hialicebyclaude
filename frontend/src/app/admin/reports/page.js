'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getToken, API_BASE } from '@/lib/auth';

const DATE_RANGES = ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'All Time'];

const LEVEL_CARD_STYLES = {
  beginner: { bg: '#C8E6C9', text: '#2E7D32', valueBg: '#E8F5E8' },
  intermediate: { bg: '#FFE0B2', text: '#E65100', valueBg: '#FFF8E1' },
  advanced: { bg: '#E1BEE7', text: '#6A1B9A', valueBg: '#F3E5F5' },
};

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

// Simple SVG Line Chart Component
function LineChart({ data, labels, height = 250, color = '#5C8B5C' }) {
  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue || 1;
  const width = 100;

  const points = data
    .map(
      (val, idx) =>
        `${(idx / Math.max(data.length - 1, 1)) * width},${
          height - ((val - minValue) / range) * (height - 30) - 10
        }`
    )
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-xl p-2"
      style={{ border: '1px solid #E8DEC8', backgroundColor: '#FFFCF3' }}
    >
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => (
        <line
          key={idx}
          x1="0"
          y1={height - pct * (height - 30) - 10}
          x2={width}
          y2={height - pct * (height - 30) - 10}
          stroke="#EDE5D4"
          strokeWidth="0.5"
        />
      ))}
      {/* Line */}
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
      {/* Points */}
      {data.map((val, idx) => (
        <circle
          key={idx}
          cx={(idx / Math.max(data.length - 1, 1)) * width}
          cy={height - ((val - minValue) / range) * (height - 30) - 10}
          r="1.5"
          fill={color}
        />
      ))}
      {/* Y-axis labels */}
      <text x="2" y="12" fontSize="7" fill="#6B5744">
        {maxValue}
      </text>
      <text x="2" y={height - 2} fontSize="7" fill="#6B5744">
        {minValue}
      </text>
    </svg>
  );
}

// Simple SVG Bar Chart Component
function BarChart({ data, labels, height = 200, color = '#5C8B5C' }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data, 1);

  return (
    <svg
      viewBox={`0 0 ${data.length * 25 + 10} ${height + 30}`}
      className="w-full rounded-xl p-2"
      style={{ border: '1px solid #E8DEC8', backgroundColor: '#FFFCF3' }}
    >
      {data.map((val, idx) => {
        const barH = (val / maxVal) * height;
        const x = idx * 25 + 8;
        return (
          <g key={idx}>
            <rect
              x={x}
              y={height - barH + 5}
              width="18"
              height={barH}
              fill={color}
              rx="3"
              opacity="0.85"
            />
            <text
              x={x + 9}
              y={height - barH}
              textAnchor="middle"
              fontSize="6"
              fill="#6B5744"
              fontWeight="bold"
            >
              {val}
            </text>
            {labels && labels[idx] && (
              <text
                x={x + 9}
                y={height + 18}
                textAnchor="middle"
                fontSize="5"
                fill="#6B5744"
              >
                {labels[idx]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Bloom's Taxonomy Distribution Component
function BloomChart({ distribution }) {
  if (!distribution) return null;
  const levels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
  const colors = ['#E8DEC8', '#C8E6C9', '#A8E6CF', '#FFE0B2', '#F8B195', '#E1BEE7'];
  const total = levels.reduce((sum, l) => sum + (distribution[l] || 0), 0) || 1;

  return (
    <div className="space-y-2">
      {levels.map((level, idx) => {
        const count = distribution[level] || 0;
        const pct = Math.round((count / total) * 100);
        return (
          <div key={level} className="flex items-center gap-3">
            <span className="text-xs font-bold text-[#6B5744] w-20 text-right">
              {capitalize(level)}
            </span>
            <div className="flex-1 bg-[#EDE5D4] rounded-full h-5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: colors[idx] }}
              />
            </div>
            <span className="text-xs font-bold text-[#6B5744] w-10">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('All Time');
  const [activeTab, setActiveTab] = useState('student');

  // Student report state
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentReport, setStudentReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Class report state
  const [classReport, setClassReport] = useState(null);
  const [classLoading, setClassLoading] = useState(false);

  const [apiError, setApiError] = useState(null);

  // Toast with proper cleanup to prevent memory leaks
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const API = API_BASE;

  // -- Fetch students list --
  const fetchStudents = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/admin/students`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setStudents(data.data?.students || data.students || []);
    } catch (e) {
      console.warn('Fetch students failed:', e);
    }
  }, [API]);

  // -- Fetch student report --
  const fetchStudentReport = useCallback(async (studentId) => {
    setReportLoading(true);
    setApiError(null);
    try {
      const r = await fetch(`${API}/api/admin/reports/student/${studentId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setStudentReport(data.data || data);
    } catch (e) {
      console.warn('Fetch student report failed:', e);
      setApiError('Could not load student report. Please try again.');
      setStudentReport(null);
    } finally {
      setReportLoading(false);
    }
  }, [API]);

  // -- Fetch class overview --
  const fetchClassReport = useCallback(async () => {
    setClassLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/reports/overview`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setClassReport(data.data || data);
    } catch (e) {
      console.warn('Fetch class report failed:', e);
    } finally {
      setClassLoading(false);
    }
  }, [API]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    if (activeTab === 'class' && !classReport) {
      fetchClassReport();
    }
  }, [activeTab, classReport, fetchClassReport]);

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    fetchStudentReport(student.id);
  };

  // -- Export CSV --
  const handleExportCSV = async () => {
    try {
      const endpoint = activeTab === 'student' && selectedStudent
        ? `${API}/api/admin/export/sessions?studentId=${selectedStudent.id}`
        : `${API}/api/admin/export/students`;

      const r = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!r.ok) {
        // Fallback to JSON export if CSV endpoints not available
        handleExportJSON();
        return;
      }

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${dateRange.replace(/\s/g, '-').toLowerCase()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      handleExportJSON();
    }
  };

  const handleExportJSON = () => {
    const data = activeTab === 'student' ? studentReport : classReport;
    if (!data) return;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${dateRange.replace(/\s/g, '-').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // -- Derived data from studentReport --
  const grammarTrendData = studentReport?.grammarTrend
    ? (() => {
        const entries = Object.entries(studentReport.grammarTrend).sort(([a], [b]) => a.localeCompare(b));
        return {
          values: entries.map(([, v]) => v.average || v),
          labels: entries.map(([k]) => k),
        };
      })()
    : null;

  const vocabGrowthData = studentReport?.vocabularyGrowth
    ? (() => {
        const entries = Object.entries(studentReport.vocabularyGrowth).sort(([a], [b]) => a.localeCompare(b));
        return {
          values: entries.map(([, v]) => v),
          labels: entries.map(([k]) => k.substring(5)), // strip year
        };
      })()
    : null;

  const sessionsHistory = studentReport?.sessionsHistory || [];
  const topWords = studentReport?.topWords || [];
  const weakAreas = studentReport?.weakAreas || [];

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-[#3D2E1E]">Reports & Analytics</h1>
        <div className="flex gap-2 flex-wrap">
          {DATE_RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className="px-4 py-2 rounded-xl font-bold transition-all"
              style={{
                minHeight: '48px',
                backgroundColor: dateRange === range ? '#5C8B5C' : '#EDE5D4',
                color: dateRange === range ? '#FFFFFF' : '#3D2E1E',
              }}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        className="flex gap-2 flex-wrap"
        style={{ borderBottom: '2px solid #E8DEC8' }}
      >
        {[
          { key: 'student', label: 'Student Progress' },
          { key: 'class', label: 'Class Overview' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-6 py-3 font-bold transition-all border-b-4"
            style={{
              minHeight: '48px',
              color: activeTab === tab.key ? '#5C8B5C' : '#6B5744',
              borderBottomColor: activeTab === tab.key ? '#5C8B5C' : 'transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* API Error */}
      {apiError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-semibold">
          {apiError}
        </div>
      )}

      {/* Student Progress Tab */}
      {activeTab === 'student' && (
        <div className="space-y-6">
          {/* Student Selector */}
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
            <label className="block text-sm font-bold text-[#6B5744] mb-3">
              Select a Student
            </label>
            {students.length === 0 ? (
              <p className="text-[#6B5744] text-sm font-semibold">No students found. Add students first.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {students.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => handleStudentSelect(student)}
                    className="px-4 py-3 rounded-xl font-bold transition-all text-left hover:-translate-y-0.5"
                    style={{
                      minHeight: '48px',
                      backgroundColor:
                        selectedStudent?.id === student.id ? '#5C8B5C' : '#EDE5D4',
                      color: selectedStudent?.id === student.id ? '#FFFFFF' : '#3D2E1E',
                    }}
                  >
                    <div className="font-extrabold">{student.name}</div>
                    <div className="text-xs opacity-75">{capitalize(student.level)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {reportLoading && (
            <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-12 text-center border border-[#E8DEC8]">
              <p className="text-[#6B5744] text-lg font-semibold">Loading report...</p>
            </div>
          )}

          {selectedStudent && studentReport && !reportLoading && (
            <>
              {/* Student Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: 'Level', value: capitalize(studentReport.student?.level), icon: '📚' },
                  { label: 'Total Sessions', value: sessionsHistory.length, icon: '📝' },
                  { label: 'Words Learned', value: topWords.length > 0 ? `${topWords.length}+` : '0', icon: '📖' },
                  { label: 'Weak Areas', value: weakAreas.length, icon: '! ' },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-4 border border-[#E8DEC8]"
                  >
                    <p className="text-[#6B5744] text-sm font-bold mb-2">{stat.label}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{stat.icon}</span>
                      <span className="text-2xl font-extrabold text-[#3D2E1E]">{stat.value}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Grammar Accuracy Trend */}
                <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
                  <h3 className="text-lg font-extrabold text-[#3D2E1E] mb-4">Grammar Accuracy Trend</h3>
                  {grammarTrendData && grammarTrendData.values.length > 0 ? (
                    <>
                      <LineChart
                        data={grammarTrendData.values}
                        labels={grammarTrendData.labels}
                        height={250}
                        color="#5C8B5C"
                      />
                      <p className="text-xs text-[#6B5744] mt-2 text-center font-semibold">
                        By month ({grammarTrendData.labels.join(', ')})
                      </p>
                    </>
                  ) : (
                    <p className="text-[#6B5744] text-sm text-center py-8 font-semibold">No grammar data yet</p>
                  )}
                </div>

                {/* Vocabulary Growth */}
                <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
                  <h3 className="text-lg font-extrabold text-[#3D2E1E] mb-4">Vocabulary Growth</h3>
                  {vocabGrowthData && vocabGrowthData.values.length > 0 ? (
                    <>
                      <BarChart
                        data={vocabGrowthData.values}
                        labels={vocabGrowthData.labels}
                        height={200}
                        color="#D4A843"
                      />
                      <p className="text-xs text-[#6B5744] mt-2 text-center font-semibold">Words learned per day</p>
                    </>
                  ) : (
                    <p className="text-[#6B5744] text-sm text-center py-8 font-semibold">No vocabulary data yet</p>
                  )}
                </div>
              </div>

              {/* Session History */}
              {sessionsHistory.length > 0 && (
                <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
                  <h3 className="text-lg font-extrabold text-[#3D2E1E] mb-4">Session History</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-[#E8DEC8]">
                          <th className="text-left py-3 px-3 font-bold text-[#6B5744]">Book</th>
                          <th className="text-left py-3 px-3 font-bold text-[#6B5744]">Level</th>
                          <th className="text-left py-3 px-3 font-bold text-[#6B5744]">Grammar</th>
                          <th className="text-left py-3 px-3 font-bold text-[#6B5744]">Score</th>
                          <th className="text-left py-3 px-3 font-bold text-[#6B5744]">Status</th>
                          <th className="text-left py-3 px-3 font-bold text-[#6B5744]">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionsHistory.slice(0, 20).map((s, idx) => (
                          <tr key={idx} className="border-b border-[#EDE5D4] hover:bg-[#F5F0E8] transition-colors">
                            <td className="py-3 px-3 font-semibold text-[#3D2E1E] max-w-xs truncate">
                              {s.bookTitle}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className="px-2 py-1 rounded-full text-xs font-bold"
                                style={{
                                  backgroundColor: (LEVEL_CARD_STYLES[s.bookLevel] || LEVEL_CARD_STYLES.beginner).bg,
                                  color: (LEVEL_CARD_STYLES[s.bookLevel] || LEVEL_CARD_STYLES.beginner).text,
                                }}
                              >
                                {capitalize(s.bookLevel)}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-bold text-[#5C8B5C]">
                              {s.grammarScore != null ? `${s.grammarScore}%` : '--'}
                            </td>
                            <td className="py-3 px-3 font-bold text-[#A8822E]">
                              {s.levelScore != null ? `${s.levelScore}%` : '--'}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className="px-2 py-1 rounded-full text-xs font-bold"
                                style={{
                                  backgroundColor: s.completedAt ? '#C8E6C9' : '#E0F4F9',
                                  color: s.completedAt ? '#2E7D32' : '#2A7A8C',
                                }}
                              >
                                {s.completedAt ? 'Done' : 'Active'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-[#6B5744] text-xs font-semibold">
                              {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '--'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Top Words + Weak Areas side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Words */}
                {topWords.length > 0 && (
                  <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
                    <h3 className="text-lg font-extrabold text-[#3D2E1E] mb-4">Most Used Words (Top 10)</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {topWords.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl p-3 text-center border border-[#C8E6C9]"
                          style={{ backgroundColor: '#E8F5E8' }}
                        >
                          <p className="text-base font-extrabold text-[#3D6B3D] mb-1">{item.word}</p>
                          <p className="text-xs text-[#6B5744]">
                            {item.useCount}x | {item.pos || 'n/a'}
                          </p>
                          <div className="mt-1">
                            {[...Array(5)].map((_, i) => (
                              <span
                                key={i}
                                className="text-xs"
                                style={{ color: i < (item.masteryLevel || 0) ? '#D4A843' : '#EDE5D4' }}
                              >
                                *
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Weak Areas / Improvement */}
                {weakAreas.length > 0 && (
                  <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
                    <h3 className="text-lg font-extrabold text-[#3D2E1E] mb-4">Areas for Improvement</h3>
                    <div className="space-y-3">
                      {weakAreas.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl border border-[#FFE0B2]"
                          style={{ backgroundColor: '#FFF8E1' }}
                        >
                          <div>
                            <span className="text-[#3D2E1E] font-bold">{item.word}</span>
                            <span className="text-xs text-[#6B5744] ml-2">{item.pos || ''}</span>
                          </div>
                          <span
                            className="px-2 py-1 rounded-full text-xs font-bold"
                            style={{
                              backgroundColor: '#FCE8E6',
                              color: '#B85A53',
                            }}
                          >
                            Mastery: {item.masteryLevel}/5
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Class Overview Tab */}
      {activeTab === 'class' && (
        <div className="space-y-6">
          {classLoading ? (
            <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-12 text-center border border-[#E8DEC8]">
              <p className="text-[#6B5744] text-lg font-semibold">Loading class overview...</p>
            </div>
          ) : classReport ? (
            <>
              {/* Class Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Students', value: classReport.totalStudents || 0, icon: '👨‍🎓', color: '#5C8B5C' },
                  { label: 'Total Sessions', value: classReport.totalSessions || 0, icon: '📝', color: '#87CEDB' },
                  {
                    label: 'Vocab (Total)',
                    value: classReport.vocabularyStats?.totalUnique || 0,
                    icon: '📚',
                    color: '#D4A843',
                  },
                  {
                    label: 'Avg Vocab/Student',
                    value: classReport.vocabularyStats?.averagePerStudent || 0,
                    icon: '📖',
                    color: '#7AC87A',
                  },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-4 border-l-4 border-[#E8DEC8]"
                    style={{ borderLeftColor: stat.color }}
                  >
                    <p className="text-[#6B5744] text-sm font-bold mb-2">{stat.label}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{stat.icon}</span>
                      <span className="text-2xl font-extrabold text-[#3D2E1E]">{stat.value}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Average Scores by Level */}
              {classReport.averageScoresByLevel && (
                <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
                  <h3 className="text-lg font-extrabold text-[#3D2E1E] mb-4">Average Scores by Level</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(classReport.averageScoresByLevel).map(([level, scores]) => {
                      const style = LEVEL_CARD_STYLES[level] || LEVEL_CARD_STYLES.beginner;
                      return (
                        <div
                          key={level}
                          className="rounded-2xl p-6 border"
                          style={{
                            backgroundColor: style.valueBg,
                            borderColor: style.bg,
                          }}
                        >
                          <h4
                            className="text-lg font-extrabold mb-4"
                            style={{ color: style.text }}
                          >
                            {capitalize(level)}
                          </h4>
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm text-[#6B5744] mb-1 font-semibold">Grammar Score</p>
                              <p className="text-3xl font-extrabold" style={{ color: '#5C8B5C' }}>
                                {scores.grammarScore || 0}%
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-[#6B5744] mb-1 font-semibold">Sessions</p>
                              <p className="text-3xl font-extrabold" style={{ color: '#D4A843' }}>
                                {scores.sessionCount || 0}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Completion Rates */}
              {classReport.completionRates && (
                <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
                  <h3 className="text-lg font-extrabold text-[#3D2E1E] mb-4">Completion Rates by Level</h3>
                  <div className="space-y-4">
                    {Object.entries(classReport.completionRates).map(([level, rate]) => {
                      const style = LEVEL_CARD_STYLES[level] || LEVEL_CARD_STYLES.beginner;
                      return (
                        <div key={level} className="flex items-center gap-4">
                          <span className="text-sm font-bold text-[#6B5744] w-28">
                            {capitalize(level)}
                          </span>
                          <div className="flex-1 bg-[#EDE5D4] rounded-full h-6 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all flex items-center justify-end pr-2"
                              style={{
                                width: `${Math.max(rate, 5)}%`,
                                backgroundColor: style.bg,
                              }}
                            >
                              <span className="text-xs font-bold" style={{ color: style.text }}>
                                {rate}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-12 text-center border border-[#E8DEC8]">
              <p className="text-[#6B5744] text-lg font-semibold">Could not load class overview</p>
            </div>
          )}
        </div>
      )}

      {/* Export Buttons */}
      <div className="flex justify-center gap-4">
        <button
          onClick={handleExportCSV}
          className="px-8 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] transition-all font-bold shadow-[0_2px_8px_rgba(61,107,61,0.3)] hover:-translate-y-0.5 flex items-center gap-2"
          style={{ minHeight: '48px' }}
        >
          Export Data
        </button>
      </div>
    </div>
  );
}
