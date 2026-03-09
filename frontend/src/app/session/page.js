'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSpeech from '@/hooks/useSpeech';
import StageProgress from '@/components/StageProgress';
import VoiceButton from '@/components/VoiceButton';

const STAGES = ['Title', 'Introduction', 'Body', 'Conclusion'];

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
  
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentStage, setCurrentStage] = useState(0);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  
  const { isListening, transcript, speak, startListening, stopListening, supported } = useSpeech();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Initialize session
    if (bookId) {
      const initialMessage = {
        id: 0,
        speaker: 'alice',
        content: 'Hello! I just read a wonderful book. Can you tell me about the title?',
        timestamp: new Date(),
      };
      setMessages([initialMessage]);
      speak('Hello! I just read a wonderful book. Can you tell me about the title?');
    }
  }, [bookId]);

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

    // Simulate AI response delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const nextTurn = currentTurn + 1;
    setCurrentTurn(nextTurn);

    // Get next AI question
    const stageIndex = currentStage;
    const stageQuestions = MOCK_AI_RESPONSES[STAGES[stageIndex]];
    const nextQuestion =
      nextTurn < stageQuestions.length
        ? stageQuestions[nextTurn]
        : 'That was wonderful! Let\'s move to the next topic.';

    const aliceMessage = {
      id: messages.length + 1,
      speaker: 'alice',
      content: nextQuestion,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, aliceMessage]);
    speak(nextQuestion);

    // Auto-advance to next stage after 3 turns
    if (nextTurn >= 3) {
      const nextStage = currentStage + 1;
      if (nextStage < STAGES.length) {
        setCurrentStage(nextStage);
        setCurrentTurn(0);
      } else {
        // Session complete
        setSessionComplete(true);
      }
    }

    setLoading(false);
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
            className="w-full py-3 px-6 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-smooth font-semibold"
          >
            View Word Review
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Stage Progress */}
      <div className="bg-white shadow-sm p-4 mb-4">
        <StageProgress currentStage={currentStage} stages={STAGES} />
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.speaker === 'alice' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                msg.speaker === 'alice'
                  ? 'bg-blue-100 text-gray-800 rounded-tl-none'
                  : 'bg-gray-300 text-gray-900 rounded-tr-none'
              }`}
            >
              <p className="text-sm">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4 space-y-4">
        {/* Voice Button */}
        <div className="flex justify-center">
          <VoiceButton
            isListening={isListening}
            onStart={handleVoiceInput}
            onStop={handleVoiceInput}
            size={80}
          />
        </div>

        {isListening && transcript && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">You said:</span> {transcript}
            </p>
          </div>
        )}

        {/* Text Input */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleTextSend()}
            placeholder="Or type your answer here..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            disabled={loading}
          />
          <button
            onClick={handleTextSend}
            disabled={loading || !inputText.trim()}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-smooth font-semibold"
          >
            Send
          </button>
        </div>

        {!supported && (
          <p className="text-xs text-amber-600 text-center">
            Voice input not supported on this device. Please use text input.
          </p>
        )}
      </div>
    </div>
  );
}
