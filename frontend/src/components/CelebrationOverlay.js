'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTO_DISMISS_MS = 8000;

/** Project palette confetti colours */
const CONFETTI_COLORS = [
  '#4A90D9', // primary blue
  '#F39C12', // accent orange
  '#27AE60', // success green
  '#9B59B6', // purple
  '#E74C3C', // red
  '#F1C40F', // yellow
  '#1ABC9C', // teal
  '#E67E22', // dark orange
];

const CONFETTI_SHAPES = ['circle', 'square', 'triangle', 'diamond'];

// ---------------------------------------------------------------------------
// Keyframe CSS injected once into the document
// ---------------------------------------------------------------------------
const OVERLAY_KEYFRAMES = `
  @keyframes celebrate-fall {
    0%   { transform: translateY(-30px) rotate(0deg) scale(1);   opacity: 1; }
    70%  { opacity: 0.9; }
    100% { transform: translateY(100vh) rotate(540deg) scale(0.8); opacity: 0; }
  }

  @keyframes celebrate-bounce {
    0%   { transform: scale(0) rotate(-8deg); opacity: 0; }
    50%  { transform: scale(1.12) rotate(3deg); opacity: 1; }
    70%  { transform: scale(0.94) rotate(-1deg); }
    85%  { transform: scale(1.04) rotate(0.5deg); }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }

  @keyframes celebrate-trophy {
    0%, 100% { transform: translateY(0px) rotate(-4deg); }
    50%       { transform: translateY(-12px) rotate(4deg); }
  }

  @keyframes celebrate-star-spin {
    0%   { transform: scale(0) rotate(-180deg); opacity: 0; }
    60%  { transform: scale(1.2) rotate(10deg);  opacity: 1; }
    100% { transform: scale(1)   rotate(0deg);   opacity: 1; }
  }

  @keyframes celebrate-pulse-ring {
    0%   { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(243, 156, 18, 0.6); }
    70%  { transform: scale(1);    box-shadow: 0 0 0 16px rgba(243, 156, 18, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(243, 156, 18, 0); }
  }

  @keyframes celebrate-slide-up {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes celebrate-shimmer-bar {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }

  @keyframes celebrate-count-up {
    from { transform: scale(0.6); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }

  @keyframes celebrate-overlay-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes celebrate-bar-fill {
    from { width: 0%; }
    to   { width: var(--target-width); }
  }

  @media (prefers-reduced-motion: reduce) {
    .celebrate-confetti-piece,
    .celebrate-card,
    .celebrate-trophy-emoji,
    .celebrate-star,
    .celebrate-stat-chip,
    .celebrate-actions,
    .celebrate-overlay,
    .celebrate-score-bar-fill {
      animation: none !important;
      transition: none !important;
      opacity: 1 !important;
      transform: none !important;
    }
  }

  .celebrate-confetti-piece {
    animation: celebrate-fall var(--duration) var(--delay) ease-in both;
  }

  .celebrate-card {
    animation: celebrate-bounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.1s both;
  }

  .celebrate-trophy-emoji {
    animation: celebrate-trophy 2.4s ease-in-out 0.7s infinite;
  }

  .celebrate-star {
    animation: celebrate-star-spin 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
  }

  .celebrate-stat-chip {
    animation: celebrate-slide-up 0.4s ease-out both;
  }

  .celebrate-actions {
    animation: celebrate-slide-up 0.4s ease-out 0.5s both;
  }

  .celebrate-overlay {
    animation: celebrate-overlay-in 0.35s ease-out both;
  }

  .celebrate-shimmer {
    background: linear-gradient(90deg, #F39C12, #F1C40F, #F39C12, #F1C40F);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: celebrate-shimmer-bar 2s linear 0.7s infinite;
  }

  .celebrate-pulse-btn {
    animation: celebrate-pulse-ring 1.8s ease-in-out 1s infinite;
  }

  .celebrate-score-bar-fill {
    animation: celebrate-bar-fill 1s ease-out 0.6s both;
  }
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates an array of randomized confetti piece descriptors.
 * All randomization happens at generation time — renders stay pure.
 */
function generateConfettiPieces(count) {
  return Array.from({ length: count }, (_, id) => {
    const shape = CONFETTI_SHAPES[Math.floor(Math.random() * CONFETTI_SHAPES.length)];
    const size = 7 + Math.random() * 9;
    return {
      id,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      shape,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 1.2}s`,
      duration: `${1.8 + Math.random() * 2.2}s`,
      size,
    };
  });
}

/**
 * Builds the inline style for a single confetti piece.
 */
function buildConfettiStyle({ color, shape, size, left, duration, delay }) {
  const isDiamond = shape === 'diamond';
  const isTriangle = shape === 'triangle';
  const isSpecialShape = isDiamond || isTriangle;
  const half = Math.round(size / 2);

  return {
    position: 'absolute',
    top: '-24px',
    left,
    width: isSpecialShape ? 0 : `${size}px`,
    height: isSpecialShape ? 0 : `${size}px`,
    borderRadius: shape === 'circle' ? '50%' : shape === 'square' ? '3px' : '0',
    backgroundColor: isSpecialShape ? 'transparent' : color,
    borderLeft: isTriangle ? `${half}px solid transparent` : isDiamond ? `${half}px solid transparent` : 'none',
    borderRight: isTriangle ? `${half}px solid transparent` : isDiamond ? `${half}px solid transparent` : 'none',
    borderBottom: isTriangle ? `${size}px solid ${color}` : 'none',
    borderTop: isDiamond ? `${size}px solid ${color}` : 'none',
    '--duration': duration,
    '--delay': delay,
    pointerEvents: 'none',
  };
}

/**
 * Formats raw elapsed seconds into a human-readable duration string.
 * e.g.  65 → "1 min 5 sec"
 *       45 → "45 sec"
 */
function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '—';
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins === 0) return `${secs} sec`;
  if (secs === 0) return `${mins} min`;
  return `${mins} min ${secs} sec`;
}

// ---------------------------------------------------------------------------
// Sub-component: ConfettiLayer
// ---------------------------------------------------------------------------

function ConfettiLayer({ pieces }) {
  if (pieces.length === 0) return null;
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="celebrate-confetti-piece"
          style={buildConfettiStyle(piece)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: StatChip
// ---------------------------------------------------------------------------

function StatChip({ icon, label, value, delay }) {
  return (
    <div
      className="celebrate-stat-chip flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-sm border border-white/60"
      style={{ animationDelay: delay }}
    >
      <span className="text-2xl" aria-hidden="true">{icon}</span>
      <div className="text-left min-w-0">
        <p className="text-xs font-bold text-[#9B8777] uppercase tracking-wide leading-none mb-0.5">{label}</p>
        <p className="text-base font-extrabold text-[#3D2E1E] leading-tight truncate">{value}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: ScoreBar
// ---------------------------------------------------------------------------

function ScoreBar({ label, score, color }) {
  const pct = Math.min(100, Math.max(0, score ?? 0));
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-bold text-[#6B5744]">{label}</span>
        <span className="text-xs font-extrabold" style={{ color }}>{pct}%</span>
      </div>
      <div className="w-full bg-[#EDE5D4] rounded-full h-2.5 overflow-hidden">
        <div
          className="celebrate-score-bar-fill h-2.5 rounded-full"
          style={{ '--target-width': `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component: CelebrationOverlay
// ---------------------------------------------------------------------------

/**
 * CelebrationOverlay
 *
 * Full-screen celebration overlay shown when a student completes a Q&A session.
 * Features CSS-only confetti, a bouncing trophy card, animated session stats,
 * and two CTA buttons. Auto-dismisses after 8 seconds.
 *
 * Props:
 *   visible      {boolean}   — controls visibility
 *   studentName  {string}    — student's display name
 *   duration     {number}    — session duration in seconds
 *   turns        {number}    — total number of dialogue turns
 *   levelScore   {number}    — level score 0-100 (optional)
 *   grammarScore {number}    — grammar accuracy 0-100 (optional)
 *   onViewWords  {Function}  — handler for "View My Words" button
 *   onBackToBooks {Function} — handler for "Back to Books" button
 */
export default function CelebrationOverlay({
  visible = false,
  studentName = 'Explorer',
  duration = 0,
  turns = 0,
  levelScore = null,
  grammarScore = null,
  onViewWords,
  onBackToBooks,
}) {
  const [pieces, setPieces] = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_DISMISS_MS / 1000);
  const autoDismissRef = useRef(null);
  const countdownRef = useRef(null);
  const overlayRef = useRef(null);

  // Stable dismiss handler — defined before the effects that call it
  const handleDismiss = useCallback((reason) => {
    clearTimeout(autoDismissRef.current);
    clearInterval(countdownRef.current);
    setDismissed(true);
    setPieces([]);
    if (reason === 'words') onViewWords?.();
    if (reason === 'books') onBackToBooks?.();
  }, [onViewWords, onBackToBooks]);

  // Reset internal state whenever visible toggles true
  useEffect(() => {
    if (!visible) return;

    setDismissed(false);
    setCountdown(AUTO_DISMISS_MS / 1000);

    // Generate confetti pieces — reduced-motion users still see the card,
    // the @media (prefers-reduced-motion) block in OVERLAY_KEYFRAMES disables animation.
    setPieces(generateConfettiPieces(90));

    // Auto-dismiss timer
    autoDismissRef.current = setTimeout(() => {
      handleDismiss('auto');
    }, AUTO_DISMISS_MS);

    // Countdown ticker
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearTimeout(autoDismissRef.current);
      clearInterval(countdownRef.current);
    };
  }, [visible, handleDismiss]);

  // Move focus into the overlay for keyboard / screen-reader users
  useEffect(() => {
    if (visible && !dismissed) {
      overlayRef.current?.focus();
    }
  }, [visible, dismissed]);

  // Keyboard: Escape closes the overlay
  useEffect(() => {
    if (!visible || dismissed) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleDismiss('books');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, dismissed, handleDismiss]);

  // Derived values
  const hasLevelScore = typeof levelScore === 'number' && levelScore >= 0;
  const hasGrammarScore = typeof grammarScore === 'number' && grammarScore >= 0;
  const firstName = (studentName || 'Explorer').split(' ')[0];

  // Determine performance label
  const overallScore = hasLevelScore && hasGrammarScore
    ? Math.round((levelScore + grammarScore) / 2)
    : hasLevelScore
    ? levelScore
    : hasGrammarScore
    ? grammarScore
    : null;

  const performanceLabel =
    overallScore === null ? null
    : overallScore >= 90 ? { text: 'Outstanding!', color: '#27AE60' }
    : overallScore >= 75 ? { text: 'Excellent!', color: '#4A90D9' }
    : overallScore >= 60 ? { text: 'Good Job!', color: '#F39C12' }
    : { text: 'Keep It Up!', color: '#9B59B6' };

  if (!visible || dismissed) return null;

  return (
    <>
      {/* Inject animation keyframes exactly once per page load */}
      <style>{OVERLAY_KEYFRAMES}</style>

      {/* Full-screen backdrop */}
      <div
        ref={overlayRef}
        className="celebrate-overlay fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{
          background: 'linear-gradient(135deg, rgba(74,144,217,0.92) 0%, rgba(39,174,96,0.90) 50%, rgba(243,156,18,0.88) 100%)',
          backdropFilter: 'blur(2px)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebration-title"
        aria-describedby="celebration-desc"
        tabIndex={-1}
      >
        {/* Confetti layer */}
        <ConfettiLayer pieces={pieces} />

        {/* Floating decorative stars */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {['⭐', '✨', '🌟', '💫', '⭐', '✨'].map((star, i) => (
            <span
              key={i}
              className="celebrate-star absolute text-2xl select-none"
              style={{
                top: `${8 + i * 14}%`,
                left: i % 2 === 0 ? `${4 + i * 6}%` : `${78 - i * 4}%`,
                animationDelay: `${i * 0.12}s`,
                fontSize: `${1.2 + (i % 3) * 0.5}rem`,
              }}
            >
              {star}
            </span>
          ))}
        </div>

        {/* Main card */}
        <div
          className="celebrate-card relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: '#FFFCF3', border: '2px solid rgba(255,255,255,0.8)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top banner */}
          <div
            className="px-6 pt-7 pb-4 text-center"
            style={{
              background: 'linear-gradient(135deg, #4A90D9 0%, #27AE60 100%)',
            }}
          >
            {/* Trophy */}
            <div
              className="celebrate-trophy-emoji inline-block text-6xl mb-2 drop-shadow-lg"
              role="img"
              aria-label="trophy"
            >
              🏆
            </div>

            {/* "Great Job!" headline */}
            <h2
              id="celebration-title"
              className="text-3xl font-extrabold text-white drop-shadow-sm"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
            >
              Great Job!
            </h2>

            {/* Student name */}
            <p
              id="celebration-desc"
              className="text-white/90 font-bold text-base mt-0.5"
            >
              Amazing work, <span className="text-yellow-200">{firstName}!</span> 🌟
            </p>

            {/* Performance label (conditional) */}
            {performanceLabel && (
              <div
                className="inline-block mt-2 px-4 py-1 rounded-full text-sm font-extrabold text-white"
                style={{ backgroundColor: 'rgba(255,255,255,0.25)', border: '1.5px solid rgba(255,255,255,0.5)' }}
              >
                {performanceLabel.text}
              </div>
            )}
          </div>

          {/* Session stats grid */}
          <div className="px-5 pt-4 pb-3">
            <p className="text-xs font-bold text-[#9B8777] uppercase tracking-widest text-center mb-3">
              Your Session Stats
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <StatChip
                icon="⏱️"
                label="Time Spent"
                value={formatDuration(duration)}
                delay="0.15s"
              />
              <StatChip
                icon="💬"
                label="Turns Taken"
                value={turns > 0 ? `${turns} turns` : '—'}
                delay="0.22s"
              />
            </div>

            {/* Score bars — only shown when scores are available */}
            {(hasLevelScore || hasGrammarScore) && (
              <div
                className="celebrate-stat-chip mt-3 bg-white/70 rounded-2xl px-4 py-3 space-y-2.5 border border-white/60"
                style={{ animationDelay: '0.3s' }}
              >
                {hasLevelScore && (
                  <ScoreBar label="Level Score" score={levelScore} color="#4A90D9" />
                )}
                {hasGrammarScore && (
                  <ScoreBar label="Grammar" score={grammarScore} color="#27AE60" />
                )}
              </div>
            )}

            {/* Motivational message */}
            <p
              className="celebrate-stat-chip text-center text-sm font-bold text-[#6B5744] mt-3 leading-snug"
              style={{ animationDelay: '0.38s' }}
            >
              You finished all the stages! Keep reading and growing! 📚
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="celebrate-actions px-5 pb-6 space-y-2.5">
            {/* Primary: View My Words */}
            <button
              onClick={() => handleDismiss('words')}
              className="celebrate-pulse-btn w-full py-3.5 px-6 rounded-2xl text-white font-extrabold text-base transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-[#F39C12]"
              style={{
                background: 'linear-gradient(135deg, #F39C12 0%, #E67E22 100%)',
                boxShadow: '0 4px 16px rgba(243,156,18,0.45)',
                minHeight: '52px',
              }}
              aria-label="View words you learned in this session"
            >
              View My Words 📖
            </button>

            {/* Secondary: Back to Books */}
            <button
              onClick={() => handleDismiss('books')}
              className="w-full py-3.5 px-6 rounded-2xl font-extrabold text-base transition-all active:scale-95 hover:-translate-y-0.5 focus-visible:outline-4 focus-visible:outline-[#27AE60]"
              style={{
                background: 'linear-gradient(135deg, #27AE60 0%, #1E8449 100%)',
                boxShadow: '0 4px 16px rgba(39,174,96,0.40)',
                color: '#fff',
                minHeight: '52px',
              }}
              aria-label="Go back to the books list"
            >
              Back to Books 📚
            </button>

            {/* Auto-dismiss countdown */}
            <p
              className="text-center text-xs text-[#9B8777] font-medium pt-0.5"
              aria-live="polite"
              aria-atomic="true"
            >
              Closing in {countdown}s &bull; Press Esc to dismiss
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
