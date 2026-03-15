'use client';

/**
 * debate/page.js — Debate Mode for intermediate/advanced students (ages 9–13)
 *
 * 4-stage structured argumentation flow:
 *   setup → position → counterArgument → conclusion
 *
 * Age gate: beginner-level students are redirected to the library with a
 * friendly message. All student data is read from clientStorage; this page
 * has its own self-contained state and does NOT import from SessionContext.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getItem } from '@/lib/clientStorage';

// ── Constants ────────────────────────────────────────────────────────────────

const DEBATE_STAGES = ['setup', 'position', 'counterArgument', 'conclusion'];

const STAGE_LABELS = {
  setup: 'Choose a Topic',
  position: 'Your Position',
  counterArgument: 'Counter-Argument',
  conclusion: 'Conclusion',
};

const STAGE_NUMBERS = {
  setup: 1,
  position: 2,
  counterArgument: 3,
  conclusion: 4,
};

const STAGE_DESCRIPTIONS = {
  setup: 'Pick a debate topic from this book and choose which side you want to defend.',
  position: 'Share your main argument and give reasons to support your view.',
  counterArgument: 'Think about the other side. How would you respond to their strongest point?',
  conclusion: 'Bring it all together. Summarize your argument and what you learned.',
};

/** Mock AI responses keyed by debate stage */
const MOCK_DEBATE_RESPONSES = {
  setup: [
    "That's a great topic to debate! There are definitely two sides to this. Which position do you want to take?",
  ],
  position: [
    "Interesting argument! Can you give me one more reason to support your view?",
  ],
  counterArgument: [
    "I see your point, but what if someone argued the opposite? How would you respond to that?",
  ],
  conclusion: [
    "Excellent debate! You showed strong critical thinking. Let me summarize what we discussed...",
  ],
};

/** Sample debate topics seeded from book context (mock) */
const SAMPLE_TOPICS = [
  { id: 'topic-1', label: 'The main character made the right choice', proLabel: 'Agree', conLabel: 'Disagree' },
  { id: 'topic-2', label: 'Friendship is more important than winning', proLabel: 'Agree', conLabel: 'Disagree' },
  { id: 'topic-3', label: 'Rules should always be followed', proLabel: 'Agree', conLabel: 'Disagree' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a mock AI reply for the given debate stage. */
function getMockReply(stage) {
  const pool = MOCK_DEBATE_RESPONSES[stage] ?? MOCK_DEBATE_RESPONSES.position;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Simulate an async AI response delay (600–1200 ms). */
function simulateAiDelay() {
  const delayMs = 600 + Math.random() * 600;
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/** Build a unique message id without depending on crypto.randomUUID(). */
let _msgIdCounter = 0;
function nextMsgId() {
  _msgIdCounter += 1;
  return `msg-${Date.now()}-${_msgIdCounter}`;
}

/** Format a Date to HH:MM string. */
function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Sub-components ───────────────────────────────────────────────────────────

/** Stage progress bar displayed at the top of the arena. */
function StageProgressBar({ stage }) {
  const current = STAGE_NUMBERS[stage] ?? 1;
  const total = DEBATE_STAGES.length;
  const pct = Math.round((current / total) * 100);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-xs font-extrabold text-[#6B5744] whitespace-nowrap">
        Stage {current} of {total}: {STAGE_LABELS[stage]}
      </span>
      <div
        className="flex-1 min-w-[80px] h-2.5 rounded-full bg-[#EDE5D4] overflow-hidden"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Debate stage ${current} of ${total}`}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #5C8B5C 0%, #3D6B3D 100%)',
          }}
        />
      </div>
    </div>
  );
}

/** VS banner between the two position cards. */
function PositionCards({ studentPosition, topic }) {
  const studentSide = studentPosition === 'pro' ? (topic?.proLabel ?? 'Agree') : (topic?.conLabel ?? 'Disagree');
  const otherSide = studentPosition === 'pro' ? (topic?.conLabel ?? 'Disagree') : (topic?.proLabel ?? 'Agree');

  return (
    <div className="flex items-center gap-3" role="group" aria-label="Debate positions">
      {/* Student side */}
      <div
        className="flex-1 rounded-2xl border-2 border-[#A5C8A5] bg-[#C8DBC8] p-3 text-center min-h-[70px] flex flex-col items-center justify-center"
        aria-label={`Your view: ${studentSide}`}
      >
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#3D6B3D] mb-1">Your View</p>
        <p className="text-sm font-extrabold text-[#3D2E1E] leading-tight">{studentSide}</p>
      </div>

      {/* VS */}
      <div
        className="w-9 h-9 rounded-full bg-[#D4A843] flex items-center justify-center flex-shrink-0 shadow-[0_2px_8px_rgba(212,168,67,0.4)]"
        aria-hidden="true"
      >
        <span className="text-xs font-extrabold text-white">VS</span>
      </div>

      {/* Other side */}
      <div
        className="flex-1 rounded-2xl border-2 border-[#D4A89A] bg-[#F0D4C4] p-3 text-center min-h-[70px] flex flex-col items-center justify-center"
        aria-label={`Other side: ${otherSide}`}
      >
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#9B5B3D] mb-1">Other Side</p>
        <p className="text-sm font-extrabold text-[#3D2E1E] leading-tight">{otherSide}</p>
      </div>
    </div>
  );
}

/** Single chat message bubble. */
function MessageBubble({ msg }) {
  const isAlice = msg.speaker === 'alice';
  const isTransition = msg.isTransition;

  if (isTransition) {
    return (
      <div className="flex justify-center" role="status">
        <div className="bg-[#D4A843] bg-opacity-15 border-l-4 border-[#D4A843] px-4 py-3 rounded-xl max-w-md">
          <p className="text-sm font-bold text-[#A8822E] text-center">{msg.content}</p>
        </div>
      </div>
    );
  }

  if (isAlice) {
    return (
      <div className="flex gap-3 items-start">
        {/* Alice avatar */}
        <div
          className="w-8 h-8 rounded-full bg-[#5C8B5C] flex items-center justify-center flex-shrink-0 mt-1 shadow-sm"
          aria-hidden="true"
        >
          <span className="text-white text-sm font-extrabold">A</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-[#D6E9D6] text-[#3D2E1E] px-4 py-3 rounded-2xl rounded-tl-none max-w-xs lg:max-w-md shadow-[0_2px_8px_rgba(61,46,30,0.08)]">
            <p className="text-sm font-semibold leading-relaxed">{msg.content}</p>
          </div>
          <p className="text-xs text-[#6B5744] mt-1 ml-1 font-medium">{formatTime(msg.timestamp)}</p>
        </div>
      </div>
    );
  }

  // Student message
  return (
    <div className="flex flex-col items-end">
      <div className="bg-[#FFFCF3] text-[#3D2E1E] border border-[#D6C9A8] px-4 py-3 rounded-2xl rounded-tr-none max-w-xs lg:max-w-md shadow-[0_2px_8px_rgba(61,46,30,0.06)]">
        <p className="text-sm font-semibold leading-relaxed">{msg.content}</p>
      </div>
      <p className="text-xs text-[#6B5744] mt-1 mr-1 font-medium">{formatTime(msg.timestamp)}</p>
    </div>
  );
}

/** Typing indicator while the mock AI "thinks". */
function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start" role="status" aria-label="Alice is thinking">
      <div
        className="w-8 h-8 rounded-full bg-[#5C8B5C] flex items-center justify-center flex-shrink-0 mt-1"
        aria-hidden="true"
      >
        <span className="text-white text-sm font-extrabold">A</span>
      </div>
      <div className="bg-[#D6E9D6] px-4 py-3 rounded-2xl rounded-tl-none shadow-[0_2px_8px_rgba(61,46,30,0.08)]">
        <div className="flex gap-1 items-center">
          {[0, 0.2, 0.4].map((delay) => (
            <div
              key={delay}
              className="h-2 w-2 rounded-full bg-[#5C8B5C] animate-bounce"
              style={{ animationDelay: `${delay}s` }}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Age Gate Screen ──────────────────────────────────────────────────────────

function AgeGateScreen() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12">
      <div className="ghibli-card p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4 float-animation inline-block" aria-hidden="true">
          📚
        </div>
        <h1 className="text-xl font-extrabold text-[#3D2E1E] mb-3">
          Debate Mode is for students aged 9 and up.
        </h1>
        <p className="text-sm font-semibold text-[#6B5744] mb-6 leading-relaxed">
          Debate Mode helps older readers practice arguing ideas from both sides. Keep reading and you will get there!
        </p>
        <Link
          href="/library"
          className="block w-full py-3 px-6 bg-[#5C8B5C] text-white rounded-2xl font-bold hover:bg-[#3D6B3D] transition-all hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(92,139,92,0.3)] min-h-[48px] flex items-center justify-center text-sm"
        >
          Go to Library
        </Link>
      </div>
    </div>
  );
}

// ── Setup Stage ──────────────────────────────────────────────────────────────

function SetupStage({ bookInfo, onStart, isLoading }) {
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);

  const selectedTopic = SAMPLE_TOPICS.find((t) => t.id === selectedTopicId) ?? null;

  const canProceed = selectedTopicId !== null && selectedPosition !== null && !isLoading;

  function handleTopicSelect(topicId) {
    setSelectedTopicId(topicId);
    setSelectedPosition(null);
  }

  function handleSubmit() {
    if (!canProceed) return;
    onStart(selectedTopic, selectedPosition);
  }

  return (
    <div className="space-y-5">
      {/* Book context */}
      <div className="ghibli-card p-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#A8822E] mb-1">
          Book in Focus
        </p>
        <p className="font-extrabold text-[#3D2E1E] text-base truncate">
          {bookInfo?.title ?? 'Your Current Book'}
        </p>
      </div>

      {/* Topic selection */}
      <section aria-labelledby="topic-heading">
        <h2 id="topic-heading" className="text-sm font-extrabold text-[#3D2E1E] mb-3">
          1. Choose a debate topic
        </h2>
        <div className="space-y-2" role="radiogroup" aria-labelledby="topic-heading">
          {SAMPLE_TOPICS.map((topic) => {
            const isSelected = topic.id === selectedTopicId;
            return (
              <button
                key={topic.id}
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleTopicSelect(topic.id)}
                className={`w-full text-left px-4 py-3 rounded-2xl border-2 transition-all font-semibold text-sm min-h-[52px] ${
                  isSelected
                    ? 'border-[#5C8B5C] bg-[#E8F5E8] text-[#3D2E1E] shadow-[0_2px_8px_rgba(92,139,92,0.2)]'
                    : 'border-[#D6C9A8] bg-[#FFFCF3] text-[#6B5744] hover:border-[#A5C8A5] hover:bg-[#F0F7F0]'
                }`}
              >
                {topic.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Position selection — only shown after picking a topic */}
      {selectedTopic && (
        <section aria-labelledby="position-heading">
          <h2 id="position-heading" className="text-sm font-extrabold text-[#3D2E1E] mb-3">
            2. Which side will you defend?
          </h2>
          <div className="flex gap-3" role="radiogroup" aria-labelledby="position-heading">
            {['pro', 'con'].map((side) => {
              const label = side === 'pro' ? selectedTopic.proLabel : selectedTopic.conLabel;
              const isSelected = selectedPosition === side;
              const cardColor = side === 'pro' ? '#C8DBC8' : '#F0D4C4';
              const borderColor = side === 'pro' ? '#A5C8A5' : '#D4A89A';
              const selectedBorder = side === 'pro' ? '#3D6B3D' : '#9B5B3D';

              return (
                <button
                  key={side}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedPosition(side)}
                  className="flex-1 py-4 px-3 rounded-2xl border-2 transition-all font-extrabold text-sm text-center min-h-[64px]"
                  style={{
                    backgroundColor: cardColor,
                    borderColor: isSelected ? selectedBorder : borderColor,
                    boxShadow: isSelected ? `0 2px 10px rgba(0,0,0,0.12)` : undefined,
                    transform: isSelected ? 'translateY(-1px)' : undefined,
                    color: '#3D2E1E',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Start button */}
      <button
        onClick={handleSubmit}
        disabled={!canProceed}
        className={`w-full py-3 px-6 rounded-2xl font-extrabold text-sm transition-all min-h-[52px] ${
          canProceed
            ? 'bg-[#3D6B3D] text-white hover:bg-[#2D5B2D] hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(61,107,61,0.35)]'
            : 'bg-[#EDE5D4] text-[#9C8B74] cursor-not-allowed'
        }`}
        aria-disabled={!canProceed}
      >
        {isLoading ? 'Starting debate...' : 'Start Debate'}
      </button>
    </div>
  );
}

// ── Completion Screen ─────────────────────────────────────────────────────────

function CompletionScreen({ topic, studentPosition, turnCount, onTryAnother }) {
  const studentSide =
    studentPosition === 'pro' ? (topic?.proLabel ?? 'Agree') : (topic?.conLabel ?? 'Disagree');

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12">
      <div className="ghibli-card p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4 float-animation inline-block" aria-hidden="true">
          🏆
        </div>
        <h1 className="text-2xl font-extrabold text-[#3D2E1E] mb-2">Great Debate!</h1>
        <p className="text-sm font-semibold text-[#6B5744] mb-6 leading-relaxed">
          You defended <span className="font-extrabold text-[#3D6B3D]">&quot;{studentSide}&quot;</span> on
          the topic <span className="font-extrabold text-[#3D2E1E]">&quot;{topic?.label}&quot;</span> across{' '}
          <span className="font-extrabold">{turnCount}</span> turns. Excellent critical thinking!
        </p>

        {/* Summary pills */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: '💬', label: 'Turns Taken', value: turnCount },
            { icon: '🎯', label: 'Your Side', value: studentSide },
            { icon: '🧠', label: 'Skill', value: 'Critical' },
          ].map(({ icon, label, value }) => (
            <div
              key={label}
              className="bg-[#F5F0E8] rounded-2xl p-3 border border-[#D6C9A8]"
            >
              <div className="text-2xl mb-1" aria-hidden="true">{icon}</div>
              <p className="text-xs text-[#6B5744] font-bold leading-tight">{label}</p>
              <p className="text-sm text-[#3D2E1E] font-extrabold mt-0.5 truncate">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/library"
            className="flex-1 py-3 px-4 bg-[#EDE5D4] text-[#6B5744] rounded-2xl font-extrabold text-sm hover:bg-[#D6C9A8] transition-all hover:-translate-y-0.5 min-h-[48px] flex items-center justify-center"
          >
            Back to Library
          </Link>
          <button
            onClick={onTryAnother}
            className="flex-1 py-3 px-4 bg-[#3D6B3D] text-white rounded-2xl font-extrabold text-sm hover:bg-[#2D5B2D] transition-all hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(61,107,61,0.35)] min-h-[48px]"
          >
            Try Another Debate
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Debate Page ─────────────────────────────────────────────────────────

export default function DebatePage() {
  // ── Student data from storage ─────────────────────────────────────────────
  const [studentLevel, setStudentLevel] = useState(null);
  const [bookInfo, setBookInfo] = useState(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // ── Debate state ──────────────────────────────────────────────────────────
  const [debateStage, setDebateStage] = useState('setup');
  const [studentPosition, setStudentPosition] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [messages, setMessages] = useState([]);
  const [turn, setTurn] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [debateComplete, setDebateComplete] = useState(false);

  // ── Input state ───────────────────────────────────────────────────────────
  const [inputText, setInputText] = useState('');

  // ── Refs for focus management and scroll ─────────────────────────────────
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const arenaHeaderRef = useRef(null);

  // ── Hydration — read storage once on mount ────────────────────────────────
  useEffect(() => {
    const level = getItem('studentLevel') ?? 'beginner';
    const bookTitle = getItem('bookTitle') ?? null;
    const bookId = getItem('bookId') ?? null;

    setStudentLevel(level);
    setBookInfo(bookTitle ? { id: bookId, title: bookTitle } : null);
    setIsHydrated(true);
  }, []);

  // ── Scroll to bottom on new messages ─────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // ── Focus management on stage transitions ─────────────────────────────────
  useEffect(() => {
    if (debateStage !== 'setup' && arenaHeaderRef.current) {
      arenaHeaderRef.current.focus();
    }
  }, [debateStage]);

  // ── Push an Alice message after a simulated delay ─────────────────────────
  const pushAliceMessage = useCallback(async (stage) => {
    setIsLoading(true);
    await simulateAiDelay();
    const content = getMockReply(stage);
    setMessages((prev) => [
      ...prev,
      { id: nextMsgId(), speaker: 'alice', content, timestamp: new Date() },
    ]);
    setIsLoading(false);
    // After render, focus the input field
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ── Start debate (called from SetupStage) ─────────────────────────────────
  const handleStart = useCallback(
    async (topic, position) => {
      setIsLoading(true);
      setSelectedTopic(topic);
      setStudentPosition(position);

      const openingMsg = {
        id: nextMsgId(),
        speaker: 'alice',
        content: `Welcome to the Debate Arena! Today's topic: "${topic.label}". You are defending the "${position === 'pro' ? topic.proLabel : topic.conLabel}" side. Let's begin!`,
        timestamp: new Date(),
      };

      setMessages([openingMsg]);
      setDebateStage('position');
      setTurn(0);
      setIsLoading(false);

      // Alice immediately follows up with a stage-specific question
      await pushAliceMessage('position');
    },
    [pushAliceMessage]
  );

  // ── Advance to the next debate stage ─────────────────────────────────────
  const advanceStage = useCallback(
    async (currentStage) => {
      const currentIdx = DEBATE_STAGES.indexOf(currentStage);
      if (currentIdx < 0) return;

      const isLastStage = currentIdx === DEBATE_STAGES.length - 1;

      if (isLastStage) {
        // Conclusion stage just finished — mark complete after Alice replies
        await pushAliceMessage('conclusion');
        setDebateComplete(true);
        return;
      }

      const nextStage = DEBATE_STAGES[currentIdx + 1];

      const transitionMsg = {
        id: nextMsgId(),
        speaker: 'system',
        content: `Stage ${STAGE_NUMBERS[nextStage]}: ${STAGE_LABELS[nextStage]}`,
        isTransition: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, transitionMsg]);
      setDebateStage(nextStage);
      setTurn(0);

      await pushAliceMessage(nextStage);
    },
    [pushAliceMessage]
  );

  // ── Handle student text submission ────────────────────────────────────────
  const handleSendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading || debateComplete) return;

    const studentMsg = {
      id: nextMsgId(),
      speaker: 'student',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, studentMsg]);
    setInputText('');

    const newTurn = turn + 1;
    setTurn(newTurn);

    // After 2 student turns per stage, advance to the next stage.
    // The conclusion stage ends after 1 turn so it feels like a wrap-up.
    const turnsNeeded = debateStage === 'conclusion' ? 1 : 2;

    if (newTurn >= turnsNeeded) {
      await advanceStage(debateStage);
    } else {
      await pushAliceMessage(debateStage);
    }
  }, [inputText, isLoading, debateComplete, turn, debateStage, advanceStage, pushAliceMessage]);

  // ── Keyboard shortcut: Enter to send ─────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  // ── Reset to try another debate ───────────────────────────────────────────
  const handleTryAnother = useCallback(() => {
    setDebateStage('setup');
    setStudentPosition('');
    setSelectedTopic(null);
    setMessages([]);
    setTurn(0);
    setIsLoading(false);
    setDebateComplete(false);
    setInputText('');
  }, []);

  // ── Pre-hydration — render nothing to avoid SSR mismatch ─────────────────
  if (!isHydrated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 float-animation inline-block" aria-hidden="true">
            🏛️
          </div>
          <p className="text-[#6B5744] font-bold">Loading Debate Arena...</p>
        </div>
      </div>
    );
  }

  // ── Age gate — beginner students redirected ───────────────────────────────
  const normalizedLevel = (studentLevel ?? 'beginner').toLowerCase();
  const isEligible = normalizedLevel === 'intermediate' || normalizedLevel === 'advanced';

  if (!isEligible) {
    return <AgeGateScreen />;
  }

  // ── Completion screen ─────────────────────────────────────────────────────
  if (debateComplete) {
    return (
      <CompletionScreen
        topic={selectedTopic}
        studentPosition={studentPosition}
        turnCount={messages.filter((m) => m.speaker === 'student').length}
        onTryAnother={handleTryAnother}
      />
    );
  }

  // ── Main debate layout ────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Arena Header ───────────────────────────────────────────────── */}
      <header
        ref={arenaHeaderRef}
        tabIndex={-1}
        className="rounded-[28px] border border-[#D6C9A8] bg-[linear-gradient(135deg,#eef5dc_0%,#fff8df_45%,#e0eef9_100%)] p-5 shadow-[0_10px_30px_rgba(61,46,30,0.08)] focus:outline-none"
        aria-label={`Debate Arena, currently at stage: ${STAGE_LABELS[debateStage]}`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-lg" aria-hidden="true">🏛️</span>
              <h1 className="text-lg font-extrabold text-[#3D2E1E] truncate">
                Debate Arena
                {bookInfo?.title ? (
                  <span className="text-[#5C8B5C]"> — {bookInfo.title}</span>
                ) : null}
              </h1>
            </div>
            <p className="text-xs font-semibold text-[#6B5744] leading-relaxed">
              {STAGE_DESCRIPTIONS[debateStage]}
            </p>
          </div>

          {/* Exit link */}
          <Link
            href="/library"
            className="self-start sm:self-auto text-xs text-[#6B5744] hover:text-[#5C8B5C] flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D6C9A8] hover:border-[#5C8B5C] transition-all min-h-[40px] font-bold whitespace-nowrap flex-shrink-0"
            aria-label="Exit debate and go to library"
          >
            Exit Arena
          </Link>
        </div>

        {/* Progress bar — only shown once debate has started */}
        {debateStage !== 'setup' && (
          <div className="mt-3 pt-3 border-t border-[#D6C9A8]">
            <StageProgressBar stage={debateStage} />
          </div>
        )}
      </header>

      {/* ── VS Position Cards — visible after setup ─────────────────────── */}
      {debateStage !== 'setup' && selectedTopic && (
        <PositionCards studentPosition={studentPosition} topic={selectedTopic} />
      )}

      {/* ── Setup Stage ─────────────────────────────────────────────────── */}
      {debateStage === 'setup' && (
        <div className="ghibli-card p-6">
          <SetupStage bookInfo={bookInfo} onStart={handleStart} isLoading={isLoading} />
        </div>
      )}

      {/* ── Chat Area — visible in all stages after setup ────────────────── */}
      {debateStage !== 'setup' && (
        <section
          className="ghibli-card overflow-hidden flex flex-col"
          aria-label="Debate conversation"
          style={{ minHeight: '420px', maxHeight: '60vh' }}
        >
          {/* Chat top bar */}
          <div className="border-b border-[#D6C9A8] px-4 py-3 bg-[#FFFCF3] flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full bg-[#5C8B5C] flex items-center justify-center"
                aria-hidden="true"
              >
                <span className="text-white text-xs font-extrabold">A</span>
              </div>
              <div>
                <p className="text-xs font-extrabold text-[#3D2E1E]">Alice</p>
                <p className="text-[10px] font-semibold text-[#5C8B5C]">Debate Moderator</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-[#E8F5E8] px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5C8B5C]" aria-hidden="true" />
              <span className="text-[10px] font-extrabold text-[#3D6B3D]">
                Turn {turn + 1}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F5F0E8]"
            aria-live="polite"
            aria-atomic="false"
            aria-label="Debate messages"
            role="log"
          >
            {messages.map((msg) => (
              <div key={msg.id} className="animate-fade-in">
                <MessageBubble msg={msg} />
              </div>
            ))}

            {isLoading && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-[#D6C9A8] p-3 bg-[#FFFCF3] flex-shrink-0">
            <div className="flex gap-2 items-end">
              <label htmlFor="debate-input" className="sr-only">
                Type your argument
              </label>
              <textarea
                id="debate-input"
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your argument here... (Enter to send)"
                rows={2}
                disabled={isLoading || debateComplete}
                className="flex-1 resize-none px-4 py-3 rounded-2xl border border-[#D6C9A8] bg-[#F5F0E8] text-[#3D2E1E] font-semibold text-sm placeholder:text-[#9C8B74] focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] focus:border-transparent disabled:opacity-50 min-h-[52px] leading-snug"
                aria-label="Type your debate argument"
                aria-describedby="input-hint"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isLoading || debateComplete}
                className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-bold transition-all ${
                  inputText.trim() && !isLoading && !debateComplete
                    ? 'bg-[#3D6B3D] text-white hover:bg-[#2D5B2D] hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(61,107,61,0.35)]'
                    : 'bg-[#EDE5D4] text-[#9C8B74] cursor-not-allowed'
                }`}
                aria-label="Send argument"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>

            {/* Keyboard hint */}
            <p
              id="input-hint"
              className="text-[10px] text-[#9C8B74] font-medium mt-1.5 ml-1"
              aria-hidden="true"
            >
              Press Enter to send. Shift + Enter for a new line.
            </p>
          </div>
        </section>
      )}

      {/* ── Stage nav hint — shown during active debate ──────────────────── */}
      {debateStage !== 'setup' && !debateComplete && (
        <p className="text-xs text-center text-[#9C8B74] font-semibold pb-2">
          Alice will guide you through all {DEBATE_STAGES.length} stages automatically.
        </p>
      )}
    </div>
  );
}
