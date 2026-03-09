/**
 * HiAlice API Client
 * Fetch wrapper with error handling and mock fallback data for development
 */

import { API_BASE, API_TIMEOUT } from '@/lib/constants';

/**
 * Base fetch wrapper with timeout, auth token injection, and error handling
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}/api${endpoint}`;
  const timeout = options.timeout || API_TIMEOUT;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Inject auth token from sessionStorage when available
  const token =
    typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = new Error(
        `API Error: ${response.status} ${response.statusText}`
      );
      error.status = response.status;
      throw error;
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Request timed out. Please try again.');
      timeoutError.isTimeout = true;
      throw timeoutError;
    }
    console.error(`API request failed: ${endpoint}`, error);
    throw error;
  }
}

/**
 * Parent authentication
 * POST /auth/parent-login
 */
export async function parentLogin(email, password) {
  try {
    const response = await apiFetch('/auth/parent-login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return response;
  } catch (error) {
    console.error('Parent login failed:', error);
    // Mock fallback for development
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        parent: {
          id: 'parent-001',
          email,
          name: 'Parent User',
        },
        token: 'mock-token-' + Date.now(),
      };
    }
    throw error;
  }
}

/**
 * Select student
 * POST /students/:studentId/select
 */
export async function childSelect(studentId) {
  try {
    const response = await apiFetch(`/students/${studentId}/select`, {
      method: 'POST',
    });
    return response;
  } catch (error) {
    console.error('Child select failed:', error);
    // Mock fallback
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        student: {
          id: studentId,
          name: 'John',
          age: 8,
          level: 'beginner',
        },
        session: {
          id: 'session-' + Date.now(),
          studentId,
          startedAt: new Date().toISOString(),
        },
      };
    }
    throw error;
  }
}

/**
 * Get books list
 * GET /books?level=beginner
 */
export async function getBooks(level = null) {
  try {
    const query = level ? `?level=${level}` : '';
    const response = await apiFetch(`/books${query}`);
    return response;
  } catch (error) {
    console.error('Get books failed:', error);
    // Mock fallback
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        books: [
          {
            id: 'book-001',
            title: 'The Very Hungry Caterpillar',
            author: 'Eric Carle',
            level: 'beginner',
            genre: 'Picture Book',
            coverEmoji: '🐛',
            description:
              'A classic picture book about transformation and growth',
            pageCount: 32,
          },
          {
            id: 'book-002',
            title: 'Charlotte\'s Web',
            author: 'E.B. White',
            level: 'intermediate',
            genre: 'Chapter Book',
            coverEmoji: '🕷️',
            description: 'A heartwarming story about friendship',
            pageCount: 184,
          },
          {
            id: 'book-003',
            title: 'The Hobbit',
            author: 'J.R.R. Tolkien',
            level: 'advanced',
            genre: 'Fantasy',
            coverEmoji: '⚔️',
            description: 'An epic adventure in a magical world',
            pageCount: 310,
          },
        ],
      };
    }
    throw error;
  }
}

/**
 * Get single book details
 * GET /books/:bookId
 */
export async function getBook(bookId) {
  try {
    const response = await apiFetch(`/books/${bookId}`);
    return response;
  } catch (error) {
    console.error('Get book failed:', error);
    // Mock fallback
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        book: {
          id: bookId,
          title: 'The Very Hungry Caterpillar',
          author: 'Eric Carle',
          level: 'beginner',
          genre: 'Picture Book',
          coverEmoji: '🐛',
          description: 'A classic picture book about transformation',
          pageCount: 32,
          summary:
            'Follow a tiny caterpillar as it eats its way through the week...',
        },
      };
    }
    throw error;
  }
}

/**
 * Start a new session
 * POST /sessions
 */
export async function startSession(studentId, bookId) {
  try {
    const response = await apiFetch('/sessions', {
      method: 'POST',
      body: JSON.stringify({ studentId, bookId }),
    });
    return response;
  } catch (error) {
    console.error('Start session failed:', error);
    // Mock fallback
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        session: {
          id: 'session-' + Date.now(),
          studentId,
          bookId,
          stage: 'title',
          startedAt: new Date().toISOString(),
          turns: 0,
        },
      };
    }
    throw error;
  }
}

/**
 * Send message in session
 * POST /sessions/:sessionId/messages
 */
export async function sendMessage(sessionId, content, stage) {
  try {
    const response = await apiFetch(`/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        stage,
        timestamp: new Date().toISOString(),
      }),
    });
    return response;
  } catch (error) {
    console.error('Send message failed:', error);
    // Mock fallback
    if (process.env.NODE_ENV === 'development') {
      const mockResponses = {
        title:
          'That\'s a great observation! What else does the title tell you about the book?',
        introduction:
          'Interesting! Can you describe what the character looks like?',
        body: 'That\'s your first reason. Can you tell me your second reason?',
        conclusion:
          'What a wonderful reflection! This shows how much you understood the book.',
      };

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
          content: mockResponses[stage] || 'Tell me more!',
          stage,
          timestamp: new Date().toISOString(),
          grammarScore: Math.floor(Math.random() * 40 + 60),
        },
      };
    }
    throw error;
  }
}

/**
 * Complete session
 * POST /sessions/:sessionId/complete
 */
export async function completeSession(sessionId, feedback = {}) {
  try {
    const response = await apiFetch(`/sessions/${sessionId}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        ...feedback,
        completedAt: new Date().toISOString(),
      }),
    });
    return response;
  } catch (error) {
    console.error('Complete session failed:', error);
    // Mock fallback
    if (process.env.NODE_ENV === 'development') {
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
    throw error;
  }
}

/**
 * Get session review
 * GET /sessions/:sessionId/review
 */
export async function getSessionReview(sessionId) {
  try {
    const response = await apiFetch(`/sessions/${sessionId}/review`);
    return response;
  } catch (error) {
    console.error('Get session review failed:', error);
    // Mock fallback
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        review: {
          sessionId,
          bookTitle: 'The Very Hungry Caterpillar',
          level: 'beginner',
          completedAt: new Date().toISOString(),
          duration: 1200, // seconds
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
          vocabulary: {
            newWords: ['caterpillar', 'cocoon', 'metamorphosis'],
            reviewWords: ['eat', 'day', 'week'],
            totalUsed: 34,
          },
        },
      };
    }
    throw error;
  }
}

/**
 * Get vocabulary list
 * GET /students/:studentId/vocabulary?sessionId=optional
 */
export async function getVocabulary(studentId, sessionId = null) {
  try {
    const query = sessionId ? `?sessionId=${sessionId}` : '';
    const response = await apiFetch(`/students/${studentId}/vocabulary${query}`);
    return response;
  } catch (error) {
    console.error('Get vocabulary failed:', error);
    // Mock fallback
    if (process.env.NODE_ENV === 'development') {
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
    throw error;
  }
}

/**
 * Get student progress
 * GET /students/:studentId/progress
 */
export async function getStudentProgress(studentId) {
  try {
    const response = await apiFetch(`/students/${studentId}/progress`);
    return response;
  } catch (error) {
    console.error('Get student progress failed:', error);
    // Mock fallback
    if (process.env.NODE_ENV === 'development') {
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
    throw error;
  }
}

// ==================== Sessions ====================

/**
 * Get all sessions for a student
 * GET /sessions/student/:studentId
 */
export async function getStudentSessions(studentId) {
  try {
    const response = await apiFetch(`/sessions/student/${studentId}`);
    return response;
  } catch (error) {
    console.error('Get student sessions failed:', error);
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        sessions: [],
      };
    }
    throw error;
  }
}

/**
 * Get stage scores for a session
 * GET /sessions/:sessionId/stage-scores
 */
export async function getSessionStageScores(sessionId) {
  try {
    const response = await apiFetch(`/sessions/${sessionId}/stage-scores`);
    return response;
  } catch (error) {
    console.error('Get session stage scores failed:', error);
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        stageScores: [],
      };
    }
    throw error;
  }
}

/**
 * Pause session (Save & Exit)
 * PUT /sessions/:sessionId/pause
 */
export async function pauseSession(sessionId) {
  try {
    const response = await apiFetch(`/sessions/${sessionId}/pause`, {
      method: 'PUT',
    });
    return response;
  } catch (error) {
    console.error('Pause session failed:', error);
    if (process.env.NODE_ENV === 'development') {
      return { success: true, sessionId };
    }
    throw error;
  }
}

// ==================== Vocabulary ====================

/**
 * Get vocabulary for a student
 * GET /vocabulary/:studentId
 */
export async function getStudentVocabulary(studentId) {
  try {
    const response = await apiFetch(`/vocabulary/${studentId}`);
    return response;
  } catch (error) {
    console.error('Get student vocabulary failed:', error);
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        words: [],
        totalWords: 0,
        newWords: 0,
        reviewWords: 0,
      };
    }
    throw error;
  }
}

/**
 * Get words due for review today (spaced repetition queue)
 * GET /vocabulary/:studentId/due-today
 */
export async function getVocabDueToday(studentId) {
  try {
    const response = await apiFetch(`/vocabulary/${studentId}/due-today`);
    return response;
  } catch (error) {
    console.error('Get vocab due today failed:', error);
    if (process.env.NODE_ENV === 'development') {
      return { success: true, words: [], count: 0 };
    }
    throw error;
  }
}

/**
 * Get vocabulary statistics for a student
 * GET /vocabulary/:studentId/stats
 */
export async function getVocabStats(studentId) {
  try {
    const response = await apiFetch(`/vocabulary/${studentId}/stats`);
    return response;
  } catch (error) {
    console.error('Get vocab stats failed:', error);
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        stats: {
          totalWords: 0,
          masteredWords: 0,
          learningWords: 0,
          dueToday: 0,
        },
      };
    }
    throw error;
  }
}

/**
 * Record a spaced repetition practice result
 * POST /vocabulary/:studentId/practice-result
 */
export async function recordPracticeResult(
  studentId,
  vocabularyId,
  isCorrect,
  responseTimeMs
) {
  try {
    const response = await apiFetch(
      `/vocabulary/${studentId}/practice-result`,
      {
        method: 'POST',
        body: JSON.stringify({ vocabularyId, isCorrect, responseTimeMs }),
      }
    );
    return response;
  } catch (error) {
    console.error('Record practice result failed:', error);
    // Silent failure — don't block UI for analytics calls
    return { success: false, error: error.message };
  }
}

// ==================== Auth ====================

/**
 * Get the currently logged-in user
 * GET /auth/me
 */
export async function getCurrentUser() {
  try {
    const response = await apiFetch('/auth/me');
    return response;
  } catch (error) {
    console.error('Get current user failed:', error);
    throw error;
  }
}

/**
 * Log out the current user
 * POST /auth/logout
 */
export async function logout() {
  try {
    const response = await apiFetch('/auth/logout', { method: 'POST' });
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }
    return response;
  } catch (error) {
    // Even if server call fails, clear local session
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }
    console.warn('Logout API call failed (session cleared locally):', error);
    return { success: true };
  }
}

/**
 * Get notifications for the current user
 * GET /auth/notifications
 */
export async function getNotifications() {
  try {
    const response = await apiFetch('/auth/notifications');
    return response;
  } catch (error) {
    console.error('Get notifications failed:', error);
    if (process.env.NODE_ENV === 'development') {
      return { success: true, notifications: [] };
    }
    throw error;
  }
}

// ==================== Admin ====================

/**
 * Get analytics for a specific student (admin)
 * GET /admin/students/:studentId/analytics
 */
export async function getStudentAnalytics(studentId) {
  try {
    const response = await apiFetch(`/admin/students/${studentId}/analytics`);
    return response;
  } catch (error) {
    console.error('Get student analytics failed:', error);
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        analytics: {
          achievements: [],
          weeklyActivity: [],
          topWords: [],
        },
      };
    }
    throw error;
  }
}

export default {
  parentLogin,
  childSelect,
  getBooks,
  getBook,
  startSession,
  sendMessage,
  completeSession,
  getSessionReview,
  getVocabulary,
  getStudentProgress,
  getStudentSessions,
  getSessionStageScores,
  pauseSession,
  getStudentVocabulary,
  getVocabDueToday,
  getVocabStats,
  recordPracticeResult,
  getCurrentUser,
  logout,
  getNotifications,
  getStudentAnalytics,
};
