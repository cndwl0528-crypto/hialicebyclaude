'use client';

import { useState, useEffect } from 'react';

// Mock data
const MOCK_STUDENTS = [
  { id: 1, name: 'Alice', level: 'Beginner' },
  { id: 2, name: 'Bob', level: 'Intermediate' },
  { id: 3, name: 'Carol', level: 'Advanced' },
];

const MOCK_STUDENT_REPORT = {
  studentName: 'Alice',
  level: 'Beginner',
  totalBooksRead: 5,
  booksReadInPeriod: 2,
  vocabGrowth: [45, 52, 58, 63, 71],
  grammarTrend: [78, 80, 82, 85, 85],
  topWords: [
    { word: 'caterpillar', count: 8 },
    { word: 'beautiful', count: 6 },
    { word: 'hungry', count: 5 },
    { word: 'butterfly', count: 5 },
    { word: 'leaves', count: 4 },
    { word: 'week', count: 4 },
    { word: 'hungry', count: 3 },
    { word: 'day', count: 3 },
    { word: 'egg', count: 2 },
    { word: 'cocoon', count: 2 },
  ],
  improvementAreas: ['Article usage (a/an/the)', 'Past tense formation', 'Word order in questions'],
};

const MOCK_CLASS_REPORT = {
  totalStudents: 24,
  averageScoreByLevel: {
    Beginner: { grammarScore: 82, completionRate: 85 },
    Intermediate: { grammarScore: 78, completionRate: 80 },
    Advanced: { grammarScore: 87, completionRate: 92 },
  },
  vocabularyStats: {
    totalWordsLearned: 2450,
    averageWordsPerStudent: 102,
    mostCommonWords: ['said', 'was', 'about', 'could', 'where', 'would', 'other', 'after', 'think', 'their'],
  },
};

const DATE_RANGES = ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'All Time'];

const LEVEL_CARD_STYLES = {
  Beginner: { bg: '#C8E6C9', text: '#2E7D32', valueBg: '#E8F5E8' },
  Intermediate: { bg: '#FFE0B2', text: '#E65100', valueBg: '#FFF8E1' },
  Advanced: { bg: '#E1BEE7', text: '#6A1B9A', valueBg: '#F3E5F5' },
};

// Simple SVG Line Chart Component
function LineChart({ data, height = 250, color = '#5C8B5C' }) {
  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue || 1;

  const width = 100;
  const points = data
    .map(
      (val, idx) =>
        `${(idx / (data.length - 1)) * width},${
          height - ((val - minValue) / range) * (height - 20)
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
          y1={height - pct * (height - 20)}
          x2={width}
          y2={height - pct * (height - 20)}
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
          cx={(idx / (data.length - 1)) * width}
          cy={height - ((val - minValue) / range) * (height - 20)}
          r="1.5"
          fill={color}
        />
      ))}
      {/* Y-axis labels */}
      <text x="2" y="15" fontSize="8" fill="#9B8777">
        {maxValue}
      </text>
      <text x="2" y={height - 5} fontSize="8" fill="#9B8777">
        {minValue}
      </text>
    </svg>
  );
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentReport, setStudentReport] = useState(MOCK_STUDENT_REPORT);
  const [classReport, setClassReport] = useState(MOCK_CLASS_REPORT);
  const [activeTab, setActiveTab] = useState('student');

  const handleStudentSelect = (studentId) => {
    const student = MOCK_STUDENTS.find((s) => s.id === studentId);
    setSelectedStudent(student);
    setStudentReport(MOCK_STUDENT_REPORT);
  };

  const handleExportData = () => {
    const data = activeTab === 'student' ? studentReport : classReport;
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

      {/* Student Progress Tab */}
      {activeTab === 'student' && (
        <div className="space-y-6">
          {/* Student Selector */}
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
            <label className="block text-sm font-bold text-[#6B5744] mb-3">
              Select a Student
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {MOCK_STUDENTS.map((student) => (
                <button
                  key={student.id}
                  onClick={() => handleStudentSelect(student.id)}
                  className="px-4 py-3 rounded-xl font-bold transition-all text-left hover:-translate-y-0.5"
                  style={{
                    minHeight: '48px',
                    backgroundColor:
                      selectedStudent?.id === student.id ? '#5C8B5C' : '#EDE5D4',
                    color: selectedStudent?.id === student.id ? '#FFFFFF' : '#3D2E1E',
                  }}
                >
                  <div className="font-extrabold">{student.name}</div>
                  <div className="text-xs opacity-75">{student.level}</div>
                </button>
              ))}
            </div>
          </div>

          {selectedStudent && (
            <>
              {/* Student Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Level', value: studentReport.level, icon: '📚' },
                  { label: 'Books Read', value: studentReport.totalBooksRead, icon: '✅' },
                  { label: 'Words Learned', value: '71', icon: '📝' },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-4 border border-[#E8DEC8]"
                  >
                    <p className="text-[#9B8777] text-sm font-bold mb-2">{stat.label}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{stat.icon}</span>
                      <span className="text-2xl font-extrabold text-[#3D2E1E]">{stat.value}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Vocabulary Growth */}
                <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
                  <h3 className="text-lg font-extrabold text-[#3D2E1E] mb-4">Vocabulary Growth</h3>
                  <LineChart data={studentReport.vocabGrowth} height={250} color="#D4A843" />
                  <p className="text-xs text-[#9B8777] mt-2 text-center font-semibold">Last 5 sessions</p>
                </div>

                {/* Grammar Accuracy Trend */}
                <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
                  <h3 className="text-lg font-extrabold text-[#3D2E1E] mb-4">Grammar Accuracy (%)</h3>
                  <LineChart data={studentReport.grammarTrend} height={250} color="#5C8B5C" />
                  <p className="text-xs text-[#9B8777] mt-2 text-center font-semibold">Last 5 sessions</p>
                </div>
              </div>

              {/* Top Words */}
              <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
                <h3 className="text-lg font-extrabold text-[#3D2E1E] mb-4">Most Used Words (Top 10)</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {studentReport.topWords.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl p-4 text-center border border-[#C8E6C9]"
                      style={{ backgroundColor: '#E8F5E8' }}
                    >
                      <p className="text-lg font-extrabold text-[#3D6B3D] mb-1">{item.word}</p>
                      <p className="text-sm text-[#6B5744]">Used {item.count} times</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Improvement Areas */}
              <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
                <h3 className="text-lg font-extrabold text-[#3D2E1E] mb-4">Areas for Improvement</h3>
                <div className="space-y-3">
                  {studentReport.improvementAreas.map((area, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-4 rounded-xl border border-[#FFE0B2]"
                      style={{ backgroundColor: '#FFF8E1' }}
                    >
                      <span className="text-xl">⚠️</span>
                      <span className="text-[#3D2E1E] font-semibold">{area}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Class Overview Tab */}
      {activeTab === 'class' && (
        <div className="space-y-6">
          {/* Class Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Students', value: classReport.totalStudents, icon: '👨‍🎓', color: '#5C8B5C' },
              {
                label: 'Avg Vocab Learned',
                value: classReport.vocabularyStats.averageWordsPerStudent,
                icon: '📚',
                color: '#87CEDB',
              },
              {
                label: 'Total Words Learned',
                value: classReport.vocabularyStats.totalWordsLearned,
                icon: '📝',
                color: '#D4A843',
              },
              {
                label: 'Avg Grammar Score',
                value: '82%',
                icon: '✅',
                color: '#7AC87A',
              },
            ].map((stat, idx) => (
              <div
                key={idx}
                className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-4 border-l-4 border-[#E8DEC8]"
                style={{ borderLeftColor: stat.color }}
              >
                <p className="text-[#9B8777] text-sm font-bold mb-2">{stat.label}</p>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{stat.icon}</span>
                  <span className="text-2xl font-extrabold text-[#3D2E1E]">{stat.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Average Scores by Level */}
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
            <h3 className="text-lg font-extrabold text-[#3D2E1E] mb-4">Average Scores by Level</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(classReport.averageScoreByLevel).map(([level, scores]) => {
                const style = LEVEL_CARD_STYLES[level] || { bg: '#E8F5E8', text: '#3D6B3D', valueBg: '#C8E6C9' };
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
                      {level}
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-[#6B5744] mb-1 font-semibold">Grammar Score</p>
                        <p
                          className="text-3xl font-extrabold"
                          style={{ color: '#5C8B5C' }}
                        >
                          {scores.grammarScore}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-[#6B5744] mb-1 font-semibold">Completion Rate</p>
                        <p
                          className="text-3xl font-extrabold"
                          style={{ color: '#D4A843' }}
                        >
                          {scores.completionRate}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Most Common Words */}
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
            <h3 className="text-lg font-extrabold text-[#3D2E1E] mb-4">
              Most Common Words Across All Students
            </h3>
            <div className="flex flex-wrap gap-2">
              {classReport.vocabularyStats.mostCommonWords.map((word, idx) => (
                <span
                  key={idx}
                  className="px-4 py-2 text-white rounded-full font-bold text-sm"
                  style={{
                    background: `linear-gradient(to right, #5C8B5C, #7AAE7A)`,
                  }}
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Export Button */}
      <div className="flex justify-center">
        <button
          onClick={handleExportData}
          className="px-8 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] transition-all font-bold shadow-[0_2px_8px_rgba(61,107,61,0.3)] hover:-translate-y-0.5 flex items-center gap-2"
          style={{ minHeight: '48px' }}
        >
          Export Data as JSON
        </button>
      </div>
    </div>
  );
}
