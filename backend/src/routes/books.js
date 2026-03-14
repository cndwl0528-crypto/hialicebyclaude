import express from 'express';
import { supabase } from '../lib/supabase.js';
import { authMiddleware } from '../middleware/auth.js';
import { getRecommendationsForStudent, getSimilarBooksForBook } from '../services/bookRecommender.js';

const router = express.Router();

/**
 * GET /
 * List all books with optional level filter
 * Query: ?level=beginner&search=magic
 * Returns: { books: [...] }
 */
router.get('/', async (req, res) => {
  try {
    const { level, search } = req.query;

    let query = supabase
      .from('books')
      .select('id, title, author, level, genre, cover_emoji, description, synopsis, moral_lesson');

    // Apply level filter if provided
    if (level) {
      query = query.eq('level', level.toLowerCase());
    }

    if (search) {
      const escapedSearch = search.replace(/[%_]/g, '');
      query = query.or(
        [
          `title.ilike.%${escapedSearch}%`,
          `author.ilike.%${escapedSearch}%`,
          `genre.ilike.%${escapedSearch}%`,
          `description.ilike.%${escapedSearch}%`,
          `synopsis.ilike.%${escapedSearch}%`,
          `moral_lesson.ilike.%${escapedSearch}%`,
        ].join(',')
      );
    }

    const { data: books, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      books: books || [],
    });
  } catch (err) {
    console.error('Get books error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /ai-recommendations/:studentId
 *
 * AI-powered personalised book recommendations using theme similarity,
 * difficulty fit, and reading history analysis.
 *
 * Query: ?count=5
 * Returns: { recommendations: [...], studentId }
 */
router.get('/ai-recommendations/:studentId', authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;
    const count = Math.min(parseInt(req.query.count) || 5, 10);

    const recommendations = await getRecommendationsForStudent(studentId, count);

    return res.status(200).json({
      recommendations,
      studentId,
    });
  } catch (err) {
    console.error('AI recommendations error:', err);
    return res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

/**
 * GET /similar/:bookId
 *
 * Find books similar to a given book based on theme and difficulty.
 *
 * Query: ?count=5
 * Returns: { similar: [...], bookId }
 */
router.get('/similar/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;
    const count = Math.min(parseInt(req.query.count) || 5, 10);

    const similar = await getSimilarBooksForBook(bookId, count);

    return res.status(200).json({
      similar,
      bookId,
    });
  } catch (err) {
    console.error('Similar books error:', err);
    return res.status(500).json({ error: 'Failed to find similar books' });
  }
});

/**
 * GET /recommendations/:studentId
 *
 * Returns level-appropriate books the student has not yet completed.
 * Ordered by insertion order (newest additions first via Supabase default).
 * Requires a valid Bearer token.
 *
 * Path params:
 *   studentId {string} — UUID of the student
 *
 * Returns: { recommendations: Book[], studentLevel: string }
 */
router.get('/recommendations/:studentId', authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;

    // 1. Resolve the student's reading level
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('level')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // 2. Collect book IDs the student has already completed
    const { data: completedSessions } = await supabase
      .from('sessions')
      .select('book_id')
      .eq('student_id', studentId)
      .eq('is_complete', true);

    const readBookIds = (completedSessions || [])
      .map((s) => s.book_id)
      .filter(Boolean);

    // 3. Query books that match the student's level and haven't been read
    let query = supabase
      .from('books')
      .select('id, title, author, level, genre, cover_emoji, description, synopsis, moral_lesson')
      .eq('level', student.level)
      .limit(5);

    // Supabase does not support an empty `not in` filter — guard defensively
    if (readBookIds.length > 0) {
      query = query.not('id', 'in', `(${readBookIds.join(',')})`);
    }

    const { data: recommendations, error: booksError } = await query;

    if (booksError) {
      console.error('Recommendations query error:', booksError);
      return res.status(500).json({ error: 'Failed to fetch recommendations' });
    }

    return res.status(200).json({
      recommendations: recommendations || [],
      studentLevel: student.level,
    });
  } catch (err) {
    console.error('Recommendations endpoint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /:id
 * Get single book by ID
 * Returns: { book: {...} }
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Book ID required' });
    }

    const { data: book, error } = await supabase
      .from('books')
      .select('id, title, author, level, genre, cover_emoji, description')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Book not found' });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      book,
    });
  } catch (err) {
    console.error('Get book error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
