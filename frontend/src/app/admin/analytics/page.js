'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';

// ============================================================================
// GHIBLI THEME TOKENS
// ============================================================================
const G = {
  forestDark:   '#3D6B3D',
  forestMid:    '#5C8B5C',
  forestLight:  '#8AB88A',
  cream:        '#F5F0E8',
  creamDark:    '#EDE5D4',
  parchment:    '#FAF7F0',
  gold:         '#D4A843',
  goldLight:    '#F0D080',
  brown:        '#3D2E1E',
  brownMid:     '#6B5744',
  brownLight:   '#9E8A6E',
  terracotta:   '#D4736B',
  skyBlue:      '#87CEDB',
  lavender:     '#B8A4D8',
  cardBg:       '#FFFCF3',
  cardBorder:   '#E8DEC8',
  shadow:       '0 4px 20px rgba(61,46,30,0.08)',
  shadowMd:     '0 6px 24px rgba(61,46,30,0.12)',
};

// ============================================================================
// COMPREHENSIVE MOCK DATA  (208 students, 30-day trends, rich detail)
// ============================================================================

// --- KPI Data ---
const KPI_DATA = {
  totalStudents:       { value: 208,    growth: +12.4, label: 'Total Students',          unit: '',    color: G.forestMid,  icon: 'S' },
  activeThisWeek:      { value: 143,    growth: +8.1,  label: 'Active This Week',         unit: '',    color: G.gold,        icon: 'A' },
  sessionsThisMonth:   { value: 1_847,  growth: +21.3, label: 'Sessions This Month',      unit: '',    color: G.skyBlue,     icon: 'S' },
  avgSessionScore:     { value: 83.6,   growth: +3.2,  label: 'Average Session Score',    unit: '%',   color: G.terracotta,  icon: 'S' },
  vocabularyLearned:   { value: 14_203, growth: +18.7, label: 'Vocabulary Words Learned', unit: '',    color: G.lavender,    icon: 'V' },
  avgSessionDuration:  { value: 13.4,   growth: -1.2,  label: 'Avg Session Duration',     unit: ' min',color: G.forestDark,  icon: 'D' },
};

// --- Daily Active Users: last 30 days (with a weekend dip + growth trend) ---
const DAU_30 = [
  { label: 'Mar 12', dau: 58, sessions: 74 },
  { label: 'Mar 11', dau: 54, sessions: 68 },
  { label: 'Mar 10', dau: 43, sessions: 51 },  // Sunday
  { label: 'Mar 9',  dau: 37, sessions: 44 },  // Saturday
  { label: 'Mar 8',  dau: 61, sessions: 79 },
  { label: 'Mar 7',  dau: 67, sessions: 84 },
  { label: 'Mar 6',  dau: 63, sessions: 80 },
  { label: 'Mar 5',  dau: 59, sessions: 74 },
  { label: 'Mar 4',  dau: 55, sessions: 70 },
  { label: 'Mar 3',  dau: 41, sessions: 49 },  // Sunday
  { label: 'Mar 2',  dau: 33, sessions: 40 },  // Saturday
  { label: 'Mar 1',  dau: 60, sessions: 75 },
  { label: 'Feb 28', dau: 56, sessions: 71 },
  { label: 'Feb 27', dau: 52, sessions: 65 },
  { label: 'Feb 26', dau: 48, sessions: 61 },
  { label: 'Feb 25', dau: 50, sessions: 63 },
  { label: 'Feb 24', dau: 38, sessions: 46 },  // Sunday
  { label: 'Feb 23', dau: 29, sessions: 36 },  // Saturday
  { label: 'Feb 22', dau: 53, sessions: 67 },
  { label: 'Feb 21', dau: 49, sessions: 61 },
  { label: 'Feb 20', dau: 46, sessions: 58 },
  { label: 'Feb 19', dau: 44, sessions: 55 },
  { label: 'Feb 18', dau: 42, sessions: 53 },
  { label: 'Feb 17', dau: 35, sessions: 43 },  // Sunday
  { label: 'Feb 16', dau: 27, sessions: 33 },  // Saturday
  { label: 'Feb 15', dau: 48, sessions: 60 },
  { label: 'Feb 14', dau: 51, sessions: 64 },  // Valentine spike
  { label: 'Feb 13', dau: 45, sessions: 57 },
  { label: 'Feb 12', dau: 40, sessions: 50 },
  { label: 'Feb 11', dau: 38, sessions: 48 },
].reverse();

// Weekly aggregation
const WEEKLY_DATA = [
  { label: 'Week of Feb 10', dau: 222, sessions: 279 },
  { label: 'Week of Feb 17', dau: 239, sessions: 300 },
  { label: 'Week of Feb 24', dau: 265, sessions: 333 },
  { label: 'Week of Mar 3',  dau: 291, sessions: 366 },
  { label: 'Week of Mar 10', dau: 217, sessions: 272 }, // partial week
];

// Monthly aggregation
const MONTHLY_DATA = [
  { label: 'Oct 2025', dau: 890,   sessions: 1_120 },
  { label: 'Nov 2025', dau: 1_050, sessions: 1_320 },
  { label: 'Dec 2025', dau: 780,   sessions:   980 }, // holiday dip
  { label: 'Jan 2026', dau: 1_180, sessions: 1_490 }, // new year spike
  { label: 'Feb 2026', dau: 1_342, sessions: 1_690 },
  { label: 'Mar 2026', dau: 458,   sessions:   576 }, // partial month
];

// --- Book Performance Table (top 15) ---
const BOOKS_DATA = [
  { title: "The Very Hungry Caterpillar",          selected: 312, avgScore: 87, completion: 94, avgDuration: 11.2 },
  { title: "Where the Wild Things Are",             selected: 287, avgScore: 84, completion: 91, avgDuration: 12.8 },
  { title: "Charlotte's Web",                       selected: 263, avgScore: 82, completion: 88, avgDuration: 15.3 },
  { title: "Winnie-the-Pooh",                       selected: 251, avgScore: 85, completion: 86, avgDuration: 14.1 },
  { title: "Magic Tree House: Dinosaurs Before Dark",selected: 234, avgScore: 79, completion: 83, avgDuration: 16.7 },
  { title: "Matilda",                               selected: 218, avgScore: 88, completion: 79, avgDuration: 17.9 },
  { title: "The Lion, the Witch and the Wardrobe",  selected: 196, avgScore: 81, completion: 76, avgDuration: 19.4 },
  { title: "A Wrinkle in Time",                     selected: 172, avgScore: 90, completion: 73, avgDuration: 21.2 },
  { title: "Inkheart",                              selected: 154, avgScore: 86, completion: 68, avgDuration: 22.8 },
  { title: "The Hobbit",                            selected: 143, avgScore: 91, completion: 65, avgDuration: 24.5 },
  { title: "Stuart Little",                         selected: 138, avgScore: 78, completion: 82, avgDuration: 13.9 },
  { title: "James and the Giant Peach",             selected: 127, avgScore: 83, completion: 77, avgDuration: 16.2 },
  { title: "The BFG",                               selected: 119, avgScore: 80, completion: 71, avgDuration: 18.3 },
  { title: "My Father's Dragon",                    selected: 104, avgScore: 76, completion: 58, avgDuration: 14.7 },
  { title: "Harriet the Spy",                       selected: 98,  avgScore: 77, completion: 54, avgDuration: 17.1 },
];

// --- Engagement Heatmap: 7 days x 4 time slots ---
// Rows: Mon–Sun  |  Cols: Morning (6-10), Afternoon (10-14), Evening (14-18), Night (18-22)
const HEATMAP_DATA = [
  { day: 'Mon', Morning: 28, Afternoon: 42, Evening: 61, Night: 19 },
  { day: 'Tue', Morning: 31, Afternoon: 45, Evening: 67, Night: 22 },
  { day: 'Wed', Morning: 29, Afternoon: 48, Evening: 63, Night: 21 },
  { day: 'Thu', Morning: 33, Afternoon: 51, Evening: 70, Night: 25 },
  { day: 'Fri', Morning: 35, Afternoon: 55, Evening: 74, Night: 28 },
  { day: 'Sat', Morning: 54, Afternoon: 68, Evening: 41, Night: 14 },
  { day: 'Sun', Morning: 49, Afternoon: 62, Evening: 33, Night: 11 },
];
const TIME_SLOTS = ['Morning\n6–10am', 'Afternoon\n10–2pm', 'Evening\n2–6pm', 'Night\n6–10pm'];
const HEATMAP_KEYS = ['Morning', 'Afternoon', 'Evening', 'Night'];

// --- Vocabulary Analytics ---
const TOP_WORDS = [
  { word: 'caterpillar',   count: 847, difficulty: 'medium' },
  { word: 'adventure',     count: 734, difficulty: 'easy'   },
  { word: 'character',     count: 698, difficulty: 'easy'   },
  { word: 'imagination',   count: 621, difficulty: 'medium' },
  { word: 'friendship',    count: 589, difficulty: 'easy'   },
  { word: 'creature',      count: 543, difficulty: 'medium' },
  { word: 'mysterious',    count: 498, difficulty: 'medium' },
  { word: 'determined',    count: 462, difficulty: 'hard'   },
  { word: 'transformation',count: 431, difficulty: 'hard'   },
  { word: 'perseverance',  count: 407, difficulty: 'hard'   },
  { word: 'compassion',    count: 381, difficulty: 'hard'   },
  { word: 'loyalty',       count: 356, difficulty: 'medium' },
  { word: 'metaphor',      count: 334, difficulty: 'hard'   },
  { word: 'narrative',     count: 312, difficulty: 'hard'   },
  { word: 'enchanted',     count: 289, difficulty: 'medium' },
  { word: 'courageous',    count: 267, difficulty: 'medium' },
  { word: 'protagonist',   count: 251, difficulty: 'hard'   },
  { word: 'whimsical',     count: 228, difficulty: 'hard'   },
  { word: 'resilient',     count: 214, difficulty: 'hard'   },
  { word: 'elaborate',     count: 196, difficulty: 'hard'   },
];

const DIFFICULTY_DIST = { easy: 3_240, medium: 5_810, hard: 5_153 };
const MASTERY_DATA = [
  { label: 'Mastered (80%+)', value: 6_847, color: G.forestMid },
  { label: 'Learning (40-79%)', value: 4_932, color: G.gold },
  { label: 'Introduced (<40%)', value: 2_424, color: G.terracotta },
];

// --- Level Distribution ---
const LEVEL_DIST = [
  { level: 'Beginner',     count: 89,  color: '#A8E6CF', textColor: '#1B5E20', levelUps: 12 },
  { level: 'Intermediate', count: 87,  color: '#FFD3B6', textColor: '#7C3D00', levelUps: 9  },
  { level: 'Advanced',     count: 32,  color: '#F8B195', textColor: '#5D0000', levelUps: 4  },
];
const TOTAL_STUDENTS_LEVEL = 208;

// --- Content Effectiveness ---
const VOCAB_RETENTION = [
  { book: 'Matilda',                  retention: 91, sessions: 218 },
  { book: 'A Wrinkle in Time',        retention: 89, sessions: 172 },
  { book: 'The Hobbit',               retention: 88, sessions: 143 },
  { book: "Charlotte's Web",          retention: 85, sessions: 263 },
  { book: 'Inkheart',                 retention: 83, sessions: 154 },
  { book: 'The Very Hungry Caterpillar', retention: 79, sessions: 312 },
];

const STAGE_THINKING = [
  { stage: 'Think Deeper',        avgWords: 47.3, depth: 94, color: G.forestMid  },
  { stage: 'My Thoughts',         avgWords: 38.1, depth: 81, color: G.gold        },
  { stage: 'Meet the Characters', avgWords: 29.4, depth: 63, color: G.skyBlue     },
  { stage: 'About This Book',     avgWords: 22.7, depth: 48, color: G.lavender    },
  { stage: "Let's Say Hi!",       avgWords: 14.2, depth: 30, color: G.brownLight  },
];

const AI_QUESTIONS = [
  { question: 'Can you give three reasons why you think that?',        avgResponseWords: 62, responseRate: 97 },
  { question: 'How would you have done things differently?',            avgResponseWords: 54, responseRate: 94 },
  { question: 'What did this book teach you about life?',               avgResponseWords: 51, responseRate: 96 },
  { question: 'Does this story remind you of your own experience?',     avgResponseWords: 48, responseRate: 91 },
  { question: 'Why do you think the author chose this title?',          avgResponseWords: 44, responseRate: 93 },
  { question: 'Would you recommend this book to a friend? Why?',        avgResponseWords: 39, responseRate: 98 },
];

// ============================================================================
// UTILITY HELPERS
// ============================================================================

function fmtNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
  return n.toString();
}

function completionColor(rate) {
  if (rate >= 80) return { bg: '#E8F5E8', text: '#2E7D32' };
  if (rate >= 50) return { bg: '#FFF8E1', text: '#8C6D00' };
  return { bg: '#FFEBEE', text: '#C62828' };
}

function difficultyColor(diff) {
  if (diff === 'easy')   return { bg: '#E8F5E8', text: '#2E7D32' };
  if (diff === 'medium') return { bg: '#FFF8E1', text: '#8C6D00' };
  return { bg: '#F3E5F5', text: '#6A1B9A' };
}

function heatmapColor(value, max) {
  const intensity = value / max;
  if (intensity > 0.85) return '#3D6B3D';
  if (intensity > 0.65) return '#5C8B5C';
  if (intensity > 0.45) return '#8AB88A';
  if (intensity > 0.25) return '#C8E6C9';
  return '#EDF7ED';
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// ----- KPI Card -----
function KpiCard({ data }) {
  const isPositive = data.growth >= 0;
  return (
    <div
      className="rounded-2xl p-5 border hover:-translate-y-0.5 transition-transform"
      style={{ background: G.cardBg, borderColor: G.cardBorder, boxShadow: G.shadow }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white"
          style={{ background: data.color }}
          aria-hidden="true"
        >
          {data.icon}
        </div>
        <span
          className="text-xs font-bold px-2 py-1 rounded-full"
          style={{
            background: isPositive ? '#E8F5E8' : '#FFEBEE',
            color:      isPositive ? '#2E7D32' : '#C62828',
          }}
        >
          {isPositive ? '+' : ''}{data.growth.toFixed(1)}%
        </span>
      </div>
      <p className="text-xs font-semibold mb-1" style={{ color: G.brownMid }}>{data.label}</p>
      <p className="text-3xl font-black" style={{ color: G.brown }}>
        {fmtNum(data.value)}{data.unit}
      </p>
    </div>
  );
}

// ----- Section Header -----
function SectionHeader({ title, subtitle, accent }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-1 h-6 rounded-full"
          style={{ background: accent || G.forestMid }}
          aria-hidden="true"
        />
        <h2 className="text-xl font-black" style={{ color: G.brown }}>{title}</h2>
      </div>
      {subtitle && (
        <p className="ml-4 text-sm" style={{ color: G.brownMid }}>{subtitle}</p>
      )}
    </div>
  );
}

// ----- Card wrapper -----
function Card({ children, className = '', style = {} }) {
  return (
    <div
      className={`rounded-2xl border ${className}`}
      style={{ background: G.cardBg, borderColor: G.cardBorder, boxShadow: G.shadow, ...style }}
    >
      {children}
    </div>
  );
}

// ----- Usage Trends Chart -----
function UsageTrendsChart() {
  const [view, setView]       = useState('daily');
  const [metric, setMetric]   = useState('dau');

  const dataset = view === 'daily' ? DAU_30 : view === 'weekly' ? WEEKLY_DATA : MONTHLY_DATA;
  const maxVal  = Math.max(...dataset.map((d) => metric === 'dau' ? d.dau : d.sessions));

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-black" style={{ color: G.brown }}>Usage Trends</h3>
          <p className="text-xs mt-0.5" style={{ color: G.brownMid }}>
            {metric === 'dau' ? 'Daily Active Users' : 'Sessions'} — last {view === 'daily' ? '30 days' : view === 'weekly' ? '5 weeks' : '6 months'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Metric toggle */}
          <div
            className="flex rounded-xl border overflow-hidden"
            style={{ borderColor: G.cardBorder }}
          >
            {[['dau', 'Users'], ['sessions', 'Sessions']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setMetric(key)}
                className="px-3 py-1.5 text-xs font-bold transition-colors"
                style={{
                  background: metric === key ? G.forestMid : G.parchment,
                  color:      metric === key ? 'white'      : G.brownMid,
                  minHeight:  '32px',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div
            className="flex rounded-xl border overflow-hidden"
            style={{ borderColor: G.cardBorder }}
          >
            {[['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className="px-3 py-1.5 text-xs font-bold transition-colors"
                style={{
                  background: view === key ? G.gold   : G.parchment,
                  color:      view === key ? 'white'  : G.brownMid,
                  minHeight:  '32px',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-1 h-48 overflow-x-auto pb-6" style={{ minHeight: '12rem' }}>
        {dataset.map((d, idx) => {
          const val      = metric === 'dau' ? d.dau : d.sessions;
          const barH     = Math.max(4, (val / maxVal) * 176);
          const isWeekend = view === 'daily' && (idx % 7 === 5 || idx % 7 === 6);
          return (
            <div
              key={idx}
              className="flex flex-col items-center group"
              style={{ minWidth: view === 'daily' ? '18px' : view === 'weekly' ? '80px' : '60px', flex: 1 }}
            >
              {/* Tooltip on hover */}
              <div
                className="mb-1 text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ fontSize: '10px', color: G.brownMid, whiteSpace: 'nowrap' }}
              >
                {val}
              </div>
              <div
                className="w-full rounded-t-md transition-all"
                style={{
                  height:     `${barH}px`,
                  background: isWeekend
                    ? `linear-gradient(to top, ${G.brownLight}, ${G.creamDark})`
                    : metric === 'dau'
                      ? `linear-gradient(to top, ${G.forestDark}, ${G.forestMid})`
                      : `linear-gradient(to top, #B8903A, ${G.gold})`,
                  opacity: isWeekend ? 0.6 : 1,
                }}
                title={`${d.label}: ${val} ${metric === 'dau' ? 'users' : 'sessions'}`}
              />
              {/* X-axis label (only show some to avoid clutter) */}
              {(view !== 'daily' || idx % 5 === 0) && (
                <span
                  className="text-center mt-1 leading-tight"
                  style={{ fontSize: '9px', color: G.brownLight, maxWidth: '40px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
                >
                  {view === 'daily' ? d.label.replace('Feb ', 'F').replace('Mar ', 'M') : d.label.replace('Week of ', '')}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 border-t pt-3" style={{ borderColor: G.creamDark }}>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: G.forestMid }} />
          <span className="text-xs" style={{ color: G.brownMid }}>Weekday</span>
        </div>
        {view === 'daily' && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: G.brownLight, opacity: 0.6 }} />
            <span className="text-xs" style={{ color: G.brownMid }}>Weekend</span>
          </div>
        )}
        <div className="ml-auto text-xs font-bold" style={{ color: G.brownLight }}>
          Peak: {maxVal.toLocaleString()} {metric === 'dau' ? 'users' : 'sessions'}
        </div>
      </div>
    </Card>
  );
}

// ----- Book Performance Table -----
function BookPerformanceTable() {
  const [sortKey,  setSortKey]  = useState('selected');
  const [sortDir,  setSortDir]  = useState('desc');

  const sorted = useMemo(() => {
    return [...BOOKS_DATA].sort((a, b) => {
      const diff = a[sortKey] < b[sortKey] ? -1 : a[sortKey] > b[sortKey] ? 1 : 0;
      return sortDir === 'asc' ? diff : -diff;
    });
  }, [sortKey, sortDir]);

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const ColHeader = ({ label, colKey }) => {
    const active = sortKey === colKey;
    return (
      <th
        className="py-3 px-4 text-left cursor-pointer select-none font-black text-xs uppercase tracking-wide whitespace-nowrap transition-colors hover:opacity-80"
        style={{ color: active ? G.forestMid : G.brownMid }}
        onClick={() => handleSort(colKey)}
      >
        {label}
        <span className="ml-1 text-[10px]">
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </th>
    );
  };

  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b" style={{ borderColor: G.cardBorder }}>
        <h3 className="text-lg font-black" style={{ color: G.brown }}>Book Performance</h3>
        <p className="text-xs mt-0.5" style={{ color: G.brownMid }}>Top 15 books — click column header to sort</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: G.parchment, borderBottom: `2px solid ${G.creamDark}` }}>
              <th className="py-3 px-4 text-left font-black text-xs uppercase tracking-wide" style={{ color: G.brownMid }}>#</th>
              <ColHeader label="Book Title"       colKey="title"       />
              <ColHeader label="Times Selected"   colKey="selected"    />
              <ColHeader label="Avg Score"         colKey="avgScore"    />
              <ColHeader label="Completion Rate"  colKey="completion"  />
              <ColHeader label="Avg Duration"     colKey="avgDuration" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((book, idx) => {
              const compStyle = completionColor(book.completion);
              return (
                <tr
                  key={idx}
                  className="border-b transition-colors hover:bg-[#FAF7F0]"
                  style={{ borderColor: G.creamDark }}
                >
                  <td className="py-3 px-4 text-xs font-bold" style={{ color: G.brownLight }}>{idx + 1}</td>
                  <td className="py-3 px-4 max-w-xs">
                    <span className="font-semibold text-sm" style={{ color: G.brown }}>{book.title}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.round((book.selected / 312) * 60)}px`,
                          background: `linear-gradient(to right, ${G.forestMid}, ${G.forestLight})`,
                        }}
                      />
                      <span className="text-sm font-bold" style={{ color: G.brown }}>{book.selected}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{
                        background: book.avgScore >= 85 ? '#E8F5E8' : '#FFF8E1',
                        color:      book.avgScore >= 85 ? '#2E7D32' : '#8C6D00',
                      }}
                    >
                      {book.avgScore}%
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: compStyle.bg, color: compStyle.text }}
                    >
                      {book.completion}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm font-semibold" style={{ color: G.brownMid }}>
                    {book.avgDuration} min
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ----- Engagement Heatmap -----
function EngagementHeatmap() {
  const allValues = HEATMAP_DATA.flatMap((row) => HEATMAP_KEYS.map((k) => row[k]));
  const maxVal    = Math.max(...allValues);

  return (
    <Card className="p-6">
      <h3 className="text-lg font-black mb-1" style={{ color: G.brown }}>Student Engagement Heatmap</h3>
      <p className="text-xs mb-5" style={{ color: G.brownMid }}>Session count by day-of-week and time-of-day — darker = more active</p>

      {/* Time slot headers */}
      <div className="grid gap-2" style={{ gridTemplateColumns: '64px repeat(4, 1fr)' }}>
        <div /> {/* empty corner */}
        {TIME_SLOTS.map((slot) => (
          <div key={slot} className="text-center" style={{ fontSize: '10px', color: G.brownMid, lineHeight: '1.3', whiteSpace: 'pre-line' }}>
            {slot}
          </div>
        ))}

        {/* Rows */}
        {HEATMAP_DATA.map((row) => (
          <React.Fragment key={row.day}>
            <div
              className="flex items-center font-bold text-xs"
              style={{ color: G.brownMid }}
            >
              {row.day}
            </div>
            {HEATMAP_KEYS.map((key) => {
              const val   = row[key];
              const bg    = heatmapColor(val, maxVal);
              const isDark = val / maxVal > 0.45;
              return (
                <div
                  key={`${row.day}-${key}`}
                  className="rounded-xl flex flex-col items-center justify-center transition-transform hover:scale-105 cursor-default"
                  style={{
                    background:    bg,
                    minHeight:     '52px',
                    border:        `1px solid ${G.creamDark}`,
                  }}
                  title={`${row.day} ${key}: ${val} sessions`}
                >
                  <span
                    className="text-sm font-black"
                    style={{ color: isDark ? 'white' : G.brown }}
                  >
                    {val}
                  </span>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t" style={{ borderColor: G.creamDark }}>
        <span className="text-xs" style={{ color: G.brownLight }}>Low</span>
        {['#EDF7ED', '#C8E6C9', '#8AB88A', '#5C8B5C', '#3D6B3D'].map((c) => (
          <div key={c} className="w-5 h-3 rounded" style={{ background: c }} />
        ))}
        <span className="text-xs" style={{ color: G.brownLight }}>High</span>
        <span className="ml-auto text-xs font-bold" style={{ color: G.brownLight }}>Peak: {maxVal} sessions/slot</span>
      </div>
    </Card>
  );
}

// ----- Vocabulary Analytics -----
function VocabularyAnalytics() {
  const maxCount   = TOP_WORDS[0].count;
  const diffTotal  = Object.values(DIFFICULTY_DIST).reduce((s, v) => s + v, 0);
  const masteryTotal = MASTERY_DATA.reduce((s, d) => s + d.value, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Top 20 words */}
      <Card className="lg:col-span-2 p-6">
        <h3 className="text-lg font-black mb-1" style={{ color: G.brown }}>Top 20 Vocabulary Words</h3>
        <p className="text-xs mb-4" style={{ color: G.brownMid }}>Most frequently learned words across all sessions this month</p>
        <div className="space-y-2">
          {TOP_WORDS.map((w, idx) => {
            const dc    = difficultyColor(w.difficulty);
            const barW  = Math.round((w.count / maxCount) * 100);
            return (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-xs w-4 font-bold text-right flex-shrink-0" style={{ color: G.brownLight }}>{idx + 1}</span>
                <span
                  className="text-xs font-bold w-28 flex-shrink-0 truncate"
                  style={{ color: G.brown }}
                >
                  {w.word}
                </span>
                <div className="flex-1 relative h-5 rounded-full overflow-hidden" style={{ background: G.creamDark }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width:      `${barW}%`,
                      background: `linear-gradient(to right, ${G.forestDark}, ${G.forestMid})`,
                    }}
                  />
                  <span
                    className="absolute right-2 top-0 h-full flex items-center text-xs font-bold"
                    style={{ color: barW > 40 ? 'white' : G.brownMid, fontSize: '10px' }}
                  >
                    {w.count.toLocaleString()}
                  </span>
                </div>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0"
                  style={{ background: dc.bg, color: dc.text, fontSize: '10px' }}
                >
                  {w.difficulty}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Difficulty dist + Mastery */}
      <div className="flex flex-col gap-6">
        {/* Difficulty distribution */}
        <Card className="p-6">
          <h3 className="text-base font-black mb-1" style={{ color: G.brown }}>Word Difficulty Mix</h3>
          <p className="text-xs mb-4" style={{ color: G.brownMid }}>Distribution of all {fmtNum(diffTotal)} words</p>
          <div className="space-y-3">
            {Object.entries(DIFFICULTY_DIST).map(([key, val]) => {
              const dc  = difficultyColor(key);
              const pct_ = Math.round((val / diffTotal) * 100);
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span style={{ color: G.brown }}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                    <span style={{ color: G.brownMid }}>{val.toLocaleString()} ({pct_}%)</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: G.creamDark }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct_}%`, background: dc.text }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Mastery rate */}
        <Card className="p-6">
          <h3 className="text-base font-black mb-1" style={{ color: G.brown }}>Mastery Progress</h3>
          <p className="text-xs mb-4" style={{ color: G.brownMid }}>{fmtNum(masteryTotal)} total word-learner pairs</p>
          <div className="space-y-3">
            {MASTERY_DATA.map((d) => {
              const pct_ = Math.round((d.value / masteryTotal) * 100);
              return (
                <div key={d.label}>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span style={{ color: G.brown }}>{d.label}</span>
                    <span style={{ color: G.brownMid }}>{pct_}%</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: G.creamDark }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct_}%`, background: d.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ----- Level Distribution -----
function LevelDistribution() {
  const totalLevelUps = LEVEL_DIST.reduce((s, d) => s + d.levelUps, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Horizontal bar chart */}
      <Card className="p-6">
        <h3 className="text-lg font-black mb-1" style={{ color: G.brown }}>Level Distribution</h3>
        <p className="text-xs mb-6" style={{ color: G.brownMid }}>
          {TOTAL_STUDENTS_LEVEL} students across 3 reading levels
        </p>
        <div className="space-y-5">
          {LEVEL_DIST.map((d) => {
            const barW = Math.round((d.count / TOTAL_STUDENTS_LEVEL) * 100);
            return (
              <div key={d.level}>
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span style={{ color: G.brown }}>{d.level}</span>
                  <span style={{ color: G.brownMid }}>{d.count} students ({barW}%)</span>
                </div>
                <div className="h-8 rounded-xl overflow-hidden" style={{ background: G.creamDark }}>
                  <div
                    className="h-full rounded-xl flex items-center px-3 transition-all"
                    style={{ width: `${barW}%`, background: d.color }}
                  >
                    <span className="text-xs font-black" style={{ color: d.textColor }}>{barW}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Level transition icons */}
        <div className="mt-6 pt-4 border-t" style={{ borderColor: G.creamDark }}>
          <p className="text-xs font-bold mb-3" style={{ color: G.brownMid }}>Level Icons (from constants.js)</p>
          <div className="flex gap-4">
            {[{ icon: '🌱', label: 'Beginner' }, { icon: '🌿', label: 'Intermediate' }, { icon: '🌳', label: 'Advanced' }].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className="text-lg">{item.icon}</span>
                <span className="text-xs font-semibold" style={{ color: G.brownMid }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Level-up tracking */}
      <Card className="p-6">
        <h3 className="text-lg font-black mb-1" style={{ color: G.brown }}>Level Transitions This Month</h3>
        <p className="text-xs mb-6" style={{ color: G.brownMid }}>
          {totalLevelUps} students advanced to a higher level in March 2026
        </p>

        {/* Big number */}
        <div className="text-center mb-6">
          <p className="text-6xl font-black" style={{ color: G.forestMid }}>{totalLevelUps}</p>
          <p className="text-sm font-semibold mt-1" style={{ color: G.brownMid }}>Level-ups this month</p>
        </div>

        <div className="space-y-4">
          {[
            { from: 'Beginner',     to: 'Intermediate', count: 12, arrow: '🌱 → 🌿' },
            { from: 'Intermediate', to: 'Advanced',     count: 9,  arrow: '🌿 → 🌳' },
            { from: '—',            to: 'Beginner',     count: 4,  arrow: '✨ → 🌱', label: 'New enrollments at Intermediate+' },
          ].map((t, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: G.parchment, border: `1px solid ${G.creamDark}` }}
            >
              <span className="text-sm font-bold" style={{ color: G.brown }}>
                {t.label || `${t.from} → ${t.to}`}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm">{t.arrow}</span>
                <span
                  className="px-3 py-1 rounded-full text-sm font-black"
                  style={{ background: G.forestMid, color: 'white' }}
                >
                  {t.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ----- Content Effectiveness -----
function ContentEffectiveness() {
  const maxWords     = Math.max(...STAGE_THINKING.map((d) => d.avgWords));
  const maxResponse  = Math.max(...AI_QUESTIONS.map((d) => d.avgResponseWords));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Vocab retention by book */}
      <Card className="p-6">
        <h3 className="text-base font-black mb-1" style={{ color: G.brown }}>Vocabulary Retention by Book</h3>
        <p className="text-xs mb-4" style={{ color: G.brownMid }}>% of learned words retained 7 days later</p>
        <div className="space-y-3">
          {VOCAB_RETENTION.map((d, idx) => {
            const barW  = Math.round((d.retention / 100) * 100);
            const color = d.retention >= 88 ? G.forestMid : d.retention >= 83 ? G.gold : G.terracotta;
            return (
              <div key={idx}>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="truncate max-w-[130px]" style={{ color: G.brown }} title={d.book}>{d.book}</span>
                  <span style={{ color }}>{d.retention}%</span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: G.creamDark }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${barW}%`, background: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Stage thinking depth */}
      <Card className="p-6">
        <h3 className="text-base font-black mb-1" style={{ color: G.brown }}>Session Stage Depth</h3>
        <p className="text-xs mb-4" style={{ color: G.brownMid }}>Avg response length and thinking depth score by stage</p>
        <div className="space-y-4">
          {STAGE_THINKING.map((d, idx) => (
            <div key={idx}>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span style={{ color: G.brown }}>{d.stage}</span>
                <span style={{ color: G.brownMid }}>{d.avgWords} words</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: G.creamDark }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width:      `${Math.round((d.avgWords / maxWords) * 100)}%`,
                      background: d.color,
                    }}
                  />
                </div>
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{
                    background: d.depth >= 80 ? '#E8F5E8' : d.depth >= 50 ? '#FFF8E1' : '#F5F0E8',
                    color:      d.depth >= 80 ? '#2E7D32' : d.depth >= 50 ? '#8C6D00' : G.brownMid,
                    fontSize:   '10px',
                  }}
                >
                  {d.depth}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs mt-3" style={{ color: G.brownLight }}>Depth score = composite of word count, unique vocab, and follow-up engagement</p>
      </Card>

      {/* AI question effectiveness */}
      <Card className="p-6">
        <h3 className="text-base font-black mb-1" style={{ color: G.brown }}>AI Question Effectiveness</h3>
        <p className="text-xs mb-4" style={{ color: G.brownMid }}>Questions that generate the longest student responses</p>
        <div className="space-y-4">
          {AI_QUESTIONS.map((q, idx) => {
            const barW = Math.round((q.avgResponseWords / maxResponse) * 100);
            return (
              <div key={idx} className="p-3 rounded-xl" style={{ background: G.parchment, border: `1px solid ${G.creamDark}` }}>
                <p
                  className="text-xs font-semibold mb-2 leading-snug"
                  style={{ color: G.brown }}
                >
                  "{q.question}"
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: G.creamDark }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width:      `${barW}%`,
                        background: `linear-gradient(to right, ${G.forestDark}, ${G.forestMid})`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-black flex-shrink-0" style={{ color: G.forestMid }}>
                    {q.avgResponseWords}w
                  </span>
                  <span
                    className="text-xs font-bold flex-shrink-0 px-1.5 py-0.5 rounded"
                    style={{ background: '#E8F5E8', color: '#2E7D32', fontSize: '10px' }}
                  >
                    {q.responseRate}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs mt-2" style={{ color: G.brownLight }}>Last column = response rate (students who answered vs skipped)</p>
      </Card>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function AnalyticsDashboard() {
  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/admin"
              className="text-sm font-bold transition-colors hover:opacity-80"
              style={{ color: G.forestMid }}
            >
              Dashboard
            </Link>
            <span style={{ color: G.brownLight }}>{'/'}</span>
            <span className="text-sm font-bold" style={{ color: G.brownMid }}>Analytics</span>
          </div>
          <h1 className="text-3xl font-black" style={{ color: G.brown }}>
            Learning Analytics
          </h1>
          <p className="mt-1 text-sm" style={{ color: G.brownMid }}>
            Comprehensive insights across 208 students — March 2026
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="px-4 py-2 rounded-xl text-xs font-bold border"
            style={{ background: '#E8F5E8', color: '#2E7D32', borderColor: '#C8E6C9' }}
          >
            Live data (mock)
          </div>
          <div
            className="px-4 py-2 rounded-xl text-xs font-bold"
            style={{ background: G.creamDark, color: G.brownMid }}
          >
            Last updated: today
          </div>
        </div>
      </div>

      {/* ── Section A: KPI Overview ── */}
      <section aria-label="KPI Overview">
        <SectionHeader
          title="KPI Overview"
          subtitle="Key performance indicators for the current month with month-over-month growth"
          accent={G.forestMid}
        />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Object.values(KPI_DATA).map((kpi) => (
            <KpiCard key={kpi.label} data={kpi} />
          ))}
        </div>
      </section>

      {/* ── Section B: Usage Trends ── */}
      <section aria-label="Usage Trends">
        <SectionHeader
          title="Usage Trends"
          subtitle="Daily active users and sessions over time — toggle daily / weekly / monthly view"
          accent={G.gold}
        />
        <UsageTrendsChart />
      </section>

      {/* ── Section C: Book Performance Table ── */}
      <section aria-label="Book Performance">
        <SectionHeader
          title="Book Performance"
          subtitle="Sortable metrics for the top 15 books — click any column header to re-sort"
          accent={G.skyBlue}
        />
        <BookPerformanceTable />
      </section>

      {/* ── Section D: Engagement Heatmap ── */}
      <section aria-label="Engagement Heatmap">
        <SectionHeader
          title="Student Engagement Heatmap"
          subtitle="When are students most active? 7 days x 4 time-of-day buckets"
          accent={G.terracotta}
        />
        <EngagementHeatmap />
      </section>

      {/* ── Section E: Vocabulary Analytics ── */}
      <section aria-label="Vocabulary Analytics">
        <SectionHeader
          title="Vocabulary Analytics"
          subtitle="Top words, difficulty distribution, and mastery progress across all students"
          accent={G.lavender}
        />
        <VocabularyAnalytics />
      </section>

      {/* ── Section F: Level Distribution ── */}
      <section aria-label="Level Distribution">
        <SectionHeader
          title="Level Distribution"
          subtitle="Student counts per reading level and monthly level-up transitions"
          accent={G.forestDark}
        />
        <LevelDistribution />
      </section>

      {/* ── Section G: Content Effectiveness ── */}
      <section aria-label="Content Effectiveness">
        <SectionHeader
          title="Content Effectiveness"
          subtitle="Which books drive retention? Which stages spark deeper thinking? Which AI questions get the longest responses?"
          accent={G.brownMid}
        />
        <ContentEffectiveness />
      </section>

      {/* Footer note */}
      <div
        className="rounded-2xl p-4 border text-center"
        style={{ background: G.parchment, borderColor: G.cardBorder }}
      >
        <p className="text-xs" style={{ color: G.brownLight }}>
          All data shown is representative mock data for development purposes.
          Connect real API endpoints in <code className="font-mono bg-[#EDE5D4] px-1 rounded">@/services/api</code> to display live analytics.
        </p>
      </div>
    </div>
  );
}
