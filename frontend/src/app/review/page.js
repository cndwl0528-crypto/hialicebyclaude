'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getSessionReview, getSessionStageScores, getBook } from '@/services/api';
import LoadingCard from '@/components/LoadingCard';
import ImaginationStudio from '@/components/ImaginationStudio';
import { isParentOrAdmin } from '@/lib/constants';
import { getItem } from '@/lib/clientStorage';

// Heavy components loaded dynamically to reduce initial bundle size
const PrintableWorksheet = dynamic(() => import('@/components/PrintableWorksheet'), {
  loading: () => <div className="animate-pulse h-24 bg-[#EDE5D4] rounded-lg" />,
  ssr: false,
});
const BookRecommendation = dynamic(() => import('@/components/BookRecommendation'), {
  loading: () => <div className="animate-pulse h-24 bg-[#EDE5D4] rounded-lg" />,
});
const ConfettiCelebration = dynamic(() => import('@/components/ConfettiCelebration'), {
  ssr: false,
});
const AchievementUnlock = dynamic(() => import('@/components/AchievementUnlock'), {
  ssr: false,
});


const MOCK_REVIEW = {
  studentName: 'Alice',
  bookTitle: 'The Very Hungry Caterpillar',
  grammarScore: 82,
  levelScore: 78,
  studentLevel: 'Beginner',
  vocabulary: [
    { id: 1, word: 'caterpillar', pos: 'noun', contextSentence: 'The caterpillar ate through one apple.', synonyms: ['larva', 'grub'], antonyms: [], masteryLevel: 2, useCount: 3 },
    { id: 2, word: 'cocoon', pos: 'noun', contextSentence: 'He built a cocoon around himself.', synonyms: ['chrysalis', 'shell'], antonyms: [], masteryLevel: 1, useCount: 1 },
    { id: 3, word: 'beautiful', pos: 'adjective', contextSentence: 'He was a beautiful butterfly!', synonyms: ['lovely', 'pretty'], antonyms: ['ugly'], masteryLevel: 3, useCount: 4 },
    { id: 4, word: 'hungry', pos: 'adjective', contextSentence: 'He was a very hungry caterpillar.', synonyms: ['starving', 'famished'], antonyms: ['full', 'satisfied'], masteryLevel: 4, useCount: 5 },
    { id: 5, word: 'nibbled', pos: 'verb', contextSentence: 'He nibbled through one leaf.', synonyms: ['ate', 'munched'], antonyms: [], masteryLevel: 2, useCount: 2 },
  ],
  messages: [
    { speaker: 'alice', content: "Hi there! Let's talk about The Very Hungry Caterpillar. What was your favorite part?" },
    { speaker: 'student', content: "I liked when the caterpillar ate so many things!" },
    { speaker: 'alice', content: "That's a great observation! Why do you think the caterpillar was so hungry?" },
    { speaker: 'student', content: "Because he was growing and needed energy to become a beautiful butterfly." },
    { speaker: 'alice', content: "Wonderful thinking! You connected cause and effect beautifully." },
  ],
  achievements: [],
};

// Maps internal stage keys (from API/DB) to child-friendly display labels
const STAGE_DISPLAY_NAMES = {
  warm_connection: "Let's Say Hi! 🌟",
  title: 'About This Book 📖',
  introduction: 'Meet the Characters 👤',
  body: 'Think Deeper 💭',
  conclusion: 'My Thoughts ⭐',
  cross_book: 'Connect the Stories 🔗',
  // Legacy capitalized keys (older API responses or mock data)
  'Warm Connection': "Let's Say Hi! 🌟",
  Title: 'About This Book 📖',
  Introduction: 'Meet the Characters 👤',
  Body: 'Think Deeper 💭',
  Conclusion: 'My Thoughts ⭐',
  'Cross Book': 'Connect the Stories 🔗',
};

const MOCK_STAGE_BREAKDOWN = [
  { stage: 'warm_connection', completed: true, wordCount: 2, grammarScore: 85, duration: 120 },
  { stage: 'title', completed: true, wordCount: 3, grammarScore: 80, duration: 150 },
  { stage: 'introduction', completed: true, wordCount: 4, grammarScore: 78, duration: 180 },
  { stage: 'body', completed: true, wordCount: 5, grammarScore: 82, duration: 240 },
  { stage: 'conclusion', completed: true, wordCount: 3, grammarScore: 85, duration: 160 },
  { stage: 'cross_book', completed: true, wordCount: 2, grammarScore: 80, duration: 100 },
];

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
  const [achievementsEarned, setAchievementsEarned] = useState([]);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [isParent, setIsParent] = useState(false);

  // Print handler — opens the browser print dialog.
  // The @media print rules in globals.css handle the visual layout.
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  useEffect(() => {
    const fetchReview = async () => {
      try {
        setLoading(true);

        // Read sessionId from URL search params — no sessionStorage dependency
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('sessionId');

        if (!sessionId) {
          // Demo mode — show example review
          setReview(MOCK_REVIEW);
          setVocabulary(MOCK_REVIEW.vocabulary);
          setConversation(MOCK_REVIEW.messages);
          setStageBreakdown(MOCK_STAGE_BREAKDOWN);
          setLoading(false);
          return;
        }

        // Fetch review data and stage scores in parallel — API is the sole data source
        let reviewData = null;
        let stageScoresData = null;

        try {
          [reviewData, stageScoresData] = await Promise.all([
            getSessionReview(sessionId),
            getSessionStageScores(sessionId),
          ]);
        } catch (apiErr) {
          console.error('API fetch failed:', apiErr);
          // Demo fallback when API unavailable
          console.warn('Using demo review data');
          setReview(MOCK_REVIEW);
          setVocabulary(MOCK_REVIEW.vocabulary);
          setConversation(MOCK_REVIEW.messages);
          setStageBreakdown(MOCK_STAGE_BREAKDOWN);
          setLoading(false);
          return;
        }

        // Backend GET /sessions/:id/review returns { session, dialogues, vocabulary }
        // Map to the UI's expected shape
        if (reviewData && reviewData.session) {
          const sess = reviewData.session;

          // Resolve book title: session has book_id but no title,
          // so fetch from books API or fall back to sessionStorage
          let bookTitle = sess.book_title || sess.bookTitle || '';
          if (!bookTitle && sess.book_id) {
            try {
              const bookData = await getBook(sess.book_id);
              bookTitle = bookData?.book?.title || bookData?.title || '';
            } catch {
              // Non-fatal: fall back to sessionStorage
            }
          }
          if (!bookTitle) {
            bookTitle = getItem('bookTitle') || 'Book';
          }

          // Build a review object matching the UI's expected fields
          const apiReview = {
            sessionId: sess.id,
            studentId: sess.student_id,
            studentName: getItem('studentName') || 'Student',
            bookTitle,
            grammarScore: sess.grammar_score ?? sess.grammarScore ?? 0,
            levelScore: sess.level_score ?? sess.levelScore ?? 0,
            studentLevel: sess.level || getItem('studentLevel') || 'Beginner',
            completedAt: sess.completed_at || sess.completedAt,
            achievements: sess.achievements || [],
          };
          setReview(apiReview);

          // ai_feedback from session record
          const apiFeedback = sess.ai_feedback || sess.aiFeedback || null;
          if (apiFeedback) {
            setAiFeedback(apiFeedback);
          }

          // Vocabulary from API — normalize snake_case fields
          const vocabList = (reviewData.vocabulary || []).map((v) => ({
            id: v.id,
            word: v.word,
            pos: v.pos || 'noun',
            contextSentence: v.context_sentence || v.contextSentence || '',
            synonyms: v.synonyms || [],
            antonyms: v.antonyms || [],
            masteryLevel: v.mastery_level ?? v.masteryLevel ?? 1,
            useCount: v.use_count ?? v.useCount ?? 1,
          }));
          setVocabulary(vocabList);

          // Dialogues from API — map to conversation messages
          const dialogueList = (reviewData.dialogues || []).map((d) => ({
            speaker: d.speaker,
            content: d.content,
            stage: d.stage,
          }));
          if (dialogueList.length > 0) {
            setConversation(dialogueList);
          }

          // Achievements from session
          if (apiReview.achievements && apiReview.achievements.length > 0) {
            setAchievementsEarned(apiReview.achievements);
            setShowAchievements(true);
          }
        } else if (reviewData && reviewData.review) {
          // Legacy format: { review: { ... } }
          const apiReview = reviewData.review;
          setReview(apiReview);

          const apiFeedback = apiReview.ai_feedback || apiReview.aiFeedback || null;
          if (apiFeedback) {
            setAiFeedback(apiFeedback);
          }

          const rawVocab = apiReview.vocabulary || [];
          setVocabulary(Array.isArray(rawVocab) ? rawVocab : []);

          const msgs = apiReview.messages || apiReview.conversation || [];
          if (msgs.length > 0) {
            setConversation(msgs);
          }

          if (apiReview.achievements && apiReview.achievements.length > 0) {
            setAchievementsEarned(apiReview.achievements);
            setShowAchievements(true);
          }
        } else {
          // Fallback to demo data
          setReview(MOCK_REVIEW);
          setVocabulary(MOCK_REVIEW.vocabulary);
          setConversation(MOCK_REVIEW.messages);
          setStageBreakdown(MOCK_STAGE_BREAKDOWN);
        }

        // Process stage scores from API
        if (stageScoresData && stageScoresData.stageScores && stageScoresData.stageScores.length > 0) {
          const apiStages = stageScoresData.stageScores.map((s) => ({
            stage: s.stage || s.stageName || 'Stage',
            completed: s.completed !== false,
            wordCount: s.wordCount || s.wordsLearned || 0,
            grammarScore: s.grammarScore || s.score || 0,
            duration: s.duration || s.durationSeconds || 0,
          }));
          setStageBreakdown(apiStages);
        }
      } catch (err) {
        console.error('Unexpected error loading review:', err);
        setError('Oops! Something went wrong loading your review. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchReview();
  }, []);

  // P3-UX-02: Trigger confetti celebration when review data loads successfully
  useEffect(() => {
    if (!loading && review) {
      setShowConfetti(true);
      // P3-UX-03: Show achievement modal after a short delay for confetti to settle
      if (achievementsEarned.length > 0) {
        const timer = setTimeout(() => setShowAchievementModal(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, review, achievementsEarned]);

  // Determine parent/admin role on mount — kept in state so it is safe for SSR
  useEffect(() => {
    setIsParent(isParentOrAdmin());
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
            Go to Library
          </button>
        </div>
      </div>
    );
  }

  // Format today's date for the print header
  const printDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="py-8">

      {/* ── PRINT-ONLY: Report header — hidden on screen, visible when printing ── */}
      <div className="print-only print-report-header" aria-hidden="true">
        <div className="print-logo">HiMax — Learning Report</div>
        <div className="print-meta">
          <strong>{review?.studentName || 'Student'}</strong><br />
          {review?.bookTitle && <span>Book: {review.bookTitle}<br /></span>}
          {printDate}
        </div>
      </div>

      {/* ── PRINT-ONLY: Structured report sections rendered for print ─────────── */}
      {/* These are invisible in the browser but appear in the printed PDF */}
      <div className="print-only" aria-hidden="true">

        {/* Score Summary */}
        <div className="print-section">
          <h2>Session Summary</h2>
          <div className="print-stat-grid">
            <div className="print-stat-cell">
              <span className="stat-value">{review?.grammarScore ?? 0}%</span>
              <span className="stat-label">Grammar Score</span>
            </div>
            <div className="print-stat-cell">
              <span className="stat-value">{vocabulary.length}</span>
              <span className="stat-label">Words Encountered</span>
            </div>
            <div className="print-stat-cell">
              <span className="stat-value">{conversation.length}</span>
              <span className="stat-label">Conversation Turns</span>
            </div>
          </div>
          {review?.grammarScore != null && (
            <div style={{ marginTop: '12px' }}>
              <div className="print-score-bar">
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${review.grammarScore}%` }} />
                </div>
                <span className="bar-label">{review.grammarScore}%</span>
              </div>
            </div>
          )}
        </div>

        {/* AI Feedback */}
        {aiFeedback && (
          <div className="print-section">
            <h2>HiMax AI Feedback</h2>
            <p style={{ fontStyle: 'italic' }}>&ldquo;{aiFeedback}&rdquo;</p>
          </div>
        )}

        {/* Vocabulary List */}
        {vocabulary.length > 0 && (
          <div className="print-section">
            <h2>Vocabulary Learned ({vocabulary.length} words)</h2>
            <ul className="print-vocab-list">
              {vocabulary.map((v, idx) => (
                <li key={v.id || idx}>
                  <span className="print-vocab-word">{v.word}</span>
                  <span className="print-vocab-pos">({v.pos || 'noun'})</span>
                  {v.contextSentence && (
                    <span className="print-vocab-sentence">&ldquo;{v.contextSentence}&rdquo;</span>
                  )}
                  {(v.synonyms || []).length > 0 && (
                    <span className="print-vocab-sentence" style={{ color: '#3D6B3D' }}>
                      Synonyms: {v.synonyms.slice(0, 3).join(', ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Stage Breakdown */}
        {stageBreakdown.length > 0 && (
          <div className="print-section print-page-break">
            <h2>Session Stage Breakdown</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ccc' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>Stage</th>
                  <th style={{ textAlign: 'center', padding: '4px 6px' }}>Status</th>
                  <th style={{ textAlign: 'center', padding: '4px 6px' }}>Grammar</th>
                  <th style={{ textAlign: 'center', padding: '4px 6px' }}>Words</th>
                  <th style={{ textAlign: 'center', padding: '4px 6px' }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {stageBreakdown.map((stage, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '4px 6px' }}>
                      {STAGE_DISPLAY_NAMES[stage.stage] || stage.stage}
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                      {stage.completed ? 'Complete' : 'Incomplete'}
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                      {stage.grammarScore > 0 ? `${stage.grammarScore}%` : '—'}
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                      {stage.wordCount > 0 ? stage.wordCount : '—'}
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                      {stage.duration > 0
                        ? `${Math.floor(stage.duration / 60)}m ${stage.duration % 60}s`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Conversation Summary */}
        {conversation.length > 0 && (
          <div className="print-section">
            <h2>Conversation Summary</h2>
            <ul className="print-conversation">
              {conversation.map((msg, idx) => (
                <li
                  key={idx}
                  className={msg.speaker === 'alice' ? 'alice-turn' : 'student-turn'}
                >
                  <span className="speaker-label">
                    {msg.speaker === 'alice' ? 'HiMax AI' : review?.studentName || 'Student'}
                  </span>
                  {msg.content}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── PRINT-ONLY: Footer ─────────────────────────────────────────────── */}
      <div className="print-only print-report-footer" aria-hidden="true">
        Generated by Hi Alice Reading Program &bull; himax.app &bull; {printDate}
      </div>

      {/* P3-UX-02: Confetti celebration on session complete */}
      <ConfettiCelebration
        active={showConfetti}
        duration={4000}
        onComplete={() => setShowConfetti(false)}
      />

      {/* P3-UX-03: Achievement unlock modal — shows earned badges sequentially */}
      <AchievementUnlock
        achievements={showAchievementModal ? achievementsEarned : []}
        onClose={() => {
          setShowAchievementModal(false);
        }}
      />

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
        <div className="ghibli-card bg-gradient-to-br from-[#FFF8E0] to-[#F5E8A8] border-2 border-[#D4A843]/30 p-6 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-3xl flex-shrink-0" aria-hidden="true">🤖</div>
            <div>
              <h3 className="font-bold text-[#6B5744] mb-2">Message from HiMax</h3>
              <p className="text-[#3D2E1E] text-sm leading-relaxed italic">
                &quot;{aiFeedback}&quot;
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl" aria-hidden="true">🎉</span>
          <h1 className="text-3xl font-extrabold text-[#3D6B3D] leading-tight">Review Complete!</h1>
        </div>
        <p className="text-[#6B5744] font-semibold text-base pl-1">
          Great job, {review.studentName}! Here&apos;s what you learned reading <em className="not-italic font-extrabold text-[#3D2E1E]">&quot;{review.bookTitle}&quot;</em>
        </p>
      </div>

      {/* Summary Card */}
      <div className="ghibli-card p-5 sm:p-8 mb-6">
        <h2 className="text-xl font-extrabold text-[#3D2E1E] mb-6 flex items-center gap-2">
          <span aria-hidden="true">📊</span> Session Summary
        </h2>

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

            {review.levelScore !== undefined && isParentOrAdmin() && (
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

          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="text-center p-3 bg-[#E8F5E8] rounded-2xl border border-[#C8E6C9]">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#5C8B5C] leading-none">{totalWords}</div>
              <p className="text-[#6B5744] text-xs font-bold mt-1 leading-tight">Total Words</p>
            </div>
            <div className="text-center p-3 bg-[#FFF8E0] rounded-2xl border border-[#FFE082]">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#D4A843] leading-none">{newWords}</div>
              <p className="text-[#6B5744] text-xs font-bold mt-1 leading-tight">New Words</p>
            </div>
            <div className="text-center p-3 bg-[#FCE8E6] rounded-2xl border border-[#F5C6C2]">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#D4736B] leading-none">{reviewWords}</div>
              <p className="text-[#6B5744] text-xs font-bold mt-1 leading-tight">To Review</p>
            </div>
          </div>
        </div>
      </div>

      <ImaginationStudio
        bookTitle={review.bookTitle}
        studentName={review.studentName}
        conversation={conversation}
      />

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
                    <h4 className="font-extrabold text-[#3D2E1E]">{STAGE_DISPLAY_NAMES[stage.stage] || stage.stage}</h4>
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
                // Build safe React elements instead of dangerouslySetInnerHTML
                const renderHighlightedText = (text) => {
                  if (!vocabulary.length) return text;
                  // Escape regex special chars in words
                  const escapedWords = vocabulary.map(w => ({
                    ...w,
                    pattern: w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                  }));
                  const combinedPattern = new RegExp(`\\b(${escapedWords.map(w => w.pattern).join('|')})\\b`, 'gi');
                  const parts = text.split(combinedPattern);
                  return parts.map((part, i) => {
                    const matchedWord = vocabulary.find(w => w.word.toLowerCase() === part.toLowerCase());
                    if (matchedWord) {
                      return (
                        <span
                          key={i}
                          className="bg-[#FFF0C0] font-bold cursor-pointer hover:bg-[#FFE080]"
                          onClick={() => setHighlightedWord(matchedWord.id)}
                        >
                          {part}
                        </span>
                      );
                    }
                    return part;
                  });
                };

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
                      <p className="text-sm font-semibold">
                        {renderHighlightedText(msg.content)}
                      </p>
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

      {/* Printable Worksheet */}
      <div className="mb-6">
        <PrintableWorksheet
          sessionData={review}
          studentName={review?.studentName || 'Student'}
          bookTitle={review?.bookTitle || review?.book_title || 'My Book'}
        />
      </div>

      {/* Book Recommendations */}
      <div className="mb-6">
        <BookRecommendation
          studentLevel={review?.studentLevel || review?.level || 'intermediate'}
          studentId={review?.studentId || null}
          currentBook={{ title: review?.bookTitle || review?.book_title }}
          onSelectBook={() => router.push('/books')}
        />
      </div>

      {/* Parent Guide — visible to parents and admins only */}
      {isParentOrAdmin() && (
        <details className="mb-6 print:block" open={false}>
          <summary className="list-none cursor-pointer">
            <div className="flex items-center justify-between px-6 py-4 bg-[#F5F0E8] border-2 border-[#D4A843] rounded-3xl hover:bg-[#EDE5D4] transition-colors select-none">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">📋</span>
                <span className="text-lg font-extrabold text-[#3D2E1E]">Parent Guide</span>
                <span className="px-3 py-0.5 bg-[#D4A843] text-white text-xs font-bold rounded-full uppercase tracking-wide">
                  For Parents
                </span>
              </div>
              <span className="text-[#6B5744] font-bold text-sm">
                How to extend this learning at home ▼
              </span>
            </div>
          </summary>

          <div className="mt-2 border-2 border-[#D4A843] border-t-0 rounded-b-3xl bg-[#F5F0E8] p-6 space-y-6 print:border-t-2">

            {/* Discussion Questions */}
            <div>
              <h4 className="font-extrabold text-[#3D2E1E] mb-3 flex items-center gap-2">
                <span aria-hidden="true">💬</span> Discussion Questions
              </h4>
              <ul className="space-y-2">
                <li className="flex gap-2 text-sm text-[#3D2E1E]">
                  <span className="text-[#D4A843] font-bold flex-shrink-0">-</span>
                  <span>
                    &ldquo;What was your favorite part of <em className="not-italic font-bold">{review.bookTitle}</em>?&rdquo;
                  </span>
                </li>
                <li className="flex gap-2 text-sm text-[#3D2E1E]">
                  <span className="text-[#D4A843] font-bold flex-shrink-0">-</span>
                  <span>
                    &ldquo;Can you tell me about the main character in your own words?&rdquo;
                  </span>
                </li>
                <li className="flex gap-2 text-sm text-[#3D2E1E]">
                  <span className="text-[#D4A843] font-bold flex-shrink-0">-</span>
                  <span>
                    &ldquo;What would happen if <em className="not-italic font-bold">{review.bookTitle}</em> had a different ending?&rdquo;
                  </span>
                </li>
              </ul>
            </div>

            {/* Activities */}
            <div>
              <h4 className="font-extrabold text-[#3D2E1E] mb-3 flex items-center gap-2">
                <span aria-hidden="true">📝</span> Activities
              </h4>
              <ul className="space-y-2">
                {[
                  'Draw your favorite scene from the book',
                  `Write a short letter to the main character of ${review.bookTitle}`,
                  "Find 3 new words from today's session and use them in sentences",
                ].map((activity, idx) => (
                  <li key={idx} className="flex gap-2 text-sm text-[#3D2E1E]">
                    <span className="text-[#D4A843] font-bold flex-shrink-0">-</span>
                    <span>{activity}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Vocabulary Mission */}
            <div>
              <h4 className="font-extrabold text-[#3D2E1E] mb-3 flex items-center gap-2">
                <span aria-hidden="true">🎯</span> This Week&apos;s Vocabulary Mission
              </h4>
              {vocabulary.length > 0 ? (
                <>
                  <div className="space-y-2 mb-3">
                    {vocabulary.slice(0, 5).map((vocab, idx) => (
                      <div
                        key={vocab.id || idx}
                        className="flex items-start gap-3 p-3 bg-white rounded-xl border border-[#E8DEC8]"
                      >
                        <span className="font-extrabold text-[#D4A843] min-w-[24px] text-sm">
                          {idx + 1}.
                        </span>
                        <div>
                          <span className="font-extrabold text-[#3D2E1E]">{vocab.word}</span>
                          {vocab.contextSentence && (
                            <p className="text-xs text-[#6B5744] italic mt-0.5">
                              &ldquo;{vocab.contextSentence}&rdquo;
                            </p>
                          )}
                          {(vocab.synonyms || []).length > 0 && (
                            <p className="text-xs text-[#5C8B5C] mt-0.5">
                              Similar words: {vocab.synonyms.slice(0, 2).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-[#6B5744] italic font-semibold">
                    &ldquo;Try to use these words in everyday conversation!&rdquo;
                  </p>
                </>
              ) : (
                <p className="text-sm text-[#6B5744]">
                  No vocabulary data available for this session.
                </p>
              )}
            </div>

            {/* Session Summary for Parents */}
            <div>
              <h4 className="font-extrabold text-[#3D2E1E] mb-3 flex items-center gap-2">
                <span aria-hidden="true">📊</span> Session Summary for Parents
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white rounded-xl border border-[#E8DEC8] text-center">
                  <div className="text-2xl font-extrabold text-[#D4A843]">
                    {conversation.length}
                  </div>
                  <p className="text-xs font-bold text-[#6B5744] mt-1 leading-tight">
                    Total Conversation Turns
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-[#E8DEC8] text-center">
                  <div className="text-2xl font-extrabold text-[#5C8B5C]">
                    {vocabulary.length}
                  </div>
                  <p className="text-xs font-bold text-[#6B5744] mt-1 leading-tight">
                    New Words Encountered
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-[#E8DEC8] text-center">
                  <div className="text-2xl font-extrabold text-[#5C8B5C]">
                    {review.grammarScore || 0}%
                  </div>
                  <p className="text-xs font-bold text-[#6B5744] mt-1 leading-tight">
                    Grammar Accuracy
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-[#E8DEC8] text-center">
                  <div className="text-base font-extrabold text-[#6B5744] leading-tight">
                    {stageBreakdown.length > 0
                      ? stageBreakdown.filter((s) => s.completed).length === stageBreakdown.length
                        ? 'All stages complete'
                        : `${stageBreakdown.filter((s) => s.completed).length}/${stageBreakdown.length} stages`
                      : review.studentLevel || 'Beginner'}
                  </div>
                  <p className="text-xs font-bold text-[#6B5744] mt-1 leading-tight">
                    Thinking Depth
                  </p>
                </div>
              </div>
            </div>

          </div>
        </details>
      )}

      {/* Parent Guide — practical at-home tips, visible to parents and admins only */}
      {isParent && (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-[#D4A843]/30 bg-[#F5F0E8]/50 p-6">
          <h3 className="text-lg font-bold text-[#3D6B3D] mb-4 flex items-center gap-2">
            <span aria-hidden="true">📋</span> Parent Guide — How to Use This at Home
          </h3>
          <div className="space-y-3 text-sm text-[#3D2E1E]">
            <div className="flex gap-3">
              <span className="text-[#D4A843] font-bold min-w-[24px]">1.</span>
              <p><strong>Talk about it at dinner:</strong> Ask your child &ldquo;What was the most interesting thing about the book?&rdquo; Use the vocabulary words naturally in conversation.</p>
            </div>
            <div className="flex gap-3">
              <span className="text-[#D4A843] font-bold min-w-[24px]">2.</span>
              <p><strong>Word wall:</strong> Write 2-3 new words on sticky notes and place them where your child can see them daily (fridge, desk, bathroom mirror).</p>
            </div>
            <div className="flex gap-3">
              <span className="text-[#D4A843] font-bold min-w-[24px]">3.</span>
              <p><strong>Connect to real life:</strong> When you encounter situations related to the book&apos;s themes, ask &ldquo;Remember in the book when...? This is kind of like that!&rdquo;</p>
            </div>
          </div>
          <p className="text-xs text-[#9C8B74] mt-4 italic">This guide is only visible to parents and guardians.</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-center no-print">
        <button
          onClick={() => router.push('/books')}
          className="flex-1 sm:flex-initial min-h-[52px] px-8 py-3 bg-[#5C8B5C] text-white rounded-2xl hover:bg-[#3D6B3D] transition-all font-bold hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(92,139,92,0.3)] focus-visible:ring-2 focus-visible:ring-[#3D6B3D] flex items-center justify-center gap-2"
        >
          <span aria-hidden="true">🚀</span>
          Review Another Book
        </button>
        <button
          onClick={() => router.push('/vocabulary')}
          className="flex-1 sm:flex-initial min-h-[52px] px-8 py-3 bg-[#D4A843] text-white rounded-2xl hover:bg-[#A8822E] transition-all font-bold hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(212,168,67,0.3)] focus-visible:ring-2 focus-visible:ring-[#D4A843] flex items-center justify-center gap-2"
        >
          <span aria-hidden="true">📖</span>
          Practice These Words
        </button>
        <button
          onClick={() => router.push('/profile')}
          className="flex-1 sm:flex-initial min-h-[52px] px-8 py-3 bg-[#EDE5D4] text-[#6B5744] rounded-2xl hover:bg-[#D6C9A8] transition-all font-bold hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#6B5744] flex items-center justify-center gap-2"
        >
          <span aria-hidden="true">👤</span>
          View Profile
        </button>

        {/* Download Report button — triggers browser print dialog */}
        <button
          onClick={handlePrint}
          aria-label="Download or print this learning report as PDF"
          className="flex-1 sm:flex-initial min-h-[52px] px-8 py-3 bg-[#3D2E1E] text-white rounded-2xl hover:bg-[#6B5744] transition-all font-bold hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(61,46,30,0.3)] focus-visible:ring-2 focus-visible:ring-[#3D2E1E] flex items-center justify-center gap-2"
        >
          {/* Printer SVG icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Download Report
        </button>
      </div>
    </div>
  );
}
