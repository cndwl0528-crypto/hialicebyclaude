/**
 * sessions.js
 * HiAlice — Session Routes
 *
 * Handles all Q&A session lifecycle: start, message exchange, complete,
 * pause/resume, per-stage score retrieval, and student session history.
 *
 * Route summary:
 *   POST   /start                         Start a new session
 *   POST   /:id/message                   Send a student turn, get Alice reply
 *   POST   /:id/complete                  Complete a session (saves stage scores, awards badges)
 *   GET    /:id/review                    Full session review (dialogues + vocabulary)
 *   GET    /student/:studentId            Session history for a student
 *   GET    /:id/stage-scores              Per-stage scores for a single session
 *   PUT    /:id/pause                     Pause (save-and-exit) a session
 *   PUT    /:id/resume                    Resume a paused session
 */

import express from 'express';
import { supabase } from '../lib/supabase.js';
import { authMiddleware } from '../middleware/auth.js';
import { getAliceResponse, generateSessionFeedback } from '../alice/engine.js';
import { extractVocabulary } from '../alice/vocabularyExtractor.js';
import { calculateGrammarScore, classifyAnswerDepth, calculateThinkingMomentum } from '../alice/levelDetector.js';
import { checkAndAwardAchievements } from '../lib/achievements.js';
import { getCrossBookContext } from '../alice/crossBookMemory.js';

const router = express.Router();

// ============================================================================
// AUTH HELPER
// ============================================================================

/**
 * Optional authentication middleware.
 * In development: skips token verification for easier local testing.
 * In production: enforces valid Bearer token.
 */
function optionalAuth(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  return authMiddleware(req, res, next);
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Calculate per-stage scores from a session's dialogue rows.
 * Returns an object keyed by stage name.
 *
 * @param {Array}  dialogues  — rows from the dialogues table
 * @param {string} level      — student level ('beginner'|'intermediate'|'advanced')
 * @returns {Object} stageMap e.g. { title: { grammar, fluency, vocabulary, responseCount, avgWords } }
 */
function computeStageBreakdown(dialogues, level) {
  const stages = ['warm_connection', 'title', 'introduction', 'body', 'conclusion', 'cross_book'];
  const stageMap = {};

  stages.forEach((stage) => {
    const studentTurns = dialogues.filter(
      (d) => d.stage === stage && d.speaker === 'student'
    );

    if (studentTurns.length === 0) {
      stageMap[stage] = null; // stage was not reached
      return;
    }

    const wordCounts = studentTurns.map((d) =>
      d.content.trim().split(/\s+/).filter(Boolean).length
    );
    const avgWords = Math.round(
      wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
    );

    // Grammar score: average across this stage's turns
    const grammarScores = studentTurns.map((d) =>
      calculateGrammarScore(d.content, level)
    );
    const grammarScore = Math.round(
      grammarScores.reduce((a, b) => a + b, 0) / grammarScores.length
    );

    // Fluency approximation: normalise avgWords (target = 20 words per response)
    const fluencyScore = Math.min(100, Math.round((avgWords / 20) * 100));

    // Vocabulary score: fraction of responses with ≥ 4 unique non-trivial words
    const richResponses = studentTurns.filter((d) => {
      const words = new Set(
        d.content
          .toLowerCase()
          .replace(/[^a-z\s]/g, '')
          .split(/\s+/)
          .filter((w) => w.length >= 4)
      );
      return words.size >= 4;
    }).length;
    const vocabularyScore = Math.round((richResponses / studentTurns.length) * 100);

    stageMap[stage] = {
      grammar: grammarScore,
      fluency: fluencyScore,
      vocabulary: vocabularyScore,
      responseCount: studentTurns.length,
      avgWords,
    };
  });

  return stageMap;
}

/**
 * Build a student stats snapshot used by the achievement checker.
 * Reads directly from the DB to get the most up-to-date values.
 *
 * @param {string} studentId
 * @returns {Promise<{ totalBooks, totalWords, streak, avgGrammar }>}
 */
async function buildAchievementStats(studentId) {
  const [
    { data: student },
    { data: sessions },
    { data: vocabRows },
  ] = await Promise.all([
    supabase
      .from('students')
      .select('current_streak, total_books_read')
      .eq('id', studentId)
      .single(),
    supabase
      .from('sessions')
      .select('grammar_score')
      .eq('student_id', studentId)
      .eq('is_complete', true),
    supabase
      .from('vocabulary')
      .select('id', { count: 'exact' })
      .eq('student_id', studentId),
  ]);

  const totalBooks = student?.total_books_read ?? 0;
  const totalWords = vocabRows?.length ?? 0;
  const streak = student?.current_streak ?? 0;

  const scored = sessions?.filter((s) => s.grammar_score != null) || [];
  const avgGrammar =
    scored.length > 0
      ? Math.round(
          scored.reduce((sum, s) => sum + s.grammar_score, 0) / scored.length
        )
      : 0;

  return { totalBooks, totalWords, streak, avgGrammar };
}

/**
 * Asynchronously tag dialogues with Bloom's cognitive levels and calculate
 * thinking momentum. This runs after session completion and failures are
 * non-fatal — they do not affect the completion response.
 *
 * @param {string} sessionId
 * @param {Array} studentDialogues - Student dialogue rows with .content
 * @param {string} level - Student level
 */
async function tagCognitiveData(sessionId, studentDialogues, level) {
  try {
    // 1. Classify each student response and insert cognitive tags
    const tagInserts = studentDialogues
      .filter(d => d.content && d.content.trim().length > 0)
      .map(d => {
        const depth = classifyAnswerDepth(d.content, level);
        // Map answer depth to Bloom's level (6-level)
        const bloomLevel = mapDepthToBloom(depth.depth, depth.score, depth.indicators);
        return supabase.from('dialogue_cognitive_tags').insert({
          dialogue_id: d.id,
          bloom_level: bloomLevel,
          evidence_text: d.content.substring(0, 200),
          confidence: depth.score,
          tagged_by: 'classifyAnswerDepth-v1',
        });
      });

    await Promise.all(tagInserts);

    // 2. Calculate thinking momentum
    const depthScores = studentDialogues
      .filter(d => d.content && d.content.trim().length > 0)
      .map(d => d.content);
    const momentum = calculateThinkingMomentum(depthScores);

    // 3. Update session with thinking momentum
    await supabase
      .from('sessions')
      .update({ thinking_momentum: momentum })
      .eq('id', sessionId);

  } catch (err) {
    // Non-fatal: cognitive tagging failure should never block session completion
    console.error('[Sessions] Cognitive tagging error (non-fatal):', err.message);
  }
}

/**
 * Map answer depth classification to Bloom's taxonomy level.
 * Uses score + indicators for finer-grained 6-level mapping.
 *
 * @param {'surface'|'developing'|'analytical'|'deep'} depth
 * @param {number} [score=0] - Depth score (0-100)
 * @param {string[]} [indicators=[]] - Detected thinking indicators
 * @returns {'remember'|'understand'|'apply'|'analyze'|'evaluate'|'create'}
 */
function mapDepthToBloom(depth, score = 0, indicators = []) {
  const hasEvaluative = indicators.includes('evaluative_language');
  const hasCreative = indicators.includes('creative_thinking');
  const hasEvidence = indicators.includes('text_evidence');
  const hasPersonal = indicators.includes('personal_connection');

  switch (depth) {
    case 'deep':
      // create: hypothetical/creative thinking; evaluate: judgement with evidence
      return hasCreative ? 'create' : 'evaluate';
    case 'analytical':
      // evaluate: evaluative language present; analyze: evidence-based analysis
      return hasEvaluative ? 'evaluate' : 'analyze';
    case 'developing':
      // apply: personal connection (applying to own life); understand: basic comprehension
      return (hasPersonal || hasEvidence) ? 'apply' : 'understand';
    case 'surface':
    default:
      return 'remember';
  }
}

// ============================================================================
// POST /start
// ============================================================================

/**
 * Start a new Q&A session.
 * Body: { studentId, bookId }
 * Returns: { session, message: { speaker: 'alice', content } }
 */
router.post('/start', optionalAuth, async (req, res) => {
  try {
    const { studentId, bookId } = req.body;

    if (!studentId || !bookId) {
      return res.status(400).json({ error: 'studentId and bookId required' });
    }

    // Verify student exists and get their level and name
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, level')
      .eq('id', studentId)
      .single();

    if (studentError) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Verify book exists; fetch rich context fields for AI prompt personalisation
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, title, author, level, synopsis, key_themes, emotional_keywords, key_characters, moral_lesson')
      .eq('id', bookId)
      .single();

    if (bookError) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Create the new session record
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        student_id: studentId,
        book_id: bookId,
        stage: 'warm_connection',
        started_at: new Date().toISOString(),
        is_complete: false,
      })
      .select()
      .single();

    if (sessionError) {
      return res.status(500).json({ error: sessionError.message });
    }

    // Fetch cross-book context for prompt enrichment
    const { crossBookContext } = await getCrossBookContext(studentId, bookId);

    // Get HiAlice's opening question — pass full book object for context-aware prompt
    const aliceResponse = await getAliceResponse({
      bookTitle: book.title,
      studentName: student.name,
      level: student.level,
      stage: 'warm_connection',
      turn: 1,
      studentMessage: null,
      conversationHistory: [],
      book,
      crossBookContext,
    });

    const grammarScore = calculateGrammarScore('', student.level);

    // Store Alice's opening message in the dialogues table
    const { error: dialogueError } = await supabase
      .from('dialogues')
      .insert({
        session_id: session.id,
        stage: 'warm_connection',
        turn: 1,
        speaker: 'alice',
        content: aliceResponse.content,
        grammar_score: grammarScore,
      });

    if (dialogueError) {
      console.error('Dialogue insert error:', dialogueError);
    }

    return res.status(201).json({
      session: {
        id: session.id,
        studentId: session.student_id,
        bookId: session.book_id,
        stage: session.stage,
        startedAt: session.started_at,
      },
      message: {
        speaker: 'alice',
        content: aliceResponse.content,
      },
    });
  } catch (err) {
    console.error('Start session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /:id/message
// ============================================================================

/**
 * Send a student message and receive Alice's reply.
 * Body: { content, stage }
 * Returns: { reply, stage, turn, vocabulary, shouldAdvance, nextStage, grammarScore }
 */
router.post('/:id/message', optionalAuth, async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const { content, stage: rawStage } = req.body;

    if (!content || !rawStage) {
      return res.status(400).json({ error: 'content and stage required' });
    }

    // Normalise stage to lowercase for consistent DB storage
    const stage = rawStage.toLowerCase();

    // Fetch current session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, student_id, book_id, stage')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Fetch student, book, and conversation history in parallel (N+1 avoidance)
    const [
      { data: student },
      { data: book },
      { data: dialogues },
    ] = await Promise.all([
      supabase
        .from('students')
        .select('id, name, level')
        .eq('id', session.student_id)
        .single(),
      supabase
        .from('books')
        .select('id, title, author, level, synopsis, key_themes, emotional_keywords, key_characters, moral_lesson')
        .eq('id', session.book_id)
        .single(),
      supabase
        .from('dialogues')
        .select('speaker, content, turn, stage')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true }),
    ]);

    // Count only student messages in this stage to derive turn number
    const studentTurnsInStage = dialogues?.filter(
      (d) => d.stage === stage && d.speaker === 'student'
    ) || [];
    const currentTurn = studentTurnsInStage.length + 1;

    // Insert the student's message
    const { error: studentDialogueError } = await supabase
      .from('dialogues')
      .insert({
        session_id: sessionId,
        stage,
        turn: currentTurn,
        speaker: 'student',
        content,
        word_count: content.trim().split(/\s+/).filter(Boolean).length,
      });

    if (studentDialogueError) {
      console.error('Student dialogue error:', studentDialogueError);
    }

    const { crossBookContext } = await getCrossBookContext(session.student_id, session.book_id);

    // Get Alice's response — pass full book object for context-aware, emotion-eliciting prompt
    const aliceResponse = await getAliceResponse({
      bookTitle: book.title,
      studentName: student.name,
      level: student.level,
      stage,
      turn: currentTurn,
      studentMessage: content,
      conversationHistory: dialogues || [],
      book,
      crossBookContext,
    });

    // Score the student's response
    const grammarScore = calculateGrammarScore(content, student.level);
    const depthAnalysis = aliceResponse.depthAnalysis;

    // Map depth to Bloom's taxonomy level for storage (6-level)
    const bloomLevel = depthAnalysis
      ? mapDepthToBloom(depthAnalysis.depth, depthAnalysis.score, depthAnalysis.indicators)
      : null;

    // Update the student's dialogue row with depth classification
    if (bloomLevel) {
      await supabase
        .from('dialogues')
        .update({ bloom_level: bloomLevel })
        .eq('session_id', sessionId)
        .eq('stage', stage)
        .eq('turn', currentTurn)
        .eq('speaker', 'student');
    }

    // Store Alice's reply
    const { error: aliceDialogueError } = await supabase
      .from('dialogues')
      .insert({
        session_id: sessionId,
        stage,
        turn: currentTurn,
        speaker: 'alice',
        content: aliceResponse.content,
        grammar_score: grammarScore,
      });

    if (aliceDialogueError) {
      console.error('Alice dialogue error:', aliceDialogueError);
    }

    // Extract vocabulary from the student's response
    const extractedWords = extractVocabulary(content, student.level);

    // Persist vocabulary entries (upsert to avoid duplicates)
    const vocabularyPromises = extractedWords.map((vocabItem) =>
      supabase
        .from('vocabulary')
        .insert({
          student_id: session.student_id,
          session_id: sessionId,
          word: vocabItem.word,
          context_sentence: vocabItem.context,
          pos: vocabItem.pos,
          synonyms: vocabItem.synonyms || [],
          first_used: new Date().toISOString(),
          mastery_level: vocabItem.isNew ? 1 : 2,
          use_count: 1,
        })
        .select()
    );

    const vocabResults = await Promise.all(vocabularyPromises);
    const vocabulary = vocabResults.map((r) => r.data?.[0]).filter(Boolean);

    // Determine whether the current stage should advance.
    // Body requires 3 student turns; all other stages advance after 2+.
    const stages = ['warm_connection', 'title', 'introduction', 'body', 'conclusion', 'cross_book'];
    const stageIndex = stages.indexOf(stage);

    let shouldAdvance = false;
    if (stage === 'body') {
      shouldAdvance = currentTurn >= 3;
    } else {
      shouldAdvance = currentTurn >= 2;
    }

    const nextStage =
      shouldAdvance && stageIndex < stages.length - 1
        ? stages[stageIndex + 1]
        : null;

    return res.status(200).json({
      reply: {
        speaker: 'alice',
        content: aliceResponse.content,
      },
      stage,
      turn: currentTurn,
      vocabulary,
      shouldAdvance,
      nextStage,
      grammarScore,
      depthAnalysis: depthAnalysis || null,
    });
  } catch (err) {
    console.error('Message error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /:id/complete
// ============================================================================

/**
 * Complete a session.
 * Saves per-stage scores, updates student aggregated stats, sends a
 * parent notification, and awards any newly unlocked achievements.
 *
 * Body: {} (no required body; all data derived from existing DB records)
 * Returns: { session, summary, newAchievements }
 */
router.post('/:id/complete', optionalAuth, async (req, res) => {
  try {
    const { id: sessionId } = req.params;

    // Fetch the session with student info
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*, students(id, name, parent_id, level, current_streak, total_books_read, total_words_learned, last_session_date)')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Already completed — return early to stay idempotent
    if (session.is_complete) {
      return res.status(200).json({
        session: { id: session.id, completedAt: session.completed_at },
        summary: {
          levelScore: session.level_score,
          grammarScore: session.grammar_score,
          vocabularyCount: 0,
          alreadyComplete: true,
        },
        newAchievements: [],
      });
    }

    const student = session.students;
    const studentId = student.id;
    const studentLevel = student.level;

    // Load all student dialogues for this session
    const { data: allDialogues } = await supabase
      .from('dialogues')
      .select('stage, turn, speaker, content, grammar_score')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    const studentDialogues = allDialogues?.filter((d) => d.speaker === 'student') || [];

    // --- Overall grammar score ---
    let averageGrammarScore = 0;
    if (studentDialogues.length > 0) {
      const scores = studentDialogues.map((d) =>
        calculateGrammarScore(d.content, studentLevel)
      );
      averageGrammarScore = Math.round(
        scores.reduce((a, b) => a + b, 0) / scores.length
      );
    }

    // --- Completion level score ---
    const stagesWithResponses = new Set(
      studentDialogues.map((d) => d.stage)
    );
    const levelScore = Math.round((stagesWithResponses.size / 6) * 100);

    // --- Per-stage score breakdown ---
    const stageBreakdown = computeStageBreakdown(allDialogues || [], studentLevel);

    // --- Vocabulary count for this session ---
    const { data: sessionVocab } = await supabase
      .from('vocabulary')
      .select('id')
      .eq('session_id', sessionId);

    const vocabularyCount = sessionVocab?.length || 0;

    // --- Persist per-stage scores to session_stage_scores ---
    const stageInserts = Object.entries(stageBreakdown)
      .filter(([, v]) => v !== null)
      .map(([stage, scores]) =>
        supabase.from('session_stage_scores').insert({
          session_id: sessionId,
          stage,
          grammar_score: scores.grammar,
          fluency_score: scores.fluency,
          vocabulary_score: scores.vocabulary,
          response_count: scores.responseCount,
          avg_response_words: scores.avgWords,
        })
      );
    await Promise.all(stageInserts);

    // --- Fetch book context for AI feedback generation ---
    const { data: sessionBook } = await supabase
      .from('books')
      .select('id, title, author, synopsis, key_themes, emotional_keywords, key_characters, moral_lesson')
      .eq('id', session.book_id)
      .single();

    // --- Generate personalised AI feedback from HiAlice ---
    // Run asynchronously alongside the session update; failures are non-fatal.
    let aiFeedback = null;
    try {
      aiFeedback = await generateSessionFeedback({
        student: { name: student.name, level: studentLevel },
        book: sessionBook || { title: session.book_id },
        dialogues: allDialogues || [],
        levelScore,
        grammarScore: averageGrammarScore,
      });
    } catch (feedbackErr) {
      console.error('[Sessions] AI feedback generation failed:', feedbackErr.message);
      // Non-fatal — session completion proceeds without feedback text
    }

    // --- Update session row ---
    const completedAt = new Date().toISOString();
    await supabase
      .from('sessions')
      .update({
        completed_at: completedAt,
        grammar_score: averageGrammarScore,
        level_score: levelScore,
        is_complete: true,
        stage: 'conclusion',
        status: 'completed',
        ...(aiFeedback ? { ai_feedback: aiFeedback } : {}),
      })
      .eq('id', sessionId);

    // --- Update student aggregated stats ---
    const today = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
    const lastDate = student.last_session_date;

    // Determine streak: increment if last session was yesterday, reset if missed a day
    let newStreak = student.current_streak ?? 0;
    if (lastDate) {
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .substring(0, 10);
      if (lastDate === today) {
        // Already had a session today — streak unchanged
      } else if (lastDate === yesterday) {
        newStreak += 1; // consecutive day
      } else {
        newStreak = 1; // streak broken; start fresh
      }
    } else {
      newStreak = 1; // first ever session
    }

    const newTotalBooks = (student.total_books_read ?? 0) + 1;
    const newTotalWords = (student.total_words_learned ?? 0) + vocabularyCount;

    await supabase
      .from('students')
      .update({
        total_books_read: newTotalBooks,
        total_words_learned: newTotalWords,
        current_streak: newStreak,
        last_session_date: today,
      })
      .eq('id', studentId);

    // --- Send parent notification ---
    if (student.parent_id) {
      await supabase.from('parent_notifications').insert({
        parent_id: student.parent_id,
        student_id: studentId,
        type: 'session_complete',
        title: `${student.name} completed a session!`,
        message: `Great news! ${student.name} just finished a reading session with a grammar score of ${averageGrammarScore}/100 and learned ${vocabularyCount} new words.`,
      });
    }

    // --- Check and award achievements ---
    const achievementStats = {
      totalBooks: newTotalBooks,
      totalWords: newTotalWords,
      streak: newStreak,
      avgGrammar: averageGrammarScore,
    };
    const { awarded: newAchievements } = await checkAndAwardAchievements(
      supabase,
      studentId,
      achievementStats
    );

    // --- Notify parent about newly earned achievements ---
    if (newAchievements.length > 0 && student.parent_id) {
      const achievementNotifications = newAchievements.map((key) =>
        supabase.from('parent_notifications').insert({
          parent_id: student.parent_id,
          student_id: studentId,
          type: 'achievement',
          title: `${student.name} earned a new badge!`,
          message: `${student.name} just unlocked the "${key}" achievement. Keep up the great work!`,
        })
      );
      await Promise.all(achievementNotifications);
    }

    // --- Async cognitive tagging (non-blocking) ---
    // Fire-and-forget: tag dialogues with Bloom's levels and calculate thinking momentum.
    // We need dialogue IDs, so re-fetch with IDs included.
    supabase
      .from('dialogues')
      .select('id, content, stage, speaker')
      .eq('session_id', sessionId)
      .eq('speaker', 'student')
      .order('created_at', { ascending: true })
      .then(({ data: tagDialogues }) => {
        if (tagDialogues && tagDialogues.length > 0) {
          tagCognitiveData(sessionId, tagDialogues, studentLevel);
        }
      })
      .catch(err => {
        console.error('[Sessions] Failed to fetch dialogues for tagging:', err.message);
      });

    return res.status(200).json({
      session: {
        id: session.id,
        completedAt,
      },
      summary: {
        levelScore,
        grammarScore: averageGrammarScore,
        vocabularyCount,
        stageBreakdown,
        aiFeedback,
      },
      newAchievements,
    });
  } catch (err) {
    console.error('Complete session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET /:id/review
// ============================================================================

/**
 * Get full session review data.
 * Returns: { session, dialogues, vocabulary }
 */
router.get('/:id/review', optionalAuth, async (req, res) => {
  try {
    const { id: sessionId } = req.params;

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const [{ data: dialogues }, { data: vocabulary }] = await Promise.all([
      supabase
        .from('dialogues')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true }),
      supabase
        .from('vocabulary')
        .select('*')
        .eq('session_id', sessionId),
    ]);

    return res.status(200).json({
      session,
      dialogues: dialogues || [],
      vocabulary: vocabulary || [],
    });
  } catch (err) {
    console.error('Review error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET /:id/feedback
// ============================================================================

/**
 * Retrieve the AI-generated feedback for a completed session.
 *
 * Returns the text stored in sessions.ai_feedback (written during /complete).
 * If the session is not yet complete, or feedback generation had failed,
 * a 404 with an explanatory message is returned — not a 500 — so the client
 * can display a graceful "feedback not available" state.
 *
 * Returns: { sessionId, aiFeedback, generatedAt }
 */
router.get('/:id/feedback', optionalAuth, async (req, res) => {
  try {
    const { id: sessionId } = req.params;

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, is_complete, completed_at, ai_feedback')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.is_complete) {
      return res.status(404).json({ error: 'Session is not yet complete — feedback is not available' });
    }

    if (!session.ai_feedback) {
      return res.status(404).json({ error: 'AI feedback has not been generated for this session' });
    }

    return res.status(200).json({
      sessionId: session.id,
      aiFeedback: session.ai_feedback,
      generatedAt: session.completed_at,
    });
  } catch (err) {
    console.error('Feedback retrieval error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET /student/:studentId
// ============================================================================

/**
 * Get all sessions for a student, with aggregate stats.
 *
 * Returns:
 * {
 *   sessions: [{ id, bookTitle, stage, isComplete, startedAt, completedAt, grammarScore, levelScore }],
 *   stats: { totalSessions, completedSessions, avgGrammarScore, totalWords, streak }
 * }
 */
router.get('/student/:studentId', optionalAuth, async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({ error: 'studentId required' });
    }

    // Verify student exists
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, level, current_streak, total_books_read, total_words_learned')
      .eq('id', studentId)
      .single();

    if (studentError) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Fetch all sessions with book title joined
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, stage, is_complete, started_at, completed_at, grammar_score, level_score, books(title, level)')
      .eq('student_id', studentId)
      .order('started_at', { ascending: false });

    if (sessionsError) {
      return res.status(500).json({ error: sessionsError.message });
    }

    // Compute aggregate stats across all sessions
    const completedRows = sessions?.filter((s) => s.is_complete) || [];
    const scored = completedRows.filter((s) => s.grammar_score != null);
    const avgGrammarScore =
      scored.length > 0
        ? Math.round(
            scored.reduce((sum, s) => sum + s.grammar_score, 0) / scored.length
          )
        : 0;

    return res.status(200).json({
      sessions: (sessions || []).map((s) => ({
        id: s.id,
        bookTitle: s.books?.title || null,
        bookLevel: s.books?.level || null,
        stage: s.stage,
        isComplete: s.is_complete,
        startedAt: s.started_at,
        completedAt: s.completed_at,
        grammarScore: s.grammar_score,
        levelScore: s.level_score,
      })),
      stats: {
        totalSessions: sessions?.length || 0,
        completedSessions: completedRows.length,
        avgGrammarScore,
        totalWords: student.total_words_learned ?? 0,
        streak: student.current_streak ?? 0,
      },
    });
  } catch (err) {
    console.error('Student sessions error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET /:id/cognitive-tags
// ============================================================================

/**
 * Get Bloom's taxonomy cognitive tags for a session.
 * Returns per-dialogue tags + session-level summary.
 *
 * Returns:
 * {
 *   sessionId, thinkingMomentum,
 *   tags: [{ dialogueId, stage, bloomLevel, evidenceText, confidence }],
 *   distribution: { remember: N, understand: N, apply: N, analyze: N, evaluate: N, create: N },
 *   higherOrderRatio: 0-1
 * }
 */
router.get('/:id/cognitive-tags', optionalAuth, async (req, res) => {
  try {
    const { id: sessionId } = req.params;

    // Verify session exists and get thinking momentum
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, thinking_momentum')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Fetch cognitive tags with dialogue stage info
    const { data: tags, error: tagsError } = await supabase
      .from('dialogue_cognitive_tags')
      .select('id, dialogue_id, bloom_level, evidence_text, confidence, created_at, dialogues(stage)')
      .eq('dialogues.session_id', sessionId)
      .order('created_at', { ascending: true });

    // Fallback: if the join filter returns nothing, query via dialogue IDs
    let cogTags = tags || [];
    if (cogTags.length === 0) {
      const { data: dialogueIds } = await supabase
        .from('dialogues')
        .select('id')
        .eq('session_id', sessionId)
        .eq('speaker', 'student');

      if (dialogueIds && dialogueIds.length > 0) {
        const ids = dialogueIds.map(d => d.id);
        const { data: fallbackTags } = await supabase
          .from('dialogue_cognitive_tags')
          .select('id, dialogue_id, bloom_level, evidence_text, confidence, created_at')
          .in('dialogue_id', ids)
          .order('created_at', { ascending: true });
        cogTags = fallbackTags || [];
      }
    }

    // If we used the join, extract stage from nested dialogues
    const formattedTags = cogTags.map(t => ({
      dialogueId: t.dialogue_id,
      stage: t.dialogues?.stage || null,
      bloomLevel: t.bloom_level,
      evidenceText: t.evidence_text,
      confidence: t.confidence,
    }));

    // Calculate distribution
    const bloomLevels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
    const distribution = {};
    bloomLevels.forEach(level => { distribution[level] = 0; });
    formattedTags.forEach(t => {
      if (distribution[t.bloomLevel] !== undefined) {
        distribution[t.bloomLevel]++;
      }
    });

    const total = formattedTags.length || 1;
    const higherOrder = (distribution.analyze + distribution.evaluate + distribution.create) / total;

    return res.status(200).json({
      sessionId: session.id,
      thinkingMomentum: session.thinking_momentum,
      tags: formattedTags,
      distribution,
      higherOrderRatio: Math.round(higherOrder * 100) / 100,
    });
  } catch (err) {
    console.error('Cognitive tags error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET /:id/stage-scores
// ============================================================================

/**
 * Get per-stage scores for a session.
 * Returns:
 * {
 *   stages: [{ stage, grammarScore, fluencyScore, vocabularyScore, responseCount, avgResponseWords }]
 * }
 */
router.get('/:id/stage-scores', optionalAuth, async (req, res) => {
  try {
    const { id: sessionId } = req.params;

    // Verify session exists
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Fetch pre-computed stage scores saved during session completion
    const { data: stageScores, error: scoresError } = await supabase
      .from('session_stage_scores')
      .select('stage, grammar_score, fluency_score, vocabulary_score, response_count, avg_response_words, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (scoresError) {
      return res.status(500).json({ error: scoresError.message });
    }

    return res.status(200).json({
      stages: (stageScores || []).map((s) => ({
        stage: s.stage,
        grammarScore: s.grammar_score,
        fluencyScore: s.fluency_score,
        vocabularyScore: s.vocabulary_score,
        responseCount: s.response_count,
        avgResponseWords: s.avg_response_words,
      })),
    });
  } catch (err) {
    console.error('Stage scores error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// PUT /:id/pause
// ============================================================================

/**
 * Pause (save-and-exit) an active session.
 * Increments resumed_count so we can track how often students pause.
 *
 * Returns: { session: { id, pausedAt } }
 */
router.put('/:id/pause', optionalAuth, async (req, res) => {
  try {
    const { id: sessionId } = req.params;

    // Fetch current session to get current resumed_count
    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('id, is_complete, paused_at, resumed_count')
      .eq('id', sessionId)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.is_complete) {
      return res.status(400).json({ error: 'Cannot pause a completed session' });
    }

    const pausedAt = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from('sessions')
      .update({
        paused_at: pausedAt,
        // Increment resumed_count to track how many times this session was paused.
        // On resume this counter is NOT reset — it acts as a total pause count.
        resumed_count: (session.resumed_count ?? 0) + 1,
      })
      .eq('id', sessionId)
      .select('id, paused_at, resumed_count')
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({
      session: {
        id: updated.id,
        pausedAt: updated.paused_at,
        resumedCount: updated.resumed_count,
      },
    });
  } catch (err) {
    console.error('Pause session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// PUT /:id/resume
// ============================================================================

/**
 * Resume a paused session (clears paused_at).
 *
 * Returns: { session: { id, resumedAt } }
 */
router.put('/:id/resume', optionalAuth, async (req, res) => {
  try {
    const { id: sessionId } = req.params;

    // Verify session exists and is actually paused
    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('id, is_complete, paused_at')
      .eq('id', sessionId)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.is_complete) {
      return res.status(400).json({ error: 'Cannot resume a completed session' });
    }

    if (!session.paused_at) {
      return res.status(400).json({ error: 'Session is not paused' });
    }

    const { data: updated, error: updateError } = await supabase
      .from('sessions')
      .update({ paused_at: null })
      .eq('id', sessionId)
      .select('id, stage, paused_at')
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({
      session: {
        id: updated.id,
        stage: updated.stage,
        resumedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Resume session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET /student/:studentId/highlights
// ============================================================================

/**
 * Get thinking highlights from a student's recent sessions.
 * Returns notable quotes, deep thinking moments, and growth indicators
 * for the parent "What my child said today" card.
 *
 * Returns: { highlights: [{ sessionId, bookTitle, quote, thinkingDepth, stage, createdAt }], growthSummary }
 */
router.get('/student/:studentId/highlights', optionalAuth, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { limit: rawLimit } = req.query;
    const limit = Math.min(parseInt(rawLimit) || 5, 20);

    // Fetch recent completed sessions with book titles
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, book_id, completed_at, books(title)')
      .eq('student_id', studentId)
      .eq('is_complete', true)
      .order('completed_at', { ascending: false })
      .limit(limit);

    if (sessionsError) {
      return res.status(500).json({ error: sessionsError.message });
    }

    if (!sessions || sessions.length === 0) {
      return res.status(200).json({ highlights: [], growthSummary: null });
    }

    // Fetch student dialogues from those sessions — only student turns with real content
    const sessionIds = sessions.map(s => s.id);
    const { data: dialogues } = await supabase
      .from('dialogues')
      .select('id, session_id, stage, content, created_at')
      .in('session_id', sessionIds)
      .eq('speaker', 'student')
      .order('created_at', { ascending: false });

    // Build a session lookup map
    const sessionMap = {};
    sessions.forEach(s => {
      sessionMap[s.id] = { bookTitle: s.books?.title || 'Unknown Book', completedAt: s.completed_at };
    });

    // Score and rank dialogues by "interestingness"
    const scored = (dialogues || [])
      .filter(d => d.content && d.content.trim().length > 10)
      .map(d => {
        const content = d.content.trim();
        const wordCount = content.split(/\s+/).length;
        let interestScore = 0;

        // Longer responses tend to be more thoughtful
        interestScore += Math.min(wordCount / 5, 10);

        // Presence of reasoning markers
        if (/\b(because|since|so that|that's why|the reason)\b/i.test(content)) interestScore += 5;
        if (/\b(I think|I feel|I believe|in my opinion|I wonder)\b/i.test(content)) interestScore += 4;
        if (/\b(however|but|although|on the other hand)\b/i.test(content)) interestScore += 4;
        if (/\b(reminds me of|similar to|just like|compared to)\b/i.test(content)) interestScore += 3;
        if (/\b(if I were|I would|what if|imagine)\b/i.test(content)) interestScore += 3;

        // Body and conclusion stages are typically deeper
        if (d.stage === 'body' || d.stage === 'conclusion' || d.stage === 'cross_book') interestScore += 2;

        return {
          sessionId: d.session_id,
          bookTitle: sessionMap[d.session_id]?.bookTitle || 'Unknown Book',
          quote: content.length > 200 ? content.substring(0, 200) + '...' : content,
          thinkingDepth: interestScore > 15 ? 'deep' : interestScore > 8 ? 'analytical' : 'developing',
          stage: d.stage,
          createdAt: d.created_at,
          completedAt: sessionMap[d.session_id]?.completedAt,
          _score: interestScore,
        };
      })
      .sort((a, b) => b._score - a._score)
      .slice(0, limit * 2); // Return top highlights

    // Remove internal score from response
    const highlights = scored.map(({ _score, ...rest }) => rest);

    // Build growth summary
    const totalSessions = sessions.length;
    const deepThoughts = highlights.filter(h => h.thinkingDepth === 'deep').length;
    const growthSummary = {
      totalRecentSessions: totalSessions,
      deepThinkingMoments: deepThoughts,
      mostActiveStage: getMostFrequentStage(highlights),
      encouragement: deepThoughts >= 3
        ? 'Your child is showing amazing critical thinking!'
        : deepThoughts >= 1
        ? 'Your child is developing deeper thinking skills.'
        : 'Your child is building a reading habit. Keep encouraging them!',
    };

    return res.status(200).json({ highlights, growthSummary });
  } catch (err) {
    console.error('Highlights error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

function getMostFrequentStage(highlights) {
  const stageCounts = {};
  highlights.forEach(h => {
    stageCounts[h.stage] = (stageCounts[h.stage] || 0) + 1;
  });
  let maxStage = 'body';
  let maxCount = 0;
  Object.entries(stageCounts).forEach(([stage, count]) => {
    if (count > maxCount) { maxStage = stage; maxCount = count; }
  });
  return maxStage;
}

// ============================================================================
// POST /:id/prediction
// ============================================================================

/**
 * Save a student prediction during a session.
 * Body: { predictionText, predictionType, stage, confidenceBefore }
 * Returns: { prediction }
 */
router.post('/:id/prediction', optionalAuth, async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const { predictionText, predictionType, stage, confidenceBefore } = req.body;

    if (!predictionText || !predictionType) {
      return res.status(400).json({ error: 'predictionText and predictionType required' });
    }

    // Fetch session to get student_id and book_id
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('student_id, book_id')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const { savePrediction } = await import('../alice/predictionTracker.js');
    const { prediction, error } = await savePrediction({
      studentId: session.student_id,
      sessionId,
      bookId: session.book_id,
      predictionText,
      predictionType,
      stage: stage || 'body',
      confidenceBefore,
    });

    if (error) {
      return res.status(500).json({ error });
    }

    return res.status(201).json({ prediction });
  } catch (err) {
    console.error('Save prediction error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// PUT /prediction/:predictionId/verify
// ============================================================================

/**
 * Verify a prediction.
 * Body: { wasCorrect, verificationText, confidenceAfter }
 * Returns: { success: true }
 */
router.put('/prediction/:predictionId/verify', optionalAuth, async (req, res) => {
  try {
    const { predictionId } = req.params;
    const { wasCorrect, verificationText, confidenceAfter } = req.body;

    if (wasCorrect === undefined) {
      return res.status(400).json({ error: 'wasCorrect is required' });
    }

    const { verifyPrediction } = await import('../alice/predictionTracker.js');
    const { success, error } = await verifyPrediction(
      predictionId, wasCorrect, verificationText || '', confidenceAfter
    );

    if (!success) {
      return res.status(500).json({ error });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Verify prediction error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET /student/:studentId/portfolio
// ============================================================================

/**
 * Get a student's prediction portfolio.
 * Returns: { portfolio, recentPredictions }
 */
router.get('/student/:studentId/portfolio', optionalAuth, async (req, res) => {
  try {
    const { studentId } = req.params;

    const { getPortfolio } = await import('../alice/predictionTracker.js');
    const result = await getPortfolio(studentId);

    return res.status(200).json(result);
  } catch (err) {
    console.error('Portfolio error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

