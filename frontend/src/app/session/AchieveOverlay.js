'use client';

/**
 * AchieveOverlay.js
 *
 * Composite overlay layer rendered on top of the session UI.
 * Handles every modal/overlay that is independent of the main chat layout:
 *
 *   1. Stage transition overlay   — "Moving to: Think Deeper" spinner
 *   2. 30-minute timeout dialog   — Save & Exit / Keep Going choice
 *   3. Time milestone banners     — 15-min and 25-min gentle nudges
 *   4. Confetti celebration       — fires when session completes
 *   5. Achievement unlock modal   — sequential badge display
 */

import ConfettiCelebration from '@/components/ConfettiCelebration';
import AchievementUnlock from '@/components/AchievementUnlock';
import { useSession } from './SessionContext';

export default function AchieveOverlay() {
  const {
    // Stage transition
    showStageTransition,
    nextStageName,
    // Timeout
    showTimeoutWarning,
    setShowTimeoutWarning,
    handlePauseSession,
    // Time milestones
    timeMilestone,
    setTimeMilestone,
    // Confetti
    showConfetti,
    setShowConfetti,
    // Achievements
    pendingAchievements,
    setShowAchievements,
    setPendingAchievements,
  } = useSession();

  return (
    <>
      {/* 1. Stage Transition Overlay */}
      {showStageTransition && (
        <div className="fixed inset-0 bg-[#3D6B3D] bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="ghibli-card p-8 shadow-lg animate-bounce">
            <div className="text-3xl text-center mb-3 float-animation">🌿</div>
            <p className="text-base font-bold text-[#3D2E1E]">
              Moving to:{' '}
              <span className="text-[#5C8B5C]">{nextStageName}</span>
            </p>
          </div>
        </div>
      )}

      {/* 2. Phase 2B: 30-minute timeout warning dialog */}
      {showTimeoutWarning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="ghibli-card p-6 max-w-sm mx-4 text-center">
            <div className="text-4xl mb-3">💤</div>
            <h3 className="text-lg font-bold text-[#3D2E1E] mb-2">Need a break?</h3>
            <p className="text-sm text-[#6B5744] mb-4">
              You&apos;ve been reviewing for 30 minutes! Great job! Want to save and come back later?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handlePauseSession}
                className="flex-1 bg-[#D4A843] text-white rounded-xl py-2 text-sm font-medium min-h-[48px]"
                aria-label="Save your progress and exit"
              >
                Save &amp; Exit 💾
              </button>
              <button
                onClick={() => setShowTimeoutWarning(false)}
                className="flex-1 bg-[#5C8B5C] text-white rounded-xl py-2 text-sm font-medium min-h-[48px]"
                aria-label="Continue the session"
              >
                Keep Going! 💪
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. P3-UX-07: Gentle time milestone notifications */}
      {timeMilestone && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 animate-fade-in">
          <div className={`rounded-2xl px-6 py-3 shadow-lg border-2 flex items-center gap-3 max-w-sm ${
            timeMilestone === 'great-job'
              ? 'bg-[#FFF8E0] border-[#FDE047] text-[#854D0E]'
              : 'bg-[#EDE9FE] border-[#C4B5FD] text-[#5B21B6]'
          }`}>
            <span className="text-2xl flex-shrink-0" aria-hidden="true">
              {timeMilestone === 'great-job' ? '🌟' : '📚'}
            </span>
            <div>
              <p className="text-sm font-bold">
                {timeMilestone === 'great-job'
                  ? "You've been reviewing for 15 minutes! Great job!"
                  : "Almost done! Let's wrap up your thoughts."}
              </p>
              {timeMilestone === 'great-job' && (
                <p className="text-xs mt-0.5 opacity-80">Keep up the great work!</p>
              )}
            </div>
            <button
              onClick={() => setTimeMilestone(null)}
              className="ml-auto text-lg opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 4. Confetti celebration — fires when session completes */}
      <ConfettiCelebration
        active={showConfetti}
        duration={4000}
        onComplete={() => setShowConfetti(false)}
      />

      {/* 5. Achievement modal — shows unlocked badges sequentially */}
      <AchievementUnlock
        achievements={pendingAchievements}
        onClose={() => {
          setShowAchievements(false);
          setPendingAchievements([]);
        }}
      />
    </>
  );
}
