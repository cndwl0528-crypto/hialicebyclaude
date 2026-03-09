'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSpeech from '@/hooks/useSpeech';
import StageProgress from '@/components/StageProgress';
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

  const { isListening, transcript, speak, startListening, stopListening, supported } = useSpeech();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const silenceTimerRef = useRef(null);

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

  const getApiUrl = () => {
    if (typeof window !== 'undefined') {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    }
    return 'http://localhost:3001';
  };

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

      // Try to call backend API
      try {
        const response = await fetch(`${apiUrl}/api/sessions/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId,
            bookId,
            bookTitle,
          }),
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

      // Start with first greeting
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

    // Add student message
    const studentMessage = {
      id: messages.length,
      speaker: 'student',
      content: text,
      timestamp: new Date(),
      stage: STAGES[currentStage],
    };

    setMessages((prev) => [...prev, studentMessage]);
    setInputText('');

    try {
      // Try to send to backend API
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

      // For Body stage in mock, track reasons
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

    // Extract vocabulary from response if present
    if (data.vocabulary && Array.isArray(data.vocabulary)) {
      setSessionVocabulary((prev) => [...prev, ...data.vocabulary]);
    }

    // Update scores for this stage if grammar score available
    if (data.grammarScore !== undefined) {
      setStageScores((prev) => ({
        ...prev,
        [STAGES[currentStage]]: data.grammarScore,
      }));
    }

    // Handle stage advancement if API signals it
    if (data.shouldAdvance && data.nextStage) {
      const nextStageIndex = STAGES.indexOf(data.nextStage);
      if (nextStageIndex > currentStage) {
        showStageTransitionAnimation(data.nextStage, nextStageIndex);
      }
    } else {
      // Just update turn count if not advancing
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

    // Check if we need to advance to next stage
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

      // Add transition message to chat
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
    // Calculate session duration
    const duration = sessionStartTime
      ? Math.round((new Date() - sessionStartTime) / 1000)
      : 0;

    // Try to complete session on backend
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

    // Save complete session data to sessionStorage for review page
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
            You completed the reading session for <span className="font-semibold">"{bookTitle}"</span>. Let's review what you learned!
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
    <div className="flex flex-col h-[calc(100vh-120px)] bg-[#F5F7FA]">
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

      {/* Stage Progress */}
      <div className="bg-white shadow-sm p-4 border-b border-gray-200">
        <div className="mb-3 flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-[#4A90D9]">
              {STAGES[currentStage]}
            </h2>
            <p className="text-sm text-gray-600">
              {STAGES[currentStage] === 'Body'
                ? `Reason ${bodyReasonCount} of 3`
                : `Question ${currentTurn + 1} of ${MAX_TURNS_PER_STAGE}`}
            </p>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={handleSkipToNextStage}
              className="px-3 py-1 text-xs font-semibold text-white bg-[#F39C12] rounded hover:bg-orange-600 transition-colors"
              title="Skip to next stage (dev only)"
            >
              Skip →
            </button>
          )}
        </div>
        <StageProgress currentStage={currentStage} stages={STAGES} />
      </div>

      {/* Guide Question Panel (Worksheet Style) */}
      {(() => {
        const stageData = STAGE_GUIDE[STAGES[currentStage]];
        const guide = getCurrentGuideQuestion(STAGES[currentStage], bodyReasonCount);
        return stageData ? (
          <div className="mx-3 mt-3 mb-1 rounded-xl overflow-hidden shadow-sm border border-gray-100">
            {/* Stage Label Bar */}
            <div className="px-4 py-2 flex items-center gap-2" style={{ background: stageData.color }}>
              <span className="text-lg">{stageData.icon}</span>
              <span className="text-white font-bold text-sm">{stageData.label}</span>
              {STAGES[currentStage] === 'Body' && (
                <span className="ml-auto text-white text-xs font-semibold bg-white bg-opacity-20 px-2 py-0.5 rounded-full">
                  {bodyReasonCount + 1} / 3
                </span>
              )}
            </div>
            {/* Guide Question Bubble */}
            <div className="bg-white px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-lg">💬</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800">{guide.question}</p>
                  {guide.example && (
                    <p className="text-xs text-gray-400 mt-1 italic">{guide.example}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null;
      })()}

      {/* Error Banner */}
      {error && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-3 mx-3 mt-1 rounded">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Note:</span> {error}
          </p>
        </div>
      )}

      {/* Chat Area */}
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
                {/* Alice Avatar */}
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
                  <div
                    className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"
                    style={{ animationDelay: '0s' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"
                    style={{ animationDelay: '0.4s' }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4 space-y-4 flex-shrink-0">
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
  );
}
