/**
 * mockData.js
 * HiAlice — Centralised Mock Data
 *
 * All mock data objects previously inlined in api.js are collected here.
 * Import named exports in api.js (or tests) when USE_MOCK is true.
 *
 * Ghibli-inspired theme colours are preserved throughout.
 */

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * @param {string} email
 * @param {string} displayName
 */
export function mockParentRegister(email, displayName) {
  return {
    success: true,
    parent: {
      id: 'parent-' + Date.now(),
      email,
      display_name: displayName,
    },
    token: 'mock-token-' + Date.now(),
    children: [],
  };
}

/**
 * @param {string} email
 */
export function mockParentLogin(email) {
  return {
    success: true,
    parent: {
      id: 'parent-001',
      email,
      name: 'Parent User',
    },
    token: 'mock-token-' + Date.now(),
    children: [
      {
        id: 'mock-student-1',
        name: 'Emma',
        age: 8,
        level: 'beginner',
        avatar_emoji: '👧',
        current_streak: 3,
        total_books_read: 5,
      },
    ],
  };
}

/**
 * @param {string} name
 * @param {number} age
 * @param {string|undefined} avatarEmoji
 */
export function mockAddChild(name, age, avatarEmoji) {
  let level = 'beginner';
  if (age >= 12) level = 'advanced';
  else if (age >= 9) level = 'intermediate';
  return {
    success: true,
    student: {
      id: 'student-' + Date.now(),
      name,
      age,
      level,
      avatarEmoji: avatarEmoji || '🧒',
    },
  };
}

/**
 * @param {string} studentId
 */
export function mockChildSelect(studentId) {
  return {
    success: true,
    student: {
      id: studentId,
      name: 'John',
      age: 8,
      level: 'beginner',
      avatarEmoji: '🧒',
      streak: 2,
      totalBooksRead: 4,
    },
    token: 'mock-token-' + Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------

import { MOCK_BOOK_CATALOG, normalizeMockBook } from '@/lib/mockBookCatalog';

/**
 * @param {string|null} level
 */
export function mockGetBooks(level) {
  const normalizedLevel = level?.toLowerCase();
  return {
    success: true,
    books: MOCK_BOOK_CATALOG
      .map(normalizeMockBook)
      .filter(
        (book) =>
          !normalizedLevel ||
          book.level.toLowerCase() === normalizedLevel
      ),
  };
}

export const MOCK_BOOK_DETAIL = {
  id: 'mock-book-001',
  title: 'The Very Hungry Caterpillar',
  author: 'Eric Carle',
  level: 'beginner',
  genre: 'Picture Book',
  // Ghibli-style warm palette reflected in cover tones
  coverEmoji: '🐛',
  description: 'A classic picture book about transformation',
  pageCount: 32,
  summary:
    'Follow a tiny caterpillar as it eats its way through the week and transforms into a beautiful butterfly.',
};

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * @param {string} studentId
 * @param {string} bookId
 */
export function mockStartSession(studentId, bookId) {
  return {
    success: true,
    session: {
      id: 'session-' + Date.now(),
      studentId,
      bookId,
      stage: 'warm_connection',
      startedAt: new Date().toISOString(),
      turns: 0,
    },
    message: {
      speaker: 'alice',
      content:
        "Hi there! I'm so excited to talk about the book you just read. What was your favourite part?",
    },
  };
}

export const MOCK_STAGE_RESPONSES = {
  warm_connection:
    "That sounds wonderful! I love hearing about your favourite parts. What kind of stories do you enjoy most?",
  title:
    "That's a great observation! What else does the title tell you about the book?",
  introduction:
    'Interesting! Can you describe what the character looks like?',
  body: "That's your first reason. Can you tell me your second reason?",
  conclusion:
    'What a wonderful reflection! This shows how much you understood the book.',
};

/**
 * @param {string} sessionId
 * @param {string} content
 * @param {string} stage
 */
export function mockSendMessage(sessionId, content, stage) {
  return {
    success: true,
    message: {
      id: 'msg-' + Date.now(),
      sessionId,
      speaker: 'student',
      content,
      stage,
      timestamp: new Date().toISOString(),
    },
    response: {
      id: 'resp-' + Date.now(),
      sessionId,
      speaker: 'alice',
      content: MOCK_STAGE_RESPONSES[stage] || 'Tell me more!',
      stage,
      timestamp: new Date().toISOString(),
      grammarScore: Math.floor(Math.random() * 40 + 60),
    },
  };
}

/**
 * @param {string} sessionId
 */
export function mockCompleteSession(sessionId) {
  return {
    success: true,
    session: {
      id: sessionId,
      completedAt: new Date().toISOString(),
      levelScore: Math.floor(Math.random() * 40 + 60),
      grammarScore: Math.floor(Math.random() * 40 + 60),
    },
  };
}

/**
 * @param {string} sessionId
 */
export function mockSessionReview(sessionId) {
  return {
    success: true,
    review: {
      sessionId,
      bookTitle: 'The Very Hungry Caterpillar',
      level: 'beginner',
      completedAt: new Date().toISOString(),
      duration: 1200,
      turns: 8,
      levelScore: 78,
      grammarScore: 82,
      wordCloud: {
        caterpillar: 5,
        hungry: 4,
        butterfly: 3,
        beautiful: 2,
        leaves: 2,
      },
      vocabulary: [
        {
          id: 1,
          word: 'caterpillar',
          pos: 'noun',
          contextSentence: 'The caterpillar ate through one apple.',
          synonyms: ['larva', 'grub'],
          antonyms: [],
          masteryLevel: 2,
          useCount: 3,
        },
        {
          id: 2,
          word: 'cocoon',
          pos: 'noun',
          contextSentence: 'He built a cocoon around himself.',
          synonyms: ['chrysalis', 'shell'],
          antonyms: [],
          masteryLevel: 1,
          useCount: 1,
        },
        {
          id: 3,
          word: 'metamorphosis',
          pos: 'noun',
          contextSentence: 'The metamorphosis was amazing.',
          synonyms: ['transformation', 'change'],
          antonyms: [],
          masteryLevel: 1,
          useCount: 1,
        },
      ],
      messages: [
        {
          speaker: 'alice',
          content:
            "Hi there! Let's talk about The Very Hungry Caterpillar. What was your favourite part?",
        },
        {
          speaker: 'student',
          content: 'I liked when the caterpillar ate so many things!',
        },
        {
          speaker: 'alice',
          content:
            "That's a great observation! Why do you think the caterpillar was so hungry?",
        },
        {
          speaker: 'student',
          content:
            'Because he was growing and needed energy to become a beautiful butterfly.',
        },
      ],
    },
  };
}

export const MOCK_SESSION_FEEDBACK =
  'You did such a wonderful job today! Your ideas were creative and your vocabulary is growing so fast. Keep reading and sharing your thoughts!';

/**
 * @param {string} studentId
 */
export function mockStudentProgress(studentId) {
  return {
    success: true,
    progress: {
      studentId,
      totalBooksRead: 12,
      totalSessions: 24,
      averageLevelScore: 78,
      averageGrammarScore: 82,
      vocabularySize: 156,
      weeklyReadingGoal: 3,
      weeklyReadingProgress: 2,
      streak: 5,
      badges: ['reader', 'speaker', 'grammar-master'],
    },
  };
}

/**
 * @param {string} studentId
 */
export function mockPredictionPortfolio(studentId) {
  return {
    portfolio: { total_predictions: 0, studentId },
    recentPredictions: [],
  };
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * @param {string} studentId
 * @param {string|null} sessionId
 */
export function mockVocabulary(studentId, sessionId) {
  return {
    success: true,
    vocabulary: {
      studentId,
      sessionId,
      words: [
        {
          id: 'word-001',
          word: 'caterpillar',
          pos: 'noun',
          contextSentence: 'The caterpillar was very hungry.',
          synonyms: ['larva', 'grub'],
          antonyms: [],
          firstUsed: new Date(Date.now() - 86400000).toISOString(),
          masteryLevel: 2,
          useCount: 5,
        },
        {
          id: 'word-002',
          word: 'metamorphosis',
          pos: 'noun',
          contextSentence: 'The metamorphosis happens in the cocoon.',
          synonyms: ['transformation', 'change'],
          antonyms: [],
          firstUsed: new Date().toISOString(),
          masteryLevel: 1,
          useCount: 1,
        },
      ],
      totalWords: 34,
      newWords: 8,
      reviewWords: 26,
    },
  };
}

export const MOCK_VOCAB_STATS = {
  success: true,
  stats: {
    totalWords: 34,
    masteredWords: 8,
    learningWords: 26,
    dueToday: 5,
    byLevel: { 0: 2, 1: 8, 2: 10, 3: 8, 4: 4, 5: 2 },
    weeklyGrowth: [],
  },
};

export const MOCK_VOCAB_DUE_TODAY = {
  success: true,
  words: [],
  count: 0,
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export function mockParentNotifications() {
  return {
    success: true,
    notifications: [
      {
        id: 'mock-notif-1',
        studentId: 'mock-student-1',
        studentName: 'Emma',
        // Ghibli-inspired avatar
        studentAvatar: '👧',
        type: 'session_complete',
        title: 'Emma completed a session!',
        message:
          'Emma just finished "The Very Hungry Caterpillar" with a grammar score of 87/100.',
        isRead: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'mock-notif-2',
        studentId: 'mock-student-1',
        studentName: 'Emma',
        studentAvatar: '👧',
        type: 'achievement',
        title: 'New achievement unlocked!',
        message: 'Emma earned the "Book Worm" badge for reading 5 books.',
        isRead: true,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    unreadCount: 1,
    prefs: {
      emailEnabled: true,
      sessionAlerts: true,
      weeklyReport: false,
      notificationEmail: '',
    },
  };
}

/**
 * @param {object} prefs
 */
export function mockUpdateNotificationPrefs(prefs) {
  return {
    success: true,
    prefs: {
      emailEnabled: prefs.emailEnabled ?? true,
      sessionAlerts: prefs.sessionAlerts ?? true,
      weeklyReport: prefs.weeklyReport ?? false,
      notificationEmail: prefs.notificationEmail ?? '',
    },
  };
}

// ---------------------------------------------------------------------------
// Safety Logs
// ---------------------------------------------------------------------------

export const MOCK_SAFETY_LOGS = [
  {
    id: 1,
    timestamp: new Date(Date.now() - 1 * 3600000).toISOString(),
    source: 'student_input',
    studentId: 'student-001',
    studentAge: 8,
    sessionId: 'session-abc',
    flags: ['self_harm_signal'],
    preview: 'I want to die because the book was boring',
    filteredText: null,
    reviewed: false,
    reviewedAt: null,
    reviewedBy: null,
  },
  {
    id: 2,
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    source: 'ai_response',
    studentId: 'student-002',
    studentAge: 10,
    sessionId: 'session-def',
    flags: ['pii_email_address'],
    preview:
      'Great question! You can reach me at alice@example.com for more help.',
    filteredText:
      'Great question! You can reach me at [EMAIL_ADDRESS REMOVED] for more help.',
    reviewed: false,
    reviewedAt: null,
    reviewedBy: null,
  },
  {
    id: 3,
    timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
    source: 'student_input',
    studentId: 'student-003',
    studentAge: 7,
    sessionId: 'session-ghi',
    flags: ['bullying_report'],
    preview: 'Someone is hitting me at school every day',
    filteredText: null,
    reviewed: true,
    reviewedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    reviewedBy: 'admin-001',
  },
  {
    id: 4,
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    source: 'ai_response',
    studentId: 'student-004',
    studentAge: 9,
    sessionId: 'session-jkl',
    flags: ['profanity'],
    preview: 'The character was really ****** angry at the dragon.',
    filteredText: 'The character was really ****** angry at the dragon.',
    reviewed: true,
    reviewedAt: new Date(Date.now() - 20 * 3600000).toISOString(),
    reviewedBy: 'admin-001',
  },
  {
    id: 5,
    timestamp: new Date(Date.now() - 48 * 3600000).toISOString(),
    source: 'student_input',
    studentId: 'student-005',
    studentAge: 13,
    sessionId: 'session-mno',
    flags: ['student_pii_phone_number'],
    preview: 'Call me at 555-123-4567 after school',
    filteredText: null,
    reviewed: false,
    reviewedAt: null,
    reviewedBy: null,
  },
];

/**
 * @param {number} page
 * @param {number} limit
 * @param {object} filters
 */
export function mockSafetyLogs(page, limit, filters) {
  let logs = MOCK_SAFETY_LOGS.slice();

  if (filters.reviewed === 'true') logs = logs.filter((l) => l.reviewed);
  if (filters.reviewed === 'false') logs = logs.filter((l) => !l.reviewed);
  if (filters.source) logs = logs.filter((l) => l.source === filters.source);
  if (filters.flagType)
    logs = logs.filter((l) =>
      l.flags.some((f) => f.includes(filters.flagType))
    );

  const total = logs.length;
  const offset = (page - 1) * limit;

  return {
    success: true,
    data: {
      logs: logs.slice(offset, offset + limit),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    },
  };
}

/**
 * @param {number} days
 */
export function mockSafetyStats(days) {
  const dailyCounts = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dailyCounts.push({
      date: d.toISOString().split('T')[0],
      count: Math.floor(Math.random() * 4),
    });
  }

  return {
    success: true,
    data: {
      window_days: days,
      total_flags: 5,
      by_source: { ai_response: 2, student_input: 3 },
      by_flag_type: [
        { flag: 'self_harm_signal', count: 1 },
        { flag: 'bullying_report', count: 1 },
        { flag: 'pii_email_address', count: 1 },
        { flag: 'profanity', count: 1 },
        { flag: 'student_pii_phone_number', count: 1 },
      ],
      unreviewed_count: 3,
      daily_counts: dailyCounts,
    },
  };
}

/**
 * @param {number|string} logId
 */
export function mockReviewSafetyLog(logId) {
  return {
    success: true,
    data: {
      id: logId,
      reviewed: true,
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'dev-admin',
    },
  };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const MOCK_STUDENT_ANALYTICS = {
  success: true,
  analytics: {
    achievements: [],
    weeklyActivity: [],
    topWords: [],
  },
};
