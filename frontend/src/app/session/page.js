'use client';

/**
 * session/page.js  — AI review session page
 *
 * This file is the entry point for the session route.
 * All state and logic live in SessionContext; UI is split across:
 *
 *   StageRenderer   — left-side worksheet panel
 *   VoicePanel      — bottom input area (mic + text)
 *   VocabSidebar    — just-in-time vocabulary mini-card
 *   AchieveOverlay  — modals: stage transition, timeout, achievements, confetti
 *
 * Early-exit screens (AI feedback card, session complete) are rendered
 * directly here because they replace the entire page layout.
 */

import { useRouter } from 'next/navigation';
import { SessionProvider, useSession } from './SessionContext';
import StageRenderer from './StageRenderer';
import ChatColumn from './ChatColumn';
import VoicePanel from './VoicePanel';
import VocabSidebar from './VocabSidebar';
import AchieveOverlay from './AchieveOverlay';

// ── Inner component that can access SessionContext ────────────────────────────
function SessionContent() {
  const router = useRouter();
  const {
    // Early-exit screens
    showAiFeedbackCard,
    setShowAiFeedbackCard,
    aiFeedback,
    setSessionComplete,
    setShowConfetti,
    sessionComplete,
    sessionId,
    bookTitle,
  } = useSession();

  // ── Phase 2B: AI Feedback preview card ─────────────────────────────────────
  if (showAiFeedbackCard && aiFeedback) {
    return (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center py-12 bg-[#F5F0E8]">
        <div className="ghibli-card p-8 max-w-md text-center animate-fade-in">
          <div className="text-5xl mb-4">🤖</div>
          <h2 className="text-xl font-extrabold text-[#6B5744] mb-3">A Message from HiMax</h2>
          <div className="bg-gradient-to-br from-[#FFF8E0] to-[#F5E8A8] border-2 border-[#D4A843]/30 rounded-2xl p-5 mb-6 text-left">
            <p className="text-[#3D2E1E] text-sm leading-relaxed italic">
              &quot;{aiFeedback}&quot;
            </p>
          </div>
          <button
            onClick={() => {
              setShowAiFeedbackCard(false);
              setSessionComplete(true);
              setShowConfetti(true);
            }}
            className="w-full py-3 px-6 bg-[#5C8B5C] text-white rounded-2xl hover:bg-[#3D6B3D] transition-colors font-bold hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(92,139,92,0.3)]"
          >
            See My Review
          </button>
          <p className="text-xs text-[#6B5744] mt-3">This screen closes automatically in a few seconds</p>
        </div>
      </div>
    );
  }

  // ── Session complete screen ─────────────────────────────────────────────────
  if (sessionComplete) {
    return (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center py-12 bg-[#F5F0E8]">
        <div className="ghibli-card p-8 max-w-md text-center">
          <div className="text-6xl mb-4 float-animation inline-block">🎉</div>
          <h2 className="text-2xl font-extrabold text-[#3D2E1E] mb-2">Great job! Your worksheet is ready!</h2>
          <p className="text-[#6B5744] font-semibold mb-6">
            You completed the review session for{' '}
            <span className="font-bold text-[#3D6B3D]">&quot;{bookTitle}&quot;</span>.
          </p>
          <button
            onClick={() => router.push(sessionId ? `/review?sessionId=${sessionId}` : '/review')}
            className="w-full py-3 px-6 bg-[#5C8B5C] text-white rounded-2xl hover:bg-[#3D6B3D] transition-colors font-bold hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(92,139,92,0.3)]"
          >
            View My Worksheet
          </button>
        </div>
      </div>
    );
  }

  // ── Main session layout ─────────────────────────────────────────────────────
  return (
    <div className="flex min-h-[calc(100dvh-120px)] flex-col bg-[#F5F0E8] lg:h-[calc(100vh-120px)] lg:flex-row">
      {/* All modals and overlays (stage transition, timeout, achievements, confetti) */}
      <AchieveOverlay />

      {/* ===== LEFT: Worksheet Frame ===== */}
      <StageRenderer />

      {/* ===== RIGHT: Chat Area ===== */}
      <ChatColumn />

      {/* Just-in-Time vocabulary mini-card */}
      <VocabSidebar />
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────
export default function SessionPage() {
  return (
    <SessionProvider>
      <SessionContent />
    </SessionProvider>
  );
}
