import express from 'express';
import { supabase } from '../lib/supabase.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

/**
 * Mock function to get Alice response
 * TODO: Replace with actual Claude API call from alice/engine.js
 */
async function getAliceResponse(bookTitle, studentLevel, stage, turn, studentMessage, conversationHistory) {
  const stageQuestions = {
    title: ["What do you think the title means?", "Why did the author choose this title?", "What did you expect from the title?"],
    introduction: ["Who is the main character?", "Where does the story take place?", "How would you describe the setting?"],
    body: ["What was the most important event?", "Can you give me a reason why?", "What would you do differently?"],
    conclusion: ["What did this book teach you?", "How does it connect to your life?", "Would you recommend it?"]
  };
  
  const questions = stageQuestions[stage] || stageQuestions.title;
  return {
    content: questions[turn % questions.length],
    grammarScore: Math.floor(Math.random() * 30) + 70
  };
}

/**
 * POST /start
 * Start a new Q&A session
 * Body: { studentId, bookId }
 * Returns: { session: {...}, message: { speaker: 'alice', content: '...' } }
 */
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { studentId, bookId } = req.body;

    if (!studentId || !bookId) {
      return res.status(400).json({ error: 'studentId and bookId required' });
    }

    // Verify student exists and get their level
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

    // Get first Alice question
    const aliceResponse = await getAliceResponse(book.title, student.level, 'title', 0, null, []);

    // Insert initial Alice message into dialogues table
    const { error: dialogueError } = await supabase
      .from('dialogues')
      .insert({
        session_id: session.id,
        stage: 'title',
        turn: 0,
        speaker: 'alice',
        content: aliceResponse.content,
        grammar_score: aliceResponse.grammarScore,
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
router.post('/:id/message', authMiddleware, async (req, res) => {
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
      .select('level')
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
      .select('speaker, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    // Get current turn number for this stage
    const { data: stageTurns } = await supabase
      .from('dialogues')
      .select('turn')
      .eq('session_id', sessionId)
      .eq('stage', stage);

    const currentTurn = (stageTurns?.length || 0) / 2; // Divide by 2 because each exchange has 2 messages

    // Insert student message
    const { error: studentDialogueError } = await supabase
      .from('dialogues')
      .insert({
        session_id: sessionId,
        stage,
        turn: Math.floor(currentTurn),
        speaker: 'student',
        content,
      });

    if (studentDialogueError) {
      console.error('Student dialogue error:', studentDialogueError);
    }

    // Get Alice response
    const aliceResponse = await getAliceResponse(
      book.title,
      student.level,
      stage,
      Math.floor(currentTurn),
      content,
      dialogues || []
    );

    // Insert Alice message
    const { error: aliceDialogueError } = await supabase
      .from('dialogues')
      .insert({
        session_id: sessionId,
        stage,
        turn: Math.floor(currentTurn),
        speaker: 'alice',
        content: aliceResponse.content,
        grammar_score: aliceResponse.grammarScore,
      });

    if (aliceDialogueError) {
      console.error('Alice dialogue error:', aliceDialogueError);
    }

    // Extract and collect vocabulary from student message
    const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const vocabularyPromises = words.map(word =>
      supabase
        .from('vocabulary')
        .insert({
          student_id: session.student_id,
          word,
          context_sentence: content,
          first_used: new Date().toISOString(),
          mastery_level: 1,
          use_count: 1,
        })
        .select()
    );

    const vocabResults = await Promise.all(vocabularyPromises);
    const vocabulary = vocabResults.map(r => r.data?.[0]).filter(Boolean);

    return res.status(200).json({
      reply: {
        speaker: 'alice',
        content: aliceResponse.content,
      },
      stage,
      turn: Math.floor(currentTurn),
      vocabulary,
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
router.post('/:id/complete', authMiddleware, async (req, res) => {
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

    // Get all dialogues for this session
    const { data: dialogues } = await supabase
      .from('dialogues')
      .select('grammar_score')
      .eq('session_id', sessionId)
      .eq('speaker', 'alice');

    // Calculate grammar score (average of all Alice responses)
    const grammarScores = dialogues?.map(d => d.grammar_score).filter(Boolean) || [];
    const averageGrammarScore = grammarScores.length > 0
      ? Math.round(grammarScores.reduce((a, b) => a + b, 0) / grammarScores.length)
      : 0;

    // Count vocabulary for this session
    const { data: vocab } = await supabase
      .from('vocabulary')
      .select('id')
      .eq('student_id', session.student_id);

    // Update session with completion time
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        completed_at: new Date().toISOString(),
        grammar_score: averageGrammarScore,
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
        levelScore: 0, // TODO: Calculate from dialogue quality
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
router.get('/:id/review', authMiddleware, async (req, res) => {
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
