'use client';
import React, { useEffect, useRef, useState } from 'react';

/**
 * Static achievement catalogue.
 * Each entry maps a string achievement_type key to display metadata.
 * Adding new achievements here is sufficient — no component logic changes required.
 */
const ACHIEVEMENT_CATALOGUE = {
  'first-book':       { icon: '📚', name: 'First Book!',           description: 'You finished your very first book review!' },
  'five-books':       { icon: '📚', name: 'Bookshelf Builder',     description: 'You\'ve reviewed 5 books — keep it up!' },
  'ten-books':        { icon: '🏆', name: 'Reading Champion',      description: '10 book reviews complete. You\'re a champion!' },
  'word-50':          { icon: '💡', name: 'Word Wizard',           description: 'You\'ve learned 50 new vocabulary words!' },
  'word-100':         { icon: '🧠', name: 'Vocabulary Master',     description: '100 words learned — incredible vocabulary!' },
  'streak-3':         { icon: '🔥', name: '3-Day Streak!',         description: 'Three days in a row — you\'re on fire!' },
  'streak-7':         { icon: '🌟', name: 'Week Warrior',          description: 'Reading every day for a week. Wow!' },
  'grammar-90':       { icon: '✨', name: 'Grammar Star',          description: 'Over 90% grammar accuracy — impressive!' },
  'perfect-session':  { icon: '🎯', name: 'Perfect Session!',      description: 'A flawless session from start to finish!' },
  'early-bird':       { icon: '🌅', name: 'Early Bird',            description: 'Reading in the morning — great habit!' },
  'night-owl':        { icon: '🦉', name: 'Night Owl',             description: 'Still reading after dark!' },
  'speed-reader':     { icon: '⚡', name: 'Speed Reader',          description: 'You flew through that session!' },
  'deep-thinker':     { icon: '🤔', name: 'Deep Thinker',          description: 'Your thoughtful answers really shone.' },
  'bookworm':         { icon: '🐛', name: 'Bookworm',              description: 'Always hungry for more books!' },
};

/** Fallback used when an achievement_type is not found in the catalogue. */
const FALLBACK_ACHIEVEMENT = { icon: '🏅', name: 'Achievement Unlocked!', description: 'You did something great!' };

/**
 * Resolves the display metadata for a single achievement entry.
 * Accepts either a plain string or an object with an `achievement_type` field.
 *
 * @param {string|Object} achievement
 * @returns {{ icon: string, name: string, description: string }}
 */
function resolveAchievement(achievement) {
  const key = typeof achievement === 'string' ? achievement : achievement?.achievement_type;
  return ACHIEVEMENT_CATALOGUE[key] ?? FALLBACK_ACHIEVEMENT;
}

/**
 * AchievementUnlock
 *
 * Modal that sequences through a list of unlocked achievements one at a time.
 * Clicking anywhere on the backdrop or the action button advances to the next
 * achievement, or closes the modal when all have been shown.
 *
 * Props:
 *   achievements {Array<string|Object>} — list of achievement identifiers or objects
 *   onClose      {Function}             — called after the last achievement is dismissed
 */
export default function AchievementUnlock({ achievements = [], onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const buttonRef = useRef(null);
  const modalRef = useRef(null);

  // Open the modal whenever a non-empty list is received
  useEffect(() => {
    if (achievements.length > 0) {
      setCurrentIndex(0);
      setVisible(true);
    }
  }, [achievements]);

  // Focus trap + Escape handler when modal is open
  useEffect(() => {
    if (!visible) return;
    const modal = modalRef.current;
    if (!modal) return;

    // Focus the primary action button on open
    buttonRef.current?.focus();

    const focusableSelectors =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setVisible(false);
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = Array.from(modal.querySelectorAll(focusableSelectors));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    modal.addEventListener('keydown', handleKeyDown);
    return () => modal.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  const handleAdvance = () => {
    if (currentIndex < achievements.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setVisible(false);
      onClose?.();
    }
  };

  if (!visible || achievements.length === 0) return null;

  const { icon, name, description } = resolveAchievement(achievements[currentIndex]);
  const isLast = currentIndex === achievements.length - 1;
  const hasMultiple = achievements.length > 1;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleAdvance}
      role="dialog"
      aria-modal="true"
      aria-labelledby="achievement-title"
      aria-describedby="achievement-description"
    >
      {/* Inject pop animation once */}
      <style>{`
        @keyframes achievement-pop {
          0%   { transform: scale(0) rotate(-10deg); opacity: 0; }
          60%  { transform: scale(1.1) rotate(3deg); opacity: 1; }
          100% { transform: scale(1)   rotate(0deg); opacity: 1; }
        }
        @keyframes shine {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .achievement-card {
          animation: achievement-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
        }
        .shine-text {
          background: linear-gradient(90deg, #6B5744, #D97706, #6B5744, #D97706);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shine 2s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .achievement-card { animation: none; }
          .shine-text { animation: none; }
          .animate-bounce { animation: none; }
        }
      `}</style>

      <div
        ref={modalRef}
        className="achievement-card bg-white rounded-3xl p-8 max-w-xs w-full text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon — role="img" with aria-label conveys the achievement type to screen readers */}
        <div
          className="text-6xl mb-3 animate-bounce inline-block"
          role="img"
          aria-label={name}
        >
          <span aria-hidden="true">{icon}</span>
        </div>

        {/* Shimmer label */}
        <div className="shine-text text-sm font-bold uppercase tracking-widest mb-1">
          Achievement Unlocked!
        </div>

        {/* Achievement name */}
        <h3
          id="achievement-title"
          className="text-xl font-bold text-[#3D2E1E] mb-2"
        >
          {name}
        </h3>

        {/* Achievement description */}
        <p
          id="achievement-description"
          className="text-sm text-[#6B5744] leading-relaxed mb-2"
        >
          {description}
        </p>

        {/* Progress indicator shown only when there are multiple achievements */}
        {hasMultiple && (
          <div className="flex justify-center gap-1.5 mb-4" aria-label={`Achievement ${currentIndex + 1} of ${achievements.length}`}>
            {achievements.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentIndex ? 'bg-[#5C8B5C]' : i < currentIndex ? 'bg-[#A7C5B2]' : 'bg-[#D6C9A8]'
                }`}
              />
            ))}
          </div>
        )}

        {/* Action button */}
        <button
          ref={buttonRef}
          onClick={handleAdvance}
          className="mt-2 w-full bg-[#5C8B5C] text-white rounded-2xl py-3 font-bold text-sm hover:bg-[#3D6B4F] active:scale-95 transition-all min-h-[48px]"
          aria-label={isLast ? 'Close achievements' : 'View next achievement'}
        >
          {isLast ? <>Awesome! <span aria-hidden="true">⭐</span></> : <>Next <span aria-hidden="true">🎉</span></>}
        </button>
      </div>
    </div>
  );
}
