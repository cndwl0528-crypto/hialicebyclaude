'use client';

/**
 * story-studio/page.js — AI Story Studio
 *
 * A collaborative story-creation experience where students build stories
 * with the AI teacher Alice, inspired by books they have read.
 *
 * Flow: Inspiration → World Building → Narrative → Ending
 *
 * Age-adaptive: reads studentLevel from clientStorage and adjusts
 * max narrative turns and scaffolding depth accordingly.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { getItem } from '@/lib/clientStorage';

// ── Constants ──────────────────────────────────────────────────────────────────

const STAGES = [
  { key: 'inspiration',    label: 'Inspiration',    icon: '🌟', step: 1 },
  { key: 'worldBuilding',  label: 'World Building', icon: '🏰', step: 2 },
  { key: 'narrative',      label: 'Narrative',      icon: '📝', step: 3 },
  { key: 'ending',         label: 'Ending',         icon: '🎬', step: 4 },
];

const TOTAL_STAGES = STAGES.length;

/** Narrative turn limits per level */
const MAX_NARRATIVE_TURNS = {
  beginner:     3,
  intermediate: 4,
  advanced:     5,
};

/** Mock AI responses keyed by stage */
const MOCK_STORY_RESPONSES = {
  inspiration: [
    "I love that part of the book! Let's use that as a starting point. Where does your story take place?",
    "Oh, that's such a wonderful inspiration! Books are full of magic ideas. Now, who are the main characters in your story?",
    "What a great choice! Let's carry that spark into your very own story. Can you describe the world your characters live in?",
  ],
  worldBuilding: [
    "What a wonderful setting! Now, who is the main character in your story? Tell me about them!",
    "I can picture it already! Your world sounds amazing. What special power or talent does your hero have?",
    "Fantastic! A great hero needs a challenge. What is the problem or mystery your character must solve?",
  ],
  narrative: [
    "Oh, that's exciting! What happens next? I can't wait to find out!",
    "Wow, you're a natural storyteller! The adventure is really picking up. What surprising thing happens to your character?",
    "Ooh, I didn't see that coming! The plot thickens! How does your character feel about what just happened?",
    "You're doing brilliantly! Now things get really interesting. What is the biggest challenge your character faces?",
    "This is so gripping! What clever idea does your character come up with to solve the problem?",
  ],
  ending: [
    "What a beautiful ending! You're a wonderful storyteller. Let me put your whole story together...",
    "That's a perfect way to wrap things up! Your story has heart. Shall we celebrate your masterpiece?",
    "Bravo! A truly satisfying conclusion. Your story is complete and it's amazing!",
  ],
};

/** Opening prompts for each stage */
const STAGE_OPENING_PROMPTS = {
  inspiration: "Hi there, young author! I'm Alice, and I'm thrilled to help you create your own story today. Which book inspired you? Tell me your favorite part or moment from it!",
  worldBuilding: "Wonderful! Now let's build the world of your story. Where does your story take place? Describe the setting — is it a magical forest, a distant planet, a cozy village?",
  narrative: "Your story is taking shape beautifully! Now for the exciting part — the adventure begins! What does your main character do first?",
  ending: "We're almost at the finish line! Every great story needs a memorable ending. How does your story resolve? What happens to your characters in the end?",
};

/** Beginner scaffolding hints */
const BEGINNER_HINTS = {
  inspiration: "Tip: You can say something like \"I loved the part when...\" or \"My favorite character was...\"",
  worldBuilding: "Tip: Think about: Is it daytime or nighttime? Is it hot or cold? Are there animals or magical creatures?",
  narrative: "Tip: Try starting with \"First, my character...\" or \"Suddenly, something amazing happened...\"",
  ending: "Tip: Think about: Is everyone happy? Did the character learn something? What does the world look like now?",
};

// ── Utility helpers ────────────────────────────────────────────────────────────

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countCharacters(text) {
  return text.replace(/\s/g, '').length;
}

function buildFullStory(parts) {
  return parts.map((p) => p.text).join(' ');
}

function normalizeLevel(raw) {
  if (!raw) return 'intermediate';
  const lower = raw.toLowerCase();
  if (lower.includes('beginner') || lower === 'a1' || lower === 'a2') return 'beginner';
  if (lower.includes('advanced') || lower === 'c1' || lower === 'c2') return 'advanced';
  return 'intermediate';
}

/** Resolve which stage index we're on (0-indexed) */
function stageIndex(stageKey) {
  return STAGES.findIndex((s) => s.key === stageKey);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** Top header bar: title + stage progress */
function StudioHeader({ stageKey, storyTitle }) {
  const idx = stageIndex(stageKey);
  const progress = ((idx + 1) / TOTAL_STAGES) * 100;
  const stage = STAGES[idx] ?? STAGES[0];

  return (
    <header className="ghibli-card px-5 py-4 mb-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl" aria-hidden="true">✨</span>
            <h1 className="text-xl font-extrabold text-[#3D2E1E]">Story Studio</h1>
            <span className="hialice-eyebrow ml-1">Create Your Story</span>
          </div>
          {storyTitle && (
            <p className="text-sm font-bold text-[#5C8B5C] truncate mt-0.5">
              "{storyTitle}"
            </p>
          )}
        </div>
        <Link
          href="/library"
          className="text-xs px-3 py-2 rounded-xl border border-[#D6C9A8] text-[#6B5744] hover:border-[#5C8B5C] hover:text-[#5C8B5C] font-bold transition-all min-h-[40px] flex items-center flex-shrink-0"
          aria-label="Back to Library"
        >
          Back to Library
        </Link>
      </div>

      {/* Stage progress row */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-extrabold text-[#3D2E1E]">
            <span aria-hidden="true">{stage.icon}</span>{' '}
            {stage.label}
          </span>
          <span className="text-xs font-bold text-[#6B5744]">
            Chapter {idx + 1} of {TOTAL_STAGES}
          </span>
        </div>
        {/* Progress bar */}
        <div
          role="progressbar"
          aria-valuenow={idx + 1}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STAGES}
          aria-label={`Story progress: ${stage.label}, stage ${idx + 1} of ${TOTAL_STAGES}`}
          className="h-2.5 bg-[#E8DEC8] rounded-full overflow-hidden"
        >
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #7AAE7A 0%, #5C8B5C 100%)',
            }}
          />
        </div>
        {/* Stage dots */}
        <div className="flex justify-between mt-2" aria-hidden="true">
          {STAGES.map((s, i) => (
            <div key={s.key} className="flex flex-col items-center gap-0.5">
              <span
                className={`text-base transition-all duration-300 ${
                  i <= idx ? 'opacity-100 scale-110' : 'opacity-30'
                }`}
              >
                {s.icon}
              </span>
              <span
                className={`text-[10px] font-bold hidden sm:block ${
                  i <= idx ? 'text-[#5C8B5C]' : 'text-[#9C8B74]'
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

/** Decorative leaf accent for nature atmosphere */
function LeafAccent({ className = '' }) {
  return (
    <span
      className={`leaf-sway inline-block text-[#7AAE7A] text-lg select-none pointer-events-none ${className}`}
      aria-hidden="true"
    >
      🍃
    </span>
  );
}

/** Story accumulation display — parchment-style */
function StoryDisplay({ storyParts }) {
  const storyEndRef = useRef(null);

  useEffect(() => {
    storyEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [storyParts.length]);

  return (
    <section
      role="article"
      aria-label="Your story so far"
      aria-live="polite"
      className="rounded-2xl border border-[#D6C9A8] shadow-[inset_0_2px_8px_rgba(61,46,30,0.06),0_4px_20px_rgba(61,46,30,0.08)] mb-4 overflow-hidden"
      style={{ background: '#FFFCF3' }}
    >
      <div className="px-4 py-3 border-b border-[#E8DEC8] flex items-center gap-2">
        <span className="text-lg" aria-hidden="true">📖</span>
        <h2 className="text-sm font-extrabold text-[#3D2E1E]">Your Story So Far</h2>
        <LeafAccent className="ml-auto" />
      </div>

      <div className="px-5 py-4 min-h-[120px] max-h-64 overflow-y-auto">
        {storyParts.length === 0 ? (
          <p className="text-[#9C8B74] text-sm font-semibold italic text-center py-4">
            Your story will appear here as you write it...
          </p>
        ) : (
          <p
            className="text-[#3D2E1E] leading-relaxed"
            style={{ fontSize: '18px', letterSpacing: '0.01em' }}
          >
            {storyParts.map((part, i) => (
              <span
                key={part.id}
                className="animate-fade-in"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {i > 0 && ' '}
                {part.text}
              </span>
            ))}
          </p>
        )}
        <div ref={storyEndRef} />
      </div>
    </section>
  );
}

/** Alice's message bubble */
function AliceBubble({ message, isLoading }) {
  return (
    <div className="flex items-start gap-3 mb-4" aria-live="polite" aria-atomic="true">
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7AAE7A] to-[#5C8B5C] flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_rgba(92,139,92,0.3)] float-animation"
        aria-hidden="true"
      >
        <span className="text-white text-sm font-extrabold">A</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-extrabold text-[#5C8B5C] mb-1">Alice</p>
        <div className="bubble-alice px-4 py-3 max-w-prose shadow-[0_2px_8px_rgba(61,46,30,0.08)]">
          {isLoading ? (
            <span className="flex items-center gap-2 text-[#6B5744]">
              <span className="shimmer inline-block w-2 h-2 rounded-full bg-[#5C8B5C]" />
              <span className="shimmer inline-block w-2 h-2 rounded-full bg-[#5C8B5C]" style={{ animationDelay: '0.2s' }} />
              <span className="shimmer inline-block w-2 h-2 rounded-full bg-[#5C8B5C]" style={{ animationDelay: '0.4s' }} />
              <span className="text-sm font-semibold ml-1">Alice is thinking...</span>
            </span>
          ) : (
            <p className="text-sm font-semibold text-[#3D2E1E] leading-relaxed">{message}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Beginner hint chip */
function HintChip({ hint }) {
  return (
    <div
      role="note"
      className="bg-[#FFF8E8] border border-[#D4A843]/30 rounded-xl px-4 py-2.5 mb-3 flex items-start gap-2"
    >
      <span className="text-base flex-shrink-0 mt-0.5" aria-hidden="true">💡</span>
      <p className="text-xs font-semibold text-[#6B5744] leading-relaxed">{hint}</p>
    </div>
  );
}

/** Student text input + voice button row */
function StoryInput({ value, onChange, onSubmit, isLoading, stageKey, isListening, onVoiceStart, onVoiceStop }) {
  const textareaRef = useRef(null);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit]
  );

  useEffect(() => {
    if (!isLoading) {
      textareaRef.current?.focus();
    }
  }, [isLoading]);

  const placeholders = {
    inspiration: 'Tell me what inspired you from the book...',
    worldBuilding: 'Describe your story world and characters...',
    narrative: 'What happens next in your story?',
    ending: 'How does your story end?',
  };

  return (
    <div className="ghibli-card p-4 mt-4">
      <label htmlFor="story-input" className="block text-xs font-extrabold text-[#6B5744] mb-2 uppercase tracking-wider">
        Your Contribution
      </label>

      <div className="flex gap-3 items-end">
        {/* Textarea */}
        <textarea
          id="story-input"
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholders[stageKey] ?? 'Add to your story...'}
          rows={3}
          disabled={isLoading}
          aria-label="Add your contribution to the story"
          className="ghibli-input flex-1 resize-none min-h-[80px] text-sm leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {/* Voice button */}
        <button
          type="button"
          onClick={isListening ? onVoiceStop : onVoiceStart}
          disabled={isLoading}
          aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
          aria-pressed={isListening}
          className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(61,46,30,0.15)] transition-all duration-200 active:scale-95 focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-[#3D6B3D] disabled:opacity-40 disabled:cursor-not-allowed ${
            isListening
              ? 'bg-gradient-to-br from-[#E28A84] to-[#D4736B] animate-pulse'
              : 'bg-gradient-to-br from-[#7AAE7A] to-[#5C8B5C] hover:-translate-y-0.5'
          }`}
        >
          {!isListening && (
            <div
              className="absolute rounded-full border border-[#7AC87A]/45 w-16 h-16"
              aria-hidden="true"
            />
          )}
          <svg
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 0 0-3 3v12a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          {isListening && (
            <div
              className="absolute inset-0 rounded-full border-4 border-[#D4736B] animate-ping opacity-75"
              aria-hidden="true"
            />
          )}
        </button>
      </div>

      {/* Submit button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={isLoading || !value.trim()}
        aria-label="Add your text to the story"
        className="mt-3 w-full ghibli-btn gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
      >
        <span aria-hidden="true">✏️</span>
        Add to Story
        <span className="text-xs font-semibold opacity-70 ml-1 hidden sm:inline">(Ctrl+Enter)</span>
      </button>
    </div>
  );
}

/** Completion stats row */
function StoryStats({ storyParts }) {
  const fullText = buildFullStory(storyParts);
  const words = countWords(fullText);
  const chars = countCharacters(fullText);

  return (
    <div className="flex items-center gap-4 flex-wrap justify-center mt-4 mb-6">
      <div className="flex items-center gap-1.5 bg-[#E8F5E8] px-3 py-1.5 rounded-full">
        <span className="text-sm" aria-hidden="true">📝</span>
        <span className="text-xs font-bold text-[#5C8B5C]">{words} words</span>
      </div>
      <div className="flex items-center gap-1.5 bg-[#E8F5E8] px-3 py-1.5 rounded-full">
        <span className="text-sm" aria-hidden="true">🔤</span>
        <span className="text-xs font-bold text-[#5C8B5C]">{chars} characters</span>
      </div>
      <div className="flex items-center gap-1.5 bg-[#FFF8E8] px-3 py-1.5 rounded-full">
        <span className="text-sm" aria-hidden="true">📖</span>
        <span className="text-xs font-bold text-[#D4A843]">{storyParts.length} contributions</span>
      </div>
    </div>
  );
}

/** Confetti burst — pure CSS, no external library */
const CONFETTI_COLORS = ['#5C8B5C', '#D4A843', '#87CEDB', '#D4736B', '#A78BFA', '#F97316', '#10B981'];

function ConfettiBurst({ active }) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (!active) return;
    const generated = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 0.8}s`,
      duration: `${1.5 + Math.random() * 2}s`,
      size: 6 + Math.floor(Math.random() * 8),
      isCircle: Math.random() > 0.5,
    }));
    setPieces(generated);
    const timer = setTimeout(() => setPieces([]), 4000);
    return () => clearTimeout(timer);
  }, [active]);

  if (pieces.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes story-confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .story-confetti-piece {
          position: absolute;
          top: -20px;
          animation: story-confetti-fall var(--cf-dur) var(--cf-del) ease-in both;
        }
      `}</style>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="story-confetti-piece"
          style={{
            left: p.left,
            width: p.isCircle ? `${p.size}px` : `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: p.isCircle ? '50%' : '2px',
            backgroundColor: p.color,
            '--cf-dur': p.duration,
            '--cf-del': p.delay,
          }}
        />
      ))}
    </div>
  );
}

/** Print-only style injected once */
const PRINT_STYLES = `
  @media print {
    body > *:not(#story-print-root) { display: none !important; }
    #story-print-root { display: block !important; }
    #story-print-root * { color: #000 !important; }
    @page { margin: 2cm; }
  }
`;

/** Completion screen */
function CompletionScreen({ storyParts, storyTitle, onReset }) {
  const fullText = buildFullStory(storyParts);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        `${storyTitle ? `"${storyTitle}"\n\n` : ''}${fullText}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — silent fail
    }
  }, [fullText, storyTitle]);

  const handlePrint = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }, []);

  return (
    <div className="animate-fade-in">
      {/* Print-only root */}
      <div id="story-print-root" style={{ display: 'none' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>
          {storyTitle || 'My Story'}
        </h1>
        <p style={{ fontSize: '16px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{fullText}</p>
        <p style={{ marginTop: '2rem', textAlign: 'right', fontSize: '12px', color: '#888' }}>
          Created with HiAlice Story Studio
        </p>
      </div>

      {/* Celebration header */}
      <div className="text-center mb-6">
        <div className="text-6xl mb-3 float-animation inline-block" role="img" aria-label="sparkles">
          ✨
        </div>
        <h2 className="text-2xl font-extrabold text-[#3D2E1E] mb-1">
          Your Story is Complete!
        </h2>
        {storyTitle && (
          <p className="text-lg font-bold text-[#5C8B5C]">"{storyTitle}"</p>
        )}
        <StoryStats storyParts={storyParts} />
      </div>

      {/* Full story display */}
      <div
        role="article"
        aria-label="Your complete story"
        className="rounded-2xl border-2 border-[#D6C9A8] shadow-[0_8px_32px_rgba(61,46,30,0.10)] mb-6 overflow-hidden"
        style={{ background: '#FFFCF3' }}
      >
        <div
          className="px-4 py-3 border-b border-[#E8DEC8] flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg, #FFF8E8 0%, #F5F0DC 100%)' }}
        >
          <span className="text-xl" aria-hidden="true">📜</span>
          <h3 className="text-sm font-extrabold text-[#3D2E1E]">
            {storyTitle || 'My Story'}
          </h3>
          <LeafAccent className="ml-auto" />
        </div>
        <div className="px-6 py-5">
          <p
            className="text-[#3D2E1E] leading-loose"
            style={{ fontSize: '18px', letterSpacing: '0.015em', fontFamily: 'Georgia, serif' }}
          >
            {fullText}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Story copied!' : 'Copy story to clipboard'}
          className="ghibli-btn gap-1.5 text-sm"
        >
          <span aria-hidden="true">{copied ? '✅' : '📋'}</span>
          {copied ? 'Copied!' : 'Copy Story'}
        </button>

        <button
          type="button"
          onClick={handlePrint}
          aria-label="Print your story"
          className="ghibli-btn gap-1.5 text-sm"
          style={{ background: '#6B5744' }}
        >
          <span aria-hidden="true">🖨️</span>
          Print Story
        </button>

        <button
          type="button"
          onClick={onReset}
          aria-label="Create another story"
          className="ghibli-btn gap-1.5 text-sm"
          style={{ background: '#D4A843' }}
        >
          <span aria-hidden="true">🌟</span>
          New Story
        </button>

        <Link
          href="/library"
          className="ghibli-btn gap-1.5 text-sm"
          style={{ background: '#87CEDB', color: '#3D2E1E' }}
        >
          <span aria-hidden="true">📚</span>
          Library
        </Link>
      </div>
    </div>
  );
}

// ── Web Speech API hook ────────────────────────────────────────────────────────

function useVoiceInput({ onResult, disabled }) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const start = useCallback(() => {
    if (disabled || typeof window === 'undefined') return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) {
        onResult(transcript);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [disabled, onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return { isListening, start, stop };
}

// ── Main page component ────────────────────────────────────────────────────────

export default function StoryStudioPage() {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [storyStage, setStoryStage] = useState('inspiration');
  const [storyParts, setStoryParts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [turn, setTurn] = useState(0);
  const [storyTitle, setStoryTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [storyComplete, setStoryComplete] = useState(false);
  const [studentLevel, setStudentLevel] = useState('intermediate');
  const [inputValue, setInputValue] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [narrativeTurnCount, setNarrativeTurnCount] = useState(0);

  // Part ID counter — immutable increment pattern
  const nextPartId = useRef(1);

  // ── Load student level from storage ────────────────────────────────────────
  useEffect(() => {
    const raw = getItem('studentLevel');
    setStudentLevel(normalizeLevel(raw));
  }, []);

  // ── Initialize with Alice's opening prompt ──────────────────────────────────
  useEffect(() => {
    const opening = STAGE_OPENING_PROMPTS.inspiration;
    setMessages([
      {
        id: 'init-0',
        speaker: 'alice',
        content: opening,
        timestamp: new Date(),
      },
    ]);
  }, []);

  // ── Voice input ─────────────────────────────────────────────────────────────
  const handleVoiceResult = useCallback((transcript) => {
    setInputValue((prev) => (prev ? `${prev} ${transcript}` : transcript));
  }, []);

  const { isListening, start: startVoice, stop: stopVoice } = useVoiceInput({
    onResult: handleVoiceResult,
    disabled: isLoading || storyComplete,
  });

  // ── Derived values ──────────────────────────────────────────────────────────
  const maxNarrativeTurns = MAX_NARRATIVE_TURNS[studentLevel] ?? 4;
  const isBeginnerLevel = studentLevel === 'beginner';
  const currentHint = isBeginnerLevel ? BEGINNER_HINTS[storyStage] : null;

  // ── Stage advancement logic ─────────────────────────────────────────────────
  const advanceStage = useCallback((currentStage) => {
    const stageOrder = STAGES.map((s) => s.key);
    const idx = stageOrder.indexOf(currentStage);
    if (idx < 0 || idx >= stageOrder.length - 1) return null;
    return stageOrder[idx + 1];
  }, []);

  const shouldAdvanceFromNarrative = useCallback(
    (currentNarrativeTurns) => currentNarrativeTurns >= maxNarrativeTurns,
    [maxNarrativeTurns]
  );

  // ── Mock AI response with simulated delay ───────────────────────────────────
  const fetchMockResponse = useCallback(
    async (stageKey) => {
      await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 600));
      const pool = MOCK_STORY_RESPONSES[stageKey] ?? MOCK_STORY_RESPONSES.narrative;
      return getRandomItem(pool);
    },
    []
  );

  // ── Submit handler — main story progression logic ───────────────────────────
  const handleSubmit = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading || storyComplete) return;

    setIsLoading(true);
    setInputValue('');

    // 1. Add student message to chat
    const studentMsg = {
      id: `student-${Date.now()}`,
      speaker: 'student',
      content: trimmed,
      timestamp: new Date(),
    };

    // 2. Append student contribution to story parts (immutable)
    const newPart = {
      id: `part-${nextPartId.current++}`,
      text: trimmed,
      stage: storyStage,
    };

    setStoryParts((prev) => [...prev, newPart]);
    setMessages((prev) => [...prev, studentMsg]);

    // 3. Auto-title from first contribution
    if (storyParts.length === 0 && !storyTitle) {
      const words = trimmed.split(/\s+/).slice(0, 4).join(' ');
      setStoryTitle(`${words}...`);
    }

    // 4. Determine next stage
    let nextStage = storyStage;
    let newNarrativeTurns = narrativeTurnCount;

    if (storyStage === 'narrative') {
      newNarrativeTurns = narrativeTurnCount + 1;
      setNarrativeTurnCount(newNarrativeTurns);
      if (shouldAdvanceFromNarrative(newNarrativeTurns)) {
        nextStage = 'ending';
      }
    } else {
      const advanced = advanceStage(storyStage);
      if (advanced) {
        nextStage = advanced;
      }
    }

    // 5. Fetch AI response for the upcoming stage context
    const responseStage = nextStage === storyStage ? storyStage : nextStage;
    const aiText = await fetchMockResponse(responseStage);

    const aliceMsg = {
      id: `alice-${Date.now()}`,
      speaker: 'alice',
      content: aiText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, aliceMsg]);

    // 6. Advance stage or mark complete
    if (nextStage !== storyStage) {
      setStoryStage(nextStage);

      if (nextStage === 'ending') {
        // Inject ending opening prompt after AI response
        setMessages((prev) => [
          ...prev,
          {
            id: `alice-ending-${Date.now()}`,
            speaker: 'alice',
            content: STAGE_OPENING_PROMPTS.ending,
            timestamp: new Date(),
          },
        ]);
      }
    }

    // 7. If already in ending stage and student just contributed, finish story
    if (storyStage === 'ending') {
      // Allow one final AI response then complete
      setTimeout(() => {
        setStoryComplete(true);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
      }, 1200);
    }

    setTurn((prev) => prev + 1);
    setIsLoading(false);
  }, [
    inputValue,
    isLoading,
    storyComplete,
    storyStage,
    storyParts.length,
    storyTitle,
    narrativeTurnCount,
    shouldAdvanceFromNarrative,
    advanceStage,
    fetchMockResponse,
  ]);

  // ── Reset — create a new story ──────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setStoryStage('inspiration');
    setStoryParts([]);
    setMessages([
      {
        id: 'reset-0',
        speaker: 'alice',
        content: STAGE_OPENING_PROMPTS.inspiration,
        timestamp: new Date(),
      },
    ]);
    setTurn(0);
    setNarrativeTurnCount(0);
    setStoryTitle('');
    setIsLoading(false);
    setStoryComplete(false);
    setInputValue('');
    setShowConfetti(false);
    nextPartId.current = 1;
  }, []);

  // ── Recent AI message for the bubble ───────────────────────────────────────
  const lastAliceMessage = messages.filter((m) => m.speaker === 'alice').at(-1);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F0E8] ghibli-bg">
      {/* Print styles */}
      <style>{PRINT_STYLES}</style>

      {/* Confetti celebration */}
      <ConfettiBurst active={showConfetti} />

      <div className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-10">
        {/* ── Header with stage progress ── */}
        <StudioHeader stageKey={storyStage} storyTitle={storyTitle} />

        {/* ── Completion screen ── */}
        {storyComplete ? (
          <div className="ghibli-card p-6">
            <CompletionScreen
              storyParts={storyParts}
              storyTitle={storyTitle}
              onReset={handleReset}
            />
          </div>
        ) : (
          <>
            {/* ── Story accumulation display ── */}
            <StoryDisplay storyParts={storyParts} />

            {/* ── Alice's current prompt ── */}
            {lastAliceMessage && (
              <AliceBubble
                message={lastAliceMessage.content}
                isLoading={isLoading}
              />
            )}
            {isLoading && !lastAliceMessage && (
              <AliceBubble message="" isLoading />
            )}

            {/* ── Beginner scaffolding hint ── */}
            {currentHint && !isLoading && (
              <HintChip hint={currentHint} />
            )}

            {/* ── Level indicator chip ── */}
            <div className="flex items-center gap-2 mb-2" aria-label={`Learning mode: ${studentLevel}`}>
              <span className="hialice-section-chip">
                <span aria-hidden="true">
                  {studentLevel === 'beginner' ? '🌱' : studentLevel === 'advanced' ? '🌳' : '🌿'}
                </span>
                {studentLevel.charAt(0).toUpperCase() + studentLevel.slice(1)} Mode
              </span>
              {storyStage === 'narrative' && (
                <span className="hialice-section-chip">
                  <span aria-hidden="true">📝</span>
                  Turn {narrativeTurnCount + 1} / {maxNarrativeTurns}
                </span>
              )}
            </div>

            {/* ── Story input area ── */}
            <StoryInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              stageKey={storyStage}
              isListening={isListening}
              onVoiceStart={startVoice}
              onVoiceStop={stopVoice}
            />

            {/* ── Word count mini-stats (only once story has begun) ── */}
            {storyParts.length > 0 && (
              <div className="mt-3 flex items-center justify-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5 bg-[#E8F5E8]/70 px-2.5 py-1 rounded-full">
                  <span className="text-xs" aria-hidden="true">📝</span>
                  <span className="text-[11px] font-bold text-[#5C8B5C]">
                    {countWords(buildFullStory(storyParts))} words
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#E8F5E8]/70 px-2.5 py-1 rounded-full">
                  <span className="text-xs" aria-hidden="true">🍃</span>
                  <span className="text-[11px] font-bold text-[#5C8B5C]">
                    {storyParts.length} {storyParts.length === 1 ? 'segment' : 'segments'}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
