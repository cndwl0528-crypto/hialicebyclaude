/**
 * bookRecommender.js
 * HiAlice — Personalized Book Recommendation Engine
 *
 * Synthesizes student reading history, vocabulary data, and book metadata to
 * generate ranked, explainable book recommendations for students aged 6-13.
 *
 * Adapted from the ECC "Deep Research" multi-source synthesis pattern:
 * instead of querying external web sources, this engine queries Supabase for
 * student signals and cross-references them against the full book catalogue.
 *
 * Architecture:
 *   buildStudentProfile()     — Assembles a rich student reading profile from DB
 *   calculateBookSimilarity() — Jaccard-based multi-factor similarity (0–1)
 *   assessDifficultyFit()     — Determines if a book matches student trajectory
 *   categorizeThemes()        — Maps raw themes to canonical THEME_CATEGORIES
 *   generateExplanation()     — Produces a warm, child-appropriate reason string
 *   BookRecommender           — Orchestrator class that runs the full algorithm
 *
 * Public API entry points (for route integration):
 *   getRecommendationsForStudent(studentId, count)
 *   getSimilarBooksForBook(bookId, count)
 *   getNextSuggestion(studentId)
 *
 * Design principles:
 *   - All DB queries fail gracefully — empty arrays/nulls on error, never throws
 *   - Book catalogue is cached in-process after the first load (books change rarely)
 *   - All scoring is deterministic and unit-testable (pure functions)
 *   - Explanations use warm, age-appropriate child language
 *   - ES Modules throughout, consistent with the rest of the HiAlice backend
 */

import { supabase } from '../lib/supabase.js';
import logger from '../lib/logger.js';

// ============================================================================
// THEME TAXONOMY
// ============================================================================

/**
 * Canonical theme categories with synonym lists for fuzzy theme matching.
 * Raw theme strings from the DB are mapped against these before comparison.
 * Add or extend categories here as the book catalogue grows.
 */
export const THEME_CATEGORIES = {
  FRIENDSHIP:    ['friendship', 'friends', 'companionship', 'loyalty', 'trust'],
  ADVENTURE:     ['adventure', 'journey', 'quest', 'exploration', 'discovery'],
  FAMILY:        ['family', 'parents', 'siblings', 'home', 'belonging'],
  COURAGE:       ['courage', 'bravery', 'fear', 'overcoming', 'challenge'],
  IDENTITY:      ['identity', 'self-discovery', 'growing up', 'change', 'individuality'],
  NATURE:        ['nature', 'animals', 'environment', 'seasons', 'earth'],
  KINDNESS:      ['kindness', 'empathy', 'helping', 'compassion', 'generosity'],
  IMAGINATION:   ['imagination', 'creativity', 'dreams', 'magic', 'wonder'],
  PERSEVERANCE:  ['perseverance', 'determination', 'hard work', 'never give up', 'resilience'],
  JUSTICE:       ['justice', 'fairness', 'right and wrong', 'equality', 'standing up'],
};

// Flat lookup: synonym → canonical category name.
// Built once at module load time to keep categorizeThemes() O(n).
const SYNONYM_TO_CATEGORY = new Map();
for (const [category, synonyms] of Object.entries(THEME_CATEGORIES)) {
  for (const synonym of synonyms) {
    SYNONYM_TO_CATEGORY.set(synonym.toLowerCase(), category);
  }
}

// ============================================================================
// LEVEL ORDERING
// ============================================================================

// Numeric rank used for difficulty-fit calculations.
const LEVEL_RANK = { beginner: 1, intermediate: 2, advanced: 3 };

// Score thresholds that define performance bands.
const SCORE_THRESHOLDS = {
  READY_FOR_NEXT:  85,  // Student consistently ≥ 85% → ready to level up
  COMFORTABLE:     70,  // 70-84% → solidly at current level
  DEVELOPING:      50,  // 50-69% → stay at current level, need more practice
  STRUGGLING:       0,  // < 50%  → consider easier books
};

// ============================================================================
// INTERNAL UTILITIES
// ============================================================================

/**
 * Compute the Jaccard similarity between two arrays of strings.
 * Jaccard = |intersection| / |union|
 *
 * @param {string[]} a
 * @param {string[]} b
 * @returns {number} Value in [0, 1]; 0 when both arrays are empty.
 */
function jaccardSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  const setA = new Set(a.map((s) => (s || '').toLowerCase().trim()));
  const setB = new Set(b.map((s) => (s || '').toLowerCase().trim()));

  // Remove empty strings that may arise from trimming
  setA.delete('');
  setB.delete('');

  if (setA.size === 0 && setB.size === 0) return 0;

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

/**
 * Compute the overlap score between two keyword/phrase arrays using a
 * token-level substring match to handle minor phrasing variations.
 *
 * @param {string[]} a
 * @param {string[]} b
 * @returns {number} Value in [0, 1]
 */
function softOverlapScore(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return 0;

  const normalise = (arr) => arr.map((s) => (s || '').toLowerCase().trim()).filter(Boolean);
  const normA = normalise(a);
  const normB = normalise(b);

  let matches = 0;
  for (const termA of normA) {
    if (normB.some((termB) => termB.includes(termA) || termA.includes(termB))) {
      matches += 1;
    }
  }
  return matches / Math.max(normA.length, normB.length);
}

/**
 * Compute a keyword overlap score between two moral_lesson strings.
 * Splits both strings on whitespace/punctuation and measures token overlap.
 *
 * @param {string} lessonA
 * @param {string} lessonB
 * @returns {number} Value in [0, 1]
 */
function moralLessonOverlap(lessonA, lessonB) {
  if (!lessonA || !lessonB) return 0;

  const tokenise = (str) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 3); // skip stop-words by ignoring very short tokens

  const tokensA = new Set(tokenise(lessonA));
  const tokensB = new Set(tokenise(lessonB));
  if (tokensA.size === 0 && tokensB.size === 0) return 0;

  const intersection = new Set([...tokensA].filter((t) => tokensB.has(t)));
  const union = new Set([...tokensA, ...tokensB]);
  return intersection.size / union.size;
}

/**
 * Safely compute the mean of a numeric array.
 * Returns 0 for empty arrays.
 *
 * @param {number[]} arr
 * @returns {number}
 */
function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

/**
 * Clamp a value to the [0, 1] range.
 *
 * @param {number} value
 * @returns {number}
 */
function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

// ============================================================================
// THEME FUNCTIONS
// ============================================================================

/**
 * Map an array of raw theme strings to canonical THEME_CATEGORIES keys.
 * Themes that do not match any synonym list are returned in `uncategorized`.
 *
 * @param {string[]} themes - Raw theme strings from book.key_themes[]
 * @returns {{ categories: string[], uncategorized: string[] }}
 */
export function categorizeThemes(themes) {
  if (!Array.isArray(themes)) return { categories: [], uncategorized: [] };

  const categories = new Set();
  const uncategorized = [];

  for (const theme of themes) {
    const normalised = (theme || '').toLowerCase().trim();
    if (!normalised) continue;

    // Direct lookup first
    if (SYNONYM_TO_CATEGORY.has(normalised)) {
      categories.add(SYNONYM_TO_CATEGORY.get(normalised));
      continue;
    }

    // Partial match: check if any synonym is a substring of the theme or vice versa
    let matched = false;
    for (const [synonym, category] of SYNONYM_TO_CATEGORY) {
      if (normalised.includes(synonym) || synonym.includes(normalised)) {
        categories.add(category);
        matched = true;
        break;
      }
    }

    if (!matched) {
      uncategorized.push(theme);
    }
  }

  return {
    categories: Array.from(categories),
    uncategorized,
  };
}

// ============================================================================
// STUDENT PROFILE BUILDER
// ============================================================================

/**
 * Query Supabase and assemble a comprehensive reading profile for a student.
 *
 * The profile captures:
 *   - Demographic data (age, level)
 *   - All completed session scores and the books' theme metadata
 *   - Average session performance (used for difficulty-fit assessment)
 *   - Vocabulary mastery distribution (below / at / above grade level)
 *   - Preferred themes (from high-scoring sessions)
 *   - Avoided themes (from low-scoring or absent sessions)
 *   - Reading streak (consecutive days with at least one completed session)
 *
 * @param {string} studentId - UUID of the student
 * @returns {Promise<{
 *   studentId: string,
 *   level: string,
 *   age: number,
 *   booksRead: Array<{ bookId: string, title: string, score: number, themes: string[] }>,
 *   avgScore: number,
 *   vocabularyLevel: 'below' | 'at' | 'above',
 *   preferredThemes: string[],
 *   avoidThemes: string[],
 *   totalSessions: number,
 *   readingStreak: number
 * }>}
 */
export async function buildStudentProfile(studentId) {
  // Fallback profile returned on any DB error
  const fallback = {
    studentId,
    level: 'intermediate',
    age: 10,
    booksRead: [],
    avgScore: 0,
    vocabularyLevel: 'at',
    preferredThemes: [],
    avoidThemes: [],
    totalSessions: 0,
    readingStreak: 0,
  };

  try {
    // --- 1. Student demographic record ---
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, age, level')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      logger.warn({ studentId, err: studentError?.message }, '[BookRecommender] Student not found');
      return fallback;
    }

    // --- 2. Completed sessions with scores ---
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, book_id, level_score, grammar_score, completed_at')
      .eq('student_id', studentId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false });

    if (sessionsError) {
      logger.warn(
        { studentId, err: sessionsError.message },
        '[BookRecommender] Sessions query failed'
      );
    }

    const completedSessions = sessions || [];

    // --- 3. Fetch book metadata for all read books ---
    const bookIds = [...new Set(completedSessions.map((s) => s.book_id).filter(Boolean))];

    let booksMap = new Map(); // bookId → book record
    if (bookIds.length > 0) {
      const { data: books, error: booksError } = await supabase
        .from('books')
        .select('id, title, author, level, genre, key_themes, emotional_keywords, moral_lesson')
        .in('id', bookIds);

      if (booksError) {
        logger.warn(
          { studentId, err: booksError.message },
          '[BookRecommender] Books metadata query failed'
        );
      }

      for (const book of books || []) {
        booksMap.set(book.id, book);
      }
    }

    // --- 4. Build booksRead array and compute per-session composite score ---
    //        Composite score = average of level_score and grammar_score (both 0-100)
    const booksRead = [];
    const allScores = [];
    const themesFromHighScoringSessions = [];
    const themesFromLowScoringSessions = [];

    for (const session of completedSessions) {
      const book = booksMap.get(session.book_id);
      const compositeScore = mean(
        [session.level_score, session.grammar_score].filter((v) => v != null)
      );

      allScores.push(compositeScore);

      const themes = book?.key_themes || [];
      booksRead.push({
        bookId:  session.book_id,
        title:   book?.title || 'Unknown',
        score:   compositeScore,
        themes,
      });

      if (compositeScore >= SCORE_THRESHOLDS.COMFORTABLE) {
        themesFromHighScoringSessions.push(...themes);
      } else if (compositeScore < SCORE_THRESHOLDS.DEVELOPING) {
        themesFromLowScoringSessions.push(...themes);
      }
    }

    const avgScore = mean(allScores);

    // --- 5. Preferred and avoided themes ---
    //        Deduplicate and sort by frequency; preferred excludes avoided themes
    const countFrequency = (arr) => {
      const freq = new Map();
      for (const t of arr) {
        const key = (t || '').toLowerCase().trim();
        if (key) freq.set(key, (freq.get(key) || 0) + 1);
      }
      return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
    };

    const avoidThemes = countFrequency(themesFromLowScoringSessions);
    const allPreferred = countFrequency(themesFromHighScoringSessions);
    // Remove themes that also appear in avoidThemes to reduce noise
    const avoidSet = new Set(avoidThemes);
    const preferredThemes = allPreferred.filter((t) => !avoidSet.has(t));

    // --- 6. Vocabulary level assessment ---
    //        Compare student's mastered vocabulary count vs expected-for-level
    const { data: vocabRows, error: vocabError } = await supabase
      .from('vocabulary')
      .select('mastery_level')
      .eq('student_id', studentId);

    if (vocabError) {
      logger.warn(
        { studentId, err: vocabError.message },
        '[BookRecommender] Vocabulary query failed'
      );
    }

    const vocab = vocabRows || [];
    const masteredCount = vocab.filter((v) => (v.mastery_level || 0) >= 3).length;
    const learningCount = vocab.filter((v) => (v.mastery_level || 0) >= 1 && (v.mastery_level || 0) < 3).length;

    // Rough benchmarks per level (words mastered)
    const VOCAB_BENCHMARKS = { beginner: 50, intermediate: 150, advanced: 350 };
    const benchmark = VOCAB_BENCHMARKS[student.level] || 150;

    let vocabularyLevel;
    if (masteredCount >= benchmark * 1.2) {
      vocabularyLevel = 'above';
    } else if (masteredCount >= benchmark * 0.7) {
      vocabularyLevel = 'at';
    } else {
      vocabularyLevel = 'below';
    }

    // --- 7. Reading streak ---
    //        Count consecutive calendar days (from today backward) with a session
    let readingStreak = 0;
    if (completedSessions.length > 0) {
      const sessionDates = completedSessions
        .map((s) => s.completed_at)
        .filter(Boolean)
        .map((d) => new Date(d).toDateString())
        .filter((v, i, arr) => arr.indexOf(v) === i) // unique days
        .sort((a, b) => new Date(b) - new Date(a));   // descending

      const todayStr = new Date().toDateString();
      const yesterdayStr = new Date(Date.now() - 86_400_000).toDateString();

      // Streak must start from today or yesterday to be considered active
      if (sessionDates[0] === todayStr || sessionDates[0] === yesterdayStr) {
        let cursor = new Date(sessionDates[0]);
        for (const dateStr of sessionDates) {
          if (new Date(dateStr).toDateString() === cursor.toDateString()) {
            readingStreak += 1;
            cursor = new Date(cursor.getTime() - 86_400_000);
          } else {
            break;
          }
        }
      }
    }

    return {
      studentId,
      level:           student.level,
      age:             student.age,
      booksRead,
      avgScore,
      vocabularyLevel,
      preferredThemes,
      avoidThemes,
      totalSessions:   completedSessions.length,
      readingStreak,
      // Internal: expose learning vocabulary for vocab-growth scoring in recommender
      _learningVocab:  vocab
        .filter((v) => (v.mastery_level || 0) >= 1 && (v.mastery_level || 0) < 3)
        .map((v) => v.word)
        .filter(Boolean),
    };
  } catch (err) {
    logger.error({ studentId, err: err.message }, '[BookRecommender] buildStudentProfile failed');
    return fallback;
  }
}

// ============================================================================
// BOOK SIMILARITY SCORING
// ============================================================================

/**
 * Compute a weighted similarity score between two book records.
 *
 * Weights (must sum to 1.00):
 *   Theme overlap (Jaccard on key_themes[])      0.35
 *   Emotional keyword overlap                    0.20
 *   Same author                                  0.15
 *   Same genre                                   0.15
 *   Same level                                   0.10
 *   Moral lesson overlap (token intersection)    0.05
 *
 * @param {object} bookA - Full book record from DB
 * @param {object} bookB - Full book record from DB
 * @returns {{ similarity: number, factors: string[] }}
 */
export function calculateBookSimilarity(bookA, bookB) {
  if (!bookA || !bookB) return { similarity: 0, factors: [] };

  const factors = [];

  // --- Theme overlap (Jaccard) — weight 0.35 ---
  const themeScore = jaccardSimilarity(bookA.key_themes, bookB.key_themes);
  if (themeScore > 0) factors.push(`shared themes (${Math.round(themeScore * 100)}% overlap)`);

  // --- Emotional keyword overlap — weight 0.20 ---
  const emotionScore = jaccardSimilarity(bookA.emotional_keywords, bookB.emotional_keywords);
  if (emotionScore > 0) factors.push(`similar emotional tone`);

  // --- Same author — weight 0.15 ---
  const authorScore =
    bookA.author && bookB.author && bookA.author.toLowerCase() === bookB.author.toLowerCase()
      ? 1
      : 0;
  if (authorScore) factors.push(`same author (${bookA.author})`);

  // --- Same genre — weight 0.15 ---
  const genreScore =
    bookA.genre && bookB.genre && bookA.genre.toLowerCase() === bookB.genre.toLowerCase() ? 1 : 0;
  if (genreScore) factors.push(`same genre (${bookA.genre})`);

  // --- Same level — weight 0.10 ---
  const levelScore =
    bookA.level && bookB.level && bookA.level.toLowerCase() === bookB.level.toLowerCase() ? 1 : 0;
  if (levelScore) factors.push(`same reading level`);

  // --- Moral lesson overlap — weight 0.05 ---
  const moralScore = moralLessonOverlap(bookA.moral_lesson, bookB.moral_lesson);
  if (moralScore > 0.2) factors.push(`similar life lesson`);

  const similarity = clamp01(
    themeScore  * 0.35 +
    emotionScore * 0.20 +
    authorScore  * 0.15 +
    genreScore   * 0.15 +
    levelScore   * 0.10 +
    moralScore   * 0.05
  );

  return { similarity, factors };
}

// ============================================================================
// DIFFICULTY FIT ASSESSMENT
// ============================================================================

/**
 * Determine whether a book's level matches the student's current learning
 * trajectory based on their average session performance.
 *
 * Logic:
 *   avgScore >= 85% AND book is one level above → 'stretch'
 *   avgScore >= 85% AND book is at same level   → 'easy'
 *   avgScore 70-84% AND book is at same level   → 'perfect'
 *   avgScore 50-69% AND book is at same level   → 'perfect' (needs practice)
 *   avgScore < 50%  AND book is one level below → 'perfect' (remediation)
 *   book is two+ levels above student level     → 'too_hard'
 *   book is two+ levels below student level     → 'easy'
 *
 * @param {object} book           - Book record with `level` field
 * @param {object} studentProfile - Output of buildStudentProfile()
 * @returns {{ fit: 'perfect' | 'stretch' | 'easy' | 'too_hard', reason: string, score: number }}
 */
export function assessDifficultyFit(book, studentProfile) {
  if (!book || !studentProfile) {
    return { fit: 'perfect', reason: 'Insufficient data', score: 0.5 };
  }

  const studentRank = LEVEL_RANK[studentProfile.level] ?? 2;
  const bookRank    = LEVEL_RANK[book.level]           ?? 2;
  const rankDelta   = bookRank - studentRank; // positive = book is harder
  const avgScore    = studentProfile.avgScore || 0;

  // Gate: book is far too difficult (2+ levels above)
  if (rankDelta >= 2) {
    return {
      fit:    'too_hard',
      reason: `This book is much harder than your current reading level`,
      score:  0.1,
    };
  }

  // Gate: book is far too easy (2+ levels below)
  if (rankDelta <= -2) {
    return {
      fit:    'easy',
      reason: `This book is easier than what you usually read`,
      score:  0.3,
    };
  }

  // High performer: ready for next level
  if (avgScore >= SCORE_THRESHOLDS.READY_FOR_NEXT) {
    if (rankDelta === 1) {
      return {
        fit:    'stretch',
        reason: `You've been doing so well, this slightly harder book is a great next challenge`,
        score:  0.85,
      };
    }
    if (rankDelta === 0) {
      return {
        fit:    'easy',
        reason: `This is at your current level — a comfortable read to build confidence`,
        score:  0.6,
      };
    }
    if (rankDelta === -1) {
      return {
        fit:    'easy',
        reason: `This is a bit easier than what you can handle right now`,
        score:  0.4,
      };
    }
  }

  // Comfortable performer
  if (avgScore >= SCORE_THRESHOLDS.COMFORTABLE) {
    if (rankDelta === 0) {
      return {
        fit:    'perfect',
        reason: `This book is just right for your reading level`,
        score:  0.9,
      };
    }
    if (rankDelta === 1) {
      return {
        fit:    'stretch',
        reason: `This is a little more challenging — great for growing your skills`,
        score:  0.7,
      };
    }
    if (rankDelta === -1) {
      return {
        fit:    'easy',
        reason: `This is a bit easier than usual — nice for a relaxed read`,
        score:  0.5,
      };
    }
  }

  // Developing performer: stay at current level
  if (avgScore >= SCORE_THRESHOLDS.DEVELOPING) {
    if (rankDelta === 0) {
      return {
        fit:    'perfect',
        reason: `This book is perfect for building your reading skills right now`,
        score:  0.85,
      };
    }
    if (rankDelta === 1) {
      return {
        fit:    'too_hard',
        reason: `This book might be a bit tricky right now — let's build up to it`,
        score:  0.2,
      };
    }
    if (rankDelta === -1) {
      return {
        fit:    'easy',
        reason: `This is a slightly easier book, which is great for building confidence`,
        score:  0.55,
      };
    }
  }

  // Struggling performer: consider easier books
  if (rankDelta === -1) {
    return {
      fit:    'perfect',
      reason: `Starting with an easier book will help build your reading confidence`,
      score:  0.8,
    };
  }
  if (rankDelta === 0) {
    return {
      fit:    'stretch',
      reason: `This is at your current level — keep practicing and it will get easier`,
      score:  0.5,
    };
  }

  // Default fallback
  return {
    fit:    'perfect',
    reason: `This book matches your reading level`,
    score:  0.7,
  };
}

// ============================================================================
// RECOMMENDATION EXPLANATION GENERATOR
// ============================================================================

/**
 * Generate a child-friendly, warm explanation for why a book is being
 * recommended to a student.
 *
 * Explanation candidates are evaluated in priority order:
 *   1. Preferred theme match with a specific previously-read book
 *   2. General preferred theme match
 *   3. Difficulty progression signal
 *   4. Vocabulary growth opportunity
 *   5. Author familiarity
 *   6. Genre familiarity
 *   7. Reading streak encouragement
 *   8. Generic fallback
 *
 * @param {object} recommendation - A recommendation object from getRecommendations()
 * @param {object} studentProfile - Output of buildStudentProfile()
 * @returns {string} 1-2 sentence warm explanation
 */
export function generateExplanation(recommendation, studentProfile) {
  if (!recommendation || !studentProfile) {
    return 'I think you would really enjoy this book!';
  }

  const { book, difficultyFit, themeMatch, vocabGrowthWords, category } = recommendation;
  const { preferredThemes, booksRead, readingStreak, level } = studentProfile;

  // Helper: pick a random item from an array
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // --- 1. Named preferred theme + specific book reference ---
  if (preferredThemes.length > 0 && book.key_themes?.length > 0) {
    const bookThemesNorm = book.key_themes.map((t) => t.toLowerCase().trim());
    const matchedTheme = preferredThemes.find((pt) =>
      bookThemesNorm.some((bt) => bt.includes(pt) || pt.includes(bt))
    );

    if (matchedTheme) {
      // Try to name the book the theme came from
      const sourceBook = booksRead.find((br) =>
        br.themes.some((t) => t.toLowerCase().includes(matchedTheme))
      );

      if (sourceBook) {
        const templates = [
          `This book is about ${matchedTheme}, just like your favorite book ${sourceBook.title} — I think you'll love it!`,
          `You really enjoyed ${sourceBook.title}, and this book has the same ${matchedTheme} theme!`,
          `Since you loved the ${matchedTheme} in ${sourceBook.title}, I think this book will be perfect for you!`,
        ];
        return pick(templates);
      }

      const templates = [
        `This book is full of ${matchedTheme} — I know that's one of your favorite themes!`,
        `I picked this because you love stories about ${matchedTheme}!`,
        `You always enjoy ${matchedTheme} stories, and this one has lots of it!`,
      ];
      return pick(templates);
    }
  }

  // --- 2. Difficulty progression ---
  if (category === 'stretch_goal') {
    const templates = [
      `You've been doing so well that I think you're ready for a slightly harder book — great job!`,
      `You've been working really hard, and I think this book is the perfect next step for you!`,
      `You're growing as a reader — this book will be a fun challenge!`,
    ];
    return pick(templates);
  }

  if (category === 'comfort_read') {
    return `This is a lovely book at your level — perfect for a relaxed and enjoyable read!`;
  }

  // --- 3. Vocabulary growth opportunity ---
  if (vocabGrowthWords && vocabGrowthWords.length > 0) {
    const word = vocabGrowthWords[0];
    const templates = [
      `You're learning the word "${word}" — this book is full of it!`,
      `This book uses words you're practicing, like "${word}" — great timing!`,
      `I picked this because it will help you learn more words like "${word}"!`,
    ];
    return pick(templates);
  }

  // --- 4. Author familiarity ---
  if (book.author && booksRead.some((br) => br.title && br.title !== book.title)) {
    // We don't have the author stored per booksRead, so we use a generic template
    // if the theme match did not fire
    const templates = [
      `I think the story in this book will really capture your imagination!`,
      `This is a wonderful story that I think you will really enjoy!`,
    ];
    return pick(templates);
  }

  // --- 5. Reading streak encouragement ---
  if (readingStreak >= 3) {
    return `You're on a ${readingStreak}-day reading streak — amazing! Keep it going with this great book!`;
  }

  // --- 6. New territory (expose student to something new) ---
  if (category === 'new_territory') {
    return `This book is a little different from what you usually read — I think you'll discover something new and exciting!`;
  }

  // --- 7. Generic warm fallback ---
  const fallbacks = [
    `I think you'd really enjoy this book — give it a try!`,
    `This is one of my favorites to recommend — I hope you love it!`,
    `I have a feeling this book is going to be a great match for you!`,
  ];
  return pick(fallbacks);
}

// ============================================================================
// BOOK RECOMMENDER CLASS
// ============================================================================

/**
 * Orchestrator class that runs the full recommendation algorithm.
 *
 * Instantiate once per request and call getRecommendations() or related methods.
 * The book catalogue is cached in-process between calls (books change rarely).
 */
export class BookRecommender {
  constructor() {
    this.bookCache = null; // { books: Book[], loadedAt: Date }
    this._cacheMaxAge = 10 * 60 * 1000; // 10 minutes in milliseconds
  }

  // --------------------------------------------------------------------------
  // BOOK CACHE
  // --------------------------------------------------------------------------

  /**
   * Load all books from Supabase, using an in-process cache to avoid
   * repeated full-table scans. Cache is invalidated after 10 minutes.
   *
   * @returns {Promise<object[]>} Array of book records
   * @private
   */
  async _loadBooks() {
    const now = Date.now();

    if (
      this.bookCache &&
      this.bookCache.books.length > 0 &&
      now - this.bookCache.loadedAt < this._cacheMaxAge
    ) {
      return this.bookCache.books;
    }

    try {
      const { data: books, error } = await supabase
        .from('books')
        .select(
          'id, title, author, level, genre, cover_emoji, description, synopsis, ' +
          'key_themes, emotional_keywords, key_characters, moral_lesson'
        );

      if (error) {
        logger.warn({ err: error.message }, '[BookRecommender] Failed to load book catalogue');
        return this.bookCache?.books || [];
      }

      this.bookCache = { books: books || [], loadedAt: now };
      logger.debug(
        { count: (books || []).length },
        '[BookRecommender] Book catalogue loaded into cache'
      );
      return this.bookCache.books;
    } catch (err) {
      logger.error({ err: err.message }, '[BookRecommender] _loadBooks threw unexpectedly');
      return this.bookCache?.books || [];
    }
  }

  // --------------------------------------------------------------------------
  // THEME MATCH SCORING
  // --------------------------------------------------------------------------

  /**
   * Score a book against a student's preferred themes.
   * Uses canonical category matching to tolerate synonym variation.
   *
   * @param {object} book              - Book record
   * @param {string[]} preferredThemes - From studentProfile.preferredThemes
   * @returns {number} Value in [0, 1]
   * @private
   */
  _themeMatchScore(book, preferredThemes) {
    if (!book.key_themes?.length || !preferredThemes?.length) return 0;

    const { categories: bookCategories } = categorizeThemes(book.key_themes);
    const { categories: preferredCategories } = categorizeThemes(preferredThemes);

    // Jaccard on canonical categories for robustness
    const categoryScore = jaccardSimilarity(bookCategories, preferredCategories);

    // Raw string overlap as a secondary signal
    const rawScore = softOverlapScore(book.key_themes, preferredThemes);

    // Blend: category match dominates
    return clamp01(categoryScore * 0.7 + rawScore * 0.3);
  }

  // --------------------------------------------------------------------------
  // NOVELTY SCORING
  // --------------------------------------------------------------------------

  /**
   * Compute a novelty score for a book relative to the student's recent reads.
   * Some novelty is desirable (exploration), but full divergence from preferences
   * is penalised.
   *
   * Target: books with 30-60% theme overlap with recent reads score highest.
   *
   * @param {object}   book       - Book record
   * @param {object[]} recentRead - Last 3 entries from booksRead[]
   * @returns {number} Value in [0, 1]
   * @private
   */
  _noveltyScore(book, recentRead) {
    if (!recentRead || recentRead.length === 0) return 0.5; // no history → neutral

    // Average similarity to recent reads
    const similarities = recentRead.map((rb) => {
      return jaccardSimilarity(book.key_themes, rb.themes);
    });
    const avgSimilarity = mean(similarities);

    // Novelty peaks at ~0.35 similarity (different enough to be interesting,
    // similar enough to be relatable). Use an inverted quadratic.
    const target = 0.35;
    const distance = Math.abs(avgSimilarity - target);
    return clamp01(1 - distance * 2);
  }

  // --------------------------------------------------------------------------
  // VOCABULARY GROWTH SCORING
  // --------------------------------------------------------------------------

  /**
   * Score a book by its potential to reinforce words the student is currently
   * learning. Words in the student's "learning" vocabulary (mastery_level 1-2)
   * that appear in the book's themes or emotional keywords add to the score.
   *
   * @param {object}   book         - Book record
   * @param {string[]} learningVocab - Words with mastery_level 1-2 from profile
   * @returns {{ score: number, growthWords: string[] }}
   * @private
   */
  _vocabGrowthScore(book, learningVocab) {
    if (!learningVocab || learningVocab.length === 0) {
      return { score: 0, growthWords: [] };
    }

    // Collect all theme-adjacent text from the book
    const bookText = [
      ...(book.key_themes || []),
      ...(book.emotional_keywords || []),
      ...(book.moral_lesson ? book.moral_lesson.split(/\s+/) : []),
    ]
      .join(' ')
      .toLowerCase();

    const growthWords = learningVocab.filter((word) => {
      if (!word) return false;
      return bookText.includes(word.toLowerCase());
    });

    const score = growthWords.length > 0
      ? clamp01(growthWords.length / Math.max(learningVocab.length, 1))
      : 0;

    return { score, growthWords };
  }

  // --------------------------------------------------------------------------
  // RECOMMENDATION CATEGORY LABELLING
  // --------------------------------------------------------------------------

  /**
   * Assign a human-readable category to a recommendation based on its
   * composite scores.
   *
   * @param {string} difficultyFit  - 'perfect' | 'stretch' | 'easy' | 'too_hard'
   * @param {number} themeMatchScore
   * @param {number} noveltyScore
   * @returns {'perfect_match' | 'stretch_goal' | 'comfort_read' | 'new_territory'}
   * @private
   */
  _labelCategory(difficultyFit, themeMatchScore, noveltyScore) {
    if (difficultyFit === 'stretch' && themeMatchScore >= 0.3) return 'stretch_goal';
    if (themeMatchScore >= 0.5 && difficultyFit !== 'too_hard') return 'perfect_match';
    if (difficultyFit === 'easy' && themeMatchScore >= 0.3) return 'comfort_read';
    if (noveltyScore >= 0.7) return 'new_territory';
    if (difficultyFit === 'perfect') return 'perfect_match';
    return 'comfort_read';
  }

  // --------------------------------------------------------------------------
  // MAIN RECOMMENDATION ALGORITHM
  // --------------------------------------------------------------------------

  /**
   * Generate personalised book recommendations for a student.
   *
   * Algorithm:
   *   1. Build student profile (DB queries)
   *   2. Load book catalogue (cached)
   *   3. Filter out already-read books (if excludeRead = true)
   *   4. Score each candidate book on four dimensions:
   *        a. Theme match     (weight 0.30)
   *        b. Difficulty fit  (weight 0.30)
   *        c. Novelty         (weight 0.20)
   *        d. Vocab growth    (weight 0.20)
   *   5. Sort by composite score, return top N with explanations
   *
   * @param {string} studentId
   * @param {object} [options={}]
   * @param {number}  [options.count=5]          - Number of recommendations to return
   * @param {boolean} [options.includeStretch=true]  - Include stretch-level books
   * @param {boolean} [options.excludeRead=true]  - Exclude already-completed books
   * @returns {Promise<Array<{
   *   book: object,
   *   score: number,
   *   reasons: string[],
   *   category: string,
   *   themeMatch: number,
   *   difficultyFit: string,
   *   vocabGrowthWords: string[]
   * }>>}
   */
  async getRecommendations(studentId, options = {}) {
    const {
      count          = 5,
      includeStretch = true,
      excludeRead    = true,
    } = options;

    try {
      // --- 1. Build student profile ---
      const studentProfile = await buildStudentProfile(studentId);

      // --- 2. Load book catalogue ---
      const allBooks = await this._loadBooks();

      if (allBooks.length === 0) {
        logger.warn({ studentId }, '[BookRecommender] Empty book catalogue — returning []');
        return [];
      }

      // --- 3. Filter out already-read books ---
      const readBookIds = new Set(
        studentProfile.booksRead.map((b) => b.bookId).filter(Boolean)
      );

      let candidates = excludeRead
        ? allBooks.filter((b) => !readBookIds.has(b.id))
        : allBooks;

      // --- 3b. Filter out books that are too hard to be useful ---
      if (!includeStretch) {
        candidates = candidates.filter((b) => {
          const { fit } = assessDifficultyFit(b, studentProfile);
          return fit !== 'too_hard' && fit !== 'stretch';
        });
      } else {
        // Always remove books that are genuinely out of reach (2+ levels above)
        candidates = candidates.filter((b) => {
          const studentRank = LEVEL_RANK[studentProfile.level] ?? 2;
          const bookRank    = LEVEL_RANK[b.level]              ?? 2;
          return bookRank - studentRank < 2;
        });
      }

      if (candidates.length === 0) {
        logger.info(
          { studentId, totalBooks: allBooks.length },
          '[BookRecommender] No unread candidates after filtering'
        );
        return [];
      }

      // --- 4. Score each candidate ---
      const recentRead = studentProfile.booksRead.slice(0, 3);
      const learningVocab = studentProfile._learningVocab || [];

      const scored = candidates.map((book) => {
        // a. Theme match
        const themeMatchScore = this._themeMatchScore(book, studentProfile.preferredThemes);

        // b. Difficulty fit
        const difficultyResult = assessDifficultyFit(book, studentProfile);
        const difficultyScore  = difficultyResult.score;

        // c. Novelty
        const noveltyScore = this._noveltyScore(book, recentRead);

        // d. Vocab growth
        const { score: vocabScore, growthWords } = this._vocabGrowthScore(book, learningVocab);

        // Composite
        const compositeScore = clamp01(
          themeMatchScore * 0.30 +
          difficultyScore * 0.30 +
          noveltyScore    * 0.20 +
          vocabScore      * 0.20
        );

        // Category label
        const category = this._labelCategory(
          difficultyResult.fit,
          themeMatchScore,
          noveltyScore
        );

        // Human-readable reasons from similarity factors
        const reasons = [];
        if (difficultyResult.reason) reasons.push(difficultyResult.reason);

        return {
          book: {
            id:          book.id,
            title:       book.title,
            author:      book.author,
            level:       book.level,
            cover_emoji: book.cover_emoji,
            description: book.description,
          },
          score:            compositeScore,
          reasons,
          category,
          themeMatch:       themeMatchScore,
          difficultyFit:    difficultyResult.fit,
          vocabGrowthWords: growthWords,
          // Internal fields used by generateExplanation (not exposed to callers)
          _difficultyResult: difficultyResult,
        };
      });

      // --- 5. Sort and take top N ---
      scored.sort((a, b) => b.score - a.score);
      const topN = scored.slice(0, count);

      // Attach warm explanations and clean internal fields
      return topN.map((rec) => {
        const explanation = generateExplanation(rec, studentProfile);
        // Prepend child-friendly explanation as the first reason entry
        const allReasons = [explanation, ...rec.reasons.filter((r) => r !== rec._difficultyResult?.reason || false)];

        const { _difficultyResult, ...cleanRec } = rec;
        return {
          ...cleanRec,
          reasons: allReasons,
        };
      });
    } catch (err) {
      logger.error({ studentId, err: err.message }, '[BookRecommender] getRecommendations failed');
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // NEXT BOOK SUGGESTION (SINGLE BEST)
  // --------------------------------------------------------------------------

  /**
   * Return the single best book recommendation with a child-friendly
   * explanation string attached at the top level for easy rendering.
   *
   * @param {string} studentId
   * @returns {Promise<object|null>}
   */
  async getNextBookSuggestion(studentId) {
    try {
      const recs = await this.getRecommendations(studentId, { count: 1 });
      if (!recs || recs.length === 0) return null;

      const rec = recs[0];
      return {
        ...rec,
        // Surface the primary explanation at the top level for convenience
        message: rec.reasons[0] || `I think you'd LOVE this book!`,
      };
    } catch (err) {
      logger.error(
        { studentId, err: err.message },
        '[BookRecommender] getNextBookSuggestion failed'
      );
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // SIMILAR BOOKS
  // --------------------------------------------------------------------------

  /**
   * Find books similar to a given book using calculateBookSimilarity().
   * Useful for "If you liked X, try Y" recommendations.
   *
   * @param {string} bookId
   * @param {object} [options={}]
   * @param {number}  [options.count=5]      - Number of similar books to return
   * @param {boolean} [options.sameLevel=true] - Only include books at the same level
   * @returns {Promise<Array<{ book: object, similarity: number, factors: string[] }>>}
   */
  async getSimilarBooks(bookId, options = {}) {
    const { count = 5, sameLevel = true } = options;

    try {
      const allBooks = await this._loadBooks();

      const sourceBook = allBooks.find((b) => b.id === bookId);
      if (!sourceBook) {
        logger.warn({ bookId }, '[BookRecommender] getSimilarBooks: source book not found');
        return [];
      }

      let candidates = allBooks.filter((b) => b.id !== bookId);

      if (sameLevel && sourceBook.level) {
        candidates = candidates.filter((b) => b.level === sourceBook.level);
      }

      const scored = candidates.map((book) => {
        const { similarity, factors } = calculateBookSimilarity(sourceBook, book);
        return {
          book: {
            id:          book.id,
            title:       book.title,
            author:      book.author,
            level:       book.level,
            cover_emoji: book.cover_emoji,
            description: book.description,
          },
          similarity,
          factors,
        };
      });

      scored.sort((a, b) => b.similarity - a.similarity);
      return scored.slice(0, count);
    } catch (err) {
      logger.error(
        { bookId, err: err.message },
        '[BookRecommender] getSimilarBooks failed'
      );
      return [];
    }
  }
}

// ============================================================================
// API ENTRY POINTS (for route integration)
// ============================================================================

/**
 * Get personalised book recommendations for a student.
 * Convenience wrapper that instantiates BookRecommender internally.
 *
 * @param {string} studentId
 * @param {number} [count=5]
 * @returns {Promise<object[]>}
 */
export async function getRecommendationsForStudent(studentId, count = 5) {
  const recommender = new BookRecommender();
  return recommender.getRecommendations(studentId, { count });
}

/**
 * Find books similar to a given book.
 * Convenience wrapper that instantiates BookRecommender internally.
 *
 * @param {string} bookId
 * @param {number} [count=5]
 * @returns {Promise<object[]>}
 */
export async function getSimilarBooksForBook(bookId, count = 5) {
  const recommender = new BookRecommender();
  return recommender.getSimilarBooks(bookId, { count });
}

/**
 * Get the single best next-book suggestion for a student, with a
 * child-friendly message string for direct UI rendering.
 *
 * @param {string} studentId
 * @returns {Promise<object|null>}
 */
export async function getNextSuggestion(studentId) {
  const recommender = new BookRecommender();
  return recommender.getNextBookSuggestion(studentId);
}

export default BookRecommender;
