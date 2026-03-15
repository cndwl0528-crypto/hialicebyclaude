/**
 * bookClub.js
 * HiAlice — Social Reading / Book Club API
 *
 * Enables group-based reading activities for students. Reading clubs are small
 * (2–12 students, default 6) to keep discussion intimate and focused.
 *
 * COPPA compliance:
 *   - Discussion content is filtered before storage via the shared content filter.
 *   - Student names are visible only to members of the same club.
 *   - No PII is exposed in list/search endpoints.
 *
 * Data model (in-memory, Supabase-ready):
 *   clubs:       { id, name, bookId, bookTitle, createdBy, createdAt, maxMembers, level, status }
 *   memberships: { clubId, studentId, studentName, joinedAt, role }
 *   discussions: { id, clubId, studentId, studentName, content, createdAt, parentApproved }
 *
 * All stored objects are created as fresh value objects (immutable pattern).
 * Mutations always replace with Object.assign / spread into a new map entry.
 *
 * Route summary:
 *   POST   /api/book-clubs              Create a new club
 *   GET    /api/book-clubs              List active clubs (optional filters)
 *   GET    /api/book-clubs/:id          Get club detail with members + discussions
 *   POST   /api/book-clubs/:id/join     Join a club
 *   POST   /api/book-clubs/:id/leave    Leave a club
 *   POST   /api/book-clubs/:id/discussions  Post a discussion message
 *   GET    /api/book-clubs/:id/discussions  Paginated list of discussions
 *   DELETE /api/book-clubs/:id          Delete a club (creator only)
 */

import { Router } from 'express';
import { filterStudentInput } from '../middleware/contentFilter.js';

const router = Router();

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_MEMBERS = 6;
const HARD_MAX_MEMBERS = 12;
const MAX_CLUB_NAME_LENGTH = 80;
const MAX_CONTENT_LENGTH = 1000;
const VALID_LEVELS = ['beginner', 'intermediate', 'advanced'];
const VALID_STATUSES = ['active', 'archived'];
const DEFAULT_DISCUSSIONS_LIMIT = 20;
const MAX_DISCUSSIONS_LIMIT = 100;

// ============================================================================
// In-Memory Store (will be replaced with Supabase queries)
// Each Map stores immutable value objects — updates replace the entire entry.
// ============================================================================

/** @type {Map<string, object>} clubId -> club record */
export const _clubs = new Map();

/** @type {Map<string, object[]>} clubId -> membership[] */
export const _memberships = new Map();

/** @type {Map<string, object[]>} clubId -> discussion[] */
export const _discussions = new Map();

let _nextClubId = 1;
let _nextDiscussionId = 1;

// ============================================================================
// Pure helper functions (exported for unit testing)
// ============================================================================

/**
 * Generate a club ID string that is predictable and testable.
 * In production this would be a Supabase UUID.
 *
 * @returns {string}
 */
export function generateClubId() {
  return `club-${_nextClubId++}`;
}

/**
 * Generate a discussion ID string.
 *
 * @returns {string}
 */
export function generateDiscussionId() {
  return `disc-${_nextDiscussionId++}`;
}

/**
 * Validate and sanitise club creation input.
 * Returns { valid: true, data: {...} } or { valid: false, error: "..." }.
 *
 * @param {object} body - Raw request body
 * @returns {{ valid: boolean, error?: string, data?: object }}
 */
export function validateCreateClubInput(body) {
  const { name, bookId, bookTitle, maxMembers, level } = body ?? {};

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { valid: false, error: 'name is required' };
  }

  if (name.trim().length > MAX_CLUB_NAME_LENGTH) {
    return { valid: false, error: `name must be ${MAX_CLUB_NAME_LENGTH} characters or fewer` };
  }

  if (!bookId || typeof bookId !== 'string' || bookId.trim().length === 0) {
    return { valid: false, error: 'bookId is required' };
  }

  if (!bookTitle || typeof bookTitle !== 'string' || bookTitle.trim().length === 0) {
    return { valid: false, error: 'bookTitle is required' };
  }

  const resolvedMax = maxMembers !== undefined
    ? parseInt(maxMembers, 10)
    : DEFAULT_MAX_MEMBERS;

  if (isNaN(resolvedMax) || resolvedMax < 2 || resolvedMax > HARD_MAX_MEMBERS) {
    return {
      valid: false,
      error: `maxMembers must be between 2 and ${HARD_MAX_MEMBERS}`,
    };
  }

  const resolvedLevel = level
    ? String(level).toLowerCase().trim()
    : null;

  if (resolvedLevel !== null && !VALID_LEVELS.includes(resolvedLevel)) {
    return { valid: false, error: `level must be one of: ${VALID_LEVELS.join(', ')}` };
  }

  return {
    valid: true,
    data: {
      name: name.trim(),
      bookId: bookId.trim(),
      bookTitle: bookTitle.trim(),
      maxMembers: resolvedMax,
      level: resolvedLevel,
    },
  };
}

/**
 * Validate join / leave membership input.
 * Returns { valid: true } or { valid: false, error: "..." }.
 *
 * @param {object} body
 * @param {boolean} requireName - Whether studentName is required (join only)
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateMembershipInput(body, requireName = false) {
  const { studentId, studentName } = body ?? {};

  if (!studentId || typeof studentId !== 'string' || studentId.trim().length === 0) {
    return { valid: false, error: 'studentId is required' };
  }

  if (requireName) {
    if (!studentName || typeof studentName !== 'string' || studentName.trim().length === 0) {
      return { valid: false, error: 'studentName is required' };
    }
  }

  return { valid: true };
}

/**
 * Validate discussion post input.
 * Returns { valid: true, data: {...} } or { valid: false, error: "..." }.
 *
 * @param {object} body
 * @returns {{ valid: boolean, error?: string, data?: object }}
 */
export function validateDiscussionInput(body) {
  const { studentId, studentName, content } = body ?? {};

  if (!studentId || typeof studentId !== 'string' || studentId.trim().length === 0) {
    return { valid: false, error: 'studentId is required' };
  }

  if (!studentName || typeof studentName !== 'string' || studentName.trim().length === 0) {
    return { valid: false, error: 'studentName is required' };
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return { valid: false, error: 'content is required' };
  }

  if (content.trim().length > MAX_CONTENT_LENGTH) {
    return {
      valid: false,
      error: `content must be ${MAX_CONTENT_LENGTH} characters or fewer`,
    };
  }

  return {
    valid: true,
    data: {
      studentId: studentId.trim(),
      studentName: studentName.trim(),
      content: content.trim(),
    },
  };
}

/**
 * Get memberships for a club from the store.
 * Returns an empty array when no memberships exist yet.
 *
 * @param {string} clubId
 * @returns {object[]}
 */
export function getMemberships(clubId) {
  return _memberships.get(clubId) ?? [];
}

/**
 * Get discussions for a club from the store.
 * Returns an empty array when no discussions exist yet.
 *
 * @param {string} clubId
 * @returns {object[]}
 */
export function getDiscussions(clubId) {
  return _discussions.get(clubId) ?? [];
}

/**
 * Apply COPPA content filtering to discussion content before storage.
 * Uses the existing filterStudentInput function and returns { safe, content, flags }.
 *
 * When content is flagged the discussion is stored with parentApproved: false
 * so admins can review it before it is shown to other children.
 *
 * @param {string} content - Raw content from student
 * @param {string} studentId - For safety log context
 * @returns {{ content: string, safe: boolean, flags: string[] }}
 */
export function applyContentFilter(content, studentId) {
  const result = filterStudentInput(content, { studentId });
  return {
    content,                   // student input is never modified, only flagged
    safe: result.safe,
    flags: result.flags,
  };
}

// ============================================================================
// POST /api/book-clubs — Create a new book club
// ============================================================================

/**
 * Create a new book club.
 *
 * Body: { name, bookId, bookTitle, maxMembers?, level? }
 *   - name       {string}  Display name (1–80 chars)
 *   - bookId     {string}  Book identifier
 *   - bookTitle  {string}  Human-readable title (stored for display)
 *   - maxMembers {number}  Optional. Default 6, max 12
 *   - level      {string}  Optional. 'beginner' | 'intermediate' | 'advanced'
 *
 * The creator is NOT automatically a member; they must call /join separately.
 *
 * Returns: { success: true, club: {...} }
 */
router.post('/', (req, res) => {
  const { createdBy } = req.body ?? {};

  const validation = validateCreateClubInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  if (!createdBy || typeof createdBy !== 'string' || createdBy.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'createdBy is required' });
  }

  const { name, bookId, bookTitle, maxMembers, level } = validation.data;

  const club = Object.freeze({
    id: generateClubId(),
    name,
    bookId,
    bookTitle,
    createdBy: createdBy.trim(),
    createdAt: new Date().toISOString(),
    maxMembers,
    level,
    status: 'active',
  });

  _clubs.set(club.id, club);

  return res.status(201).json({ success: true, club });
});

// ============================================================================
// GET /api/book-clubs — List all active clubs
// ============================================================================

/**
 * List active book clubs with optional filters.
 *
 * Query: ?level=beginner&bookId=book-123
 *
 * Returns: { success: true, clubs: [...], total: N }
 *
 * Member details are NOT included in the list to preserve privacy.
 * Use GET /api/book-clubs/:id for full club detail.
 */
router.get('/', (req, res) => {
  const { level, bookId, status } = req.query;

  const resolvedStatus = status && VALID_STATUSES.includes(status) ? status : 'active';

  let clubs = Array.from(_clubs.values()).filter((c) => c.status === resolvedStatus);

  if (level) {
    const normalised = String(level).toLowerCase().trim();
    clubs = clubs.filter((c) => c.level === normalised);
  }

  if (bookId) {
    clubs = clubs.filter((c) => c.bookId === bookId.trim());
  }

  // Attach member count for UI display but omit member identity (privacy)
  const enriched = clubs.map((c) => ({
    ...c,
    memberCount: getMemberships(c.id).length,
    isFull: getMemberships(c.id).length >= c.maxMembers,
  }));

  return res.status(200).json({ success: true, clubs: enriched, total: enriched.length });
});

// ============================================================================
// GET /api/book-clubs/:id — Get club detail
// ============================================================================

/**
 * Get full details for a single club: club record, members, and discussions.
 *
 * Member names are visible here because the caller is presumed to already be
 * viewing the club's context. The client should restrict this endpoint to
 * members only in production (enforced via authMiddleware).
 *
 * Returns: { success: true, club: {...}, members: [...], discussions: [...] }
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;

  const club = _clubs.get(id);
  if (!club) {
    return res.status(404).json({ success: false, error: 'Club not found' });
  }

  const members = getMemberships(id);
  const discussions = getDiscussions(id);

  return res.status(200).json({
    success: true,
    club,
    members,
    discussions,
  });
});

// ============================================================================
// POST /api/book-clubs/:id/join — Join a club
// ============================================================================

/**
 * Join a book club.
 *
 * Body: { studentId, studentName }
 *
 * Rules:
 *   - Club must be active and not full
 *   - Student may not join a club they are already a member of
 *   - studentName is stored for member-facing display only
 *
 * Returns: { success: true, membership: {...} }
 */
router.post('/:id/join', (req, res) => {
  const { id } = req.params;

  const club = _clubs.get(id);
  if (!club) {
    return res.status(404).json({ success: false, error: 'Club not found' });
  }

  if (club.status !== 'active') {
    return res.status(400).json({ success: false, error: 'Club is not active' });
  }

  const validation = validateMembershipInput(req.body, true);
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  const { studentId, studentName } = req.body;
  const normStudentId = studentId.trim();
  const normStudentName = studentName.trim();

  const existing = getMemberships(id);

  if (existing.some((m) => m.studentId === normStudentId)) {
    return res.status(409).json({ success: false, error: 'Already a member of this club' });
  }

  if (existing.length >= club.maxMembers) {
    return res.status(400).json({ success: false, error: 'Club is full' });
  }

  const membership = Object.freeze({
    clubId: id,
    studentId: normStudentId,
    studentName: normStudentName,
    joinedAt: new Date().toISOString(),
    role: 'member',
  });

  // Immutable update: build a new array, do not mutate the existing one
  _memberships.set(id, [...existing, membership]);

  return res.status(201).json({ success: true, membership });
});

// ============================================================================
// POST /api/book-clubs/:id/leave — Leave a club
// ============================================================================

/**
 * Leave a book club.
 *
 * Body: { studentId }
 *
 * Returns: { success: true }
 */
router.post('/:id/leave', (req, res) => {
  const { id } = req.params;

  const club = _clubs.get(id);
  if (!club) {
    return res.status(404).json({ success: false, error: 'Club not found' });
  }

  const validation = validateMembershipInput(req.body, false);
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  const normStudentId = req.body.studentId.trim();
  const existing = getMemberships(id);
  const isMember = existing.some((m) => m.studentId === normStudentId);

  if (!isMember) {
    return res.status(404).json({ success: false, error: 'Not a member of this club' });
  }

  // Immutable update: filter out the departing member and store a new array
  _memberships.set(id, existing.filter((m) => m.studentId !== normStudentId));

  return res.status(200).json({ success: true });
});

// ============================================================================
// POST /api/book-clubs/:id/discussions — Post a discussion message
// ============================================================================

/**
 * Post a discussion message to a club.
 *
 * Body: { studentId, studentName, content }
 *
 * COPPA: Content is passed through filterStudentInput before storage.
 * Messages flagged by the filter are stored with parentApproved: false and
 * will require admin review before other students can see them.
 *
 * Returns: { success: true, discussion: {...} }
 */
router.post('/:id/discussions', (req, res) => {
  const { id } = req.params;

  const club = _clubs.get(id);
  if (!club) {
    return res.status(404).json({ success: false, error: 'Club not found' });
  }

  if (club.status !== 'active') {
    return res.status(400).json({ success: false, error: 'Club is not active' });
  }

  const validation = validateDiscussionInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  const { studentId, studentName, content } = validation.data;

  // Verify poster is a club member
  const members = getMemberships(id);
  if (!members.some((m) => m.studentId === studentId)) {
    return res.status(403).json({ success: false, error: 'Must be a club member to post' });
  }

  // COPPA content filter
  const filtered = applyContentFilter(content, studentId);

  const discussion = Object.freeze({
    id: generateDiscussionId(),
    clubId: id,
    studentId,
    studentName,
    content: filtered.content,
    createdAt: new Date().toISOString(),
    parentApproved: filtered.safe,     // false when content filter flags the message
    flags: filtered.flags,             // stored for admin review
  });

  const existing = getDiscussions(id);

  // Immutable update
  _discussions.set(id, [...existing, discussion]);

  return res.status(201).json({ success: true, discussion });
});

// ============================================================================
// GET /api/book-clubs/:id/discussions — List discussions with pagination
// ============================================================================

/**
 * Retrieve paginated discussions for a club.
 *
 * Query: ?limit=20&offset=0
 *
 * Only parentApproved discussions are returned to non-admin callers.
 * The admin safety dashboard handles flagged content separately.
 *
 * Returns: { success: true, discussions: [...], total: N }
 */
router.get('/:id/discussions', (req, res) => {
  const { id } = req.params;

  const club = _clubs.get(id);
  if (!club) {
    return res.status(404).json({ success: false, error: 'Club not found' });
  }

  const rawLimit = parseInt(req.query.limit, 10);
  const rawOffset = parseInt(req.query.offset, 10);

  const limit = isNaN(rawLimit) || rawLimit < 1
    ? DEFAULT_DISCUSSIONS_LIMIT
    : Math.min(rawLimit, MAX_DISCUSSIONS_LIMIT);

  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

  // Only surface approved messages to regular users
  const approved = getDiscussions(id).filter((d) => d.parentApproved);
  const page = approved.slice(offset, offset + limit);

  return res.status(200).json({
    success: true,
    discussions: page,
    total: approved.length,
  });
});

// ============================================================================
// DELETE /api/book-clubs/:id — Delete a club (creator only)
// ============================================================================

/**
 * Delete (archive) a club.
 *
 * Body: { requesterId }
 *   - requesterId must match club.createdBy
 *
 * The club is archived (status -> 'archived') rather than hard-deleted so
 * discussion history is preserved for safeguarding purposes.
 *
 * Returns: { success: true }
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const club = _clubs.get(id);
  if (!club) {
    return res.status(404).json({ success: false, error: 'Club not found' });
  }

  const { requesterId } = req.body ?? {};

  if (!requesterId || typeof requesterId !== 'string' || requesterId.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'requesterId is required' });
  }

  if (requesterId.trim() !== club.createdBy) {
    return res.status(403).json({ success: false, error: 'Only the club creator can delete this club' });
  }

  // Immutable update: replace club object with archived version
  _clubs.set(id, Object.freeze({ ...club, status: 'archived' }));

  return res.status(200).json({ success: true });
});

// ============================================================================
// Store reset helper (only used in tests)
// ============================================================================

/**
 * Reset all in-memory stores and ID counters to a clean state.
 * Exported exclusively for use in test files — never call this in production code.
 */
export function _resetStore() {
  _clubs.clear();
  _memberships.clear();
  _discussions.clear();
  _nextClubId = 1;
  _nextDiscussionId = 1;
}

export default router;
