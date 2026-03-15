'use client';

/**
 * VoicePanel.js
 *
 * Right-side input area at the bottom of the chat column.
 * Renders:
 *   - Stage + turn progress indicator
 *   - Mobile-only current stage indicator
 *   - "Tell me more!" short-answer encouragement prompt
 *   - Live transcript display while microphone is active
 *   - Three-way input layout based on student level:
 *       Beginner     (6-8)   — large mic button, optional text input toggle
 *       Intermediate (9-11)  — voice prominent + side text input
 *       Advanced     (12-13) — text prominent + small side voice button
 *   - Voice-not-supported warning
 *   - Mock mode banner
 */

import VoiceButton from '@/components/VoiceButton';
import { useSession } from './SessionContext';

export default function VoicePanel() {
  const {
    // State
    loading,
    inputText,
    setInputText,
    error,
    isListening,
    transcript,
    supported,
    apiAvailable,
    showTextInput,
    setShowTextInput,
    isBeginnerMode,
    isAdvancedMode,
    // Stage / progress
    activeStages,
    activeStageEmojis,
    activeWorksheetRows,
    activeRowIndex,
    currentStage,
    turnCount,
    maxTurns,
    elapsedTime,
    messages,
    // Actions
    handleVoiceInput,
    handleTextSend,
    // Input ref
    inputRef,
  } = useSession();

  return (
    <div className="bg-[#FFFCF3] border-t border-[#D6C9A8] p-4 space-y-3 flex-shrink-0 shadow-[0_-4px_12px_rgba(61,46,30,0.06)]">
      {/* Stage + Turn progress indicator */}
      <div className="flex items-center justify-between mb-2 px-1" aria-label="Session progress">
        <span className="text-xs font-medium text-[#5C8B5C] bg-[#E8F5E8] px-3 py-1 rounded-full">
          {isBeginnerMode
            ? <><span aria-hidden="true">{activeStageEmojis[currentStage] || '🌟'}</span>{` Step ${currentStage + 1} of ${activeStages.length}`}</>
            : `${activeStages[currentStage] || ''} — Step ${currentStage + 1} of ${activeStages.length}`}
        </span>
        <span className="text-xs text-[#6B5744]">
          Turn {Math.min(turnCount, maxTurns)}/{maxTurns} &bull; {elapsedTime}
        </span>
      </div>

      {/* Current Stage Indicator (mobile only) */}
      <div className="lg:hidden flex items-center gap-2 mb-2">
        {activeWorksheetRows[activeRowIndex] && (
          <>
            <span
              aria-hidden="true"
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-extrabold"
              style={{ backgroundColor: activeWorksheetRows[activeRowIndex].color }}
            >
              {activeWorksheetRows[activeRowIndex].icon}
            </span>
            <span className="text-sm font-extrabold" style={{ color: activeWorksheetRows[activeRowIndex].color }}>
              {activeWorksheetRows[activeRowIndex].label}
            </span>
            <span className="text-xs text-[#6B5744] flex-1 truncate font-medium ml-1">
              — conversation in progress
            </span>
          </>
        )}
      </div>

      {/* Phase 2B: Short-answer encouragement — shown when last Alice message is still a question */}
      {!loading && messages.length > 0 && (() => {
        const lastAlice = [...messages].reverse().find((m) => m.speaker === 'alice');
        const lastStudent = [...messages].reverse().find((m) => m.speaker === 'student');
        const lastStudentAfterAlice = lastStudent && lastAlice && lastStudent.id > lastAlice.id;
        if (lastStudentAfterAlice && lastStudent.content.trim().split(/\s+/).length < 4 && lastAlice?.content.includes('?')) {
          return (
            <div
              role="status"
              className="bg-[#FFF8E8] border-l-4 border-[#D4A843] px-3 py-2 rounded-xl animate-fade-in"
            >
              <p className="text-sm font-bold text-[#A8822E]">
                Tell me more! 🌟 Can you add a little more detail?
              </p>
            </div>
          );
        }
        return null;
      })()}

      {/* Live Transcript Display */}
      {isListening && transcript && (
        <div className="bg-[#E8F5E8] border-l-4 border-[#5C8B5C] p-3 rounded-xl animate-fade-in">
          <p className="text-sm text-[#3D2E1E] font-semibold">
            <span className="font-extrabold">You said:</span> {transcript}
          </p>
        </div>
      )}

      {/* P3-UX-01: Input area — 3-way layout branching on student level */}
      {isBeginnerMode ? (
        /* ===== BEGINNER (6-8): Voice-only, large mic, no text input by default ===== */
        <div className="flex flex-col items-center gap-3 w-full py-2">
          <div className="relative">
            <VoiceButton
              isListening={isListening}
              onStart={handleVoiceInput}
              onStop={handleVoiceInput}
              size={100}
              disabled={loading}
            />
            {/* Friendly pulsing ring when not listening to draw attention */}
            {!isListening && !loading && (
              <div
                aria-hidden="true"
                className="absolute inset-0 rounded-full border-4 border-[#7AC87A] animate-pulse pointer-events-none"
                style={{ width: '100px', height: '100px' }}
              />
            )}
          </div>
          <p className="text-base font-bold text-[#5C8B5C]">
            {isListening ? '🎙️ Listening...' : '🎤 Tap to speak!'}
          </p>
          {/* Small toggle to reveal text input for fallback */}
          <button
            onClick={() => setShowTextInput((v) => !v)}
            className="text-xs text-[#6B5744] underline hover:text-[#6B5744] transition-colors"
          >
            {showTextInput ? 'Hide keyboard' : 'Type instead'}
          </button>
          {showTextInput && (
            <div className="w-full flex flex-col gap-2 sm:flex-row">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleTextSend()}
                placeholder="Type your answer here..."
                className="flex-1 px-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] focus:border-transparent text-sm bg-[#FFFCF3] text-[#3D2E1E] font-semibold disabled:bg-[#EDE5D4]"
                disabled={loading}
              />
              <button
                onClick={handleTextSend}
                disabled={loading || !inputText.trim()}
                className="px-6 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] disabled:bg-[#D6C9A8] transition-colors font-bold text-sm min-w-[48px] min-h-[48px] hover:-translate-y-0.5"
                title={loading ? 'Waiting for response...' : 'Send message'}
              >
                Send
              </button>
            </div>
          )}
        </div>
      ) : isAdvancedMode ? (
        /* ===== ADVANCED (12-13): Text input prominent, voice button smaller on the side ===== */
        <div className="flex flex-col gap-3 w-full sm:flex-row sm:items-end">
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleTextSend()}
                placeholder="Type your answer here..."
                className="flex-1 px-4 py-3 border-2 border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] focus:border-[#5C8B5C] text-sm bg-[#FFFCF3] text-[#3D2E1E] font-semibold disabled:bg-[#EDE5D4]"
                disabled={loading}
              />
              <button
                onClick={handleTextSend}
                disabled={loading || !inputText.trim()}
                className="px-6 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] disabled:bg-[#D6C9A8] transition-colors font-bold text-sm min-w-[48px] min-h-[48px] hover:-translate-y-0.5"
                title={loading ? 'Waiting for response...' : 'Send message'}
              >
                Send
              </button>
            </div>
          </div>
          {/* Smaller voice button for advanced — available but not primary */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0 sm:pb-1">
            <VoiceButton
              isListening={isListening}
              onStart={handleVoiceInput}
              onStop={handleVoiceInput}
              size={48}
              disabled={loading}
            />
            <p className="text-[10px] font-semibold text-[#6B5744]">
              {isListening ? 'Listening' : 'Voice'}
            </p>
          </div>
        </div>
      ) : (
        /* ===== INTERMEDIATE (9-11): Both inputs, voice is default/prominent ===== */
        <div className="flex flex-col gap-3 items-stretch w-full sm:flex-row sm:items-end">
          {/* Voice button on the left — larger and more prominent */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <VoiceButton
              isListening={isListening}
              onStart={handleVoiceInput}
              onStop={handleVoiceInput}
              size={64}
              disabled={loading}
            />
            <p className="text-xs font-bold text-[#5C8B5C]">
              {isListening ? '🎙️ Listening' : '🎤 Speak'}
            </p>
          </div>
          {/* Text input on the right — available but secondary */}
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleTextSend()}
                placeholder="Or type your answer here..."
                className="flex-1 px-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] focus:border-transparent text-sm bg-[#FFFCF3] text-[#3D2E1E] font-semibold disabled:bg-[#EDE5D4]"
                disabled={loading}
              />
              <button
                onClick={handleTextSend}
                disabled={loading || !inputText.trim()}
                className="px-6 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] disabled:bg-[#D6C9A8] transition-colors font-bold text-sm min-w-[48px] min-h-[48px] hover:-translate-y-0.5"
                title={loading ? 'Waiting for response...' : 'Send message'}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {!supported && (
        <p className="text-xs text-[#A8822E] text-center font-semibold">
          Voice input not supported on this device. Please use text input.
        </p>
      )}

      {!apiAvailable && (
        <p className="text-xs text-[#6B5744] text-center font-medium">
          I&apos;m using my memory today! Let&apos;s keep going! 🌿
        </p>
      )}
    </div>
  );
}
