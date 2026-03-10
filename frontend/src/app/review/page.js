'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionReview, getSessionStageScores } from '@/services/api';
import LoadingCard from '@/components/LoadingCard';
import WorksheetPrint from '@/components/WorksheetPrint';
import BookRecommendation from '@/components/BookRecommendation';

const MOCK_REVIEW_DATA = {
  sessionId: 'session-001',
  bookTitle: 'The Very Hungry Caterpillar',
  studentName: 'Alice',
  completedAt: new Date().toISOString(),
  duration: 1200,
  turns: 8,
  levelScore: 78,
  grammarScore: 82,
  vocabulary: [
    { id: 1, word: 'caterpillar', pos: 'noun', contextSentence: 'The caterpillar ate leaves all day.', synonyms: ['larva', 'grub', 'worm'], antonyms: [], masteryLevel: 5, useCount: 5 },
    { id: 2, word: 'metamorphosis', pos: 'noun', contextSentence: 'The caterpillar went through metamorphosis.', synonyms: ['transformation', 'change', 'evolution'], antonyms: [], masteryLevel: 3, useCount: 2 },
    { id: 3, word: 'journey', pos: 'noun', contextSentence: 'It was a long and interesting journey.', synonyms: ['trip', 'voyage', 'adventure', 'expedition'], antonyms: [], masteryLevel: 4, useCount: 3 },
    { id: 4, word: 'transform', pos: 'verb', contextSentence: 'The butterfly transformed into a beautiful creature.', synonyms: ['change', 'convert', 'alter', 'modify'], antonyms: ['remain', 'stay', 'preserve'], masteryLevel: 4, useCount: 2 },
    { id: 5, word: 'beautiful', pos: 'adjective', contextSentence: 'The butterfly was beautiful and colorful.', synonyms: ['lovely', 'pretty', 'gorgeous', 'stunning'], antonyms: ['ugly', 'plain'], masteryLevel: 5, useCount: 4 },
    { id: 6, word: 'hungry', pos: 'adjective', contextSentence: 'The very hungry caterpillar wanted to eat everything.', synonyms: ['famished', 'ravenous', 'starving'], antonyms: ['full', 'satisfied'], masteryLevel: 5, useCount: 6 },
    { id: 7, word: 'devour', pos: 'verb', contextSentence: 'He devoured all the food in the forest.', synonyms: ['eat', 'consume', 'gobble'], antonyms: [], masteryLevel: 2, useCount: 1 },
    { id: 8, word: 'cocoon', pos: 'noun', contextSentence: 'The caterpillar built a cocoon to rest.', synonyms: ['chrysalis', 'silk case'], antonyms: [], masteryLevel: 3, useCount: 2 },
  ],
};

const MOCK_STAGE_BREAKDOWN = [
  { stage: 'Title', completed: true, wordCount: 1, grammarScore: 85, duration: 60 },
  { stage: 'Introduction', completed: true, wordCount: 2, grammarScore: 80, duration: 120 },
  { stage: 'Body', completed: true, wordCount: 3, grammarScore: 82, duration: 180 },
  { stage: 'Conclusion', completed: true, wordCount: 2, grammarScore: 85, duration: 90 },
];

const POS_COLORS = {
  noun: { bg: 'bg-[#E8F0E8]', text: 'text-[#3D6B3D]', label: 'Noun' },
  verb: { bg: 'bg-[#E8F5E8]', text: 'text-[#5C8B5C]', label: 'Verb' },
  adjective: { bg: 'bg-[#E8E0F0]', text: 'text-[#6A4B7A]', label: 'Adjective' },
  adverb: { bg: 'bg-[#FFF0D8]', text: 'text-[#A8822E]', label: 'Adverb' },
};

/**
 * Compact "Print Worksheet" button for the action bar.
 * Dispatches a custom event that WorksheetPrint listens to, so the
 * already-mounted panel handles the window.open + print() flow without
 * duplicating the document-building logic.
 */
function PrintWorksheetButton() {
  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('hialice:printWorksheet'));
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-6 py-3 bg-[#4A7C59] text-white rounded-2xl hover:bg-[#2C5A3A] transition-all font-bold hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(74,124,89,0.3)]"
      aria-label="Print reading worksheet as PDF"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-4 h-4 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4"
        />
      </svg>
      Print Worksheet
    </button>
  );
}

export default function ReviewPage() {
  const router = useRouter();
  const [review, setReview] = useState(null);
  const [vocabulary, setVocabulary] = useState([]);
  const [expandedWord, setExpandedWord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usingFallback, setUsingFallback] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [showConversation, setShowConversation] = useState(false);
  const [highlightedWord, setHighlightedWord] = useState(null);
  const [stageBreakdown, setStageBreakdown] = useState([]);
  const [achievementsEarned, setAchievementsEarned] = useState([]);
  const [showAchievements, setShowAchievements] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [worksheetAnswers, setWorksheetAnswers] = useState({});

  useEffect(() => {
    const fetchReview = async () => {
      try {
        setLoading(true);
        setUsingFallback(false);

        const sessionId = sessionStorage.getItem('sessionId');
        const bookTitle = sessionStorage.getItem('bookTitle');
        const studentName = sessionStorage.getItem('studentName');
        const conversationStr = sessionStorage.getItem('lastConversation');
        const sessionDataStr = sessionStorage.getItem('lastSessionData');

        if (!sessionId) {
          setError('No session found. Please complete a reading session first.');
          setLoading(false);
          return;
        }

        // Restore conversation from sessionStorage
        if (conversationStr) {
          try {
            setConversation(JSON.parse(conversationStr));
          } catch (e) {
            console.warn('Failed to parse conversation:', e);
          }
        }

        // Restore worksheetAnswers from sessionStorage
        if (sessionDataStr) {
          try {
            const sessionData = JSON.parse(sessionDataStr);
            if (sessionData.worksheetAnswers && typeof sessionData.worksheetAnswers === 'object') {
              setWorksheetAnswers(sessionData.worksheetAnswers);
            }
          } catch (e) {
            console.warn('Failed to parse worksheetAnswers:', e);
          }
        }

        // Fetch review data and stage scores in parallel
        let reviewData = null;
        let stageScoresData = null;

        try {
          [reviewData, stageScoresData] = await Promise.all([
            getSessionReview(sessionId),
            getSessionStageScores(sessionId),
          ]);
        } catch (apiErr) {
          console.warn('API fetch failed, falling back to sessionStorage:', apiErr);
          setUsingFallback(true);
        }

        // Phase 2B: Restore ai_feedback from sessionStorage as early fallback
        if (sessionDataStr) {
          try {
            const sessionData = JSON.parse(sessionDataStr);
            const storedFeedback = sessionData.ai_feedback || sessionData.aiFeedback || null;
            if (storedFeedback) {
              setAiFeedback(storedFeedback);
            }
          } catch (e) {
            console.warn('Failed to parse ai_feedback from sessionStorage:', e);
          }
        }

        // Process review data
        if (reviewData && reviewData.review) {
          const apiReview = reviewData.review;
          setReview({
            ...apiReview,
            bookTitle: apiReview.bookTitle || bookTitle || MOCK_REVIEW_DATA.bookTitle,
            studentName: apiReview.studentName || studentName || MOCK_REVIEW_DATA.studentName,
          });

          // Phase 2B: ai_feedback from API response takes priority over sessionStorage
          const apiFeedback = apiReview.ai_feedback || apiReview.aiFeedback || null;
          if (apiFeedback) {
            setAiFeedback(apiFeedback);
          }

          // Vocabulary from API takes priority
          const vocabList = apiReview.vocabulary || [];
          setVocabulary(vocabList.length > 0 ? vocabList : buildVocabFromSessionStorage(sessionDataStr));

          // Check for achievements from API
          if (apiReview.achievements && apiReview.achievements.length > 0) {
            setAchievementsEarned(apiReview.achievements);
            setShowAchievements(true);
          }
        } else {
          // Fallback to sessionStorage data
          setUsingFallback(true);
          const sessionVocab = buildVocabFromSessionStorage(sessionDataStr);
          const fallbackReview = {
            ...MOCK_REVIEW_DATA,
            bookTitle: bookTitle || MOCK_REVIEW_DATA.bookTitle,
            studentName: studentName || MOCK_REVIEW_DATA.studentName,
            vocabulary: sessionVocab.length > 0 ? sessionVocab : MOCK_REVIEW_DATA.vocabulary,
          };
          setReview(fallbackReview);
          setVocabulary(fallbackReview.vocabulary);
        }

        // Process stage scores
        if (stageScoresData && stageScoresData.stageScores && stageScoresData.stageScores.length > 0) {
          const apiStages = stageScoresData.stageScores.map((s) => ({
            stage: s.stage || s.stageName || 'Stage',
            completed: s.completed !== false,
            wordCount: s.wordCount || s.wordsLearned || 0,
            grammarScore: s.grammarScore || s.score || 0,
            duration: s.duration || s.durationSeconds || 0,
          }));
          setStageBreakdown(apiStages);
        } else {
          // Build stage breakdown from sessionStorage as fallback
          try {
            const sessionData = sessionDataStr ? JSON.parse(sessionDataStr) : null;
            if (sessionData && sessionData.stageBreakdown) {
              // Normalize: may be an array or an object keyed by stage name
              const raw = sessionData.stageBreakdown;
              if (Array.isArray(raw)) {
                setStageBreakdown(raw);
              } else if (typeof raw === 'object') {
                setStageBreakdown(
                  Object.entries(raw)
                    .filter(([, v]) => v !== null)
                    .map(([stage, scores]) => ({
                      stage: stage.charAt(0).toUpperCase() + stage.slice(1),
                      completed: true,
                      wordCount: scores.vocabulary || 0,
                      grammarScore: scores.grammar || 0,
                      duration: 0,
                    }))
                );
              } else {
                setStageBreakdown(MOCK_STAGE_BREAKDOWN);
              }
            } else {
              setStageBreakdown(MOCK_STAGE_BREAKDOWN);
            }
          } catch (e) {
            setStageBreakdown(MOCK_STAGE_BREAKDOWN);
          }
        }

        // Persist a backup of review data to sessionStorage
        if (reviewData && reviewData.review) {
          try {
            sessionStorage.setItem('lastReviewData', JSON.stringify(reviewData.review));
          } catch (e) {
            console.warn('Failed to cache review data:', e);
          }
        }
      } catch (err) {
        console.error('Unexpected error loading review:', err);
        setError('Oops! Something went wrong loading your review. Using saved data instead.');
        setUsingFallback(true);

        const bookTitle = sessionStorage.getItem('bookTitle');
        const studentName = sessionStorage.getItem('studentName');
        const mockData = {
          ...MOCK_REVIEW_DATA,
          bookTitle: bookTitle || MOCK_REVIEW_DATA.bookTitle,
          studentName: studentName || MOCK_REVIEW_DATA.studentName,
        };
        setReview(mockData);
        setVocabulary(mockData.vocabulary);
        setStageBreakdown(MOCK_STAGE_BREAKDOWN);
      } finally {
        setLoading(false);
      }
    };

    fetchReview();
  }, []);

  function buildVocabFromSessionStorage(sessionDataStr) {
    if (!sessionDataStr) return [];
    try {
      const sessionData = JSON.parse(sessionDataStr);
      return sessionData.vocabulary || sessionData.words || [];
    } catch (e) {
      return [];
    }
  }

  const renderStars = (level) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <span key={i} className={i < level ? 'text-[#D4A843]' : 'text-[#D6C9A8]'}>
        ★
      </span>
    ));
  };

  const renderWordCloud = () => {
    if (!vocabulary.length) return null;

    const useCounts = vocabulary.map((v) => v.useCount || 1);
    const minCount = Math.min(...useCounts);
    const maxCount = Math.max(...useCounts);
    const range = maxCount - minCount || 1;

    const calculateFontSize = (useCount) => {
      const ratio = ((useCount || 1) - minCount) / range;
      return 16 + ratio * 32;
    };

    const shuffled = [...vocabulary].sort(() => Math.random() - 0.5);
    const wordColors = ['#3D6B3D', '#5C8B5C', '#87CEDB', '#5BA8B8', '#D4A843'];

    return (
      <div className="flex flex-wrap gap-4 justify-center items-center py-8 px-4">
        {shuffled.map((vocab, idx) => (
          <div
            key={vocab.id || idx}
            style={{
              fontSize: `${calculateFontSize(vocab.useCount)}px`,
              transform: `rotate(${Math.random() * 10 - 5}deg)`,
              opacity: 0.7 + ((vocab.useCount || 1) / maxCount) * 0.3,
              color: wordColors[idx % wordColors.length],
            }}
            className="inline-block font-extrabold hover:opacity-100 transition-all cursor-pointer"
            title={`Used ${vocab.useCount || 1} time(s)`}
          >
            {vocab.word}
          </div>
        ))}
      </div>
    );
  };

  const totalWords = vocabulary.length;
  const newWords = vocabulary.filter((v) => (v.useCount || 1) === 1).length;
  const reviewWords = vocabulary.filter((v) => (v.useCount || 1) > 1).length;

  const groupedByPOS = vocabulary.reduce((acc, vocab) => {
    const pos = vocab.pos || 'noun';
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(vocab);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="py-8 space-y-4">
        <LoadingCard lines={2} />
        <LoadingCard lines={4} />
        <LoadingCard lines={3} />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="ghibli-card p-8 text-center max-w-md">
          <p className="text-[#D4736B] font-bold text-lg mb-4">
            {error || 'Could not load your review.'}
          </p>
          <button
            onClick={() => router.push('/books')}
            className="px-6 py-3 bg-[#5C8B5C] text-white rounded-2xl font-bold hover:-translate-y-0.5 transition-all"
          >
            Go Read a Book
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      {/* Fallback notice banner */}
      {usingFallback && !error && (
        <div className="mb-6 px-4 py-3 bg-[#FFF8E8] border-l-4 border-[#D4A843] rounded-xl">
          <p className="text-sm font-bold text-[#A8822E]">
            Showing your saved session data. Connect to the internet to sync your latest results.
          </p>
        </div>
      )}

      {/* Error notice (non-blocking) */}
      {error && usingFallback && (
        <div className="mb-6 px-4 py-3 bg-[#FFF8E8] border-l-4 border-[#D4A843] rounded-xl">
          <p className="text-sm font-bold text-[#A8822E]">{error}</p>
        </div>
      )}

      {/* Achievements Banner */}
      {showAchievements && achievementsEarned.length > 0 && (
        <div className="mb-6 ghibli-card p-6 bg-gradient-to-r from-[#D4A843] to-[#F5C842] text-white rounded-3xl">
          <h3 className="text-xl font-extrabold mb-3">New achievements unlocked!</h3>
          <div className="flex flex-wrap gap-3">
            {achievementsEarned.map((achievement, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-4 py-2 bg-white bg-opacity-25 rounded-full font-bold text-sm"
              >
                <span>{achievement.emoji || '🏆'}</span>
                <span>{achievement.label || achievement.name || achievement}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowAchievements(false)}
            className="mt-3 text-xs font-bold opacity-70 hover:opacity-100 transition-opacity"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Phase 2B: AI Personal Feedback Card */}
      {aiFeedback && (
        <div className="ghibli-card bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] border-2 border-[#F59E0B]/30 p-6 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-3xl flex-shrink-0" aria-hidden="true">🤖</div>
            <div>
              <h3 className="font-bold text-[#92400E] mb-2">Message from HiAlice</h3>
              <p className="text-[#78350F] text-sm leading-relaxed italic">
                &quot;{aiFeedback}&quot;
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-[#3D6B3D] mb-2">Reading Session Complete!</h2>
        <p className="text-[#6B5744] font-semibold">
          Great job, {review.studentName}! Here&apos;s what you learned reading &quot;{review.bookTitle}&quot;
        </p>
      </div>

      {/* Summary Card */}
      <div className="ghibli-card p-8 mb-6">
        <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-6">Session Summary</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <div className="mb-4">
              <p className="text-[#6B5744] text-sm font-bold mb-1">Book Title</p>
              <p className="text-lg font-extrabold text-[#3D2E1E]">{review.bookTitle}</p>
            </div>

            <div>
              <p className="text-[#6B5744] text-sm font-bold mb-2">Grammar Score</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-[#EDE5D4] rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-[#5C8B5C] h-full transition-all rounded-full"
                    style={{ width: `${review.grammarScore || 0}%` }}
                  />
                </div>
                <span className="text-lg font-extrabold text-[#5C8B5C]">{review.grammarScore || 0}%</span>
              </div>
            </div>

            {review.levelScore !== undefined && (
              <div className="mt-4">
                <p className="text-[#6B5744] text-sm font-bold mb-2">Level Score</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-[#EDE5D4] rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-[#D4A843] h-full transition-all rounded-full"
                      style={{ width: `${review.levelScore || 0}%` }}
                    />
                  </div>
                  <span className="text-lg font-extrabold text-[#D4A843]">{review.levelScore || 0}%</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-[#F5F0E8] rounded-2xl">
              <div className="text-3xl font-extrabold text-[#5C8B5C]">{totalWords}</div>
              <p className="text-[#6B5744] text-xs font-bold mt-1">Total Words</p>
            </div>
            <div className="text-center p-3 bg-[#F5F0E8] rounded-2xl">
              <div className="text-3xl font-extrabold text-[#D4A843]">{newWords}</div>
              <p className="text-[#6B5744] text-xs font-bold mt-1">New Words</p>
            </div>
            <div className="text-center p-3 bg-[#F5F0E8] rounded-2xl">
              <div className="text-3xl font-extrabold text-[#D4736B]">{reviewWords}</div>
              <p className="text-[#6B5744] text-xs font-bold mt-1">To Review</p>
            </div>
          </div>
        </div>
      </div>

      {/* Word Cloud Section */}
      <div className="ghibli-card p-8 mb-6">
        <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-2">Your Word Cloud</h3>
        <p className="text-[#6B5744] text-sm font-semibold mb-4">Larger words = used more frequently</p>
        <div className="border-2 border-[#E8DEC8] rounded-2xl bg-[#F5F0E8]">
          {renderWordCloud()}
        </div>
      </div>

      {/* POS Categories */}
      <div className="ghibli-card p-8 mb-6">
        <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-6">Words by Category</h3>
        <div className="flex gap-3 flex-wrap">
          {Object.entries(groupedByPOS).map(([pos, words]) => {
            const colors = POS_COLORS[pos] || POS_COLORS.noun;
            return (
              <div key={pos} className="flex items-center gap-2">
                <span className={`px-4 py-2 rounded-full text-sm font-bold ${colors.bg} ${colors.text}`}>
                  {colors.label} ({words.length})
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Synonym Map */}
      <div className="ghibli-card p-8 mb-6">
        <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-2">Synonym Connections</h3>
        <p className="text-[#6B5744] text-sm font-semibold mb-6">Click a word to highlight its connections</p>
        <div className="relative border-2 border-[#E8DEC8] rounded-2xl p-8 bg-[#F5F0E8]" style={{ minHeight: '400px' }}>
          <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
            {vocabulary.map((word) => {
              if (!highlightedWord || word.id === highlightedWord || (word.synonyms || []).some((syn) => vocabulary.find((w) => w.word === syn && w.id === highlightedWord))) {
                return (word.synonyms || []).map((synonym, idx) => {
                  const synWord = vocabulary.find((w) => (w.synonyms || []).includes(word.word) || w.word === synonym);
                  if (!synWord) return null;
                  const highlight = highlightedWord === word.id || highlightedWord === synWord.id;
                  return (
                    <line
                      key={`${word.id}-${idx}`}
                      x1={`${(word.id % 3) * 30 + 15}%`}
                      y1={`${Math.floor(word.id / 3) * 25 + 12}%`}
                      x2={`${(synWord.id % 3) * 30 + 15}%`}
                      y2={`${Math.floor(synWord.id / 3) * 25 + 12}%`}
                      stroke={highlight ? '#5C8B5C' : '#D6C9A8'}
                      strokeWidth={highlight ? '2' : '1'}
                      opacity={highlight ? '1' : '0.4'}
                    />
                  );
                });
              }
              return null;
            })}
          </svg>

          <div className="relative z-10 flex flex-wrap gap-3 justify-center">
            {vocabulary.map((word) => (
              <button
                key={word.id}
                onClick={() => setHighlightedWord(highlightedWord === word.id ? null : word.id)}
                className={`px-4 py-2 rounded-full font-bold transition-all hover:-translate-y-0.5 ${
                  highlightedWord === word.id
                    ? 'bg-[#5C8B5C] text-white scale-110 shadow-[0_4px_12px_rgba(92,139,92,0.4)]'
                    : 'bg-[#E8F5E8] text-[#3D6B3D] hover:bg-[#C8E6C9] cursor-pointer'
                }`}
              >
                {word.word}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stage Breakdown — Real data from API */}
      {stageBreakdown.length > 0 && (
        <div className="ghibli-card p-8 mb-6">
          <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-6">Session Breakdown by Stage</h3>
          <div className="space-y-3">
            {stageBreakdown.map((stage, idx) => (
              <div key={idx} className="border border-[#E8DEC8] rounded-2xl p-4 bg-[#F5F0E8]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-extrabold text-[#3D2E1E]">{stage.stage}</h4>
                    {stage.duration > 0 && (
                      <p className="text-sm text-[#6B5744] font-medium">
                        {Math.floor(stage.duration / 60)}m {stage.duration % 60}s
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    {stage.wordCount > 0 && (
                      <div className="text-sm text-[#6B5744] font-semibold mb-1">
                        {stage.wordCount} new word(s)
                      </div>
                    )}
                    {stage.grammarScore > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-[#EDE5D4] rounded-full h-2">
                          <div
                            className="bg-[#5C8B5C] h-full rounded-full"
                            style={{ width: `${stage.grammarScore}%` }}
                          />
                        </div>
                        <span className="text-sm font-extrabold text-[#5C8B5C]">{stage.grammarScore}%</span>
                      </div>
                    )}
                    {!stage.completed && (
                      <span className="text-xs px-2 py-1 bg-[#FCE8E6] text-[#B85A53] rounded-full font-bold">
                        Incomplete
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversation Replay */}
      {conversation.length > 0 && (
        <div className="ghibli-card overflow-hidden mb-6">
          <button
            onClick={() => setShowConversation(!showConversation)}
            className="w-full px-6 py-4 text-left hover:bg-[#F5F0E8] transition-all flex items-center justify-between border-b border-[#E8DEC8]"
          >
            <h3 className="text-xl font-extrabold text-[#3D2E1E]">Conversation Review</h3>
            <span className="text-xl text-[#6B5744]">{showConversation ? '▼' : '▶'}</span>
          </button>

          {showConversation && (
            <div className="p-6 space-y-4 max-h-96 overflow-y-auto bg-[#F5F0E8]">
              {conversation.map((msg, idx) => {
                let wordSpans = msg.content;
                vocabulary.forEach((word) => {
                  const regex = new RegExp(`\\b${word.word}\\b`, 'gi');
                  wordSpans = wordSpans.replace(
                    regex,
                    (match) =>
                      `<span class="bg-[#FFF0C0] font-bold cursor-pointer hover:bg-[#FFE080]" data-word-id="${word.id}">${match}</span>`
                  );
                });

                return (
                  <div
                    key={idx}
                    className={`flex ${msg.speaker === 'alice' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-3 rounded-2xl ${
                        msg.speaker === 'alice'
                          ? 'bg-[#D6E9D6] text-[#3D2E1E] rounded-tl-none'
                          : 'bg-[#FFFCF3] border border-[#D6C9A8] text-[#3D2E1E] rounded-tr-none'
                      }`}
                    >
                      <div
                        dangerouslySetInnerHTML={{ __html: wordSpans }}
                        onClick={(e) => {
                          if (e.target.dataset.wordId) {
                            setHighlightedWord(parseInt(e.target.dataset.wordId));
                          }
                        }}
                        className="text-sm font-semibold"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Vocabulary Details */}
      <div className="ghibli-card overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-[#E8DEC8] bg-[#F5F0E8]">
          <h3 className="text-xl font-extrabold text-[#3D2E1E]">Vocabulary Details</h3>
        </div>

        <div className="divide-y divide-[#EDE5D4]">
          {vocabulary.map((vocab) => {
            const colors = POS_COLORS[vocab.pos] || POS_COLORS.noun;
            return (
              <div key={vocab.id}>
                <button
                  onClick={() => setExpandedWord(expandedWord === vocab.id ? null : vocab.id)}
                  className="w-full px-6 py-4 hover:bg-[#F5F0E8] transition-all flex items-center justify-between"
                >
                  <div className="flex-1 text-left">
                    <div className="font-extrabold text-[#3D2E1E] text-lg">{vocab.word}</div>
                    <p className="text-[#6B5744] text-sm italic mt-1 font-medium">
                      &quot;{vocab.contextSentence}&quot;
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className={`text-xs px-3 py-1 rounded-full font-bold ${colors.bg} ${colors.text}`}>
                      {colors.label}
                    </span>
                    <span className="text-[#6B5744] text-xs px-2 py-1 bg-[#EDE5D4] rounded-lg font-semibold">
                      Used {vocab.useCount || 1}x
                    </span>
                    <span className="text-xl text-[#6B5744]">{expandedWord === vocab.id ? '▼' : '▶'}</span>
                  </div>
                </button>

                {expandedWord === vocab.id && (
                  <div className="px-6 py-4 bg-[#F5F0E8] border-t border-[#EDE5D4] space-y-4">
                    <div>
                      <p className="text-sm font-bold text-[#6B5744] mb-2">Mastery Level</p>
                      <div className="flex gap-1">{renderStars(vocab.masteryLevel || 1)}</div>
                    </div>

                    {(vocab.synonyms || []).length > 0 && (
                      <div>
                        <p className="text-sm font-bold text-[#6B5744] mb-2">Similar Words (Synonyms)</p>
                        <div className="flex gap-2 flex-wrap">
                          {vocab.synonyms.map((syn, idx) => (
                            <span key={idx} className="px-3 py-1 bg-[#E8F5E8] text-[#3D6B3D] rounded-full text-sm font-bold">
                              {syn}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {(vocab.antonyms || []).length > 0 && (
                      <div>
                        <p className="text-sm font-bold text-[#6B5744] mb-2">Opposite Words (Antonyms)</p>
                        <div className="flex gap-2 flex-wrap">
                          {vocab.antonyms.map((ant, idx) => (
                            <span key={idx} className="px-3 py-1 bg-[#FCE8E6] text-[#B85A53] rounded-full text-sm font-bold">
                              {ant}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Printable Worksheet — full 8-row worksheet with native print-to-PDF */}
      <div className="mb-6">
        <WorksheetPrint
          studentName={sessionStorage.getItem('studentName') || review?.studentName || 'Student'}
          bookTitle={review?.bookTitle || review?.book_title || 'My Book'}
          worksheetAnswers={worksheetAnswers}
          grammarScore={review?.grammarScore ?? null}
          levelScore={review?.levelScore ?? null}
          completedAt={review?.completedAt ?? null}
        />
      </div>

      {/* Book Recommendations */}
      <div className="mb-6">
        <BookRecommendation
          studentLevel={sessionStorage.getItem('studentLevel') || 'intermediate'}
          studentId={sessionStorage.getItem('studentId') || null}
          currentBook={{ title: review?.bookTitle || review?.book_title }}
          onSelectBook={() => router.push('/books')}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-center flex-wrap">
        <button
          onClick={() => router.push('/vocabulary')}
          className="px-8 py-3 bg-[#D4A843] text-white rounded-2xl hover:bg-[#A8822E] transition-all font-bold hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(212,168,67,0.3)]"
        >
          Practice These Words
        </button>
        <button
          onClick={() => router.push('/books')}
          className="px-8 py-3 bg-[#5C8B5C] text-white rounded-2xl hover:bg-[#3D6B3D] transition-all font-bold hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(92,139,92,0.3)]"
        >
          Read Another Book
        </button>
        <PrintWorksheetButton />
        <button
          onClick={() => router.push('/profile')}
          className="px-8 py-3 bg-[#EDE5D4] text-[#6B5744] rounded-2xl hover:bg-[#D6C9A8] transition-all font-bold hover:-translate-y-0.5"
        >
          View Profile
        </button>
      </div>
    </div>
  );
}
