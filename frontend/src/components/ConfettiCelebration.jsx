'use client';
import { useEffect, useState, useRef, useCallback } from 'react';

const COLORS = ['#5C8B5C', '#D4A843', '#EC4899', '#3B82F6', '#10B981', '#F97316', '#A78BFA'];
const SHAPES = ['circle', 'square', 'triangle'];

/**
 * Generates an array of randomized confetti piece descriptors.
 * All randomization is performed once at generation time so render
 * cycles stay pure and deterministic.
 *
 * @param {number} count - Number of confetti pieces to generate
 * @returns {Array<Object>} Array of confetti piece config objects
 */
function generatePieces(count) {
  return Array.from({ length: count }, (_, i) => {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const size = 6 + Math.random() * 8; // px, used for border math on triangles

    return {
      id: i,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 0.8}s`,
      duration: `${1.5 + Math.random() * 2}s`,
      size,
    };
  });
}

/**
 * Derives inline style for a single confetti piece based on its descriptor.
 * Keeps shape-specific CSS logic in one place.
 *
 * @param {Object} piece - Confetti piece descriptor
 * @returns {React.CSSProperties}
 */
function buildPieceStyle(piece) {
  const { color, shape, size, left, duration, delay } = piece;
  const isTriangle = shape === 'triangle';
  const half = Math.round(size / 2);

  return {
    position: 'absolute',
    top: '-20px',
    left,
    width: isTriangle ? 0 : `${size}px`,
    height: isTriangle ? 0 : `${size}px`,
    borderRadius: shape === 'circle' ? '50%' : shape === 'square' ? '2px' : '0',
    backgroundColor: isTriangle ? 'transparent' : color,
    borderLeft: isTriangle ? `${half}px solid transparent` : 'none',
    borderRight: isTriangle ? `${half}px solid transparent` : 'none',
    borderBottom: isTriangle ? `${size}px solid ${color}` : 'none',
    // CSS custom properties consumed by the @keyframes rule
    '--duration': duration,
    '--delay': delay,
    pointerEvents: 'none',
  };
}

/** CSS injected once into the document head via a <style> tag inside the portal */
const ANIMATION_CSS = `
  @keyframes confetti-fall {
    0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
    80%  { opacity: 1; }
    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
  }
  .hialice-confetti-piece {
    animation: confetti-fall var(--duration) var(--delay) ease-in both;
  }
`;

/**
 * ConfettiCelebration
 *
 * Renders a full-viewport confetti shower plus a celebration message overlay.
 * Uses only CSS animations — no external library required.
 *
 * Props:
 *   active    {boolean} — trigger the animation (rising edge fires a new burst)
 *   duration  {number}  — ms before pieces are removed and onComplete is called
 *   onComplete {Function} — called once the celebration ends
 */
export default function ConfettiCelebration({ active = false, duration = 3000, onComplete }) {
  const [pieces, setPieces] = useState([]);
  const timeoutRef = useRef(null);

  const clearCelebration = useCallback(() => {
    setPieces([]);
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (!active) return;

    setPieces(generatePieces(80));

    timeoutRef.current = setTimeout(clearCelebration, duration);

    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, [active, duration, clearCelebration]);

  // Nothing to render when inactive and all pieces have been cleared
  if (!active && pieces.length === 0) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label="Celebration animation — session complete!"
    >
      {/* Inject keyframe CSS exactly once */}
      <style>{ANIMATION_CSS}</style>

      {/* Confetti pieces */}
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="hialice-confetti-piece"
          style={buildPieceStyle(piece)}
          aria-hidden="true"
        />
      ))}

      {/* Celebration message — pointer-events remain none so it doesn't block UI */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center animate-bounce">
          <div className="text-7xl mb-4" role="img" aria-label="party popper">
            🎉
          </div>
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl px-8 py-4 shadow-xl">
            <p className="text-2xl font-bold text-[#3D2E1E]">Amazing Job!</p>
            <p className="text-[#5C8B5C]">You finished the book review! ⭐</p>
          </div>
        </div>
      </div>
    </div>
  );
}
