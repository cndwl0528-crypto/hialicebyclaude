'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  getStudentSessions,
  getStudentAnalytics,
  getVocabStats,
  logout,
} from '@/services/api';
import LoadingCard from '@/components/LoadingCard';
import { isParentOrAdmin } from '@/lib/constants';
import { getItem, setItem } from '@/lib/clientStorage';

// ---------------------------------------------------------------------------
// Static Mock Data
// ---------------------------------------------------------------------------

const MOCK_STUDENT = {
  id: 'demo-1',
  name: 'Alice',
  age: 7,
  level: 'Beginner',
  avatar: '👧',
  current_streak: 5,
};

const MOCK_SESSIONS = [
  { id: 1, bookTitle: 'The Very Hungry Caterpillar', date: '2026-03-08', levelScore: 85, grammarScore: 78, wordsLearned: 18, duration: 12, stages: { 'About This Book': 85, 'Meet the Characters': 80, 'Think Deeper': 78, 'My Thoughts': 85 } },
  { id: 2, bookTitle: 'Where the Wild Things Are', date: '2026-03-07', levelScore: 88, grammarScore: 92, wordsLearned: 22, duration: 8, stages: { 'About This Book': 88, 'Meet the Characters': 85, 'Think Deeper': 92, 'My Thoughts': 88 } },
  { id: 3, bookTitle: 'Winnie-the-Pooh', date: '2026-03-06', levelScore: 80, grammarScore: 75, wordsLearned: 20, duration: 14, stages: { 'About This Book': 80, 'Meet the Characters': 78, 'Think Deeper': 75, 'My Thoughts': 80 } },
];

const AVATAR_OPTIONS = ['👧', '👦', '🧒', '👩', '🧑', '😊', '🌟', '🎓'];
const AVATAR_LABELS = {
  '👧': 'girl',
  '👦': 'boy',
  '🧒': 'child',
  '👩': 'woman',
  '🧑': 'person',
  '😊': 'happy face',
  '🌟': 'star',
  '🎓': 'graduate',
};

// ---------------------------------------------------------------------------
// Gamification Constants
// ---------------------------------------------------------------------------

/** XP level thresholds and names */
const XP_LEVELS = [
  { level: 1, xpRequired: 0,    name: 'Seedling',         icon: '🌱' },
  { level: 2, xpRequired: 300,  name: 'Sprout',           icon: '🌿' },
  { level: 3, xpRequired: 700,  name: 'Sapling',          icon: '🪴' },
  { level: 4, xpRequired: 1200, name: 'Young Tree',        icon: '🌳' },
  { level: 5, xpRequired: 2000, name: 'Tall Tree',         icon: '🌲' },
  { level: 6, xpRequired: 3000, name: 'Wise Oak',          icon: '🍂' },
  { level: 7, xpRequired: 5000, name: 'Enchanted Forest',  icon: '🌌' },
];

/**
 * Compute total XP from session array.
 * Base 100 per session + bonuses derived from session data.
 */
function computeXP(sessions) {
  return sessions.reduce((total, s) => {
    let xp = 100; // base
    // +50 deep thinking: Think Deeper stage score >= 80
    const thinkScore = s.stages?.['Think Deeper'] ?? s.stages?.body ?? 0;
    if (thinkScore >= 80) xp += 50;
    // +30 new vocabulary: learned >= 15 words
    if ((s.wordsLearned || 0) >= 15) xp += 30;
    // +20 grammar accuracy: grammarScore > 80
    if ((s.grammarScore || 0) > 80) xp += 20;
    return total + xp;
  }, 0);
}

/** Return current level data and next-level data based on total XP */
function getXPLevel(totalXP) {
  let current = XP_LEVELS[0];
  for (const lv of XP_LEVELS) {
    if (totalXP >= lv.xpRequired) current = lv;
    else break;
  }
  const nextIdx = current.level < XP_LEVELS.length ? current.level : null; // XP_LEVELS is 1-indexed
  const next = nextIdx !== null ? XP_LEVELS[nextIdx] : null;
  const xpIntoLevel = totalXP - current.xpRequired;
  const xpNeeded = next ? next.xpRequired - current.xpRequired : 1;
  const progressPct = next ? Math.min(Math.round((xpIntoLevel / xpNeeded) * 100), 100) : 100;
  return { current, next, progressPct, xpIntoLevel, xpNeeded };
}

// ---------------------------------------------------------------------------
// Story Chapters
// ---------------------------------------------------------------------------

const STORY_CHAPTERS = [
  {
    id: 1,
    title: "Alice Discovers the Library",
    sessionsRequired: 3,
    content: `Deep in the heart of the Enchanted Forest, there stood a library unlike any other. Its walls were made of twisted oak, its shelves carved from ancient cedar. One quiet morning, Alice pushed open the heavy wooden door and gasped.

Books floated gently near the ceiling. Their pages rustled like leaves in a warm breeze, and soft golden light poured from the spaces between their spines. A kind librarian with round spectacles and a green cardigan smiled from behind her desk.

"Welcome, young reader," she said softly. "Every book here is waiting for someone like you. Which adventure shall we begin?"

Alice reached up and caught a small blue book that drifted toward her. On its cover, fireflies danced around the words: Your Story Starts Here.

And so it did.`,
  },
  {
    id: 2,
    title: "The Talking Bookworm",
    sessionsRequired: 6,
    content: `Alice had been reading quietly for an hour when she heard a tiny voice from the bottom shelf.

"Excuse me," said the voice. "But you're sitting on my favourite page."

She looked down. A small bookworm — green and spectacled — peeked out from between two enormous dictionaries.

"I'm sorry!" Alice said, jumping up.

"No harm done," the bookworm replied cheerfully. "I'm Harold. I've read every book in this library. Twice." He polished his tiny glasses proudly. "Well, almost every book. There's one up on the highest shelf I've never quite reached."

Alice looked up. Far above them, a single glowing book spun slowly in the air.

"What does it say?" she asked.

Harold smiled. "That's for you to discover. But I'll help you get there — one chapter at a time."`,
  },
  {
    id: 3,
    title: "The Word Garden",
    sessionsRequired: 9,
    content: `Behind the library was a garden Alice had never noticed before. The gate was made of pencils tied together with ribbon, and above it hung a sign: The Word Garden — All Readers Welcome.

She stepped inside. Flowers bloomed that were not flowers at all — they were words, written in a hundred colours, growing tall like sunflowers. Some spelled "brave." Others spelled "magnificent" and "curious" and "whimsical."

Harold hopped alongside her on a tiny path. "Every word you learn," he explained, "plants a new seed here. The more you read, the bigger the garden grows."

Alice knelt beside a small sprout. It was still just a seedling. She read the word aloud carefully: "Persevere."

The sprout shivered, then stretched, reaching upward toward the light.

"That one," Harold whispered, "is going to grow very tall indeed."`,
  },
  {
    id: 4,
    title: "The Grammar Castle",
    sessionsRequired: 12,
    content: `At the far edge of the Word Garden stood a great stone castle. Its towers were made of stacked sentences, its windows framed with punctuation marks, and its drawbridge lowered only when you spoke correctly.

"Who goes there?" called a guard with a large comma for a hat.

"Alice," she replied. "I've come to learn."

"Then answer this," said the guard. "Is it: She go to the library — or — She goes to the library?"

Alice thought carefully. "She goes to the library," she said with confidence.

The drawbridge lowered with a deep, satisfying clunk.

Inside, the castle was full of knights who spoke in perfect sentences, and a wise queen who wore a crown made of question marks. "Grammar," said the queen, "is not about being right or wrong. It is about being understood. And you, dear Alice, are learning to be heard very clearly."`,
  },
  {
    id: 5,
    title: "Alice's Great Speech",
    sessionsRequired: 15,
    content: `The day had finally come. Alice stood at the front of the Enchanted Library, facing every character she had ever met: Harold the bookworm, the Grammar Queen, the talking flowers from the Word Garden, and hundreds of books whose pages fluttered like applause.

"Tell us," said Harold, "what you have learned."

Alice took a breath. She thought about every book she had read, every word she had discovered, every story that had surprised her.

"I've learned," she began slowly, "that stories aren't just adventures in books. They're adventures inside your mind. Every time I read, I become a little bit braver, a little bit bigger, and a little bit more — me."

The library was silent for one beautiful moment.

Then every book in every shelf burst open, their pages rising into the air like a thousand white birds, swirling around Alice in a warm, wonderful storm of words.

She had found her voice. And it was extraordinary.`,
  },
];

// ---------------------------------------------------------------------------
// Expanded Badge Catalogue
// ---------------------------------------------------------------------------

const ACHIEVEMENT_CATALOGUE = {
  'first-book':      { icon: '📚', label: 'First Book!' },
  'five-books':      { icon: '📚', label: 'Bookshelf Builder' },
  'ten-books':       { icon: '🏆', label: 'Reading Champion' },
  'word-50':         { icon: '💡', label: 'Word Wizard' },
  'word-100':        { icon: '🧠', label: 'Vocabulary Master' },
  'streak-3':        { icon: '🔥', label: '3-Day Streak!' },
  'streak-7':        { icon: '🌟', label: 'Week Warrior' },
  'grammar-90':      { icon: '✨', label: 'Grammar Star' },
  'perfect-session': { icon: '🎯', label: 'Perfect Session!' },
  'early-bird':      { icon: '🌅', label: 'Early Bird' },
  'night-owl':       { icon: '🦉', label: 'Night Owl' },
  'speed-reader':    { icon: '⚡', label: 'Speed Reader' },
  'deep-thinker':    { icon: '🤔', label: 'Deep Thinker' },
  'bookworm':        { icon: '🐛', label: 'Bookworm' },
};

/** Full badge definitions with unlock conditions and descriptions */
const BADGES = [
  {
    id: 'first-review',
    label: 'First Review',
    description: 'Complete your very first session',
    emoji: '📚',
    condition: (sessions) => sessions.length >= 1,
  },
  {
    id: 'bookworm',
    label: 'Bookworm',
    description: 'Complete 5 review sessions',
    emoji: '🐛',
    condition: (sessions) => sessions.length >= 5,
  },
  {
    id: 'word-collector',
    label: 'Word Collector',
    description: 'Learn 50 new words',
    emoji: '💡',
    condition: (sessions) => sessions.reduce((sum, s) => sum + (s.wordsLearned || 0), 0) >= 50,
  },
  {
    id: 'grammar-star',
    label: 'Grammar Star',
    description: '3 sessions with >90% grammar accuracy',
    emoji: '✨',
    condition: (sessions) => sessions.filter((s) => (s.grammarScore || 0) > 90).length >= 3,
  },
  {
    id: 'deep-thinker',
    label: 'Deep Thinker',
    description: '3 sessions with strong deep thinking',
    emoji: '🤔',
    condition: (sessions) => sessions.filter((s) => {
      const score = s.stages?.['Think Deeper'] ?? s.stages?.body ?? 0;
      return score >= 80;
    }).length >= 3,
  },
  {
    id: 'streak-master',
    label: 'Streak Master',
    description: '7 consecutive days active',
    emoji: '🔥',
    condition: (sessions, streak) => streak >= 7,
  },
  {
    id: 'speed-reader',
    label: 'Speed Reader',
    description: 'Complete a session in under 10 minutes',
    emoji: '⚡',
    condition: (sessions) => sessions.some((s) => (s.duration || 999) < 10 && (s.duration || 0) > 0),
  },
];

// ---------------------------------------------------------------------------
// Growth Profile — 7 Dimensions
// ---------------------------------------------------------------------------

const GROWTH_DIMENSIONS = [
  { key: 'comprehension',   label: 'Comprehension',    icon: '📖', color: '#3D6B3D' },
  { key: 'vocabulary',      label: 'Vocabulary',        icon: '📝', color: '#5C8B5C' },
  { key: 'grammar',         label: 'Grammar',           icon: '✏️', color: '#D4A843' },
  { key: 'criticalThinking',label: 'Critical Thinking', icon: '💡', color: '#6B9BD2' },
  { key: 'creativity',      label: 'Creativity',        icon: '🎨', color: '#D4736B' },
  { key: 'expression',      label: 'Expression',        icon: '🗣️', color: '#8B6BB5' },
  { key: 'confidence',      label: 'Confidence',        icon: '⭐', color: '#E8A856' },
];

/**
 * Derive 7-dimension growth scores from session array.
 * All scores are clamped to [0, 100].
 */
function computeGrowthScores(sessions) {
  if (!sessions || sessions.length === 0) {
    return { comprehension: 0, vocabulary: 0, grammar: 0, criticalThinking: 0, creativity: 0, expression: 0, confidence: 0 };
  }

  const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const clamp = (v) => Math.min(100, Math.max(0, Math.round(v)));

  // comprehension: average levelScore
  const comprehension = clamp(avg(sessions.map((s) => s.levelScore || 0)));

  // vocabulary: based on wordsLearned — 20+ words per session = 100
  const vocabScores = sessions.map((s) => clamp(((s.wordsLearned || 0) / 20) * 100));
  const vocabulary = clamp(avg(vocabScores));

  // grammar: average grammarScore
  const grammar = clamp(avg(sessions.map((s) => s.grammarScore || 0)));

  // criticalThinking: average of body / Think Deeper stage score
  const ctScores = sessions.map((s) => {
    const v = s.stages?.['Think Deeper'] ?? s.stages?.body ?? s.stages?.criticalThinking ?? null;
    return v !== null ? v : null;
  }).filter((v) => v !== null);
  const criticalThinking = ctScores.length ? clamp(avg(ctScores)) : clamp(avg([comprehension, grammar]) - 5);

  // creativity: average of conclusion / My Thoughts stage score
  const creativityScores = sessions.map((s) => {
    const v = s.stages?.['My Thoughts'] ?? s.stages?.conclusion ?? s.stages?.creativity ?? null;
    return v !== null ? v : null;
  }).filter((v) => v !== null);
  const creativity = creativityScores.length ? clamp(avg(creativityScores)) : clamp(avg([comprehension, vocabulary]) - 5);

  // expression: average session duration — 20 min cap = 100
  const expressionScores = sessions.map((s) => clamp(((s.duration || 0) / 20) * 100));
  const expression = clamp(avg(expressionScores));

  // confidence: sessions completed, 10+ = 100
  const confidence = clamp((sessions.length / 10) * 100);

  return { comprehension, vocabulary, grammar, criticalThinking, creativity, expression, confidence };
}

// ---------------------------------------------------------------------------
// GrowthRadar — pure SVG spider/radar chart
// ---------------------------------------------------------------------------

function GrowthRadar({ dimensions, scores }) {
  const SIZE = 300;
  const CX = SIZE / 2;   // 150
  const CY = SIZE / 2;   // 150
  const R  = 110;        // outer radius of chart area
  const N  = dimensions.length; // 7

  // Compute the (x, y) for a point on axis `i` at fraction `t` (0..1)
  const axisPoint = (i, t) => {
    // Start from top, go clockwise
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    return {
      x: CX + R * t * Math.cos(angle),
      y: CY + R * t * Math.sin(angle),
    };
  };

  // Grid circle levels: 25%, 50%, 75%, 100%
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  // Build polygon points for a given level fraction
  const polygonPoints = (t) =>
    dimensions.map((_, i) => {
      const p = axisPoint(i, t);
      return `${p.x},${p.y}`;
    }).join(' ');

  // Data polygon based on actual scores
  const dataPoints = dimensions.map((dim, i) => {
    const score = scores[dim.key] ?? 0;
    const p = axisPoint(i, score / 100);
    return `${p.x},${p.y}`;
  }).join(' ');

  // Label positioning — push label a bit beyond the axis tip
  const labelPos = (i) => {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    const labelR = R + 24;
    return {
      x: CX + labelR * Math.cos(angle),
      y: CY + labelR * Math.sin(angle),
    };
  };

  // Icon positioning — slightly closer than label
  const iconPos = (i) => {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    const iconR = R + 10;
    return {
      x: CX + iconR * Math.cos(angle),
      y: CY + iconR * Math.sin(angle),
    };
  };

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width="100%"
      style={{ maxWidth: SIZE, display: 'block', margin: '0 auto' }}
      role="img"
      aria-label="Growth profile radar chart showing 7 skill dimensions"
    >
      {/* Cream background circle */}
      <circle cx={CX} cy={CY} r={R + 30} fill="#F5F0E8" />

      {/* Grid circles */}
      {gridLevels.map((t, idx) => (
        <polygon
          key={idx}
          points={polygonPoints(t)}
          fill="none"
          stroke={t === 1.0 ? '#C4A97D' : '#D6C9A8'}
          strokeWidth={t === 1.0 ? 1.5 : 1}
          strokeDasharray={t < 1.0 ? '4,3' : undefined}
          opacity={0.7}
        />
      ))}

      {/* Axis lines from center to each vertex */}
      {dimensions.map((_, i) => {
        const tip = axisPoint(i, 1);
        return (
          <line
            key={i}
            x1={CX}
            y1={CY}
            x2={tip.x}
            y2={tip.y}
            stroke="#C4A97D"
            strokeWidth={1}
            opacity={0.5}
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={dataPoints}
        fill="rgba(61,107,61,0.18)"
        stroke="#3D6B3D"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />

      {/* Data dots */}
      {dimensions.map((dim, i) => {
        const score = scores[dim.key] ?? 0;
        const p = axisPoint(i, score / 100);
        return (
          <circle
            key={dim.key}
            cx={p.x}
            cy={p.y}
            r={5}
            fill={dim.color}
            stroke="#FFFCF3"
            strokeWidth={2}
          />
        );
      })}

      {/* Labels: score number near each axis tip */}
      {dimensions.map((dim, i) => {
        const score = scores[dim.key] ?? 0;
        const lp = labelPos(i);
        const ip = iconPos(i);
        const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
        // Determine text-anchor based on angle quadrant
        const cosA = Math.cos(angle);
        const anchor = cosA > 0.2 ? 'start' : cosA < -0.2 ? 'end' : 'middle';
        return (
          <g key={dim.key}>
            {/* Score near the axis tip */}
            <text
              x={ip.x}
              y={ip.y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize="9"
              fontWeight="800"
              fill={dim.color}
            >
              {score}
            </text>
            {/* Label further out */}
            <text
              x={lp.x}
              y={lp.y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize="8.5"
              fontWeight="700"
              fill="#3D2E1E"
            >
              {dim.label}
            </text>
          </g>
        );
      })}

      {/* Centre dot */}
      <circle cx={CX} cy={CY} r={3} fill="#C4A97D" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// GrowthProfileSection — section card wrapping GrowthRadar + dimension cards
// ---------------------------------------------------------------------------

function GrowthProfileSection({ sessions }) {
  const scores = computeGrowthScores(sessions);

  return (
    <div className="ghibli-card p-5 sm:p-6 mb-6">
      {/* Section header */}
      <h2 className="text-xl sm:text-2xl font-extrabold text-[#3D2E1E] mb-1 flex items-center gap-2">
        <span aria-hidden="true">🌱</span>
        Growth Profile
      </h2>
      <p className="text-xs text-[#6B5744] font-semibold mb-5">
        Your 7-dimension learning skills based on completed sessions
      </p>

      {/* Radar chart */}
      <div
        className="w-full rounded-2xl p-4 mb-5"
        style={{ background: '#F5F0E8' }}
      >
        <GrowthRadar dimensions={GROWTH_DIMENSIONS} scores={scores} />
      </div>

      {/* Dimension score cards */}
      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-2">
        {GROWTH_DIMENSIONS.map((dim) => {
          const score = scores[dim.key] ?? 0;
          // Width of mini bar, at least 4px visible
          const barWidth = `${Math.max(4, score)}%`;
          return (
            <div
              key={dim.key}
              className="rounded-xl p-2.5 sm:p-3 flex flex-col gap-1"
              style={{ background: '#FFFCF3', border: `1.5px solid ${dim.color}22` }}
              aria-label={`${dim.label}: ${score} out of 100`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-base" aria-hidden="true">{dim.icon}</span>
                <span className="text-[10px] font-extrabold leading-tight" style={{ color: dim.color }}>
                  {dim.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div
                  className="flex-1 rounded-full overflow-hidden"
                  style={{ height: 5, background: '#EDE5D4' }}
                >
                  <div
                    style={{
                      width: barWidth,
                      height: '100%',
                      background: dim.color,
                      borderRadius: 9999,
                      transition: 'width 0.6s ease',
                    }}
                  />
                </div>
                <span className="text-[11px] font-extrabold" style={{ color: dim.color, minWidth: 24, textAlign: 'right' }}>
                  {score}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ghibli Palette
// ---------------------------------------------------------------------------

const GHIBLI = {
  primary: '#5C8B5C',
  primaryDark: '#3D6B3D',
  sky: '#87CEDB',
  gold: '#D4A843',
  success: '#7AC87A',
  bg: '#F5F0E8',
  card: '#FFFCF3',
  textDark: '#3D2E1E',
  textMid: '#6B5744',
};

// ---------------------------------------------------------------------------
// Helper: normalise API session shape
// ---------------------------------------------------------------------------

function normalizeSession(s) {
  const startedAt = s.startedAt || s.started_at;
  const completedAt = s.completedAt || s.completed_at;
  let duration = s.duration || s.durationMinutes || 0;
  if (!duration && startedAt && completedAt) {
    const diffMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    if (diffMs > 0) duration = Math.round(diffMs / 60000);
  }
  if (!duration && s.durationSeconds) duration = Math.round(s.durationSeconds / 60);
  return {
    id: s.id,
    bookTitle: s.bookTitle || s.book_title || s.title || 'Unknown Book',
    date: completedAt || startedAt || s.date || new Date().toISOString(),
    levelScore: s.levelScore ?? s.level_score ?? 0,
    grammarScore: s.grammarScore ?? s.grammar_score ?? 0,
    wordsLearned: s.wordsLearned || s.words_learned || s.wordCount || 0,
    duration,
    stage: s.stage || '',
    isComplete: s.isComplete ?? s.is_complete ?? false,
    stages: s.stages || s.stageScores || {},
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Level-up celebration overlay using CSS-only particle burst */
function LevelUpCelebration({ levelData, onDismiss }) {
  const particles = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Level up celebration"
    >
      <style>{`
        @keyframes levelup-burst {
          0%   { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
        .levelup-particle {
          animation: levelup-burst 1.2s cubic-bezier(0.22,1,0.36,1) var(--delay) both;
        }
        @keyframes levelup-pop {
          0%   { transform: scale(0.4); opacity: 0; }
          60%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        .levelup-card {
          animation: levelup-pop 0.55s cubic-bezier(0.175,0.885,0.32,1.275) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .levelup-particle { animation: none; opacity: 0; }
          .levelup-card     { animation: none; }
        }
      `}</style>

      {/* Burst particles */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
        {particles.map((i) => {
          const angle = (i / particles.length) * 360;
          const rad = (angle * Math.PI) / 180;
          const dist = 80 + Math.random() * 100;
          const tx = Math.round(Math.cos(rad) * dist);
          const ty = Math.round(Math.sin(rad) * dist);
          const colors = ['#D4A843', '#5C8B5C', '#87CEDB', '#EC4899', '#F97316'];
          const color = colors[i % colors.length];
          const size = 8 + Math.floor(Math.random() * 8);
          return (
            <div
              key={i}
              className="levelup-particle absolute rounded-full"
              style={{
                width: size,
                height: size,
                backgroundColor: color,
                '--tx': `${tx}px`,
                '--ty': `${ty}px`,
                '--delay': `${i * 0.04}s`,
              }}
            />
          );
        })}
      </div>

      {/* Card */}
      <div
        className="levelup-card relative bg-[#FFFCF3] rounded-3xl p-8 max-w-xs w-full text-center shadow-2xl border-2 border-[#D4A843]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-6xl mb-2" aria-hidden="true">{levelData.icon}</div>
        <p className="text-xs font-extrabold tracking-widest uppercase text-[#D4A843] mb-1">Level Up!</p>
        <h3 className="text-2xl font-extrabold text-[#3D2E1E] mb-1">Level {levelData.level}</h3>
        <p className="text-lg font-bold text-[#5C8B5C] mb-4">{levelData.name}</p>
        <p className="text-sm text-[#6B5744] mb-6">You reached a new level! Keep reading to grow even more.</p>
        <button
          onClick={onDismiss}
          className="w-full min-h-[48px] bg-[#5C8B5C] hover:bg-[#3D6B3D] text-white rounded-2xl font-extrabold text-sm transition-colors focus-visible:ring-2 focus-visible:ring-[#3D6B3D]"
          autoFocus
        >
          Awesome! {levelData.icon}
        </button>
      </div>
    </div>
  );
}

/** XP bar section */
function XPSection({ totalXP, onLevelUp }) {
  const { current, next, progressPct, xpIntoLevel, xpNeeded } = getXPLevel(totalXP);

  return (
    <div className="ghibli-card p-5 sm:p-6 mb-6" aria-label={`Experience points section: Level ${current.level}, ${current.name}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl sm:text-2xl font-extrabold text-[#3D2E1E] flex items-center gap-2">
          <span aria-hidden="true">{current.icon}</span>
          Experience
        </h2>
        <span
          className="px-3 py-1 rounded-full text-xs font-extrabold text-white"
          style={{ background: 'linear-gradient(135deg,#5C8B5C,#3D6B3D)' }}
        >
          Level {current.level}
        </span>
      </div>

      {/* Level name & XP count */}
      <div className="flex items-end justify-between mb-2">
        <p className="font-extrabold text-[#5C8B5C] text-lg">{current.name}</p>
        <p className="text-sm font-bold text-[#6B5744]">
          {totalXP.toLocaleString()} XP total
        </p>
      </div>

      {/* Progress bar */}
      <div
        className="w-full rounded-full h-5 overflow-hidden mb-2"
        style={{ background: '#EDE5D4' }}
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Level progress: ${progressPct}%`}
      >
        <div
          className="h-5 rounded-full transition-all duration-700"
          style={{
            width: `${progressPct}%`,
            background: 'linear-gradient(90deg, #5C8B5C 0%, #3D6B3D 100%)',
          }}
        />
      </div>

      {next ? (
        <p className="text-xs text-[#6B5744] font-semibold">
          {xpIntoLevel} / {xpNeeded} XP to <strong>{next.name}</strong> (Level {next.level})
        </p>
      ) : (
        <p className="text-xs text-[#5C8B5C] font-extrabold">Max level reached — Enchanted Forest!</p>
      )}

      {/* XP breakdown legend */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[
          { label: 'Per session', xp: '100 XP' },
          { label: 'Deep thinking', xp: '+50 XP' },
          { label: 'New vocab (15+)', xp: '+30 XP' },
          { label: 'Grammar >80%', xp: '+20 XP' },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#F5F0E8] text-xs"
          >
            <span className="text-[#6B5744] font-semibold">{item.label}</span>
            <span className="font-extrabold text-[#5C8B5C]">{item.xp}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Story chapter modal */
function ChapterModal({ chapter, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="chapter-title"
    >
      <div
        className="relative bg-[#F5F0E8] rounded-3xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl border border-[#C4A97D]"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(196,169,125,0.15) 28px)',
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 flex items-start justify-between p-5 sm:p-6 rounded-t-3xl"
          style={{ background: 'linear-gradient(135deg, #C4A97D 0%, #A8845A 100%)' }}
        >
          <div>
            <p className="text-xs text-white/80 font-extrabold uppercase tracking-widest mb-1">
              Chapter {chapter.id}
            </p>
            <h3
              id="chapter-title"
              className="text-lg sm:text-xl font-extrabold text-white leading-tight"
            >
              {chapter.title}
            </h3>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/35 text-white font-extrabold text-lg transition-colors focus-visible:ring-2 focus-visible:ring-white ml-3"
            aria-label="Close chapter"
          >
            x
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6">
          {chapter.content.split('\n\n').map((para, idx) => (
            <p key={idx} className="text-[#3D2E1E] leading-relaxed mb-4 last:mb-0 text-sm sm:text-base font-medium">
              {para}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Alice's Adventure stories section */
function StorySection({ completedSessions }) {
  const [openChapter, setOpenChapter] = useState(null);

  const unlocked = STORY_CHAPTERS.filter((ch) => completedSessions >= ch.sessionsRequired);
  const locked = STORY_CHAPTERS.filter((ch) => completedSessions < ch.sessionsRequired);

  return (
    <div className="ghibli-card p-5 sm:p-6 mb-6">
      <h2 className="text-xl sm:text-2xl font-extrabold text-[#3D2E1E] mb-1 flex items-center gap-2">
        <span aria-hidden="true">📖</span>
        Alice&apos;s Adventures
      </h2>
      <p className="text-xs text-[#6B5744] font-semibold mb-4">
        Unlock chapters by completing reading sessions
      </p>

      <div className="space-y-3">
        {STORY_CHAPTERS.map((chapter) => {
          const isUnlocked = completedSessions >= chapter.sessionsRequired;
          return (
            <div
              key={chapter.id}
              className={`rounded-2xl border transition-all duration-200 ${
                isUnlocked
                  ? 'border-[#C4A97D] bg-[#F5F0E8] hover:shadow-md cursor-pointer hover:-translate-y-0.5'
                  : 'border-[#D6C9A8] bg-[#EDE5D4] opacity-60 cursor-not-allowed'
              }`}
              style={isUnlocked ? {
                backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 23px,rgba(196,169,125,0.12) 24px)',
              } : {}}
              onClick={() => isUnlocked && setOpenChapter(chapter)}
              role={isUnlocked ? 'button' : undefined}
              tabIndex={isUnlocked ? 0 : undefined}
              onKeyDown={(e) => isUnlocked && e.key === 'Enter' && setOpenChapter(chapter)}
              aria-label={
                isUnlocked
                  ? `Read Chapter ${chapter.id}: ${chapter.title}`
                  : `Chapter ${chapter.id} locked — requires ${chapter.sessionsRequired} sessions`
              }
            >
              <div className="flex items-center gap-4 p-4">
                {/* Chapter icon */}
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-extrabold"
                  style={{
                    background: isUnlocked
                      ? 'linear-gradient(135deg,#C4A97D,#A8845A)'
                      : '#C4B89A',
                    color: isUnlocked ? 'white' : '#8C7B60',
                  }}
                  aria-hidden="true"
                >
                  {isUnlocked ? '📜' : '🔒'}
                </div>

                {/* Chapter info */}
                <div className="flex-1 min-w-0">
                  <p className={`font-extrabold text-sm leading-tight mb-0.5 ${isUnlocked ? 'text-[#3D2E1E]' : 'text-[#8C7B60]'}`}>
                    Chapter {chapter.id}: {chapter.title}
                  </p>
                  <p className={`text-xs font-semibold ${isUnlocked ? 'text-[#6B5744]' : 'text-[#A09070]'}`}>
                    {isUnlocked ? 'Tap to read' : `Unlocks after ${chapter.sessionsRequired} sessions`}
                  </p>
                </div>

                {/* Status badge */}
                {isUnlocked && (
                  <span
                    className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-extrabold"
                    style={{ background: '#E8F5E8', color: '#3D6B3D' }}
                  >
                    Read
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {openChapter && (
        <ChapterModal chapter={openChapter} onClose={() => setOpenChapter(null)} />
      )}
    </div>
  );
}

/** Streak counter with fire animation */
function StreakSection({ currentStreak, bestStreak }) {
  const isActive = currentStreak > 0;

  return (
    <div className="ghibli-card p-5 sm:p-6 mb-6">
      <h2 className="text-xl sm:text-2xl font-extrabold text-[#3D2E1E] mb-4 flex items-center gap-2">
        <span aria-hidden="true">{isActive ? '🔥' : '💧'}</span>
        Reading Streak
      </h2>

      <div className="flex items-center gap-6">
        {/* Current streak */}
        <div className="flex-1 text-center py-4 rounded-2xl" style={{ background: isActive ? 'linear-gradient(135deg,#FFF3CD,#FFE082)' : '#F5F0E8' }}>
          <div
            className={`text-5xl sm:text-6xl font-extrabold leading-none mb-1 ${isActive ? 'float-animation inline-block' : ''}`}
            style={{ color: isActive ? '#E65100' : '#A09070' }}
            aria-hidden="true"
          >
            {isActive ? '🔥' : '💧'}
          </div>
          <div className="text-4xl sm:text-5xl font-extrabold mt-1" style={{ color: isActive ? '#E65100' : '#6B5744' }}>
            {currentStreak}
          </div>
          <p className="text-xs font-bold mt-1" style={{ color: isActive ? '#BF360C' : '#6B5744' }}>
            Current Streak
          </p>
        </div>

        {/* Divider */}
        <div className="text-2xl text-[#D6C9A8] font-light" aria-hidden="true">|</div>

        {/* Best streak */}
        <div className="flex-1 text-center py-4 rounded-2xl bg-[#F5F0E8]">
          <div className="text-4xl sm:text-5xl font-extrabold text-[#D4A843] leading-none mb-1" aria-hidden="true">
            {bestStreak >= currentStreak ? bestStreak : currentStreak}
          </div>
          <p className="text-xs font-bold text-[#6B5744] mt-1">Best Streak</p>
          <p className="text-[10px] text-[#9C8B74] font-semibold">days</p>
        </div>
      </div>

      {isActive && (
        <p className="text-center text-xs text-[#BF360C] font-bold mt-3 bg-[#FFF3CD] rounded-xl py-2">
          You&apos;re on a roll! Keep reading every day to grow your streak.
        </p>
      )}
    </div>
  );
}

/** Enhanced badge grid with descriptions and locked states */
function BadgeSection({ earnedBadgeIds, sessions, currentStreak, serverAchievements }) {
  const [showAll, setShowAll] = useState(false);

  const enrichedBadges = BADGES.map((badge) => ({
    ...badge,
    earned: badge.condition(sessions, currentStreak),
  }));

  const earned = enrichedBadges.filter((b) => b.earned);
  const locked = enrichedBadges.filter((b) => !b.earned);
  const displayLocked = showAll ? locked : locked.slice(0, 6);

  const totalEarned = earned.length + serverAchievements.length;

  return (
    <div className="ghibli-card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-extrabold text-[#3D2E1E] flex items-center gap-2 text-xl sm:text-2xl">
          <span aria-hidden="true">🏆</span>
          Your Badges
        </h2>
        <span className="text-xs text-[#6B5744] font-bold bg-[#F5F0E8] px-2.5 py-1 rounded-full">
          {totalEarned} earned
        </span>
      </div>

      {/* Earned badges */}
      {earned.length > 0 || serverAchievements.length > 0 ? (
        <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-3 mb-5">
          {earned.map((badge) => (
            <div
              key={badge.id}
              className="flex flex-col items-center gap-1 p-2 sm:p-3 rounded-xl bg-[#E8F5E8] border border-[#C8E6C9]"
              style={{ boxShadow: '0 0 0 2px #D4A843, 0 4px 12px rgba(212,168,67,0.15)' }}
              title={badge.description}
              aria-label={`${badge.label} badge earned — ${badge.description}`}
            >
              <span className="text-2xl sm:text-3xl" aria-hidden="true">{badge.emoji}</span>
              <span className="text-[10px] text-center text-[#3D6B3D] font-extrabold leading-tight">{badge.label}</span>
            </div>
          ))}
          {serverAchievements.map((achievement, idx) => {
            const meta = ACHIEVEMENT_CATALOGUE[achievement.achievement_type || achievement.id] || {};
            return (
              <div
                key={`server-${idx}`}
                className="flex flex-col items-center gap-1 p-2 sm:p-3 rounded-xl bg-[#E8F5E8] border border-[#C8E6C9]"
                style={{ boxShadow: '0 0 0 2px #D4A843, 0 4px 12px rgba(212,168,67,0.15)' }}
                title={meta.label || achievement.label || 'Achievement'}
              >
                <span className="text-2xl sm:text-3xl" aria-hidden="true">{meta.icon || achievement.emoji || '🏅'}</span>
                <span className="text-[10px] text-center text-[#3D6B3D] font-extrabold leading-tight">
                  {meta.label || achievement.label || achievement.name || 'Achievement'}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 mb-5">
          <div className="text-4xl mb-2" aria-hidden="true">🌱</div>
          <p className="text-sm font-semibold text-[#6B5744]">Complete sessions to earn badges!</p>
        </div>
      )}

      {/* Locked badges */}
      {locked.length > 0 && (
        <div>
          <p className="text-[#6B5744] text-xs font-extrabold mb-2 uppercase tracking-wide">
            In Progress
          </p>
          <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-3">
            {displayLocked.map((badge) => (
              <div
                key={badge.id}
                className="flex flex-col items-center gap-1 p-2 sm:p-3 rounded-xl opacity-40 bg-[#EDE5D4] border border-[#D6C9A8]"
                title={badge.description}
                aria-label={`${badge.label} badge — locked: ${badge.description}`}
              >
                <span className="text-2xl grayscale" aria-hidden="true">{badge.emoji}</span>
                <span className="text-[10px] text-center text-[#6B5744] leading-tight">{badge.label}</span>
                <span className="text-[9px] text-[#9C8B74] leading-tight text-center">{badge.description}</span>
              </div>
            ))}
          </div>
          {locked.length > 6 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 w-full text-xs font-bold text-[#5C8B5C] underline underline-offset-2 hover:text-[#3D6B3D] focus-visible:ring-2 focus-visible:ring-[#3D6B3D] rounded"
            >
              {showAll ? 'Show less' : `Show ${locked.length - 6} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const router = useRouter();

  // Core data state
  const [student, setStudent] = useState(MOCK_STUDENT);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [analyticsAchievements, setAnalyticsAchievements] = useState([]);

  // UI state
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(MOCK_STUDENT.avatar);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // Gamification state
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpData, setLevelUpData] = useState(null);
  const [bestStreak, setBestStreak] = useState(0);
  const [storedXP, setStoredXP] = useState(0);

  // Load stored XP and best streak from localStorage on mount
  useEffect(() => {
    const storedName = getItem('studentName');
    const storedLevel = getItem('studentLevel');
    const storedId = getItem('studentId');

    setStudent((prev) => ({
      ...prev,
      id: storedId || prev.id,
      name: storedName || prev.name,
      level: storedLevel || prev.level,
    }));

    const savedXP = parseInt(localStorage.getItem('hialice_xp') || '0', 10);
    const savedBest = parseInt(localStorage.getItem('hialice_best_streak') || '0', 10);
    setStoredXP(savedXP);
    setBestStreak(savedBest);

    fetchProfileData(storedId);
  }, []);

  // Persist XP to localStorage whenever sessions change
  useEffect(() => {
    if (sessions.length === 0) return;
    const newXP = computeXP(sessions);
    const prevXP = parseInt(localStorage.getItem('hialice_xp') || '0', 10);

    // Detect level-up crossing
    if (newXP > prevXP) {
      const { current: prevLevel } = getXPLevel(prevXP);
      const { current: newLevel } = getXPLevel(newXP);
      if (newLevel.level > prevLevel.level) {
        setLevelUpData(newLevel);
        setShowLevelUp(true);
      }
    }

    localStorage.setItem('hialice_xp', String(newXP));
    setStoredXP(newXP);
  }, [sessions]);

  async function fetchProfileData(studentId) {
    try {
      setLoading(true);
      setUsingFallback(false);

      if (!studentId) {
        setUsingFallback(true);
        setSessions(MOCK_SESSIONS);
        setLoading(false);
        return;
      }

      let sessionsData = null;
      let analyticsData = null;
      let vocabStatsData = null;

      try {
        [sessionsData, analyticsData, vocabStatsData] = await Promise.all([
          getStudentSessions(studentId),
          getStudentAnalytics(studentId),
          getVocabStats(studentId),
        ]);
      } catch (apiErr) {
        console.warn('API unavailable, using fallback data:', apiErr);
        setUsingFallback(true);
      }

      if (sessionsData && sessionsData.sessions && sessionsData.sessions.length > 0) {
        const normalized = sessionsData.sessions.map(normalizeSession);
        setSessions(normalized);
        if (sessionsData.stats) {
          const apiStats = sessionsData.stats;
          setStudent((prev) => ({
            ...prev,
            current_streak: apiStats.streak ?? prev.current_streak,
          }));
        }
      } else if (sessionsData && Array.isArray(sessionsData) && sessionsData.length > 0) {
        setSessions(sessionsData.map(normalizeSession));
      } else {
        setUsingFallback(true);
        setSessions(MOCK_SESSIONS);
      }

      if (vocabStatsData && vocabStatsData.stats) {
        setStudent((prev) => ({
          ...prev,
          totalWordsFromAPI: vocabStatsData.stats.totalWords || 0,
        }));
      }

      if (analyticsData && analyticsData.analytics) {
        const { achievements, student: analyticsStudent } = analyticsData.analytics;
        if (achievements && achievements.length > 0) setAnalyticsAchievements(achievements);
        if (analyticsStudent && analyticsStudent.current_streak !== undefined) {
          setStudent((prev) => ({
            ...prev,
            current_streak: analyticsStudent.current_streak,
          }));
        }
      }
    } catch (err) {
      console.error('Unexpected error loading profile:', err);
      setUsingFallback(true);
      setSessions(MOCK_SESSIONS);
    } finally {
      setLoading(false);
    }
  }

  const handleLogout = async () => {
    try { await logout(); } catch (e) { console.warn('Logout error:', e); }
    finally { router.push('/'); }
  };

  // Derived stats
  const hasSessions = sessions.length > 0;
  const totalBooksRead = sessions.length;
  const totalWordsLearned = student.totalWordsFromAPI
    || sessions.reduce((sum, s) => sum + (s.wordsLearned || 0), 0);
  const avgGrammarScore = hasSessions
    ? Math.round(sessions.reduce((sum, s) => sum + (s.grammarScore || 0), 0) / sessions.length)
    : 0;

  const calculateStreak = useCallback(() => {
    if (!hasSessions) return student.current_streak || 0;
    const sortedSessions = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
    let streak = 1;
    for (let i = 0; i < sortedSessions.length - 1; i++) {
      const curr = new Date(sortedSessions[i].date);
      const next = new Date(sortedSessions[i + 1].date);
      const diff = (curr.getTime() - next.getTime()) / (1000 * 60 * 60 * 24);
      if (Math.round(diff) === 1) { streak++; } else { break; }
    }
    return Math.max(streak, student.current_streak || 0);
  }, [sessions, hasSessions, student.current_streak]);

  const currentStreak = calculateStreak();

  // Persist best streak
  useEffect(() => {
    if (currentStreak > bestStreak) {
      const newBest = currentStreak;
      setBestStreak(newBest);
      localStorage.setItem('hialice_best_streak', String(newBest));
    }
  }, [currentStreak, bestStreak]);

  const totalXP = computeXP(sessions);

  const getLevelProgress = () => {
    const levelMap = { Beginner: 1, beginner: 1, Intermediate: 2, intermediate: 2, Advanced: 3, advanced: 3 };
    const currentLevelNum = levelMap[student.level] || 1;
    const booksForNextLevel = currentLevelNum * 5;
    const progress = Math.min((totalBooksRead / booksForNextLevel) * 100, 100);
    return { progress: Math.round(progress), booksNeeded: Math.max(0, booksForNextLevel - totalBooksRead) };
  };

  const { progress: levelProgress, booksNeeded } = getLevelProgress();

  const getWeeklyData = () => {
    const weeks = [0, 0, 0, 0];
    const today = new Date();
    sessions.forEach((session) => {
      const sessionDate = new Date(session.date);
      const daysAgo = Math.floor((today.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(daysAgo / 7);
      if (weekIndex < 4) { weeks[weekIndex]++; }
    });
    return weeks.reverse();
  };

  const weeklyData = getWeeklyData();
  const maxWeeklyBooks = Math.max(...weeklyData, 1);
  const getGrammarTrend = () => sessions.slice().reverse().slice(0, 5).map((s) => s.grammarScore || 0);
  const grammarTrend = getGrammarTrend();

  const generateVocabChart = () => {
    const cumulativeWords = [];
    let total = 0;
    sessions.slice().reverse().forEach((s) => { total += s.wordsLearned || 0; cumulativeWords.push(total); });
    const maxWords = Math.max(...cumulativeWords, 1);
    const points = cumulativeWords.map((words, idx) => {
      const x = (idx / Math.max(cumulativeWords.length - 1, 1)) * 200;
      const y = 120 - (words / maxWords) * 100;
      return `${x},${y}`;
    }).join(' ');
    return { points, maxWords, count: cumulativeWords.length };
  };

  const { points: vocabPoints, maxWords } = generateVocabChart();

  const generateGrammarChart = () => {
    return grammarTrend.map((score, idx) => {
      const x = (idx / Math.max(grammarTrend.length - 1, 1)) * 200;
      const y = 120 - (score / 100) * 100;
      return `${x},${y}`;
    }).join(' ');
  };

  const grammarPoints = generateGrammarChart();

  const serverAchievements = analyticsAchievements.filter(
    (a) => !BADGES.find((b) => b.id === (a.achievement_type || a.id))
  );

  const handleAvatarChange = (avatar) => {
    setSelectedAvatar(avatar);
    setStudent((prev) => ({ ...prev, avatar }));
    setShowAvatarPicker(false);
  };

  if (loading) {
    return (
      <div className="py-6">
        <div className="space-y-6">
          <LoadingCard lines={3} />
          <LoadingCard lines={4} />
          <LoadingCard lines={2} />
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6">
      {/* Level-up overlay */}
      {showLevelUp && levelUpData && (
        <LevelUpCelebration
          levelData={levelUpData}
          onDismiss={() => setShowLevelUp(false)}
        />
      )}

      <div className="w-full">
        {/* Fallback notice */}
        {usingFallback && (
          <div
            className="mb-4 px-4 py-3 rounded-xl border-l-4 text-sm font-bold flex items-center gap-2"
            style={{ backgroundColor: '#FFF8E8', borderColor: '#D4A843', color: '#A8822E' }}
            role="status"
          >
            <span aria-hidden="true">💡</span>
            Showing example data. Sign in or connect to the internet to see your real progress.
          </div>
        )}

        {/* Student Profile Card */}
        <div className="rounded-3xl overflow-hidden shadow-[0_6px_28px_rgba(61,46,30,0.12)] mb-6">
          <div
            className="p-6 sm:p-8 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #3D6B3D 0%, #5C8B5C 45%, #87CEDB 100%)' }}
          >
            <div
              className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(168,222,234,0.2) 0%, transparent 70%)',
                transform: 'translate(20%, -20%)',
              }}
              aria-hidden="true"
            />
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-4 sm:gap-6">
                <button
                  className="text-7xl sm:text-8xl cursor-pointer hover:scale-110 transition-transform focus-visible:ring-2 focus-visible:ring-white rounded-2xl flex-shrink-0"
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  aria-label="Change avatar"
                  title="Click to change avatar"
                >
                  {student.avatar}
                </button>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-white drop-shadow-sm">{student.name}</h1>
                  {student.age && (
                    <p className="text-white/80 mt-0.5 sm:mb-3 text-sm font-semibold">Age {student.age}</p>
                  )}
                  {/* XP level badge in header */}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 text-white font-extrabold text-xs border border-white/30">
                      {getXPLevel(totalXP).current.icon} {getXPLevel(totalXP).current.name}
                    </span>
                    {isParentOrAdmin() && (
                      <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-white font-extrabold text-xs border border-white/30">
                        {student.level}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="flex-shrink-0 px-3 sm:px-4 py-2 min-h-[40px] bg-white/15 hover:bg-white/25 border border-white/30 text-white rounded-xl font-bold text-xs sm:text-sm transition-all hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Log out of HiAlice"
              >
                Log out
              </button>
            </div>
          </div>

          <div className="bg-[#FFFCF3] p-4 sm:p-6">
            {showAvatarPicker && (
              <div className="mb-6 pb-6 border-b border-[#E8DEC8]">
                <p className="text-[#6B5744] font-extrabold mb-3 text-sm">Choose Your Avatar:</p>
                <div className="flex gap-2 sm:gap-3 flex-wrap">
                  {AVATAR_OPTIONS.map((avatar) => (
                    <button
                      key={avatar}
                      onClick={() => handleAvatarChange(avatar)}
                      className={`text-4xl sm:text-5xl p-2 min-w-[52px] min-h-[52px] rounded-xl transition-all hover:-translate-y-0.5 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#5C8B5C] ${
                        selectedAvatar === avatar
                          ? 'ring-4 ring-[#5C8B5C] bg-[#E8F5E8]'
                          : 'hover:bg-[#F5F0E8]'
                      }`}
                      aria-label={`Select ${AVATAR_LABELS[avatar] || avatar} avatar`}
                      aria-pressed={selectedAvatar === avatar}
                    >
                      <span role="img" aria-label={AVATAR_LABELS[avatar] || avatar}>{avatar}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {[
                { label: 'Books Read', value: totalBooksRead, color: GHIBLI.primary, icon: '📚' },
                { label: 'Words Learned', value: totalWordsLearned, color: GHIBLI.success, icon: '💡' },
                { label: 'Day Streak', value: currentStreak, color: currentStreak > 0 ? '#E65100' : GHIBLI.gold, icon: currentStreak > 0 ? '🔥' : '💧' },
                { label: 'Total XP', value: `${totalXP.toLocaleString()}`, color: GHIBLI.gold, icon: '⭐' },
              ].map((stat, idx) => (
                <div key={idx} className="text-center p-3 sm:p-4 rounded-2xl bg-[#F5F0E8]">
                  <div className="text-lg sm:text-xl mb-1" aria-hidden="true">{stat.icon}</div>
                  <div className="text-2xl sm:text-3xl font-extrabold leading-none" style={{ color: stat.color }}>
                    {stat.value}
                  </div>
                  <p className="text-[#6B5744] text-[10px] sm:text-xs font-bold mt-1 leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* XP / Experience Section */}
        <XPSection totalXP={totalXP} />

        {/* Streak Counter */}
        <StreakSection currentStreak={currentStreak} bestStreak={bestStreak} />

        {/* Level Progress — only for parents/admins */}
        {isParentOrAdmin() && (
          <div className="ghibli-card p-5 sm:p-6 mb-6">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#3D2E1E] mb-4 flex items-center gap-2">
              <span aria-hidden="true">⬆️</span> Level Progress
            </h2>
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <div className="w-full bg-[#EDE5D4] rounded-full h-4 overflow-hidden">
                  <div
                    className="h-4 rounded-full transition-all duration-500"
                    style={{ width: `${levelProgress}%`, backgroundColor: GHIBLI.success }}
                  />
                </div>
                <p className="text-[#6B5744] text-sm font-semibold mt-2">
                  {booksNeeded === 0
                    ? 'Ready to level up!'
                    : `${levelProgress}% to next level — ${booksNeeded} more books to go`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-extrabold" style={{ color: GHIBLI.primary }}>{levelProgress}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Growth Profile — 7-dimension radar chart */}
        <GrowthProfileSection sessions={sessions} />

        {/* Achievement Badges */}
        <BadgeSection
          earnedBadgeIds={[]}
          sessions={sessions}
          currentStreak={currentStreak}
          serverAchievements={serverAchievements}
        />

        {/* Alice's Adventures Stories */}
        <StorySection completedSessions={sessions.length} />

        {/* Growth Charts */}
        {hasSessions && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Books Per Week */}
            <div className="ghibli-card p-6">
              <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-4">Books per Week (4 weeks)</h3>
              <div className="flex items-end gap-2 h-40 justify-around">
                {weeklyData.map((count, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex items-end justify-center mb-2">
                      <div
                        className="w-12 rounded-t-xl transition-all"
                        style={{
                          height: `${(count / maxWeeklyBooks) * 120}px`,
                          backgroundColor: GHIBLI.gold,
                          minHeight: '8px',
                        }}
                      />
                    </div>
                    <span className="text-sm font-extrabold text-[#6B5744]">{count}</span>
                    <span className="text-xs text-[#6B5744] font-medium">W{idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Grammar Trend */}
            <div className="ghibli-card p-6">
              <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-4">Grammar Trend</h3>
              <svg width="100%" height="160" viewBox="0 0 220 140" className="mb-2">
                <line x1="20" y1="120" x2="200" y2="120" stroke="#EDE5D4" strokeWidth="1" />
                <line x1="20" y1="20" x2="20" y2="120" stroke="#EDE5D4" strokeWidth="1" />
                {grammarTrend.length > 0 && (
                  <>
                    <polyline
                      points={grammarPoints}
                      fill="none"
                      stroke={GHIBLI.success}
                      strokeWidth="2"
                      style={{ transform: 'translate(20px, 0)' }}
                    />
                    {grammarTrend.map((score, idx) => {
                      const x = 20 + (idx / Math.max(grammarTrend.length - 1, 1)) * 180;
                      const y = 120 - (score / 100) * 100;
                      return <circle key={idx} cx={x} cy={y} r="4" fill={GHIBLI.success} />;
                    })}
                  </>
                )}
              </svg>
              <p className="text-xs text-[#6B5744] text-center font-semibold">Last 5 sessions</p>
            </div>

            {/* Vocabulary Growth */}
            <div className="ghibli-card p-6">
              <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-4">Cumulative Words</h3>
              <svg width="100%" height="160" viewBox="0 0 220 140" className="mb-2">
                <line x1="20" y1="120" x2="200" y2="120" stroke="#EDE5D4" strokeWidth="1" />
                <line x1="20" y1="20" x2="20" y2="120" stroke="#EDE5D4" strokeWidth="1" />
                {vocabPoints && (
                  <>
                    <polyline
                      points={vocabPoints}
                      fill="none"
                      stroke={GHIBLI.gold}
                      strokeWidth="2"
                      style={{ transform: 'translate(20px, 0)' }}
                    />
                    {sessions.slice().reverse().map((s, idx) => {
                      const sessionsReversed = sessions.slice().reverse();
                      if (idx >= sessionsReversed.length) return null;
                      const x = 20 + (idx / Math.max(sessionsReversed.length - 1, 1)) * 180;
                      let total = 0;
                      for (let i = 0; i <= idx; i++) { total += sessionsReversed[i].wordsLearned || 0; }
                      const y = 120 - (total / maxWords) * 100;
                      return <circle key={idx} cx={x} cy={y} r="4" fill={GHIBLI.gold} />;
                    })}
                  </>
                )}
              </svg>
              <p className="text-xs text-[#6B5744] text-center font-semibold">Cumulative words over sessions</p>
            </div>

            {/* Summary */}
            <div className="ghibli-card p-6">
              <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-4">Summary</h3>
              <div className="space-y-3">
                {[
                  { label: 'Total Sessions', value: sessions.length },
                  {
                    label: 'Avg Session Length',
                    value: `${Math.round(sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length)} min`,
                  },
                  { label: 'Best Grammar Score', value: `${Math.max(...sessions.map((s) => s.grammarScore || 0))}%` },
                  ...(isParentOrAdmin() ? [{
                    label: 'Avg Level Score',
                    value: `${Math.round(sessions.reduce((sum, s) => sum + (s.levelScore || 0), 0) / sessions.length)}%`,
                  }] : []),
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-[#EDE5D4] last:border-0">
                    <span className="text-[#6B5744] font-semibold">{item.label}</span>
                    <span className="font-extrabold text-lg text-[#5C8B5C]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Session History */}
        <div className="ghibli-card overflow-hidden mb-6">
          <div className="px-5 sm:px-6 py-4 border-b border-[#E8DEC8] bg-[#F5F0E8]">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#3D2E1E] flex items-center gap-2">
              <span aria-hidden="true">📋</span> Review History
            </h2>
          </div>

          {!hasSessions ? (
            <div className="px-6 py-12 text-center text-[#6B5744]">
              <div className="text-5xl mb-4 float-animation inline-block" aria-hidden="true">📚</div>
              <p className="text-lg font-bold mb-2 text-[#6B5744]">No review sessions yet.</p>
              <p className="text-sm font-medium mb-6">Start your first book to see your history here!</p>
              <button
                onClick={() => router.push('/books')}
                className="min-h-[48px] px-6 py-3 bg-[#5C8B5C] text-white rounded-2xl font-bold hover:-translate-y-0.5 transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-[#3D6B3D] inline-flex items-center gap-2"
              >
                <span aria-hidden="true">📚</span>
                Choose a Book
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#EDE5D4]">
              {sessions.map((session) => (
                <div key={session.id}>
                  <button
                    onClick={() => setExpandedSessionId(expandedSessionId === session.id ? null : session.id)}
                    className="w-full px-6 py-4 hover:bg-[#F5F0E8] transition-colors text-left"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-extrabold text-[#3D2E1E] text-base">{session.bookTitle}</h4>
                      <span className="text-[#6B5744] text-sm font-semibold">
                        {new Date(session.date).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex gap-6 flex-wrap">
                      {isParentOrAdmin() && (
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs font-bold text-[#6B5744]">Level Score</span>
                            <span className="text-xs font-extrabold text-[#5C8B5C]">{session.levelScore}%</span>
                          </div>
                          <div className="w-full bg-[#EDE5D4] rounded-full h-2">
                            <div className="h-2 rounded-full bg-[#5C8B5C]" style={{ width: `${session.levelScore}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-bold text-[#6B5744]">Grammar Score</span>
                          <span className="text-xs font-extrabold text-[#7AC87A]">{session.grammarScore}%</span>
                        </div>
                        <div className="w-full bg-[#EDE5D4] rounded-full h-2">
                          <div className="h-2 rounded-full bg-[#7AC87A]" style={{ width: `${session.grammarScore}%` }} />
                        </div>
                      </div>
                    </div>
                  </button>

                  {expandedSessionId === session.id && (
                    <div className="px-6 py-4 border-t border-[#EDE5D4] bg-[#F5F0E8]">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-[#6B5744] font-bold mb-1">Words Learned</p>
                          <p className="text-2xl font-extrabold text-[#3D2E1E]">{session.wordsLearned}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6B5744] font-bold mb-1">Session Duration</p>
                          <p className="text-2xl font-extrabold text-[#3D2E1E]">{session.duration} min</p>
                        </div>
                      </div>

                      {session.stages && Object.keys(session.stages).length > 0 && (
                        <div>
                          <p className="text-xs text-[#6B5744] font-bold mb-3">Stage Scores</p>
                          <div className="space-y-2">
                            {Object.entries(session.stages).map(([stage, scoreVal]) => (
                              <div key={stage}>
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm font-extrabold text-[#6B5744]">{stage}</span>
                                  <span className="text-sm font-extrabold text-[#5C8B5C]">{scoreVal}%</span>
                                </div>
                                <div className="w-full bg-[#EDE5D4] rounded-full h-2">
                                  <div className="h-2 rounded-full bg-[#5C8B5C]" style={{ width: `${scoreVal}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-center mb-8">
          <button
            onClick={() => router.push('/books')}
            className="flex-1 sm:flex-initial min-h-[52px] px-8 py-3 text-white rounded-2xl font-extrabold text-base hover:-translate-y-0.5 transition-all shadow-[0_4px_12px_rgba(92,139,92,0.3)] focus-visible:ring-2 focus-visible:ring-[#3D6B3D] flex items-center justify-center gap-2"
            style={{ backgroundColor: GHIBLI.primary }}
          >
            <span aria-hidden="true">📚</span>
            Go to Library
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 sm:flex-initial min-h-[52px] px-8 py-3 rounded-2xl font-extrabold text-base border-2 hover:-translate-y-0.5 transition-all focus-visible:ring-2 focus-visible:ring-[#D4736B] flex items-center justify-center gap-2"
            style={{ backgroundColor: GHIBLI.bg, borderColor: '#D4736B', color: '#D4736B' }}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
