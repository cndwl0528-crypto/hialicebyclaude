'use client';

import BookCoverIllustration from './BookCoverIllustration';
import { isParentOrAdmin } from '@/lib/constants';

const LEVEL_COLORS = {
  Beginner: { bg: '#C8E6C9', text: '#1B5E20', border: '#81C784' },
  Intermediate: { bg: '#FFE0B2', text: '#BF360C', border: '#FFB74D' },
  Advanced: { bg: '#E1BEE7', text: '#4A148C', border: '#CE93D8' },
};

const BADGE_COLORS = {
  Bestseller: '#D32F2F',
  Popular: '#F57C00',
  'Award Winner': '#7B1FA2',
  New: '#1565C0',
};

function normalizeLevel(level) {
  if (!level) return 'Beginner';
  const cap = level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
  if (LEVEL_COLORS[cap]) return cap;
  return level;
}

function StarRating({ rating = 0, reviewCount = 0 }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.3;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  return (
    <div className="flex items-center gap-1" aria-label={`${rating.toFixed(1)} out of 5 stars`} role="img">
      <div className="star-rating text-sm leading-none">
        {'★'.repeat(full)}
        {hasHalf && (
          <span className="relative inline-block" style={{ width: '0.65em' }}>
            <span className="text-[#EDE5D4]">★</span>
            <span className="absolute left-0 top-0 overflow-hidden" style={{ width: '50%' }}>★</span>
          </span>
        )}
        <span className="text-[#EDE5D4]">{'★'.repeat(empty)}</span>
      </div>
      <span className="text-xs text-[#5D4037] font-semibold">
        {rating.toFixed(1)}
      </span>
      {reviewCount > 0 && (
        <span className="text-[11px] text-[#8D6E63]">({reviewCount.toLocaleString()})</span>
      )}
    </div>
  );
}

function ProgressBar({ progress = 0 }) {
  if (progress <= 0) return null;
  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] text-[#5D4037] font-semibold">{progress}% read</span>
      </div>
      <div className="reading-progress">
        <div className="reading-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export default function BookCard({ book, onClick, compact = false }) {
  const level = normalizeLevel(book.level);
  const colors = LEVEL_COLORS[level] || LEVEL_COLORS.Beginner;

  // Compact mode for shelf view — cover + title + level only
  if (compact) {
    return (
      <button
        onClick={onClick}
        aria-label={`Review ${book.title} by ${book.author}`}
        className="book-3d group cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-[#81C784]/50 w-full text-left"
      >
        <div className="book-3d-inner relative bg-[#FFFCF3] rounded-lg overflow-visible
          shadow-[4px_4px_12px_rgba(61,46,30,0.12)]
          group-hover:shadow-[8px_8px_24px_rgba(61,46,30,0.18)]
          transition-shadow duration-300"
        >
          <div className="book-spine rounded-l-lg" />
          <div className="book-page-edge" />

          {book.badge && (
            <div
              className="ribbon-badge"
              style={{ backgroundColor: BADGE_COLORS[book.badge] || '#D32F2F' }}
            >
              {book.badge}
            </div>
          )}

          <BookCoverIllustration book={book} className="w-full aspect-[3/4]" />

          <div className="p-2">
            <h3 className="font-serif font-bold text-[#3D2E1E] text-[11px] line-clamp-1 leading-snug">
              {book.title}
            </h3>
            {isParentOrAdmin() && (
              <span
                className="inline-block mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border"
                style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
              >
                {level}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  }

  // Full card — uses <button> as the single interactive element (no nested interactives)
  return (
    <button
      onClick={onClick}
      aria-label={`Review ${book.title} by ${book.author}`}
      className="book-3d group cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-[#81C784]/50 w-full h-full text-left"
    >
      <div className="book-3d-inner relative bg-[#FFFCF3] rounded-lg overflow-visible h-full flex flex-col
        shadow-[4px_4px_12px_rgba(61,46,30,0.12)]
        group-hover:shadow-[8px_8px_24px_rgba(61,46,30,0.18)]
        transition-shadow duration-300"
      >
        {/* Spine */}
        <div className="book-spine rounded-l-lg" />
        {/* Page Edge */}
        <div className="book-page-edge" />

        {/* Ribbon Badge */}
        {book.badge && (
          <div
            className="ribbon-badge"
            style={{ backgroundColor: BADGE_COLORS[book.badge] || '#D32F2F' }}
          >
            {book.badge}
          </div>
        )}

        {/* Cover Illustration (3:4 vertical) */}
        <div className="relative">
          <BookCoverIllustration book={book} className="w-full aspect-[3/4]" />
        </div>

        {/* Content */}
        <div className="p-3 pb-2 flex-1 flex flex-col">
          <h3 className="font-serif font-bold text-[#3D2E1E] text-sm mb-0.5 line-clamp-2 leading-snug">
            {book.title}
          </h3>
          <p className="text-[#5D4037] text-xs font-semibold mb-2">{book.author}</p>

          {/* Star Rating */}
          {typeof book.rating === 'number' && (
            <StarRating rating={book.rating} reviewCount={book.reviewCount} />
          )}

          {/* Badges Row — max 2 for Beginner, full for others */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {isParentOrAdmin() && (
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-bold border"
                style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
              >
                {level}
              </span>
            )}
            {level !== 'Beginner' && book.gradeLevel && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#E3F2FD] text-[#0D47A1] border border-[#90CAF9]">
                {book.gradeLevel}
              </span>
            )}
            {level !== 'Beginner' && book.ageRange && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF3E0] text-[#BF360C] border border-[#FFCC80]">
                {book.ageRange}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#EDE5D4] text-[#5D4037]">
              {book.genre}
            </span>
          </div>

          {/* Progress Bar */}
          <ProgressBar progress={book.progress || 0} />

          <div className="flex-1" />
        </div>

        {/* CTA area — visual-only, not a nested button */}
        <div className="px-3 pb-3 pt-1 mt-auto">
          <div
            className="w-full py-3 bg-[#5C8B5C] text-white rounded-lg font-bold text-sm text-center
              border-2 border-[#5C8B5C]
              shadow-[0_3px_0_#3D6B3D]
              group-hover:bg-[#5C8B5C] group-hover:shadow-[0_2px_0_#2C5A2C]
              group-hover:translate-y-[1px]
              transition-all duration-150 ease-out"
            aria-hidden="true"
          >
            {book.progress > 0 ? 'Continue Review' : "Let's Talk About This Book!"}
          </div>
        </div>
      </div>
    </button>
  );
}
