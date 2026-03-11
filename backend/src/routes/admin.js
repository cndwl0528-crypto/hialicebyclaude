import express from 'express';
import { supabase } from '../lib/supabase.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import { getAliceResponse } from '../alice/engine.js';
import { getStudentAchievements } from '../lib/achievements.js';

const router = express.Router();

/**
 * Admin authentication middleware chain.
 *
 * Development  — skips token verification for easier local testing.
 * Production   — verifies JWT via authMiddleware, then enforces admin/super_admin
 *                role via requireAdmin.
 *
 * Usage: router.get('/path', adminAuth, handler)
 */
function optionalAdminAuth(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
    // Skip auth in development mode for easier local testing.
    return next();
  }
  // In production, verify token then enforce admin role.
  authMiddleware(req, res, (err) => {
    if (err) return next(err);
    requireAdmin(req, res, next);
  });
}

/**
 * Helper: Calculate statistics for a student
 */
async function getStudentStats(studentId) {
  try {
    // Get session count
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, grammar_score, level_score, completed_at')
      .eq('student_id', studentId);

    // Get vocabulary count
    const { data: vocab } = await supabase
      .from('vocabulary')
      .select('id')
      .eq('student_id', studentId);

    // Calculate averages
    const completedSessions = sessions?.filter(s => s.completed_at) || [];
    const avgGrammarScore = completedSessions.length > 0
      ? Math.round(completedSessions.reduce((sum, s) => sum + (s.grammar_score || 0), 0) / completedSessions.length)
      : 0;

    // Get last active date
    const lastActive = sessions?.[sessions.length - 1]?.completed_at || null;

    return {
      booksRead: completedSessions.length,
      averageGrammarScore: avgGrammarScore,
      lastActive,
      vocabularyCount: vocab?.length || 0,
      totalSessions: sessions?.length || 0,
    };
  } catch (err) {
    console.error('Error calculating student stats:', err);
    return {
      booksRead: 0,
      averageGrammarScore: 0,
      lastActive: null,
      vocabularyCount: 0,
      totalSessions: 0,
    };
  }
}

/**
 * Helper: Calculate weekly session count for last 4 weeks
 */
async function getSessionsPerWeek() {
  try {
    const { data: sessions } = await supabase
      .from('sessions')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString());

    const weekData = [0, 0, 0, 0];
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    sessions?.forEach(session => {
      const sessionTime = new Date(session.created_at).getTime();
      const weekIndex = Math.floor((now - sessionTime) / oneWeek);
      if (weekIndex < 4) {
        weekData[3 - weekIndex]++;
      }
    });

    return weekData;
  } catch (err) {
    console.error('Error calculating sessions per week:', err);
    return [0, 0, 0, 0];
  }
}

/**
 * Helper: Get level distribution
 */
async function getLevelDistribution() {
  try {
    const { data: students } = await supabase
      .from('students')
      .select('level');

    const distribution = {
      beginner: 0,
      intermediate: 0,
      advanced: 0,
    };

    students?.forEach(student => {
      distribution[student.level]++;
    });

    return distribution;
  } catch (err) {
    console.error('Error calculating level distribution:', err);
    return { beginner: 0, intermediate: 0, advanced: 0 };
  }
}

// ============================================================================
// DASHBOARD ENDPOINTS
// ============================================================================

/**
 * GET /dashboard
 * Get admin dashboard overview with key metrics
 * Returns: { totalStudents, totalBooks, activeSessions, avgGrammarScore, recentSessions, sessionsPerWeek, levelDistribution }
 */
router.get('/dashboard', optionalAdminAuth, async (req, res) => {
  try {
    // Get total students
    const { data: students } = await supabase
      .from('students')
      .select('id', { count: 'exact' });

    // Get total books
    const { data: books } = await supabase
      .from('books')
      .select('id', { count: 'exact' });

    // Get active sessions (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: activeSessions } = await supabase
      .from('sessions')
      .select('id')
      .gte('created_at', sevenDaysAgo);

    // Get all completed sessions for average grammar score
    const { data: completedSessions } = await supabase
      .from('sessions')
      .select('grammar_score')
      .not('grammar_score', 'is', null);

    const avgGrammarScore = completedSessions && completedSessions.length > 0
      ? Math.round(completedSessions.reduce((sum, s) => sum + (s.grammar_score || 0), 0) / completedSessions.length)
      : 0;

    // Get recent sessions (last 10) with details
    const { data: recentSessionsData } = await supabase
      .from('sessions')
      .select(`
        id,
        created_at,
        grammar_score,
        level_score,
        student_id,
        book_id,
        students!inner(name),
        books!inner(title)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    const recentSessions = recentSessionsData?.map(s => ({
      id: s.id,
      studentName: s.students.name,
      bookTitle: s.books.title,
      grammarScore: s.grammar_score,
      levelScore: s.level_score,
      date: s.created_at,
    })) || [];

    // Get sessions per week
    const sessionsPerWeek = await getSessionsPerWeek();

    // Get level distribution
    const levelDistribution = await getLevelDistribution();

    return res.status(200).json({
      success: true,
      data: {
        totalStudents: students?.length || 0,
        totalBooks: books?.length || 0,
        activeSessions: activeSessions?.length || 0,
        avgGrammarScore,
        recentSessions,
        sessionsPerWeek,
        levelDistribution,
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ============================================================================
// STUDENT MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /students
 * List all students with computed stats
 * Returns: { students: [{ id, name, age, level, booksRead, averageGrammarScore, lastActive, vocabularyCount }] }
 */
router.get('/students', optionalAdminAuth, async (req, res) => {
  try {
    const { data: students, error } = await supabase
      .from('students')
      .select('id, name, age, level, created_at');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Enrich each student with computed stats
    const enrichedStudents = await Promise.all(
      students?.map(async (student) => {
        const stats = await getStudentStats(student.id);
        return {
          id: student.id,
          name: student.name,
          age: student.age,
          level: student.level,
          createdAt: student.created_at,
          ...stats,
        };
      }) || []
    );

    return res.status(200).json({
      success: true,
      data: {
        students: enrichedStudents,
      },
    });
  } catch (err) {
    console.error('Get students error:', err);
    return res.status(500).json({ error: 'Failed to fetch students' });
  }
});

/**
 * GET /students/:id
 * Get single student with full details
 * Returns: { student: { id, name, age, level, ...stats, sessions: [...], vocabulary: [...] } }
 */
router.get('/students/:id', optionalAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Student ID required' });
    }

    // Get student
    const { data: student, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Student not found' });
      }
      return res.status(500).json({ error: error.message });
    }

    // Get student stats
    const stats = await getStudentStats(id);

    // Get sessions
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, book_id, stage, status, created_at, completed_at, grammar_score, level_score, books!inner(title)')
      .eq('student_id', id)
      .order('created_at', { ascending: false });

    // Get vocabulary
    const { data: vocabulary } = await supabase
      .from('vocabulary')
      .select('id, word, pos, mastery_level, use_count, first_used')
      .eq('student_id', id)
      .order('first_used', { ascending: false });

    return res.status(200).json({
      success: true,
      data: {
        student: {
          ...student,
          ...stats,
          sessions: sessions?.map(s => ({
            id: s.id,
            bookTitle: s.books.title,
            stage: s.stage,
            status: s.status,
            createdAt: s.created_at,
            completedAt: s.completed_at,
            grammarScore: s.grammar_score,
            levelScore: s.level_score,
          })) || [],
          vocabulary,
        },
      },
    });
  } catch (err) {
    console.error('Get student error:', err);
    return res.status(500).json({ error: 'Failed to fetch student' });
  }
});

/**
 * POST /students
 * Create new student
 * Body: { name, age, level, parent_id }
 * Returns: { success: true, data: { student } }
 */
router.post('/students', optionalAdminAuth, async (req, res) => {
  try {
    const { name, age, level, parent_id } = req.body;

    // Validation
    if (!name || age === undefined || !level || !parent_id) {
      return res.status(400).json({ error: 'name, age, level, and parent_id are required' });
    }

    if (age < 6 || age > 13) {
      return res.status(400).json({ error: 'Age must be between 6 and 13' });
    }

    if (!['beginner', 'intermediate', 'advanced'].includes(level)) {
      return res.status(400).json({ error: 'Invalid level' });
    }

    // Verify parent exists
    const { data: parent, error: parentError } = await supabase
      .from('parents')
      .select('id')
      .eq('id', parent_id)
      .single();

    if (parentError || !parent) {
      return res.status(400).json({ error: 'Parent not found' });
    }

    // Create student
    const { data: student, error } = await supabase
      .from('students')
      .insert({
        name,
        age,
        level,
        parent_id,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({
      success: true,
      data: {
        student,
      },
    });
  } catch (err) {
    console.error('Create student error:', err);
    return res.status(500).json({ error: 'Failed to create student' });
  }
});

/**
 * PUT /students/:id
 * Update student
 * Body: { name, age, level }
 * Returns: { success: true, data: { student } }
 */
router.put('/students/:id', optionalAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, age, level } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Student ID required' });
    }

    // Build update object with only provided fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (age !== undefined) {
      if (age < 6 || age > 13) {
        return res.status(400).json({ error: 'Age must be between 6 and 13' });
      }
      updateData.age = age;
    }
    if (level !== undefined) {
      if (!['beginner', 'intermediate', 'advanced'].includes(level)) {
        return res.status(400).json({ error: 'Invalid level' });
      }
      updateData.level = level;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data: student, error } = await supabase
      .from('students')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Student not found' });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      data: {
        student,
      },
    });
  } catch (err) {
    console.error('Update student error:', err);
    return res.status(500).json({ error: 'Failed to update student' });
  }
});

/**
 * DELETE /students/:id
 * Soft delete or hard delete student
 * Returns: { success: true }
 */
router.delete('/students/:id', optionalAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Student ID required' });
    }

    // Check if student exists
    const { data: student, error: checkError } = await supabase
      .from('students')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Perform hard delete (cascades to related records)
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Student deleted successfully',
    });
  } catch (err) {
    console.error('Delete student error:', err);
    return res.status(500).json({ error: 'Failed to delete student' });
  }
});

// ============================================================================
// BOOK MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /books
 * List all books with session counts
 * Returns: { books: [{ id, title, author, level, genre, sessionCount }] }
 */
router.get('/books', optionalAdminAuth, async (req, res) => {
  try {
    const { data: books, error } = await supabase
      .from('books')
      .select('id, title, author, level, genre, cover_emoji, description, page_count, published_year, is_active');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Enrich with session counts
    const enrichedBooks = await Promise.all(
      books?.map(async (book) => {
        const { data: sessions } = await supabase
          .from('sessions')
          .select('id', { count: 'exact' })
          .eq('book_id', book.id);

        return {
          ...book,
          sessionCount: sessions?.length || 0,
        };
      }) || []
    );

    return res.status(200).json({
      success: true,
      data: {
        books: enrichedBooks,
      },
    });
  } catch (err) {
    console.error('Get books error:', err);
    return res.status(500).json({ error: 'Failed to fetch books' });
  }
});

/**
 * POST /books
 * Create new book
 * Body: { title, author, level, genre, cover_emoji, description, page_count, published_year }
 * Returns: { success: true, data: { book } }
 */
router.post('/books', optionalAdminAuth, async (req, res) => {
  try {
    const { title, author, level, genre, cover_emoji, description, page_count, published_year } = req.body;

    // Validation
    if (!title || !author || !level || !cover_emoji || !description) {
      return res.status(400).json({ error: 'title, author, level, cover_emoji, and description are required' });
    }

    if (!['beginner', 'intermediate', 'advanced'].includes(level)) {
      return res.status(400).json({ error: 'Invalid level' });
    }

    // Create book
    const { data: book, error } = await supabase
      .from('books')
      .insert({
        title,
        author,
        level,
        genre: genre || null,
        cover_emoji,
        description,
        page_count: page_count || 1,
        published_year: published_year || null,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({
      success: true,
      data: {
        book,
      },
    });
  } catch (err) {
    console.error('Create book error:', err);
    return res.status(500).json({ error: 'Failed to create book' });
  }
});

/**
 * PUT /books/:id
 * Update book
 * Body: { title, author, level, genre, cover_emoji, description, page_count, published_year, is_active }
 * Returns: { success: true, data: { book } }
 */
router.put('/books/:id', optionalAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, level, genre, cover_emoji, description, page_count, published_year, is_active } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Book ID required' });
    }

    // Build update object
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (author !== undefined) updateData.author = author;
    if (level !== undefined) {
      if (!['beginner', 'intermediate', 'advanced'].includes(level)) {
        return res.status(400).json({ error: 'Invalid level' });
      }
      updateData.level = level;
    }
    if (genre !== undefined) updateData.genre = genre;
    if (cover_emoji !== undefined) updateData.cover_emoji = cover_emoji;
    if (description !== undefined) updateData.description = description;
    if (page_count !== undefined) updateData.page_count = page_count;
    if (published_year !== undefined) updateData.published_year = published_year;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data: book, error } = await supabase
      .from('books')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Book not found' });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      data: {
        book,
      },
    });
  } catch (err) {
    console.error('Update book error:', err);
    return res.status(500).json({ error: 'Failed to update book' });
  }
});

/**
 * DELETE /books/:id
 * Delete book
 * Returns: { success: true }
 */
router.delete('/books/:id', optionalAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Book ID required' });
    }

    // Check if book exists
    const { data: book, error: checkError } = await supabase
      .from('books')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Delete book (cascades to sessions)
    const { error } = await supabase
      .from('books')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Book deleted successfully',
    });
  } catch (err) {
    console.error('Delete book error:', err);
    return res.status(500).json({ error: 'Failed to delete book' });
  }
});

// ============================================================================
// REPORT ENDPOINTS
// ============================================================================

/**
 * GET /reports/student/:id
 * Get comprehensive student report
 * Returns: { student, sessionsHistory, vocabularyGrowth, grammarTrend, topWords, weakAreas }
 */
router.get('/reports/student/:id', optionalAdminAuth, async (req, res) => {
  try {
    const { id: studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({ error: 'Student ID required' });
    }

    // Get student
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, age, level, created_at')
      .eq('id', studentId)
      .single();

    if (studentError) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get all sessions with books
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, book_id, stage, status, created_at, completed_at, grammar_score, level_score, books!inner(title, level)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true });

    // Get vocabulary with growth over time
    const { data: vocabulary } = await supabase
      .from('vocabulary')
      .select('id, word, pos, mastery_level, use_count, first_used, synonyms')
      .eq('student_id', studentId)
      .order('first_used', { ascending: true });

    // Calculate grammar trend (by month)
    const grammarTrend = {};
    sessions?.forEach(session => {
      if (session.grammar_score) {
        const monthKey = new Date(session.created_at).toISOString().substring(0, 7); // YYYY-MM
        if (!grammarTrend[monthKey]) {
          grammarTrend[monthKey] = { scores: [], average: 0 };
        }
        grammarTrend[monthKey].scores.push(session.grammar_score);
        grammarTrend[monthKey].average = Math.round(
          grammarTrend[monthKey].scores.reduce((a, b) => a + b) / grammarTrend[monthKey].scores.length
        );
      }
    });

    // Top 10 vocabulary words
    const topWords = vocabulary
      ?.sort((a, b) => b.use_count - a.use_count)
      .slice(0, 10)
      .map(v => ({
        word: v.word,
        pos: v.pos,
        useCount: v.use_count,
        masteryLevel: v.mastery_level,
      })) || [];

    // Vocabulary growth (words per week)
    const vocabGrowth = {};
    vocabulary?.forEach(v => {
      const weekKey = new Date(v.first_used).toISOString().substring(0, 10); // YYYY-MM-DD
      vocabGrowth[weekKey] = (vocabGrowth[weekKey] || 0) + 1;
    });

    // Identify weak areas (low mastery words)
    const weakAreas = vocabulary
      ?.filter(v => v.mastery_level <= 2)
      .sort((a, b) => a.mastery_level - b.mastery_level)
      .slice(0, 10)
      .map(v => ({
        word: v.word,
        masteryLevel: v.mastery_level,
        pos: v.pos,
      })) || [];

    return res.status(200).json({
      success: true,
      data: {
        student,
        sessionsHistory: sessions?.map(s => ({
          id: s.id,
          bookTitle: s.books.title,
          bookLevel: s.books.level,
          stage: s.stage,
          status: s.status,
          createdAt: s.created_at,
          completedAt: s.completed_at,
          grammarScore: s.grammar_score,
          levelScore: s.level_score,
        })) || [],
        vocabularyGrowth: vocabGrowth,
        grammarTrend,
        topWords,
        weakAreas,
      },
    });
  } catch (err) {
    console.error('Student report error:', err);
    return res.status(500).json({ error: 'Failed to generate student report' });
  }
});

/**
 * GET /reports/overview
 * Get class overview report
 * Returns: { averageScoresByLevel, completionRates, vocabularyStats }
 */
router.get('/reports/overview', optionalAdminAuth, async (req, res) => {
  try {
    // Get all students grouped by level
    const { data: students } = await supabase
      .from('students')
      .select('id, level');

    // Get all sessions
    const { data: sessions } = await supabase
      .from('sessions')
      .select('student_id, grammar_score, level_score, status, students!inner(level)');

    // Get all vocabulary
    const { data: allVocabulary } = await supabase
      .from('vocabulary')
      .select('id');

    // Calculate averages by level
    const averageScoresByLevel = {
      beginner: { grammarScore: 0, levelScore: 0, sessionCount: 0 },
      intermediate: { grammarScore: 0, levelScore: 0, sessionCount: 0 },
      advanced: { grammarScore: 0, levelScore: 0, sessionCount: 0 },
    };

    sessions?.forEach(session => {
      const level = session.students.level;
      if (session.grammar_score) {
        averageScoresByLevel[level].grammarScore += session.grammar_score;
      }
      if (session.level_score) {
        averageScoresByLevel[level].levelScore += session.level_score;
      }
      averageScoresByLevel[level].sessionCount++;
    });

    // Finalize averages
    Object.keys(averageScoresByLevel).forEach(level => {
      const count = averageScoresByLevel[level].sessionCount;
      if (count > 0) {
        averageScoresByLevel[level].grammarScore = Math.round(averageScoresByLevel[level].grammarScore / count);
        averageScoresByLevel[level].levelScore = Math.round(averageScoresByLevel[level].levelScore / count);
      }
    });

    // Calculate completion rates
    const completionRates = {};
    Object.keys(averageScoresByLevel).forEach(level => {
      const completed = sessions?.filter(s => s.students.level === level && s.status === 'completed').length || 0;
      const total = sessions?.filter(s => s.students.level === level).length || 1;
      completionRates[level] = Math.round((completed / total) * 100);
    });

    // Vocabulary statistics
    const vocabularyStats = {
      totalUnique: allVocabulary?.length || 0,
      averagePerStudent: students && students.length > 0
        ? Math.round((allVocabulary?.length || 0) / students.length)
        : 0,
      byLevel: {
        beginner: students?.filter(s => s.level === 'beginner').length || 0,
        intermediate: students?.filter(s => s.level === 'intermediate').length || 0,
        advanced: students?.filter(s => s.level === 'advanced').length || 0,
      },
    };

    return res.status(200).json({
      success: true,
      data: {
        averageScoresByLevel,
        completionRates,
        vocabularyStats,
        totalStudents: students?.length || 0,
        totalSessions: sessions?.length || 0,
      },
    });
  } catch (err) {
    console.error('Overview report error:', err);
    return res.status(500).json({ error: 'Failed to generate overview report' });
  }
});

/**
 * GET /reports/export
 * Export all data as JSON
 * Returns: { students, books, sessions, vocabulary }
 */
router.get('/reports/export', optionalAdminAuth, async (req, res) => {
  try {
    const { data: students } = await supabase
      .from('students')
      .select('*');

    const { data: books } = await supabase
      .from('books')
      .select('*');

    const { data: sessions } = await supabase
      .from('sessions')
      .select('*');

    const { data: vocabulary } = await supabase
      .from('vocabulary')
      .select('*');

    return res.status(200).json({
      success: true,
      data: {
        export: {
          timestamp: new Date().toISOString(),
          students: students || [],
          books: books || [],
          sessions: sessions || [],
          vocabulary: vocabulary || [],
        },
      },
    });
  } catch (err) {
    console.error('Export error:', err);
    return res.status(500).json({ error: 'Failed to export data' });
  }
});

// ============================================================================
// PROMPT MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /prompts
 * Get current prompt templates (system prompts for HiAlice)
 * Returns: { prompts: { title, introduction, body, conclusion } }
 */
router.get('/prompts', optionalAdminAuth, async (req, res) => {
  try {
    // For now, return default prompts. In production, these would be stored in a table
    const defaultPrompts = {
      title: {
        stage: 'title',
        description: 'Explore book title and first impressions',
        template: 'You are HiAlice, a warm and encouraging English teacher. Ask the student about the book title and their first impressions.',
      },
      introduction: {
        stage: 'introduction',
        description: 'Understand background and main characters',
        template: 'You are HiAlice. Ask the student about the main character and the book\'s background.',
      },
      body: {
        stage: 'body',
        description: 'Guide student to provide 3 reasons/supporting details',
        template: 'You are HiAlice. Ask the student to explain their thoughts with 3 specific reasons or examples from the book.',
      },
      conclusion: {
        stage: 'conclusion',
        description: 'Explore personal interpretation and recommendation',
        template: 'You are HiAlice. Ask the student what they learned and if they would recommend the book to others.',
      },
    };

    return res.status(200).json({
      success: true,
      data: {
        prompts: defaultPrompts,
      },
    });
  } catch (err) {
    console.error('Get prompts error:', err);
    return res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

/**
 * PUT /prompts
 * Update prompt templates
 * Body: { title, introduction, body, conclusion } (each with template string)
 * Returns: { success: true, data: { prompts } }
 */
router.put('/prompts', optionalAdminAuth, async (req, res) => {
  try {
    const { title, introduction, body, conclusion } = req.body;

    // Validation
    if (!title || !introduction || !body || !conclusion) {
      return res.status(400).json({ error: 'All stages (title, introduction, body, conclusion) are required' });
    }

    // In a real system, these would be stored in a database
    // For now, we'll just validate and return them
    const updatedPrompts = {
      title: { stage: 'title', template: title },
      introduction: { stage: 'introduction', template: introduction },
      body: { stage: 'body', template: body },
      conclusion: { stage: 'conclusion', template: conclusion },
    };

    return res.status(200).json({
      success: true,
      data: {
        prompts: updatedPrompts,
        message: 'Prompts updated successfully (in-memory storage)',
      },
    });
  } catch (err) {
    console.error('Update prompts error:', err);
    return res.status(500).json({ error: 'Failed to update prompts' });
  }
});

// ============================================================================
// STUDENT ANALYTICS ENDPOINT
// ============================================================================

/**
 * GET /students/:id/analytics
 * Deep analytics view for a single student.
 *
 * Returns:
 * {
 *   student: { name, level, streak, totalBooks, totalWords },
 *   sessions: [...last 10 sessions with stage scores],
 *   vocabulary: { total, mastered, learning, recentWords: [] },
 *   achievements: [...earned badges],
 *   weeklyProgress: [{ week, booksRead, wordsLearned, avgGrammar }],
 *   stageBreakdown: { title: avgScore, introduction: avgScore, body: avgScore, conclusion: avgScore }
 * }
 */
router.get('/students/:id/analytics', optionalAdminAuth, async (req, res) => {
  try {
    const { id: studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({ error: 'Student ID required' });
    }

    // ── 1. Fetch student profile ───────────────────────────────────────────
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, age, level, avatar_emoji, current_streak, total_books_read, total_words_learned, last_session_date, created_at')
      .eq('id', studentId)
      .single();

    if (studentError) {
      if (studentError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Student not found' });
      }
      return res.status(500).json({ error: studentError.message });
    }

    // ── 2. Last 10 sessions with per-stage scores ──────────────────────────
    const { data: recentSessions } = await supabase
      .from('sessions')
      .select('id, started_at, completed_at, grammar_score, level_score, is_complete, books(title, level)')
      .eq('student_id', studentId)
      .order('started_at', { ascending: false })
      .limit(10);

    // Fetch stage scores for each recent session in parallel
    const sessionsWithStages = await Promise.all(
      (recentSessions || []).map(async (session) => {
        const { data: stageScores } = await supabase
          .from('session_stage_scores')
          .select('stage, grammar_score, fluency_score, vocabulary_score, response_count, avg_response_words')
          .eq('session_id', session.id);

        return {
          id: session.id,
          bookTitle: session.books?.title || null,
          bookLevel: session.books?.level || null,
          startedAt: session.started_at,
          completedAt: session.completed_at,
          grammarScore: session.grammar_score,
          levelScore: session.level_score,
          isComplete: session.is_complete,
          stageScores: stageScores || [],
        };
      })
    );

    // ── 3. Vocabulary summary ──────────────────────────────────────────────
    const { data: allVocab } = await supabase
      .from('vocabulary')
      .select('id, word, pos, mastery_level, use_count, first_used')
      .eq('student_id', studentId)
      .order('first_used', { ascending: false });

    const vocabData = allVocab || [];
    const totalVocab = vocabData.length;
    const masteredVocab = vocabData.filter((v) => v.mastery_level >= 4).length;
    const learningVocab = totalVocab - masteredVocab;
    // 10 most recently learned words
    const recentWords = vocabData.slice(0, 10).map((v) => ({
      word: v.word,
      pos: v.pos,
      masteryLevel: v.mastery_level,
      useCount: v.use_count,
      firstUsed: v.first_used,
    }));

    // ── 4. Achievements ────────────────────────────────────────────────────
    const achievements = await getStudentAchievements(supabase, studentId);

    // ── 5. Weekly progress (last 8 weeks) ─────────────────────────────────
    // We need all sessions (not just the last 10) to calculate weekly stats
    const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: allSessions } = await supabase
      .from('sessions')
      .select('id, started_at, grammar_score, is_complete')
      .eq('student_id', studentId)
      .gte('started_at', eightWeeksAgo)
      .eq('is_complete', true);

    // Group sessions by ISO week
    const weekSessionMap = {};
    (allSessions || []).forEach((session) => {
      const weekKey = getISOWeekKey(new Date(session.started_at));
      if (!weekSessionMap[weekKey]) {
        weekSessionMap[weekKey] = { booksRead: 0, grammarScores: [] };
      }
      weekSessionMap[weekKey].booksRead++;
      if (session.grammar_score != null) {
        weekSessionMap[weekKey].grammarScores.push(session.grammar_score);
      }
    });

    // Group vocabulary additions by the same ISO weeks
    const weekVocabMap = {};
    vocabData
      .filter((v) => new Date(v.first_used) >= new Date(eightWeeksAgo))
      .forEach((v) => {
        const weekKey = getISOWeekKey(new Date(v.first_used));
        weekVocabMap[weekKey] = (weekVocabMap[weekKey] || 0) + 1;
      });

    // Merge into a unified weekly progress array, sorted chronologically
    const allWeekKeys = new Set([
      ...Object.keys(weekSessionMap),
      ...Object.keys(weekVocabMap),
    ]);

    const weeklyProgress = Array.from(allWeekKeys)
      .sort()
      .map((week) => {
        const sessData = weekSessionMap[week] || { booksRead: 0, grammarScores: [] };
        const avgGrammar =
          sessData.grammarScores.length > 0
            ? Math.round(
                sessData.grammarScores.reduce((a, b) => a + b, 0) /
                  sessData.grammarScores.length
              )
            : 0;
        return {
          week,
          booksRead: sessData.booksRead,
          wordsLearned: weekVocabMap[week] || 0,
          avgGrammar,
        };
      });

    // ── 6. Stage breakdown — average scores across all sessions ───────────
    const stages = ['title', 'introduction', 'body', 'conclusion'];

    // Fetch all stage scores for this student's sessions
    const { data: allSessionIds } = await supabase
      .from('sessions')
      .select('id')
      .eq('student_id', studentId)
      .eq('is_complete', true);

    const sessionIdList = (allSessionIds || []).map((s) => s.id);

    let stageBreakdown = {
      title: 0,
      introduction: 0,
      body: 0,
      conclusion: 0,
    };

    if (sessionIdList.length > 0) {
      const { data: allStageScores } = await supabase
        .from('session_stage_scores')
        .select('stage, grammar_score')
        .in('session_id', sessionIdList);

      // Average grammar_score per stage
      const stageTotals = {};
      const stageCounts = {};

      (allStageScores || []).forEach((row) => {
        if (row.grammar_score == null) return;
        stageTotals[row.stage] = (stageTotals[row.stage] || 0) + row.grammar_score;
        stageCounts[row.stage] = (stageCounts[row.stage] || 0) + 1;
      });

      stages.forEach((stage) => {
        stageBreakdown[stage] =
          stageCounts[stage] > 0
            ? Math.round(stageTotals[stage] / stageCounts[stage])
            : 0;
      });
    }

    // ── 7. Bloom's cognitive distribution ──────────────────────────────────
    let bloomDistribution = { remember: 0, understand: 0, apply: 0, analyze: 0, evaluate: 0, create: 0 };
    let higherOrderRatio = 0;
    let avgThinkingMomentum = null;

    if (sessionIdList.length > 0) {
      // Get all dialogue IDs for this student's sessions
      const { data: studentDialogues } = await supabase
        .from('dialogues')
        .select('id')
        .in('session_id', sessionIdList)
        .eq('speaker', 'student');

      if (studentDialogues && studentDialogues.length > 0) {
        const dialogueIds = studentDialogues.map(d => d.id);
        const { data: cogTags } = await supabase
          .from('dialogue_cognitive_tags')
          .select('bloom_level')
          .in('dialogue_id', dialogueIds);

        if (cogTags && cogTags.length > 0) {
          cogTags.forEach(t => {
            if (bloomDistribution[t.bloom_level] !== undefined) {
              bloomDistribution[t.bloom_level]++;
            }
          });
          const total = cogTags.length;
          higherOrderRatio = Math.round(
            ((bloomDistribution.analyze + bloomDistribution.evaluate + bloomDistribution.create) / total) * 100
          ) / 100;
        }
      }

      // Average thinking momentum across completed sessions
      const { data: momentumSessions } = await supabase
        .from('sessions')
        .select('thinking_momentum')
        .in('id', sessionIdList)
        .not('thinking_momentum', 'is', null);

      if (momentumSessions && momentumSessions.length > 0) {
        const sum = momentumSessions.reduce((acc, s) => acc + s.thinking_momentum, 0);
        avgThinkingMomentum = Math.round(sum / momentumSessions.length);
      }
    }

    // ── 8. Bloom's weekly trend (from DB view) ──────────────────────────────
    const { data: bloomWeekly } = await supabase
      .from('student_bloom_weekly')
      .select('*')
      .eq('student_id', studentId)
      .order('week', { ascending: true })
      .limit(8);

    // ── 9. Assemble response ───────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: student.name,
          age: student.age,
          level: student.level,
          avatarEmoji: student.avatar_emoji,
          streak: student.current_streak ?? 0,
          totalBooks: student.total_books_read ?? 0,
          totalWords: student.total_words_learned ?? 0,
          lastSessionDate: student.last_session_date,
          createdAt: student.created_at,
        },
        sessions: sessionsWithStages,
        vocabulary: {
          total: totalVocab,
          mastered: masteredVocab,
          learning: learningVocab,
          recentWords,
        },
        achievements,
        weeklyProgress,
        stageBreakdown,
        cognitiveProfile: {
          bloomDistribution,
          higherOrderRatio,
          avgThinkingMomentum,
          weeklyTrend: (bloomWeekly || []).map(w => ({
            week: w.week,
            higherOrderRatio: w.higher_order_ratio,
            lowerOrderRatio: w.lower_order_ratio,
            sessionsCount: w.sessions_count,
          })),
        },
      },
    });
  } catch (err) {
    console.error('Student analytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch student analytics' });
  }
});

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Returns a sortable ISO week key: 'YYYY-WW' (ISO 8601).
 *
 * @param {Date} date
 * @returns {string}
 */
function getISOWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
}

/**
 * POST /prompts/test
 * Test a prompt by sending to Claude API
 * Body: { stage, studentName, bookTitle, level, studentMessage }
 * Returns: { response }
 */
router.post('/prompts/test', optionalAdminAuth, async (req, res) => {
  try {
    const { stage, studentName, bookTitle, level, studentMessage } = req.body;

    // Validation
    if (!stage || !studentName || !bookTitle || !level) {
      return res.status(400).json({ error: 'stage, studentName, bookTitle, and level are required' });
    }

    if (!['title', 'introduction', 'body', 'conclusion'].includes(stage)) {
      return res.status(400).json({ error: 'Invalid stage' });
    }

    if (!['beginner', 'intermediate', 'advanced'].includes(level)) {
      return res.status(400).json({ error: 'Invalid level' });
    }

    // Call the AI engine to test the prompt
    const aliceResponse = await getAliceResponse({
      bookTitle,
      studentName,
      level,
      stage,
      turn: 1,
      studentMessage: studentMessage || null,
      conversationHistory: [],
    });

    return res.status(200).json({
      success: true,
      data: {
        response: aliceResponse,
      },
    });
  } catch (err) {
    console.error('Test prompt error:', err);
    return res.status(500).json({ error: 'Failed to test prompt' });
  }
});

export default router;
