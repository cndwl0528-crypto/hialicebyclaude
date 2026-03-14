/**
 * contextRetriever.js
 * HiAlice — Iterative Student Context Retrieval Engine
 *
 * Adapted from the ECC "Iterative Retrieval" pattern. Rather than retrieving
 * code files, this engine retrieves STUDENT CONTEXT — past sessions, vocabulary
 * mastery, engagement history, depth patterns, and cross-book connections —
 * and formats it into a compact, structured string for injection into the
 * HiAlice system prompt.
 *
 * Architecture overview:
 *   - Five individual async retrievers, one per context type.
 *   - ContextRetriever class wraps them with a per-request in-memory cache and
 *     up to N iterative refinement cycles (fill gaps found in cycle 1).
 *   - formatContext() composes retrieved data into a delimited prompt block.
 *   - getQuickContext() — single-pass, lightweight, for fast paths.
 *   - getFullContext()  — full iterative retrieval for main session turns.
 *
 * Integration points (NOT yet wired):
 *   // TODO: integrate with engine.js — append formatContext() output to systemPrompt
 *
 * Token estimation convention throughout this file:
 *   4 characters ≈ 1 token  (same heuristic used in modelRouter.js)
 *
 * All Supabase queries are wrapped in try/catch and fall back to empty results
 * so a DB failure never crashes the response pipeline.
 *
 * ES Modules — compatible with the rest of the HiAlice backend.
 */

import { supabase } from '../lib/supabase.js';
import { getCrossBookContext } from '../alice/crossBookMemory.js';
import { classifyAnswerDepth } from '../alice/levelDetector.js';
import logger from '../lib/logger.js';

// ============================================================================
// CONTEXT TYPE CONSTANTS
// ============================================================================

/**
 * Canonical identifiers for each retrievable context dimension.
 * Pass one or more of these into ContextRetriever.retrieve() to control
 * which data sources are queried.
 */
export const CONTEXT_TYPES = {
  PAST_SESSIONS:      'past_sessions',      // Previous sessions with same/similar books
  VOCABULARY:         'vocabulary',          // Words the student knows, is learning, or struggles with
  DEPTH_HISTORY:      'depth_history',       // Historical response depth scores per stage
  BOOK_CONNECTIONS:   'book_connections',    // Cross-book thematic connections via crossBookMemory
  ENGAGEMENT_PROFILE: 'engagement',         // How the student typically engages (length, completion)
  MISTAKES:           'mistakes',            // Common grammar errors and misunderstandings
};

// ============================================================================
// TOKEN UTILITY
// ============================================================================

/**
 * Estimate the token count of a string using the 4-chars-per-token heuristic.
 *
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / 4);
}

// ============================================================================
// A. PAST SESSIONS RETRIEVER
// ============================================================================

/**
 * Retrieve and score the student's past sessions by relevance to the current book.
 *
 * Relevance scoring:
 *   Same book   → 1.0   (student is revisiting, high continuity value)
 *   Same author → 0.8   (likely same style/themes)
 *   Same level  → 0.6   (comparable difficulty, transferable patterns)
 *   Other book  → 0.3   (low prior-art signal, still useful for baseline)
 *
 * Phase 1 (Dispatch): fetch recent completed sessions with joined book data.
 * Phase 2 (Evaluate): score each session by the rules above.
 * Phase 3 (Refine):   if the top-scored sessions are all "other" (< 0.6),
 *                     attempt a second query to find sessions for the same author.
 *
 * @param {string} studentId
 * @param {string} currentBookId
 * @param {object} [query={}]
 * @param {number} [query.limit=5]         Maximum sessions to return
 * @param {boolean} [query.refine=false]   Whether to run the refinement pass
 * @returns {Promise<{
 *   sessions: Array<{ sessionId: string, bookTitle: string, author: string, relevance: number, summary: string }>,
 *   formattedContext: string
 * }>}
 */
async function retrievePastSessions(studentId, currentBookId, query = {}) {
  const { limit = 5, refine = false } = query;
  const EMPTY = { sessions: [], formattedContext: '' };

  try {
    // ---- Phase 1: Dispatch ------------------------------------------------
    const { data: currentBook, error: bookError } = await supabase
      .from('books')
      .select('id, author, level')
      .eq('id', currentBookId)
      .single();

    if (bookError) {
      logger.warn({ studentId, currentBookId, err: bookError.message },
        '[ContextRetriever/pastSessions] Failed to fetch current book metadata');
    }

    const { data: rawSessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, book_id, level_score, grammar_score, completed_at, books(id, title, author, level)')
      .eq('student_id', studentId)
      .eq('is_complete', true)
      .order('completed_at', { ascending: false })
      .limit(limit);

    if (sessionsError || !rawSessions || rawSessions.length === 0) {
      return EMPTY;
    }

    // ---- Phase 2: Evaluate ------------------------------------------------
    const scored = rawSessions.map((session) => {
      const book = session.books || {};
      let relevance = 0.3; // baseline

      if (session.book_id === currentBookId) {
        relevance = 1.0;
      } else if (currentBook && book.author && book.author === currentBook.author) {
        relevance = 0.8;
      } else if (currentBook && book.level && book.level === currentBook.level) {
        relevance = 0.6;
      }

      const avgScore = Math.round(
        ((session.level_score ?? 0) + (session.grammar_score ?? 0)) / 2
      );

      return {
        sessionId:  session.id,
        bookTitle:  book.title   || 'Unknown',
        author:     book.author  || '',
        relevance,
        summary:    `"${book.title || 'Unknown'}" — scored ${avgScore}%`,
      };
    });

    scored.sort((a, b) => b.relevance - a.relevance);

    // ---- Phase 3: Refine --------------------------------------------------
    // If all top results have low relevance and refinement is requested,
    // try to surface sessions with the same author we might have missed.
    let finalSessions = scored;

    if (refine && currentBook?.author) {
      const topRelevance = scored[0]?.relevance ?? 0;
      if (topRelevance < 0.6) {
        try {
          const { data: authorSessions } = await supabase
            .from('sessions')
            .select('id, book_id, level_score, grammar_score, completed_at, books(id, title, author, level)')
            .eq('student_id', studentId)
            .eq('is_complete', true)
            .eq('books.author', currentBook.author)
            .neq('book_id', currentBookId)
            .order('completed_at', { ascending: false })
            .limit(3);

          if (authorSessions && authorSessions.length > 0) {
            const refinedIds  = new Set(finalSessions.map((s) => s.sessionId));
            const newSessions = authorSessions
              .filter((s) => !refinedIds.has(s.id))
              .map((s) => ({
                sessionId:  s.id,
                bookTitle:  s.books?.title  || 'Unknown',
                author:     s.books?.author || '',
                relevance:  0.8,
                summary:    `"${s.books?.title || 'Unknown'}" — same author`,
              }));

            finalSessions = [...newSessions, ...finalSessions]
              .sort((a, b) => b.relevance - a.relevance)
              .slice(0, limit);
          }
        } catch (refineErr) {
          logger.warn({ err: refineErr.message },
            '[ContextRetriever/pastSessions] Refinement pass failed (non-fatal)');
        }
      }
    }

    // ---- Format -----------------------------------------------------------
    if (finalSessions.length === 0) return EMPTY;

    const lines = finalSessions
      .map((s) => `  • ${s.summary} (relevance: ${Math.round(s.relevance * 100)}%)`)
      .join('\n');

    const formattedContext = `Previously discussed:\n${lines}`;

    return { sessions: finalSessions, formattedContext };
  } catch (err) {
    logger.error({ studentId, err: err.message },
      '[ContextRetriever/pastSessions] Unexpected error — returning empty');
    return EMPTY;
  }
}

// ============================================================================
// B. VOCABULARY RETRIEVER
// ============================================================================

/**
 * Fetch and categorise the student's vocabulary profile from the DB.
 *
 * Mastery tiers (aligned with the Vocabulary table schema):
 *   mastered:   mastery_level >= 4 AND use_count >= 3
 *   learning:   mastery_level 2–3  (still consolidating)
 *   struggling: mastery_level <= 1 (seen but not retained)
 *
 * Returns a formatted context string that Alice can use to:
 *   - Avoid words the student already knows (don't condescend)
 *   - Reinforce struggling words by embedding them in questions
 *   - Celebrate when the student uses recently mastered words
 *
 * @param {string} studentId
 * @param {object} [query={}]
 * @param {number} [query.limit=60] Maximum vocabulary rows to pull
 * @returns {Promise<{
 *   mastered: string[], learning: string[], struggling: string[],
 *   formattedContext: string
 * }>}
 */
async function retrieveVocabulary(studentId, query = {}) {
  const { limit = 60 } = query;
  const EMPTY = { mastered: [], learning: [], struggling: [], formattedContext: '' };

  try {
    const { data: vocab, error } = await supabase
      .from('vocabulary')
      .select('word, mastery_level, use_count, first_used')
      .eq('student_id', studentId)
      .order('mastery_level', { ascending: false })
      .limit(limit);

    if (error || !vocab || vocab.length === 0) return EMPTY;

    const mastered   = [];
    const learning   = [];
    const struggling = [];

    for (const entry of vocab) {
      const level    = entry.mastery_level ?? 0;
      const useCount = entry.use_count     ?? 0;
      const word     = entry.word;

      if (level >= 4 && useCount >= 3) {
        mastered.push(word);
      } else if (level >= 2 && level <= 3) {
        learning.push(word);
      } else {
        struggling.push(word);
      }
    }

    // Compose context lines — keep struggling words prominent for Alice.
    const parts = [];

    parts.push(
      `Vocabulary: ${mastered.length} mastered, ${learning.length} learning, ${struggling.length} struggling.`
    );

    if (struggling.length > 0) {
      // Surface at most 8 struggling words to stay concise.
      const sample = struggling.slice(0, 8).join(', ');
      parts.push(`Struggling words: [${sample}] — use in questions to reinforce.`);
    }

    if (learning.length > 0) {
      const sample = learning.slice(0, 6).join(', ');
      parts.push(`Currently learning: [${sample}].`);
    }

    if (mastered.length > 0) {
      // Show the 5 most-recently mastered as celebration targets.
      const recentMastered = mastered.slice(0, 5).join(', ');
      parts.push(`Recently mastered: [${recentMastered}] — celebrate if used.`);
    }

    return {
      mastered,
      learning,
      struggling,
      formattedContext: parts.join('\n'),
    };
  } catch (err) {
    logger.error({ studentId, err: err.message },
      '[ContextRetriever/vocabulary] Unexpected error — returning empty');
    return EMPTY;
  }
}

// ============================================================================
// C. DEPTH HISTORY RETRIEVER
// ============================================================================

/**
 * Analyse the student's historical response depth across past sessions.
 *
 * Steps:
 *   1. Fetch the student's recent dialogue rows (speaker = 'student').
 *   2. Run classifyAnswerDepth() on each student turn.
 *   3. Aggregate by stage and compute per-stage averages and an overall trend.
 *
 * Depth labels (from levelDetector.js classifyAnswerDepth):
 *   'surface' → score 0–29
 *   'basic'   → score 30–49
 *   'developing' → score 50–69
 *   'analytical' → score 70–89
 *   'deep'    → score 90–100
 *
 * @param {string} studentId
 * @returns {Promise<{
 *   overall: string,
 *   byStage: Record<string, { avg: number, label: string }>,
 *   trend: string,
 *   formattedContext: string
 * }>}
 */
async function retrieveDepthHistory(studentId) {
  const EMPTY = { overall: 'unknown', byStage: {}, trend: 'unknown', formattedContext: '' };

  try {
    // Fetch the last 60 student dialogue turns across recent sessions.
    const { data: dialogues, error } = await supabase
      .from('dialogues')
      .select('id, session_id, stage, turn, content, sessions!inner(student_id)')
      .eq('sessions.student_id', studentId)
      .eq('speaker', 'student')
      .not('content', 'is', null)
      .order('id', { ascending: false })
      .limit(60);

    if (error || !dialogues || dialogues.length === 0) return EMPTY;

    // Group scores by stage.
    const stageScores = {};
    const allScores   = [];

    for (const dialogue of dialogues) {
      const result = classifyAnswerDepth(dialogue.content || '');
      const score  = result.score ?? 0;
      const stage  = dialogue.stage || 'unknown';

      allScores.push(score);

      if (!stageScores[stage]) stageScores[stage] = [];
      stageScores[stage].push(score);
    }

    // Per-stage averages.
    const byStage = {};
    for (const [stage, scores] of Object.entries(stageScores)) {
      const avg   = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      const label = depthLabel(avg);
      byStage[stage] = { avg, label };
    }

    // Overall average.
    const overallAvg = allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : 0;
    const overall = depthLabel(overallAvg);

    // Trend: compare oldest third vs newest third.
    const trend = computeTrend(allScores);

    // Find strongest and weakest stages.
    const stagePairs = Object.entries(byStage).sort((a, b) => b[1].avg - a[1].avg);
    const bestStage   = stagePairs[0]?.[0]   || null;
    const weakStage   = stagePairs.at(-1)?.[0] || null;

    // Build formatted context.
    const parts = [
      `Depth pattern: ${overall} (avg score ${overallAvg}/100). Trend: ${trend}.`,
    ];
    if (bestStage)  parts.push(`Strongest stage: ${bestStage}.`);
    if (weakStage && weakStage !== bestStage) {
      parts.push(`Weakest stage: ${weakStage} — probe deeper here.`);
    }

    return {
      overall,
      byStage,
      trend,
      formattedContext: parts.join(' '),
    };
  } catch (err) {
    logger.error({ studentId, err: err.message },
      '[ContextRetriever/depthHistory] Unexpected error — returning empty');
    return EMPTY;
  }
}

/**
 * Map a numeric depth score to a human-readable label.
 * Mirrors the tier boundaries used by classifyAnswerDepth().
 *
 * @param {number} score 0-100
 * @returns {string}
 * @private
 */
function depthLabel(score) {
  if (score >= 90) return 'deep';
  if (score >= 70) return 'analytical';
  if (score >= 50) return 'developing';
  if (score >= 30) return 'basic';
  return 'surface';
}

/**
 * Compare the oldest third of scores to the newest third to produce a
 * human-readable trend string.
 *
 * @param {number[]} scores Ordered oldest→newest
 * @returns {'improving' | 'declining' | 'steady'}
 * @private
 */
function computeTrend(scores) {
  if (scores.length < 4) return 'steady';

  const third  = Math.floor(scores.length / 3);
  const oldest = scores.slice(0, third);
  const newest = scores.slice(-third);

  const avgOldest = oldest.reduce((a, b) => a + b, 0) / oldest.length;
  const avgNewest = newest.reduce((a, b) => a + b, 0) / newest.length;
  const delta     = avgNewest - avgOldest;

  if (delta > 8)  return 'improving';
  if (delta < -8) return 'declining';
  return 'steady';
}

// ============================================================================
// D. BOOK CONNECTIONS RETRIEVER
// ============================================================================

/**
 * Retrieve cross-book thematic connections using the existing crossBookMemory
 * module, then supplement with books-table metadata for theme overlap.
 *
 * Delegates to getCrossBookContext() for the heavy lifting and reformats
 * the result to match the context block conventions used in this module.
 *
 * @param {string} studentId
 * @param {string} currentBookId
 * @returns {Promise<{ formattedContext: string, connections: object[] }>}
 */
async function retrieveBookConnections(studentId, currentBookId) {
  const EMPTY = { formattedContext: '', connections: [] };

  try {
    // getCrossBookContext already handles error fallback internally.
    const { previousBooks, sharedVocabulary, crossBookContext } =
      await getCrossBookContext(studentId, currentBookId);

    if (!previousBooks || previousBooks.length === 0) return EMPTY;

    // crossBookContext already contains a well-formatted block with headers.
    // We strip the outer decorative border and use our own in formatContext().
    const stripped = crossBookContext
      .replace(/^═+.*?═+\n?/gm, '')     // Remove the decorative lines
      .replace(/^CROSS-BOOK MEMORY.*\n/, '') // Remove the section header
      .replace(/^IMPORTANT:.*\n?/gm, '') // Remove the enforcement note
      .trim();

    const connectionSummary = previousBooks.map((b) => ({
      title:    b.title,
      author:   b.author,
      themes:   b.themes || [],
      lesson:   b.moralLesson || '',
    }));

    return {
      formattedContext: stripped || 'No thematic cross-book connections found yet.',
      connections: connectionSummary,
    };
  } catch (err) {
    logger.error({ studentId, currentBookId, err: err.message },
      '[ContextRetriever/bookConnections] Unexpected error — returning empty');
    return EMPTY;
  }
}

// ============================================================================
// E. ENGAGEMENT PROFILE RETRIEVER
// ============================================================================

/**
 * Build an engagement profile by analysing the student's past session metrics.
 *
 * Metrics computed:
 *   - Average student response word count
 *   - Session completion rate (is_complete sessions / total sessions)
 *   - Most and least engaged stages (by number of dialogue turns)
 *   - Average turns per session
 *
 * @param {string} studentId
 * @returns {Promise<{
 *   avgResponseWords: number,
 *   completionRate: number,
 *   avgTurnsPerSession: number,
 *   mostEngagedStage: string|null,
 *   formattedContext: string
 * }>}
 */
async function retrieveEngagementProfile(studentId) {
  const EMPTY = {
    avgResponseWords:   0,
    completionRate:     0,
    avgTurnsPerSession: 0,
    mostEngagedStage:   null,
    formattedContext:   '',
  };

  try {
    // Fetch all sessions for this student (completed and incomplete).
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, is_complete')
      .eq('student_id', studentId)
      .order('id', { ascending: false })
      .limit(20);

    if (sessionsError || !sessions || sessions.length === 0) return EMPTY;

    const totalSessions     = sessions.length;
    const completedSessions = sessions.filter((s) => s.is_complete).length;
    const completionRate    = Math.round((completedSessions / totalSessions) * 100);

    // Fetch recent student dialogue rows.
    const { data: dialogues, error: dialoguesError } = await supabase
      .from('dialogues')
      .select('session_id, stage, content, sessions!inner(student_id)')
      .eq('sessions.student_id', studentId)
      .eq('speaker', 'student')
      .not('content', 'is', null)
      .order('id', { ascending: false })
      .limit(100);

    if (dialoguesError || !dialogues || dialogues.length === 0) {
      return {
        ...EMPTY,
        completionRate,
        formattedContext: `Completion rate: ${completionRate}%.`,
      };
    }

    // Average response length (words).
    const wordCounts = dialogues.map(
      (d) => (d.content || '').trim().split(/\s+/).filter(Boolean).length
    );
    const avgResponseWords = Math.round(
      wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
    );

    // Average turns per session.
    const turnsBySession = {};
    for (const d of dialogues) {
      turnsBySession[d.session_id] = (turnsBySession[d.session_id] || 0) + 1;
    }
    const turnCounts        = Object.values(turnsBySession);
    const avgTurnsPerSession = turnCounts.length > 0
      ? Math.round(turnCounts.reduce((a, b) => a + b, 0) / turnCounts.length)
      : 0;

    // Most engaged stage (highest turn count across all sessions).
    const stageCount = {};
    for (const d of dialogues) {
      const stage = d.stage || 'unknown';
      stageCount[stage] = (stageCount[stage] || 0) + 1;
    }
    const sortedStages    = Object.entries(stageCount).sort((a, b) => b[1] - a[1]);
    const mostEngagedStage = sortedStages[0]?.[0] || null;

    // Format.
    const lines = [
      `Avg response: ${avgResponseWords} words. Completes ${completionRate}% of sessions.`,
      `Avg ${avgTurnsPerSession} turns/session.`,
    ];
    if (mostEngagedStage) {
      lines.push(`Most engaged during: ${mostEngagedStage} stage.`);
    }

    return {
      avgResponseWords,
      completionRate,
      avgTurnsPerSession,
      mostEngagedStage,
      formattedContext: lines.join(' '),
    };
  } catch (err) {
    logger.error({ studentId, err: err.message },
      '[ContextRetriever/engagementProfile] Unexpected error — returning empty');
    return EMPTY;
  }
}

// ============================================================================
// F. MISTAKES RETRIEVER  (context type: MISTAKES)
// ============================================================================

/**
 * Identify recurring grammar error patterns from the student's recent dialogues.
 *
 * Uses grammar_score from dialogue rows and looks for consistent low scores
 * across specific stages to surface areas needing reinforcement.
 *
 * Note: deep NLP parsing is intentionally avoided here. The function identifies
 * patterns from stored grammar_score values and stage context.
 *
 * @param {string} studentId
 * @returns {Promise<{ patterns: string[], formattedContext: string }>}
 */
async function retrieveMistakes(studentId) {
  const EMPTY = { patterns: [], formattedContext: '' };

  try {
    const { data: dialogues, error } = await supabase
      .from('dialogues')
      .select('stage, grammar_score, sessions!inner(student_id)')
      .eq('sessions.student_id', studentId)
      .eq('speaker', 'student')
      .not('grammar_score', 'is', null)
      .order('id', { ascending: false })
      .limit(60);

    if (error || !dialogues || dialogues.length === 0) return EMPTY;

    // Find stages where avg grammar_score < 60 (consistent errors).
    const stageScores = {};
    for (const d of dialogues) {
      const stage = d.stage || 'unknown';
      if (!stageScores[stage]) stageScores[stage] = [];
      stageScores[stage].push(d.grammar_score ?? 100);
    }

    const weakStages = [];
    for (const [stage, scores] of Object.entries(stageScores)) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg < 60) weakStages.push({ stage, avg: Math.round(avg) });
    }

    if (weakStages.length === 0) {
      return { patterns: [], formattedContext: 'Grammar: no persistent error patterns detected.' };
    }

    weakStages.sort((a, b) => a.avg - b.avg);
    const patterns = weakStages.map((s) => `${s.stage} stage (avg grammar: ${s.avg}%)`);
    const formattedContext = `Grammar errors common in: ${patterns.join(', ')}. Gently reinforce in follow-up questions.`;

    return { patterns, formattedContext };
  } catch (err) {
    logger.error({ studentId, err: err.message },
      '[ContextRetriever/mistakes] Unexpected error — returning empty');
    return EMPTY;
  }
}

// ============================================================================
// CONTEXT FORMATTER
// ============================================================================

/**
 * Compose all retrieved context data into a single formatted string suitable
 * for direct injection into the HiAlice system prompt.
 *
 * Priority order (highest first — first to be truncated when over maxTokens):
 *   1. vocabulary        (most immediately actionable for Alice)
 *   2. past_sessions     (gives Alice conversation anchors)
 *   3. depth_history     (calibrates question complexity)
 *   4. engagement        (sets tone and pacing)
 *   5. book_connections  (enriches cross-text references)
 *   6. mistakes          (targets grammar reinforcement)
 *
 * Truncation strategy: sections are appended in priority order. If the next
 * section would push the estimate over maxTokens, it is skipped entirely.
 * The outer frame is never truncated.
 *
 * @param {object} retrievedData - Map of context type → { formattedContext: string, ... }
 * @param {number} [maxTokens=2000]
 * @returns {string} Formatted context block for system prompt injection
 */
export function formatContext(retrievedData, maxTokens = 2000) {
  if (!retrievedData || typeof retrievedData !== 'object') return '';

  // Section priority order.
  const PRIORITY_ORDER = [
    { key: CONTEXT_TYPES.VOCABULARY,         label: 'Vocabulary' },
    { key: CONTEXT_TYPES.PAST_SESSIONS,      label: 'Past sessions' },
    { key: CONTEXT_TYPES.DEPTH_HISTORY,      label: 'Depth pattern' },
    { key: CONTEXT_TYPES.ENGAGEMENT_PROFILE, label: 'Engagement' },
    { key: CONTEXT_TYPES.BOOK_CONNECTIONS,   label: 'Cross-book' },
    { key: CONTEXT_TYPES.MISTAKES,           label: 'Grammar notes' },
  ];

  const HEADER = '═══ STUDENT CONTEXT ═══\n';
  const FOOTER = '\n════════════════════════';

  // Reserve tokens for the frame itself.
  const frameTokens = estimateTokens(HEADER + FOOTER);
  let remaining     = maxTokens - frameTokens;
  const lines       = [];

  for (const { key, label } of PRIORITY_ORDER) {
    const section = retrievedData[key];
    if (!section || !section.formattedContext) continue;

    const text    = `${label}: ${section.formattedContext}`;
    const tokens  = estimateTokens(text + '\n');

    if (remaining - tokens < 0) {
      // Not enough room — skip this section.
      logger.debug({ key, tokens, remaining },
        '[ContextRetriever/formatContext] Section skipped — token budget exhausted');
      continue;
    }

    lines.push(text);
    remaining -= tokens;
  }

  if (lines.length === 0) return '';

  return `${HEADER}${lines.join('\n')}${FOOTER}`;
}

// ============================================================================
// CONTEXT RETRIEVER CLASS
// ============================================================================

/**
 * Stateful retriever for one student × book pair.
 *
 * Instantiate once per request. Retrieved data is cached in this.cache so
 * that multiple calls within the same request cycle (e.g. vocabulary for
 * quick context, then vocabulary again in full context) hit Supabase only once.
 *
 * @example
 * const retriever = new ContextRetriever(studentId, bookId);
 * const result    = await retriever.retrieve(
 *   [CONTEXT_TYPES.VOCABULARY, CONTEXT_TYPES.PAST_SESSIONS],
 *   { maxTokens: 1000 }
 * );
 * // result.context  → formatted string for system prompt
 * // result.sources  → raw data per type
 * // result.cycles   → number of refinement cycles used
 */
export class ContextRetriever {
  /**
   * @param {string} studentId
   * @param {string} currentBookId
   */
  constructor(studentId, currentBookId) {
    this.studentId     = studentId;
    this.currentBookId = currentBookId;
    this.cache         = new Map(); // key: CONTEXT_TYPES value → retrieved data
  }

  // --------------------------------------------------------------------------
  // MAIN RETRIEVE ENTRY POINT
  // --------------------------------------------------------------------------

  /**
   * Retrieve context for the given types with optional iterative refinement.
   *
   * Cycle 1 (Dispatch): run all requested retrievers in parallel.
   * Cycle 2+ (Refine):  identify gaps (empty or very low-token sections)
   *                     and re-run those retrievers with refine=true.
   *
   * @param {string[]} contextTypes Array of CONTEXT_TYPES values to retrieve
   * @param {object}   [options={}]
   * @param {number}   [options.maxCycles=3]            Refinement cycle cap
   * @param {number}   [options.relevanceThreshold=0.7] Minimum relevance to accept
   * @param {number}   [options.maxTokens=2000]         Token budget for the output
   * @returns {Promise<{
   *   context: string,
   *   sources: object,
   *   cycles: number,
   *   tokenEstimate: number
   * }>}
   */
  async retrieve(contextTypes, options = {}) {
    const {
      maxCycles          = 3,
      relevanceThreshold = 0.7,
      maxTokens          = 2000,
    } = options;

    if (!Array.isArray(contextTypes) || contextTypes.length === 0) {
      return { context: '', sources: {}, cycles: 0, tokenEstimate: 0 };
    }

    const sources    = {};
    let   cycleCount = 0;

    // ---- Cycle 1: Dispatch all types in parallel --------------------------
    cycleCount += 1;
    const cycle1Results = await this._fetchAll(contextTypes, { refine: false });
    Object.assign(sources, cycle1Results);

    // ---- Cycles 2-N: Identify gaps and refine -----------------------------
    for (let cycle = 2; cycle <= maxCycles; cycle++) {
      const gapTypes = this._findGaps(sources, contextTypes, relevanceThreshold);

      if (gapTypes.length === 0) {
        logger.debug({ cycle, studentId: this.studentId },
          '[ContextRetriever] No gaps found — stopping refinement early');
        break;
      }

      logger.debug({ cycle, gapTypes, studentId: this.studentId },
        '[ContextRetriever] Refinement cycle — filling gaps');

      cycleCount += 1;
      const cycleResults = await this._fetchAll(gapTypes, { refine: true });

      // Merge: only overwrite if the refined result is non-empty.
      for (const [key, data] of Object.entries(cycleResults)) {
        if (data.formattedContext && data.formattedContext.length > 0) {
          sources[key] = data;
          this.cache.set(key, data); // update cache with refined version
        }
      }

      // Re-check gaps after merge — if still gaps remain, next cycle handles.
    }

    // ---- Format -----------------------------------------------------------
    const context      = formatContext(sources, maxTokens);
    const tokenEstimate = estimateTokens(context);

    return { context, sources, cycles: cycleCount, tokenEstimate };
  }

  // --------------------------------------------------------------------------
  // INTERNAL: fetch a set of types (honouring the cache)
  // --------------------------------------------------------------------------

  /**
   * Run retrievers for the given types, returning cached results where available.
   *
   * @param {string[]} types
   * @param {object}   queryOpts Options forwarded to individual retrievers
   * @returns {Promise<object>} Map of type → retriever result
   * @private
   */
  async _fetchAll(types, queryOpts = {}) {
    const tasks = types.map(async (type) => {
      // Return cached result if available (and not in a refine cycle).
      if (!queryOpts.refine && this.cache.has(type)) {
        return [type, this.cache.get(type)];
      }

      const data = await this._fetchOne(type, queryOpts);
      this.cache.set(type, data);
      return [type, data];
    });

    const entries = await Promise.all(tasks);
    return Object.fromEntries(entries);
  }

  /**
   * Dispatch to the correct individual retriever for a given context type.
   *
   * @param {string} type  One of CONTEXT_TYPES values
   * @param {object} queryOpts Forwarded options
   * @returns {Promise<object>}
   * @private
   */
  async _fetchOne(type, queryOpts = {}) {
    const { studentId, currentBookId } = this;

    switch (type) {
      case CONTEXT_TYPES.PAST_SESSIONS:
        return retrievePastSessions(studentId, currentBookId, queryOpts);

      case CONTEXT_TYPES.VOCABULARY:
        return retrieveVocabulary(studentId, queryOpts);

      case CONTEXT_TYPES.DEPTH_HISTORY:
        return retrieveDepthHistory(studentId);

      case CONTEXT_TYPES.BOOK_CONNECTIONS:
        return retrieveBookConnections(studentId, currentBookId);

      case CONTEXT_TYPES.ENGAGEMENT_PROFILE:
        return retrieveEngagementProfile(studentId);

      case CONTEXT_TYPES.MISTAKES:
        return retrieveMistakes(studentId);

      default:
        logger.warn({ type }, '[ContextRetriever] Unknown context type — skipping');
        return { formattedContext: '' };
    }
  }

  // --------------------------------------------------------------------------
  // INTERNAL: gap detection
  // --------------------------------------------------------------------------

  /**
   * Identify context types that returned insufficient data in the previous
   * retrieval cycle. A section is considered a "gap" when its formattedContext
   * is empty OR its token count is below the minimum meaningful threshold.
   *
   * Only PAST_SESSIONS and VOCABULARY support refinement queries; the others
   * are deterministic lookups that won't change on a second pass.
   *
   * @param {object}   sources            Current retrieval results
   * @param {string[]} requestedTypes     The originally requested types
   * @param {number}   relevanceThreshold Minimum acceptable relevance (0–1)
   * @returns {string[]} Types that should be re-queried
   * @private
   */
  _findGaps(sources, requestedTypes, relevanceThreshold) {
    // Only these types benefit from a second-pass refinement query.
    const REFINEABLE = new Set([CONTEXT_TYPES.PAST_SESSIONS, CONTEXT_TYPES.VOCABULARY]);

    // Minimum token count below which we consider a section a gap.
    const MIN_TOKENS = 10;

    return requestedTypes.filter((type) => {
      if (!REFINEABLE.has(type)) return false;

      const data = sources[type];
      if (!data || !data.formattedContext) return true;

      if (estimateTokens(data.formattedContext) < MIN_TOKENS) return true;

      // For past sessions, also check relevance of returned sessions.
      if (type === CONTEXT_TYPES.PAST_SESSIONS && Array.isArray(data.sessions)) {
        const topRelevance = data.sessions[0]?.relevance ?? 0;
        return topRelevance < relevanceThreshold;
      }

      return false;
    });
  }
}

// ============================================================================
// QUICK CONTEXT (lightweight single-pass)
// ============================================================================

/**
 * Single-pass context retrieval for fast paths (grammar check, rephrase).
 *
 * Only fetches vocabulary and the last session — the two most universally
 * useful signals — with a 500-token budget. No iterative refinement.
 *
 * // TODO: integrate with engine.js — call before grammar_check and rephrase tasks
 *
 * @param {string} studentId
 * @param {string} bookId
 * @returns {Promise<{ context: string, tokenEstimate: number }>}
 */
export async function getQuickContext(studentId, bookId) {
  try {
    const retriever = new ContextRetriever(studentId, bookId);
    const result    = await retriever.retrieve(
      [CONTEXT_TYPES.VOCABULARY, CONTEXT_TYPES.PAST_SESSIONS],
      { maxCycles: 1, maxTokens: 500 }
    );

    logger.debug({
      studentId,
      bookId,
      cycles:        result.cycles,
      tokenEstimate: result.tokenEstimate,
    }, '[ContextRetriever] getQuickContext complete');

    return { context: result.context, tokenEstimate: result.tokenEstimate };
  } catch (err) {
    logger.error({ studentId, bookId, err: err.message },
      '[ContextRetriever] getQuickContext failed — returning empty context');
    return { context: '', tokenEstimate: 0 };
  }
}

// ============================================================================
// FULL CONTEXT (stage-aware iterative retrieval)
// ============================================================================

/**
 * Full iterative context retrieval for main session response turns.
 *
 * Stage-aware weighting:
 *   body       → prioritises depth_history (student needs probing questions)
 *   conclusion → prioritises vocabulary (cement learned words)
 *   all others → balanced across all six types
 *
 * Up to 3 refinement cycles and a 2 000-token budget.
 *
 * // TODO: integrate with engine.js — call before session_response generation,
 * //        append result.context to the system prompt string
 *
 * @param {string} studentId
 * @param {string} bookId
 * @param {string} [stage='title'] Current session stage
 * @returns {Promise<{ context: string, sources: object, cycles: number, tokenEstimate: number }>}
 */
export async function getFullContext(studentId, bookId, stage = 'title') {
  try {
    // Determine which context types to emphasise for this stage.
    const allTypes = Object.values(CONTEXT_TYPES);

    // Stage-specific ordering — most relevant types first so formatContext()
    // honours the priority when truncating.
    let stageTypes;

    if (stage === 'body') {
      // In body stage Alice needs to probe for three reasons — depth history
      // and past session patterns are the most valuable signals.
      stageTypes = [
        CONTEXT_TYPES.DEPTH_HISTORY,
        CONTEXT_TYPES.PAST_SESSIONS,
        CONTEXT_TYPES.VOCABULARY,
        CONTEXT_TYPES.ENGAGEMENT_PROFILE,
        CONTEXT_TYPES.BOOK_CONNECTIONS,
        CONTEXT_TYPES.MISTAKES,
      ];
    } else if (stage === 'conclusion') {
      // In conclusion stage Alice should celebrate vocabulary growth and
      // connect back to previous books for thematic synthesis.
      stageTypes = [
        CONTEXT_TYPES.VOCABULARY,
        CONTEXT_TYPES.BOOK_CONNECTIONS,
        CONTEXT_TYPES.PAST_SESSIONS,
        CONTEXT_TYPES.DEPTH_HISTORY,
        CONTEXT_TYPES.ENGAGEMENT_PROFILE,
        CONTEXT_TYPES.MISTAKES,
      ];
    } else {
      // Default balanced order for all other stages.
      stageTypes = allTypes;
    }

    const retriever = new ContextRetriever(studentId, bookId);
    const result    = await retriever.retrieve(stageTypes, {
      maxCycles:          3,
      relevanceThreshold: 0.7,
      maxTokens:          2000,
    });

    logger.debug({
      studentId,
      bookId,
      stage,
      cycles:        result.cycles,
      tokenEstimate: result.tokenEstimate,
    }, '[ContextRetriever] getFullContext complete');

    return result;
  } catch (err) {
    logger.error({ studentId, bookId, stage, err: err.message },
      '[ContextRetriever] getFullContext failed — returning empty context');
    return { context: '', sources: {}, cycles: 0, tokenEstimate: 0 };
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  CONTEXT_TYPES,
  ContextRetriever,
  formatContext,
  getQuickContext,
  getFullContext,
};
