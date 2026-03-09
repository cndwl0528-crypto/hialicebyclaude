import express from 'express';
import { supabase } from '../lib/supabase.js';
import { authMiddleware } from '../middleware/auth.js';
import { getAliceResponse } from '../alice/engine.js';
import { extractVocabulary } from '../alice/vocabularyExtractor.js';
import { calculateGrammarScore } from '../alice/levelDetector.js';

const router = express.Router();

/**
 * Optional authentication middleware
 * In development, allows requests without auth header for easier testing
 * In production, requires valid auth token
 */
function optionalAuth(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
    // Skip auth in development mode
    return next();
  }
  // In production, use standard auth middleware
  return authMiddleware(req, res, next);
}

/**
 * POST /start
 * Start a new Q&A session
 * Body: { studentId, bookId }
 * Returns: { session: {...}, message: { speaker: 'alice', content: '...' } }
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

    // Verify book exists
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, title, level')
      .eq('id', bookId)
      .single();

    if (bookError) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Create new session record
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        student_id: studentId,
        book_id: bookId,
        stage: 'title',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (sessionError) {
      return res.status(500).json({ error: sessionError.message });
    }

    // Get first Alice question using the real AI engine
    const aliceResponse = await getAliceResponse({
      bookTitle: book.title,
      studentName: student.name,
      level: student.level,
      stage: 'title',
      turn: 1,
      studentMessage: null,
      conversationHistory: []
    });

    const grammarScore = calculateGrammarScore('', student.level);

    // Insert initial Alice message into dialogues table
    const { error: dialogueError } = await supabase
      .from('dialogues')
      .insert({
        session_id: session.id,
        stage: 'title',
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

/**
 * POST /:id/message
 * Send student response, get Alice reply
 * Body: { content, stage }
 * Returns: { reply: { speaker: 'alice', content: '...' }, stage, turn, vocabulary: [...] }
 */
router.post('/:id/message', optionalAuth, async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const { content, stage } = req.body;

    if (!content || !stage) {
      return res.status(400).json({ error: 'content and stage required' });
    }

    // Get current session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, student_id, book_id, stage')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get student and book details
    const { data: student } = await supabase
      .from('students')
      .select('id, name, level')
      .eq('id', session.student_id)
      .single();

    const { data: book } = await supabase
      .from('books')
      .select('title')
      .eq('id', session.book_id)
      .single();

    // Get conversation history
    const { data: dialogues } = await supabase
      .from('dialogues')
      .select('speaker, content, turn, stage')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    // Calculate current turn number for this stage
    const stageTurns = dialogues?.filter(d => d.stage === stage) || [];
    const currentTurn = Math.floor(stageTurns.length / 2) + 1;

    // Insert student message
    const { error: studentDialogueError } = await supabase
      .from('dialogues')
      .insert({
        session_id: sessionId,
        stage,
        turn: currentTurn,
        speaker: 'student',
        content,
      });

    if (studentDialogueError) {
      console.error('Student dialogue error:', studentDialogueError);
    }

    // Get Alice response using the real AI engine
    const aliceResponse = await getAliceResponse({
      bookTitle: book.title,
      studentName: student.name,
      level: student.level,
      stage,
      turn: currentTurn,
      studentMessage: content,
      conversationHistory: dialogues || []
    });

    // Calculate grammar score for the student's response
    const grammarScore = calculateGrammarScore(content, student.level);

    // Insert Alice message
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

    // Extract vocabulary from student's response using the real extractor
    const extractedWords = extractVocabulary(content, student.level);

    // Insert vocabulary entries for each word
    const vocabularyPromises = extractedWords.map(vocabItem =>
      supabase
        .from('vocabulary')
        .insert({
          student_id: session.student_id,
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
    const vocabulary = vocabResults.map(r => r.data?.[0]).filter(Boolean);

    // Determine if we should advance to the next stage
    // Stage advancement logic:
    // - Title: advance after turn 2-3
    // - Introduction: advance after turn 2-3
    // - Body: advance only after 3 reasons (turn 3)
    // - Conclusion: advance after turn 2-3 (session complete)
    let shouldAdvance = false;
    let nextStage = null;
    const stages = ['title', 'introduction', 'body', 'conclusion'];
    const stageIndex = stages.indexOf(stage);

    // For Body stage, we need exactly 3 turns before advancing
    if (stage === 'body') {
      shouldAdvance = currentTurn >= 3;
    } else {
      // For other stages, advance after 2+ turns
      shouldAdvance = currentTurn >= 2;
    }

    if (shouldAdvance && stageIndex < stages.length - 1) {
      nextStage = stages[stageIndex + 1];
    }

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
      grammarScore: grammarScore,
    });
  } catch (err) {
    console.error('Message error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /:id/complete
 * Complete a session and generate summary
 * Returns: { session: {...}, summary: { levelScore, grammarScore, vocabularyCount } }
 */
router.post('/:id/complete', optionalAuth, async (req, res) => {
  try {
    const { id: sessionId } = req.params;

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get all student dialogues for grammar analysis
    const { data: studentDialogues } = await supabase
      .from('dialogues')
      .select('content')
      .eq('session_id', sessionId)
      .eq('speaker', 'student');

    // Calculate average grammar score from all student responses
    let averageGrammarScore = 0;
    if (studentDialogues && studentDialogues.length > 0) {
      const grammarScores = studentDialogues.map(dialogue =>
        calculateGrammarScore(dialogue.content, session.level || 'intermediate')
      );
      averageGrammarScore = Math.round(
        grammarScores.reduce((a, b) => a + b, 0) / grammarScores.length
      );
    }

    // Count vocabulary for this session (unique words used by student)
    const { data: vocab } = await supabase
      .from('vocabulary')
      .select('id')
      .eq('student_id', session.student_id);

    // Count turns per stage to calculate level score
    const { data: allDialogues } = await supabase
      .from('dialogues')
      .select('stage, turn, speaker')
      .eq('session_id', sessionId);

    // Analyze completion: check if all stages were completed with turns
    const stages = ['title', 'introduction', 'body', 'conclusion'];
    const completedStages = new Set();
    if (allDialogues) {
      allDialogues.forEach(d => {
        if (d.speaker === 'student' && d.turn >= 1) {
          completedStages.add(d.stage);
        }
      });
    }

    const levelScore = Math.round((completedStages.size / stages.length) * 100);

    // Update session with completion time and scores
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        completed_at: new Date().toISOString(),
        grammar_score: averageGrammarScore,
        level_score: levelScore,
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Session update error:', updateError);
    }

    return res.status(200).json({
      session: {
        id: session.id,
        completedAt: new Date().toISOString(),
      },
      summary: {
        levelScore: levelScore,
        grammarScore: averageGrammarScore,
        vocabularyCount: vocab?.length || 0,
      },
    });
  } catch (err) {
    console.error('Complete session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /:id/review
 * Get full session review data
 * Returns: { session, dialogues: [...], vocabulary: [...] }
 */
router.get('/:id/review', optionalAuth, async (req, res) => {
  try {
    const { id: sessionId } = req.params;

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get all dialogues
    const { data: dialogues } = await supabase
      .from('dialogues')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    // Get vocabulary used in this session
    const { data: vocabulary } = await supabase
      .from('vocabulary')
      .select('*')
      .eq('student_id', session.student_id);

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

export default router;
