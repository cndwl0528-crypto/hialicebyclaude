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
import VoicePanel from './VoicePanel';
import VocabSidebar from './VocabSidebar';
import AchieveOverlay from './AchieveOverlay';
import { SOCRATIC_LOADING_PROMPTS } from './SessionContext';

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
    // Chat state
    messages,
    loading,
    loadingPromptIndex,
    error,
    // Emotion reactions
    handleEmotionReact,
    handlePauseSession,
    elapsedTime,
    messagesEndRef,
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
      <div className="flex-1 flex flex-col min-w-0 pb-[5.75rem] lg:pb-0">
        {/* Session top bar: book title + timer + Save & Exit */}
        <div className="bg-[#FFFCF3] border-b border-[#D6C9A8] px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-shrink-0 shadow-[0_4px_12px_rgba(61,46,30,0.04)]">
          <div className="min-w-0">
            <span className="hialice-stage-badge mb-1">
              <span aria-hidden="true">💬</span>
              Review Talk
            </span>
            <p className="text-xs font-semibold text-[#6B5744] truncate">
              {bookTitle || 'Review Session'}
            </p>
            <p className="text-[11px] font-semibold text-[#8B7355]">
              We are exploring your ideas one step at a time.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <div className="flex items-center gap-1.5 bg-[#E8F5E8] px-3 py-1 rounded-full" aria-label={`Session time: ${elapsedTime}`}>
              <span className="text-sm" aria-hidden="true">⏱️</span>
              <span className="text-xs font-bold text-[#5C8B5C] tabular-nums">{elapsedTime}</span>
            </div>
            <button
              onClick={handlePauseSession}
              className="text-xs text-[#6B5744] hover:text-[#5C8B5C] flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D6C9A8] hover:border-[#5C8B5C] transition-all min-h-[44px] font-bold whitespace-nowrap"
              aria-label="Save and exit session"
            >
              Save &amp; Exit
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            role="alert"
            className="bg-[#FFF8E8] border-l-4 border-[#D4A843] p-3 mx-3 mt-2 rounded-xl"
          >
            <p className="text-sm text-[#6B5744] font-semibold">
              <span className="font-bold">Note:</span> {error}
            </p>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F5F0E8]">
          {messages.map((msg, i) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.speaker === 'alice'
                  ? 'items-start'
                  : msg.speaker === 'student'
                  ? 'items-end'
                  : 'items-center'
              } animate-fade-in`}
            >
              {msg.speaker === 'alice' && !msg.isTransition && (
                <div className="flex gap-3 w-full">
                  <div className="w-8 h-8 rounded-full bg-[#5C8B5C] flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                    <span className="text-white text-sm font-extrabold">A</span>
                  </div>
                  <div className="flex-1">
                    <div className="bg-[#D6E9D6] text-[#3D2E1E] px-4 py-3 rounded-2xl rounded-tl-none max-w-xs lg:max-w-md shadow-[0_2px_8px_rgba(61,46,30,0.08)]">
                      <p className="text-sm font-semibold">{msg.content}</p>
                    </div>
                    <p className="text-xs text-[#6B5744] mt-1 ml-1 font-medium">
                      {msg.timestamp?.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              )}

              {/* Phase 2B: Emotion check-in after the last Alice message */}
              {msg.speaker === 'alice' && !msg.isTransition && i === messages.length - 1 && !loading && (
                <div className="flex gap-2 mt-2 justify-start pl-11" role="group" aria-label="How do you feel?">
                  <span className="text-xs text-[#6B5744] mr-1 self-center">How do you feel?</span>
                  {['😊', '🤔', '😮'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleEmotionReact(emoji)}
                      className="text-xl hover:scale-125 transition-transform cursor-pointer bg-white/60 rounded-full w-11 h-11 flex items-center justify-center shadow-sm min-w-[44px] min-h-[44px]"
                      aria-label={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {msg.speaker === 'student' && (
                <div className="flex flex-col items-end gap-1">
                  <div className="bg-[#FFFCF3] text-[#3D2E1E] border border-[#D6C9A8] px-4 py-3 rounded-2xl rounded-tr-none max-w-xs lg:max-w-md shadow-[0_2px_8px_rgba(61,46,30,0.06)]">
                    <p className="text-sm font-semibold">{msg.content}</p>
                  </div>
                  <p className="text-xs text-[#6B5744] mr-2 font-medium">
                    {msg.timestamp?.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )}

              {msg.isTransition && (
                <div className="bg-[#D4A843] bg-opacity-15 border-l-4 border-[#D4A843] px-4 py-3 rounded-xl text-center max-w-md">
                  <p className="text-sm font-bold text-[#A8822E]">{msg.content}</p>
                </div>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {loading && (
            <div
              role="status"
              aria-label="Alice is thinking"
              className="flex justify-start animate-fade-in"
            >
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#5C8B5C] flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm font-extrabold">A</span>
                </div>
                <div className="max-w-xs rounded-2xl rounded-tl-none bg-[#D6E9D6] px-4 py-3 shadow-[0_8px_20px_rgba(92,139,92,0.12)] lg:max-w-md">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 rounded-full bg-[#5C8B5C] animate-bounce" style={{ animationDelay: '0s' }} />
                    <div className="h-2 w-2 rounded-full bg-[#5C8B5C] animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="h-2 w-2 rounded-full bg-[#5C8B5C] animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#3D2E1E]">
                    {SOCRATIC_LOADING_PROMPTS[loadingPromptIndex]}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <VoicePanel />
      </div>

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
