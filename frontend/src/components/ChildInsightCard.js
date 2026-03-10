'use client';

import { useState, useEffect } from 'react';

/**
 * ChildInsightCard — "What my child said today"
 * Shows highlighted quotes from a child's recent reading sessions.
 * Designed for the parent dashboard.
 *
 * Props:
 * @param {Array} highlights - Array of { bookTitle, quote, thinkingDepth, stage, createdAt }
 * @param {object} growthSummary - { totalRecentSessions, deepThinkingMoments, encouragement }
 * @param {string} studentName - Child's name
 * @param {string} studentEmoji - Child's avatar emoji
 */

const DEPTH_STYLES = {
  deep: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', icon: '💡' },
  analytical: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', icon: '🔍' },
  developing: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-700', icon: '🌱' },
};

const STAGE_LABELS = {
  warm_connection: 'Warm-up',
  title: 'Title',
  introduction: 'Characters',
  body: 'Discussion',
  conclusion: 'Reflection',
  cross_book: 'Cross-Book',
};

function QuoteCard({ highlight, index }) {
  const [isVisible, setIsVisible] = useState(false);
  const style = DEPTH_STYLES[highlight.thinkingDepth] || DEPTH_STYLES.developing;

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 200);
    return () => clearTimeout(timer);
  }, [index]);

  const timeAgo = getTimeAgo(highlight.createdAt);

  return (
    <div
      className={`${style.bg} ${style.border} border rounded-xl p-4 transition-all duration-500 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span>{style.icon}</span>
          <span className="text-xs font-medium text-gray-500">
            {STAGE_LABELS[highlight.stage] || highlight.stage}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${style.badge}`}>
            {highlight.thinkingDepth}
          </span>
        </div>
        <span className="text-xs text-gray-400">{timeAgo}</span>
      </div>

      {/* Quote */}
      <blockquote className="text-sm text-gray-700 italic leading-relaxed mb-2">
        "{highlight.quote}"
      </blockquote>

      {/* Book reference */}
      <div className="flex items-center gap-1 text-xs text-gray-400">
        <span>📖</span>
        <span>{highlight.bookTitle}</span>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ChildInsightCard({
  highlights = [],
  growthSummary = null,
  studentName = '',
  studentEmoji = '👧',
}) {
  const [showAll, setShowAll] = useState(false);
  const displayHighlights = showAll ? highlights : highlights.slice(0, 3);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Card Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-4 text-white">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{studentEmoji}</span>
          <div>
            <h3 className="font-bold text-lg">
              What {studentName || 'your child'} said today
            </h3>
            {growthSummary && (
              <p className="text-sm text-indigo-100 mt-0.5">
                {growthSummary.encouragement}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {growthSummary && (
        <div className="flex gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-sm">
          <div className="flex items-center gap-1">
            <span>📚</span>
            <span className="font-semibold">{growthSummary.totalRecentSessions}</span>
            <span className="text-gray-500">sessions</span>
          </div>
          <div className="flex items-center gap-1">
            <span>💡</span>
            <span className="font-semibold">{growthSummary.deepThinkingMoments}</span>
            <span className="text-gray-500">deep thoughts</span>
          </div>
        </div>
      )}

      {/* Highlights */}
      <div className="p-4 space-y-3">
        {displayHighlights.length === 0 ? (
          <div className="text-center py-6">
            <span className="text-3xl block mb-2">📖</span>
            <p className="text-gray-500 text-sm">No reading highlights yet.</p>
            <p className="text-gray-400 text-xs mt-1">
              Highlights appear after your child completes a reading session.
            </p>
          </div>
        ) : (
          <>
            {displayHighlights.map((h, i) => (
              <QuoteCard key={i} highlight={h} index={i} />
            ))}

            {highlights.length > 3 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full text-center text-sm text-indigo-500 hover:text-indigo-700 py-2 transition-colors"
              >
                {showAll ? 'Show less' : `Show ${highlights.length - 3} more moments`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
