// e2e/fixtures.js — Shared test utilities for HiAlice E2E tests

// ─── Session Storage Constants ────────────────────────────────────────────────
export const STUDENT_SESSION = {
  token: 'test-token-student',
  studentId: '1',
  studentName: 'Alice',
  studentLevel: 'Beginner',
  studentAge: '8',
};

export const PARENT_SESSION = {
  token: 'test-token-parent',
  parentId: 'parent-001',
  parentEmail: 'parent@test.com',
  userRole: 'parent',
  studentId: '1',
  studentName: 'Alice',
  studentLevel: 'Beginner',
  studentAge: '8',
};

export const ADMIN_SESSION = {
  token: 'test-token-admin',
  userRole: 'admin',
};

// ─── Auth Helpers ─────────────────────────────────────────────────────────────
export async function setStudentSession(page) {
  await page.goto('/');
  await page.evaluate((session) => {
    Object.entries(session).forEach(([k, v]) => sessionStorage.setItem(k, v));
  }, STUDENT_SESSION);
}

export async function setParentSession(page) {
  await page.goto('/');
  await page.evaluate((session) => {
    Object.entries(session).forEach(([k, v]) => sessionStorage.setItem(k, v));
  }, PARENT_SESSION);
}

export async function setAdminSession(page) {
  await page.goto('/');
  await page.evaluate((session) => {
    Object.entries(session).forEach(([k, v]) => sessionStorage.setItem(k, v));
  }, ADMIN_SESSION);
}

// ─── Mock API Data ────────────────────────────────────────────────────────────
export const MOCK_BOOKS = [
  {
    id: 1, title: 'The Very Hungry Caterpillar', author: 'Eric Carle',
    level: 'Beginner', genre: 'Picture Book', cover: '🐛',
    description: 'A tiny caterpillar eats his way through a week of food.',
  },
  {
    id: 2, title: "Charlotte's Web", author: 'E.B. White',
    level: 'Intermediate', genre: 'Chapter Book', cover: '🕷️',
    description: 'A pig and a spider form an unforgettable friendship.',
  },
];

export const MOCK_SESSION_REVIEW = {
  studentName: 'Alice',
  bookTitle: 'The Very Hungry Caterpillar',
  grammarScore: 82,
  levelScore: 78,
  studentLevel: 'Beginner',
  vocabulary: [
    { id: 1, word: 'caterpillar', pos: 'noun', contextSentence: 'The caterpillar ate through one apple.', synonyms: ['larva', 'grub'], antonyms: [], masteryLevel: 2, useCount: 3 },
    { id: 2, word: 'beautiful', pos: 'adjective', contextSentence: 'He was a beautiful butterfly!', synonyms: ['lovely', 'pretty'], antonyms: ['ugly'], masteryLevel: 3, useCount: 4 },
  ],
  messages: [
    { speaker: 'alice', content: "Hi there! Let's talk about The Very Hungry Caterpillar. What was your favorite part?" },
    { speaker: 'student', content: 'I liked when the caterpillar ate so many things!' },
    { speaker: 'alice', content: 'Wonderful thinking! You connected cause and effect beautifully.' },
  ],
  achievements: [],
};

export const MOCK_VOCABULARY = [
  { id: 1, word: 'caterpillar', pos: 'noun', definition: 'A small creature with many legs that becomes a butterfly', contextSentence: 'The caterpillar ate leaves all day.', synonyms: ['larva', 'grub'], antonyms: [], masteryLevel: 2, useCount: 5 },
  { id: 2, word: 'metamorphosis', pos: 'noun', definition: 'A complete change or transformation', contextSentence: 'The caterpillar went through metamorphosis.', synonyms: ['transformation', 'change'], antonyms: [], masteryLevel: 1, useCount: 2 },
  { id: 3, word: 'journey', pos: 'noun', definition: 'A trip or adventure from one place to another', contextSentence: 'It was a long and interesting journey.', synonyms: ['trip', 'voyage'], antonyms: [], masteryLevel: 3, useCount: 3 },
  { id: 4, word: 'devour', pos: 'verb', definition: 'To eat quickly and with great appetite', contextSentence: 'He devoured all the food in the forest.', synonyms: ['eat', 'consume'], antonyms: [], masteryLevel: 1, useCount: 1 },
  { id: 5, word: 'beautiful', pos: 'adjective', definition: 'Pleasing to look at; attractive', contextSentence: 'The butterfly was beautiful and colorful.', synonyms: ['lovely', 'pretty'], antonyms: ['ugly', 'plain'], masteryLevel: 4, useCount: 4 },
];

export const MOCK_STUDENTS_ADMIN = [
  { id: 1, name: 'Alice', age: 8, level: 'beginner', booksRead: 3, totalSessions: 6, lastActive: new Date().toISOString() },
  { id: 2, name: 'Bob', age: 11, level: 'intermediate', booksRead: 5, totalSessions: 10, lastActive: new Date().toISOString() },
];

// ─── Route Mock Helpers ───────────────────────────────────────────────────────
// Call BEFORE page.goto() for any page that fetches from the backend API.

export async function mockBooksApi(page) {
  await page.route('**/api/books*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BOOKS) })
  );
}

export async function mockSessionsApi(page, studentId = '1') {
  await page.route(`**/api/sessions/student/${studentId}**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sessions: [], stats: {} }) })
  );
}

export async function mockVocabApi(page, studentId = '1') {
  await page.route(`**/api/vocabulary/${studentId}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_VOCABULARY) })
  );
  await page.route(`**/api/vocabulary/${studentId}/due-today`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ words: [], count: 0 }) })
  );
  await page.route(`**/api/vocabulary/${studentId}/stats`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totalWords: 5, masteredWords: 1, learningWords: 4, dueToday: 2 }) })
  );
}

export async function mockAdminStudentsApi(page) {
  await page.route('**/api/admin/students', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ students: MOCK_STUDENTS_ADMIN }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
}

export async function mockAdminBooksApi(page) {
  await page.route('**/api/admin/books**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ books: MOCK_BOOKS }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
}

/** Catch-all: silently fulfill any unhandled API calls to prevent network errors. */
export async function mockAllApiFallback(page) {
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  );
}
