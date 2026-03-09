'use client';
import { useEffect, useState } from 'react';

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

  // Open the modal whenever a non-empty list is received
  useEffect(() => {
    if (achievements.length > 0) {
      setCurrentIndex(0);
      setVisible(true);
    }
  }, [achievements]);

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
          background: linear-gradient(90deg, #F59E0B, #FCD34D, #F59E0B, #FCD34D);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shine 2s linear infinite;
        }
      `}</style>

      <div
        className="achievement-card bg-white rounded-3xl p-8 max-w-xs w-full text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div
          className="text-6xl mb-3 animate-bounce inline-block"
          role="img"
          aria-label={name}
        >
          {icon}
        </div>

        {/* Shimmer label */}
        <div className="shine-text text-sm font-bold uppercase tracking-widest mb-1">
          Achievement Unlocked!
        </div>

        {/* Achievement name */}
        <h3
          id="achievement-title"
          className="text-xl font-bold text-[#2C4A2E] mb-2"
        >
          {name}
        </h3>

        {/* Achievement description */}
        <p
          id="achievement-description"
          className="text-sm text-[#6B7280] leading-relaxed mb-2"
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
                  i === currentIndex ? 'bg-[#4A7C59]' : i < currentIndex ? 'bg-[#A7C5B2]' : 'bg-[#E5E7EB]'
                }`}
              />
            ))}
          </div>
        )}

        {/* Action button */}
        <button
          onClick={handleAdvance}
          className="mt-2 w-full bg-[#4A7C59] text-white rounded-2xl py-3 font-bold text-sm hover:bg-[#3D6B4F] active:scale-95 transition-all min-h-[48px]"
          aria-label={isLast ? 'Close achievements' : 'View next achievement'}
        >
          {isLast ? 'Awesome! ⭐' : 'Next 🎉'}
        </button>
      </div>
    </div>
  );
}
