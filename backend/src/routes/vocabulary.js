import express from 'express';
import { supabase } from '../lib/supabase.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /:studentId
 * Get all vocabulary for a student with optional session filter
 * Query: ?sessionId=uuid
 * Returns: { vocabulary: [...], stats: { totalWords, newThisWeek, avgMastery } }
 */
router.get('/:studentId', authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { sessionId } = req.query;

    if (!studentId) {
      return res.status(400).json({ error: 'studentId required' });
    }

    // Build query
    let query = supabase
      .from('vocabulary')
      .select('id, student_id, word, context_sentence, synonyms, antonyms, pos, first_used, mastery_level, use_count')
      .eq('student_id', studentId);

    // Filter by session if provided
    if (sessionId) {
      // Get all words used in a specific session via dialogues table
      const { data: sessionDialogues } = await supabase
        .from('dialogues')
        .select('content')
        .eq('session_id', sessionId)
        .eq('speaker', 'student');

      if (sessionDialogues && sessionDialogues.length > 0) {
        const sessionWords = new Set();
        sessionDialogues.forEach(dialogue => {
          const words = dialogue.content.toLowerCase().split(/\s+/).filter(w => w.length > 2);
          words.forEach(w => sessionWords.add(w));
        });

        const { data: vocabulary } = await query;
        const filteredVocab = vocabulary.filter(v => sessionWords.has(v.word.toLowerCase()));

        return res.status(200).json({
          vocabulary: filteredVocab,
          stats: {
            totalWords: filteredVocab.length,
            newThisWeek: filteredVocab.filter(v => {
              const created = new Date(v.first_used);
              const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
              return created > weekAgo;
            }).length,
            avgMastery: filteredVocab.length > 0
              ? Math.round(filteredVocab.reduce((sum, v) => sum + (v.mastery_level || 0), 0) / filteredVocab.length)
              : 0,
          },
        });
      }
    }

    // Get all vocabulary for student
    const { data: vocabulary, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Calculate statistics
    const totalWords = vocabulary?.length || 0;
    const newThisWeek = vocabulary?.filter(v => {
      const created = new Date(v.first_used);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return created > weekAgo;
    }).length || 0;

    const avgMastery = totalWords > 0
      ? Math.round(vocabulary.reduce((sum, v) => sum + (v.mastery_level || 0), 0) / totalWords)
      : 0;

    return res.status(200).json({
      vocabulary: vocabulary || [],
      stats: {
        totalWords,
        newThisWeek,
        avgMastery,
      },
    });
  } catch (err) {
    console.error('Get vocabulary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /:studentId/practice
 * Get vocabulary for spaced repetition practice
 * Returns: { words: [...], stats: { dueCount, reviewCount } }
 */
router.get('/:studentId/practice', authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({ error: 'studentId required' });
    }

    // Get vocabulary due for practice (mastery < 5 and reviewed recently)
    const { data: vocabulary, error } = await supabase
      .from('vocabulary')
      .select('id, word, context_sentence, synonyms, pos, mastery_level, use_count, first_used')
      .eq('student_id', studentId)
      .lt('mastery_level', 5)
      .order('mastery_level', { ascending: true })
      .limit(10);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Count due items (mastery 0-2) vs review items (mastery 3-4)
    const dueCount = vocabulary?.filter(v => v.mastery_level <= 2).length || 0;
    const reviewCount = vocabulary?.filter(v => v.mastery_level > 2).length || 0;

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

/**
 * POST /:studentId/practice
 * Submit practice results and update mastery
 * Body: { wordId, correct: boolean }
 * Returns: { vocabulary: {...}, nextWord: {...} }
 */
router.post('/:studentId/practice', authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { wordId, correct } = req.body;

    if (!studentId || !wordId || correct === undefined) {
      return res.status(400).json({ error: 'studentId, wordId, and correct required' });
    }

    // Get current word
    const { data: vocabulary } = await supabase
      .from('vocabulary')
      .select('*')
      .eq('id', wordId)
      .eq('student_id', studentId)
      .single();

    if (!vocabulary) {
      return res.status(404).json({ error: 'Word not found' });
    }

    // Update mastery based on correct/incorrect
    let newMastery = vocabulary.mastery_level || 0;
    if (correct) {
      newMastery = Math.min(5, newMastery + 1); // Increase up to 5
    } else {
      newMastery = Math.max(0, newMastery - 1); // Decrease down to 0
    }

    // Update vocabulary with new mastery level
    const { data: updated } = await supabase
      .from('vocabulary')
      .update({
        mastery_level: newMastery,
        use_count: (vocabulary.use_count || 0) + 1,
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

/**
 * GET /:studentId/stats
 * Get vocabulary statistics
 * Returns: { stats: { totalWords, masteredWords, reviewDue, byLevel } }
 */
router.get('/:studentId/stats', authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({ error: 'studentId required' });
    }

    // Get all vocabulary for student
    const { data: vocabulary, error } = await supabase
      .from('vocabulary')
      .select('mastery_level')
      .eq('student_id', studentId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const totalWords = vocabulary?.length || 0;
    const masteredWords = vocabulary?.filter(v => v.mastery_level >= 5).length || 0;
    const reviewDue = vocabulary?.filter(v => v.mastery_level < 5).length || 0;

    // Group by mastery level
    const byLevel = {
      0: vocabulary?.filter(v => v.mastery_level === 0).length || 0,
      1: vocabulary?.filter(v => v.mastery_level === 1).length || 0,
      2: vocabulary?.filter(v => v.mastery_level === 2).length || 0,
      3: vocabulary?.filter(v => v.mastery_level === 3).length || 0,
      4: vocabulary?.filter(v => v.mastery_level === 4).length || 0,
      5: vocabulary?.filter(v => v.mastery_level === 5).length || 0,
    };

    return res.status(200).json({
      stats: {
        totalWords,
        masteredWords,
        reviewDue,
        byLevel,
      },
    });
  } catch (err) {
    console.error('Get vocabulary stats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /:id/mastery
 * Update mastery level for a vocabulary word
 * Body: { masteryLevel }
 * Returns: { vocabulary: {...} }
 */
router.put('/:id/mastery', authMiddleware, async (req, res) => {
  try {
    const { id: vocabId } = req.params;
    const { masteryLevel } = req.body;

    if (masteryLevel === undefined || masteryLevel === null) {
      return res.status(400).json({ error: 'masteryLevel required' });
    }

    if (typeof masteryLevel !== 'number' || masteryLevel < 0 || masteryLevel > 5) {
      return res.status(400).json({ error: 'masteryLevel must be a number between 0 and 5' });
    }

    // Update vocabulary mastery level
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

    return res.status(200).json({
      vocabulary,
    });
  } catch (err) {
    console.error('Update mastery error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
