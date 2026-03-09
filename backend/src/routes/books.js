import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

/**
 * GET /
 * List all books with optional level filter
 * Query: ?level=beginner
 * Returns: { books: [...] }
 */
router.get('/', async (req, res) => {
  try {
    const { level } = req.query;

    let query = supabase
      .from('books')
      .select('id, title, author, level, genre, cover_emoji, description');

    // Apply level filter if provided
    if (level) {
      query = query.eq('level', level.toLowerCase());
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
