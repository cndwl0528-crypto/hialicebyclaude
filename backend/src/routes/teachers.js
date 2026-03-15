/**
 * teachers.js
 * HiAlice — B2B Academy / Teacher API Routes
 *
 * Provides teacher-facing endpoints for class management, student progress
 * monitoring, book assignment, data export, and dashboard statistics.
 *
 * All data is currently served from in-memory mock stores. Every handler is
 * marked with a // MOCK comment where a real Supabase query will replace it.
 *
 * Route summary:
 *   GET  /api/teachers/classes                          List teacher's classes
 *   GET  /api/teachers/classes/:classId/students        Get students in a class
 *   GET  /api/teachers/students/:studentId/detail       Detailed student view
 *   POST /api/teachers/classes/:classId/assign-book     Assign book to class
 *   GET  /api/teachers/classes/:classId/export          CSV export of class data
 *   GET  /api/teachers/stats                            Dashboard overview stats
 */

import { Router } from 'express';
import logger from '../lib/logger.js';

const router = Router();

// ============================================================================
// Constants
// ============================================================================

const VALID_CLASS_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

// ============================================================================
// In-Memory Mock Stores (exported for test access and reset)
// Each object is a frozen value — mutations create new objects.
// ============================================================================

/** @type {Map<string, object>} classId -> class record */
export const _classes = new Map([
  ['morning', Object.freeze({
    id: 'morning',
    name: 'Morning Class',
    schedule: 'Mon / Wed / Fri  9:00 AM',
    studentCount: 4,
    teacherId: 'teacher-1',
    level: 'intermediate',
    createdAt: '2026-01-15T00:00:00.000Z',
  })],
  ['afternoon', Object.freeze({
    id: 'afternoon',
    name: 'Afternoon Class',
    schedule: 'Tue / Thu  2:00 PM',
    studentCount: 3,
    teacherId: 'teacher-1',
    level: 'beginner',
    createdAt: '2026-01-15T00:00:00.000Z',
  })],
  ['saturday', Object.freeze({
    id: 'saturday',
    name: 'Saturday Group',
    schedule: 'Sat  10:00 AM',
    studentCount: 2,
    teacherId: 'teacher-1',
    level: 'advanced',
    createdAt: '2026-01-20T00:00:00.000Z',
  })],
]);

/** @type {Map<string, object[]>} classId -> student[] */
export const _classStudents = new Map([
  ['morning', [
    Object.freeze({
      id: 's1',
      classId: 'morning',
      name: 'Mia Chen',
      avatarEmoji: '🌸',
      age: 9,
      level: 'intermediate',
      recentSessions: [
        { bookTitle: "Charlotte's Web", grammarScore: 88, completedAt: new Date(Date.now() - 86400000).toISOString(), vocabCount: 14 },
        { bookTitle: 'The Secret Garden', grammarScore: 85, completedAt: new Date(Date.now() - 7 * 86400000).toISOString(), vocabCount: 11 },
      ],
      streak: 7,
      grammarAvg: 87,
      lastActive: new Date(Date.now() - 1 * 86400000).toISOString(),
      status: 'active',
      totalWords: 142,
    }),
    Object.freeze({
      id: 's2',
      classId: 'morning',
      name: 'Leo Park',
      avatarEmoji: '⚡',
      age: 10,
      level: 'intermediate',
      recentSessions: [
        { bookTitle: 'Magic Tree House', grammarScore: 76, completedAt: new Date(Date.now() - 3 * 86400000).toISOString(), vocabCount: 8 },
        { bookTitle: 'Diary of a Wimpy Kid', grammarScore: 72, completedAt: new Date(Date.now() - 10 * 86400000).toISOString(), vocabCount: 9 },
      ],
      streak: 3,
      grammarAvg: 74,
      lastActive: new Date(Date.now() - 3 * 86400000).toISOString(),
      status: 'active',
      totalWords: 89,
    }),
    Object.freeze({
      id: 's3',
      classId: 'morning',
      name: 'Sophie Kim',
      avatarEmoji: '🌙',
      age: 8,
      level: 'beginner',
      recentSessions: [
        { bookTitle: 'The Very Hungry Caterpillar', grammarScore: 68, completedAt: new Date(Date.now() - 9 * 86400000).toISOString(), vocabCount: 5 },
      ],
      streak: 0,
      grammarAvg: 65,
      lastActive: new Date(Date.now() - 9 * 86400000).toISOString(),
      status: 'needs_attention',
      totalWords: 52,
    }),
    Object.freeze({
      id: 's4',
      classId: 'morning',
      name: 'James Yoo',
      avatarEmoji: '🦁',
      age: 12,
      level: 'advanced',
      recentSessions: [
        { bookTitle: 'A Wrinkle in Time', grammarScore: 94, completedAt: new Date(Date.now() - 86400000).toISOString(), vocabCount: 22 },
        { bookTitle: 'The Hobbit', grammarScore: 91, completedAt: new Date(Date.now() - 8 * 86400000).toISOString(), vocabCount: 25 },
      ],
      streak: 14,
      grammarAvg: 92,
      lastActive: new Date(Date.now() - 1 * 86400000).toISOString(),
      status: 'active',
      totalWords: 231,
    }),
  ]],
  ['afternoon', [
    Object.freeze({
      id: 's5',
      classId: 'afternoon',
      name: 'Emma Davis',
      avatarEmoji: '🌺',
      age: 7,
      level: 'beginner',
      recentSessions: [
        { bookTitle: 'Clifford the Big Red Dog', grammarScore: 70, completedAt: new Date(Date.now() - 2 * 86400000).toISOString(), vocabCount: 6 },
      ],
      streak: 5,
      grammarAvg: 71,
      lastActive: new Date(Date.now() - 2 * 86400000).toISOString(),
      status: 'active',
      totalWords: 63,
    }),
    Object.freeze({
      id: 's6',
      classId: 'afternoon',
      name: 'Noah Wilson',
      avatarEmoji: '🚀',
      age: 9,
      level: 'intermediate',
      recentSessions: [
        { bookTitle: 'Harry Potter', grammarScore: 82, completedAt: new Date(Date.now() - 4 * 86400000).toISOString(), vocabCount: 16 },
      ],
      streak: 2,
      grammarAvg: 80,
      lastActive: new Date(Date.now() - 4 * 86400000).toISOString(),
      status: 'active',
      totalWords: 107,
    }),
    Object.freeze({
      id: 's7',
      classId: 'afternoon',
      name: 'Ava Martinez',
      avatarEmoji: '🎨',
      age: 11,
      level: 'intermediate',
      recentSessions: [
        { bookTitle: 'Wonder', grammarScore: 85, completedAt: new Date(Date.now() - 5 * 86400000).toISOString(), vocabCount: 13 },
      ],
      streak: 6,
      grammarAvg: 83,
      lastActive: new Date(Date.now() - 5 * 86400000).toISOString(),
      status: 'active',
      totalWords: 118,
    }),
  ]],
  ['saturday', [
    Object.freeze({
      id: 's8',
      classId: 'saturday',
      name: 'Liam Thompson',
      avatarEmoji: '🎸',
      age: 13,
      level: 'advanced',
      recentSessions: [
        { bookTitle: 'The Giver', grammarScore: 89, completedAt: new Date(Date.now() - 6 * 86400000).toISOString(), vocabCount: 19 },
      ],
      streak: 4,
      grammarAvg: 88,
      lastActive: new Date(Date.now() - 6 * 86400000).toISOString(),
      status: 'active',
      totalWords: 175,
    }),
    Object.freeze({
      id: 's9',
      classId: 'saturday',
      name: 'Olivia Brown',
      avatarEmoji: '🌈',
      age: 10,
      level: 'intermediate',
      recentSessions: [
        { bookTitle: 'Holes', grammarScore: 78, completedAt: new Date(Date.now() - 13 * 86400000).toISOString(), vocabCount: 10 },
      ],
      streak: 1,
      grammarAvg: 76,
      lastActive: new Date(Date.now() - 13 * 86400000).toISOString(),
      status: 'needs_attention',
      totalWords: 91,
    }),
  ]],
]);

/** @type {Map<string, object>} studentId -> detailed student record */
export const _studentDetails = new Map([
  ['s1', Object.freeze({
    id: 's1',
    name: 'Mia Chen',
    age: 9,
    level: 'intermediate',
    classId: 'morning',
    sessions: [
      { id: 'sess-1', bookTitle: "Charlotte's Web", grammarScore: 88, levelScore: 85, completedAt: new Date(Date.now() - 86400000).toISOString(), vocabCount: 14, stage: 'conclusion' },
      { id: 'sess-2', bookTitle: 'The Secret Garden', grammarScore: 85, levelScore: 82, completedAt: new Date(Date.now() - 7 * 86400000).toISOString(), vocabCount: 11, stage: 'conclusion' },
      { id: 'sess-3', bookTitle: 'Matilda', grammarScore: 90, levelScore: 88, completedAt: new Date(Date.now() - 14 * 86400000).toISOString(), vocabCount: 18, stage: 'conclusion' },
    ],
    vocabulary: {
      total: 142,
      recentWords: ['curious', 'adventure', 'determined', 'magnificent', 'compassion'],
      masteredCount: 98,
      learningCount: 44,
    },
    growth: {
      vocabularyBreadth: 82,
      grammarAccuracy: 87,
      comprehension: 85,
      criticalThinking: 78,
      creativeExpression: 80,
      fluency: 76,
      confidence: 88,
    },
    streak: 7,
    aiFeedback: 'Mia demonstrates excellent critical thinking. Encourage her to use more complex sentence structures.',
  })],
  ['s2', Object.freeze({
    id: 's2',
    name: 'Leo Park',
    age: 10,
    level: 'intermediate',
    classId: 'morning',
    sessions: [
      { id: 'sess-4', bookTitle: 'Magic Tree House', grammarScore: 76, levelScore: 74, completedAt: new Date(Date.now() - 3 * 86400000).toISOString(), vocabCount: 8, stage: 'conclusion' },
      { id: 'sess-5', bookTitle: 'Diary of a Wimpy Kid', grammarScore: 72, levelScore: 70, completedAt: new Date(Date.now() - 10 * 86400000).toISOString(), vocabCount: 9, stage: 'conclusion' },
    ],
    vocabulary: {
      total: 89,
      recentWords: ['hilarious', 'obstacle', 'sneaky', 'mischievous', 'embarrassed'],
      masteredCount: 61,
      learningCount: 28,
    },
    growth: {
      vocabularyBreadth: 68,
      grammarAccuracy: 74,
      comprehension: 72,
      criticalThinking: 65,
      creativeExpression: 70,
      fluency: 68,
      confidence: 75,
    },
    streak: 3,
    aiFeedback: 'Leo engages enthusiastically. Focus on expanding vocabulary and using more descriptive language.',
  })],
]);

/** @type {Map<string, object[]>} classId -> assignedBook[] */
export const _bookAssignments = new Map();

// ============================================================================
// Pure Helper Functions (exported for unit testing)
// ============================================================================

/**
 * Validate a classId — must be a non-empty alphanumeric/dash/underscore string.
 *
 * @param {string} classId
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateClassId(classId) {
  if (!classId || typeof classId !== 'string') {
    return { valid: false, error: 'classId is required' };
  }
  if (!VALID_CLASS_ID_PATTERN.test(classId)) {
    return { valid: false, error: 'classId must contain only alphanumeric characters, dashes, or underscores' };
  }
  return { valid: true };
}

/**
 * Validate the body for a book assignment request.
 *
 * @param {object} body
 * @returns {{ valid: boolean, error?: string, data?: object }}
 */
export function validateAssignBookInput(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const { bookId, dueDate } = body;

  if (!bookId || typeof bookId !== 'string' || bookId.trim() === '') {
    return { valid: false, error: 'bookId is required' };
  }

  const trimmedBookId = bookId.trim();

  let parsedDueDate = null;
  if (dueDate !== undefined && dueDate !== null) {
    parsedDueDate = new Date(dueDate);
    if (isNaN(parsedDueDate.getTime())) {
      return { valid: false, error: 'dueDate must be a valid ISO date string' };
    }
  }

  return {
    valid: true,
    data: {
      bookId: trimmedBookId,
      dueDate: parsedDueDate ? parsedDueDate.toISOString() : null,
    },
  };
}

/**
 * Get all students across all classes for aggregated stats.
 * Returns a flat array of student records.
 *
 * @returns {object[]}
 */
export function getAllStudents() {
  const all = [];
  for (const students of _classStudents.values()) {
    all.push(...students);
  }
  return all;
}

/**
 * Build a CSV row from an array of values, quoting any fields that contain commas.
 *
 * @param {(string|number)[]} fields
 * @returns {string}
 */
export function buildCsvRow(fields) {
  return fields
    .map((field) => {
      const str = String(field ?? '');
      return str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str;
    })
    .join(',');
}

/**
 * Reset all in-memory stores to their initial state.
 * Used exclusively by tests to ensure full isolation between cases.
 */
export function _resetStore() {
  _bookAssignments.clear();
}

// ============================================================================
// GET /api/teachers/classes
// List all classes belonging to the authenticated teacher.
// ============================================================================

/**
 * @route  GET /api/teachers/classes
 * @access teacher, admin, super_admin
 * @returns {{ classes: { id, name, schedule, studentCount }[] }}
 */
router.get('/classes', (req, res) => {
  try {
    // MOCK: Replace with Supabase query:
    //   supabase.from('classes').select('id, name, schedule, student_count')
    //           .eq('teacher_id', req.user.id)
    const classes = Array.from(_classes.values()).map((cls) => ({
      id: cls.id,
      name: cls.name,
      schedule: cls.schedule,
      studentCount: cls.studentCount,
    }));

    logger.info({ teacherId: req.user?.id, classCount: classes.length }, 'Teacher classes listed');

    return res.status(200).json({ classes });
  } catch (err) {
    logger.error({ err }, 'Failed to list teacher classes');
    return res.status(500).json({ error: 'Failed to retrieve classes' });
  }
});

// ============================================================================
// GET /api/teachers/classes/:classId/students
// Get the student roster for a specific class.
// ============================================================================

/**
 * @route  GET /api/teachers/classes/:classId/students
 * @access teacher, admin, super_admin
 * @returns {{ students: { id, name, level, recentSessions, streak, grammarAvg, lastActive }[] }}
 */
router.get('/classes/:classId/students', (req, res) => {
  try {
    const { classId } = req.params;

    const validation = validateClassId(classId);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // MOCK: Replace with Supabase query:
    //   supabase.from('students').select('id, name, level, last_active, streak, ...')
    //           .eq('class_id', classId)
    //           .eq('teacher_id', req.user.id)
    if (!_classes.has(classId)) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const students = (_classStudents.get(classId) ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      level: s.level,
      recentSessions: s.recentSessions,
      streak: s.streak,
      grammarAvg: s.grammarAvg,
      lastActive: s.lastActive,
      status: s.status,
    }));

    logger.info({ classId, studentCount: students.length }, 'Class student roster retrieved');

    return res.status(200).json({ students });
  } catch (err) {
    logger.error({ err }, 'Failed to retrieve class students');
    return res.status(500).json({ error: 'Failed to retrieve students' });
  }
});

// ============================================================================
// GET /api/teachers/students/:studentId/detail
// Detailed view of a single student: sessions, vocabulary, growth profile.
// ============================================================================

/**
 * @route  GET /api/teachers/students/:studentId/detail
 * @access teacher, admin, super_admin
 * @returns {{ student: { id, name, level, sessions, vocabulary, growth } }}
 */
router.get('/students/:studentId/detail', (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId || typeof studentId !== 'string' || studentId.trim() === '') {
      return res.status(400).json({ error: 'studentId is required' });
    }

    // MOCK: Replace with Supabase query joining students, sessions, vocabulary:
    //   supabase.from('students').select(`*, sessions(*), vocabulary(*)`)
    //           .eq('id', studentId).single()
    const student = _studentDetails.get(studentId);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    logger.info({ studentId }, 'Student detail retrieved');

    return res.status(200).json({ student });
  } catch (err) {
    logger.error({ err }, 'Failed to retrieve student detail');
    return res.status(500).json({ error: 'Failed to retrieve student detail' });
  }
});

// ============================================================================
// POST /api/teachers/classes/:classId/assign-book
// Assign a book to all students in a class.
// ============================================================================

/**
 * @route  POST /api/teachers/classes/:classId/assign-book
 * @body   { bookId: string, dueDate?: string }
 * @access teacher, admin, super_admin
 * @returns {{ success: true, assignedTo: number }}
 */
router.post('/classes/:classId/assign-book', (req, res) => {
  try {
    const { classId } = req.params;

    const classValidation = validateClassId(classId);
    if (!classValidation.valid) {
      return res.status(400).json({ error: classValidation.error });
    }

    if (!_classes.has(classId)) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const inputValidation = validateAssignBookInput(req.body);
    if (!inputValidation.valid) {
      return res.status(400).json({ error: inputValidation.error });
    }

    const { bookId, dueDate } = inputValidation.data;
    const students = _classStudents.get(classId) ?? [];
    const assignedTo = students.length;

    // MOCK: Replace with Supabase insert into class_book_assignments:
    //   supabase.from('class_book_assignments').insert({
    //     class_id: classId, book_id: bookId, due_date: dueDate,
    //     assigned_by: req.user.id, assigned_at: new Date().toISOString()
    //   })
    const assignment = Object.freeze({
      classId,
      bookId,
      dueDate,
      assignedBy: req.user?.id ?? 'teacher-1',
      assignedAt: new Date().toISOString(),
      studentCount: assignedTo,
    });

    const existing = _bookAssignments.get(classId) ?? [];
    _bookAssignments.set(classId, [...existing, assignment]);

    logger.info({ classId, bookId, assignedTo }, 'Book assigned to class');

    return res.status(200).json({ success: true, assignedTo });
  } catch (err) {
    logger.error({ err }, 'Failed to assign book to class');
    return res.status(500).json({ error: 'Failed to assign book' });
  }
});

// ============================================================================
// GET /api/teachers/classes/:classId/export
// Export class data as a downloadable CSV file.
// ============================================================================

/**
 * @route  GET /api/teachers/classes/:classId/export
 * @access teacher, admin, super_admin
 * @returns CSV file download
 * @headers Content-Type: text/csv, Content-Disposition: attachment
 * @columns Student Name, Level, Sessions Completed, Avg Grammar Score, Vocabulary Count, Last Active
 */
router.get('/classes/:classId/export', (req, res) => {
  try {
    const { classId } = req.params;

    const validation = validateClassId(classId);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    if (!_classes.has(classId)) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const cls = _classes.get(classId);

    // MOCK: Replace with Supabase query joining students, sessions, vocabulary:
    //   supabase.from('students')
    //     .select('name, level, sessions(grammar_score, completed_at), vocabulary(id)')
    //     .eq('class_id', classId)
    const students = _classStudents.get(classId) ?? [];

    const headerRow = buildCsvRow([
      'Student Name',
      'Level',
      'Sessions Completed',
      'Avg Grammar Score',
      'Vocabulary Count',
      'Last Active',
    ]);

    const dataRows = students.map((s) => {
      const sessionsCompleted = s.recentSessions?.length ?? 0;
      const lastActive = s.lastActive
        ? new Date(s.lastActive).toISOString().split('T')[0]
        : 'N/A';

      return buildCsvRow([
        s.name,
        s.level,
        sessionsCompleted,
        s.grammarAvg,
        s.totalWords,
        lastActive,
      ]);
    });

    const csvContent = [headerRow, ...dataRows].join('\n');
    const filename = `class-${classId}-export-${new Date().toISOString().split('T')[0]}.csv`;

    logger.info({ classId, rowCount: students.length }, 'Class CSV exported');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    logger.error({ err }, 'Failed to export class data');
    return res.status(500).json({ error: 'Failed to export class data' });
  }
});

// ============================================================================
// GET /api/teachers/stats
// Dashboard overview stats for the authenticated teacher.
// ============================================================================

/**
 * @route  GET /api/teachers/stats
 * @access teacher, admin, super_admin
 * @returns {{
 *   totalStudents: number,
 *   activeThisWeek: number,
 *   avgCompletionRate: number,
 *   avgGrammarScore: number,
 *   topBooks: { title: string, sessionCount: number }[]
 * }}
 */
router.get('/stats', (req, res) => {
  try {
    // MOCK: Replace with aggregated Supabase queries across students/sessions
    //   for the teacher's assigned classes.
    const allStudents = getAllStudents();

    const totalStudents = allStudents.length;

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const activeThisWeek = allStudents.filter((s) => {
      return s.lastActive && new Date(s.lastActive).getTime() >= oneWeekAgo;
    }).length;

    // Average grammar score across all students
    const studentsWithScore = allStudents.filter((s) => typeof s.grammarAvg === 'number');
    const avgGrammarScore = studentsWithScore.length > 0
      ? Math.round(
          studentsWithScore.reduce((sum, s) => sum + s.grammarAvg, 0) / studentsWithScore.length
        )
      : 0;

    // Completion rate: students with at least one session / total students
    const studentsWithSessions = allStudents.filter(
      (s) => s.recentSessions && s.recentSessions.length > 0
    ).length;
    const avgCompletionRate = totalStudents > 0
      ? Math.round((studentsWithSessions / totalStudents) * 100)
      : 0;

    // Aggregate book titles from all recent sessions to find top books
    const bookCountMap = new Map();
    for (const student of allStudents) {
      for (const session of student.recentSessions ?? []) {
        const title = session.bookTitle;
        bookCountMap.set(title, (bookCountMap.get(title) ?? 0) + 1);
      }
    }
    const topBooks = Array.from(bookCountMap.entries())
      .map(([title, sessionCount]) => ({ title, sessionCount }))
      .sort((a, b) => b.sessionCount - a.sessionCount)
      .slice(0, 5);

    logger.info({ teacherId: req.user?.id, totalStudents, activeThisWeek }, 'Teacher stats retrieved');

    return res.status(200).json({
      totalStudents,
      activeThisWeek,
      avgCompletionRate,
      avgGrammarScore,
      topBooks,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to retrieve teacher stats');
    return res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

export default router;
