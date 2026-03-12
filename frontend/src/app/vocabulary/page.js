'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  getStudentVocabulary,
  getVocabDueToday,
  getVocabStats,
  recordPracticeResult,
} from '@/services/api';
import LoadingCard from '@/components/LoadingCard';
import { getItem, setItem } from '@/lib/clientStorage';

const MOCK_VOCABULARY = [
  { id: 1, word: 'caterpillar', pos: 'noun', definition: 'A small creature with many legs that becomes a butterfly', contextSentence: 'The caterpillar ate leaves all day.', synonyms: ['larva', 'grub'], antonyms: [], masteryLevel: 2, useCount: 5 },
  { id: 2, word: 'metamorphosis', pos: 'noun', definition: 'A complete change or transformation', contextSentence: 'The caterpillar went through metamorphosis.', synonyms: ['transformation', 'change'], antonyms: [], masteryLevel: 1, useCount: 2 },
  { id: 3, word: 'journey', pos: 'noun', definition: 'A trip or adventure from one place to another', contextSentence: 'It was a long and interesting journey.', synonyms: ['trip', 'voyage'], antonyms: [], masteryLevel: 3, useCount: 3 },
  { id: 4, word: 'devour', pos: 'verb', definition: 'To eat quickly and with great appetite', contextSentence: 'He devoured all the food in the forest.', synonyms: ['eat', 'consume'], antonyms: [], masteryLevel: 1, useCount: 1 },
  { id: 5, word: 'beautiful', pos: 'adjective', definition: 'Pleasing to look at; attractive', contextSentence: 'The butterfly was beautiful and colorful.', synonyms: ['lovely', 'pretty'], antonyms: ['ugly', 'plain'], masteryLevel: 4, useCount: 4 },
];

const PRACTICE_MODES = {
  FLIP_CARD: 'flipCard',
  SYNONYM_MATCH: 'synonymMatch',
  FILL_BLANK: 'fillBlank',
  SPEAK_WORD: 'speakWord',
};

const POS_COLORS = {
  noun: { bg: 'bg-[#E8F0E8]', text: 'text-[#3D6B3D]', label: 'Noun' },
  verb: { bg: 'bg-[#E8F5E8]', text: 'text-[#5C8B5C]', label: 'Verb' },
  adjective: { bg: 'bg-[#E8E0F0]', text: 'text-[#6A4B7A]', label: 'Adjective' },
  adverb: { bg: 'bg-[#FFF0D8]', text: 'text-[#A8822E]', label: 'Adverb' },
};

function getWordsBySpacedRepetition(vocabulary, dueIds = []) {
  // If server returned due-today IDs, use those first
  if (dueIds.length > 0) {
    const dueWords = vocabulary.filter((w) => dueIds.includes(w.id));
    const remaining = vocabulary.filter((w) => !dueIds.includes(w.id));
    return [...dueWords, ...remaining];
  }

  // Client-side spaced repetition fallback
  return vocabulary.filter((word) => {
    if (word.masteryLevel <= 2) return true;
    if (word.masteryLevel === 3) return Math.random() > 0.5;
    if (word.masteryLevel >= 4) return Math.random() > 0.66;
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
  const [dueCount, setDueCount] = useState(0);
  const [mode, setMode] = useState(PRACTICE_MODES.FLIP_CARD);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [streak, setStreak] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [isListening, setIsListening] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState('');
  const [fillBlankAnswer, setFillBlankAnswer] = useState('');
  const [synonymOptions, setSynonymOptions] = useState([]);
  const [selectedSynonym, setSelectedSynonym] = useState(null);
  const [speechNotSupported, setSpeechNotSupported] = useState(false);
  const [vocabStats, setVocabStats] = useState(null);

  // Track card flip time for response time measurement
  const cardFlipTimeRef = useRef(null);

  /**
   * Normalize a vocabulary record from the backend (snake_case) to the
   * camelCase shape the UI components expect.
   */
  function normalizeVocabWord(v) {
    return {
      id: v.id,
      word: v.word,
      pos: v.pos || 'noun',
      definition: v.definition || v.context_sentence || v.contextSentence || '',
      contextSentence: v.context_sentence || v.contextSentence || '',
      synonyms: v.synonyms || [],
      antonyms: v.antonyms || [],
      masteryLevel: v.mastery_level ?? v.masteryLevel ?? 1,
      useCount: v.use_count ?? v.useCount ?? 1,
    };
  }

  useEffect(() => {
    const fetchVocabulary = async () => {
      try {
        setLoading(true);
        setUsingFallback(false);

        const studentId = getItem('studentId');

        if (!studentId) {
          // No studentId — try sessionStorage vocabulary, then mock
          setUsingFallback(true);
          const sessionVocab = getVocabFromSessionStorage();
          setVocabulary(sessionVocab.length > 0 ? sessionVocab : MOCK_VOCABULARY);
          setLoading(false);
          return;
        }

        // Fetch vocabulary, due-today, and stats in parallel
        let vocabData = null;
        let dueData = null;
        let statsData = null;
        let dueIds = [];

        try {
          [vocabData, dueData, statsData] = await Promise.all([
            getStudentVocabulary(studentId),
            getVocabDueToday(studentId),
            getVocabStats(studentId),
          ]);

          if (dueData && dueData.words) {
            dueIds = dueData.words.map((w) => w.id);
            setDueCount(dueData.count || dueData.words.length || 0);
          }

          if (statsData && statsData.stats) {
            setVocabStats(statsData.stats);
          }
        } catch (apiErr) {
          console.warn('API unavailable, falling back to sessionStorage vocab:', apiErr);
          setUsingFallback(true);
        }

        // Backend GET /vocabulary/:studentId returns { vocabulary: [...], stats: { ... } }
        if (vocabData && vocabData.vocabulary && Array.isArray(vocabData.vocabulary) && vocabData.vocabulary.length > 0) {
          setVocabulary(vocabData.vocabulary.map(normalizeVocabWord));
        } else if (vocabData && vocabData.words && vocabData.words.length > 0) {
          setVocabulary(vocabData.words.map(normalizeVocabWord));
        } else {
          // Fallback chain: sessionStorage -> mock
          setUsingFallback(true);
          const sessionVocab = getVocabFromSessionStorage();
          setVocabulary(sessionVocab.length > 0 ? sessionVocab : MOCK_VOCABULARY);
        }

        // Store due IDs for spaced repetition ordering
        if (dueIds.length > 0) {
          setItem('dueVocabIds', JSON.stringify(dueIds));
        }
      } catch (err) {
        console.error('Unexpected error loading vocabulary:', err);
        setUsingFallback(true);
        const sessionVocab = getVocabFromSessionStorage();
        setVocabulary(sessionVocab.length > 0 ? sessionVocab : MOCK_VOCABULARY);
      } finally {
        setLoading(false);
      }
    };

    fetchVocabulary();
  }, []);

  function getVocabFromSessionStorage() {
    try {
      const sessionDataStr = getItem('lastSessionData');
      const reviewDataStr = getItem('lastReviewData');

      if (reviewDataStr) {
        const reviewData = JSON.parse(reviewDataStr);
        if (reviewData.vocabulary && reviewData.vocabulary.length > 0) {
          return reviewData.vocabulary;
        }
      }

      if (sessionDataStr) {
        const sessionData = JSON.parse(sessionDataStr);
        return sessionData.vocabulary || sessionData.words || [];
      }
    } catch (e) {
      console.warn('Failed to read vocab from sessionStorage:', e);
    }
    return [];
  }

  useEffect(() => {
    if (vocabulary.length > 0) {
      let dueIds = [];
      try {
        const stored = getItem('dueVocabIds');
        if (stored) dueIds = JSON.parse(stored);
      } catch (e) {
        // ignore
      }
      const filtered = getWordsBySpacedRepetition(vocabulary, dueIds);
      setFilteredVocabulary(filtered.length > 0 ? filtered : vocabulary);
      setScore({ correct: 0, total: filtered.length > 0 ? filtered.length : vocabulary.length });
    }
  }, [vocabulary]);

  useEffect(() => {
    if (mode === PRACTICE_MODES.SYNONYM_MATCH && filteredVocabulary.length > 0) {
      const currentWord = filteredVocabulary[currentWordIndex];
      const options = generateSynonymOptions(currentWord, vocabulary);
      setSynonymOptions(options);
      setSelectedSynonym(null);
    }
  }, [mode, currentWordIndex, vocabulary, filteredVocabulary]);

  // Track when card is flipped (for response time measurement)
  const handleFlipCard = () => {
    setIsFlipped(!isFlipped);
    if (!isFlipped) {
      cardFlipTimeRef.current = Date.now();
    }
  };

  const handleMoveToNext = () => {
    if (currentWordIndex < filteredVocabulary.length - 1) {
      setCurrentWordIndex(currentWordIndex + 1);
      setIsFlipped(false);
      setUserAnswer('');
      setFillBlankAnswer('');
      setSelectedSynonym(null);
      setShowFeedback(false);
      cardFlipTimeRef.current = null;
    } else {
      setSessionComplete(true);
    }
  };

  const handleCorrectAnswer = async () => {
    setScore((prev) => ({ correct: prev.correct + 1, total: prev.total }));
    setStreak(streak + 1);
    setFeedbackType('correct');
    setShowFeedback(true);

    // Record result to backend for spaced repetition
    await sendPracticeResult(true);

    setTimeout(() => { handleMoveToNext(); setShowFeedback(false); }, 1500);
  };

  const handleIncorrectAnswer = async () => {
    setStreak(0);
    setFeedbackType('incorrect');
    setShowFeedback(true);

    // Record result to backend for spaced repetition
    await sendPracticeResult(false);

    setTimeout(() => { handleMoveToNext(); setShowFeedback(false); }, 1500);
  };

  async function sendPracticeResult(isCorrect) {
    const studentId = getItem('studentId');
    if (!studentId) return;

    const currentWord = filteredVocabulary[currentWordIndex];
    if (!currentWord) return;

    const responseTimeMs = cardFlipTimeRef.current
      ? Date.now() - cardFlipTimeRef.current
      : null;

    // Fire-and-forget — don't block the UI
    recordPracticeResult(studentId, currentWord.id, isCorrect, responseTimeMs).catch((err) => {
      console.warn('Failed to record practice result:', err);
    });
  }

  const startSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setSpeechNotSupported(false);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.start();
      setIsListening(true);

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        setUserAnswer(transcript);
        setIsListening(false);
        if (transcript.includes(currentWord.word.toLowerCase())) {
          handleCorrectAnswer();
        } else {
          handleIncorrectAnswer();
        }
      };

      recognition.onerror = () => setIsListening(false);
    } else {
      setSpeechNotSupported(true);
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

  const MODE_LABELS = {
    [PRACTICE_MODES.FLIP_CARD]: 'Flip Card',
    [PRACTICE_MODES.SYNONYM_MATCH]: 'Synonym Match',
    [PRACTICE_MODES.FILL_BLANK]: 'Fill Blank',
    [PRACTICE_MODES.SPEAK_WORD]: 'Speak Word',
  };

  if (loading) {
    return (
      <div className="py-8 max-w-2xl mx-auto px-4 space-y-4">
        <LoadingCard lines={2} />
        <LoadingCard lines={5} />
      </div>
    );
  }

  if (filteredVocabulary.length === 0) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="ghibli-card p-8 text-center max-w-md">
          <div className="text-4xl mb-4">🌱</div>
          <p className="text-[#6B5744] font-bold text-lg mb-2">No words to practice right now!</p>
          <p className="text-[#6B5744] text-sm font-semibold mb-6">Complete a reading session to start practicing vocabulary.</p>
          <button
            onClick={() => router.push('/books')}
            className="px-6 py-3 bg-[#5C8B5C] text-white rounded-2xl hover:bg-[#3D6B3D] transition-all font-bold hover:-translate-y-0.5"
          >
            Go to Library
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
        <div className="ghibli-card p-8 max-w-md text-center">
          <div className="text-6xl mb-4 float-animation inline-block">🎉</div>
          <h2 className="text-2xl font-extrabold text-[#3D2E1E] mb-2">Great Job!</h2>
          <p className="text-[#6B5744] font-semibold mb-6">You completed the vocabulary practice session.</p>

          <div className="bg-[#F5F0E8] rounded-2xl p-6 mb-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-extrabold text-[#7AC87A]">{correctAnswers}</div>
                <p className="text-[#6B5744] text-xs font-bold mt-1">Correct</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-extrabold text-[#D4736B]">{totalAnswers - correctAnswers}</div>
                <p className="text-[#6B5744] text-xs font-bold mt-1">Incorrect</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-extrabold text-[#D4A843]">{accuracy}%</div>
                <p className="text-[#6B5744] text-xs font-bold mt-1">Accuracy</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.push('/review')}
              className="w-full py-3 px-6 bg-[#5C8B5C] text-white rounded-2xl hover:bg-[#3D6B3D] transition-colors font-bold hover:-translate-y-0.5"
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
                cardFlipTimeRef.current = null;
              }}
              className="w-full py-3 px-6 bg-[#EDE5D4] text-[#6B5744] rounded-2xl hover:bg-[#D6C9A8] transition-colors font-bold hover:-translate-y-0.5"
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

  return (
    <div className="py-8 max-w-2xl mx-auto px-4">
      {/* Fallback notice */}
      {usingFallback && (
        <div className="mb-4 px-4 py-3 bg-[#FFF8E8] border-l-4 border-[#D4A843] rounded-xl">
          <p className="text-sm font-bold text-[#A8822E]">
            Showing saved vocabulary. Connect to the internet to load your full word list.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-[#3D2E1E] mb-2">Vocabulary Practice</h2>
          <p className="text-[#6B5744] font-semibold">
            Practice {filteredVocabulary.length} word(s) with spaced repetition
          </p>
        </div>
        {dueCount > 0 && (
          <div className="flex-shrink-0 ml-4 px-3 py-2 bg-[#D4A843] text-white rounded-xl text-sm font-bold shadow-[0_2px_8px_rgba(212,168,67,0.3)]">
            {dueCount} due today
          </div>
        )}
      </div>

      {/* Vocabulary Stats from API */}
      {vocabStats && (
        <div className="ghibli-card p-4 mb-6">
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-2 bg-[#F5F0E8] rounded-xl">
              <div className="text-2xl font-extrabold text-[#5C8B5C]">{vocabStats.totalWords || 0}</div>
              <p className="text-[#6B5744] text-xs font-bold mt-1">Total Words</p>
            </div>
            <div className="text-center p-2 bg-[#F5F0E8] rounded-xl">
              <div className="text-2xl font-extrabold text-[#7AC87A]">{vocabStats.masteredWords || 0}</div>
              <p className="text-[#6B5744] text-xs font-bold mt-1">Mastered</p>
            </div>
            <div className="text-center p-2 bg-[#F5F0E8] rounded-xl">
              <div className="text-2xl font-extrabold text-[#D4A843]">{vocabStats.learningWords || 0}</div>
              <p className="text-[#6B5744] text-xs font-bold mt-1">Learning</p>
            </div>
            <div className="text-center p-2 bg-[#F5F0E8] rounded-xl">
              <div className="text-2xl font-extrabold text-[#D4736B]">{vocabStats.dueToday || 0}</div>
              <p className="text-[#6B5744] text-xs font-bold mt-1">Due Today</p>
            </div>
          </div>
        </div>
      )}

      {/* Mode Selector */}
      <div className="ghibli-card p-4 mb-6">
        <p className="text-sm font-extrabold text-[#6B5744] mb-3">Practice Mode:</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(PRACTICE_MODES).map(([key, value]) => (
            <button
              key={value}
              onClick={() => {
                setMode(value);
                setIsFlipped(false);
                setSelectedSynonym(null);
                setFillBlankAnswer('');
                setUserAnswer('');
                cardFlipTimeRef.current = null;
              }}
              className={`px-3 py-2 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 ${
                mode === value
                  ? 'bg-[#5C8B5C] text-white shadow-[0_2px_8px_rgba(92,139,92,0.3)]'
                  : 'bg-[#EDE5D4] text-[#6B5744] hover:bg-[#D6C9A8]'
              }`}
            >
              {MODE_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-bold text-[#6B5744]">
            Word {currentWordIndex + 1} of {filteredVocabulary.length}
          </span>
          <span className="text-sm font-extrabold text-[#D4A843]">
            {streak > 0 && `Streak: ${streak}`} {streak >= 3 ? '🔥' : streak > 0 ? '⭐' : ''}
          </span>
        </div>
        <div className="w-full bg-[#EDE5D4] rounded-full h-3 overflow-hidden">
          <div
            className="bg-[#D4A843] h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Practice Area */}
      <div className="ghibli-card overflow-hidden mb-6">
        {/* Feedback Animation */}
        {showFeedback && (
          <div
            className={`p-4 text-center font-extrabold text-white ${
              feedbackType === 'correct' ? 'bg-[#7AC87A]' : 'bg-[#D4736B]'
            }`}
          >
            {feedbackType === 'correct' ? 'Got it! Great work!' : 'Keep practicing — you can do it!'}
          </div>
        )}

        <div className="p-8">
          {/* Flip Card Mode */}
          {mode === PRACTICE_MODES.FLIP_CARD && (
            <div>
              <div
                role="button"
                tabIndex={!isFlipped ? 0 : -1}
                aria-label={!isFlipped ? `Flip card to reveal definition of ${currentWord.word}` : `Definition of ${currentWord.word}: ${currentWord.definition}`}
                onClick={!isFlipped ? handleFlipCard : undefined}
                onKeyDown={(e) => {
                  if (!isFlipped && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleFlipCard();
                  }
                }}
                className={`min-h-64 rounded-2xl shadow-lg flex items-center justify-center mb-6 ${
                  !isFlipped
                    ? 'bg-gradient-to-br from-[#5C8B5C] to-[#3D6B3D] cursor-pointer hover:-translate-y-1 transition-transform focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-[#3D6B3D]'
                    : 'bg-gradient-to-br from-[#87CEDB] to-[#5BA8B8]'
                }`}
              >
                <div className="text-center text-white p-8">
                  {!isFlipped ? (
                    <div>
                      <p className="text-sm font-bold mb-4 opacity-80">Tap to reveal</p>
                      <p className="text-5xl font-extrabold mb-4">{currentWord.word}</p>
                      <span className="inline-block px-4 py-2 rounded-full text-sm font-bold bg-white bg-opacity-20 text-white">
                        {posColor.label}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-bold mb-4">{currentWord.definition}</p>
                      <p className="text-sm italic opacity-90 mb-6">&quot;{currentWord.contextSentence}&quot;</p>
                      {(currentWord.synonyms || []).length > 0 && (
                        <div>
                          <p className="text-xs font-bold mb-2 opacity-80">Similar words:</p>
                          <p className="text-sm font-semibold">{currentWord.synonyms.join(', ')}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Got it / Need practice buttons — shown after flip */}
              {isFlipped && (
                <div className="flex gap-4">
                  <button
                    onClick={handleIncorrectAnswer}
                    className="flex-1 py-4 rounded-2xl font-extrabold text-white bg-[#D4736B] hover:bg-[#B85A53] transition-all min-h-[56px] hover:-translate-y-0.5 text-base"
                  >
                    Need more practice
                  </button>
                  <button
                    onClick={handleCorrectAnswer}
                    className="flex-1 py-4 rounded-2xl font-extrabold text-white bg-[#7AC87A] hover:bg-[#5C8B5C] transition-all min-h-[56px] hover:-translate-y-0.5 text-base"
                  >
                    Got it!
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Synonym Match Mode */}
          {mode === PRACTICE_MODES.SYNONYM_MATCH && (
            <div>
              <div className="mb-6">
                <p className="text-sm font-bold text-[#6B5744] mb-2">Which word is a synonym for:</p>
                <p className="text-3xl font-extrabold text-[#3D6B3D] mb-2">{currentWord.word}</p>
                <p className="text-sm text-[#6B5744] italic font-semibold">&quot;{currentWord.contextSentence}&quot;</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {synonymOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleSynonymSelect(option)}
                    disabled={selectedSynonym !== null}
                    className={`p-4 rounded-2xl border-2 font-extrabold transition-all text-lg min-h-[48px] hover:-translate-y-0.5 ${
                      selectedSynonym === option
                        ? option === currentWord.word
                          ? 'border-[#7AC87A] bg-[#C8E6C9] text-[#2E7D32]'
                          : 'border-[#D4736B] bg-[#FCE8E6] text-[#B85A53]'
                        : 'border-[#D6C9A8] bg-[#FFFCF3] text-[#3D2E1E] hover:border-[#5C8B5C] hover:bg-[#E8F5E8]'
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
                <p className="text-sm font-bold text-[#6B5744] mb-4">Complete the sentence:</p>
                <p className="text-lg text-[#3D2E1E] p-4 bg-[#F5F0E8] rounded-2xl border border-[#D6C9A8] font-semibold">
                  {currentWord.contextSentence.replace(new RegExp(currentWord.word, 'i'), '_______')}
                </p>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  value={fillBlankAnswer}
                  onChange={(e) => setFillBlankAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFillBlankSubmit()}
                  placeholder="Type the missing word..."
                  className="w-full px-4 py-3 border-2 border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] focus:border-transparent text-lg min-h-[48px] bg-[#FFFCF3] text-[#3D2E1E] font-semibold"
                  disabled={false}
                  autoFocus
                />
                <button
                  onClick={handleFillBlankSubmit}
                  disabled={!fillBlankAnswer.trim()}
                  className="w-full px-6 py-3 bg-[#5C8B5C] text-white rounded-2xl hover:bg-[#3D6B3D] disabled:bg-[#D6C9A8] transition-all font-extrabold min-h-[48px] hover:-translate-y-0.5"
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
                <p className="text-sm font-bold text-[#6B5744] mb-4">Speak the word:</p>
                <p className="text-5xl font-extrabold text-[#3D6B3D] mb-4">{currentWord.word}</p>
                <p className="text-sm text-[#6B5744] italic font-semibold">&quot;{currentWord.contextSentence}&quot;</p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={startSpeechRecognition}
                  disabled={isListening || selectedSynonym !== null}
                  className={`w-full px-6 py-4 rounded-2xl font-extrabold text-white min-h-[48px] transition-all hover:-translate-y-0.5 ${
                    isListening
                      ? 'bg-[#D4736B] animate-pulse'
                      : 'bg-[#5C8B5C] hover:bg-[#3D6B3D]'
                  }`}
                >
                  {isListening ? 'Listening...' : 'Tap to Speak'}
                </button>

                {speechNotSupported && (
                  <div role="alert" className="bg-[#FFF8E8] border-l-4 border-[#D4A843] p-4 rounded-xl">
                    <p className="text-sm font-bold text-[#6B5744]">
                      Speech recognition is not supported on this device. Please try a different practice mode.
                    </p>
                  </div>
                )}

                {userAnswer && (
                  <div className="bg-[#E8F5E8] border-l-4 border-[#5C8B5C] p-4 rounded-xl">
                    <p className="text-sm font-bold text-[#6B5744] mb-1">You said:</p>
                    <p className="text-lg text-[#3D2E1E] font-semibold">&quot;{userAnswer}&quot;</p>
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
          className="px-8 py-3 bg-[#EDE5D4] text-[#6B5744] rounded-2xl hover:bg-[#D6C9A8] transition-all font-bold min-h-[48px] hover:-translate-y-0.5"
        >
          Exit Practice
        </button>
        {selectedSynonym !== null ||
        (mode !== PRACTICE_MODES.SYNONYM_MATCH && mode !== PRACTICE_MODES.SPEAK_WORD && showFeedback) ||
        (mode === PRACTICE_MODES.FILL_BLANK && selectedSynonym !== null) ? (
          <button
            onClick={handleMoveToNext}
            className="px-8 py-3 bg-[#5C8B5C] text-white rounded-2xl hover:bg-[#3D6B3D] transition-all font-extrabold min-h-[48px] hover:-translate-y-0.5"
          >
            {currentWordIndex < filteredVocabulary.length - 1 ? 'Next Word' : 'Finish'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
