'use client';

import BookCoverIllustration from './BookCoverIllustration';

const LEVEL_COLORS = {
  Beginner: { bg: '#C8E6C9', text: '#2E7D32', border: '#81C784' },
  Intermediate: { bg: '#FFE0B2', text: '#E65100', border: '#FFB74D' },
  Advanced: { bg: '#E1BEE7', text: '#6A1B9A', border: '#CE93D8' },
};

function normalizeLevel(level) {
  if (!level) return 'Beginner';
  const cap = level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
  if (LEVEL_COLORS[cap]) return cap;
  return level;
}

export default function BookCard({ book, onClick }) {
  const level = normalizeLevel(book.level);
  const colors = LEVEL_COLORS[level] || LEVEL_COLORS.Beginner;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-label={`Read ${book.title} by ${book.author}`}
      className="group bg-[#FFFCF3] rounded-2xl border-[3px] border-[#E8DEC8] overflow-hidden cursor-pointer
        shadow-[4px_4px_12px_rgba(61,46,30,0.08),inset_-2px_-2px_6px_rgba(255,255,255,0.6)]
        hover:shadow-[6px_6px_20px_rgba(61,46,30,0.14),inset_-2px_-2px_6px_rgba(255,255,255,0.6)]
        hover:-translate-y-1.5 transition-all duration-200 ease-out
        focus:outline-none focus-visible:ring-4 focus-visible:ring-[#81C784]/50"
    >
      {/* ── Cover Illustration ─────────────────────────── */}
      <BookCoverIllustration
        book={book}
        className="h-44 w-full"
      />

      {/* ── Content ────────────────────────────────────── */}
      <div className="p-4">
        <h3 className="font-extrabold text-[#3D2E1E] text-base mb-1 line-clamp-2 leading-snug">
          {book.title}
        </h3>
        <p className="text-[#6B5744] text-sm font-semibold mb-3">{book.author}</p>

        <div className="flex items-center gap-2 mb-3">
          <span
            className="px-3 py-1 rounded-full text-xs font-bold border-2"
            style={{
              backgroundColor: colors.bg,
              color: colors.text,
              borderColor: colors.border,
            }}
          >
            {level}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#EDE5D4] text-[#6B5744]">
            {book.genre}
          </span>
        </div>

        <p className="text-[#9B8777] text-xs mb-4 line-clamp-2 font-medium leading-relaxed">
          {book.description}
        </p>
      </div>

      {/* ── CTA Button ─────────────────────────────────── */}
      <div className="px-4 pb-4">
        <button
          className="w-full py-2.5 bg-[#5C8B5C] text-white rounded-xl font-bold text-sm
            border-2 border-[#4A7C59]
            shadow-[0_3px_0_#3D6B3D]
            group-hover:bg-[#4A7C59] group-hover:shadow-[0_2px_0_#2C5A2C]
            group-hover:translate-y-[1px]
            transition-all duration-150 ease-out"
        >
          Start Reading
        </button>
      </div>
    </div>
  );
}
