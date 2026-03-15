/**
 * teachers.test.js
 * HiAlice — Teacher API Unit Tests
 *
 * Tests all six teacher endpoints by driving the Express router directly
 * through lightweight mock req/res/next triples. No HTTP server, no network
 * calls, no Supabase, no external dependencies.
 *
 * Design:
 *   - The in-memory _bookAssignments map is reset before each test via
 *     _resetStore() so every test starts from a known, clean state.
 *   - Pure helper functions (validateClassId, validateAssignBookInput,
 *     buildCsvRow, getAllStudents) are tested independently as unit tests.
 *   - Route handlers are exercised via routeRequest() which drives the router
 *     with a synthetic req and a mock res.
 *   - The static class/student mock stores (_classes, _classStudents,
 *     _studentDetails) are seeded at module initialisation time — tests
 *     treat them as read-only fixtures.
 *
 * Coverage areas:
 *   1. Helper functions — validateClassId, validateAssignBookInput, buildCsvRow
 *   2. GET /classes              — list teacher classes
 *   3. GET /classes/:id/students — class student roster
 *   4. GET /students/:id/detail  — student detail view
 *   5. POST /classes/:id/assign-book — book assignment
 *   6. GET /classes/:id/export   — CSV export
 *   7. GET /stats                — dashboard stats
 *   8. Edge cases — invalid IDs, missing body fields, not-found resources
 *
 * Run: cd backend && npx vitest run
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// Suppress pino logger output during tests
// vi.mock() is hoisted to the top of the file by Vitest
// ============================================================================
vi.mock('../lib/logger.js', () => ({
  default: {
    info:  vi.fn(),
    warn:  vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

// ============================================================================
// Import the router and exported helpers / stores
// ============================================================================
import router, {
  // Pure helper functions under test
  validateClassId,
  validateAssignBookInput,
  buildCsvRow,
  getAllStudents,

  // In-memory stores (read-only fixtures in these tests)
  _classes,
  _classStudents,
  _studentDetails,
  _bookAssignments,

  // Store reset for test isolation
  _resetStore,
} from '../routes/teachers.js';

// ============================================================================
// routeRequest — lightweight Express router driver
// ============================================================================

/**
 * Drive a route handler through the Express router with a synthetic request.
 * Returns a Promise that resolves to { status, body, headers, text } when the
 * response is finalised.
 *
 * @param {string} method  - HTTP method in lower case ('get', 'post')
 * @param {string} path    - URL path (e.g. '/classes/morning/students')
 * @param {{ body?, user? }} opts
 * @returns {Promise<{ status: number, body?: object, text?: string, headers: object }>}
 */
function routeRequest(method, path, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method: method.toUpperCase(),
      url:    path,
      body:   opts.body   ?? {},
      params: {},
      query:  opts.query  ?? {},
      // Provide a minimal req.user so route handlers can read role/id
      user:   opts.user   ?? { id: 'teacher-1', role: 'teacher' },
    };

    const captured = {
      _status:  200,
      _headers: {},
      _body:    null,
      _text:    null,
    };

    const res = {
      status(code) {
        captured._status = code;
        return res;
      },
      json(body) {
        captured._body = body;
        resolve({
          status:  captured._status,
          body:    captured._body,
          text:    null,
          headers: captured._headers,
        });
        return res;
      },
      send(text) {
        captured._text = text;
        resolve({
          status:  captured._status,
          body:    null,
          text:    captured._text,
          headers: captured._headers,
        });
        return res;
      },
      setHeader(name, value) {
        captured._headers[name.toLowerCase()] = value;
        return res;
      },
    };

    router.handle(req, res, (err) => {
      if (err) reject(err);
      else reject(new Error(`No route matched: ${method.toUpperCase()} ${path}`));
    });
  });
}

// ============================================================================
// Reset mutable store before every test
// ============================================================================
beforeEach(() => {
  _resetStore();
});

// ============================================================================
// 1. Helper function — validateClassId
// ============================================================================

describe('validateClassId', () => {
  it('returns valid:true for a valid alphanumeric classId', () => {
    const result = validateClassId('morning');
    expect(result.valid).toBe(true);
  });

  it('returns valid:true for a classId with dashes and underscores', () => {
    const result = validateClassId('class-group_1');
    expect(result.valid).toBe(true);
  });

  it('returns valid:false when classId is undefined', () => {
    const result = validateClassId(undefined);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns valid:false when classId is an empty string', () => {
    const result = validateClassId('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns valid:false when classId contains spaces', () => {
    const result = validateClassId('morning class');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns valid:false when classId contains special characters', () => {
    const result = validateClassId('class<script>');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns valid:false when classId is not a string', () => {
    const result = validateClassId(42);
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// 2. Helper function — validateAssignBookInput
// ============================================================================

describe('validateAssignBookInput', () => {
  it('returns valid:true when bookId is provided', () => {
    const result = validateAssignBookInput({ bookId: 'book-001' });
    expect(result.valid).toBe(true);
    expect(result.data.bookId).toBe('book-001');
  });

  it('trims whitespace from bookId', () => {
    const result = validateAssignBookInput({ bookId: '  book-002  ' });
    expect(result.valid).toBe(true);
    expect(result.data.bookId).toBe('book-002');
  });

  it('returns valid:false when bookId is missing', () => {
    const result = validateAssignBookInput({});
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/bookId/i);
  });

  it('returns valid:false when bookId is an empty string', () => {
    const result = validateAssignBookInput({ bookId: '  ' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/bookId/i);
  });

  it('returns valid:false when body is null', () => {
    const result = validateAssignBookInput(null);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('accepts a valid ISO dueDate string', () => {
    const result = validateAssignBookInput({
      bookId: 'book-003',
      dueDate: '2026-06-01T00:00:00.000Z',
    });
    expect(result.valid).toBe(true);
    expect(result.data.dueDate).toBeTruthy();
  });

  it('returns valid:false for an invalid dueDate string', () => {
    const result = validateAssignBookInput({
      bookId: 'book-004',
      dueDate: 'not-a-date',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/dueDate/i);
  });

  it('allows dueDate to be omitted (defaults to null)', () => {
    const result = validateAssignBookInput({ bookId: 'book-005' });
    expect(result.valid).toBe(true);
    expect(result.data.dueDate).toBeNull();
  });
});

// ============================================================================
// 3. Helper function — buildCsvRow
// ============================================================================

describe('buildCsvRow', () => {
  it('joins fields with commas', () => {
    expect(buildCsvRow(['Alice', 'intermediate', '5', '82'])).toBe('Alice,intermediate,5,82');
  });

  it('wraps a field in double-quotes when it contains a comma', () => {
    const row = buildCsvRow(['Smith, John', 'beginner']);
    expect(row).toBe('"Smith, John",beginner');
  });

  it('converts numbers to strings', () => {
    expect(buildCsvRow([42, 87.5])).toBe('42,87.5');
  });

  it('converts null/undefined to empty strings', () => {
    expect(buildCsvRow([null, undefined, 'ok'])).toBe(',,ok');
  });
});

// ============================================================================
// 4. Helper function — getAllStudents
// ============================================================================

describe('getAllStudents', () => {
  it('returns a flat array of all students across all classes', () => {
    const students = getAllStudents();
    expect(Array.isArray(students)).toBe(true);
    expect(students.length).toBeGreaterThan(0);
  });

  it('includes students from every class in _classStudents', () => {
    const students = getAllStudents();
    const totalExpected = Array.from(_classStudents.values())
      .reduce((sum, arr) => sum + arr.length, 0);
    expect(students.length).toBe(totalExpected);
  });
});

// ============================================================================
// 5. GET /classes — list teacher's classes
// ============================================================================

describe('GET /classes', () => {
  it('returns 200 with a classes array', async () => {
    const { status, body } = await routeRequest('get', '/classes');
    expect(status).toBe(200);
    expect(body).toHaveProperty('classes');
    expect(Array.isArray(body.classes)).toBe(true);
  });

  it('returns the three seeded classes', async () => {
    const { body } = await routeRequest('get', '/classes');
    expect(body.classes.length).toBe(3);
  });

  it('each class has the required fields: id, name, schedule, studentCount', async () => {
    const { body } = await routeRequest('get', '/classes');
    for (const cls of body.classes) {
      expect(cls).toHaveProperty('id');
      expect(cls).toHaveProperty('name');
      expect(cls).toHaveProperty('schedule');
      expect(cls).toHaveProperty('studentCount');
    }
  });

  it('does not expose internal teacher-only fields (e.g. teacherId)', async () => {
    const { body } = await routeRequest('get', '/classes');
    for (const cls of body.classes) {
      expect(cls).not.toHaveProperty('teacherId');
    }
  });
});

// ============================================================================
// 6. GET /classes/:classId/students — student roster
// ============================================================================

describe('GET /classes/:classId/students', () => {
  it('returns 200 with a students array for a valid classId', async () => {
    const { status, body } = await routeRequest('get', '/classes/morning/students');
    expect(status).toBe(200);
    expect(body).toHaveProperty('students');
    expect(Array.isArray(body.students)).toBe(true);
  });

  it('returns the 4 students in the morning class', async () => {
    const { body } = await routeRequest('get', '/classes/morning/students');
    expect(body.students.length).toBe(4);
  });

  it('each student has the required fields', async () => {
    const { body } = await routeRequest('get', '/classes/morning/students');
    for (const s of body.students) {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('level');
      expect(s).toHaveProperty('recentSessions');
      expect(s).toHaveProperty('streak');
      expect(s).toHaveProperty('grammarAvg');
      expect(s).toHaveProperty('lastActive');
    }
  });

  it('returns 3 students for the afternoon class', async () => {
    const { body } = await routeRequest('get', '/classes/afternoon/students');
    expect(body.students.length).toBe(3);
  });

  it('returns 404 for a non-existent classId', async () => {
    const { status, body } = await routeRequest('get', '/classes/nonexistent/students');
    expect(status).toBe(404);
    expect(body).toHaveProperty('error');
  });

  it('returns 400 for a classId with invalid characters', async () => {
    const { status, body } = await routeRequest('get', '/classes/<script>/students');
    expect(status).toBe(400);
    expect(body).toHaveProperty('error');
  });
});

// ============================================================================
// 7. GET /students/:studentId/detail — detailed student view
// ============================================================================

describe('GET /students/:studentId/detail', () => {
  it('returns 200 with a student object for a known studentId', async () => {
    const { status, body } = await routeRequest('get', '/students/s1/detail');
    expect(status).toBe(200);
    expect(body).toHaveProperty('student');
  });

  it('the student object has sessions, vocabulary, and growth fields', async () => {
    const { body } = await routeRequest('get', '/students/s1/detail');
    const { student } = body;
    expect(student).toHaveProperty('id');
    expect(student).toHaveProperty('name');
    expect(student).toHaveProperty('level');
    expect(student).toHaveProperty('sessions');
    expect(student).toHaveProperty('vocabulary');
    expect(student).toHaveProperty('growth');
  });

  it('vocabulary has total, recentWords, masteredCount, learningCount', async () => {
    const { body } = await routeRequest('get', '/students/s1/detail');
    const { vocabulary } = body.student;
    expect(vocabulary).toHaveProperty('total');
    expect(vocabulary).toHaveProperty('recentWords');
    expect(vocabulary).toHaveProperty('masteredCount');
    expect(vocabulary).toHaveProperty('learningCount');
  });

  it('growth has seven radar dimensions', async () => {
    const { body } = await routeRequest('get', '/students/s1/detail');
    const { growth } = body.student;
    expect(growth).toHaveProperty('vocabularyBreadth');
    expect(growth).toHaveProperty('grammarAccuracy');
    expect(growth).toHaveProperty('comprehension');
    expect(growth).toHaveProperty('criticalThinking');
    expect(growth).toHaveProperty('creativeExpression');
    expect(growth).toHaveProperty('fluency');
    expect(growth).toHaveProperty('confidence');
  });

  it('returns 404 for an unknown studentId', async () => {
    const { status, body } = await routeRequest('get', '/students/nonexistent-id/detail');
    expect(status).toBe(404);
    expect(body).toHaveProperty('error');
  });
});

// ============================================================================
// 8. POST /classes/:classId/assign-book — book assignment
// ============================================================================

describe('POST /classes/:classId/assign-book', () => {
  it('returns 200 with success:true and assignedTo count', async () => {
    const { status, body } = await routeRequest(
      'post',
      '/classes/morning/assign-book',
      { body: { bookId: 'book-charlotteweb' } }
    );
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.assignedTo).toBe(4); // 4 students in morning class
  });

  it('stores the assignment in _bookAssignments', async () => {
    await routeRequest(
      'post',
      '/classes/morning/assign-book',
      { body: { bookId: 'book-001' } }
    );
    expect(_bookAssignments.has('morning')).toBe(true);
    expect(_bookAssignments.get('morning')).toHaveLength(1);
  });

  it('stores assignment with bookId and dueDate', async () => {
    await routeRequest(
      'post',
      '/classes/morning/assign-book',
      { body: { bookId: 'book-002', dueDate: '2026-06-01T00:00:00.000Z' } }
    );
    const assignments = _bookAssignments.get('morning');
    expect(assignments[0].bookId).toBe('book-002');
    expect(assignments[0].dueDate).toBeTruthy();
  });

  it('returns 400 when bookId is missing from body', async () => {
    const { status, body } = await routeRequest(
      'post',
      '/classes/morning/assign-book',
      { body: {} }
    );
    expect(status).toBe(400);
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/bookId/i);
  });

  it('returns 400 when bookId is an empty string', async () => {
    const { status, body } = await routeRequest(
      'post',
      '/classes/morning/assign-book',
      { body: { bookId: '' } }
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/bookId/i);
  });

  it('returns 404 for a non-existent classId', async () => {
    const { status, body } = await routeRequest(
      'post',
      '/classes/nonexistent/assign-book',
      { body: { bookId: 'book-001' } }
    );
    expect(status).toBe(404);
    expect(body).toHaveProperty('error');
  });

  it('assigns to the correct number of students per class', async () => {
    const { body: afternoonBody } = await routeRequest(
      'post',
      '/classes/afternoon/assign-book',
      { body: { bookId: 'book-003' } }
    );
    expect(afternoonBody.assignedTo).toBe(3); // 3 students in afternoon class
  });

  it('accumulates multiple assignments for the same class', async () => {
    await routeRequest('post', '/classes/morning/assign-book', { body: { bookId: 'book-a' } });
    await routeRequest('post', '/classes/morning/assign-book', { body: { bookId: 'book-b' } });
    expect(_bookAssignments.get('morning')).toHaveLength(2);
  });
});

// ============================================================================
// 9. GET /classes/:classId/export — CSV export
// ============================================================================

describe('GET /classes/:classId/export', () => {
  it('returns 200 with Content-Type text/csv', async () => {
    const { status, headers } = await routeRequest('get', '/classes/morning/export');
    expect(status).toBe(200);
    expect(headers['content-type']).toMatch(/text\/csv/);
  });

  it('sets a Content-Disposition attachment header with a .csv filename', async () => {
    const { headers } = await routeRequest('get', '/classes/morning/export');
    expect(headers['content-disposition']).toMatch(/attachment/);
    expect(headers['content-disposition']).toMatch(/\.csv/);
  });

  it('the CSV body starts with the correct header row', async () => {
    const { text } = await routeRequest('get', '/classes/morning/export');
    expect(text).toBeTruthy();
    const firstLine = text.split('\n')[0];
    expect(firstLine).toContain('Student Name');
    expect(firstLine).toContain('Level');
    expect(firstLine).toContain('Sessions Completed');
    expect(firstLine).toContain('Avg Grammar Score');
    expect(firstLine).toContain('Vocabulary Count');
    expect(firstLine).toContain('Last Active');
  });

  it('includes one data row per student in the morning class', async () => {
    const { text } = await routeRequest('get', '/classes/morning/export');
    const lines = text.split('\n').filter((l) => l.trim() !== '');
    // 1 header + 4 data rows
    expect(lines.length).toBe(5);
  });

  it('each student row contains their name', async () => {
    const { text } = await routeRequest('get', '/classes/morning/export');
    expect(text).toContain('Mia Chen');
    expect(text).toContain('Leo Park');
    expect(text).toContain('Sophie Kim');
    expect(text).toContain('James Yoo');
  });

  it('returns 404 for a non-existent classId', async () => {
    const { status, body } = await routeRequest('get', '/classes/nonexistent/export');
    expect(status).toBe(404);
    expect(body).toHaveProperty('error');
  });

  it('returns 400 for a classId with invalid characters', async () => {
    const { status, body } = await routeRequest('get', '/classes/bad<id>/export');
    expect(status).toBe(400);
    expect(body).toHaveProperty('error');
  });

  it('saturday class CSV has 2 data rows', async () => {
    const { text } = await routeRequest('get', '/classes/saturday/export');
    const lines = text.split('\n').filter((l) => l.trim() !== '');
    expect(lines.length).toBe(3); // 1 header + 2 data rows
  });
});

// ============================================================================
// 10. GET /stats — dashboard overview stats
// ============================================================================

describe('GET /stats', () => {
  it('returns 200 with the expected stat fields', async () => {
    const { status, body } = await routeRequest('get', '/stats');
    expect(status).toBe(200);
    expect(body).toHaveProperty('totalStudents');
    expect(body).toHaveProperty('activeThisWeek');
    expect(body).toHaveProperty('avgCompletionRate');
    expect(body).toHaveProperty('avgGrammarScore');
    expect(body).toHaveProperty('topBooks');
  });

  it('totalStudents matches the total across all classes', async () => {
    const { body } = await routeRequest('get', '/stats');
    const expected = getAllStudents().length;
    expect(body.totalStudents).toBe(expected);
  });

  it('activeThisWeek is a non-negative integer', async () => {
    const { body } = await routeRequest('get', '/stats');
    expect(typeof body.activeThisWeek).toBe('number');
    expect(body.activeThisWeek).toBeGreaterThanOrEqual(0);
  });

  it('avgCompletionRate is between 0 and 100', async () => {
    const { body } = await routeRequest('get', '/stats');
    expect(body.avgCompletionRate).toBeGreaterThanOrEqual(0);
    expect(body.avgCompletionRate).toBeLessThanOrEqual(100);
  });

  it('avgGrammarScore is a non-negative integer', async () => {
    const { body } = await routeRequest('get', '/stats');
    expect(typeof body.avgGrammarScore).toBe('number');
    expect(body.avgGrammarScore).toBeGreaterThanOrEqual(0);
  });

  it('topBooks is an array of { title, sessionCount } objects', async () => {
    const { body } = await routeRequest('get', '/stats');
    expect(Array.isArray(body.topBooks)).toBe(true);
    for (const book of body.topBooks) {
      expect(book).toHaveProperty('title');
      expect(book).toHaveProperty('sessionCount');
      expect(typeof book.sessionCount).toBe('number');
    }
  });

  it('topBooks contains at most 5 entries', async () => {
    const { body } = await routeRequest('get', '/stats');
    expect(body.topBooks.length).toBeLessThanOrEqual(5);
  });

  it('topBooks are sorted by sessionCount descending', async () => {
    const { body } = await routeRequest('get', '/stats');
    const counts = body.topBooks.map((b) => b.sessionCount);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });
});

// ============================================================================
// 11. Edge cases — boundary and invalid inputs
// ============================================================================

describe('Edge cases', () => {
  it('GET /classes/:classId/students returns empty students array when class has no students', async () => {
    // saturday class does have 2 students — this verifies another well-seeded class
    const { body } = await routeRequest('get', '/classes/saturday/students');
    expect(Array.isArray(body.students)).toBe(true);
    expect(body.students.length).toBe(2);
  });

  it('POST assign-book with invalid dueDate returns 400', async () => {
    const { status, body } = await routeRequest(
      'post',
      '/classes/morning/assign-book',
      { body: { bookId: 'book-x', dueDate: 'not-valid-date' } }
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/dueDate/i);
  });

  it('_resetStore clears _bookAssignments between tests', async () => {
    await routeRequest('post', '/classes/morning/assign-book', { body: { bookId: 'book-reset' } });
    expect(_bookAssignments.has('morning')).toBe(true);

    _resetStore();

    expect(_bookAssignments.has('morning')).toBe(false);
    expect(_bookAssignments.size).toBe(0);
  });

  it('GET /students/:studentId/detail for s2 returns correct student name', async () => {
    const { body } = await routeRequest('get', '/students/s2/detail');
    expect(body.student.name).toBe('Leo Park');
  });

  it('stats avgGrammarScore is computed from all students with a grammarAvg', async () => {
    const { body } = await routeRequest('get', '/stats');
    const allStudents = getAllStudents();
    const studentsWithScore = allStudents.filter((s) => typeof s.grammarAvg === 'number');
    const expected = Math.round(
      studentsWithScore.reduce((sum, s) => sum + s.grammarAvg, 0) / studentsWithScore.length
    );
    expect(body.avgGrammarScore).toBe(expected);
  });

  it('CSV export for afternoon class contains all 3 student names', async () => {
    const { text } = await routeRequest('get', '/classes/afternoon/export');
    expect(text).toContain('Emma Davis');
    expect(text).toContain('Noah Wilson');
    expect(text).toContain('Ava Martinez');
  });
});
