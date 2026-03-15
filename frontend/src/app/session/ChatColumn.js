'use client';

/**
 * ChatColumn.js
 *
 * Central chat area displaying the AI conversation.
 * Shows one question at a time — Socratic Method (§3.1).
 * Handles Alice messages, student messages, stage transitions,
 * emotion check-in reactions, and typing indicator.
 *
 * All data is consumed from SessionContext via useSession() — no props needed.
 * VoicePanel is rendered as the bottom input area within this column
 * per the §8.3 session module layout specification.
 */

import { useSession } from './SessionContext';
import { SOCRATIC_LOADING_PROMPTS } from './SessionContext';
import VoicePanel from './VoicePanel';

export default function ChatColumn() {
  const {
    messages,
    loading,
    loadingPromptIndex,
    error,
    handleEmotionReact,
    handlePauseSession,
    elapsedTime,
    bookTitle,
    messagesEndRef,
  } = useSession();

  return (
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
  );
}
