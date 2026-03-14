'use client';

/**
 * SessionContext.js
 *
 * Single source of truth for the entire AI session flow.
 * All state variables that were previously scattered across page.js are
 * consolidated here so child components can read and update them without
 * prop-drilling.
 *
 * Architecture:
 *   SessionProvider  — wraps the page, owns all state + logic
 *   useSession()     — hook that any child component calls to get state/actions
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import useSpeech from '@/hooks/useSpeech';
import { STAGE_GUIDE, getCurrentGuideQuestion } from '@/lib/stageQuestions';
import { pauseSession as apiPauseSession } from '@/services/api';
import { getItem } from '@/lib/clientStorage';

// ── Stage constants ────────────────────────────────────────────────────────────
// Internal API stage keys — these are sent to the backend and never changed
export const STAGE_KEYS = ['warm_connection', 'title', 'introduction', 'body', 'conclusion', 'cross_book'];
// Child-friendly display labels shown in the UI
export const STAGES = ["Let's Say Hi!", 'About This Book', 'Meet the Characters', 'Think Deeper', 'My Thoughts', 'Connect the Stories'];
export const STAGE_EMOJIS = ['🌟', '📖', '👤', '💭', '⭐', '🔗'];
// Tree growth emojis for the garden progress bar
export const STAGE_TREE_EMOJIS = ['🌱', '🌿', '🌳', '🌲', '🌸', '🍎'];
export const MAX_TURNS_PER_STAGE = 3;

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
export function getAgeAdaptedStages(studentAge) {
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

// ── Mock data ─────────────────────────────────────────────────────────────────
export const MOCK_AI_RESPONSES = {
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
export const VOCAB_HINTS = {
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
export function detectVocabWord(text, shownWords) {
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

// ── Worksheet rows ─────────────────────────────────────────────────────────────
export const WORKSHEET_ROWS = [
  { stage: "Let's Say Hi!", label: "Let's Say Hi! 🌟", color: '#FF6B6B', icon: '🌟', question: 'What kind of stories do you enjoy?', example: 'e.g. I really love adventure stories because they are so exciting.' },
  { stage: 'About This Book', label: 'About This Book 📖', color: '#5C8B5C', icon: '📖', question: 'What is this book about?', example: 'e.g. This book is about a caterpillar that becomes a butterfly.' },
  { stage: 'Meet the Characters', label: 'Meet the Characters 👤', color: '#87CEDB', icon: '👤', question: 'Who is your favorite character? Why?', example: 'e.g. I would choose the caterpillar because it is brave.' },
  { stage: 'Think Deeper', label: 'Think Deeper ①', color: '#D4A843', icon: '💭', question: 'What is the most important part of the story? Why?', example: 'e.g. The most important part is when the caterpillar eats all the food.', bodyIndex: 0 },
  { stage: 'Think Deeper', label: 'Think Deeper ②', color: '#D4A843', icon: '💭', question: 'What would you change about the story? Why?', example: 'e.g. I would add more animals because it would be more fun.', bodyIndex: 1 },
  { stage: 'Think Deeper', label: 'Think Deeper ③', color: '#D4A843', icon: '💭', question: 'What did you learn from this story?', example: 'e.g. Moreover, I learned that change can be beautiful.', bodyIndex: 2 },
  { stage: 'My Thoughts', label: 'My Thoughts ⭐', color: '#7AC87A', icon: '⭐', question: 'How do you feel about this book?', example: 'e.g. Reading this book was really fun and I learned a lot.' },
  { stage: 'Connect the Stories', label: 'Connect the Stories 🔗', color: '#9B59B6', icon: '🔗', question: 'Does this book remind you of another book?', example: 'e.g. This book reminds me of Charlotte\'s Web because both have animal friends.' },
];

export const SOCRATIC_LOADING_PROMPTS = [
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
export function getWorksheetRowIndex(stageIndex, bodyReasonCount, activeStagesList) {
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

// ── Context ───────────────────────────────────────────────────────────────────
const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const router = useRouter();

  // ── URL / session identity ──────────────────────────────────────────────────
  const [bookId, setBookId] = useState(null);
  const [bookTitle, setBookTitle] = useState('');
  const [session, setSession] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState(null);
  const [studentAvatar, setStudentAvatar] = useState('😊');

  // ── Conversation state ─────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [currentStage, setCurrentStage] = useState(0);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [bodyReasonCount, setBodyReasonCount] = useState(0);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPromptIndex, setLoadingPromptIndex] = useState(0);
  const [error, setError] = useState(null);

  // ── Session lifecycle ──────────────────────────────────────────────────────
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [apiAvailable, setApiAvailable] = useState(true);

  // ── Stage transition ───────────────────────────────────────────────────────
  const [showStageTransition, setShowStageTransition] = useState(false);
  const [nextStageName, setNextStageName] = useState('');
  const [showSkipButton, setShowSkipButton] = useState(false);

  // ── Worksheet ─────────────────────────────────────────────────────────────
  const [stageScores, setStageScores] = useState({});
  const [sessionVocabulary, setSessionVocabulary] = useState([]);
  const [worksheetAnswers, setWorksheetAnswers] = useState({});

  // ── Timer ─────────────────────────────────────────────────────────────────
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [timeMilestone, setTimeMilestone] = useState(null); // 'great-job' | 'wrap-up' | null
  const timerRef = useRef(null);

  // ── Emotion / AI Feedback ─────────────────────────────────────────────────
  const [emotionHistory, setEmotionHistory] = useState([]);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [showAiFeedbackCard, setShowAiFeedbackCard] = useState(false);

  // ── Vocab mini-card ────────────────────────────────────────────────────────
  const [vocabCard, setVocabCard] = useState(null); // null | { word, definition, example }
  const shownVocabWordsRef = useRef(new Set());

  // ── Achievements / Confetti ────────────────────────────────────────────────
  const [showConfetti, setShowConfetti] = useState(false);
  const [pendingAchievements, setPendingAchievements] = useState([]);
  const [showAchievements, setShowAchievements] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const activeRowRef = useRef(null);
  const latestTranscriptRef = useRef('');

  // ── Speech hook ────────────────────────────────────────────────────────────
  const { isListening, transcript, speak, startListening, stopListening, supported } = useSpeech();

  // ── Derived / memoised values ──────────────────────────────────────────────

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

  const activeRowIndex = getWorksheetRowIndex(currentStage, bodyReasonCount, activeStages);

  // ── Utility ────────────────────────────────────────────────────────────────
  const getApiUrl = () => {
    if (typeof window !== 'undefined') {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    }
    return 'http://localhost:3001';
  };

  // ── Effects ────────────────────────────────────────────────────────────────

  // Load student info from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedStudentId = getItem('studentId');
      const storedStudentName = getItem('studentName');
      setStudentId(storedStudentId);
      setStudentName(storedStudentName);
      const savedAvatar = getItem('studentAvatar');
      if (savedAvatar) setStudentAvatar(savedAvatar);
    }
  }, []);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-scroll active worksheet row into view
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

  // Cycle Socratic loading prompts while AI is thinking
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingPromptIndex((prev) => (prev + 1) % SOCRATIC_LOADING_PROMPTS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

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

  // Keep latestTranscriptRef in sync to avoid stale closure race condition
  useEffect(() => {
    latestTranscriptRef.current = transcript;
  }, [transcript]);

  // Silence detection: auto-send after 2 s of no new transcript while listening
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
  }, [transcript, isListening]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core actions ───────────────────────────────────────────────────────────

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
    } catch (err) {
      console.error('Error initializing session:', err);
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
      } catch (err) {
        console.warn('Error completing session on backend:', err);
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
        } catch (err) {
          console.warn('API call failed, falling back to mock:', err);
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
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to get response. Please try again.');
      setLoading(false);
    }
  }, [loading, currentStage, bodyReasonCount, apiAvailable, sessionId, currentTurn, activeStages, processApiResponse, processMockResponse]);

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

  // ── Context value ──────────────────────────────────────────────────────────
  const value = {
    // Identity
    bookId,
    bookTitle,
    session,
    sessionId,
    studentId,
    studentName,
    studentAvatar,
    // Conversation
    messages,
    currentStage,
    currentTurn,
    bodyReasonCount,
    inputText,
    setInputText,
    loading,
    loadingPromptIndex,
    error,
    // Session lifecycle
    sessionComplete,
    sessionStartTime,
    apiAvailable,
    // Stage transition
    showStageTransition,
    nextStageName,
    showSkipButton,
    // Worksheet
    stageScores,
    sessionVocabulary,
    worksheetAnswers,
    activeWorksheetRows,
    activeRowIndex,
    activeRowRef,
    // Timer
    elapsedSeconds,
    elapsedTime,
    showTimeoutWarning,
    setShowTimeoutWarning,
    timeMilestone,
    setTimeMilestone,
    // Emotion / AI Feedback
    emotionHistory,
    aiFeedback,
    showAiFeedbackCard,
    setShowAiFeedbackCard,
    setSessionComplete,
    setShowConfetti,
    // Vocab mini-card
    vocabCard,
    setVocabCard,
    // Achievements / Confetti
    showConfetti,
    pendingAchievements,
    showAchievements,
    setShowAchievements,
    setPendingAchievements,
    // Refs
    messagesEndRef,
    inputRef,
    // Derived / level
    studentLevel,
    studentAge,
    activeStages,
    activeStageEmojis,
    isBeginnerMode,
    isAdvancedMode,
    showTextInput,
    setShowTextInput,
    turnCount,
    maxTurns,
    // Speech
    isListening,
    transcript,
    speak,
    startListening,
    stopListening,
    supported,
    // Actions
    handleSendMessage,
    handleSkipToNextStage,
    handleEmotionReact,
    handlePauseSession,
    handleVoiceInput,
    handleTextSend,
    showStageTransitionAnimation,
    completeSession,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
