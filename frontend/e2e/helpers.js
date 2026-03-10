/**
 * Shared test utilities for HiAlice E2E tests.
 *
 * Usage:
 *   const { setupSessionStorage, mockApiResponse, MOCK_STUDENT, MOCK_BOOK, MOCK_SESSION } = require('./helpers');
 */

// ---------------------------------------------------------------------------
// Mock data constants — mirror the shapes used in the real pages
// ---------------------------------------------------------------------------

const MOCK_STUDENT = {
  id: '1',
  name: 'Alice',
  age: '8',
  level: 'Intermediate', // Intermediate → text input shown by default (not beginner-mode)
};

const MOCK_BOOK = {
  id: '1',
  title: 'The Very Hungry Caterpillar',
  author: 'Eric Carle',
  level: 'Beginner',
  genre: 'Picture Book',
  cover: '🐛',
  description: 'A tiny caterpillar eats his way through a week of food.',
};

const MOCK_SESSION = {
  id: 'session-test-001',
  studentId: MOCK_STUDENT.id,
  bookId: MOCK_BOOK.id,
  stage: 'Warm-Up',
};

const MOCK_REVIEW = {
  sessionId: MOCK_SESSION.id,
  bookTitle: MOCK_BOOK.title,
  studentName: MOCK_STUDENT.name,
  completedAt: new Date().toISOString(),
  duration: 900,
  turns: 8,
  levelScore: 78,
  grammarScore: 82,
  vocabulary: [
    {
      id: 1,
      word: 'caterpillar',
      pos: 'noun',
      contextSentence: 'The caterpillar ate leaves all day.',
      synonyms: ['larva', 'grub'],
      antonyms: [],
      masteryLevel: 5,
      useCount: 5,
    },
    {
      id: 2,
      word: 'metamorphosis',
      pos: 'noun',
      contextSentence: 'The caterpillar went through metamorphosis.',
      synonyms: ['transformation', 'change'],
      antonyms: [],
      masteryLevel: 3,
      useCount: 2,
    },
    {
      id: 3,
      word: 'beautiful',
      pos: 'adjective',
      contextSentence: 'The butterfly was beautiful and colorful.',
      synonyms: ['lovely', 'pretty', 'gorgeous'],
      antonyms: ['ugly', 'plain'],
      masteryLevel: 5,
      useCount: 4,
    },
  ],
};

const MOCK_STAGE_BREAKDOWN = [
  { stage: 'Warm-Up', completed: true, wordCount: 1, grammarScore: 0, duration: 30 },
  { stage: 'Title', completed: true, wordCount: 1, grammarScore: 85, duration: 60 },
  { stage: 'Introduction', completed: true, wordCount: 2, grammarScore: 80, duration: 120 },
  { stage: 'Body', completed: true, wordCount: 3, grammarScore: 82, duration: 180 },
  { stage: 'Conclusion', completed: true, wordCount: 2, grammarScore: 85, duration: 90 },
  { stage: 'Reflection', completed: true, wordCount: 1, grammarScore: 0, duration: 30 },
];

// ---------------------------------------------------------------------------
// Helper: inject sessionStorage values before navigation
// ---------------------------------------------------------------------------

/**
 * Injects arbitrary key/value pairs into the page's sessionStorage.
 *
 * Call this AFTER page.goto() — sessionStorage is origin-scoped, so the
 * page must be on the right origin first.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Record<string, string>} data
 */
async function setupSessionStorage(page, data) {
  await page.evaluate((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      sessionStorage.setItem(key, value);
    }
  }, data);
}

/**
 * Seed the standard student session storage keys.
 * Convenience wrapper around setupSessionStorage for the common case.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [overrides]
 */
async function setupStudentSession(page, overrides = {}) {
  const data = {
    studentId: MOCK_STUDENT.id,
    studentName: MOCK_STUDENT.name,
    studentLevel: MOCK_STUDENT.level,
    studentAge: MOCK_STUDENT.age,
    authToken: 'demo-token',
    parentId: 'demo-parent',
    parentEmail: 'demo@hialice.com',
    ...overrides,
  };
  await setupSessionStorage(page, data);
}

// ---------------------------------------------------------------------------
// Helper: intercept API calls and return mock JSON responses
// ---------------------------------------------------------------------------

/**
 * Registers a route intercept so that any fetch/XHR to a URL matching
 * `urlPattern` (a string substring or RegExp) returns `responseBody` as JSON.
 *
 * Must be called BEFORE the navigation that triggers the request.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string | RegExp} urlPattern
 * @param {object} responseBody
 * @param {number} [status]
 */
async function mockApiResponse(page, urlPattern, responseBody, status = 200) {
  await page.route(urlPattern, (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(responseBody),
    });
  });
}

/**
 * Abort any requests matching `urlPattern`.
 * Useful for simulating network failures.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string | RegExp} urlPattern
 */
async function abortApiRequest(page, urlPattern) {
  await page.route(urlPattern, (route) => route.abort('failed'));
}

module.exports = {
  // Constants
  MOCK_STUDENT,
  MOCK_BOOK,
  MOCK_SESSION,
  MOCK_REVIEW,
  MOCK_STAGE_BREAKDOWN,

  // Helpers
  setupSessionStorage,
  setupStudentSession,
  mockApiResponse,
  abortApiRequest,
};
