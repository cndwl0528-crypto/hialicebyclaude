'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSpeech from '@/hooks/useSpeech';
import VoiceButton from '@/components/VoiceButton';
import { STAGE_GUIDE, getCurrentGuideQuestion } from '@/lib/stageQuestions';

const STAGES = ['Title', 'Introduction', 'Body', 'Conclusion'];
const MAX_TURNS_PER_STAGE = 3;

const MOCK_AI_RESPONSES = {
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
};

const WORKSHEET_ROWS = [
  { stage: 'Title', label: 'Title', color: '#5C8B5C', icon: '📖', question: 'What is this book about?', example: 'e.g. This book is about a caterpillar that becomes a butterfly.' },
  { stage: 'Introduction', label: 'Introduction', color: '#87CEDB', icon: '👤', question: 'Who is your favorite character? Why?', example: 'e.g. I would choose the caterpillar because it is brave.' },
  { stage: 'Body', label: 'Body ①', color: '#D4A843', icon: '💭', question: 'What is the most important part of the story? Why?', example: 'e.g. The most important part is when the caterpillar eats all the food.', bodyIndex: 0 },
  { stage: 'Body', label: 'Body ②', color: '#D4A843', icon: '💭', question: 'What would you change about the story? Why?', example: 'e.g. I would add more animals because it would be more fun.', bodyIndex: 1 },
  { stage: 'Body', label: 'Body ③', color: '#D4A843', icon: '💭', question: 'What did you learn from this story?', example: 'e.g. Moreover, I learned that change can be beautiful.', bodyIndex: 2 },
  { stage: 'Conclusion', label: 'Conclusion', color: '#7AC87A', icon: '⭐', question: 'How do you feel about this book?', example: 'e.g. Reading this book was really fun and I learned a lot.' },
];

function getWorksheetRowIndex(stageIndex, bodyReasonCount) {
  const stage = STAGES[stageIndex];
  if (stage === 'Title') return 0;
  if (stage === 'Introduction') return 1;
  if (stage === 'Body') return 2 + Math.min(bodyReasonCount, 2);
  if (stage === 'Conclusion') return 5;
  return 0;
}

export default function SessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookId = searchParams.get('bookId');
  const bookTitle = searchParams.get('bookTitle');

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

  const getApiUrl = () => {
    if (typeof window !== 'undefined') {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    }
    return 'http://localhost:3001';
  };

  const activeRowIndex = getWorksheetRowIndex(currentStage, bodyReasonCount);

  useEffect(() => {
    if (bookId && studentId) {
      initializeSession();
    }
  }, [bookId, studentId]);

  const initializeSession = async () => {
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
        content: `Hello! I'm so excited to talk about "${bookTitle}"! Let's start with the title. What do you think the title means?`,
        timestamp: new Date(),
        stage: 'Title',
      };
      setMessages([initialMessage]);
      speak(
        `Hello! I'm so excited to talk about ${bookTitle}! Let's start with the title. What do you think the title means?`
      );
      setShowSkipButton(true);
    } catch (error) {
      console.error('Error initializing session:', error);
      setApiAvailable(false);
      setError("Oops! Something went a little wrong. I'll use my notes instead!");
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

    if (apiAvailable && sessionId) {
      try {
        const apiUrl = getApiUrl();
        await fetch(`${apiUrl}/api/sessions/${sessionId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messages.filter((m) => m.speaker === 'student').length,
            duration,
          }),
        });
      } catch (error) {
        console.warn('Error completing session on backend:', error);
      }
    }

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(
        'lastSessionData',
        JSON.stringify({
          sessionId,
          bookId,
          bookTitle,
          studentId,
          studentName,
          messages: messages.filter((m) => m.speaker !== undefined),
          vocabulary: sessionVocabulary,
          stageScores,
          duration,
          completedAt: new Date().toISOString(),
          studentMessageCount: messages.filter((m) => m.speaker === 'student').length,
          totalTurns: messages.length,
          worksheetAnswers,
        })
      );
    }

    setSessionComplete(true);
  };

  const handleSkipToNextStage = () => {
    if (currentStage < STAGES.length - 1) {
      showStageTransitionAnimation(STAGES[currentStage + 1], currentStage + 1);
    } else {
      completeSession();
    }
  };

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
            onClick={() => router.push('/review')}
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
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.speaker === 'alice'
                  ? 'justify-start'
                  : msg.speaker === 'student'
                  ? 'justify-end'
                  : 'justify-center'
              } animate-fade-in`}
            >
              {msg.speaker === 'alice' && !msg.isTransition && (
                <div className="flex gap-3">
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

          {/* Live Transcript Display */}
          {isListening && transcript && (
            <div className="bg-[#E8F5E8] border-l-4 border-[#5C8B5C] p-3 rounded-xl animate-fade-in">
              <p className="text-sm text-[#3D2E1E] font-semibold">
                <span className="font-extrabold">You said:</span> {transcript}
              </p>
            </div>
          )}

          {/* Voice Button */}
          <div className="flex flex-col items-center gap-2">
            <VoiceButton
              isListening={isListening}
              onStart={handleVoiceInput}
              onStop={handleVoiceInput}
              size={80}
              disabled={loading}
            />
            <p className="text-sm font-bold text-[#5C8B5C]">
              {isListening ? 'Listening...' : 'Tap to speak'}
            </p>
          </div>

          {/* Text Input */}
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
    </div>
  );
}
