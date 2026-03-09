'use client';

/**
 * LoadingCard — Ghibli-themed skeleton loading placeholder
 * Used in review, vocabulary, and profile pages while data loads.
 *
 * @param {number} lines - Number of content line skeletons to show (default: 3)
 */
export default function LoadingCard({ lines = 3 }) {
  return (
    <div className="ghibli-card p-6 animate-pulse">
      {/* Title skeleton */}
      <div className="h-6 bg-[#EDE5D4] rounded-xl mb-4 w-1/3" />
      {/* Content line skeletons */}
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-4 bg-[#EDE5D4] rounded-xl mb-3 ${
            i === lines - 1 ? 'w-2/3' : 'w-full'
          }`}
        />
      ))}
    </div>
  );
}
