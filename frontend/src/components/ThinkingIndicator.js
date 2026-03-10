'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * ThinkingIndicator — Shows encouraging messages when silence is detected
 *
 * Instead of showing "No speech detected" errors, this component
 * interprets silence as thinking time and provides gentle encouragement.
 *
 * Props:
 * @param {boolean} isListening - Whether the microphone is active
 * @param {number} silentSeconds - How many seconds of silence detected
 * @param {string} level - Student level (beginner/intermediate/advanced)
 * @param {function} onRequestRephrase - Called when student might need question rephrased
 */

const THINKING_MESSAGES = {
  beginner: [
    { seconds: 3, message: "Take your time! I'm here waiting 😊", emoji: '🤔' },
    { seconds: 6, message: "It's okay to think! There's no rush.", emoji: '💭' },
    { seconds: 10, message: "Want me to ask in a different way?", emoji: '🔄', showRephrase: true },
    { seconds: 15, message: "You can also type your answer if you'd like!", emoji: '⌨️', showTypeHint: true },
  ],
  intermediate: [
    { seconds: 3, message: "Good thinking takes time...", emoji: '🤔' },
    { seconds: 7, message: "I can see you're thinking deeply!", emoji: '💡' },
    { seconds: 12, message: "Would you like me to rephrase that?", emoji: '🔄', showRephrase: true },
    { seconds: 18, message: "You can type instead if it's easier.", emoji: '⌨️', showTypeHint: true },
  ],
  advanced: [
    { seconds: 4, message: "Take a moment to organize your thoughts...", emoji: '🤔' },
    { seconds: 8, message: "Deep thinking leads to great insights!", emoji: '💡' },
    { seconds: 15, message: "Want to approach this from a different angle?", emoji: '🔄', showRephrase: true },
  ],
};

export default function ThinkingIndicator({
  isListening = false,
  silentSeconds = 0,
  level = 'intermediate',
  onRequestRephrase,
}) {
  const messages = THINKING_MESSAGES[level] || THINKING_MESSAGES.intermediate;

  // Find the current applicable message
  const currentMessage = [...messages]
    .reverse()
    .find(m => silentSeconds >= m.seconds);

  if (!isListening || silentSeconds < 3 || !currentMessage) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-2 animate-fade-in">
      {/* Thinking animation — gentle pulsing dots */}
      <div className="flex gap-1.5 mb-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: '1s' }}
          />
        ))}
      </div>

      {/* Message */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 max-w-xs text-center">
        <span className="text-lg mr-1">{currentMessage.emoji}</span>
        <span className="text-sm text-blue-700">{currentMessage.message}</span>
      </div>

      {/* Rephrase button */}
      {currentMessage.showRephrase && onRequestRephrase && (
        <button
          onClick={onRequestRephrase}
          className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-600 px-3 py-1.5 rounded-full transition-colors"
        >
          🔄 Ask me differently
        </button>
      )}

      {/* Time indicator */}
      <p className="text-xs text-gray-400">
        Thinking for {silentSeconds}s — that's great!
      </p>
    </div>
  );
}
