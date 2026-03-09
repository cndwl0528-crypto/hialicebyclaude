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
