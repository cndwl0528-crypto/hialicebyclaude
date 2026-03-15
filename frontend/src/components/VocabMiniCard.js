'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * VocabMiniCard
 *
 * A slide-up overlay that shows a child-friendly vocabulary card when the AI
 * uses an advanced word during the review session (Krashen's i+1 / Just-in-Time
 * vocabulary learning).
 *
 * Props:
 *   word        {string}   - The target word (e.g. "metamorphosis")
 *   definition  {string}   - Simple, age-appropriate definition
 *   example     {string}   - Context sentence from the conversation
 *   onDismiss   {Function} - Called when the card is dismissed
 */
export default function VocabMiniCard({ word, definition, example, onDismiss }) {
  const AUTO_DISMISS_MS = 10_000;

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const dismissTimerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const buttonRef = useRef(null);

  // Build a simple phonetic syllable hint from the word (split on common patterns).
  // This is a lightweight approximation — good enough for the mock phase.
  const syllableHint = buildSyllableHint(word);

  // Animate in on mount, then start the auto-dismiss countdown.
  useEffect(() => {
    // Tiny delay so the CSS transition fires after the element is in the DOM.
    const mountTimeout = setTimeout(() => setVisible(true), 20);

    // Progress bar ticks down over AUTO_DISMISS_MS.
    const tickMs = 100;
    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev - (tickMs / AUTO_DISMISS_MS) * 100;
        return next < 0 ? 0 : next;
      });
    }, tickMs);

    // Auto-dismiss after the full duration.
    dismissTimerRef.current = setTimeout(() => {
      handleDismiss();
    }, AUTO_DISMISS_MS);

    // Focus the "Got it" button for keyboard/screen-reader users.
    buttonRef.current?.focus();

    return () => {
      clearTimeout(mountTimeout);
      clearInterval(progressIntervalRef.current);
      clearTimeout(dismissTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle keyboard Escape to dismiss.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handleDismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDismiss() {
    clearInterval(progressIntervalRef.current);
    clearTimeout(dismissTimerRef.current);
    setVisible(false);
    // Allow slide-down animation to finish before unmounting.
    setTimeout(() => onDismiss?.(), 350);
  }

  return (
    <>
      {/* Inject keyframes once — no external CSS dependency needed */}
      <style>{`
        @keyframes vocab-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes vocab-slide-down {
          from { transform: translateY(0);    opacity: 1; }
          to   { transform: translateY(100%); opacity: 0; }
        }
        .vocab-card-enter {
          animation: vocab-slide-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .vocab-card-exit {
          animation: vocab-slide-down 0.35s ease-in both;
        }
        @media (prefers-reduced-motion: reduce) {
          .vocab-card-enter, .vocab-card-exit { animation: none; }
        }
      `}</style>

      {/* Semi-transparent backdrop — click to dismiss, but it does NOT block scroll */}
      <div
        className="fixed inset-0 z-40 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'rgba(61, 46, 30, 0.25)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.35s ease',
        }}
      />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="vocab-word-heading"
        aria-describedby="vocab-definition"
        className={`fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 pb-6 ${
          visible ? 'vocab-card-enter' : 'vocab-card-exit'
        }`}
        // Allow clicking outside the card interior to dismiss.
        onClick={handleDismiss}
      >
        <div
          className="w-full max-w-sm rounded-3xl border-2 border-[#5C8B5C] bg-[#FFFCF3] shadow-[0_-4px_32px_rgba(92,139,92,0.22)] overflow-hidden"
          // Stop the backdrop click from also firing here.
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress bar — shrinks over AUTO_DISMISS_MS */}
          <div
            className="h-1 bg-[#5C8B5C] transition-none origin-left"
            style={{ width: `${progress}%`, transition: 'width 0.1s linear' }}
            aria-hidden="true"
          />

          <div className="p-5">
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden="true">&#x1F31F;</span>
                <span className="text-xs font-extrabold uppercase tracking-widest text-[#5C8B5C]">
                  New Word!
                </span>
              </div>
              <button
                onClick={handleDismiss}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#6B5744] hover:bg-[#EDE5D4] transition-colors text-lg leading-none"
                aria-label="Dismiss vocabulary card"
              >
                &times;
              </button>
            </div>

            {/* Word + syllable hint */}
            <div className="text-center mb-4">
              <p
                id="vocab-word-heading"
                className="text-3xl font-extrabold text-[#3D2E1E] leading-tight"
              >
                {word}
              </p>
              {syllableHint && (
                <p className="text-sm text-[#8B7355] font-medium tracking-wider mt-1">
                  {syllableHint}
                </p>
              )}
            </div>

            {/* Definition */}
            <div
              id="vocab-definition"
              className="rounded-2xl bg-[#E8F5E8] border border-[#A8D4A8] px-4 py-3 mb-3"
            >
              <p className="text-sm font-bold text-[#3D6B3D] leading-relaxed">
                {definition}
              </p>
            </div>

            {/* Example sentence */}
            {example && (
              <div className="rounded-2xl bg-[#FFF8E0] border border-[#F0D67A] px-4 py-3 mb-4">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#A8822E] mb-1">
                  Example
                </p>
                <p className="text-xs font-semibold text-[#6B5744] leading-relaxed italic">
                  &ldquo;{example}&rdquo;
                </p>
              </div>
            )}

            {/* Got it button */}
            <button
              ref={buttonRef}
              onClick={handleDismiss}
              className="w-full py-3 px-6 bg-[#5C8B5C] text-white rounded-2xl font-extrabold text-sm hover:bg-[#3D6B3D] active:scale-95 transition-all shadow-[0_4px_12px_rgba(92,139,92,0.3)] min-h-[48px]"
              aria-label={`Got it — dismiss the vocabulary card for ${word}`}
            >
              Got it! <span aria-hidden="true">&#x1F44D;</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Builds a dot-separated syllable hint for a word using a simple heuristic.
 * E.g. "metamorphosis" → "met·a·mor·pho·sis"
 *
 * This is intentionally lightweight (no dictionary lookup). It splits on
 * vowel–consonant boundaries well enough for display purposes.
 *
 * @param {string} word
 * @returns {string}
 */
function buildSyllableHint(word) {
  if (!word || word.length < 4) return '';

  // Manual overrides for the mock vocab list — most accurate version.
  const overrides = {
    metamorphosis:  'met·a·mor·pho·sis',
    protagonist:    'pro·tag·o·nist',
    courageous:     'cou·ra·geous',
    perseverance:   'per·se·ver·ance',
    compassionate:  'com·pas·sion·ate',
    tremendous:     'tre·men·dous',
    magnificent:    'mag·nif·i·cent',
    triumphant:     'tri·um·phant',
    melancholy:     'mel·an·chol·y',
    bewildered:     'be·wil·dered',
    exhilarating:  'ex·hil·a·rat·ing',
    determined:     'de·ter·mined',
    imagination:    'i·mag·i·na·tion',
    adventure:      'ad·ven·ture',
    curiosity:      'cu·ri·os·i·ty',
  };

  const lower = word.toLowerCase();
  if (overrides[lower]) return overrides[lower];

  // Fallback: naive vowel-group split (good enough for unknown words).
  return lower
    .replace(/([aeiou]+)([^aeiou]+)([aeiou])/g, '$1$2·$3')
    .replace(/^·|·$/g, '');
}
