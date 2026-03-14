/**
 * globalPatterns.js
 * HiAlice — Global Pattern Analytics Service
 *
 * Discovers aggregate patterns across ALL students to surface educational
 * insights for admins: which books work best, which stages cause drop-off,
 * how engagement and vocabulary growth differ by level, and which students
 * may need a level adjustment.
 *
 * Adapted from the ECC "Continuous Learning v1" analytics pattern.
 *
 * Architecture:
 *   - All DB queries run at the TOP of each function (data layer)
 *   - Pure computation runs BELOW the queries (logic layer)
 *   - Every query is wrapped in try/catch — failures return safe defaults
 *   - Results are cached for 1 hour via PatternAnalysisScheduler
 *   - Minimum sample size of 3 is enforced before generating any insight
 *
 * ES Modules — compatible with the rest of the HiAlice backend.
 */

import { supabase } from '../lib/supabase.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum sessions required before a data point is trusted. */
const MIN_SAMPLE_SIZE = 3;

/** Word count threshold that defines a "short answer" in dialogues. */
const SHORT_ANSWER_WORD_THRESHOLD = 5;

/**
 * Effectiveness score bands mapped to recommendation labels.
 * Score = avg_level_score * completion_rate (0–100 range).
 */
const EFFECTIVENESS_BANDS = [
  { threshold: 80, label: 'highly_effective' },
  { threshold: 65, label: 'effective' },
  { threshold: 45, label: 'average' },
  { threshold: 0,  label: 'below_average' },
];

/**
 * Stage difficulty classification derived from drop-off rate and short-answer rate.
 * Both are expressed as decimals (0–1).
 */
const DIFFICULTY_BANDS = [
  { dropOff: 0.4,  shortAnswer: 0.5, label: 'very_hard' },
  { dropOff: 0.25, shortAnswer: 0.4, label: 'hard' },
  { dropOff: 0.1,  shortAnswer: 0.25, label: 'moderate' },
  { dropOff: 0,    shortAnswer: 0,    label: 'easy' },
];

/** Canonical level identifiers used across the HiAlice system. */
const LEVELS = ['beginner', 'intermediate', 'advanced'];

/** Score threshold above which a student is considered ready for level-up. */
const LEVEL_UP_SCORE_THRESHOLD = 80;

/** Score threshold below which a student may need a level adjustment downward. */
const LEVEL_DOWN_SCORE_THRESHOLD = 40;

/** Number of consecutive high/low-score sessions required for level recommendations. */
const LEVEL_CHANGE_SESSION_COUNT = 3;

// ============================================================================
// A. BOOK EFFECTIVENESS PATTERNS
// ============================================================================

/**
 * Analyse how effective each book has been across all student sessions.
 *
 * Queries:
 *   - sessions joined with books (all sessions, both completed and not)
 *   - vocabulary rows grouped by session to compute new-word counts
 *
 * Computation:
 *   - Per book: avg scores, completion rate, avg turns, avg vocab growth
 *   - Weighted effectiveness score: avgLevelScore * completionRate
 *   - Ranked 1 = best; only books with >= MIN_SAMPLE_SIZE sessions included
 *
 * @returns {Promise<Array<{
 *   bookId: string,
 *   title: string,
 *   level: string,
 *   avgLevelScore: number,
 *   avgGrammarScore: number,
 *   completionRate: number,
 *   avgTurns: number,
 *   avgVocabGrowth: number,
 *   sampleSize: number,
 *   effectivenessRank: number,
 *   recommendation: string
 * }>>}
 */
export async function analyzeBookEffectiveness() {
  // ---- Data layer ----------------------------------------------------------

  let sessions = [];
  let vocabRows = [];

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        id,
        book_id,
        student_id,
        level_score,
        grammar_score,
        completed_at,
        started_at,
        books ( id, title, level )
      `)
      .order('started_at', { ascending: false })
      .limit(5000);

    if (error) {
      console.error('[GlobalPatterns] analyzeBookEffectiveness — sessions query failed:', error.message);
    } else {
      sessions = data || [];
    }
  } catch (err) {
    console.error('[GlobalPatterns] analyzeBookEffectiveness — unexpected error:', err.message);
  }

  // Fetch vocabulary rows to compute words-per-session.
  try {
    const { data, error } = await supabase
      .from('vocabulary')
      .select('student_id, word')
      .limit(50000);

    if (error) {
      console.error('[GlobalPatterns] analyzeBookEffectiveness — vocabulary query failed:', error.message);
    } else {
      vocabRows = data || [];
    }
  } catch (err) {
    console.error('[GlobalPatterns] analyzeBookEffectiveness — vocabulary fetch error:', err.message);
  }

  // ---- Computation layer ---------------------------------------------------

  if (sessions.length === 0) return [];

  // Build a lookup: student_id → total unique words (proxy for growth measurement)
  const studentWordCount = {};
  for (const row of vocabRows) {
    if (!studentWordCount[row.student_id]) {
      studentWordCount[row.student_id] = 0;
    }
    studentWordCount[row.student_id] += 1;
  }

  // Aggregate sessions by book.
  const bookMap = {};

  for (const session of sessions) {
    const book = session.books;
    if (!book) continue;

    const bookId = book.id;
    if (!bookMap[bookId]) {
      bookMap[bookId] = {
        bookId,
        title:            book.title,
        level:            book.level,
        totalSessions:    0,
        completedSessions: 0,
        levelScoreSum:    0,
        grammarScoreSum:  0,
        levelScoreCount:  0,
        grammarScoreCount: 0,
        turnSum:          0,
        turnCount:        0,
        vocabGrowthSum:   0,
        vocabGrowthCount: 0,
      };
    }

    const entry = bookMap[bookId];
    entry.totalSessions += 1;

    if (session.completed_at) {
      entry.completedSessions += 1;
    }

    if (typeof session.level_score === 'number') {
      entry.levelScoreSum   += session.level_score;
      entry.levelScoreCount += 1;
    }

    if (typeof session.grammar_score === 'number') {
      entry.grammarScoreSum   += session.grammar_score;
      entry.grammarScoreCount += 1;
    }

    // Estimate turns from dialogue data is expensive; use level_score as proxy
    // for session depth (turns aren't stored directly on sessions).
    // Vocab growth: divide student's total words by their number of sessions.
    const studentWords    = studentWordCount[session.student_id] || 0;
    const studentSessions = sessions.filter(s => s.student_id === session.student_id).length;
    if (studentSessions > 0) {
      entry.vocabGrowthSum   += studentWords / studentSessions;
      entry.vocabGrowthCount += 1;
    }
  }

  // Convert map to scored array, filtering out books with too few sessions.
  const results = [];

  for (const entry of Object.values(bookMap)) {
    if (entry.totalSessions < MIN_SAMPLE_SIZE) continue;

    const avgLevelScore   = entry.levelScoreCount   > 0
      ? Math.round(entry.levelScoreSum   / entry.levelScoreCount)
      : 0;
    const avgGrammarScore = entry.grammarScoreCount > 0
      ? Math.round(entry.grammarScoreSum / entry.grammarScoreCount)
      : 0;
    const completionRate  = entry.totalSessions > 0
      ? parseFloat((entry.completedSessions / entry.totalSessions).toFixed(3))
      : 0;
    const avgVocabGrowth  = entry.vocabGrowthCount > 0
      ? parseFloat((entry.vocabGrowthSum / entry.vocabGrowthCount).toFixed(1))
      : 0;

    // Weighted effectiveness: scores scaled 0-100, completion rate 0-1.
    // Formula: (avgLevelScore * 0.6 + avgGrammarScore * 0.4) * completionRate
    const compositeScore  = (avgLevelScore * 0.6 + avgGrammarScore * 0.4) * completionRate;

    results.push({
      bookId:            entry.bookId,
      title:             entry.title,
      level:             entry.level,
      avgLevelScore,
      avgGrammarScore,
      completionRate,
      avgTurns:          0,             // turns not stored per session — set to 0
      avgVocabGrowth,
      sampleSize:        entry.totalSessions,
      _compositeScore:   compositeScore, // internal sort key, removed before return
      effectivenessRank: 0,              // populated after sorting
      recommendation:    'insufficient_data',
    });
  }

  // Sort by composite score descending, then assign rank and recommendation.
  results.sort((a, b) => b._compositeScore - a._compositeScore);

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    result.effectivenessRank = i + 1;

    // Determine recommendation band.
    const band = EFFECTIVENESS_BANDS.find(b => result._compositeScore >= b.threshold);
    result.recommendation = band ? band.label : 'below_average';

    delete result._compositeScore;
  }

  return results;
}

// ============================================================================
// B. STAGE DIFFICULTY PATTERNS
// ============================================================================

/**
 * Analyse how difficult each stage is, broken down by student level.
 *
 * Queries:
 *   - dialogues (student speaker turns only, for response length and short-answer rate)
 *   - sessions (to compute drop-off rate per stage)
 *
 * Computation:
 *   - Short answer: student response with fewer than SHORT_ANSWER_WORD_THRESHOLD words
 *   - Drop-off: sessions whose `stage` column matches this stage (i.e., session
 *     stopped at this stage without completing). Uses `completed_at IS NULL`.
 *   - Difficulty classification uses DIFFICULTY_BANDS thresholds.
 *
 * @returns {Promise<Array<{
 *   stage: string,
 *   level: string,
 *   avgResponseLength: number,
 *   shortAnswerRate: number,
 *   dropOffRate: number,
 *   difficulty: string,
 *   sampleSize: number
 * }>>}
 */
export async function analyzeStageDifficulty() {
  // ---- Data layer ----------------------------------------------------------

  let dialogues = [];
  let sessions  = [];

  try {
    const { data, error } = await supabase
      .from('dialogues')
      .select('id, session_id, stage, speaker, content')
      .eq('speaker', 'student')
      .order('timestamp', { ascending: false })
      .limit(50000);

    if (error) {
      console.error('[GlobalPatterns] analyzeStageDifficulty — dialogues query failed:', error.message);
    } else {
      dialogues = data || [];
    }
  } catch (err) {
    console.error('[GlobalPatterns] analyzeStageDifficulty — dialogues fetch error:', err.message);
  }

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, stage, level_score, completed_at, students ( level )')
      .order('started_at', { ascending: false })
      .limit(5000);

    if (error) {
      console.error('[GlobalPatterns] analyzeStageDifficulty — sessions query failed:', error.message);
    } else {
      sessions = data || [];
    }
  } catch (err) {
    console.error('[GlobalPatterns] analyzeStageDifficulty — sessions fetch error:', err.message);
  }

  // ---- Computation layer ---------------------------------------------------

  // Build a session-to-level lookup.
  const sessionLevel = {};
  for (const session of sessions) {
    const level = session.students?.level || 'intermediate';
    sessionLevel[session.id] = level;
  }

  // Canonical stage list (from sessionPipeline.js STAGE_ORDER).
  const STAGE_ORDER = [
    'warm_connection',
    'title',
    'introduction',
    'body',
    'conclusion',
    'cross_book',
  ];

  // Initialise accumulators for each (stage, level) combination.
  const accumulator = {};
  for (const stage of STAGE_ORDER) {
    for (const level of LEVELS) {
      const key = `${stage}::${level}`;
      accumulator[key] = {
        stage,
        level,
        responseLengthSum:  0,
        responseCount:      0,
        shortAnswerCount:   0,
      };
    }
  }

  // Process student dialogue turns.
  for (const dialogue of dialogues) {
    if (!dialogue.content || !dialogue.stage) continue;

    const level = sessionLevel[dialogue.session_id] || 'intermediate';
    const key   = `${dialogue.stage}::${level}`;

    if (!accumulator[key]) continue; // Unrecognised stage — skip.

    const wordCount = dialogue.content.trim().split(/\s+/).filter(Boolean).length;
    accumulator[key].responseLengthSum += wordCount;
    accumulator[key].responseCount     += 1;

    if (wordCount < SHORT_ANSWER_WORD_THRESHOLD) {
      accumulator[key].shortAnswerCount += 1;
    }
  }

  // Compute drop-off rates: sessions that ended at each stage without completing.
  // "Dropped at stage X" = session.stage === X AND completed_at IS NULL.
  const totalSessionsByLevel      = { beginner: 0, intermediate: 0, advanced: 0 };
  const dropOffByStageLevel       = {};

  for (const session of sessions) {
    const level = session.students?.level || 'intermediate';
    if (!totalSessionsByLevel[level]) totalSessionsByLevel[level] = 0;
    totalSessionsByLevel[level] += 1;

    if (!session.completed_at && session.stage) {
      const key = `${session.stage}::${level}`;
      if (!dropOffByStageLevel[key]) dropOffByStageLevel[key] = 0;
      dropOffByStageLevel[key] += 1;
    }
  }

  // Build results array.
  const results = [];

  for (const key of Object.keys(accumulator)) {
    const entry         = accumulator[key];
    const { stage, level } = entry;

    const sampleSize         = entry.responseCount;
    const avgResponseLength  = sampleSize > 0
      ? Math.round(entry.responseLengthSum / sampleSize)
      : 0;
    const shortAnswerRate    = sampleSize > 0
      ? parseFloat((entry.shortAnswerCount / sampleSize).toFixed(3))
      : 0;

    const totalForLevel      = totalSessionsByLevel[level] || 0;
    const droppedAtStage     = dropOffByStageLevel[key] || 0;
    const dropOffRate        = totalForLevel > 0
      ? parseFloat((droppedAtStage / totalForLevel).toFixed(3))
      : 0;

    // Classify difficulty using DIFFICULTY_BANDS (most severe match first).
    let difficulty = 'easy';
    for (const band of DIFFICULTY_BANDS) {
      if (dropOffRate >= band.dropOff || shortAnswerRate >= band.shortAnswer) {
        difficulty = band.label;
        break;
      }
    }

    results.push({
      stage,
      level,
      avgResponseLength,
      shortAnswerRate,
      dropOffRate,
      difficulty,
      sampleSize,
    });
  }

  // Sort by stage order, then by level.
  results.sort((a, b) => {
    const stageDiff = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
    if (stageDiff !== 0) return stageDiff;
    return LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level);
  });

  return results;
}

// ============================================================================
// C. ENGAGEMENT PATTERNS
// ============================================================================

/**
 * Aggregate engagement metrics across all students.
 *
 * Queries:
 *   - students (total count, level distribution)
 *   - sessions (duration, recency, timestamps for hour distribution)
 *
 * Computation:
 *   - Sessions per student per week: (total sessions / total students) / weeks spanned
 *   - Session duration: completed_at - started_at, in minutes
 *   - Return rate: students who had a session within 7 days of a prior session
 *   - Peak hours: hour-of-day distribution across all session start times
 *   - Active students: students with at least one session in the past 30 days
 *
 * @returns {Promise<{
 *   avgSessionsPerWeek: number,
 *   avgSessionDuration: number,
 *   returnRate7Day: number,
 *   peakHours: Array<{ hour: number, sessionCount: number }>,
 *   levelDistribution: { beginner: number, intermediate: number, advanced: number },
 *   totalStudents: number,
 *   totalSessions: number,
 *   activeStudents30Day: number
 * }>}
 */
export async function analyzeEngagementPatterns() {
  const defaultResult = {
    avgSessionsPerWeek:  0,
    avgSessionDuration:  0,
    returnRate7Day:      0,
    peakHours:           [],
    levelDistribution:   { beginner: 0, intermediate: 0, advanced: 0 },
    totalStudents:       0,
    totalSessions:       0,
    activeStudents30Day: 0,
  };

  // ---- Data layer ----------------------------------------------------------

  let students = [];
  let sessions = [];

  try {
    const { data, error } = await supabase
      .from('students')
      .select('id, level')
      .limit(10000);

    if (error) {
      console.error('[GlobalPatterns] analyzeEngagementPatterns — students query failed:', error.message);
    } else {
      students = data || [];
    }
  } catch (err) {
    console.error('[GlobalPatterns] analyzeEngagementPatterns — students fetch error:', err.message);
    return defaultResult;
  }

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, student_id, started_at, completed_at')
      .order('started_at', { ascending: false })
      .limit(10000);

    if (error) {
      console.error('[GlobalPatterns] analyzeEngagementPatterns — sessions query failed:', error.message);
    } else {
      sessions = data || [];
    }
  } catch (err) {
    console.error('[GlobalPatterns] analyzeEngagementPatterns — sessions fetch error:', err.message);
    return defaultResult;
  }

  // ---- Computation layer ---------------------------------------------------

  const totalStudents = students.length;
  const totalSessions = sessions.length;

  if (totalStudents === 0 || totalSessions === 0) return defaultResult;

  // Level distribution.
  const levelDistribution = { beginner: 0, intermediate: 0, advanced: 0 };
  for (const student of students) {
    const level = student.level || 'intermediate';
    if (levelDistribution[level] !== undefined) {
      levelDistribution[level] += 1;
    }
  }

  // Average session duration (minutes, completed sessions only).
  const completedSessions = sessions.filter(s => s.completed_at && s.started_at);
  let totalDurationMs = 0;
  for (const session of completedSessions) {
    const start = new Date(session.started_at).getTime();
    const end   = new Date(session.completed_at).getTime();
    if (!isNaN(start) && !isNaN(end) && end > start) {
      totalDurationMs += end - start;
    }
  }
  const avgSessionDuration = completedSessions.length > 0
    ? parseFloat((totalDurationMs / completedSessions.length / 60000).toFixed(1))
    : 0;

  // Time span for weekly rate calculation.
  const validStartTimes = sessions
    .map(s => new Date(s.started_at).getTime())
    .filter(t => !isNaN(t));
  let avgSessionsPerWeek = 0;

  if (validStartTimes.length > 0 && totalStudents > 0) {
    const earliest    = Math.min(...validStartTimes);
    const latest      = Math.max(...validStartTimes);
    const weeksSpanned = Math.max(1, (latest - earliest) / (7 * 24 * 60 * 60 * 1000));
    avgSessionsPerWeek = parseFloat(
      (totalSessions / totalStudents / weeksSpanned).toFixed(2)
    );
  }

  // 7-day return rate: proportion of students who had more than one session
  // within a 7-day window of a prior session.
  const sessionsByStudent = {};
  for (const session of sessions) {
    if (!session.started_at) continue;
    const sid = session.student_id;
    if (!sessionsByStudent[sid]) sessionsByStudent[sid] = [];
    sessionsByStudent[sid].push(new Date(session.started_at).getTime());
  }

  let studentsWithReturn = 0;
  for (const [, times] of Object.entries(sessionsByStudent)) {
    if (times.length < 2) continue;
    const sorted = [...times].sort((a, b) => a - b);
    let returned = false;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] <= 7 * 24 * 60 * 60 * 1000) {
        returned = true;
        break;
      }
    }
    if (returned) studentsWithReturn += 1;
  }

  const studentsWithAnySessions = Object.keys(sessionsByStudent).length;
  const returnRate7Day = studentsWithAnySessions > 0
    ? parseFloat((studentsWithReturn / studentsWithAnySessions * 100).toFixed(1))
    : 0;

  // Peak hours: distribution of session start times by hour of day.
  const hourCounts = new Array(24).fill(0);
  for (const session of sessions) {
    if (!session.started_at) continue;
    const hour = new Date(session.started_at).getHours();
    if (hour >= 0 && hour < 24) {
      hourCounts[hour] += 1;
    }
  }

  const peakHours = hourCounts
    .map((sessionCount, hour) => ({ hour, sessionCount }))
    .filter(h => h.sessionCount > 0)
    .sort((a, b) => b.sessionCount - a.sessionCount);

  // Active students in the last 30 days.
  const cutoff30Day    = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const activeStudentIds = new Set(
    sessions
      .filter(s => s.started_at && new Date(s.started_at).getTime() >= cutoff30Day)
      .map(s => s.student_id)
  );
  const activeStudents30Day = activeStudentIds.size;

  return {
    avgSessionsPerWeek,
    avgSessionDuration,
    returnRate7Day,
    peakHours,
    levelDistribution,
    totalStudents,
    totalSessions,
    activeStudents30Day,
  };
}

// ============================================================================
// D. VOCABULARY GROWTH PATTERNS
// ============================================================================

/**
 * Aggregate vocabulary metrics across all students.
 *
 * Queries:
 *   - vocabulary (all rows, for mastery analysis and word frequency)
 *   - sessions (total count, for words-per-session denominator)
 *   - students (for level-based word bucketing)
 *
 * Computation:
 *   - avgWordsPerSession: total vocabulary rows / total completed sessions
 *   - masteryRate: words with mastery_level >= 4 / total words
 *   - topLearnedWords: top 20 by use_count
 *   - topStruggledWords: mastery_level <= 1, sorted by use_count descending
 *     (many uses + still low mastery = struggling)
 *   - wordsByLevel: bucketed by the student's level
 *
 * @returns {Promise<{
 *   avgWordsPerSession: number,
 *   masteryRate: number,
 *   topLearnedWords: Array<{ word: string, count: number }>,
 *   topStruggledWords: Array<{ word: string, count: number }>,
 *   wordsByLevel: { beginner: number, intermediate: number, advanced: number },
 *   totalUniqueWords: number
 * }>}
 */
export async function analyzeVocabularyGrowth() {
  const defaultResult = {
    avgWordsPerSession:  0,
    masteryRate:         0,
    topLearnedWords:     [],
    topStruggledWords:   [],
    wordsByLevel:        { beginner: 0, intermediate: 0, advanced: 0 },
    totalUniqueWords:    0,
  };

  // ---- Data layer ----------------------------------------------------------

  let vocabRows = [];
  let sessions  = [];
  let students  = [];

  try {
    const { data, error } = await supabase
      .from('vocabulary')
      .select('id, student_id, word, mastery_level, use_count')
      .order('use_count', { ascending: false })
      .limit(50000);

    if (error) {
      console.error('[GlobalPatterns] analyzeVocabularyGrowth — vocabulary query failed:', error.message);
    } else {
      vocabRows = data || [];
    }
  } catch (err) {
    console.error('[GlobalPatterns] analyzeVocabularyGrowth — vocabulary fetch error:', err.message);
    return defaultResult;
  }

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, student_id')
      .not('completed_at', 'is', null)
      .limit(10000);

    if (error) {
      console.error('[GlobalPatterns] analyzeVocabularyGrowth — sessions query failed:', error.message);
    } else {
      sessions = data || [];
    }
  } catch (err) {
    console.error('[GlobalPatterns] analyzeVocabularyGrowth — sessions fetch error:', err.message);
  }

  try {
    const { data, error } = await supabase
      .from('students')
      .select('id, level')
      .limit(10000);

    if (error) {
      console.error('[GlobalPatterns] analyzeVocabularyGrowth — students query failed:', error.message);
    } else {
      students = data || [];
    }
  } catch (err) {
    console.error('[GlobalPatterns] analyzeVocabularyGrowth — students fetch error:', err.message);
  }

  // ---- Computation layer ---------------------------------------------------

  if (vocabRows.length === 0) return defaultResult;

  // Build student → level lookup.
  const studentLevelMap = {};
  for (const student of students) {
    studentLevelMap[student.id] = student.level || 'intermediate';
  }

  // Average words per session.
  const totalCompletedSessions = sessions.length;
  const avgWordsPerSession = totalCompletedSessions > 0
    ? parseFloat((vocabRows.length / totalCompletedSessions).toFixed(1))
    : 0;

  // Mastery rate: percentage of words that have reached mastery_level >= 4.
  const masteredWords = vocabRows.filter(v => (v.mastery_level || 0) >= 4).length;
  const masteryRate   = vocabRows.length > 0
    ? parseFloat((masteredWords / vocabRows.length * 100).toFixed(1))
    : 0;

  // Total unique words across all students.
  const uniqueWordSet = new Set(vocabRows.map(v => (v.word || '').toLowerCase().trim()));
  const totalUniqueWords = uniqueWordSet.size;

  // Top 20 learned words (highest use_count — learned = used frequently).
  const wordUsageMap = {};
  for (const row of vocabRows) {
    const word = (row.word || '').toLowerCase().trim();
    if (!word) continue;
    if (!wordUsageMap[word]) wordUsageMap[word] = 0;
    wordUsageMap[word] += row.use_count || 1;
  }

  const topLearnedWords = Object.entries(wordUsageMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));

  // Top struggled words: mastery_level <= 1, sorted by use_count descending.
  // Many uses + still low mastery = the student keeps trying but can't retain it.
  const struggledWordMap = {};
  for (const row of vocabRows) {
    if ((row.mastery_level || 0) > 1) continue;
    const word = (row.word || '').toLowerCase().trim();
    if (!word) continue;
    if (!struggledWordMap[word]) struggledWordMap[word] = 0;
    struggledWordMap[word] += row.use_count || 1;
  }

  const topStruggledWords = Object.entries(struggledWordMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));

  // Words by level: bucket each vocabulary row by the student's level.
  const wordsByLevel = { beginner: 0, intermediate: 0, advanced: 0 };
  for (const row of vocabRows) {
    const level = studentLevelMap[row.student_id] || 'intermediate';
    if (wordsByLevel[level] !== undefined) {
      wordsByLevel[level] += 1;
    }
  }

  return {
    avgWordsPerSession,
    masteryRate,
    topLearnedWords,
    topStruggledWords,
    wordsByLevel,
    totalUniqueWords,
  };
}

// ============================================================================
// E. LEVEL PROGRESSION PATTERNS
// ============================================================================

/**
 * Track how students progress through levels and surface candidates for
 * level adjustment.
 *
 * Queries:
 *   - sessions joined with students (scores, level data)
 *
 * Computation:
 *   - avgSessionsToLevelUp: estimated from students who have progressed
 *     (students with both beginner and intermediate sessions, etc.)
 *   - levelSuccessRates: average level_score per level across all sessions
 *   - readyForLevelUp: students with avg level_score >= LEVEL_UP_SCORE_THRESHOLD
 *     across their last LEVEL_CHANGE_SESSION_COUNT completed sessions
 *   - needsLevelAdjustment: students with avg level_score <= LEVEL_DOWN_SCORE_THRESHOLD
 *     across their last LEVEL_CHANGE_SESSION_COUNT completed sessions
 *
 * @returns {Promise<{
 *   avgSessionsToLevelUp: number,
 *   levelSuccessRates: { beginner: number, intermediate: number, advanced: number },
 *   readyForLevelUp: Array<{
 *     studentId: string,
 *     name: string,
 *     currentLevel: string,
 *     suggestedLevel: string,
 *     evidence: string
 *   }>,
 *   needsLevelAdjustment: Array<{
 *     studentId: string,
 *     name: string,
 *     currentLevel: string,
 *     suggestedLevel: string,
 *     evidence: string
 *   }>
 * }>}
 */
export async function analyzeLevelProgression() {
  const defaultResult = {
    avgSessionsToLevelUp:  0,
    levelSuccessRates:     { beginner: 0, intermediate: 0, advanced: 0 },
    readyForLevelUp:       [],
    needsLevelAdjustment:  [],
  };

  // ---- Data layer ----------------------------------------------------------

  let sessions = [];
  let students  = [];

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        id,
        student_id,
        level_score,
        completed_at,
        started_at,
        students ( id, name, level )
      `)
      .not('completed_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(10000);

    if (error) {
      console.error('[GlobalPatterns] analyzeLevelProgression — sessions query failed:', error.message);
    } else {
      sessions = data || [];
    }
  } catch (err) {
    console.error('[GlobalPatterns] analyzeLevelProgression — sessions fetch error:', err.message);
    return defaultResult;
  }

  try {
    const { data, error } = await supabase
      .from('students')
      .select('id, name, level')
      .limit(10000);

    if (error) {
      console.error('[GlobalPatterns] analyzeLevelProgression — students query failed:', error.message);
    } else {
      students = data || [];
    }
  } catch (err) {
    console.error('[GlobalPatterns] analyzeLevelProgression — students fetch error:', err.message);
    return defaultResult;
  }

  // ---- Computation layer ---------------------------------------------------

  if (sessions.length === 0) return defaultResult;

  // Level success rates: average level_score per level.
  const levelScoreTotals  = { beginner: 0, intermediate: 0, advanced: 0 };
  const levelSessionCounts = { beginner: 0, intermediate: 0, advanced: 0 };

  for (const session of sessions) {
    const level = session.students?.level || 'intermediate';
    if (typeof session.level_score !== 'number') continue;
    if (levelScoreTotals[level] === undefined) continue;

    levelScoreTotals[level]   += session.level_score;
    levelSessionCounts[level] += 1;
  }

  const levelSuccessRates = {};
  for (const level of LEVELS) {
    levelSuccessRates[level] = levelSessionCounts[level] > 0
      ? Math.round(levelScoreTotals[level] / levelSessionCounts[level])
      : 0;
  }

  // Group sessions by student, newest first (already ordered by started_at desc).
  const sessionsByStudent = {};
  for (const session of sessions) {
    const sid = session.student_id;
    if (!sessionsByStudent[sid]) sessionsByStudent[sid] = [];
    sessionsByStudent[sid].push(session);
  }

  // Build a student lookup for name.
  const studentMap = {};
  for (const student of students) {
    studentMap[student.id] = student;
  }

  // Estimate avgSessionsToLevelUp using session counts for each student
  // before they are considered high-performing (this is a heuristic since
  // explicit level-up events are not stored as a separate table).
  // We use students who have >= LEVEL_CHANGE_SESSION_COUNT sessions as a proxy.
  let levelUpCandidateSessionCounts = [];
  for (const [, studentSessions] of Object.entries(sessionsByStudent)) {
    if (studentSessions.length >= LEVEL_CHANGE_SESSION_COUNT) {
      levelUpCandidateSessionCounts.push(studentSessions.length);
    }
  }
  const avgSessionsToLevelUp = levelUpCandidateSessionCounts.length > 0
    ? Math.round(
        levelUpCandidateSessionCounts.reduce((a, b) => a + b, 0) /
        levelUpCandidateSessionCounts.length
      )
    : 0;

  // Level order for advancement/demotion suggestions.
  const LEVEL_ORDER = ['beginner', 'intermediate', 'advanced'];

  // Identify students ready for level-up or needing level adjustment.
  const readyForLevelUp      = [];
  const needsLevelAdjustment = [];

  for (const [studentId, studentSessions] of Object.entries(sessionsByStudent)) {
    if (studentSessions.length < LEVEL_CHANGE_SESSION_COUNT) continue;

    const recentSessions = studentSessions.slice(0, LEVEL_CHANGE_SESSION_COUNT);
    const validScores    = recentSessions
      .map(s => s.level_score)
      .filter(score => typeof score === 'number');

    if (validScores.length < LEVEL_CHANGE_SESSION_COUNT) continue;

    const avgScore     = validScores.reduce((a, b) => a + b, 0) / validScores.length;
    const studentData  = studentMap[studentId] || studentSessions[0].students;
    const currentLevel = studentData?.level || 'intermediate';
    const studentName  = studentData?.name  || 'Unknown';
    const currentIdx   = LEVEL_ORDER.indexOf(currentLevel);

    if (avgScore >= LEVEL_UP_SCORE_THRESHOLD && currentIdx < LEVEL_ORDER.length - 1) {
      const suggestedLevel = LEVEL_ORDER[currentIdx + 1];
      readyForLevelUp.push({
        studentId,
        name:          studentName,
        currentLevel,
        suggestedLevel,
        evidence: `Averaged ${Math.round(avgScore)} on last ${LEVEL_CHANGE_SESSION_COUNT} sessions (threshold: ${LEVEL_UP_SCORE_THRESHOLD})`,
      });
    } else if (avgScore <= LEVEL_DOWN_SCORE_THRESHOLD && currentIdx > 0) {
      const suggestedLevel = LEVEL_ORDER[currentIdx - 1];
      needsLevelAdjustment.push({
        studentId,
        name:          studentName,
        currentLevel,
        suggestedLevel,
        evidence: `Averaged ${Math.round(avgScore)} on last ${LEVEL_CHANGE_SESSION_COUNT} sessions (threshold: ${LEVEL_DOWN_SCORE_THRESHOLD})`,
      });
    }
  }

  return {
    avgSessionsToLevelUp,
    levelSuccessRates,
    readyForLevelUp,
    needsLevelAdjustment,
  };
}

// ============================================================================
// AUTO-GENERATED INSIGHTS
// ============================================================================

/**
 * Generate a ranked list of human-readable insights from the full dashboard data.
 *
 * Logic:
 *   - Scans each analytics section for extremes, trends, and actionable items
 *   - Only generates insights where sampleSize >= MIN_SAMPLE_SIZE
 *   - Returns 5–10 insights sorted from most to least important
 *   - Importance is determined by magnitude of the pattern (higher deviation = higher priority)
 *
 * @param {object} dashboardData - Output of generateDashboardData()
 * @returns {string[]} Array of human-readable insight strings
 */
export function generateInsights(dashboardData) {
  const insights = [];

  const {
    bookEffectiveness = [],
    stageDifficulty   = [],
    engagement        = {},
    vocabularyGrowth  = {},
    levelProgression  = {},
  } = dashboardData || {};

  // ---- Book effectiveness insights ----------------------------------------

  if (bookEffectiveness.length > 0) {
    const topBook = bookEffectiveness[0];
    if (topBook && topBook.sampleSize >= MIN_SAMPLE_SIZE) {
      const completionPct = Math.round(topBook.completionRate * 100);
      insights.push({
        priority: 90,
        text: `"${topBook.title}" is the most effective book with a ${completionPct}% completion rate and an average score of ${topBook.avgLevelScore} — consider featuring it more prominently.`,
      });
    }

    const lastBook = bookEffectiveness[bookEffectiveness.length - 1];
    if (lastBook && lastBook !== topBook && lastBook.sampleSize >= MIN_SAMPLE_SIZE) {
      insights.push({
        priority: 60,
        text: `"${lastBook.title}" has the lowest effectiveness rating (${lastBook.recommendation}) — review its Q&A prompts or consider adjusting its level classification.`,
      });
    }

    // Highlight any book with a completion rate above 90%.
    const highCompletionBooks = bookEffectiveness.filter(
      b => b.completionRate >= 0.9 && b.sampleSize >= MIN_SAMPLE_SIZE
    );
    if (highCompletionBooks.length > 0) {
      const names = highCompletionBooks.map(b => `"${b.title}"`).join(', ');
      insights.push({
        priority: 75,
        text: `${highCompletionBooks.length} book(s) have a 90%+ completion rate: ${names}.`,
      });
    }
  }

  // ---- Stage difficulty insights ------------------------------------------

  if (stageDifficulty.length > 0) {
    // Find stages with very_hard difficulty.
    const veryHardStages = stageDifficulty.filter(s => s.difficulty === 'very_hard' && s.sampleSize >= MIN_SAMPLE_SIZE);
    for (const stage of veryHardStages) {
      const dropPct = Math.round(stage.dropOffRate * 100);
      insights.push({
        priority: 85,
        text: `The "${stage.stage}" stage is rated very hard for ${stage.level} students — ${dropPct}% drop-off rate. Consider shortening or restructuring its prompts.`,
      });
    }

    // Highest drop-off single entry.
    const sorted = [...stageDifficulty]
      .filter(s => s.sampleSize >= MIN_SAMPLE_SIZE)
      .sort((a, b) => b.dropOffRate - a.dropOffRate);

    if (sorted.length > 0 && sorted[0].dropOffRate >= 0.2 && !veryHardStages.includes(sorted[0])) {
      const s    = sorted[0];
      const pct  = Math.round(s.dropOffRate * 100);
      insights.push({
        priority: 70,
        text: `"${s.stage}" has a ${pct}% drop-off rate for ${s.level} students — review the question complexity at this stage.`,
      });
    }
  }

  // ---- Engagement insights -------------------------------------------------

  if (engagement.totalStudents >= MIN_SAMPLE_SIZE) {
    if (engagement.returnRate7Day > 0) {
      insights.push({
        priority: 65,
        text: `${engagement.returnRate7Day}% of students return within 7 days — a healthy retention signal for an educational app.`,
      });
    }

    if (engagement.activeStudents30Day > 0 && engagement.totalStudents > 0) {
      const activePct = Math.round(engagement.activeStudents30Day / engagement.totalStudents * 100);
      insights.push({
        priority: 55,
        text: `${activePct}% of students (${engagement.activeStudents30Day} of ${engagement.totalStudents}) were active in the last 30 days.`,
      });
    }

    // Peak hour insight.
    if (engagement.peakHours && engagement.peakHours.length > 0) {
      const peak = engagement.peakHours[0];
      const hour12 = peak.hour === 0 ? 12 : peak.hour > 12 ? peak.hour - 12 : peak.hour;
      const amPm   = peak.hour >= 12 ? 'PM' : 'AM';
      insights.push({
        priority: 45,
        text: `Peak usage is at ${hour12}:00 ${amPm} (${peak.sessionCount} sessions) — consider scheduling push notifications around this time.`,
      });
    }

    if (engagement.avgSessionDuration > 0) {
      insights.push({
        priority: 40,
        text: `Average session duration is ${engagement.avgSessionDuration} minutes — ${engagement.avgSessionDuration >= 15 ? 'students are spending meaningful time with Alice' : 'consider strategies to extend session depth'}.`,
      });
    }
  }

  // ---- Vocabulary growth insights ------------------------------------------

  if (vocabularyGrowth.totalUniqueWords >= MIN_SAMPLE_SIZE) {
    if (vocabularyGrowth.avgWordsPerSession > 0) {
      const { wordsByLevel } = vocabularyGrowth;
      if (wordsByLevel) {
        const advancedWords    = wordsByLevel.advanced    || 0;
        const beginnerWords    = wordsByLevel.beginner    || 0;
        const beginnerSessions = (engagement.levelDistribution?.beginner || 1);
        const advancedSessions = (engagement.levelDistribution?.advanced || 1);
        const beginnerRate     = beginnerSessions > 0 ? Math.round(beginnerWords / beginnerSessions) : 0;
        const advancedRate     = advancedSessions > 0 ? Math.round(advancedWords / advancedSessions) : 0;

        if (advancedRate > 0 && beginnerRate > 0 && advancedRate > beginnerRate) {
          const multiplier = (advancedRate / beginnerRate).toFixed(1);
          insights.push({
            priority: 58,
            text: `Advanced students encounter ~${advancedRate} words per student vs ${beginnerRate} for beginners (${multiplier}x more) — vocabulary exposure scales well with level.`,
          });
        }
      }
    }

    if (vocabularyGrowth.masteryRate > 0) {
      insights.push({
        priority: 50,
        text: `${vocabularyGrowth.masteryRate}% of tracked words have reached full mastery — ${vocabularyGrowth.masteryRate >= 50 ? 'strong retention across the platform' : 'there is room to improve retention with more spaced repetition'}.`,
      });
    }

    if (vocabularyGrowth.topLearnedWords && vocabularyGrowth.topLearnedWords.length > 0) {
      const topWord = vocabularyGrowth.topLearnedWords[0];
      insights.push({
        priority: 35,
        text: `"${topWord.word}" is the most frequently used word across all students (${topWord.count} uses) — a sign it appears in high-traffic books or stages.`,
      });
    }

    if (vocabularyGrowth.topStruggledWords && vocabularyGrowth.topStruggledWords.length > 0) {
      const topStruggle = vocabularyGrowth.topStruggledWords[0];
      insights.push({
        priority: 62,
        text: `"${topStruggle.word}" is the most commonly struggled word (used ${topStruggle.count} times but still at low mastery) — consider adding extra reinforcement prompts for this word.`,
      });
    }
  }

  // ---- Level progression insights ------------------------------------------

  if (levelProgression.readyForLevelUp && levelProgression.readyForLevelUp.length > 0) {
    const count = levelProgression.readyForLevelUp.length;
    insights.push({
      priority: 88,
      text: `${count} student${count === 1 ? '' : 's'} ${count === 1 ? 'appears' : 'appear'} ready for level advancement based on the last ${LEVEL_CHANGE_SESSION_COUNT} sessions — review and advance if appropriate.`,
    });
  }

  if (levelProgression.needsLevelAdjustment && levelProgression.needsLevelAdjustment.length > 0) {
    const count = levelProgression.needsLevelAdjustment.length;
    insights.push({
      priority: 82,
      text: `${count} student${count === 1 ? '' : 's'} ${count === 1 ? 'is' : 'are'} consistently scoring below ${LEVEL_DOWN_SCORE_THRESHOLD} — a level adjustment down may improve their experience and confidence.`,
    });
  }

  if (levelProgression.levelSuccessRates) {
    const rates = levelProgression.levelSuccessRates;
    const highestLevel = LEVELS.reduce(
      (best, level) => (rates[level] > rates[best] ? level : best),
      LEVELS[0]
    );
    if (rates[highestLevel] > 0 && levelSessionCounts(engagement)[highestLevel] >= MIN_SAMPLE_SIZE) {
      insights.push({
        priority: 42,
        text: `${highestLevel.charAt(0).toUpperCase() + highestLevel.slice(1)} students have the highest average level score (${rates[highestLevel]}) — Alice's prompts appear well-calibrated for this group.`,
      });
    }
  }

  // Sort by priority descending, then slice to 5–10 insights.
  insights.sort((a, b) => b.priority - a.priority);
  return insights.slice(0, 10).map(i => i.text);
}

/**
 * Helper used inside generateInsights to safely pull level distribution counts.
 * Avoids a circular reference to the engagement object without re-fetching data.
 *
 * @param {object} engagement - engagement section of dashboard data
 * @returns {object} Level counts suitable for session count comparisons
 * @private
 */
function levelSessionCounts(engagement) {
  return engagement?.levelDistribution || { beginner: 0, intermediate: 0, advanced: 0 };
}

// ============================================================================
// DASHBOARD DATA GENERATOR
// ============================================================================

/**
 * Combine all five analytics modules into a single dashboard-ready object.
 *
 * Runs all analyses in parallel via Promise.allSettled so that a failure in
 * one module does not block the others. Each failed module falls back to its
 * own default value.
 *
 * @returns {Promise<{
 *   generatedAt: string,
 *   bookEffectiveness: object[],
 *   stageDifficulty: object[],
 *   engagement: object,
 *   vocabularyGrowth: object,
 *   levelProgression: object,
 *   insights: string[]
 * }>}
 */
export async function generateDashboardData() {
  console.log('[GlobalPatterns] generateDashboardData — starting full analysis run');

  const [
    bookResult,
    stageResult,
    engagementResult,
    vocabResult,
    levelResult,
  ] = await Promise.allSettled([
    analyzeBookEffectiveness(),
    analyzeStageDifficulty(),
    analyzeEngagementPatterns(),
    analyzeVocabularyGrowth(),
    analyzeLevelProgression(),
  ]);

  const bookEffectiveness = bookResult.status  === 'fulfilled' ? bookResult.value  : [];
  const stageDifficulty   = stageResult.status === 'fulfilled' ? stageResult.value : [];
  const engagement        = engagementResult.status === 'fulfilled'
    ? engagementResult.value
    : { avgSessionsPerWeek: 0, avgSessionDuration: 0, returnRate7Day: 0, peakHours: [], levelDistribution: { beginner: 0, intermediate: 0, advanced: 0 }, totalStudents: 0, totalSessions: 0, activeStudents30Day: 0 };
  const vocabularyGrowth  = vocabResult.status  === 'fulfilled'
    ? vocabResult.value
    : { avgWordsPerSession: 0, masteryRate: 0, topLearnedWords: [], topStruggledWords: [], wordsByLevel: { beginner: 0, intermediate: 0, advanced: 0 }, totalUniqueWords: 0 };
  const levelProgression  = levelResult.status  === 'fulfilled'
    ? levelResult.value
    : { avgSessionsToLevelUp: 0, levelSuccessRates: { beginner: 0, intermediate: 0, advanced: 0 }, readyForLevelUp: [], needsLevelAdjustment: [] };

  // Log any module failures so they surface in server logs.
  if (bookResult.status  === 'rejected') console.error('[GlobalPatterns] bookEffectiveness failed:', bookResult.reason?.message);
  if (stageResult.status === 'rejected') console.error('[GlobalPatterns] stageDifficulty failed:',   stageResult.reason?.message);
  if (engagementResult.status === 'rejected') console.error('[GlobalPatterns] engagement failed:',   engagementResult.reason?.message);
  if (vocabResult.status  === 'rejected') console.error('[GlobalPatterns] vocabularyGrowth failed:', vocabResult.reason?.message);
  if (levelResult.status  === 'rejected') console.error('[GlobalPatterns] levelProgression failed:', levelResult.reason?.message);

  const dashboardData = {
    generatedAt: new Date().toISOString(),
    bookEffectiveness,
    stageDifficulty,
    engagement,
    vocabularyGrowth,
    levelProgression,
    insights: [],
  };

  // Generate insights from the assembled data.
  try {
    dashboardData.insights = generateInsights(dashboardData);
  } catch (err) {
    console.error('[GlobalPatterns] generateInsights failed (non-fatal):', err.message);
    dashboardData.insights = [];
  }

  console.log(
    `[GlobalPatterns] generateDashboardData — complete. ` +
    `Books: ${bookEffectiveness.length}, Insights: ${dashboardData.insights.length}`
  );

  return dashboardData;
}

// ============================================================================
// PERIODIC ANALYSIS SCHEDULER (WITH IN-MEMORY CACHE)
// ============================================================================

/**
 * Scheduler that wraps generateDashboardData() with a 1-hour in-memory cache.
 *
 * Analytics data does not need real-time accuracy. The 1-hour TTL keeps the
 * admin dashboard fast while ensuring reasonably fresh data.
 *
 * Usage:
 *   import { patternScheduler } from './globalPatterns.js';
 *   const data = await patternScheduler.getResults();          // uses cache
 *   const fresh = await patternScheduler.getResults(true);     // force refresh
 */
export class PatternAnalysisScheduler {
  constructor() {
    /** @type {Date|null} Timestamp of the last successful analysis run. */
    this.lastRun = null;

    /** @type {object|null} Cached dashboard data from the last run. */
    this.cachedResults = null;

    /**
     * Maximum age of cached results before a refresh is triggered, in ms.
     * Default: 1 hour.
     */
    this.cacheMaxAge = 3600000;
  }

  /**
   * Return cached results if they are still fresh; otherwise run a full analysis.
   *
   * @param {boolean} [forceRefresh=false] - When true, bypass the cache entirely.
   * @returns {Promise<object>} Dashboard data object from generateDashboardData()
   */
  async getResults(forceRefresh = false) {
    if (!forceRefresh && this.cachedResults && this.lastRun) {
      const ageMs = Date.now() - this.lastRun.getTime();
      if (ageMs < this.cacheMaxAge) {
        console.log(
          `[PatternScheduler] Returning cached results (age: ${Math.round(ageMs / 1000)}s / ` +
          `max: ${this.cacheMaxAge / 1000}s)`
        );
        return this.cachedResults;
      }
    }

    console.log('[PatternScheduler] Cache miss or force refresh — running full analysis');
    this.cachedResults = await generateDashboardData();
    this.lastRun       = new Date();
    return this.cachedResults;
  }

  /**
   * Return the ISO timestamp of the last successful cache population,
   * or null if no run has completed yet.
   *
   * @returns {string|null}
   */
  getLastRunAt() {
    return this.lastRun ? this.lastRun.toISOString() : null;
  }

  /**
   * Return the age of the current cache in milliseconds,
   * or Infinity if the cache is empty.
   *
   * @returns {number}
   */
  getCacheAgeMs() {
    if (!this.lastRun) return Infinity;
    return Date.now() - this.lastRun.getTime();
  }

  /**
   * Invalidate the cache without triggering a new analysis run.
   * The next call to getResults() will perform a fresh fetch.
   */
  invalidate() {
    this.cachedResults = null;
    this.lastRun       = null;
    console.log('[PatternScheduler] Cache invalidated');
  }
}

/**
 * Module-level singleton scheduler.
 * Import and use this instance from route handlers and other services.
 *
 * @type {PatternAnalysisScheduler}
 */
export const patternScheduler = new PatternAnalysisScheduler();

// ============================================================================
// API-READY EXPORTS (ROUTE INTEGRATION HELPERS)
// ============================================================================

/**
 * Fetch the current admin dashboard data, using the cache when available.
 * Intended to be called directly from admin route handlers.
 *
 * @returns {Promise<object>} Dashboard data (potentially from cache)
 */
export async function getAdminDashboardData() {
  return patternScheduler.getResults();
}

/**
 * Force a full re-analysis and return fresh dashboard data.
 * Intended for manual admin refresh actions or scheduled background jobs.
 *
 * @returns {Promise<object>} Freshly computed dashboard data
 */
export async function refreshAnalytics() {
  return patternScheduler.getResults(true);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  analyzeBookEffectiveness,
  analyzeStageDifficulty,
  analyzeEngagementPatterns,
  analyzeVocabularyGrowth,
  analyzeLevelProgression,
  generateDashboardData,
  generateInsights,
  PatternAnalysisScheduler,
  patternScheduler,
  getAdminDashboardData,
  refreshAnalytics,
};
