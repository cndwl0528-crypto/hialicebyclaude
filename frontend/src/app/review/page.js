'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const MOCK_VOCABULARY = [
  {
    id: 1,
    word: 'caterpillar',
    pos: 'noun',
    contextSentence: 'The caterpillar ate leaves all day.',
    synonyms: ['larva', 'grub'],
    antonyms: [],
    masteryLevel: 5,
    useCount: 3,
  },
  {
    id: 2,
    word: 'metamorphosis',
    pos: 'noun',
    contextSentence: 'The caterpillar went through metamorphosis.',
    synonyms: ['transformation', 'change'],
    antonyms: [],
    masteryLevel: 3,
    useCount: 1,
  },
  {
    id: 3,
    word: 'journey',
    pos: 'noun',
    contextSentence: 'It was a long and interesting journey.',
    synonyms: ['trip', 'voyage', 'adventure'],
    antonyms: [],
    masteryLevel: 4,
    useCount: 2,
  },
  {
    id: 4,
    word: 'transform',
    pos: 'verb',
    contextSentence: 'The butterfly transformed into a beautiful creature.',
    synonyms: ['change', 'convert', 'alter'],
    antonyms: ['remain', 'stay'],
    masteryLevel: 4,
    useCount: 2,
  },
];

export default function ReviewPage() {
  const router = useRouter();
  const [vocabulary, setVocabulary] = useState(MOCK_VOCABULARY);
  const [expandedWord, setExpandedWord] = useState(null);

  const totalWords = vocabulary.length;
  const newWords = vocabulary.filter((v) => v.useCount === 1).length;
  const reviewWords = vocabulary.filter((v) => v.useCount > 1).length;

  const renderStars = (level) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <span key={i} className={i < level ? 'text-yellow-400' : 'text-gray-300'}>
        ★
      </span>
    ));
  };

  return (
    <div className="py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Reading Session Complete</h2>
        <p className="text-gray-600">Here's what you learned today</p>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h3 className="text-xl font-bold text-gray-800 mb-6">Session Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-500">{totalWords}</div>
            <p className="text-gray-600 text-sm">Total Words Used</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-500">{newWords}</div>
            <p className="text-gray-600 text-sm">New Words</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-500">{reviewWords}</div>
            <p className="text-gray-600 text-sm">Words to Review</p>
          </div>
        </div>
      </div>

      {/* Vocabulary Section */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-800">Vocabulary Learned</h3>
        </div>

        <div className="divide-y divide-gray-200">
          {vocabulary.map((vocab) => (
            <div key={vocab.id}>
              <button
                onClick={() =>
                  setExpandedWord(expandedWord === vocab.id ? null : vocab.id)
                }
                className="w-full px-6 py-4 hover:bg-gray-50 transition-smooth flex items-center justify-between"
              >
                <div className="flex-1 text-left">
                  <div className="font-bold text-gray-800 text-lg">
                    {vocab.word}
                  </div>
                  <p className="text-gray-600 text-sm italic">
                    {vocab.contextSentence}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-gray-500 text-xs px-2 py-1 bg-gray-100 rounded">
                    {vocab.pos}
                  </span>
                  <span className="text-xl">{expandedWord === vocab.id ? '▼' : '▶'}</span>
                </div>
              </button>

              {expandedWord === vocab.id && (
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      Mastery Level
                    </p>
                    <div className="flex gap-1">
                      {renderStars(vocab.masteryLevel)}
                    </div>
                  </div>

                  {vocab.synonyms.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        Similar Words
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

                  {vocab.antonyms.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        Opposite Words
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
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex gap-4 justify-center">
        <button
          onClick={() => router.push('/books')}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-smooth font-semibold"
        >
          Read Another Book
        </button>
        <button
          onClick={() => router.push('/profile')}
          className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-smooth font-semibold"
        >
          View Profile
        </button>
      </div>
    </div>
  );
}
