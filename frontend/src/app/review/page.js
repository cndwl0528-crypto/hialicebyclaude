'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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

const POS_COLORS = {
  noun: { bg: 'bg-[#E8F0E8]', text: 'text-[#3D6B3D]', label: 'Noun' },
  verb: { bg: 'bg-[#E8F5E8]', text: 'text-[#5C8B5C]', label: 'Verb' },
  adjective: { bg: 'bg-[#E8E0F0]', text: 'text-[#6A4B7A]', label: 'Adjective' },
  adverb: { bg: 'bg-[#FFF0D8]', text: 'text-[#A8822E]', label: 'Adverb' },
};

export default function ReviewPage() {
  const router = useRouter();
  const [review, setReview] = useState(null);
  const [vocabulary, setVocabulary] = useState([]);
  const [expandedWord, setExpandedWord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [conversation, setConversation] = useState([]);
  const [showConversation, setShowConversation] = useState(false);
  const [highlightedWord, setHighlightedWord] = useState(null);
  const [stageBreakdown, setStageBreakdown] = useState([]);

  useEffect(() => {
    const fetchReview = async () => {
      try {
        setLoading(true);

        const sessionId = sessionStorage.getItem('sessionId');
        const bookTitle = sessionStorage.getItem('bookTitle');
        const studentName = sessionStorage.getItem('studentName');
        const sessionDataStr = sessionStorage.getItem('lastSessionData');
        const conversationStr = sessionStorage.getItem('lastConversation');

        if (!sessionId) {
          setError('No session data found');
          setLoading(false);
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(
          `${apiUrl}/api/sessions/${sessionId}/review`,
          { signal: AbortSignal.timeout(5000) }
        );

        if (response.ok) {
          const data = await response.json();
          setReview(data.review || { ...MOCK_REVIEW_DATA, bookTitle, studentName });
          setVocabulary(data.review?.vocabulary || MOCK_REVIEW_DATA.vocabulary);
          setError('');
        } else {
          const mockData = { ...MOCK_REVIEW_DATA, bookTitle, studentName };
          setReview(mockData);
          setVocabulary(mockData.vocabulary);
        }

        if (conversationStr) {
          try {
            const conv = JSON.parse(conversationStr);
            setConversation(conv);
          } catch (e) {
            console.warn('Failed to parse conversation:', e);
          }
        }

        if (sessionDataStr) {
          try {
            const sessionData = JSON.parse(sessionDataStr);
            const breakdown = [
              { stage: 'Title', completed: true, wordCount: 1, grammarScore: 85, duration: 60 },
              { stage: 'Introduction', completed: true, wordCount: 2, grammarScore: 80, duration: 120 },
              { stage: 'Body', completed: true, wordCount: 3, grammarScore: 82, duration: 180 },
              { stage: 'Conclusion', completed: true, wordCount: 2, grammarScore: 85, duration: 90 },
            ];
            setStageBreakdown(breakdown);
          } catch (e) {
            console.warn('Failed to parse session data:', e);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch review from API, using mock data:', err);
        const sessionId = sessionStorage.getItem('sessionId');
        const bookTitle = sessionStorage.getItem('bookTitle');
        const studentName = sessionStorage.getItem('studentName');
        const mockData = { ...MOCK_REVIEW_DATA, bookTitle, studentName };
        setReview(mockData);
        setVocabulary(mockData.vocabulary);
      } finally {
        setLoading(false);
      }
    };

    fetchReview();
  }, []);

  const renderStars = (level) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <span key={i} className={i < level ? 'text-[#D4A843]' : 'text-[#D6C9A8]'}>
        ★
      </span>
    ));
  };

  const renderWordCloud = () => {
    if (!vocabulary.length) return null;

    const useCounts = vocabulary.map((v) => v.useCount);
    const minCount = Math.min(...useCounts);
    const maxCount = Math.max(...useCounts);
    const range = maxCount - minCount || 1;

    const calculateFontSize = (useCount) => {
      const ratio = (useCount - minCount) / range;
      return 16 + ratio * 32;
    };

    const shuffled = [...vocabulary].sort(() => Math.random() - 0.5);
    const wordColors = ['#3D6B3D', '#5C8B5C', '#87CEDB', '#5BA8B8', '#D4A843'];

    return (
      <div className="flex flex-wrap gap-4 justify-center items-center py-8 px-4">
        {shuffled.map((vocab, idx) => (
          <div
            key={vocab.id}
            style={{
              fontSize: `${calculateFontSize(vocab.useCount)}px`,
              transform: `rotate(${Math.random() * 10 - 5}deg)`,
              opacity: 0.7 + (vocab.useCount / maxCount) * 0.3,
              color: wordColors[idx % wordColors.length],
            }}
            className="inline-block font-extrabold hover:opacity-100 transition-all cursor-pointer"
            title={`Used ${vocab.useCount} time(s)`}
          >
            {vocab.word}
          </div>
        ))}
      </div>
    );
  };

  const totalWords = vocabulary.length;
  const newWords = vocabulary.filter((v) => v.useCount === 1).length;
  const reviewWords = vocabulary.filter((v) => v.useCount > 1).length;

  const groupedByPOS = vocabulary.reduce((acc, vocab) => {
    const pos = vocab.pos || 'noun';
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(vocab);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="text-center">
          <div className="text-4xl mb-3 float-animation inline-block">🌿</div>
          <p className="text-[#6B5744] font-bold text-lg">Loading review...</p>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex justify-center items-center py-16">
        <p className="text-[#D4736B] font-bold text-lg">{error || 'Failed to load review data'}</p>
      </div>
    );
  }

  return (
    <div className="py-8">
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
                    style={{ width: `${review.grammarScore}%` }}
                  />
                </div>
                <span className="text-lg font-extrabold text-[#5C8B5C]">{review.grammarScore}%</span>
              </div>
            </div>
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
              if (!highlightedWord || word.id === highlightedWord || word.synonyms.some((syn) => vocabulary.find((w) => w.word === syn && w.id === highlightedWord))) {
                return word.synonyms.map((synonym, idx) => {
                  const synWord = vocabulary.find((w) => w.synonyms.includes(word.word) || w.word === synonym);
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

      {/* Stage Breakdown */}
      {stageBreakdown.length > 0 && (
        <div className="ghibli-card p-8 mb-6">
          <h3 className="text-xl font-extrabold text-[#3D2E1E] mb-6">Session Breakdown by Stage</h3>
          <div className="space-y-3">
            {stageBreakdown.map((stage, idx) => (
              <div key={idx} className="border border-[#E8DEC8] rounded-2xl p-4 bg-[#F5F0E8]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-extrabold text-[#3D2E1E]">{stage.stage}</h4>
                    <p className="text-sm text-[#6B5744] font-medium">{Math.floor(stage.duration / 60)}m {stage.duration % 60}s</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-[#6B5744] font-semibold mb-1">{stage.wordCount} new word(s)</div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-[#EDE5D4] rounded-full h-2">
                        <div
                          className="bg-[#5C8B5C] h-full rounded-full"
                          style={{ width: `${stage.grammarScore}%` }}
                        />
                      </div>
                      <span className="text-sm font-extrabold text-[#5C8B5C]">{stage.grammarScore}%</span>
                    </div>
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
                      Used {vocab.useCount}x
                    </span>
                    <span className="text-xl text-[#6B5744]">{expandedWord === vocab.id ? '▼' : '▶'}</span>
                  </div>
                </button>

                {expandedWord === vocab.id && (
                  <div className="px-6 py-4 bg-[#F5F0E8] border-t border-[#EDE5D4] space-y-4">
                    <div>
                      <p className="text-sm font-bold text-[#6B5744] mb-2">Mastery Level</p>
                      <div className="flex gap-1">{renderStars(vocab.masteryLevel)}</div>
                    </div>

                    {vocab.synonyms.length > 0 && (
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

                    {vocab.antonyms.length > 0 && (
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
