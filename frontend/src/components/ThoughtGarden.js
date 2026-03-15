'use client';

import { useState, useEffect, useMemo } from 'react';

/**
 * ThoughtGarden — Visual metaphor for cognitive growth
 *
 * Each "thought" (from a completed session) grows through 4 stages:
 * seed → sprout → tree → fruit
 *
 * Growth stage is determined by the session's thinking depth score:
 *  - seed (0-25): Basic recall / remember level
 *  - sprout (26-50): Understanding / applying concepts
 *  - tree (51-75): Analyzing / evaluating ideas
 *  - fruit (76-100): Creating / synthesizing new thoughts
 */

const GROWTH_STAGES = {
  seed: { emoji: '🌱', label: 'Seed', color: '#8B7355', minScore: 0 },
  sprout: { emoji: '🌿', label: 'Sprout', color: '#90BE6D', minScore: 26 },
  tree: { emoji: '🌳', label: 'Tree', color: '#43AA8B', minScore: 51 },
  fruit: { emoji: '🍎', label: 'Fruit', color: '#F94144', minScore: 76 },
};

function getGrowthStage(score) {
  if (score >= 76) return 'fruit';
  if (score >= 51) return 'tree';
  if (score >= 26) return 'sprout';
  return 'seed';
}

function getGrowthLabel(stage) {
  const labels = {
    seed: 'Just planted! Keep thinking...',
    sprout: 'Growing nicely! Your ideas are budding.',
    tree: 'Strong thinking! Your ideas have deep roots.',
    fruit: 'Amazing! Your thoughts are bearing fruit!',
  };
  return labels[stage] || labels.seed;
}

/**
 * Single thought plant in the garden
 */
function ThoughtPlant({ bookTitle, score, completedAt, index }) {
  const stage = getGrowthStage(score);
  const { emoji, label, color } = GROWTH_STAGES[stage];
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(true), index * 150);
    return () => clearTimeout(timer);
  }, [index]);

  const dateStr = completedAt
    ? new Date(completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  return (
    <div
      className={`flex flex-col items-center transition-all duration-700 ${
        isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ minWidth: '80px' }}
    >
      {/* Plant visualization */}
      <div
        className="relative flex items-center justify-center w-16 h-16 rounded-full mb-1 transition-transform hover:scale-110 cursor-pointer"
        style={{ backgroundColor: `${color}20`, border: `2px solid ${color}` }}
        title={`${bookTitle} — ${label} (${score}/100)`}
      >
        <span className="text-2xl" role="img" aria-label={label}>
          {emoji}
        </span>
        {/* Score badge */}
        <span
          className="absolute -bottom-1 -right-1 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center text-white"
          style={{ backgroundColor: color }}
        >
          {score}
        </span>
      </div>
      {/* Book title (truncated) */}
      <p className="text-xs text-center text-gray-600 max-w-[80px] truncate" title={bookTitle}>
        {bookTitle}
      </p>
      {/* Date */}
      <p className="text-xs text-gray-400">{dateStr}</p>
    </div>
  );
}

/**
 * Garden summary stats
 */
function GardenStats({ thoughts }) {
  const stats = useMemo(() => {
    if (!thoughts || thoughts.length === 0) {
      return { seeds: 0, sprouts: 0, trees: 0, fruits: 0, avgScore: 0 };
    }
    const counts = { seed: 0, sprout: 0, tree: 0, fruit: 0 };
    let totalScore = 0;
    thoughts.forEach(t => {
      const stage = getGrowthStage(t.score || 0);
      counts[stage]++;
      totalScore += (t.score || 0);
    });
    return {
      seeds: counts.seed,
      sprouts: counts.sprout,
      trees: counts.tree,
      fruits: counts.fruit,
      avgScore: Math.round(totalScore / thoughts.length),
    };
  }, [thoughts]);

  return (
    <div className="flex gap-4 justify-center flex-wrap mb-4">
      {[
        { emoji: '🌱', count: stats.seeds, label: 'Seeds' },
        { emoji: '🌿', count: stats.sprouts, label: 'Sprouts' },
        { emoji: '🌳', count: stats.trees, label: 'Trees' },
        { emoji: '🍎', count: stats.fruits, label: 'Fruits' },
      ].map(({ emoji, count, label }) => (
        <div key={label} className="flex items-center gap-1 text-sm">
          <span aria-hidden="true">{emoji}</span>
          <span className="font-semibold">{count}</span>
          <span className="text-gray-500">{label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1 text-sm border-l pl-4 border-gray-200">
        <span className="text-gray-500">Avg:</span>
        <span className="font-bold text-green-600">{stats.avgScore}</span>
      </div>
    </div>
  );
}

/**
 * ThoughtGarden — Main component
 *
 * Props:
 * @param {Array} thoughts - Array of { bookTitle, score, completedAt }
 * @param {string} studentName - Student's name for personalization
 * @param {boolean} compact - If true, shows a smaller version
 */
export default function ThoughtGarden({ thoughts = [], studentName = '', compact = false }) {
  const sortedThoughts = useMemo(
    () => [...thoughts].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)),
    [thoughts]
  );

  const gardenLevel = useMemo(() => {
    if (sortedThoughts.length === 0) return 'Empty Garden';
    const fruits = sortedThoughts.filter(t => getGrowthStage(t.score || 0) === 'fruit').length;
    if (fruits >= 10) return 'Enchanted Forest';
    if (fruits >= 5) return 'Blooming Garden';
    if (sortedThoughts.length >= 10) return 'Growing Garden';
    if (sortedThoughts.length >= 5) return 'Little Garden';
    return 'New Garden';
  }, [sortedThoughts]);

  if (compact) {
    return (
      <div className="bg-green-50 rounded-xl p-3 border border-green-100">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg" aria-hidden="true">🌻</span>
          <span className="font-semibold text-green-800 text-sm">{gardenLevel}</span>
          <span className="text-xs text-gray-500">({sortedThoughts.length} thoughts)</span>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {sortedThoughts.slice(0, 8).map((thought, i) => {
            const stage = getGrowthStage(thought.score || 0);
            return (
              <span
                key={i}
                className="text-lg flex-shrink-0"
                title={`${thought.bookTitle}: ${thought.score}/100`}
                aria-hidden="true"
              >
                {GROWTH_STAGES[stage].emoji}
              </span>
            );
          })}
          {sortedThoughts.length > 8 && (
            <span className="text-xs text-gray-400 self-center">+{sortedThoughts.length - 8}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-green-50 to-amber-50 rounded-2xl p-6 border border-green-100">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-green-800 flex items-center justify-center gap-2">
          <span aria-hidden="true">🌻</span>
          {studentName ? `${studentName}'s` : 'My'} Thought Garden
        </h2>
        <p className="text-sm text-green-600 mt-1">{gardenLevel}</p>
      </div>

      {/* Stats */}
      {sortedThoughts.length > 0 && <GardenStats thoughts={sortedThoughts} />}

      {/* Garden grid */}
      {sortedThoughts.length === 0 ? (
        <div className="text-center py-8">
          <span className="text-4xl mb-3 block" aria-hidden="true">🌱</span>
          <p className="text-gray-500">Your garden is waiting for its first thought!</p>
          <p className="text-sm text-gray-400 mt-1">Complete a review session to plant your first seed.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 justify-center py-4">
          {sortedThoughts.map((thought, i) => (
            <ThoughtPlant
              key={i}
              bookTitle={thought.bookTitle}
              score={thought.score || 0}
              completedAt={thought.completedAt}
              index={i}
            />
          ))}
        </div>
      )}

      {/* Growth guide */}
      <div className="mt-4 pt-3 border-t border-green-100">
        <p className="text-xs text-center text-gray-400">
          <span aria-hidden="true">🌱</span> Seed <span aria-hidden="true">→ 🌿</span> Sprout <span aria-hidden="true">→ 🌳</span> Tree <span aria-hidden="true">→ 🍎</span> Fruit — Keep thinking deeper to grow your garden!
        </p>
      </div>
    </div>
  );
}
