'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const MOCK_VOCABULARY = [
  {
    id: 1,
    word: 'caterpillar',
    pos: 'noun',
    definition: 'A small creature with many legs that becomes a butterfly',
    contextSentence: 'The caterpillar ate leaves all day.',
    synonyms: ['larva', 'grub'],
    antonyms: [],
    masteryLevel: 2,
    useCount: 5,
  },
  {
    id: 2,
    word: 'metamorphosis',
    pos: 'noun',
    definition: 'A complete change or transformation',
    contextSentence: 'The caterpillar went through metamorphosis.',
    synonyms: ['transformation', 'change'],
    antonyms: [],
    masteryLevel: 1,
    useCount: 2,
  },
  {
    id: 3,
    word: 'journey',
    pos: 'noun',
    definition: 'A trip or adventure from one place to another',
    contextSentence: 'It was a long and interesting journey.',
    synonyms: ['trip', 'voyage'],
    antonyms: [],
    masteryLevel: 3,
    useCount: 3,
  },
  {
    id: 4,
    word: 'devour',
    pos: 'verb',
    definition: 'To eat quickly and with great appetite',
    contextSentence: 'He devoured all the food in the forest.',
    synonyms: ['eat', 'consume'],
    antonyms: [],
    masteryLevel: 1,
    useCount: 1,
  },
  {
    id: 5,
    word: 'beautiful',
    pos: 'adjective',
    definition: 'Pleasing to look at; attractive',
    contextSentence: 'The butterfly was beautiful and colorful.',
    synonyms: ['lovely', 'pretty'],
    antonyms: ['ugly', 'plain'],
    masteryLevel: 4,
    useCount: 4,
  },
];

const PRACTICE_MODES = {
  FLIP_CARD: 'flipCard',
  SYNONYM_MATCH: 'synonymMatch',
  FILL_BLANK: 'fillBlank',
  SPEAK_WORD: 'speakWord',
};

const POS_COLORS = {
  noun: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Noun' },
  verb: { bg: 'bg-green-100', text: 'text-green-700', label: 'Verb' },
  adjective: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Adjective' },
  adverb: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Adverb' },
};

function getWordsBySpacedRepetition(vocabulary) {
  return vocabulary.filter((word) => {
    if (word.masteryLevel <= 2) return true; // Show every session
    if (word.masteryLevel === 3) return Math.random() > 0.5; // 50% chance every 2 sessions
    if (word.masteryLevel >= 4) return Math.random() > 0.66; // 33% chance every 3 sessions
    return false;
  });
}

function generateSynonymOptions(word, allWords) {
  const options = [word.word];
  const shuffled = [...allWords].filter((w) => w.id !== word.id).sort(() => Math.random() - 0.5);

  for (let i = 0; i < 3 && options.length < 4; i++) {
    if (shuffled[i] && !options.includes(shuffled[i].word)) {
      options.push(shuffled[i].word);
    }
  }

  return options.sort(() => Math.random() - 0.5);
}

export default function VocabularyPage() {
  const router = useRouter();
  const [vocabulary, setVocabulary] = useState([]);
  const [filteredVocabulary, setFilteredVocabulary] = useState([]);
  const [mode, setMode] = useState(PRACTICE_MODES.FLIP_CARD);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [streak, setStreak] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [isListening, setIsListening] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState(''); // 'correct' or 'incorrect'
  const [fillBlankAnswer, setFillBlankAnswer] = useState('');
  const [synonymOptions, setSynonymOptions] = useState([]);
  const [selectedSynonym, setSelectedSynonym] = useState(null);

  // Fetch vocabulary data
  useEffect(() => {
    const fetchVocabulary = async () => {
      try {
        setLoading(true);

        // Try to get from API
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        try {
          const response = await fetch(
            `${apiUrl}/api/vocabulary`,
            { signal: AbortSignal.timeout(5000) }
          );

          if (response.ok) {
            const data = await response.json();
            setVocabulary(data.vocabulary || MOCK_VOCABULARY);
          } else {
            setVocabulary(MOCK_VOCABULARY);
          }
        } catch (error) {
          console.warn('API unavailable, using mock vocabulary:', error);
          setVocabulary(MOCK_VOCABULARY);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchVocabulary();
  }, []);

  // Apply spaced repetition and set up session
  useEffect(() => {
    if (vocabulary.length > 0) {
      const filtered = getWordsBySpacedRepetition(vocabulary);
      setFilteredVocabulary(filtered.length > 0 ? filtered : vocabulary);
      setScore({ correct: 0, total: filtered.length > 0 ? filtered.length : vocabulary.length });
    }
  }, [vocabulary]);

  // Update synonym options when mode or current word changes
  useEffect(() => {
    if (mode === PRACTICE_MODES.SYNONYM_MATCH && filteredVocabulary.length > 0) {
      const currentWord = filteredVocabulary[currentWordIndex];
      const options = generateSynonymOptions(currentWord, vocabulary);
      setSynonymOptions(options);
      setSelectedSynonym(null);
    }
  }, [mode, currentWordIndex, vocabulary, filteredVocabulary]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <p className="text-gray-500 text-lg">Loading vocabulary...</p>
      </div>
    );
  }

  if (filteredVocabulary.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="bg-white rounded-lg shadow-md p-8 text-center max-w-md">
          <p className="text-gray-600 text-lg mb-4">No words to practice right now!</p>
          <p className="text-gray-500 text-sm mb-6">Complete a reading session to start practicing vocabulary.</p>
          <button
            onClick={() => router.push('/books')}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-600 transition-all font-semibold"
          >
            Read a Book
          </button>
        </div>
      </div>
    );
  }

  if (sessionComplete) {
    const correctAnswers = score.correct;
    const totalAnswers = score.total;
    const accuracy = Math.round((correctAnswers / totalAnswers) * 100);

    return (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center py-12 px-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Great Job!</h2>
          <p className="text-gray-600 mb-6">
            You completed the vocabulary practice session.
          </p>

          <div className="bg-blue-50 rounded-lg p-6 mb-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-success">{correctAnswers}</div>
                <p className="text-gray-600 text-xs mt-1">Correct</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-400">{totalAnswers - correctAnswers}</div>
                <p className="text-gray-600 text-xs mt-1">Incorrect</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-accent">{accuracy}%</div>
                <p className="text-gray-600 text-xs mt-1">Accuracy</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.push('/review')}
              className="w-full py-3 px-6 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
            >
              View Review
            </button>
            <button
              onClick={() => {
                setCurrentWordIndex(0);
                setIsFlipped(false);
                setStreak(0);
                setScore({ correct: 0, total: filteredVocabulary.length });
                setSessionComplete(false);
                setUserAnswer('');
                setFillBlankAnswer('');
                setSelectedSynonym(null);
              }}
              className="w-full py-3 px-6 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
            >
              Practice Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentWord = filteredVocabulary[currentWordIndex];
  const posColor = POS_COLORS[currentWord.pos] || POS_COLORS.noun;
  const progressPercent = ((currentWordIndex + 1) / filteredVocabulary.length) * 100;

  const handleFlipCard = () => {
    setIsFlipped(!isFlipped);
  };

  const handleMoveToNext = () => {
    if (currentWordIndex < filteredVocabulary.length - 1) {
      setCurrentWordIndex(currentWordIndex + 1);
      setIsFlipped(false);
      setUserAnswer('');
      setFillBlankAnswer('');
      setSelectedSynonym(null);
      setShowFeedback(false);
    } else {
      setSessionComplete(true);
    }
  };

  const handleCorrectAnswer = () => {
    setScore((prev) => ({ correct: prev.correct + 1, total: prev.total }));
    setStreak(streak + 1);
    setFeedbackType('correct');
    setShowFeedback(true);

    setTimeout(() => {
      handleMoveToNext();
      setShowFeedback(false);
    }, 1500);
  };

  const handleIncorrectAnswer = () => {
    setStreak(0);
    setFeedbackType('incorrect');
    setShowFeedback(true);

    setTimeout(() => {
      handleMoveToNext();
      setShowFeedback(false);
    }, 1500);
  };

  const startSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.start();

      setIsListening(true);

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        setUserAnswer(transcript);
        setIsListening(false);

        // Check if word is spoken correctly
        if (transcript.includes(currentWord.word.toLowerCase())) {
          handleCorrectAnswer();
        } else {
          handleIncorrectAnswer();
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };
    } else {
      alert('Speech recognition not supported on this device');
    }
  };

  const handleFillBlankSubmit = () => {
    if (fillBlankAnswer.toLowerCase().trim() === currentWord.word.toLowerCase()) {
      handleCorrectAnswer();
    } else {
      handleIncorrectAnswer();
    }
  };

  const handleSynonymSelect = (selectedWord) => {
    setSelectedSynonym(selectedWord);
    if (selectedWord === currentWord.word) {
      handleCorrectAnswer();
    } else {
      handleIncorrectAnswer();
    }
  };

  return (
    <div className="py-8 max-w-2xl mx-auto px-4">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Vocabulary Practice</h2>
        <p className="text-gray-600">Practice {filteredVocabulary.length} word(s) with spaced repetition</p>
      </div>

      {/* Mode Selector */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-8">
        <p className="text-sm font-semibold text-gray-700 mb-3">Practice Mode:</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={() => {
              setMode(PRACTICE_MODES.FLIP_CARD);
              setIsFlipped(false);
            }}
            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === PRACTICE_MODES.FLIP_CARD
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Flip Card
          </button>
          <button
            onClick={() => {
              setMode(PRACTICE_MODES.SYNONYM_MATCH);
              setSelectedSynonym(null);
            }}
            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === PRACTICE_MODES.SYNONYM_MATCH
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Synonym Match
          </button>
          <button
            onClick={() => {
              setMode(PRACTICE_MODES.FILL_BLANK);
              setFillBlankAnswer('');
            }}
            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === PRACTICE_MODES.FILL_BLANK
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Fill Blank
          </button>
          <button
            onClick={() => {
              setMode(PRACTICE_MODES.SPEAK_WORD);
              setUserAnswer('');
            }}
            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === PRACTICE_MODES.SPEAK_WORD
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Speak Word
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-gray-700">
            Word {currentWordIndex + 1} of {filteredVocabulary.length}
          </span>
          <span className="text-sm font-semibold text-accent">Streak: {streak} 🔥</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      {/* Main Practice Area */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        {/* Feedback Animation */}
        {showFeedback && (
          <div className={`p-4 text-center font-bold text-white ${feedbackType === 'correct' ? 'bg-success' : 'bg-danger'}`}>
            {feedbackType === 'correct' ? '✓ Correct!' : '✗ Try Again!'}
          </div>
        )}

        <div className="p-8">
          {/* Flip Card Mode */}
          {mode === PRACTICE_MODES.FLIP_CARD && (
            <div>
              <div
                onClick={!isFlipped ? handleFlipCard : undefined}
                className={`min-h-64 bg-gradient-to-br from-primary to-blue-600 rounded-lg shadow-lg flex items-center justify-center mb-6 ${!isFlipped ? 'cursor-pointer transform transition-transform hover:scale-105' : ''}`}
              >
                <div className="text-center text-white p-8">
                  {!isFlipped ? (
                    <div>
                      <p className="text-sm font-semibold mb-4 opacity-75">Tap to reveal</p>
                      <p className="text-5xl font-bold mb-4">{currentWord.word}</p>
                      <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${posColor.bg} ${posColor.text}`}>
                        {posColor.label}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-semibold mb-4">{currentWord.definition}</p>
                      <p className="text-sm italic opacity-90 mb-6">"{currentWord.contextSentence}"</p>
                      {currentWord.synonyms.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-2">Similar words:</p>
                          <p className="text-sm">{currentWord.synonyms.join(', ')}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Know / Still Learning buttons — shown after card is flipped */}
              {isFlipped && (
                <div className="flex gap-4">
                  <button
                    onClick={handleIncorrectAnswer}
                    className="flex-1 py-3 rounded-lg font-semibold text-white bg-red-400 hover:bg-red-500 transition-colors min-h-touch-min"
                  >
                    Still Learning
                  </button>
                  <button
                    onClick={handleCorrectAnswer}
                    className="flex-1 py-3 rounded-lg font-semibold text-white bg-green-500 hover:bg-green-600 transition-colors min-h-touch-min"
                  >
                    I Know It ✓
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Synonym Match Mode */}
          {mode === PRACTICE_MODES.SYNONYM_MATCH && (
            <div>
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-2">Which word is a synonym for:</p>
                <p className="text-3xl font-bold text-primary mb-2">{currentWord.word}</p>
                <p className="text-sm text-gray-600 italic">"{currentWord.contextSentence}"</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {synonymOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleSynonymSelect(option)}
                    disabled={selectedSynonym !== null}
                    className={`p-4 rounded-lg border-2 font-semibold transition-all text-lg min-h-touch-min ${
                      selectedSynonym === option
                        ? option === currentWord.word
                          ? 'border-success bg-success-light text-white'
                          : 'border-danger bg-danger-light text-white'
                        : 'border-gray-300 bg-white text-gray-800 hover:border-primary hover:bg-blue-50'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fill in the Blank Mode */}
          {mode === PRACTICE_MODES.FILL_BLANK && (
            <div>
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-4">Complete the sentence:</p>
                <p className="text-lg text-gray-800 p-4 bg-gray-100 rounded-lg">
                  {currentWord.contextSentence.replace(currentWord.word, '_______')}
                </p>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  value={fillBlankAnswer}
                  onChange={(e) => setFillBlankAnswer(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleFillBlankSubmit()}
                  placeholder="Type the missing word..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-lg min-h-touch-min"
                  disabled={selectedSynonym !== null}
                  autoFocus
                />
                <button
                  onClick={handleFillBlankSubmit}
                  disabled={!fillBlankAnswer.trim() || selectedSynonym !== null}
                  className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-all font-semibold min-h-touch-min"
                >
                  Check Answer
                </button>
              </div>
            </div>
          )}

          {/* Speak Word Mode */}
          {mode === PRACTICE_MODES.SPEAK_WORD && (
            <div>
              <div className="mb-6 text-center">
                <p className="text-sm font-semibold text-gray-700 mb-4">Speak the word:</p>
                <p className="text-5xl font-bold text-primary mb-4">{currentWord.word}</p>
                <p className="text-sm text-gray-600 italic">"{currentWord.contextSentence}"</p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={startSpeechRecognition}
                  disabled={isListening || selectedSynonym !== null}
                  className={`w-full px-6 py-4 rounded-lg font-semibold text-white min-h-touch-min transition-all ${
                    isListening
                      ? 'bg-danger animate-pulse'
                      : 'bg-primary hover:bg-blue-600'
                  }`}
                >
                  {isListening ? '🎤 Listening...' : '🎤 Tap to Speak'}
                </button>

                {userAnswer && (
                  <div className="bg-blue-50 border-l-4 border-primary p-4 rounded">
                    <p className="text-sm font-semibold text-gray-700 mb-1">You said:</p>
                    <p className="text-lg text-gray-800">"{userAnswer}"</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-4 justify-center">
        <button
          onClick={() => router.push('/review')}
          className="px-8 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-all font-semibold min-h-touch-min"
        >
          Exit Practice
        </button>
        {selectedSynonym !== null || (mode !== PRACTICE_MODES.SYNONYM_MATCH && mode !== PRACTICE_MODES.SPEAK_WORD && showFeedback) || (mode === PRACTICE_MODES.FILL_BLANK && selectedSynonym !== null) ? (
          <button
            onClick={handleMoveToNext}
            className="px-8 py-3 bg-primary text-white rounded-lg hover:bg-blue-600 transition-all font-semibold min-h-touch-min"
          >
            {currentWordIndex < filteredVocabulary.length - 1 ? 'Next Word' : 'Finish'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
