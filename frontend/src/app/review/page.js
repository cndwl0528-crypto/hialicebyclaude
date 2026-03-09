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
    {
      id: 1,
      word: 'caterpillar',
      pos: 'noun',
      contextSentence: 'The caterpillar ate leaves all day.',
      synonyms: ['larva', 'grub', 'worm'],
      antonyms: [],
      masteryLevel: 5,
      useCount: 5,
    },
    {
      id: 2,
      word: 'metamorphosis',
      pos: 'noun',
      contextSentence: 'The caterpillar went through metamorphosis.',
      synonyms: ['transformation', 'change', 'evolution'],
      antonyms: [],
      masteryLevel: 3,
      useCount: 2,
    },
    {
      id: 3,
      word: 'journey',
      pos: 'noun',
      contextSentence: 'It was a long and interesting journey.',
      synonyms: ['trip', 'voyage', 'adventure', 'expedition'],
      antonyms: [],
      masteryLevel: 4,
      useCount: 3,
    },
    {
      id: 4,
      word: 'transform',
      pos: 'verb',
      contextSentence: 'The butterfly transformed into a beautiful creature.',
      synonyms: ['change', 'convert', 'alter', 'modify'],
      antonyms: ['remain', 'stay', 'preserve'],
      masteryLevel: 4,
      useCount: 2,
    },
    {
      id: 5,
      word: 'beautiful',
      pos: 'adjective',
      contextSentence: 'The butterfly was beautiful and colorful.',
      synonyms: ['lovely', 'pretty', 'gorgeous', 'stunning'],
      antonyms: ['ugly', 'plain'],
      masteryLevel: 5,
      useCount: 4,
    },
    {
      id: 6,
      word: 'hungry',
      pos: 'adjective',
      contextSentence: 'The very hungry caterpillar wanted to eat everything.',
      synonyms: ['famished', 'ravenous', 'starving'],
      antonyms: ['full', 'satisfied'],
      masteryLevel: 5,
      useCount: 6,
    },
    {
      id: 7,
      word: 'devour',
      pos: 'verb',
      contextSentence: 'He devoured all the food in the forest.',
      synonyms: ['eat', 'consume', 'gobble'],
      antonyms: [],
      masteryLevel: 2,
      useCount: 1,
    },
    {
      id: 8,
      word: 'cocoon',
      pos: 'noun',
      contextSentence: 'The caterpillar built a cocoon to rest.',
      synonyms: ['chrysalis', 'silk case'],
      antonyms: [],
      masteryLevel: 3,
      useCount: 2,
    },
  ],
};

const POS_COLORS = {
  noun: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Noun' },
  verb: { bg: 'bg-green-100', text: 'text-green-700', label: 'Verb' },
  adjective: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Adjective' },
  adverb: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Adverb' },
};

export default function ReviewPage() {
  const router = useRouter();
  const [review, setReview] = useState(null);
  const [vocabulary, setVocabulary] = useState([]);
  const [expandedWord, setExpandedWord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReview = async () => {
      try {
        setLoading(true);
        
        // Read session data from sessionStorage
        const sessionId = sessionStorage.getItem('sessionId');
        const bookTitle = sessionStorage.getItem('bookTitle');
        const studentName = sessionStorage.getItem('studentName');

        if (!sessionId) {
          setError('No session data found');
          setLoading(false);
          return;
        }

        // Try to fetch from API
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
          // Fall back to mock data
          const mockData = { ...MOCK_REVIEW_DATA, bookTitle, studentName };
          setReview(mockData);
          setVocabulary(mockData.vocabulary);
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
      <span key={i} className={i < level ? 'text-yellow-400' : 'text-gray-300'}>
        ★
      </span>
    ));
  };

  const renderWordCloud = () => {
    if (!vocabulary.length) return null;

    // Calculate min/max use count for scaling
    const useCounts = vocabulary.map((v) => v.useCount);
    const minCount = Math.min(...useCounts);
    const maxCount = Math.max(...useCounts);
    const range = maxCount - minCount || 1;

    // Function to calculate font size based on use count
    const calculateFontSize = (useCount) => {
      const ratio = (useCount - minCount) / range;
      return 16 + ratio * 32; // Font size between 16px and 48px
    };

    // Shuffle vocabulary for better visual distribution
    const shuffled = [...vocabulary].sort(() => Math.random() - 0.5);

    return (
      <div className="flex flex-wrap gap-4 justify-center items-center py-8 px-4">
        {shuffled.map((vocab) => (
          <div
            key={vocab.id}
            style={{
              fontSize: `${calculateFontSize(vocab.useCount)}px`,
              transform: `rotate(${Math.random() * 10 - 5}deg)`,
              opacity: 0.7 + (vocab.useCount / maxCount) * 0.3,
            }}
            className="inline-block font-bold text-primary hover:text-blue-700 transition-all cursor-pointer"
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

  // Group vocabulary by POS
  const groupedByPOS = vocabulary.reduce((acc, vocab) => {
    const pos = vocab.pos || 'noun';
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(vocab);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <p className="text-gray-500 text-lg">Loading review...</p>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex justify-center items-center py-12">
        <p className="text-red-500 text-lg">{error || 'Failed to load review data'}</p>
      </div>
    );
  }

  return (
    <div className="py-8">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Reading Session Complete!</h2>
        <p className="text-gray-600">
          Great job, {review.studentName}! Here's what you learned reading "{review.bookTitle}"
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow-md p-8 mb-8">
        <h3 className="text-xl font-bold text-gray-800 mb-6">Session Summary</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Book & Grammar Info */}
          <div>
            <div className="mb-4">
              <p className="text-gray-600 text-sm font-semibold mb-1">Book Title</p>
              <p className="text-lg font-bold text-gray-800">{review.bookTitle}</p>
            </div>
            
            <div>
              <p className="text-gray-600 text-sm font-semibold mb-2">Grammar Score</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-green-500 h-full transition-all"
                    style={{ width: `${review.grammarScore}%` }}
                  ></div>
                </div>
                <span className="text-lg font-bold text-green-600">{review.grammarScore}%</span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-500">{totalWords}</div>
              <p className="text-gray-600 text-sm">Total Words</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-500">{newWords}</div>
              <p className="text-gray-600 text-sm">New Words</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-500">{reviewWords}</div>
              <p className="text-gray-600 text-sm">To Review</p>
            </div>
          </div>
        </div>
      </div>

      {/* Word Cloud Section */}
      <div className="bg-white rounded-lg shadow-md p-8 mb-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Your Word Cloud</h3>
        <p className="text-gray-600 text-sm mb-4">Larger words = used more frequently</p>
        <div className="border-2 border-gray-100 rounded-lg">
          {renderWordCloud()}
        </div>
      </div>

      {/* POS Categories */}
      <div className="bg-white rounded-lg shadow-md p-8 mb-8">
        <h3 className="text-xl font-bold text-gray-800 mb-6">Words by Category</h3>
        <div className="flex gap-3 flex-wrap">
          {Object.entries(groupedByPOS).map(([pos, words]) => {
            const colors = POS_COLORS[pos] || POS_COLORS.noun;
            return (
              <div key={pos} className="flex items-center gap-2">
                <span className={`px-4 py-2 rounded-full text-sm font-semibold ${colors.bg} ${colors.text}`}>
                  {colors.label} ({words.length})
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Vocabulary Details */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-800">Vocabulary Details</h3>
        </div>

        <div className="divide-y divide-gray-200">
          {vocabulary.map((vocab) => {
            const colors = POS_COLORS[vocab.pos] || POS_COLORS.noun;
            return (
              <div key={vocab.id}>
                <button
                  onClick={() =>
                    setExpandedWord(expandedWord === vocab.id ? null : vocab.id)
                  }
                  className="w-full px-6 py-4 hover:bg-gray-50 transition-all flex items-center justify-between"
                >
                  <div className="flex-1 text-left">
                    <div className="font-bold text-gray-800 text-lg">
                      {vocab.word}
                    </div>
                    <p className="text-gray-600 text-sm italic mt-1">
                      "{vocab.contextSentence}"
                    </p>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    <span className={`text-xs px-3 py-1 rounded-full font-semibold ${colors.bg} ${colors.text}`}>
                      {colors.label}
                    </span>
                    <span className="text-gray-500 text-xs px-2 py-1 bg-gray-100 rounded">
                      Used {vocab.useCount}x
                    </span>
                    <span className="text-xl">{expandedWord === vocab.id ? '▼' : '▶'}</span>
                  </div>
                </button>

                {expandedWord === vocab.id && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 space-y-4">
                    {/* Mastery Level */}
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        Mastery Level
                      </p>
                      <div className="flex gap-1">
                        {renderStars(vocab.masteryLevel)}
                      </div>
                    </div>

                    {/* Synonyms */}
                    {vocab.synonyms.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">
                          Similar Words (Synonyms)
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {vocab.synonyms.map((syn, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                            >
                              {syn}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Antonyms */}
                    {vocab.antonyms.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">
                          Opposite Words (Antonyms)
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {vocab.antonyms.map((ant, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                            >
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
      <div className="flex gap-4 justify-center">
        <button
          onClick={() => router.push('/books')}
          className="px-8 py-3 bg-primary text-white rounded-lg hover:bg-blue-600 transition-all font-semibold"
        >
          Read Another Book
        </button>
        <button
          onClick={() => router.push('/profile')}
          className="px-8 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-all font-semibold"
        >
          View Profile
        </button>
      </div>
    </div>
  );
}
