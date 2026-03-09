'use client';

import { useState, useEffect, useRef } from 'react';
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

// Worksheet row data for the visible frame
const WORKSHEET_ROWS = [
  { stage: 'Title', label: 'Title', color: '#4A90D9', icon: '📖', question: 'What is this book about?', example: 'e.g. This book is about a caterpillar that becomes a butterfly.' },
  { stage: 'Introduction', label: 'Introduction', color: '#8B5CF6', icon: '👤', question: 'Who is your favorite character? Why?', example: 'e.g. I would choose the caterpillar because it is brave.' },
  { stage: 'Body', label: 'Body ①', color: '#F39C12', icon: '💭', question: 'What is the most important part of the story? Why?', example: 'e.g. The most important part is when the caterpillar eats all the food.', bodyIndex: 0 },
  { stage: 'Body', label: 'Body ②', color: '#F39C12', icon: '💭', question: 'What would you change about the story? Why?', example: 'e.g. I would add more animals because it would be more fun.', bodyIndex: 1 },
  { stage: 'Body', label: 'Body ③', color: '#F39C12', icon: '💭', question: 'What did you learn from this story?', example: 'e.g. Moreover, I learned that change can be beautiful.', bodyIndex: 2 },
  { stage: 'Conclusion', label: 'Conclusion', color: '#27AE60', icon: '⭐', question: 'How do you feel about this book?', example: 'e.g. Reading this book was really fun and I learned a lot.' },
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

  // Session state
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
  // Track student answers per worksheet row for the frame display
  const [worksheetAnswers, setWorksheetAnswers] = useState({});

  const { isListening, transcript, speak, startListening, stopListening, supported } = useSpeech();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const activeRowRef = useRef(null);

  // Get student data from sessionStorage
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

  // Scroll active worksheet row into view
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentStage, bodyReasonCount]);

  const getApiUrl = () => {
    if (typeof window !== 'undefined') {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    }
    return 'http://localhost:3001';
  };

  // Current active worksheet row index
  const activeRowIndex = getWorksheetRowIndex(currentStage, bodyReasonCount);

  // Initialize session and start first question
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
      setError('Failed to initialize session. Using offline mode.');
    }
  };

  // Handle auto-send after silence detection
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
  }, [transcript, isListening]);

  const handleSendMessage = async (text) => {
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

    // Save student answer to worksheet frame
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
          setError('Using offline mode');
        }
      }

      // Fallback to mock responses
      await new Promise((resolve) => setTimeout(resolve, 800));
      const stageIndex = currentStage;
      const stageQuestions = MOCK_AI_RESPONSES[STAGES[stageIndex]];
      const nextTurnIndex = currentTurn + 1;
      const nextQuestion =
        nextTurnIndex < stageQuestions.length
          ? stageQuestions[nextTurnIndex]
          : 'That was wonderful! Let\'s move to the next topic.';

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
  };

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

  if (sessionComplete) {
    return (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center py-12 bg-[#F5F7FA]">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Great Job!</h2>
          <p className="text-gray-600 mb-6">
            You completed the reading session for <span className="font-semibold">&quot;{bookTitle}&quot;</span>. Let&apos;s review what you learned!
          </p>
          <button
            onClick={() => router.push('/review')}
            className="w-full py-3 px-6 bg-[#4A90D9] text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
          >
            View Word Review
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-120px)] bg-[#F5F7FA]">
      {/* Stage Transition Overlay */}
      {showStageTransition && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-lg p-8 shadow-lg animate-bounce">
            <p className="text-lg font-semibold text-gray-800">
              Moving to: <span className="text-[#4A90D9]">{nextStageName}</span>
            </p>
          </div>
        </div>
      )}

      {/* ============ LEFT: Worksheet Frame ============ */}
      <div className="lg:w-80 w-full lg:h-full bg-white border-r border-gray-200 shadow-sm flex-shrink-0 overflow-y-auto">
        {/* Worksheet Header */}
        <div className="bg-[#4A90D9] text-white px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
          <span className="text-xl">📝</span>
          <div>
            <h2 className="font-bold text-sm">Reading Worksheet</h2>
            <p className="text-xs text-blue-100 truncate">{bookTitle || 'Book Title'}</p>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={handleSkipToNextStage}
              className="ml-auto px-2 py-1 text-xs font-semibold bg-white bg-opacity-20 rounded hover:bg-opacity-30 transition-colors"
              title="Skip to next stage (dev only)"
            >
              Skip →
            </button>
          )}
        </div>

        {/* Worksheet Table */}
        <div className="divide-y divide-gray-100">
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
                    ? 'bg-blue-50 border-l-4 border-[#4A90D9]'
                    : isCompleted
                    ? 'bg-green-50 border-l-4 border-[#27AE60]'
                    : 'bg-gray-50 border-l-4 border-transparent opacity-60'
                }`}
              >
                {/* Row Header */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: isCompleted ? '#27AE60' : row.color }}
                  >
                    {isCompleted ? '✓' : row.icon}
                  </span>
                  <span
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: isCompleted ? '#27AE60' : row.color }}
                  >
                    {row.label}
                  </span>
                  {isActive && (
                    <span className="ml-auto text-xs text-[#4A90D9] font-semibold animate-pulse">
                      ● Now
                    </span>
                  )}
                </div>

                {/* Guide Question (cloud bubble style) */}
                <div className="px-3 pb-2">
                  <div
                    className={`relative rounded-lg px-3 py-2 text-xs ${
                      isActive ? 'bg-white shadow-sm border border-blue-200' : 'bg-white bg-opacity-60'
                    }`}
                  >
                    {/* Speech bubble tail */}
                    <div
                      className="absolute -top-1 left-4 w-2 h-2 rotate-45"
                      style={{
                        backgroundColor: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                        borderTop: isActive ? '1px solid #bfdbfe' : 'none',
                        borderLeft: isActive ? '1px solid #bfdbfe' : 'none',
                      }}
                    ></div>
                    <p className={`font-semibold ${isActive ? 'text-gray-800' : 'text-gray-500'}`}>
                      {row.question}
                    </p>
                    {/* Student's answer (if completed) */}
                    {answer && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs text-[#27AE60] font-medium">
                          💬 {answer.length > 80 ? answer.substring(0, 80) + '...' : answer}
                        </p>
                      </div>
                    )}
                    {/* Example answer (if pending or active without answer) */}
                    {!answer && (
                      <p className="text-gray-400 mt-1 italic text-xs">{row.example}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Summary */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Progress</span>
            <span className="font-semibold text-[#4A90D9]">
              {Object.keys(worksheetAnswers).length} / {WORKSHEET_ROWS.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
            <div
              className="bg-[#4A90D9] h-2 rounded-full transition-all duration-500"
              style={{ width: `${(Object.keys(worksheetAnswers).length / WORKSHEET_ROWS.length) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* ============ RIGHT: Chat Area ============ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Error Banner */}
        {error && (
          <div className="bg-amber-50 border-l-4 border-amber-400 p-3 mx-3 mt-2 rounded">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Note:</span> {error}
            </p>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.speaker === 'alice' ? 'justify-start' : msg.speaker === 'student' ? 'justify-end' : 'justify-center'
              } animate-fade-in`}
            >
              {msg.speaker === 'alice' && !msg.isTransition && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#4A90D9] flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white text-sm font-bold">A</span>
                  </div>
                  <div className="flex-1">
                    <div className="bg-blue-100 text-gray-800 px-4 py-3 rounded-lg rounded-tl-none max-w-xs lg:max-w-md">
                      <p className="text-sm">{msg.content}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-1">
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
                  <div className="bg-gray-300 text-gray-900 px-4 py-3 rounded-lg rounded-tr-none max-w-xs lg:max-w-md">
                    <p className="text-sm">{msg.content}</p>
                  </div>
                  <p className="text-xs text-gray-500 mr-2">
                    {msg.timestamp?.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )}
              {msg.isTransition && (
                <div className="bg-[#F39C12] bg-opacity-20 border-l-4 border-[#F39C12] px-4 py-3 rounded text-center max-w-md">
                  <p className="text-sm font-semibold text-[#F39C12]">{msg.content}</p>
                </div>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {loading && (
            <div className="flex justify-start animate-fade-in">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#4A90D9] flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm font-bold">A</span>
                </div>
                <div className="bg-blue-100 px-4 py-3 rounded-lg rounded-tl-none">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                    <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-4 space-y-3 flex-shrink-0">
          {/* Current Stage Indicator (mobile only, since worksheet frame is hidden on small screens) */}
          <div className="lg:hidden flex items-center gap-2 mb-2">
            {WORKSHEET_ROWS[activeRowIndex] && (
              <>
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold"
                  style={{ backgroundColor: WORKSHEET_ROWS[activeRowIndex].color }}
                >
                  {WORKSHEET_ROWS[activeRowIndex].icon}
                </span>
                <span className="text-sm font-bold" style={{ color: WORKSHEET_ROWS[activeRowIndex].color }}>
                  {WORKSHEET_ROWS[activeRowIndex].label}
                </span>
                <span className="text-xs text-gray-400 ml-1">—</span>
                <span className="text-xs text-gray-500 flex-1 truncate">{WORKSHEET_ROWS[activeRowIndex].question}</span>
              </>
            )}
          </div>

          {/* Live Transcript Display */}
          {isListening && transcript && (
            <div className="bg-blue-50 border-l-4 border-[#4A90D9] p-3 rounded animate-fade-in">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">You said:</span> {transcript}
              </p>
            </div>
          )}

          {/* Voice Button with Label */}
          <div className="flex flex-col items-center gap-2">
            <VoiceButton
              isListening={isListening}
              onStart={handleVoiceInput}
              onStop={handleVoiceInput}
              size={80}
            />
            <p className="text-sm font-medium text-gray-700">
              {isListening ? '🎤 Listening...' : '🎤 Tap to speak'}
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
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A90D9] text-sm disabled:bg-gray-100"
              disabled={loading}
            />
            <button
              onClick={handleTextSend}
              disabled={loading || !inputText.trim()}
              className="px-6 py-3 bg-[#4A90D9] text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors font-semibold text-sm min-w-[48px] min-h-[48px]"
              title={loading ? 'Waiting for response...' : 'Send message'}
            >
              Send
            </button>
          </div>

          {!supported && (
            <p className="text-xs text-amber-600 text-center">
              Voice input not supported on this device. Please use text input.
            </p>
          )}

          {!apiAvailable && (
            <p className="text-xs text-gray-500 text-center">
              Running in offline mode - using mock responses
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
