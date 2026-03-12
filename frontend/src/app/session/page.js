'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSpeech from '@/hooks/useSpeech';
import VoiceButton from '@/components/VoiceButton';
import { STAGE_GUIDE, getCurrentGuideQuestion } from '@/lib/stageQuestions';
import { pauseSession as apiPauseSession } from '@/services/api';
import { getItem } from '@/lib/clientStorage';
import ConfettiCelebration from '@/components/ConfettiCelebration';
import AchievementUnlock from '@/components/AchievementUnlock';
import VocabMiniCard from '@/components/VocabMiniCard';
import StageProgress from '@/components/StageProgress';

// Internal API stage keys — these are sent to the backend and never changed
const STAGE_KEYS = ['warm_connection', 'title', 'introduction', 'body', 'conclusion', 'cross_book'];
// Child-friendly display labels shown in the UI
const STAGES = ["Let's Say Hi!", 'About This Book', 'Meet the Characters', 'Think Deeper', 'My Thoughts', 'Connect the Stories'];
const STAGE_EMOJIS = ['🌟', '📖', '👤', '💭', '⭐', '🔗'];
// Tree growth emojis for the garden progress bar
const STAGE_TREE_EMOJIS = ['🌱', '🌿', '🌳', '🌲', '🌸', '🍎'];
const MAX_TURNS_PER_STAGE = 3;

/**
 * Returns the subset of STAGES (and matching STAGE_EMOJIS) appropriate for
 * the student's age, following Bloom's Taxonomy progression:
 *
 *  6-8  (Beginner)     → 4 stages: About This Book, Meet the Characters, Think Deeper, My Thoughts
 *  9-11 (Intermediate) → 5 stages: Let's Say Hi! + above (skip Connect the Stories)
 * 12-13 (Advanced)     → 6 stages: all
 *
 * Falls back to all 6 stages when age is unknown.
 */
function getAgeAdaptedStages(studentAge) {
  const age = parseInt(studentAge, 10);

  if (age >= 6 && age <= 8) {
    // Beginner: skip warm_connection and cross_book
    const names = ['About This Book', 'Meet the Characters', 'Think Deeper', 'My Thoughts'];
    return {
      stages: names,
      emojis: names.map((n) => STAGE_EMOJIS[STAGES.indexOf(n)]),
    };
  }

  if (age >= 9 && age <= 11) {
    // Intermediate: skip Connect the Stories only
    const names = ["Let's Say Hi!", 'About This Book', 'Meet the Characters', 'Think Deeper', 'My Thoughts'];
    return {
      stages: names,
      emojis: names.map((n) => STAGE_EMOJIS[STAGES.indexOf(n)]),
    };
  }

  // Advanced (12-13) or unknown age → all 6 stages
  return { stages: [...STAGES], emojis: [...STAGE_EMOJIS] };
}

const MOCK_AI_RESPONSES = {
  "Let's Say Hi!": [
    "Before we dive in, tell me — what was the last really good book you read? What made it so special?",
    "What kind of stories do you like the most — funny, scary, adventure, or something else?",
    "When you first saw the cover of this book, what did you think it would be about?",
  ],
  'About This Book': [
    "What do you think the title means? Why did the author choose this title?",
    "That's interesting! Can you tell me more about why you feel that way?",
    "Great observation! Now, what do you think might happen in this story based on the title?",
  ],
  'Meet the Characters': [
    "Who is the main character in the story? How would you describe them?",
    "Can you tell me about the setting? Where does the story take place?",
    "What do you think the main character wants or needs?",
  ],
  'Think Deeper': [
    "Can you give me three reasons why you think that? Let's start with your first reason.",
    "That's a great first reason. Now, what would be your second reason?",
    "Excellent! And your third reason would be...?",
  ],
  'My Thoughts': [
    "What did this book teach you? What was the most important lesson?",
    "Would you recommend this book to a friend? Why or why not?",
    "If you could change one thing in the story, what would it be?",
  ],
  'Connect the Stories': [
    "Does this book remind you of any other book you have read? How are they similar?",
    "If the main character from this book met a character from another book you love, what do you think they would talk about?",
    "You have read so many stories now! What kind of reader do you think you are becoming?",
  ],
};

// ── Vocabulary detection database ─────────────────────────────────────────────
// A lightweight dictionary of advanced/interesting words that HiAlice might use.
// When one of these words is detected in an AI response the VocabMiniCard overlay
// is shown so the child can learn it in context (Krashen's i+1 principle).
const VOCAB_HINTS = {
  metamorphosis:  { definition: 'A big change in form or shape', example: 'The caterpillar went through metamorphosis to become a beautiful butterfly.' },
  protagonist:    { definition: 'The main character in a story', example: 'Charlotte is the protagonist who saves Wilbur the pig.' },
  courageous:     { definition: 'Being brave even when you feel scared', example: 'The knight was courageous when facing the fearsome dragon.' },
  perseverance:   { definition: 'Keeping going even when things are hard', example: 'Her perseverance helped her finish the marathon.' },
  compassionate:  { definition: 'Caring deeply about how others feel', example: 'The teacher was compassionate when the student cried.' },
  tremendous:     { definition: 'Extremely large or impressive', example: 'The volcano made a tremendous noise when it erupted.' },
  magnificent:    { definition: 'Very beautiful or impressive', example: 'The castle was magnificent, shining in the morning sun.' },
  triumphant:     { definition: 'Feeling very happy after winning or succeeding', example: 'She felt triumphant when she solved the puzzle.' },
  melancholy:     { definition: 'A feeling of sadness that lasts a while', example: 'There was a melancholy look on his face after saying goodbye.' },
  bewildered:     { definition: 'Totally confused and surprised', example: 'The puppy looked bewildered the first time it saw snow.' },
  exhilarating:   { definition: 'Exciting in a way that makes you feel alive', example: 'Riding the roller-coaster was exhilarating!' },
  determined:     { definition: 'Firmly decided to do something no matter what', example: 'She was determined to read every book in the library.' },
  imagination:    { definition: 'The ability to think of new ideas and pictures in your mind', example: 'His imagination helped him invent a flying bicycle.' },
  adventure:      { definition: 'An exciting and often dangerous experience', example: 'Their adventure through the jungle was full of surprises.' },
  curiosity:      { definition: 'A strong wish to know or learn about something', example: 'Curiosity led Alice down the rabbit hole.' },
};

/**
 * detectVocabWord
 * Scans `text` for any word from VOCAB_HINTS that has not been shown yet.
 * Returns the first match found, or null if none.
 *
 * @param {string}   text          - AI response text to scan
 * @param {Set}      shownWords    - Words already shown this session
 * @returns {{ word: string, definition: string, example: string } | null}
 */
function detectVocabWord(text, shownWords) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [word, data] of Object.entries(VOCAB_HINTS)) {
    if (shownWords.has(word)) continue;
    // Match whole-word occurrences only (avoid matching "courage" inside "courageous" etc.)
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lower)) {
      return { word, ...data };
    }
  }
  return null;
}

const WORKSHEET_ROWS = [
  { stage: "Let's Say Hi!", label: "Let's Say Hi! 🌟", color: '#FF6B6B', icon: '🌟', question: 'What kind of stories do you enjoy?', example: 'e.g. I really love adventure stories because they are so exciting.' },
  { stage: 'About This Book', label: 'About This Book 📖', color: '#5C8B5C', icon: '📖', question: 'What is this book about?', example: 'e.g. This book is about a caterpillar that becomes a butterfly.' },
  { stage: 'Meet the Characters', label: 'Meet the Characters 👤', color: '#87CEDB', icon: '👤', question: 'Who is your favorite character? Why?', example: 'e.g. I would choose the caterpillar because it is brave.' },
  { stage: 'Think Deeper', label: 'Think Deeper ①', color: '#D4A843', icon: '💭', question: 'What is the most important part of the story? Why?', example: 'e.g. The most important part is when the caterpillar eats all the food.', bodyIndex: 0 },
  { stage: 'Think Deeper', label: 'Think Deeper ②', color: '#D4A843', icon: '💭', question: 'What would you change about the story? Why?', example: 'e.g. I would add more animals because it would be more fun.', bodyIndex: 1 },
  { stage: 'Think Deeper', label: 'Think Deeper ③', color: '#D4A843', icon: '💭', question: 'What did you learn from this story?', example: 'e.g. Moreover, I learned that change can be beautiful.', bodyIndex: 2 },
  { stage: 'My Thoughts', label: 'My Thoughts ⭐', color: '#7AC87A', icon: '⭐', question: 'How do you feel about this book?', example: 'e.g. Reading this book was really fun and I learned a lot.' },
  { stage: 'Connect the Stories', label: 'Connect the Stories 🔗', color: '#9B59B6', icon: '🔗', question: 'Does this book remind you of another book?', example: 'e.g. This book reminds me of Charlotte\'s Web because both have animal friends.' },
];

const SOCRATIC_LOADING_PROMPTS = [
  'That is a thoughtful start. I am shaping the next question for you.',
  'Let me think about your idea for a moment. I want to ask something that helps you go deeper.',
  'You said something important. I am finding the next gentle question.',
  'Nice thinking. I am connecting your answer to the next part of the story.',
];

/**
 * Maps the current stageIndex (into activeStages) and bodyReasonCount to the
 * matching row index in the filtered ACTIVE_WORKSHEET_ROWS array.
 *
 * The worksheet has one row per stage EXCEPT Think Deeper which has 3 rows.
 * So for stages before Think Deeper each contributes 1 row, Think Deeper contributes 3.
 */
function getWorksheetRowIndex(stageIndex, bodyReasonCount, activeStagesList) {
  const stage = activeStagesList[stageIndex];
  let rowIndex = 0;
  for (let i = 0; i < stageIndex; i++) {
    rowIndex += activeStagesList[i] === 'Think Deeper' ? 3 : 1;
  }
  if (stage === 'Think Deeper') {
    rowIndex += Math.min(bodyReasonCount, 2);
  }
  return rowIndex;
}

export default function SessionPage() {
  const router = useRouter();

  // Read URL params directly from window.location.search to avoid
  // useSearchParams() + Suspense complexity that prevented useEffect from firing.
  const [bookId, setBookId] = useState(null);
  const [bookTitle, setBookTitle] = useState('');

  const [session, setSession] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentStage, setCurrentStage] = useState(0);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [bodyReasonCount, setBodyReasonCount] = useState(0);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [showStageTransition, setShowStageTransition] = useState(false);
  const [nextStageName, setNextStageName] = useState('');
  const [apiAvailable, setApiAvailable] = useState(true);
  const [stageScores, setStageScores] = useState({});
  const [sessionVocabulary, setSessionVocabulary] = useState([]);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [error, setError] = useState(null);
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [worksheetAnswers, setWorksheetAnswers] = useState({});
  const [loadingPromptIndex, setLoadingPromptIndex] = useState(0);

  // Phase 2B: emotion reactions, session timer, timeout warning, AI feedback
  const [emotionHistory, setEmotionHistory] = useState([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  // Vocabulary mini-card state — shows just-in-time word learning overlay
  const [vocabCard, setVocabCard] = useState(null); // null | { word, definition, example }
  const shownVocabWordsRef = useRef(new Set());
  // P3-UX-07: Gentle time milestone notifications (15 min, 25 min)
  const [timeMilestone, setTimeMilestone] = useState(null); // 'great-job' | 'wrap-up' | null
  const [aiFeedback, setAiFeedback] = useState(null);
  const [showAiFeedbackCard, setShowAiFeedbackCard] = useState(false);
  const timerRef = useRef(null);

  // Level-based UI: determine student level from sessionStorage once (stable across renders)
  // Returns 'beginner' | 'intermediate' | 'advanced'
  const studentLevel = useMemo(() => {
    if (typeof window === 'undefined') return 'intermediate';
    return getItem('studentLevel') || 'intermediate';
  }, []);

  // Age-adaptive stages: read studentAge once and derive the filtered stage list.
  // This is the single source of truth for how many stages this student will see.
  const studentAge = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return getItem('studentAge');
  }, []);

  const { stages: activeStages, emojis: activeStageEmojis } = useMemo(
    () => getAgeAdaptedStages(studentAge),
    [studentAge]
  );

  // Build the worksheet row list filtered to only the active stages.
  // Body always expands to 3 sub-rows; all other stages get 1 row each.
  const activeWorksheetRows = useMemo(() => {
    return activeStages.flatMap((stageName) => {
      return WORKSHEET_ROWS.filter((r) => r.stage === stageName);
    });
  }, [activeStages]);

  // Convenience booleans for level branching
  const isBeginnerMode = studentLevel === 'beginner';
  const isAdvancedMode = studentLevel === 'advanced';

  // For beginners, text input is hidden by default; others see it immediately.
  // useState lazy initialiser runs once so it safely reads sessionStorage on mount.
  const [showTextInput, setShowTextInput] = useState(() => {
    if (typeof window === 'undefined') return true;
    return (getItem('studentLevel') || 'intermediate') !== 'beginner';
  });

  // Confetti + achievement state
  const [showConfetti, setShowConfetti] = useState(false);
  const [pendingAchievements, setPendingAchievements] = useState([]);
  const [showAchievements, setShowAchievements] = useState(false);

  const { isListening, transcript, speak, startListening, stopListening, supported } = useSpeech();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const activeRowRef = useRef(null);

  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedStudentId = getItem('studentId');
      const storedStudentName = getItem('studentName');
      setStudentId(storedStudentId);
      setStudentName(storedStudentName);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentStage, bodyReasonCount]);

  // Session timer — starts when component mounts
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // P3-UX-07: Gentle time milestones (15 min & 25 min) + 30-minute timeout dialog
  useEffect(() => {
    if (elapsedSeconds === 900) {
      // 15 minutes — encouraging "great job" banner
      setTimeMilestone('great-job');
      // Auto-dismiss after 6 seconds so it doesn't distract
      setTimeout(() => setTimeMilestone((prev) => prev === 'great-job' ? null : prev), 6000);
    } else if (elapsedSeconds === 1500) {
      // 25 minutes — gentle wrap-up nudge
      setTimeMilestone('wrap-up');
      setTimeout(() => setTimeMilestone((prev) => prev === 'wrap-up' ? null : prev), 8000);
    } else if (elapsedSeconds === 1800) {
      // 30 minutes — full timeout warning dialog
      setShowTimeoutWarning(true);
    }
  }, [elapsedSeconds]);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingPromptIndex((prev) => (prev + 1) % SOCRATIC_LOADING_PROMPTS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

  const elapsedTime = useMemo(() => {
    const m = Math.floor(elapsedSeconds / 60);
    const s = elapsedSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, [elapsedSeconds]);

  // Derived turn count within the current stage (1-indexed for display).
  // Use stage name comparison so the count is correct for any filtered stage list.
  const turnCount = activeStages[currentStage] === 'Think Deeper'
    ? bodyReasonCount + 1
    : currentTurn + 1;
  const maxTurns = MAX_TURNS_PER_STAGE;

  const getApiUrl = () => {
    if (typeof window !== 'undefined') {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    }
    return 'http://localhost:3001';
  };

  const activeRowIndex = getWorksheetRowIndex(currentStage, bodyReasonCount, activeStages);

  // Read URL search params from window.location.search on mount.
  // Using window.location.search directly avoids useSearchParams() + Suspense
  // boundary issues that prevented effects from firing in Next.js 14 App Router.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('bookId');
    const title = params.get('bookTitle') || 'the book';
    const urlSessionId = params.get('sessionId');
    console.log('[HiMax] mount: bookId =', id, 'bookTitle =', title, 'sessionId =', urlSessionId);
    setBookId(id);
    setBookTitle(title);
    // If books page already created a real session, reuse it
    if (urlSessionId) {
      setSessionId(urlSessionId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Kick off the session once bookId is known (set by the mount effect above).
  useEffect(() => {
    if (!bookId) return;
    console.log('[HiMax] bookId ready, calling initializeSession:', bookId);
    initializeSession();
  }, [bookId]); // eslint-disable-line react-hooks/exhaustive-deps

  const initializeSession = async () => {
    console.log('[HiMax] initializeSession called, bookId:', bookId, 'bookTitle:', bookTitle, 'sessionId:', sessionId);

    // Read student info directly from sessionStorage so we don't rely on
    // React state that may still be null if both mount effects haven't flushed.
    const resolvedStudentId =
      studentId ?? (typeof window !== 'undefined' ? getItem('studentId') : null);

    // Also fall back to sessionStorage for bookId/bookTitle in case URL params are absent.
    const resolvedBookId =
      bookId ?? (typeof window !== 'undefined' ? getItem('bookId') : null);
    const resolvedBookTitle =
      bookTitle || (typeof window !== 'undefined' ? getItem('bookTitle') : '') || 'the book';

    try {
      setSessionStartTime(new Date());

      // If sessionId was already passed via URL (created by books page), skip creation
      if (sessionId) {
        console.log('[HiMax] Reusing session from URL:', sessionId);
        setApiAvailable(true);
      } else {
        // No sessionId from URL — create one via API
        const apiUrl = getApiUrl();
        try {
          const response = await fetch(`${apiUrl}/api/sessions/start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(typeof window !== 'undefined' && getItem('token')
                ? { Authorization: `Bearer ${getItem('token')}` }
                : {}),
            },
            body: JSON.stringify({
              studentId: resolvedStudentId,
              bookId: resolvedBookId,
              bookTitle: resolvedBookTitle,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            setSessionId(data.session?.id || data.sessionId || data.id);
            setApiAvailable(true);
          } else {
            console.warn('API returned non-OK status, using mock session:', response.status);
            setApiAvailable(false);
            setSessionId('demo-session-' + Date.now());
          }
        } catch (fetchError) {
          console.warn('API unavailable, using mock responses:', fetchError);
          setApiAvailable(false);
          setSessionId('demo-session-' + Date.now());
        }
      }

      // Choose the opening message based on the first active stage for this student.
      // Beginners start at "About This Book" (Title), so skip the warm-up question.
      const firstStage = activeStages[0];
      const firstStageQuestion = MOCK_AI_RESPONSES[firstStage]?.[0] || '';
      const openingContent = firstStage === "Let's Say Hi!"
        ? `Hello! I'm so excited to talk about "${resolvedBookTitle}"! Before we dive in, tell me — what was the last really good book you read? What made it special?`
        : `Hello! I'm so excited to talk about "${resolvedBookTitle}"! ${firstStageQuestion}`;

      const initialMessage = {
        id: 0,
        speaker: 'alice',
        content: openingContent,
        timestamp: new Date(),
        stage: firstStage,
      };
      setMessages([initialMessage]);
      speak(openingContent);
      setShowSkipButton(true);
    } catch (error) {
      console.error('Error initializing session:', error);
      setApiAvailable(false);
      setSessionId('demo-session-' + Date.now());
      setError("Oops! Something went a little wrong. I'll use my notes instead!");
      const firstStage = activeStages[0];
      const firstStageQuestion = MOCK_AI_RESPONSES[firstStage]?.[0] || '';
      const openingContent = firstStage === "Let's Say Hi!"
        ? `Hello! I'm so excited to talk about "${resolvedBookTitle}"! Before we dive in, tell me — what was the last really good book you read? What made it special?`
        : `Hello! I'm so excited to talk about "${resolvedBookTitle}"! ${firstStageQuestion}`;
      const fallbackMessage = {
        id: 0,
        speaker: 'alice',
        content: openingContent,
        timestamp: new Date(),
        stage: firstStage,
      };
      setMessages([fallbackMessage]);
    }
  };

  // This callback intentionally follows the latest stage/session helpers.
  // Keeping it scoped here avoids stale conversation state during stage jumps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const processApiResponse = useCallback(async (data) => {
    const aliceMessage = {
      id: Date.now() + 1,
      speaker: 'alice',
      content: data.reply?.content || data.content || data.message,
      timestamp: new Date(),
      stage: activeStages[currentStage],
    };

    setMessages((prev) => [...prev, aliceMessage]);
    speak(aliceMessage.content);

    if (data.vocabulary && Array.isArray(data.vocabulary)) {
      setSessionVocabulary((prev) => [...prev, ...data.vocabulary]);
    }

    // Just-in-Time vocabulary: scan the AI reply for interesting words
    const vocabHit = detectVocabWord(
      data.reply?.content || data.content || data.message || '',
      shownVocabWordsRef.current
    );
    if (vocabHit) {
      shownVocabWordsRef.current = new Set([...shownVocabWordsRef.current, vocabHit.word]);
      // Small delay so the AI message appears in the chat before the card pops up
      setTimeout(() => setVocabCard(vocabHit), 600);
    }

    if (data.grammarScore !== undefined) {
      setStageScores((prev) => ({
        ...prev,
        [activeStages[currentStage]]: data.grammarScore,
      }));
    }

    if (data.shouldAdvance && data.nextStage) {
      // Map nextStage name to index within the filtered activeStages list
      const nextStageIndex = activeStages.indexOf(data.nextStage);
      if (nextStageIndex > currentStage) {
        showStageTransitionAnimation(data.nextStage, nextStageIndex);
      }
    } else {
      if (activeStages[currentStage] === 'Think Deeper') {
        setBodyReasonCount((prev) => prev + 1);
      }
      setCurrentTurn((prev) => prev + 1);
    }

    setLoading(false);
  }, [activeStages, currentStage, showStageTransitionAnimation, speak]);

  // This callback also needs the latest stage completion helpers so mock flow
  // stays in sync with the active worksheet stage.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const processMockResponse = useCallback(async (content, reasonCount = 0) => {
    const aliceMessage = {
      id: Date.now() + 2,
      speaker: 'alice',
      content,
      timestamp: new Date(),
      stage: activeStages[currentStage],
    };

    setMessages((prev) => [...prev, aliceMessage]);
    speak(content);

    // Just-in-Time vocabulary: scan mock AI response for interesting words
    const vocabHit = detectVocabWord(content, shownVocabWordsRef.current);
    if (vocabHit) {
      shownVocabWordsRef.current = new Set([...shownVocabWordsRef.current, vocabHit.word]);
      setTimeout(() => setVocabCard(vocabHit), 600);
    }

    const nextTurn = currentTurn + 1;

    let shouldAdvance = false;
    if (activeStages[currentStage] === 'Think Deeper') {
      shouldAdvance = reasonCount >= 3;
      setBodyReasonCount(reasonCount);
    } else {
      shouldAdvance = nextTurn >= MAX_TURNS_PER_STAGE;
    }

    if (shouldAdvance) {
      const nextStageIndex = currentStage + 1;
      if (nextStageIndex < activeStages.length) {
        showStageTransitionAnimation(activeStages[nextStageIndex], nextStageIndex);
      } else {
        completeSession();
      }
    } else {
      setCurrentTurn(nextTurn);
    }

    setLoading(false);
  }, [activeStages, currentStage, currentTurn, completeSession, showStageTransitionAnimation, speak]);

  const handleSendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;

    setError(null);
    setLoading(true);

    const studentMessage = {
      id: Date.now(),
      speaker: 'student',
      content: text,
      timestamp: new Date(),
      stage: activeStages[currentStage],
    };

    setMessages((prev) => [...prev, studentMessage]);
    setInputText('');

    const rowIdx = getWorksheetRowIndex(currentStage, bodyReasonCount, activeStages);
    setWorksheetAnswers((prev) => ({
      ...prev,
      [rowIdx]: text,
    }));

    try {
      if (apiAvailable && sessionId) {
        try {
          const apiUrl = getApiUrl();
          const response = await fetch(`${apiUrl}/api/sessions/${sessionId}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: text,
              // Map active display label back to the internal API key for the backend
              stage: STAGE_KEYS[STAGES.indexOf(activeStages[currentStage])] || activeStages[currentStage],
            }),
          });

          if (!response.ok) {
            throw new Error(`API response ${response.status}`);
          }

          const data = await response.json();
          await processApiResponse(data);
          return;
        } catch (error) {
          console.warn('API call failed, falling back to mock:', error);
          setApiAvailable(false);
          setError("I'm using my memory today! Let's keep going!");
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 800));
      const stageName = activeStages[currentStage];
      const stageQuestions = MOCK_AI_RESPONSES[stageName];

      const mockIndex = currentTurn + 1;
      const nextQuestion =
        mockIndex < stageQuestions.length
          ? stageQuestions[mockIndex]
          : "That was wonderful! Let's move to the next topic.";

      let reasonCount = bodyReasonCount;
      if (stageName === 'Think Deeper') {
        reasonCount = currentTurn + 1;
      }

      await processMockResponse(nextQuestion, reasonCount);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to get response. Please try again.');
      setLoading(false);
    }
  }, [loading, currentStage, bodyReasonCount, apiAvailable, sessionId, currentTurn, activeStages, processApiResponse, processMockResponse]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  function showStageTransitionAnimation(stageName, stageIndex) {
    setNextStageName(stageName);
    setShowStageTransition(true);

    setTimeout(() => {
      setCurrentStage(stageIndex);
      setCurrentTurn(0);
      setBodyReasonCount(0);
      setShowStageTransition(false);

      const transitionMessage = {
        id: Date.now(),
        speaker: 'alice',
        content: `Great! Now let's move to the ${stageName} section. I have some new questions for you.`,
        timestamp: new Date(),
        isTransition: true,
        stage: stageName,
      };

      // In mock mode (or as a fallback), immediately follow the transition
      // message with the first question of the new stage so the student always
      // sees an opening question and the mock index stays in sync (currentTurn=0
      // → respond with stageQuestions[0] on the first student message).
      const firstQuestion = MOCK_AI_RESPONSES[stageName]?.[0];
      const firstQuestionMessage = firstQuestion
        ? {
            id: Date.now() + 1,
            speaker: 'alice',
            content: firstQuestion,
            timestamp: new Date(),
            stage: stageName,
          }
        : null;

      setMessages((prev) => {
        const updated = [...prev, transitionMessage];
        if (firstQuestionMessage) updated.push(firstQuestionMessage);
        return updated;
      });

      // Speak transition + first question as a single utterance to prevent
      // voice changes or overlap between two separate speak() calls.
      const fullText = firstQuestion
        ? `Great! Now let's move to the ${stageName} section. ${firstQuestion}`
        : `Great! Now let's move to the ${stageName} section. I have some new questions for you.`;
      speak(fullText);
    }, 1500);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  async function completeSession() {
    const duration = sessionStartTime
      ? Math.round((new Date() - sessionStartTime) / 1000)
      : 0;

    // Stop the session timer
    clearInterval(timerRef.current);

    let capturedAiFeedback = null;

    if (apiAvailable && sessionId) {
      try {
        const apiUrl = getApiUrl();
        const completeRes = await fetch(`${apiUrl}/api/sessions/${sessionId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messages.filter((m) => m.speaker === 'student').length,
            duration,
          }),
        });

        if (completeRes.ok) {
          const completeData = await completeRes.json();
          // Capture ai_feedback if returned by the backend
          capturedAiFeedback = completeData.ai_feedback || completeData.aiFeedback || null;
          // Capture achievements if returned
          const achievementsEarned = completeData.achievements || completeData.achievementsEarned || [];
          if (achievementsEarned.length > 0) {
            setPendingAchievements(achievementsEarned);
            setShowAchievements(true);
          }
        }
      } catch (error) {
        console.warn('Error completing session on backend:', error);
      }
    }

    // Show AI feedback card before transitioning to the completion screen
    if (capturedAiFeedback) {
      setAiFeedback(capturedAiFeedback);
      setShowAiFeedbackCard(true);
      // Auto-dismiss after 6 seconds and then show the completion screen
      setTimeout(() => {
        setShowAiFeedbackCard(false);
        setSessionComplete(true);
        setShowConfetti(true);
      }, 6000);
    } else {
      setSessionComplete(true);
      setShowConfetti(true);
    }
  }

  const handleSkipToNextStage = () => {
    if (currentStage < activeStages.length - 1) {
      showStageTransitionAnimation(activeStages[currentStage + 1], currentStage + 1);
    } else {
      completeSession();
    }
  };

  // Phase 2B: Record emoji emotion reaction (fire-and-forget)
  const handleEmotionReact = useCallback((emoji) => {
    const lastAliceMsg = messages.filter((m) => m.speaker === 'alice').at(-1);
    if (lastAliceMsg) {
      setEmotionHistory((prev) => [
        ...prev,
        { emoji, messageId: lastAliceMsg.id, timestamp: Date.now() },
      ]);
    }
  }, [messages]);

  // Phase 2B: Pause session and redirect to /books
  const handlePauseSession = useCallback(async () => {
    setShowTimeoutWarning(false);
    if (sessionId) {
      try {
        await apiPauseSession(sessionId);
      } catch (err) {
        console.warn('Pause session API failed (continuing with redirect):', err);
      }
    }

    // Persist paused session info locally so the home page and dashboard
    // can surface a "Continue Review" card without an API round-trip.
    if (typeof window !== 'undefined') {
      const pausedInfo = {
        sessionId,
        bookId,
        bookTitle,
        stage: activeStages[currentStage] || 'In Progress',
        stageKey: STAGE_KEYS[STAGES.indexOf(activeStages[currentStage])] || '',
        stageIndex: currentStage,
        pausedAt: new Date().toISOString(),
        studentId: getItem('studentId'),
      };
      try {
        window.localStorage.setItem('pausedSession', JSON.stringify(pausedInfo));
      } catch (_) {
        // localStorage may be unavailable in private browsing
      }
    }

    router.push('/books');
  }, [sessionId, bookId, bookTitle, currentStage, activeStages, router]);

  // Use a ref to read the latest transcript synchronously — avoids the race
  // condition where React state `transcript` hasn't updated yet when
  // stopListening fires its callback in the same tick.
  const latestTranscriptRef = useRef('');
  useEffect(() => {
    latestTranscriptRef.current = transcript;
  }, [transcript]);

  const handleVoiceInput = () => {
    if (isListening) {
      stopListening();
      // Read from ref to get the most recent value
      const finalText = latestTranscriptRef.current;
      if (finalText && finalText.trim()) {
        handleSendMessage(finalText);
      }
    } else {
      startListening();
    }
  };

  const handleTextSend = () => {
    if (inputText.trim()) {
      handleSendMessage(inputText);
    }
  };

  useEffect(() => {
    if (isListening && transcript && transcript.trim()) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      silenceTimerRef.current = setTimeout(() => {
        if (transcript.trim()) {
          handleSendMessage(transcript);
          stopListening();
        }
      }, 2000);
    }

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [transcript, isListening, handleSendMessage, stopListening]);

  // Phase 2B: AI Feedback preview card shown immediately after session ends
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

  return (
    <div className="flex min-h-[calc(100dvh-120px)] flex-col bg-[#F5F0E8] lg:h-[calc(100vh-120px)] lg:flex-row">
      {/* Stage Transition Overlay */}
      {showStageTransition && (
        <div className="fixed inset-0 bg-[#3D6B3D] bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="ghibli-card p-8 shadow-lg animate-bounce">
            <div className="text-3xl text-center mb-3 float-animation">🌿</div>
            <p className="text-base font-bold text-[#3D2E1E]">
              Moving to:{' '}
              <span className="text-[#5C8B5C]">{nextStageName}</span>
            </p>
          </div>
        </div>
      )}

      {/* Phase 2B: 30-minute timeout warning dialog */}
      {showTimeoutWarning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="ghibli-card p-6 max-w-sm mx-4 text-center">
            <div className="text-4xl mb-3">💤</div>
            <h3 className="text-lg font-bold text-[#3D2E1E] mb-2">Need a break?</h3>
            <p className="text-sm text-[#6B5744] mb-4">
              You&apos;ve been reviewing for 30 minutes! Great job! Want to save and come back later?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handlePauseSession}
                className="flex-1 bg-[#D4A843] text-white rounded-xl py-2 text-sm font-medium min-h-[48px]"
                aria-label="Save your progress and exit"
              >
                Save &amp; Exit 💾
              </button>
              <button
                onClick={() => setShowTimeoutWarning(false)}
                className="flex-1 bg-[#5C8B5C] text-white rounded-xl py-2 text-sm font-medium min-h-[48px]"
                aria-label="Continue the session"
              >
                Keep Going! 💪
              </button>
            </div>
          </div>
        </div>
      )}

      {/* P3-UX-07: Gentle time milestone notifications */}
      {timeMilestone && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 animate-fade-in">
          <div className={`rounded-2xl px-6 py-3 shadow-lg border-2 flex items-center gap-3 max-w-sm ${
            timeMilestone === 'great-job'
              ? 'bg-[#FFF8E0] border-[#FDE047] text-[#854D0E]'
              : 'bg-[#EDE9FE] border-[#C4B5FD] text-[#5B21B6]'
          }`}>
            <span className="text-2xl flex-shrink-0" aria-hidden="true">
              {timeMilestone === 'great-job' ? '🌟' : '📚'}
            </span>
            <div>
              <p className="text-sm font-bold">
                {timeMilestone === 'great-job'
                  ? "You've been reviewing for 15 minutes! Great job!"
                  : "Almost done! Let's wrap up your thoughts."}
              </p>
              {timeMilestone === 'great-job' && (
                <p className="text-xs mt-0.5 opacity-80">Keep up the great work!</p>
              )}
            </div>
            <button
              onClick={() => setTimeMilestone(null)}
              className="ml-auto text-lg opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ===== LEFT: Worksheet Frame ===== */}
      <div className="w-full max-h-[260px] overflow-y-auto border-r border-[#D6C9A8] bg-[#FFFCF3] shadow-[2px_0_12px_rgba(61,46,30,0.06)] flex-shrink-0 lg:h-full lg:w-80 lg:max-h-none">
        {/* Worksheet Header */}
        <div className="bg-[linear-gradient(180deg,#6B9A6B_0%,#5C8B5C_100%)] text-white px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
          <span className="text-xl" aria-hidden="true">📝</span>
          <div>
            <h2 className="font-extrabold text-sm">My Reading Notes</h2>
            <p className="text-xs text-white/80 truncate">{bookTitle || 'Book Title'}</p>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={handleSkipToNextStage}
              className="ml-auto px-2 py-1 text-xs font-bold bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors"
              title="Skip to next stage (dev only)"
            >
              Skip →
            </button>
          )}
        </div>

        {/* Tree Garden Progress Bar */}
        <div className="bg-[#F5F0E8] border-b border-[#D6C9A8] px-2 pb-1">
          <StageProgress currentStage={currentStage} stages={activeStages} />
        </div>

        {/* Worksheet Table */}
        <div className="divide-y divide-[#EDE5D4]">
          {activeWorksheetRows.map((row, idx) => {
            const isActive = idx === activeRowIndex;
            const isCompleted = idx < activeRowIndex;
            const answer = worksheetAnswers[idx];

            return (
              <div
                key={idx}
                ref={isActive ? activeRowRef : null}
                className={`transition-all duration-300 ${
                  isActive
                    ? 'bg-[#E8F5E8] border-l-4 border-[#5C8B5C]'
                    : isCompleted
                    ? 'bg-[#C8E6C9] bg-opacity-40 border-l-4 border-[#7AC87A]'
                    : 'bg-[#F5F0E8] border-l-4 border-transparent opacity-60'
                }`}
              >
                {/* Row Header */}
                <div className="flex items-center gap-2 px-3 py-3">
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-extrabold flex-shrink-0"
                    style={{ backgroundColor: isCompleted ? '#7AC87A' : row.color }}
                  >
                    {isCompleted ? '✓' : row.icon}
                  </span>
                  <span
                    className="text-xs font-extrabold uppercase tracking-wide"
                    style={{ color: isCompleted ? '#5C8B5C' : row.color }}
                  >
                    {row.label}
                  </span>
                  {isActive && (
                    <span className="ml-auto text-xs text-[#5C8B5C] font-bold animate-pulse">
                      Now
                    </span>
                  )}
                </div>

                <div className="px-3 pb-3">
                  {answer ? (
                    <div className="rounded-xl border border-[#C8E6C9] bg-[#FFFCF3] px-3 py-2 text-xs font-semibold text-[#5C8B5C] shadow-sm">
                      {answer.length > 80 ? `${answer.substring(0, 80)}...` : answer}
                    </div>
                  ) : (
                    <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                      isActive ? 'bg-[#FFFCF3] text-[#3D2E1E] border border-[#C8E6C9]' : 'bg-[#FFF8E8] text-[#8D6E63]'
                    }`}>
                      {isActive ? 'Alice is talking with you about this part now.' : 'Your conversation will appear here.'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Summary */}
        <div className="sticky bottom-0 bg-[#FFFCF3] border-t border-[#D6C9A8] px-4 py-3">
          <div className="flex items-center justify-between text-xs text-[#6B5744] mb-1">
            <span className="font-bold">Progress</span>
            <span className="font-extrabold text-[#5C8B5C]">
              {Object.keys(worksheetAnswers).length} / {activeWorksheetRows.length}
            </span>
          </div>
          <div className="w-full bg-[#EDE5D4] rounded-full h-2">
            <div
              className="bg-[#5C8B5C] h-2 rounded-full transition-all duration-500"
              style={{ width: `${(Object.keys(worksheetAnswers).length / activeWorksheetRows.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

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
        <div className="bg-[#FFFCF3] border-t border-[#D6C9A8] p-4 space-y-3 flex-shrink-0 shadow-[0_-4px_12px_rgba(61,46,30,0.06)]">
          {/* Stage + Turn progress indicator */}
          <div className="flex items-center justify-between mb-2 px-1" aria-label="Session progress">
            <span className="text-xs font-medium text-[#5C8B5C] bg-[#E8F5E8] px-3 py-1 rounded-full">
              {isBeginnerMode
                ? `${activeStageEmojis[currentStage] || '🌟'} Step ${currentStage + 1} of ${activeStages.length}`
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
            <p className="text-xs text-[#D4A843] text-center font-semibold">
              Voice input not supported on this device. Please use text input.
            </p>
          )}

          {!apiAvailable && (
            <p className="text-xs text-[#6B5744] text-center font-medium">
              I&apos;m using my memory today! Let&apos;s keep going! 🌿
            </p>
          )}
        </div>
      </div>

      {/* Confetti celebration — fires when session completes */}
      <ConfettiCelebration
        active={showConfetti}
        duration={4000}
        onComplete={() => setShowConfetti(false)}
      />

      {/* Achievement modal — shows unlocked badges sequentially */}
      <AchievementUnlock
        achievements={pendingAchievements}
        onClose={() => {
          setShowAchievements(false);
          setPendingAchievements([]);
        }}
      />

      {/* Just-in-Time vocabulary mini-card — slides up when a new word is detected */}
      {vocabCard && (
        <VocabMiniCard
          word={vocabCard.word}
          definition={vocabCard.definition}
          example={vocabCard.example}
          onDismiss={() => setVocabCard(null)}
        />
      )}
    </div>
  );
}
