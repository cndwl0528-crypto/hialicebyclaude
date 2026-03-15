/**
 * bookClub.test.js
 * HiAlice — Book Club API Unit Tests
 *
 * Tests the pure helper functions exported from routes/bookClub.js.
 * All tests are synchronous unit tests — no HTTP server, no network calls,
 * no Supabase or external dependencies.
 *
 * Design:
 *   - The in-memory store is reset before each test via _resetStore() so every
 *     test starts from a known, empty state (full isolation).
 *   - Handler logic is exercised through the exported pure helpers and the
 *     in-memory maps (_clubs, _memberships, _discussions) rather than through
 *     a live Express server, keeping the suite fast and deterministic.
 *   - Where HTTP-level behaviour needs to be verified the tests drive the
 *     route handlers directly through a lightweight mock req/res/next triple.
 *
 * Coverage areas:
 *   1. Club CRUD (8+ tests)
 *   2. Membership — join / leave / limits / duplicates (8+ tests)
 *   3. Discussions — post / list / pagination / empty (8+ tests)
 *   4. Privacy / COPPA — content filter, member-only visibility, no PII (6+ tests)
 *   5. Edge cases — non-existent club, empty inputs, boundary values (5+ tests)
 *
 * Run: cd backend && npx vitest run
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// Module-level mock: suppress logger output from contentFilter.js
// vi.mock() is hoisted to the top of the file by Vitest
// ============================================================================
vi.mock('../lib/logger.js', () => ({
  default: {
    warn:  vi.fn(),
    info:  vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  // In-memory stores (for direct state inspection in tests)
  _clubs,
  _memberships,
  _discussions,

  // Pure helper functions under test
  validateCreateClubInput,
  validateMembershipInput,
  validateDiscussionInput,
  getMemberships,
  getDiscussions,
  applyContentFilter,
  generateClubId,
  generateDiscussionId,

  // Store reset for test isolation
  _resetStore,
} from '../routes/bookClub.js';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a minimal mock request object with optional body, params, and query.
 *
 * @param {{ body?: object, params?: object, query?: object }} opts
 */
function makeReq(opts = {}) {
  return {
    body:   opts.body   ?? {},
    params: opts.params ?? {},
    query:  opts.query  ?? {},
  };
}

/**
 * Build a mock Express response with chainable status() and json() methods.
 * Captures the last status code and body so tests can assert on them.
 */
function makeRes() {
  const res = {
    _status: null,
    _body: null,
    status(code) {
      res._status = code;
      return res;
    },
    json(body) {
      res._body = body;
      return res;
    },
  };
  return res;
}

/**
 * Seed a club directly into the in-memory store.
 * Returns the seeded club object.
 *
 * @param {object} overrides
 * @returns {object}
 */
function seedClub(overrides = {}) {
  const club = Object.freeze({
    id:         overrides.id         ?? `club-seed-${Date.now()}`,
    name:       overrides.name       ?? 'Charlotte\'s Web Club',
    bookId:     overrides.bookId     ?? 'book-001',
    bookTitle:  overrides.bookTitle  ?? 'Charlotte\'s Web',
    createdBy:  overrides.createdBy  ?? 'student-creator',
    createdAt:  overrides.createdAt  ?? new Date().toISOString(),
    maxMembers: overrides.maxMembers ?? 6,
    level:      overrides.level      ?? 'intermediate',
    status:     overrides.status     ?? 'active',
  });
  _clubs.set(club.id, club);
  return club;
}

/**
 * Seed a membership directly into the in-memory store.
 *
 * @param {string} clubId
 * @param {object} overrides
 * @returns {object}
 */
function seedMembership(clubId, overrides = {}) {
  const membership = Object.freeze({
    clubId,
    studentId:   overrides.studentId   ?? 'stu-001',
    studentName: overrides.studentName ?? 'Alice',
    joinedAt:    overrides.joinedAt    ?? new Date().toISOString(),
    role:        overrides.role        ?? 'member',
  });
  const existing = getMemberships(clubId);
  _memberships.set(clubId, [...existing, membership]);
  return membership;
}

/**
 * Seed a discussion directly into the in-memory store.
 *
 * @param {string} clubId
 * @param {object} overrides
 * @returns {object}
 */
function seedDiscussion(clubId, overrides = {}) {
  const discussion = Object.freeze({
    id:             overrides.id             ?? `disc-seed-${Date.now()}`,
    clubId,
    studentId:      overrides.studentId      ?? 'stu-001',
    studentName:    overrides.studentName    ?? 'Alice',
    content:        overrides.content        ?? 'I loved how Charlotte saved Wilbur!',
    createdAt:      overrides.createdAt      ?? new Date().toISOString(),
    parentApproved: overrides.parentApproved ?? true,
    flags:          overrides.flags          ?? [],
  });
  const existing = getDiscussions(clubId);
  _discussions.set(clubId, [...existing, discussion]);
  return discussion;
}

// ============================================================================
// Import the Express router for route-level tests
// We drive handlers by invoking router.handle() with mock req/res objects.
// ============================================================================
import router from '../routes/bookClub.js';

/**
 * Drive a route handler through the Express router by sending a synthetic
 * request and returning a Promise that resolves when res.json() is called.
 *
 * @param {string} method  - HTTP method in lower case ('post', 'get', 'delete')
 * @param {string} path    - URL path (e.g. '/club-001/join')
 * @param {{ body?, query? }} opts
 * @returns {Promise<{ status: number, body: object }>}
 */
function routeRequest(method, path, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method: method.toUpperCase(),
      url: path,
      body:   opts.body  ?? {},
      query:  opts.query ?? {},
      params: {},
    };

    const res = {
      _status: 200,
      status(code) { this._status = code; return this; },
      json(body)   { resolve({ status: this._status, body }); return this; },
    };

    // Let the Express router dispatch the request
    router.handle(req, res, (err) => {
      if (err) reject(err);
      else reject(new Error(`No route matched: ${method.toUpperCase()} ${path}`));
    });
  });
}

// ============================================================================
// Reset store before every test
// ============================================================================
beforeEach(() => {
  _resetStore();
});

// ============================================================================
// 1. Club CRUD
// ============================================================================

describe('validateCreateClubInput', () => {
  it('returns valid:true for a well-formed input', () => {
    const result = validateCreateClubInput({
      name: 'Magic Tree House Club',
      bookId: 'book-42',
      bookTitle: 'Magic Tree House',
    });
    expect(result.valid).toBe(true);
    expect(result.data.name).toBe('Magic Tree House Club');
    expect(result.data.maxMembers).toBe(6); // default
  });

  it('returns valid:false when name is missing', () => {
    const result = validateCreateClubInput({ bookId: 'b1', bookTitle: 'Title' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/name/i);
  });

  it('returns valid:false when name exceeds 80 characters', () => {
    const result = validateCreateClubInput({
      name: 'A'.repeat(81),
      bookId: 'b1',
      bookTitle: 'Title',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/name/i);
  });

  it('returns valid:false when bookId is missing', () => {
    const result = validateCreateClubInput({ name: 'Club', bookTitle: 'Title' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/bookId/i);
  });

  it('returns valid:false when bookTitle is missing', () => {
    const result = validateCreateClubInput({ name: 'Club', bookId: 'b1' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/bookTitle/i);
  });

  it('accepts maxMembers within the valid range (2–12)', () => {
    const result = validateCreateClubInput({
      name: 'Club', bookId: 'b1', bookTitle: 'T', maxMembers: 10,
    });
    expect(result.valid).toBe(true);
    expect(result.data.maxMembers).toBe(10);
  });

  it('returns valid:false when maxMembers exceeds 12', () => {
    const result = validateCreateClubInput({
      name: 'Club', bookId: 'b1', bookTitle: 'T', maxMembers: 13,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/maxMembers/i);
  });

  it('returns valid:false when maxMembers is below 2', () => {
    const result = validateCreateClubInput({
      name: 'Club', bookId: 'b1', bookTitle: 'T', maxMembers: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/maxMembers/i);
  });

  it('accepts a valid level value', () => {
    const result = validateCreateClubInput({
      name: 'Club', bookId: 'b1', bookTitle: 'T', level: 'advanced',
    });
    expect(result.valid).toBe(true);
    expect(result.data.level).toBe('advanced');
  });

  it('returns valid:false for an unrecognised level', () => {
    const result = validateCreateClubInput({
      name: 'Club', bookId: 'b1', bookTitle: 'T', level: 'expert',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/level/i);
  });

  it('normalises level to lower case', () => {
    const result = validateCreateClubInput({
      name: 'Club', bookId: 'b1', bookTitle: 'T', level: 'BEGINNER',
    });
    expect(result.valid).toBe(true);
    expect(result.data.level).toBe('beginner');
  });
});

describe('POST /api/book-clubs — create club', () => {
  it('creates a club and returns 201 with the club object', async () => {
    const { status, body } = await routeRequest('post', '/', {
      body: {
        name: 'Readers Circle',
        bookId: 'book-1',
        bookTitle: 'Fantastic Mr Fox',
        createdBy: 'stu-creator',
      },
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.club).toMatchObject({
      name: 'Readers Circle',
      bookId: 'book-1',
      bookTitle: 'Fantastic Mr Fox',
      createdBy: 'stu-creator',
      status: 'active',
      maxMembers: 6,
    });
    expect(body.club.id).toBeTruthy();
    expect(_clubs.size).toBe(1);
  });

  it('returns 400 when required field is missing', async () => {
    const { status, body } = await routeRequest('post', '/', {
      body: { bookId: 'b1', bookTitle: 'T', createdBy: 'stu-1' }, // name missing
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeTruthy();
  });

  it('returns 400 when createdBy is missing', async () => {
    const { status, body } = await routeRequest('post', '/', {
      body: { name: 'Club', bookId: 'b1', bookTitle: 'T' }, // createdBy missing
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('stores newly created club in the in-memory map', async () => {
    await routeRequest('post', '/', {
      body: {
        name: 'Test Club',
        bookId: 'b2',
        bookTitle: 'Book 2',
        createdBy: 'stu-x',
        maxMembers: 4,
        level: 'beginner',
      },
    });
    expect(_clubs.size).toBe(1);
    const stored = Array.from(_clubs.values())[0];
    expect(stored.maxMembers).toBe(4);
    expect(stored.level).toBe('beginner');
  });
});

describe('GET /api/book-clubs — list clubs', () => {
  it('returns an empty list when no clubs exist', async () => {
    const { status, body } = await routeRequest('get', '/');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.clubs).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it('returns only active clubs by default', async () => {
    seedClub({ id: 'c1', status: 'active' });
    seedClub({ id: 'c2', status: 'archived' });
    const { body } = await routeRequest('get', '/');
    expect(body.clubs).toHaveLength(1);
    expect(body.clubs[0].id).toBe('c1');
  });

  it('filters by level when query param is provided', async () => {
    seedClub({ id: 'c1', level: 'beginner' });
    seedClub({ id: 'c2', level: 'advanced' });
    const { body } = await routeRequest('get', '/', { query: { level: 'beginner' } });
    expect(body.clubs).toHaveLength(1);
    expect(body.clubs[0].level).toBe('beginner');
  });

  it('filters by bookId when query param is provided', async () => {
    seedClub({ id: 'c1', bookId: 'book-a' });
    seedClub({ id: 'c2', bookId: 'book-b' });
    const { body } = await routeRequest('get', '/', { query: { bookId: 'book-a' } });
    expect(body.clubs).toHaveLength(1);
    expect(body.clubs[0].bookId).toBe('book-a');
  });

  it('includes memberCount on each club entry', async () => {
    const club = seedClub({ id: 'c1' });
    seedMembership(club.id, { studentId: 's1' });
    seedMembership(club.id, { studentId: 's2' });
    const { body } = await routeRequest('get', '/');
    expect(body.clubs[0].memberCount).toBe(2);
  });

  it('marks a full club with isFull:true', async () => {
    const club = seedClub({ id: 'c1', maxMembers: 2 });
    seedMembership(club.id, { studentId: 's1' });
    seedMembership(club.id, { studentId: 's2' });
    const { body } = await routeRequest('get', '/');
    expect(body.clubs[0].isFull).toBe(true);
  });
});

describe('GET /api/book-clubs/:id — get club detail', () => {
  it('returns club detail, members, and discussions for a known club', async () => {
    const club = seedClub({ id: 'c1' });
    seedMembership('c1', { studentId: 's1', studentName: 'Bob' });
    seedDiscussion('c1', { id: 'd1', content: 'Great book!' });

    const { status, body } = await routeRequest('get', '/c1');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.club.id).toBe('c1');
    expect(body.members).toHaveLength(1);
    expect(body.members[0].studentName).toBe('Bob');
    expect(body.discussions).toHaveLength(1);
    expect(body.discussions[0].content).toBe('Great book!');
  });

  it('returns 404 for a non-existent club', async () => {
    const { status, body } = await routeRequest('get', '/nonexistent');
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });

  it('returns empty members and discussions arrays for a brand new club', async () => {
    seedClub({ id: 'c2' });
    const { body } = await routeRequest('get', '/c2');
    expect(body.members).toHaveLength(0);
    expect(body.discussions).toHaveLength(0);
  });
});

describe('DELETE /api/book-clubs/:id — delete club', () => {
  it('archives the club when called by the creator', async () => {
    seedClub({ id: 'c1', createdBy: 'stu-creator' });
    const { status, body } = await routeRequest('delete', '/c1', {
      body: { requesterId: 'stu-creator' },
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(_clubs.get('c1').status).toBe('archived');
  });

  it('returns 403 when a non-creator attempts deletion', async () => {
    seedClub({ id: 'c1', createdBy: 'stu-creator' });
    const { status, body } = await routeRequest('delete', '/c1', {
      body: { requesterId: 'stu-intruder' },
    });
    expect(status).toBe(403);
    expect(body.success).toBe(false);
  });

  it('returns 404 when the club does not exist', async () => {
    const { status, body } = await routeRequest('delete', '/ghost', {
      body: { requesterId: 'stu-creator' },
    });
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });

  it('returns 400 when requesterId is not provided', async () => {
    seedClub({ id: 'c1', createdBy: 'stu-creator' });
    const { status, body } = await routeRequest('delete', '/c1', { body: {} });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });
});

// ============================================================================
// 2. Membership — join / leave / limits / duplicates
// ============================================================================

describe('validateMembershipInput', () => {
  it('passes when studentId is provided and name is not required', () => {
    const result = validateMembershipInput({ studentId: 'stu-1' }, false);
    expect(result.valid).toBe(true);
  });

  it('fails when studentId is missing', () => {
    const result = validateMembershipInput({}, false);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/studentId/i);
  });

  it('fails when studentName is required but missing', () => {
    const result = validateMembershipInput({ studentId: 'stu-1' }, true);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/studentName/i);
  });

  it('passes when both studentId and studentName are provided', () => {
    const result = validateMembershipInput(
      { studentId: 'stu-1', studentName: 'Emma' },
      true
    );
    expect(result.valid).toBe(true);
  });
});

describe('POST /api/book-clubs/:id/join — join club', () => {
  it('adds a student as a member and returns 201', async () => {
    seedClub({ id: 'c1' });
    const { status, body } = await routeRequest('post', '/c1/join', {
      body: { studentId: 'stu-1', studentName: 'Emma' },
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.membership.studentId).toBe('stu-1');
    expect(body.membership.role).toBe('member');
    expect(getMemberships('c1')).toHaveLength(1);
  });

  it('returns 404 when club does not exist', async () => {
    const { status, body } = await routeRequest('post', '/ghost/join', {
      body: { studentId: 'stu-1', studentName: 'Emma' },
    });
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });

  it('returns 400 when required join fields are missing', async () => {
    seedClub({ id: 'c1' });
    const { status, body } = await routeRequest('post', '/c1/join', {
      body: { studentId: 'stu-1' }, // studentName missing
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns 409 when the student attempts to join twice', async () => {
    seedClub({ id: 'c1' });
    seedMembership('c1', { studentId: 'stu-1', studentName: 'Emma' });

    const { status, body } = await routeRequest('post', '/c1/join', {
      body: { studentId: 'stu-1', studentName: 'Emma' },
    });
    expect(status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/already a member/i);
  });

  it('returns 400 when the club has reached its maxMembers limit', async () => {
    const club = seedClub({ id: 'c1', maxMembers: 2 });
    seedMembership('c1', { studentId: 's1' });
    seedMembership('c1', { studentId: 's2' });

    const { status, body } = await routeRequest('post', '/c1/join', {
      body: { studentId: 'stu-new', studentName: 'New Kid' },
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/full/i);
  });

  it('records the joinedAt timestamp on the membership', async () => {
    seedClub({ id: 'c1' });
    const before = new Date().toISOString();
    await routeRequest('post', '/c1/join', {
      body: { studentId: 'stu-1', studentName: 'Emma' },
    });
    const after = new Date().toISOString();
    const membership = getMemberships('c1')[0];
    expect(membership.joinedAt >= before).toBe(true);
    expect(membership.joinedAt <= after).toBe(true);
  });

  it('does not add a member to an archived club', async () => {
    seedClub({ id: 'c1', status: 'archived' });
    const { status, body } = await routeRequest('post', '/c1/join', {
      body: { studentId: 'stu-1', studentName: 'Emma' },
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/not active/i);
  });
});

describe('POST /api/book-clubs/:id/leave — leave club', () => {
  it('removes a member and returns 200', async () => {
    seedClub({ id: 'c1' });
    seedMembership('c1', { studentId: 'stu-1' });

    const { status, body } = await routeRequest('post', '/c1/leave', {
      body: { studentId: 'stu-1' },
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(getMemberships('c1')).toHaveLength(0);
  });

  it('returns 404 when the student is not a member', async () => {
    seedClub({ id: 'c1' });
    const { status, body } = await routeRequest('post', '/c1/leave', {
      body: { studentId: 'stu-nonmember' },
    });
    expect(status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/not a member/i);
  });

  it('returns 404 when the club does not exist', async () => {
    const { status, body } = await routeRequest('post', '/ghost/leave', {
      body: { studentId: 'stu-1' },
    });
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });

  it('returns 400 when studentId is not provided', async () => {
    seedClub({ id: 'c1' });
    const { status, body } = await routeRequest('post', '/c1/leave', { body: {} });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('does not affect other members when one leaves', async () => {
    seedClub({ id: 'c1' });
    seedMembership('c1', { studentId: 's1' });
    seedMembership('c1', { studentId: 's2' });
    seedMembership('c1', { studentId: 's3' });

    await routeRequest('post', '/c1/leave', { body: { studentId: 's2' } });

    const remaining = getMemberships('c1').map((m) => m.studentId);
    expect(remaining).toContain('s1');
    expect(remaining).not.toContain('s2');
    expect(remaining).toContain('s3');
  });
});

// ============================================================================
// 3. Discussions — post / list / pagination / empty
// ============================================================================

describe('validateDiscussionInput', () => {
  it('returns valid:true for well-formed input', () => {
    const result = validateDiscussionInput({
      studentId:   'stu-1',
      studentName: 'Alice',
      content:     'I love Charlotte!',
    });
    expect(result.valid).toBe(true);
    expect(result.data.content).toBe('I love Charlotte!');
  });

  it('returns valid:false when content is missing', () => {
    const result = validateDiscussionInput({ studentId: 'stu-1', studentName: 'Alice' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/content/i);
  });

  it('returns valid:false when content exceeds 1000 characters', () => {
    const result = validateDiscussionInput({
      studentId:   'stu-1',
      studentName: 'Alice',
      content:     'X'.repeat(1001),
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/content/i);
  });

  it('returns valid:false when studentId is missing', () => {
    const result = validateDiscussionInput({ studentName: 'Alice', content: 'Hello' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/studentId/i);
  });

  it('returns valid:false when studentName is missing', () => {
    const result = validateDiscussionInput({ studentId: 'stu-1', content: 'Hello' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/studentName/i);
  });

  it('trims whitespace from content', () => {
    const result = validateDiscussionInput({
      studentId:   'stu-1',
      studentName: 'Alice',
      content:     '  Great book!  ',
    });
    expect(result.valid).toBe(true);
    expect(result.data.content).toBe('Great book!');
  });
});

describe('POST /api/book-clubs/:id/discussions — post discussion', () => {
  it('posts a message and returns 201 when student is a member', async () => {
    seedClub({ id: 'c1' });
    seedMembership('c1', { studentId: 'stu-1', studentName: 'Emma' });

    const { status, body } = await routeRequest('post', '/c1/discussions', {
      body: {
        studentId:   'stu-1',
        studentName: 'Emma',
        content:     'Charlotte was so brave!',
      },
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.discussion.content).toBe('Charlotte was so brave!');
    expect(body.discussion.clubId).toBe('c1');
    expect(body.discussion.id).toBeTruthy();
  });

  it('returns 403 when the poster is not a member', async () => {
    seedClub({ id: 'c1' });
    // no membership seeded

    const { status, body } = await routeRequest('post', '/c1/discussions', {
      body: {
        studentId:   'stu-outsider',
        studentName: 'Outsider',
        content:     'Let me in!',
      },
    });
    expect(status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/member/i);
  });

  it('returns 404 when club does not exist', async () => {
    const { status, body } = await routeRequest('post', '/ghost/discussions', {
      body: { studentId: 'stu-1', studentName: 'Emma', content: 'Hello' },
    });
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });

  it('returns 400 when content is missing', async () => {
    seedClub({ id: 'c1' });
    seedMembership('c1', { studentId: 'stu-1', studentName: 'Emma' });

    const { status, body } = await routeRequest('post', '/c1/discussions', {
      body: { studentId: 'stu-1', studentName: 'Emma' }, // content missing
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('stores the discussion in the in-memory map', async () => {
    seedClub({ id: 'c1' });
    seedMembership('c1', { studentId: 'stu-1', studentName: 'Emma' });

    await routeRequest('post', '/c1/discussions', {
      body: { studentId: 'stu-1', studentName: 'Emma', content: 'What a story!' },
    });

    expect(getDiscussions('c1')).toHaveLength(1);
  });

  it('does not allow posting to an archived club', async () => {
    seedClub({ id: 'c1', status: 'archived' });
    seedMembership('c1', { studentId: 'stu-1', studentName: 'Emma' });

    const { status, body } = await routeRequest('post', '/c1/discussions', {
      body: { studentId: 'stu-1', studentName: 'Emma', content: 'Hello?' },
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });
});

describe('GET /api/book-clubs/:id/discussions — list discussions', () => {
  it('returns an empty list when no approved discussions exist', async () => {
    seedClub({ id: 'c1' });
    const { status, body } = await routeRequest('get', '/c1/discussions');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.discussions).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it('returns 404 when the club does not exist', async () => {
    const { status, body } = await routeRequest('get', '/ghost/discussions');
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });

  it('paginates with limit and offset', async () => {
    const club = seedClub({ id: 'c1' });
    for (let i = 0; i < 5; i++) {
      seedDiscussion('c1', { id: `d${i}`, content: `Message ${i}` });
    }
    const { body } = await routeRequest('get', '/c1/discussions', {
      query: { limit: '2', offset: '1' },
    });
    expect(body.discussions).toHaveLength(2);
    expect(body.total).toBe(5);
  });

  it('clamps limit to MAX_DISCUSSIONS_LIMIT when over 100', async () => {
    const club = seedClub({ id: 'c1' });
    for (let i = 0; i < 5; i++) {
      seedDiscussion('c1', { id: `d${i}` });
    }
    const { body } = await routeRequest('get', '/c1/discussions', {
      query: { limit: '999' },
    });
    // limit is clamped; total still reflects all approved messages
    expect(body.total).toBe(5);
    expect(body.discussions.length).toBeLessThanOrEqual(100);
  });

  it('excludes flagged (parentApproved: false) discussions from the list', async () => {
    seedClub({ id: 'c1' });
    seedDiscussion('c1', { id: 'd1', parentApproved: true,  content: 'Good message' });
    seedDiscussion('c1', { id: 'd2', parentApproved: false, content: 'Flagged message' });

    const { body } = await routeRequest('get', '/c1/discussions');
    expect(body.discussions).toHaveLength(1);
    expect(body.discussions[0].content).toBe('Good message');
  });
});

// ============================================================================
// 4. Privacy / COPPA compliance
// ============================================================================

describe('applyContentFilter — COPPA content filtering', () => {
  it('returns safe:true for normal educational discussion content', () => {
    const result = applyContentFilter(
      'I think Charlotte saved Wilbur because she was a true friend.',
      'stu-1'
    );
    expect(result.safe).toBe(true);
    expect(result.flags).toHaveLength(0);
  });

  it('flags content that contains self-harm signals', () => {
    const result = applyContentFilter(
      'I want to hurt myself because nobody likes me.',
      'stu-danger'
    );
    expect(result.safe).toBe(false);
    expect(result.flags.length).toBeGreaterThan(0);
  });

  it('flags content where student shares a phone number (PII)', () => {
    const result = applyContentFilter(
      'Call me at 555-123-4567 after school!',
      'stu-pii'
    );
    expect(result.safe).toBe(false);
    expect(result.flags.some((f) => f.includes('phone'))).toBe(true);
  });

  it('flags content where student shares an email address (PII)', () => {
    const result = applyContentFilter(
      'My email is student@school.com, send me more books!',
      'stu-email'
    );
    expect(result.safe).toBe(false);
    expect(result.flags.some((f) => f.includes('email'))).toBe(true);
  });

  it('does NOT modify the original content text (student input is never altered)', () => {
    const originalContent = 'I want to hurt myself.';
    const result = applyContentFilter(originalContent, 'stu-x');
    // Content is preserved as-is — only flagged for admin review
    expect(result.content).toBe(originalContent);
  });

  it('stores flagged discussions with parentApproved:false so admins must review', async () => {
    seedClub({ id: 'c1' });
    seedMembership('c1', { studentId: 'stu-1', studentName: 'TestKid' });

    // A message containing a phone number will be flagged by contentFilter
    await routeRequest('post', '/c1/discussions', {
      body: {
        studentId:   'stu-1',
        studentName: 'TestKid',
        content:     'My number is 555-867-5309',
      },
    });

    const stored = getDiscussions('c1');
    expect(stored).toHaveLength(1);
    expect(stored[0].parentApproved).toBe(false);
    expect(stored[0].flags.length).toBeGreaterThan(0);
  });

  it('approved messages are visible in the discussion list while flagged ones are not', async () => {
    seedClub({ id: 'c1' });
    seedDiscussion('c1', { id: 'd-safe', parentApproved: true,  content: 'Books are great!' });
    seedDiscussion('c1', { id: 'd-flag', parentApproved: false, content: 'Call 555-123-4567' });

    const { body } = await routeRequest('get', '/c1/discussions');
    expect(body.discussions).toHaveLength(1);
    expect(body.discussions[0].content).toBe('Books are great!');
  });

  it('club list endpoint does not expose member identities', async () => {
    const club = seedClub({ id: 'c1' });
    seedMembership('c1', { studentId: 'stu-secret', studentName: 'SecretName' });

    const { body } = await routeRequest('get', '/');
    // List endpoint should include memberCount but not student names / IDs
    expect(body.clubs[0].memberCount).toBe(1);
    const clubStr = JSON.stringify(body.clubs[0]);
    expect(clubStr).not.toContain('stu-secret');
    expect(clubStr).not.toContain('SecretName');
  });
});

// ============================================================================
// 5. Edge cases
// ============================================================================

describe('getMemberships and getDiscussions helpers', () => {
  it('getMemberships returns empty array for an unknown club', () => {
    expect(getMemberships('no-such-club')).toEqual([]);
  });

  it('getDiscussions returns empty array for an unknown club', () => {
    expect(getDiscussions('no-such-club')).toEqual([]);
  });
});

describe('generateClubId and generateDiscussionId', () => {
  it('generateClubId produces a unique id each call', () => {
    const id1 = generateClubId();
    const id2 = generateClubId();
    expect(id1).not.toBe(id2);
  });

  it('generateDiscussionId produces a unique id each call', () => {
    const id1 = generateDiscussionId();
    const id2 = generateDiscussionId();
    expect(id1).not.toBe(id2);
  });
});

describe('Edge cases — boundary and invalid inputs', () => {
  it('handles empty body on create club gracefully (returns 400)', async () => {
    const { status, body } = await routeRequest('post', '/', { body: {} });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('handles empty body on join gracefully (returns 400)', async () => {
    seedClub({ id: 'c1' });
    const { status, body } = await routeRequest('post', '/c1/join', { body: {} });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('handles empty body on discussion post gracefully (returns 400)', async () => {
    seedClub({ id: 'c1' });
    seedMembership('c1', { studentId: 'stu-1' });
    const { status, body } = await routeRequest('post', '/c1/discussions', { body: {} });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('allows a club with maxMembers exactly at the hard limit of 12', async () => {
    const result = validateCreateClubInput({
      name: 'Big Club',
      bookId: 'b1',
      bookTitle: 'T',
      maxMembers: 12,
    });
    expect(result.valid).toBe(true);
    expect(result.data.maxMembers).toBe(12);
  });

  it('allows a club name of exactly 80 characters', () => {
    const result = validateCreateClubInput({
      name: 'A'.repeat(80),
      bookId: 'b1',
      bookTitle: 'T',
    });
    expect(result.valid).toBe(true);
  });

  it('discussion content at exactly 1000 characters is accepted', () => {
    const result = validateDiscussionInput({
      studentId:   'stu-1',
      studentName: 'Alice',
      content:     'X'.repeat(1000),
    });
    expect(result.valid).toBe(true);
  });

  it('multiple clubs can be created independently', async () => {
    for (let i = 0; i < 5; i++) {
      await routeRequest('post', '/', {
        body: {
          name:      `Club ${i}`,
          bookId:    `b${i}`,
          bookTitle: `Book ${i}`,
          createdBy: `creator-${i}`,
        },
      });
    }
    expect(_clubs.size).toBe(5);
  });

  it('_resetStore clears all maps and resets counters between tests', () => {
    seedClub({ id: 'c-before' });
    seedMembership('c-before', { studentId: 's1' });
    _resetStore();

    expect(_clubs.size).toBe(0);
    expect(_memberships.size).toBe(0);
    expect(_discussions.size).toBe(0);

    // IDs restart from 1 after reset
    const id = generateClubId();
    expect(id).toBe('club-1');
  });
});
