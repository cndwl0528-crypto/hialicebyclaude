'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSpeech from '@/hooks/useSpeech';
import StageProgress from '@/components/StageProgress';
import VoiceButton from '@/components/VoiceButton';

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
  
  const [session, setSession] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentStage, setCurrentStage] = useState(0);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [showStageTransition, setShowStageTransition] = useState(false);
  const [nextStageName, setNextStageName] = useState('');
  const [apiAvailable, setApiAvailable] = useState(true);
  
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
          setSessionId(data.sessionId || data.id);
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
      };
      setMessages([initialMessage]);
      speak(`Hello! I'm so excited to talk about ${bookTitle}! Let's start with the title. What do you think the title means?`);
    } catch (error) {
      console.error('Error initializing session:', error);
      setApiAvailable(false);
    }
  };

  // Handle auto-send after silence detection
  useEffect(() => {
    if (isListening && transcript && transcript.trim()) {
      // Clear existing timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      // Set new timer: auto-send after 2 seconds of silence
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

    setLoading(true);
    
    // Add student message
    const studentMessage = {
      id: messages.length,
      speaker: 'student',
      content: text,
      timestamp: new Date(),
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
            throw new Error('API response not ok');
          }

          // If API is successful, use the response
          const data = await response.json();
          await processAiResponse(data.content || data.message);
          return;
        } catch (error) {
          console.warn('API call failed, falling back to mock:', error);
          setApiAvailable(false);
        }
      }

      // Fallback to mock responses
      await new Promise((resolve) => setTimeout(resolve, 800));
      const nextTurn = currentTurn + 1;
      setCurrentTurn(nextTurn);

      const stageIndex = currentStage;
      const stageQuestions = MOCK_AI_RESPONSES[STAGES[stageIndex]];
      const nextQuestion =
        nextTurn < stageQuestions.length
          ? stageQuestions[nextTurn]
          : 'That was wonderful! Let\'s move to the next topic.';

      await processAiResponse(nextQuestion);
    } catch (error) {
      console.error('Error sending message:', error);
      setLoading(false);
    }
  };

  const processAiResponse = async (content) => {
    const aliceMessage = {
      id: messages.length + 1,
      speaker: 'alice',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, aliceMessage]);
    speak(content);

    const nextTurn = currentTurn + 1;
    setCurrentTurn(nextTurn);

    // Check if we need to advance to next stage
    if (nextTurn >= MAX_TURNS_PER_STAGE) {
      const nextStageIndex = currentStage + 1;
      
      if (nextStageIndex < STAGES.length) {
        // Show stage transition
        showStageTransitionAnimation(STAGES[nextStageIndex], nextStageIndex);
      } else {
        // Session complete
        completeSession();
      }
    }

    setLoading(false);
  };

  const showStageTransitionAnimation = (stageName, stageIndex) => {
    setNextStageName(stageName);
    setShowStageTransition(true);

    setTimeout(() => {
      setCurrentStage(stageIndex);
      setCurrentTurn(0);
      setShowStageTransition(false);

      // Add transition message to chat
      const transitionMessage = {
        id: messages.length + 2,
        speaker: 'alice',
        content: `Great! Now let's move to the ${stageName} section. I have some new questions for you.`,
        timestamp: new Date(),
        isTransition: true,
      };
      setMessages((prev) => [...prev, transitionMessage]);
      speak(`Great! Now let's move to the ${stageName} section. I have some new questions for you.`);
    }, 1500);
  };

  const completeSession = async () => {
    // Try to complete session on backend
    if (apiAvailable && sessionId) {
      try {
        const apiUrl = getApiUrl();
        await fetch(`${apiUrl}/api/sessions/${sessionId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messages.filter((m) => m.speaker === 'student').length,
          }),
        });
      } catch (error) {
        console.warn('Error completing session on backend:', error);
      }
    }

    // Save session data to sessionStorage for review page
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(
        'lastSessionData',
        JSON.stringify({
          sessionId,
          bookId,
          bookTitle,
          studentId,
          studentName,
          messageCount: messages.length,
          completedAt: new Date().toISOString(),
        })
      );
    }

    setSessionComplete(true);
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
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center py-12">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Great Job!
          </h2>
          <p className="text-gray-600 mb-6">
            You completed the reading session. Let's review what you learned!
          </p>
          <button
            onClick={() => router.push('/review')}
            className="w-full py-3 px-6 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
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
        <div className="mb-3">
          <h2 className="text-lg font-bold text-[#4A90D9]">
            {STAGES[currentStage]}
          </h2>
          <p className="text-sm text-gray-600">
            Question {currentTurn + 1} of {MAX_TURNS_PER_STAGE}
          </p>
        </div>
        <StageProgress currentStage={currentStage} stages={STAGES} />
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.speaker === 'alice' ? 'justify-start' : 'justify-end'} ${msg.isTransition ? 'justify-center' : ''}`}
          >
            {msg.speaker === 'alice' && (
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
                    {msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                  {msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
          <div className="flex justify-start">
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
      <div className="bg-white border-t border-gray-200 p-4 space-y-4 flex-shrink-0">
        {/* Live Transcript Display */}
        {isListening && transcript && (
          <div className="bg-blue-50 border-l-4 border-[#4A90D9] p-3 rounded">
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
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A90D9] text-sm"
            disabled={loading}
          />
          <button
            onClick={handleTextSend}
            disabled={loading || !inputText.trim()}
            className="px-6 py-3 bg-[#4A90D9] text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors font-semibold text-sm min-w-[48px] min-h-[48px]"
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
