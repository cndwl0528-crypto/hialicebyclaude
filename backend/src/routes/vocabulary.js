/**
 * vocabulary.js
 * HiAlice — Vocabulary Routes
 *
 * Manages student vocabulary records and the spaced repetition practice system.
 *
 * Route summary:
 *   GET  /:studentId                      All vocabulary for a student (+ optional ?sessionId filter)
 *   GET  /:studentId/practice             Words due for practice (legacy — returns mastery < 5)
 *   POST /:studentId/practice             Submit practice result, update mastery (legacy)
 *   GET  /:studentId/stats                Vocabulary statistics with weekly growth
 *   GET  /:studentId/due-today            Words due for spaced repetition review today
 *   POST /:studentId/practice-result      Record a spaced repetition attempt
 *   PUT  /:id/mastery                     Manually set mastery level for a word
 */

import express from 'express';
import { supabase } from '../lib/supabase.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// ============================================================================
// CONSTANTS
// ============================================================================

// SM-2 inspired: max interval before re-review (days)
const MAX_INTERVAL_DAYS = 30;

// ============================================================================
// GET /:studentId
// ============================================================================

/**
 * Get all vocabulary for a student.
 * Query: ?sessionId=uuid — filter to words used in a specific session
 *
 * Returns: { vocabulary: [...], stats: { totalWords, newThisWeek, avgMastery } }
 */
router.get('/:studentId', authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { sessionId } = req.query;

    if (!studentId) {
      return res.status(400).json({ error: 'studentId required' });
    }

    let query = supabase
      .from('vocabulary')
      .select(
        'id, student_id, session_id, word, context_sentence, synonyms, antonyms, pos, first_used, last_used, mastery_level, use_count, last_practiced_at, practice_count, correct_count'
      )
      .eq('student_id', studentId)
      .order('first_used', { ascending: false });

    // When a sessionId filter is requested, narrow the result by session_id column.
    // This replaces the old approach of re-scanning dialogues content.
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data: vocabulary, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const totalWords = vocabulary?.length || 0;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newThisWeek =
      vocabulary?.filter((v) => new Date(v.first_used) > weekAgo).length || 0;
    const avgMastery =
      totalWords > 0
        ? Math.round(
            vocabulary.reduce((sum, v) => sum + (v.mastery_level || 0), 0) /
              totalWords
          )
        : 0;

    return res.status(200).json({
      vocabulary: vocabulary || [],
      stats: { totalWords, newThisWeek, avgMastery },
    });
  } catch (err) {
    console.error('Get vocabulary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET /:studentId/due-today
// ============================================================================

/**
 * Get words due for spaced repetition review today.
 * A word is "due" when:
 *   - next_review_at is null (never practiced via SR) OR
 *   - next_review_at <= now()
 *
 * Returns: { words: [...], count }
 */
router.get('/:studentId/due-today', authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({ error: 'studentId required' });
    }

    const now = new Date().toISOString();

    // Words that have a due review date that has arrived
    const { data: dueWords, error: dueError } = await supabase
      .from('vocabulary')
      .select(
        'id, word, context_sentence, synonyms, pos, mastery_level, use_count, last_practiced_at, practice_count, correct_count'
      )
      .eq('student_id', studentId)
      .lte('last_practiced_at', now) // has been practiced, due date passed
      .lt('mastery_level', 5)       // not yet fully mastered
      .order('mastery_level', { ascending: true })
      .limit(20);

    if (dueError) {
      return res.status(500).json({ error: dueError.message });
    }

    // Words never practiced via the spaced repetition log
    const { data: newWords, error: newError } = await supabase
      .from('vocabulary')
      .select(
        'id, word, context_sentence, synonyms, pos, mastery_level, use_count, last_practiced_at, practice_count, correct_count'
      )
      .eq('student_id', studentId)
      .is('last_practiced_at', null)  // never practiced
      .lt('mastery_level', 5)
      .order('first_used', { ascending: true })
      .limit(10);

    if (newError) {
      return res.status(500).json({ error: newError.message });
    }

    // Merge due + new, remove duplicates by id
    const seen = new Set();
    const words = [];

    for (const w of [...(dueWords || []), ...(newWords || [])]) {
      if (!seen.has(w.id)) {
        seen.add(w.id);
        words.push(w);
      }
    }

    return res.status(200).json({
      words,
      count: words.length,
    });
  } catch (err) {
    console.error('Due today error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /:studentId/practice-result
// ============================================================================

/**
 * Record a spaced repetition practice attempt.
 * Uses SM-2 inspired algorithm:
 *   - Correct: intervalDays = max(prev_interval * 2, 1), up to MAX_INTERVAL_DAYS
 *   - Incorrect: intervalDays = 1 (reset)
 *
 * Body: { vocabularyId, isCorrect, responseTimeMs? }
 * Returns: { log, vocabulary, nextReviewAt }
 */
router.post('/:studentId/practice-result', authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { vocabularyId, isCorrect, responseTimeMs } = req.body;

    if (!studentId || !vocabularyId || isCorrect === undefined) {
      return res
        .status(400)
        .json({ error: 'studentId, vocabularyId, and isCorrect are required' });
    }

    // Verify the word belongs to this student
    const { data: vocab, error: vocabError } = await supabase
      .from('vocabulary')
      .select('id, mastery_level, practice_count, correct_count')
      .eq('id', vocabularyId)
      .eq('student_id', studentId)
      .single();

    if (vocabError || !vocab) {
      return res.status(404).json({ error: 'Vocabulary entry not found' });
    }

    // Fetch the most recent practice log entry to read the last interval
    const { data: lastLog } = await supabase
      .from('vocabulary_practice_log')
      .select('interval_days')
      .eq('vocabulary_id', vocabularyId)
      .eq('student_id', studentId)
      .order('practiced_at', { ascending: false })
      .limit(1)
      .single();

    const prevIntervalDays = lastLog?.interval_days ?? 1;

    // SM-2 interval calculation
    let intervalDays;
    if (isCorrect) {
      intervalDays = Math.min(prevIntervalDays * 2, MAX_INTERVAL_DAYS);
    } else {
      intervalDays = 1; // reset on failure
    }

    const nextReviewAt = new Date(
      Date.now() + intervalDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const practicedAt = new Date().toISOString();

    // Insert practice log entry
    const { data: log, error: logError } = await supabase
      .from('vocabulary_practice_log')
      .insert({
        student_id: studentId,
        vocabulary_id: vocabularyId,
        practiced_at: practicedAt,
        is_correct: isCorrect,
        response_time_ms: responseTimeMs ?? null,
        next_review_at: nextReviewAt,
        interval_days: intervalDays,
      })
      .select()
      .single();

    if (logError) {
      return res.status(500).json({ error: logError.message });
    }

    // Update vocabulary record with latest practice metadata
    const newMastery = isCorrect
      ? Math.min(5, (vocab.mastery_level || 1) + 1)
      : Math.max(0, (vocab.mastery_level || 1) - 1);

    const { data: updatedVocab, error: updateError } = await supabase
      .from('vocabulary')
      .update({
        last_practiced_at: practicedAt,
        practice_count: (vocab.practice_count || 0) + 1,
        correct_count: isCorrect
          ? (vocab.correct_count || 0) + 1
          : vocab.correct_count || 0,
        mastery_level: newMastery,
      })
      .eq('id', vocabularyId)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({
      log,
      vocabulary: updatedVocab,
      nextReviewAt,
      intervalDays,
    });
  } catch (err) {
    console.error('Practice result error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET /:studentId/stats
// ============================================================================

/**
 * Get enriched vocabulary statistics for a student.
 *
 * Returns:
 * {
 *   stats: {
 *     totalWords, masteredWords, learningWords, dueToday,
 *     byLevel: { 0..5 },
 *     weeklyGrowth: [{ week: 'YYYY-WW', count }]
 *   }
 * }
 */
router.get('/:studentId/stats', authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({ error: 'studentId required' });
    }

    // All vocabulary for this student
    const { data: vocabulary, error } = await supabase
      .from('vocabulary')
      .select('mastery_level, first_used, last_practiced_at')
      .eq('student_id', studentId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const allVocab = vocabulary || [];
    const totalWords = allVocab.length;
    // mastery >= 4 is considered "mastered" (allows for the new 0-5 range)
    const masteredWords = allVocab.filter((v) => v.mastery_level >= 4).length;
    const learningWords = totalWords - masteredWords;

    // Count due today from the vocabulary table
    const now = new Date();
    const dueToday = allVocab.filter(
      (v) =>
        v.last_practiced_at === null ||
        new Date(v.last_practiced_at) <= now
    ).length;

    // Group by mastery level (0–5)
    const byLevel = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allVocab.forEach((v) => {
      const level = Math.min(5, Math.max(0, v.mastery_level || 0));
      byLevel[level]++;
    });

    // Weekly growth — count new words learned per ISO week (last 8 weeks)
    const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);
    const recentVocab = allVocab.filter(
      (v) => new Date(v.first_used) >= eightWeeksAgo
    );

    const weekMap = {};
    recentVocab.forEach((v) => {
      const date = new Date(v.first_used);
      // ISO week key: YYYY-WW
      const weekKey = getISOWeekKey(date);
      weekMap[weekKey] = (weekMap[weekKey] || 0) + 1;
    });

    // Sort chronologically
    const weeklyGrowth = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, count]) => ({ week, count }));

    return res.status(200).json({
      stats: {
        totalWords,
        masteredWords,
        learningWords,
        dueToday,
        byLevel,
        weeklyGrowth,
      },
    });
  } catch (err) {
    console.error('Get vocabulary stats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET /:studentId/practice (legacy)
// ============================================================================

/**
 * Get vocabulary words due for practice (legacy endpoint).
 * Returns words with mastery < 5, ordered by lowest mastery first.
 * Returns: { words: [...], stats: { dueCount, reviewCount, totalPractice } }
 */
router.get('/:studentId/practice', authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({ error: 'studentId required' });
    }

    const { data: vocabulary, error } = await supabase
      .from('vocabulary')
      .select(
        'id, word, context_sentence, synonyms, pos, mastery_level, use_count, first_used'
      )
      .eq('student_id', studentId)
      .lt('mastery_level', 5)
      .order('mastery_level', { ascending: true })
      .limit(10);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const dueCount = vocabulary?.filter((v) => v.mastery_level <= 2).length || 0;
    const reviewCount = vocabulary?.filter((v) => v.mastery_level > 2).length || 0;

    return res.status(200).json({
      words: vocabulary || [],
      stats: {
        dueCount,
        reviewCount,
        totalPractice: (vocabulary || []).length,
      },
    });
  } catch (err) {
    console.error('Get practice vocabulary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /:studentId/practice (legacy)
// ============================================================================

/**
 * Submit practice results and update mastery (legacy endpoint).
 * Body: { wordId, correct: boolean }
 * Returns: { vocabulary, nextWord, masteryLevel }
 */
router.post('/:studentId/practice', authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { wordId, correct } = req.body;

    if (!studentId || !wordId || correct === undefined) {
      return res
        .status(400)
        .json({ error: 'studentId, wordId, and correct required' });
    }

    const { data: vocabulary } = await supabase
      .from('vocabulary')
      .select('*')
      .eq('id', wordId)
      .eq('student_id', studentId)
      .single();

    if (!vocabulary) {
      return res.status(404).json({ error: 'Word not found' });
    }

    let newMastery = vocabulary.mastery_level || 0;
    if (correct) {
      newMastery = Math.min(5, newMastery + 1);
    } else {
      newMastery = Math.max(0, newMastery - 1);
    }

    const { data: updated } = await supabase
      .from('vocabulary')
      .update({
        mastery_level: newMastery,
        use_count: (vocabulary.use_count || 0) + 1,
        practice_count: (vocabulary.practice_count || 0) + 1,
        correct_count: correct
          ? (vocabulary.correct_count || 0) + 1
          : vocabulary.correct_count || 0,
        last_practiced_at: new Date().toISOString(),
      })
      .eq('id', wordId)
      .select()
      .single();

    // Get next word for practice
    const { data: nextWords } = await supabase
      .from('vocabulary')
      .select('id, word, context_sentence, synonyms, pos, mastery_level')
      .eq('student_id', studentId)
      .lt('mastery_level', 5)
      .neq('id', wordId)
      .order('mastery_level', { ascending: true })
      .limit(1);

    return res.status(200).json({
      vocabulary: updated,
      nextWord: nextWords?.[0] || null,
      masteryLevel: newMastery,
    });
  } catch (err) {
    console.error('Practice vocabulary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// PUT /:id/mastery
// ============================================================================

/**
 * Manually update mastery level for a vocabulary word.
 * Body: { masteryLevel: 0-5 }
 * Returns: { vocabulary }
 */
router.put('/:id/mastery', authMiddleware, async (req, res) => {
  try {
    const { id: vocabId } = req.params;
    const { masteryLevel } = req.body;

    if (masteryLevel === undefined || masteryLevel === null) {
      return res.status(400).json({ error: 'masteryLevel required' });
    }

    if (typeof masteryLevel !== 'number' || masteryLevel < 0 || masteryLevel > 5) {
      return res
        .status(400)
        .json({ error: 'masteryLevel must be a number between 0 and 5' });
    }

    const { data: vocabulary, error } = await supabase
      .from('vocabulary')
      .update({ mastery_level: masteryLevel })
      .eq('id', vocabId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Vocabulary entry not found' });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ vocabulary });
  } catch (err) {
    console.error('Update mastery error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Returns a sortable ISO week key string: 'YYYY-WW'.
 * Week 1 is the first week of the year that contains Thursday (ISO 8601).
 *
 * @param {Date} date
 * @returns {string}
 */
function getISOWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday (week starts on Monday per ISO 8601)
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
}

export default router;
