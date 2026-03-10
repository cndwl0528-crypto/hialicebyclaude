'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSpeech from '@/hooks/useSpeech';
import VoiceButton from '@/components/VoiceButton';
import { STAGE_GUIDE, getCurrentGuideQuestion } from '@/lib/stageQuestions';
import { pauseSession as apiPauseSession } from '@/services/api';
import ConfettiCelebration from '@/components/ConfettiCelebration';
import AchievementUnlock from '@/components/AchievementUnlock';

const STAGES = ['Warm Connection', 'Title', 'Introduction', 'Body', 'Conclusion', 'Cross Book'];
const STAGE_EMOJIS = ['🌟', '📖', '👤', '💭', '⭐', '🔗'];
const MAX_TURNS_PER_STAGE = 3;

const MOCK_AI_RESPONSES = {
  'Warm Connection': [
    "Before we dive in, tell me — what was the last really good book you read? What made it so special?",
    "What kind of stories do you like the most — funny, scary, adventure, or something else?",
    "When you first saw the cover of this book, what did you think it would be about?",
  ],
  Title: [
    "What do you think the title means? Why did the author choose this title?",
    "That's interesting! Can you tell me more about why you feel that way?",
    "Great observation! Now, what do you think might happen in this story based on the title?",
  ],
  Introduction: [
    "Who is the main character in the story? How would you describe them?",
    "Can you tell me about the setting? Where does the story take place?",
    "What do you think the main character wants or needs?",
  ],
  Body: [
    "Can you give me three reasons why you think that? Let's start with your first reason.",
    "That's a great first reason. Now, what would be your second reason?",
    "Excellent! And your third reason would be...?",
  ],
  Conclusion: [
    "What did this book teach you? What was the most important lesson?",
    "Would you recommend this book to a friend? Why or why not?",
    "If you could change one thing in the story, what would it be?",
  ],
  'Cross Book': [
    "Does this book remind you of any other book you have read? How are they similar?",
    "If the main character from this book met a character from another book you love, what do you think they would talk about?",
    "You have read so many stories now! What kind of reader do you think you are becoming?",
  ],
};

const WORKSHEET_ROWS = [
  { stage: 'Warm Connection', label: 'Warm Connection', color: '#FF6B6B', icon: '🌟', question: 'What kind of stories do you enjoy?', example: 'e.g. I really love adventure stories because they are so exciting.' },
  { stage: 'Title', label: 'Title', color: '#5C8B5C', icon: '📖', question: 'What is this book about?', example: 'e.g. This book is about a caterpillar that becomes a butterfly.' },
  { stage: 'Introduction', label: 'Introduction', color: '#87CEDB', icon: '👤', question: 'Who is your favorite character? Why?', example: 'e.g. I would choose the caterpillar because it is brave.' },
  { stage: 'Body', label: 'Body ①', color: '#D4A843', icon: '💭', question: 'What is the most important part of the story? Why?', example: 'e.g. The most important part is when the caterpillar eats all the food.', bodyIndex: 0 },
  { stage: 'Body', label: 'Body ②', color: '#D4A843', icon: '💭', question: 'What would you change about the story? Why?', example: 'e.g. I would add more animals because it would be more fun.', bodyIndex: 1 },
  { stage: 'Body', label: 'Body ③', color: '#D4A843', icon: '💭', question: 'What did you learn from this story?', example: 'e.g. Moreover, I learned that change can be beautiful.', bodyIndex: 2 },
  { stage: 'Conclusion', label: 'Conclusion', color: '#7AC87A', icon: '⭐', question: 'How do you feel about this book?', example: 'e.g. Reading this book was really fun and I learned a lot.' },
  { stage: 'Cross Book', label: 'Cross Book', color: '#9B59B6', icon: '🔗', question: 'Does this book remind you of another book?', example: 'e.g. This book reminds me of Charlotte\'s Web because both have animal friends.' },
];

function getWorksheetRowIndex(stageIndex, bodyReasonCount) {
  const stage = STAGES[stageIndex];
  if (stage === 'Warm Connection') return 0;
  if (stage === 'Title') return 1;
  if (stage === 'Introduction') return 2;
  if (stage === 'Body') return 3 + Math.min(bodyReasonCount, 2);
  if (stage === 'Conclusion') return 6;
  if (stage === 'Cross Book') return 7;
  return 0;
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

  // Phase 2B: emotion reactions, session timer, timeout warning, AI feedback
  const [emotionHistory, setEmotionHistory] = useState([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [showAiFeedbackCard, setShowAiFeedbackCard] = useState(false);
  const timerRef = useRef(null);

  // Level-based UI: determine mode from sessionStorage once (stable across renders)
  const isBeginnerMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (sessionStorage.getItem('studentLevel') || 'intermediate') === 'beginner';
  }, []);

  // For beginners, text input is hidden by default; others see it immediately.
  // useState lazy initialiser runs once so it safely reads sessionStorage on mount.
  const [showTextInput, setShowTextInput] = useState(() => {
    if (typeof window === 'undefined') return true;
    return (sessionStorage.getItem('studentLevel') || 'intermediate') !== 'beginner';
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
      const storedStudentId = sessionStorage.getItem('studentId');
      const storedStudentName = sessionStorage.getItem('studentName');
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

  // 30-minute timeout warning
  useEffect(() => {
    if (elapsedSeconds === 1800) {
      setShowTimeoutWarning(true);
    }
  }, [elapsedSeconds]);

  const elapsedTime = useMemo(() => {
    const m = Math.floor(elapsedSeconds / 60);
    const s = elapsedSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, [elapsedSeconds]);

  // Derived turn count within the current stage (1-indexed for display)
  const turnCount = currentStage === 2 /* Body */
    ? bodyReasonCount + 1
    : currentTurn + 1;
  const maxTurns = MAX_TURNS_PER_STAGE;

  const getApiUrl = () => {
    if (typeof window !== 'undefined') {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    }
    return 'http://localhost:3001';
  };

  const activeRowIndex = getWorksheetRowIndex(currentStage, bodyReasonCount);

  // Read URL search params from window.location.search on mount.
  // Using window.location.search directly avoids useSearchParams() + Suspense
  // boundary issues that prevented effects from firing in Next.js 14 App Router.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('bookId');
    const title = params.get('bookTitle') || 'the book';
    console.log('[HiAlice] mount: bookId =', id, 'bookTitle =', title);
    setBookId(id);
    setBookTitle(title);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Kick off the session once bookId is known (set by the mount effect above).
  useEffect(() => {
    if (!bookId) return;
    console.log('[HiAlice] bookId ready, calling initializeSession:', bookId);
    initializeSession();
  }, [bookId]); // eslint-disable-line react-hooks/exhaustive-deps

  const initializeSession = async () => {
    console.log('[HiAlice] initializeSession called, bookId:', bookId, 'bookTitle:', bookTitle);
    try {
      setSessionStartTime(new Date());
      const apiUrl = getApiUrl();

      try {
        const response = await fetch(`${apiUrl}/api/sessions/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId, bookId, bookTitle }),
        });

        if (response.ok) {
          const data = await response.json();
          setSessionId(data.session?.id || data.sessionId || data.id);
          setApiAvailable(true);
        } else {
          setApiAvailable(false);
        }
      } catch (error) {
        console.warn('API unavailable, using mock responses:', error);
        setApiAvailable(false);
      }

      const initialMessage = {
        id: 0,
        speaker: 'alice',
        content: `Hello! I'm so excited to talk about "${bookTitle}"! Before we dive in, tell me — what was the last really good book you read? What made it special?`,
        timestamp: new Date(),
        stage: 'Warm Connection',
      };
      setMessages([initialMessage]);
      speak(
        `Hello! I'm so excited to talk about ${bookTitle}! Before we dive in, tell me — what was the last really good book you read? What made it special?`
      );
      setShowSkipButton(true);
    } catch (error) {
      console.error('Error initializing session:', error);
      setApiAvailable(false);
      setError("Oops! Something went a little wrong. I'll use my notes instead!");
      const fallbackMessage = {
        id: 0,
        speaker: 'alice',
        content: `Hello! I'm so excited to talk about "${bookTitle}"! Before we dive in, tell me — what was the last really good book you read? What made it special?`,
        timestamp: new Date(),
        stage: 'Warm Connection',
      };
      setMessages([fallbackMessage]);
    }
  };

  const handleSendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;

    setError(null);
    setLoading(true);

    const studentMessage = {
      id: messages.length,
      speaker: 'student',
      content: text,
      timestamp: new Date(),
      stage: STAGES[currentStage],
    };

    setMessages((prev) => [...prev, studentMessage]);
    setInputText('');

    const rowIdx = getWorksheetRowIndex(currentStage, bodyReasonCount);
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
              stage: STAGES[currentStage],
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
      const stageIndex = currentStage;
      const stageQuestions = MOCK_AI_RESPONSES[STAGES[stageIndex]];
      const nextTurnIndex = currentTurn + 1;
      const nextQuestion =
        nextTurnIndex < stageQuestions.length
          ? stageQuestions[nextTurnIndex]
          : "That was wonderful! Let's move to the next topic.";

      let reasonCount = bodyReasonCount;
      if (STAGES[stageIndex] === 'Body') {
        reasonCount = nextTurnIndex;
      }

      await processMockResponse(nextQuestion, reasonCount);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to get response. Please try again.');
      setLoading(false);
    }
  }, [loading, messages, currentStage, bodyReasonCount, apiAvailable, sessionId, currentTurn]);

  const processApiResponse = async (data) => {
    const aliceMessage = {
      id: messages.length + 1,
      speaker: 'alice',
      content: data.reply?.content || data.content || data.message,
      timestamp: new Date(),
      stage: STAGES[currentStage],
    };

    setMessages((prev) => [...prev, aliceMessage]);
    speak(aliceMessage.content);

    if (data.vocabulary && Array.isArray(data.vocabulary)) {
      setSessionVocabulary((prev) => [...prev, ...data.vocabulary]);
    }

    if (data.grammarScore !== undefined) {
      setStageScores((prev) => ({
        ...prev,
        [STAGES[currentStage]]: data.grammarScore,
      }));
    }

    if (data.shouldAdvance && data.nextStage) {
      const nextStageIndex = STAGES.indexOf(data.nextStage);
      if (nextStageIndex > currentStage) {
        showStageTransitionAnimation(data.nextStage, nextStageIndex);
      }
    } else {
      if (STAGES[currentStage] === 'Body') {
        setBodyReasonCount((prev) => prev + 1);
      }
      setCurrentTurn((prev) => prev + 1);
    }

    setLoading(false);
  };

  const processMockResponse = async (content, reasonCount = 0) => {
    const aliceMessage = {
      id: messages.length + 1,
      speaker: 'alice',
      content,
      timestamp: new Date(),
      stage: STAGES[currentStage],
    };

    setMessages((prev) => [...prev, aliceMessage]);
    speak(content);

    const nextTurn = currentTurn + 1;

    let shouldAdvance = false;
    if (STAGES[currentStage] === 'Body') {
      shouldAdvance = reasonCount >= 3;
      setBodyReasonCount(reasonCount);
    } else {
      shouldAdvance = nextTurn >= MAX_TURNS_PER_STAGE;
    }

    if (shouldAdvance) {
      const nextStageIndex = currentStage + 1;
      if (nextStageIndex < STAGES.length) {
        showStageTransitionAnimation(STAGES[nextStageIndex], nextStageIndex);
      } else {
        completeSession();
      }
    } else {
      setCurrentTurn(nextTurn);
    }

    setLoading(false);
  };

  const showStageTransitionAnimation = (stageName, stageIndex) => {
    setNextStageName(stageName);
    setShowStageTransition(true);

    setTimeout(() => {
      setCurrentStage(stageIndex);
      setCurrentTurn(0);
      setBodyReasonCount(0);
      setShowStageTransition(false);

      const transitionMessage = {
        id: messages.length + 2,
        speaker: 'alice',
        content: `Great! Now let's move to the ${stageName} section. I have some new questions for you.`,
        timestamp: new Date(),
        isTransition: true,
        stage: stageName,
      };
      setMessages((prev) => [...prev, transitionMessage]);
      speak(`Great! Now let's move to the ${stageName} section. I have some new questions for you.`);
    }, 1500);
  };

  const completeSession = async () => {
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
  };

  const handleSkipToNextStage = () => {
    if (currentStage < STAGES.length - 1) {
      showStageTransitionAnimation(STAGES[currentStage + 1], currentStage + 1);
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
    router.push('/books');
  }, [sessionId, router]);

  const handleVoiceInput = () => {
    if (isListening) {
      stopListening();
      if (transcript && transcript.trim()) {
        handleSendMessage(transcript);
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
  }, [transcript, isListening, handleSendMessage]);

  // Phase 2B: AI Feedback preview card shown immediately after session ends
  if (showAiFeedbackCard && aiFeedback) {
    return (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center py-12 bg-[#F5F0E8]">
        <div className="ghibli-card p-8 max-w-md text-center animate-fade-in">
          <div className="text-5xl mb-4">🤖</div>
          <h2 className="text-xl font-extrabold text-[#92400E] mb-3">A Message from HiAlice</h2>
          <div className="bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] border-2 border-[#F59E0B]/30 rounded-2xl p-5 mb-6 text-left">
            <p className="text-[#78350F] text-sm leading-relaxed italic">
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
          <p className="text-xs text-[#9CA3AF] mt-3">This screen closes automatically in a few seconds</p>
        </div>
      </div>
    );
  }

  if (sessionComplete) {
    return (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center py-12 bg-[#F5F0E8]">
        <div className="ghibli-card p-8 max-w-md text-center">
          <div className="text-6xl mb-4 float-animation inline-block">🎉</div>
          <h2 className="text-2xl font-extrabold text-[#3D2E1E] mb-2">Great Job!</h2>
          <p className="text-[#6B5744] font-semibold mb-6">
            You completed the reading session for{' '}
            <span className="font-bold text-[#3D6B3D]">&quot;{bookTitle}&quot;</span>. Let&apos;s review what you learned!
          </p>
          <button
            onClick={() => router.push(sessionId ? `/review?sessionId=${sessionId}` : '/review')}
            className="w-full py-3 px-6 bg-[#5C8B5C] text-white rounded-2xl hover:bg-[#3D6B3D] transition-colors font-bold hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(92,139,92,0.3)]"
          >
            View Word Review
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-120px)] bg-[#F5F0E8]">
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
            <h3 className="text-lg font-bold text-[#2C4A2E] mb-2">Need a break?</h3>
            <p className="text-sm text-[#4B5563] mb-4">
              You&apos;ve been reading for 30 minutes! Great job! Want to save and come back later?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handlePauseSession}
                className="flex-1 bg-[#F59E0B] text-white rounded-xl py-2 text-sm font-medium min-h-[48px]"
                aria-label="Save your progress and exit"
              >
                Save &amp; Exit 💾
              </button>
              <button
                onClick={() => setShowTimeoutWarning(false)}
                className="flex-1 bg-[#4A7C59] text-white rounded-xl py-2 text-sm font-medium min-h-[48px]"
                aria-label="Continue the session"
              >
                Keep Going! 💪
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== LEFT: Worksheet Frame ===== */}
      <div className="lg:w-80 w-full lg:h-full bg-[#FFFCF3] border-r border-[#D6C9A8] shadow-[2px_0_12px_rgba(61,46,30,0.06)] flex-shrink-0 overflow-y-auto">
        {/* Worksheet Header */}
        <div className="bg-[#5C8B5C] text-white px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
          <span className="text-xl" aria-hidden="true">📝</span>
          <div>
            <h2 className="font-extrabold text-sm">Reading Worksheet</h2>
            <p className="text-xs text-green-100 truncate">{bookTitle || 'Book Title'}</p>
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

        {/* Worksheet Table */}
        <div className="divide-y divide-[#EDE5D4]">
          {WORKSHEET_ROWS.map((row, idx) => {
            const isActive = idx === activeRowIndex;
            const isCompleted = idx < activeRowIndex;
            const isPending = idx > activeRowIndex;
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
                <div className="flex items-center gap-2 px-3 py-2">
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

                {/* Guide Question */}
                <div className="px-3 pb-2">
                  <div
                    className={`relative rounded-xl px-3 py-2 text-xs ${
                      isActive
                        ? 'bg-[#FFFCF3] shadow-sm border border-[#C8E6C9]'
                        : 'bg-[#FFFCF3] bg-opacity-60'
                    }`}
                  >
                    <div
                      className="absolute -top-1 left-4 w-2 h-2 rotate-45"
                      style={{
                        backgroundColor: isActive ? '#FFFCF3' : 'rgba(255,252,243,0.6)',
                        borderTop: isActive ? '1px solid #C8E6C9' : 'none',
                        borderLeft: isActive ? '1px solid #C8E6C9' : 'none',
                      }}
                    />
                    <p className={`font-bold ${isActive ? 'text-[#3D2E1E]' : 'text-[#9B8777]'}`}>
                      {row.question}
                    </p>
                    {answer && (
                      <div className="mt-2 pt-2 border-t border-[#E8DEC8]">
                        <p className="text-xs text-[#5C8B5C] font-semibold">
                          {answer.length > 80 ? answer.substring(0, 80) + '...' : answer}
                        </p>
                      </div>
                    )}
                    {!answer && (
                      <p className="text-[#9B8777] mt-1 italic text-xs">{row.example}</p>
                    )}
                  </div>
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
              {Object.keys(worksheetAnswers).length} / {WORKSHEET_ROWS.length}
            </span>
          </div>
          <div className="w-full bg-[#EDE5D4] rounded-full h-2">
            <div
              className="bg-[#5C8B5C] h-2 rounded-full transition-all duration-500"
              style={{ width: `${(Object.keys(worksheetAnswers).length / WORKSHEET_ROWS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* ===== RIGHT: Chat Area ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Session top bar: book title + Save & Exit */}
        <div className="bg-[#FFFCF3] border-b border-[#D6C9A8] px-4 py-2 flex items-center justify-between flex-shrink-0">
          <p className="text-xs font-semibold text-[#6B5744] truncate max-w-[60%]">
            {bookTitle || 'Reading Session'}
          </p>
          <button
            onClick={handlePauseSession}
            className="text-xs text-[#9CA3AF] hover:text-[#4A7C59] flex items-center gap-1 px-3 py-1 rounded-lg border border-[#E5E7EB] hover:border-[#4A7C59] transition-colors min-h-[36px]"
            aria-label="Save and exit session"
          >
            Save &amp; Exit
          </button>
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
                    <p className="text-xs text-[#9B8777] mt-1 ml-1 font-medium">
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
                  <span className="text-xs text-[#6B7280] mr-1 self-center">How do you feel?</span>
                  {['😊', '🤔', '😮'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleEmotionReact(emoji)}
                      className="text-lg hover:scale-125 transition-transform cursor-pointer bg-white/60 rounded-full w-8 h-8 flex items-center justify-center shadow-sm min-w-[32px] min-h-[32px]"
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
                  <p className="text-xs text-[#9B8777] mr-2 font-medium">
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
                <div className="bg-[#D6E9D6] px-4 py-3 rounded-2xl rounded-tl-none">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-[#5C8B5C] rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                    <div className="w-2 h-2 bg-[#5C8B5C] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-[#5C8B5C] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-[#FFFCF3] border-t border-[#D6C9A8] p-4 space-y-3 flex-shrink-0 shadow-[0_-4px_12px_rgba(61,46,30,0.06)]">
          {/* Phase 2B: Stage + Turn progress indicator */}
          <div className="flex items-center justify-between mb-2 px-1" aria-label="Session progress">
            <span className="text-xs font-medium text-[#4A7C59] bg-[#E8F5E9] px-3 py-1 rounded-full">
              {isBeginnerMode
                ? `${STAGE_EMOJIS[currentStage]} Stage`
                : `${STAGES[currentStage]} Stage`}
            </span>
            <span className="text-xs text-[#9CA3AF]">
              Turn {Math.min(turnCount, maxTurns)}/{maxTurns} &bull; {elapsedTime}
            </span>
          </div>

          {/* Current Stage Indicator (mobile only) */}
          <div className="lg:hidden flex items-center gap-2 mb-2">
            {WORKSHEET_ROWS[activeRowIndex] && (
              <>
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-extrabold"
                  style={{ backgroundColor: WORKSHEET_ROWS[activeRowIndex].color }}
                >
                  {WORKSHEET_ROWS[activeRowIndex].icon}
                </span>
                <span className="text-sm font-extrabold" style={{ color: WORKSHEET_ROWS[activeRowIndex].color }}>
                  {WORKSHEET_ROWS[activeRowIndex].label}
                </span>
                <span className="text-xs text-[#9B8777] flex-1 truncate font-medium ml-1">
                  — {WORKSHEET_ROWS[activeRowIndex].question}
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

          {/* Input area — layout branches on student level */}
          {isBeginnerMode ? (
            /* Beginner: large centred voice button, text input hidden by default */
            <div className="flex flex-col items-center gap-3 w-full">
              <div className="relative">
                <VoiceButton
                  isListening={isListening}
                  onStart={handleVoiceInput}
                  onStop={handleVoiceInput}
                  size={100}
                  disabled={loading}
                  className="w-[100px] h-[100px] text-3xl"
                />
              </div>
              <p className="text-sm font-bold text-[#5C8B5C]">
                {isListening ? 'Listening...' : 'Tap to speak'}
              </p>
              <button
                onClick={() => setShowTextInput((v) => !v)}
                className="text-xs text-[#9CA3AF] underline"
              >
                {showTextInput ? 'Hide keyboard' : 'Type instead'}
              </button>
              {showTextInput && (
                <div className="w-full flex gap-2">
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
          ) : (
            /* Intermediate / Advanced: text input first, voice button to the right */
            <div className="flex gap-3 items-end w-full">
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
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <VoiceButton
                  isListening={isListening}
                  onStart={handleVoiceInput}
                  onStop={handleVoiceInput}
                  size={56}
                  disabled={loading}
                />
                <p className="text-xs font-semibold text-[#5C8B5C]">
                  {isListening ? 'Listening' : 'Speak'}
                </p>
              </div>
            </div>
          )}

          {!supported && (
            <p className="text-xs text-[#D4A843] text-center font-semibold">
              Voice input not supported on this device. Please use text input.
            </p>
          )}

          {!apiAvailable && (
            <p className="text-xs text-[#9B8777] text-center font-medium">
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
    </div>
  );
}

