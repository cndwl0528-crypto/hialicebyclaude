/**
 * api.js
 * HiAlice — API Client
 *
 * Production-ready fetch layer with:
 *   - A shared apiFetch helper (credentials, auth token, timeout, error throwing)
 *   - USE_MOCK flag: when NEXT_PUBLIC_USE_MOCK=true every function returns mock
 *     data immediately without touching the network.
 *   - In production (USE_MOCK=false) real API calls are made and failures are
 *     thrown — no silent mock fallback.
 *
 * Endpoint alignment with backend (backend/src/app.js mounts all routes under
 * /api, so apiFetch prepends /api automatically):
 *
 *   Auth          POST /auth/register, /auth/parent-login, /auth/child-select
 *                 POST /auth/children, /auth/logout, /auth/refresh
 *                 GET  /auth/me
 *   Books         GET  /books, /books/:id
 *                 GET  /books/recommendations/:studentId
 *   Sessions      POST /sessions/start
 *                 POST /sessions/:id/message          (singular, matches backend)
 *                 POST /sessions/:id/complete
 *                 GET  /sessions/:id/review
 *                 GET  /sessions/:id/feedback
 *                 GET  /sessions/:id/stage-scores
 *                 PUT  /sessions/:id/pause
 *                 PUT  /sessions/:id/resume
 *                 GET  /sessions/student/:studentId
 *                 GET  /sessions/student/:studentId/highlights
 *                 POST /sessions/:id/prediction
 *                 PUT  /sessions/prediction/:predictionId/verify
 *                 GET  /sessions/student/:studentId/portfolio
 *   Vocabulary    GET  /vocabulary/:studentId
 *                 GET  /vocabulary/:studentId/due-today
 *                 GET  /vocabulary/:studentId/stats
 *                 POST /vocabulary/:studentId/practice-result
 *   Notifications GET  /notifications
 *                 POST /notifications/preferences
 *                 PATCH /notifications/:id/read
 *   Admin         GET  /admin/students/:id/analytics
 *   Safety        GET  /safety/logs, /safety/stats
 *                 POST /safety/review/:logId
 *   COPPA         POST /coppa/verify-intent, /coppa/verify-confirm
 *                 GET  /coppa/status/:email
 */

import { API_BASE, API_TIMEOUT } from '@/lib/constants';
import { clearPersistedSession, getItem } from '@/lib/clientStorage';
import {
  mockParentRegister,
  mockParentLogin,
  mockAddChild,
  mockChildSelect,
  mockGetBooks,
  MOCK_BOOK_DETAIL,
  mockStartSession,
  mockSendMessage,
  mockCompleteSession,
  mockSessionReview,
  MOCK_SESSION_FEEDBACK,
  mockStudentProgress,
  mockVocabulary,
  MOCK_VOCAB_STATS,
  MOCK_VOCAB_DUE_TODAY,
  mockParentNotifications,
  mockUpdateNotificationPrefs,
  mockSafetyLogs,
  mockSafetyStats,
  mockReviewSafetyLog,
  MOCK_STUDENT_ANALYTICS,
  mockPredictionPortfolio,
} from './mockData';

// ---------------------------------------------------------------------------
// Global flags
// ---------------------------------------------------------------------------

/**
 * When true every API function returns mock data without hitting the network.
 * Set NEXT_PUBLIC_USE_MOCK=true in .env.local or CI environment to enable.
 */
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

export function clearClientSession() {
  if (typeof window === 'undefined') return;

  clearPersistedSession();

  // Best-effort cleanup for any non-httpOnly auth cookies that may have been
  // set in older local builds or proxies.
  document.cookie = 'hialice_token=; Max-Age=0; path=/';
  document.cookie = 'token=; Max-Age=0; path=/';
}

// ---------------------------------------------------------------------------
// Shared fetch helper
// ---------------------------------------------------------------------------

/**
 * Core fetch wrapper used by every public API function.
 *
 * Features:
 *   - Prepends API_BASE + /api to every endpoint path
 *   - Injects Bearer token from sessionStorage when present
 *   - Enforces a configurable timeout via AbortController
 *   - Throws on any non-2xx HTTP status (clears session on 401/403)
 *   - Throws a typed timeout error on AbortError
 *
 * @param {string} endpoint  — path relative to /api, e.g. "/auth/me"
 * @param {RequestInit & { timeout?: number }} options
 * @returns {Promise<any>}  parsed JSON response body
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}/api${endpoint}`;
  const timeout = options.timeout || API_TIMEOUT;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Inject auth token from sessionStorage when available
  const token = typeof window !== 'undefined' ? getItem('token') : null;

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Do NOT auto-clear session here — let the caller (layout.js) decide.
      // Clearing on every 401/403 causes logout during normal navigation.

      // Try to extract the server's error message from the JSON body
      let serverMessage = '';
      try {
        const body = await response.json();
        serverMessage = body.error || body.message || '';
      } catch (_) { /* non-JSON response */ }

      const error = new Error(
        serverMessage || `API Error: ${response.status} ${response.statusText}`
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

    // Re-throw everything else — callers decide whether to surface the error
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Register a new parent account.
 * POST /auth/register
 *
 * @param {string} email
 * @param {string} password
 * @param {string} displayName
 */
export async function parentRegister(email, password, displayName) {
  if (USE_MOCK) return mockParentRegister(email, displayName);

  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  });
}

/**
 * Email + password login.
 * POST /auth/parent-login
 *
 * @param {string} email
 * @param {string} password
 */
export async function parentLogin(email, password) {
  if (USE_MOCK) return mockParentLogin(email);

  return apiFetch('/auth/parent-login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Add a child to the authenticated parent's account.
 * POST /auth/children
 *
 * @param {string} name
 * @param {number} age
 * @param {string|undefined} avatarEmoji
 * @param {string|undefined} pin - 4-digit PIN for child login
 */
export async function addChild(name, age, avatarEmoji, pin) {
  if (USE_MOCK) return mockAddChild(name, age, avatarEmoji);

  return apiFetch('/auth/children', {
    method: 'POST',
    body: JSON.stringify({ name, age, avatarEmoji, pin }),
  });
}

/**
 * Verify a child's 4-digit PIN and get a student token.
 * POST /auth/verify-pin
 *
 * @param {string} studentId
 * @param {string} pin
 */
export async function verifyStudentPin(studentId, pin) {
  if (USE_MOCK) return { token: 'mock-student-token', student: { id: studentId, name: 'Mock' } };

  return apiFetch('/auth/verify-pin', {
    method: 'POST',
    body: JSON.stringify({ studentId, pin }),
  });
}

/**
 * Fetch the list of all registered children (for student login screen).
 * GET /auth/children-list
 */
export async function getChildrenList() {
  if (USE_MOCK) return { children: [] };

  return apiFetch('/auth/children-list');
}

/**
 * Select a child and receive a student-scoped JWT.
 * POST /auth/child-select
 *
 * @param {string} studentId
 */
export async function childSelect(studentId) {
  if (USE_MOCK) return mockChildSelect(studentId);

  return apiFetch('/auth/child-select', {
    method: 'POST',
    body: JSON.stringify({ studentId }),
  });
}

/**
 * Get the currently authenticated user.
 * GET /auth/me
 */
export async function getCurrentUser() {
  if (USE_MOCK) {
    return {
      user: {
        type: 'parent',
        id: 'parent-001',
        email: 'parent@example.com',
        display_name: 'Parent User',
      },
      children: [],
    };
  }

  return apiFetch('/auth/me');
}

/**
 * Log out the current user and clear local session state.
 * POST /auth/logout
 */
export async function logout() {
  if (USE_MOCK) {
    clearClientSession();
    return { success: true };
  }

  try {
    const response = await apiFetch('/auth/logout', { method: 'POST' });
    clearClientSession();
    return response;
  } catch (error) {
    // Even if the server call fails, clear local state so the user is unblocked
    clearClientSession();
    console.warn('Logout API call failed (session cleared locally):', error);
    return { success: true };
  }
}

/**
 * Get parent notification inbox via the auth router.
 * GET /auth/notifications
 *
 * Note: The dedicated /notifications route (notificationsRouter) is preferred
 * for richer responses including prefs.  This thin wrapper is kept for
 * backwards compatibility with components that call it directly.
 */
export async function getNotifications() {
  if (USE_MOCK) return { success: true, notifications: [] };

  return apiFetch('/auth/notifications');
}

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------

/**
 * List books with optional level filter.
 * GET /books?level=beginner
 *
 * @param {string|null} level
 */
export async function getBooks(level = null) {
  if (USE_MOCK) return mockGetBooks(level);

  const query = level ? `?level=${encodeURIComponent(level)}` : '';
  return apiFetch(`/books${query}`);
}

/**
 * Get a single book by ID.
 * GET /books/:bookId
 *
 * @param {string} bookId
 */
export async function getBook(bookId) {
  if (USE_MOCK) return { success: true, book: { ...MOCK_BOOK_DETAIL, id: bookId } };

  return apiFetch(`/books/${bookId}`);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * Start a new Q&A session.
 * POST /sessions/start
 *
 * NOTE: The backend route is /sessions/start, not /sessions (POST).
 *
 * @param {string} studentId
 * @param {string} bookId
 */
export async function startSession(studentId, bookId) {
  if (USE_MOCK) return mockStartSession(studentId, bookId);

  return apiFetch('/sessions/start', {
    method: 'POST',
    body: JSON.stringify({ studentId, bookId }),
  });
}

/**
 * Send a student message and receive Alice's reply.
 * POST /sessions/:sessionId/message
 *
 * NOTE: The backend route uses the singular "message", not "messages".
 *
 * @param {string} sessionId
 * @param {string} content
 * @param {string} stage
 */
export async function sendMessage(sessionId, content, stage) {
  if (USE_MOCK) return mockSendMessage(sessionId, content, stage);

  return apiFetch(`/sessions/${sessionId}/message`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      stage,
      timestamp: new Date().toISOString(),
    }),
  });
}

/**
 * Mark a session as complete.
 * POST /sessions/:sessionId/complete
 *
 * @param {string} sessionId
 * @param {object} feedback
 */
export async function completeSession(sessionId, feedback = {}) {
  if (USE_MOCK) return mockCompleteSession(sessionId);

  return apiFetch(`/sessions/${sessionId}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      ...feedback,
      completedAt: new Date().toISOString(),
    }),
  });
}

/**
 * Get a full session review with dialogue history and vocabulary.
 * GET /sessions/:sessionId/review
 *
 * @param {string} sessionId
 */
export async function getSessionReview(sessionId) {
  if (USE_MOCK) return mockSessionReview(sessionId);

  return apiFetch(`/sessions/${sessionId}/review`);
}

/**
 * Get AI-generated personal feedback for a completed session.
 * GET /sessions/:sessionId/feedback
 *
 * @param {string} sessionId
 */
export async function getSessionFeedback(sessionId) {
  if (USE_MOCK) return { success: true, ai_feedback: MOCK_SESSION_FEEDBACK };

  return apiFetch(`/sessions/${sessionId}/feedback`);
}

/**
 * Get per-stage scores for a session.
 * GET /sessions/:sessionId/stage-scores
 *
 * @param {string} sessionId
 */
export async function getSessionStageScores(sessionId) {
  if (USE_MOCK) return { success: true, stageScores: [] };

  return apiFetch(`/sessions/${sessionId}/stage-scores`);
}

/**
 * Pause a session (Save & Exit).
 * PUT /sessions/:sessionId/pause
 *
 * @param {string} sessionId
 */
export async function pauseSession(sessionId) {
  if (USE_MOCK) return { success: true, sessionId };

  return apiFetch(`/sessions/${sessionId}/pause`, { method: 'PUT' });
}

/**
 * Resume a previously paused session.
 * PUT /sessions/:sessionId/resume
 *
 * @param {string} sessionId
 */
export async function resumeSession(sessionId) {
  if (USE_MOCK) return { success: true, sessionId };

  return apiFetch(`/sessions/${sessionId}/resume`, { method: 'PUT' });
}

/**
 * Get all sessions for a student.
 * GET /sessions/student/:studentId
 *
 * @param {string} studentId
 */
export async function getStudentSessions(studentId) {
  if (USE_MOCK) return { success: true, sessions: [] };

  return apiFetch(`/sessions/student/${studentId}`);
}

/**
 * Get thinking highlights for a student (parent dashboard).
 * GET /sessions/student/:studentId/highlights?limit=5
 *
 * @param {string} studentId
 * @param {number} limit
 */
export async function getStudentHighlights(studentId, limit = 5) {
  if (USE_MOCK) return { highlights: [], growthSummary: null };

  return apiFetch(
    `/sessions/student/${studentId}/highlights?limit=${limit}`
  );
}

/**
 * Save a student prediction during a session.
 * POST /sessions/:sessionId/prediction
 *
 * @param {string} sessionId
 * @param {string} predictionText
 * @param {string} predictionType
 * @param {string} stage
 * @param {number} confidenceBefore
 */
export async function savePrediction(
  sessionId,
  predictionText,
  predictionType,
  stage,
  confidenceBefore
) {
  if (USE_MOCK) return { prediction: null };

  try {
    return await apiFetch(`/sessions/${sessionId}/prediction`, {
      method: 'POST',
      body: JSON.stringify({ predictionText, predictionType, stage, confidenceBefore }),
    });
  } catch (error) {
    // Non-critical enrichment feature — log and return a safe empty value
    console.error('Save prediction failed:', error);
    return { prediction: null, error: error.message };
  }
}

/**
 * Verify a student prediction.
 * PUT /sessions/prediction/:predictionId/verify
 *
 * @param {string} predictionId
 * @param {boolean} wasCorrect
 * @param {string} verificationText
 * @param {number} confidenceAfter
 */
export async function verifyPrediction(
  predictionId,
  wasCorrect,
  verificationText,
  confidenceAfter
) {
  if (USE_MOCK) return { success: true };

  try {
    return await apiFetch(`/sessions/prediction/${predictionId}/verify`, {
      method: 'PUT',
      body: JSON.stringify({ wasCorrect, verificationText, confidenceAfter }),
    });
  } catch (error) {
    // Non-critical enrichment feature
    console.error('Verify prediction failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a student's prediction portfolio.
 * GET /sessions/student/:studentId/portfolio
 *
 * @param {string} studentId
 */
export async function getPredictionPortfolio(studentId) {
  if (USE_MOCK) return mockPredictionPortfolio(studentId);

  return apiFetch(`/sessions/student/${studentId}/portfolio`);
}

/**
 * Record an emotion reaction to an Alice message (fire-and-forget analytics).
 * This endpoint does not yet exist on the backend; the call is silently
 * suppressed so no session is disrupted.
 *
 * @param {string} sessionId
 * @param {object} data
 */
export async function recordEmotionReaction(sessionId, data) {
  if (USE_MOCK) return { success: false };

  // Emotion reactions are non-critical analytics.  We attempt the call but
  // never surface errors to the user — a missing endpoint on the backend
  // results in a silent no-op rather than a thrown error.
  try {
    return await apiFetch(`/sessions/${sessionId}/emotion`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.warn('Record emotion reaction failed (non-critical):', error);
    return { success: false };
  }
}

/**
 * Request a question rephrase when a student is stuck.
 * This endpoint does not yet exist on the backend; a safe fallback message is
 * returned so the session UI is never blocked.
 *
 * @param {string} sessionId
 * @param {string} originalQuestion
 * @param {string} stage
 */
export async function requestRephrase(sessionId, originalQuestion, stage) {
  if (USE_MOCK) {
    return {
      content:
        "Let me ask that in a simpler way! Was it more EXCITING or more SURPRISING?",
      isMock: true,
    };
  }

  try {
    return await apiFetch(`/sessions/${sessionId}/rephrase`, {
      method: 'POST',
      body: JSON.stringify({ originalQuestion, stage }),
    });
  } catch (error) {
    console.error('Rephrase request failed:', error);
    // Return a safe fallback so the UI is not blocked
    return {
      content:
        "Let me ask that in a simpler way! Was it more EXCITING or more SURPRISING?",
      isMock: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Student progress
// ---------------------------------------------------------------------------

/**
 * Get aggregated progress for a student.
 *
 * The backend exposes rich analytics at GET /admin/students/:studentId/analytics.
 * The legacy GET /students/:studentId/progress path does not exist; this
 * function maps to the analytics endpoint and normalises the shape for callers
 * that expect a { progress } object.
 *
 * GET /admin/students/:studentId/analytics
 *
 * @param {string} studentId
 */
export async function getStudentProgress(studentId) {
  if (USE_MOCK) return mockStudentProgress(studentId);

  const data = await apiFetch(`/admin/students/${studentId}/analytics`);

  // Normalise analytics payload into the { progress } shape that components expect
  const a = data.analytics || data;
  return {
    success: true,
    progress: {
      studentId,
      totalBooksRead: a.student?.total_books_read ?? a.totalBooksRead ?? 0,
      totalSessions: a.recentSessions?.length ?? a.totalSessions ?? 0,
      averageLevelScore: a.averageLevelScore ?? 0,
      averageGrammarScore: a.averageGrammarScore ?? 0,
      vocabularySize: a.vocabSummary?.totalWords ?? a.vocabularySize ?? 0,
      weeklyReadingGoal: a.weeklyReadingGoal ?? 3,
      weeklyReadingProgress: a.weeklyReadingProgress ?? 0,
      streak: a.student?.current_streak ?? a.streak ?? 0,
      badges: a.achievements ?? a.badges ?? [],
    },
  };
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * Get vocabulary for a student filtered optionally by session.
 * GET /students/:studentId/vocabulary?sessionId=...
 *
 * NOTE: This legacy path maps to the vocabulary router endpoint
 * GET /vocabulary/:studentId (with optional ?sessionId query param).
 *
 * @param {string} studentId
 * @param {string|null} sessionId
 */
export async function getVocabulary(studentId, sessionId = null) {
  if (USE_MOCK) return mockVocabulary(studentId, sessionId);

  const query = sessionId ? `?sessionId=${sessionId}` : '';
  return apiFetch(`/vocabulary/${studentId}${query}`);
}

/**
 * Get all vocabulary words for a student.
 * GET /vocabulary/:studentId
 *
 * @param {string} studentId
 */
export async function getStudentVocabulary(studentId) {
  if (USE_MOCK) {
    return {
      success: true,
      words: [],
      totalWords: 0,
      newWords: 0,
      reviewWords: 0,
    };
  }

  return apiFetch(`/vocabulary/${studentId}`);
}

/**
 * Get words due for spaced-repetition review today.
 * GET /vocabulary/:studentId/due-today
 *
 * @param {string} studentId
 */
export async function getVocabDueToday(studentId) {
  if (USE_MOCK) return MOCK_VOCAB_DUE_TODAY;

  return apiFetch(`/vocabulary/${studentId}/due-today`);
}

/**
 * Get vocabulary statistics for a student.
 * GET /vocabulary/:studentId/stats
 *
 * @param {string} studentId
 */
export async function getVocabStats(studentId) {
  if (USE_MOCK) return MOCK_VOCAB_STATS;

  return apiFetch(`/vocabulary/${studentId}/stats`);
}

/**
 * Record a spaced-repetition practice result.
 * POST /vocabulary/:studentId/practice-result
 *
 * @param {string} studentId
 * @param {string} vocabularyId
 * @param {boolean} isCorrect
 * @param {number} responseTimeMs
 */
export async function recordPracticeResult(
  studentId,
  vocabularyId,
  isCorrect,
  responseTimeMs
) {
  if (USE_MOCK) return { success: true };

  try {
    return await apiFetch(`/vocabulary/${studentId}/practice-result`, {
      method: 'POST',
      body: JSON.stringify({ vocabularyId, isCorrect, responseTimeMs }),
    });
  } catch (error) {
    // Practice result recording is non-critical analytics — never block UI
    console.error('Record practice result failed:', error);
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/**
 * Fetch parent notification inbox with optional unread filter.
 * GET /notifications?unreadOnly=true
 *
 * Returns: { notifications, unreadCount, prefs }
 *
 * @param {boolean} unreadOnly
 */
export async function getParentNotifications(unreadOnly = false) {
  if (USE_MOCK) return mockParentNotifications();

  const query = unreadOnly ? '?unreadOnly=true' : '';
  return apiFetch(`/notifications${query}`);
}

/**
 * Save (upsert) parent notification preferences.
 * POST /notifications/preferences
 *
 * @param {{ emailEnabled: boolean, sessionAlerts: boolean, weeklyReport: boolean, notificationEmail: string }} prefs
 */
export async function updateNotificationPrefs(prefs) {
  if (USE_MOCK) return mockUpdateNotificationPrefs(prefs);

  return apiFetch('/notifications/preferences', {
    method: 'POST',
    body: JSON.stringify(prefs),
  });
}

/**
 * Mark a single notification as read, or all when id === 'all'.
 * PATCH /notifications/:id/read
 *
 * @param {string} id
 */
export async function markNotificationRead(id) {
  if (USE_MOCK) return { success: true };

  return apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/**
 * Get rich analytics for a student (admin only).
 * GET /admin/students/:studentId/analytics
 *
 * @param {string} studentId
 */
export async function getStudentAnalytics(studentId) {
  if (USE_MOCK) return MOCK_STUDENT_ANALYTICS;

  return apiFetch(`/admin/students/${studentId}/analytics`);
}

// ---------------------------------------------------------------------------
// Safety Monitor
// ---------------------------------------------------------------------------

/**
 * Retrieve paginated safety log entries (admin only).
 * GET /safety/logs?page=1&limit=20&days=7&flagType=&source=&reviewed=
 *
 * @param {number} page
 * @param {number} limit
 * @param {{ flagType?: string, source?: string, reviewed?: string, days?: number }} filters
 */
export async function getSafetyLogs(page = 1, limit = 20, filters = {}) {
  if (USE_MOCK) return mockSafetyLogs(page, limit, filters);

  const params = new URLSearchParams({ page, limit });
  if (filters.days)     params.set('days', filters.days);
  if (filters.flagType) params.set('flagType', filters.flagType);
  if (filters.source)   params.set('source', filters.source);
  if (filters.reviewed !== undefined && filters.reviewed !== '')
    params.set('reviewed', filters.reviewed);

  return apiFetch(`/safety/logs?${params.toString()}`);
}

/**
 * Retrieve safety statistics for the last N days (admin only).
 * GET /safety/stats?days=7
 *
 * @param {number} days
 */
export async function getSafetyStats(days = 7) {
  if (USE_MOCK) return mockSafetyStats(days);

  return apiFetch(`/safety/stats?days=${days}`);
}

/**
 * Mark a safety log entry as reviewed.
 * POST /safety/review/:logId
 *
 * @param {number|string} logId
 */
export async function reviewSafetyLog(logId) {
  if (USE_MOCK) return mockReviewSafetyLog(logId);

  return apiFetch(`/safety/review/${logId}`, { method: 'POST' });
}

// ---------------------------------------------------------------------------
// COPPA
// ---------------------------------------------------------------------------

/**
 * Create a COPPA Verifiable Parental Consent payment intent.
 * POST /coppa/verify-intent
 *
 * @param {string} parentEmail
 * @param {string} parentName
 */
export async function createCoppaIntent(parentEmail, parentName) {
  if (USE_MOCK) {
    return {
      success: true,
      clientSecret: 'mock_secret_' + Date.now(),
      paymentIntentId: 'mock_pi_' + Date.now(),
    };
  }

  return apiFetch('/coppa/verify-intent', {
    method: 'POST',
    body: JSON.stringify({ parentEmail, parentName }),
  });
}

/**
 * Confirm a COPPA VPC payment and mark the parent as verified.
 * POST /coppa/verify-confirm
 *
 * @param {string} paymentIntentId
 * @param {string} parentEmail
 * @param {string} parentName
 */
export async function confirmCoppaVerification(
  paymentIntentId,
  parentEmail,
  parentName
) {
  if (USE_MOCK) {
    return { success: true, verified: true };
  }

  return apiFetch('/coppa/verify-confirm', {
    method: 'POST',
    body: JSON.stringify({ paymentIntentId, parentEmail, parentName }),
  });
}

/**
 * Check COPPA verification status for an email address.
 * GET /coppa/status/:email
 *
 * @param {string} email
 */
export async function getCoppaStatus(email) {
  if (USE_MOCK) return { verified: false };

  try {
    return await apiFetch(`/coppa/status/${encodeURIComponent(email)}`);
  } catch (error) {
    console.error('COPPA status check failed:', error);
    return { verified: false };
  }
}

// ---------------------------------------------------------------------------
// Teacher / Academy APIs
// ---------------------------------------------------------------------------

/**
 * Get all classes for the authenticated teacher.
 * GET /teachers/classes
 *
 * Returns: { classes: [{ id, label, time, studentCount }] }
 */
export async function getTeacherClasses() {
  if (USE_MOCK) {
    return {
      classes: [
        { id: 'morning', label: 'Morning Class', time: 'Mon / Wed / Fri  9:00 AM', studentCount: 4 },
        { id: 'afternoon', label: 'Afternoon Class', time: 'Tue / Thu  2:00 PM', studentCount: 3 },
        { id: 'saturday', label: 'Saturday Group', time: 'Sat  10:00 AM', studentCount: 2 },
      ],
    };
  }

  return apiFetch('/teachers/classes');
}

/**
 * Get students enrolled in a specific class.
 * GET /teachers/classes/:classId/students
 *
 * Returns: { students: [{ id, classId, name, avatarEmoji, age, level, booksReviewed,
 *   avgScore, lastActive, status, streak, totalWords, recentSessions, recentWords, aiFeedback }] }
 *
 * @param {string} classId
 */
export async function getClassStudents(classId) {
  if (USE_MOCK) {
    const ALL_STUDENTS = [
      {
        id: 's1', classId: 'morning', name: 'Mia Chen', avatarEmoji: '🌸', age: 9,
        level: 'intermediate', booksReviewed: 12, avgScore: 87,
        lastActive: new Date(Date.now() - 1 * 86400000).toISOString(),
        status: 'active', streak: 7, totalWords: 142,
        recentSessions: [
          { bookTitle: "Charlotte's Web", grammarScore: 88, completedAt: new Date(Date.now() - 86400000).toISOString(), vocabCount: 14 },
          { bookTitle: 'The Secret Garden', grammarScore: 85, completedAt: new Date(Date.now() - 7 * 86400000).toISOString(), vocabCount: 11 },
          { bookTitle: 'Matilda', grammarScore: 90, completedAt: new Date(Date.now() - 14 * 86400000).toISOString(), vocabCount: 18 },
        ],
        recentWords: ['curious', 'adventure', 'determined', 'magnificent', 'compassion'],
        aiFeedback: 'Mia demonstrates excellent critical thinking. Encourage her to use more complex sentence structures.',
      },
      {
        id: 's2', classId: 'morning', name: 'Leo Park', avatarEmoji: '⚡', age: 10,
        level: 'intermediate', booksReviewed: 8, avgScore: 74,
        lastActive: new Date(Date.now() - 3 * 86400000).toISOString(),
        status: 'active', streak: 3, totalWords: 89,
        recentSessions: [
          { bookTitle: 'Magic Tree House', grammarScore: 76, completedAt: new Date(Date.now() - 3 * 86400000).toISOString(), vocabCount: 8 },
          { bookTitle: 'Diary of a Wimpy Kid', grammarScore: 72, completedAt: new Date(Date.now() - 10 * 86400000).toISOString(), vocabCount: 9 },
          { bookTitle: 'Captain Underpants', grammarScore: 74, completedAt: new Date(Date.now() - 17 * 86400000).toISOString(), vocabCount: 7 },
        ],
        recentWords: ['hilarious', 'obstacle', 'sneaky', 'mischievous', 'embarrassed'],
        aiFeedback: 'Leo engages enthusiastically. Focus on expanding vocabulary and using more descriptive language.',
      },
      {
        id: 's3', classId: 'morning', name: 'Sophie Kim', avatarEmoji: '🌙', age: 8,
        level: 'beginner', booksReviewed: 5, avgScore: 65,
        lastActive: new Date(Date.now() - 9 * 86400000).toISOString(),
        status: 'needs_attention', streak: 0, totalWords: 52,
        recentSessions: [
          { bookTitle: 'The Very Hungry Caterpillar', grammarScore: 68, completedAt: new Date(Date.now() - 9 * 86400000).toISOString(), vocabCount: 5 },
          { bookTitle: 'Where the Wild Things Are', grammarScore: 63, completedAt: new Date(Date.now() - 19 * 86400000).toISOString(), vocabCount: 6 },
          { bookTitle: 'Goodnight Moon', grammarScore: 64, completedAt: new Date(Date.now() - 28 * 86400000).toISOString(), vocabCount: 4 },
        ],
        recentWords: ['peaceful', 'forest', 'journey', 'afraid', 'cozy'],
        aiFeedback: 'Sophie is making steady progress. Consistent practice is key — aim for at least 2 sessions per week.',
      },
      {
        id: 's4', classId: 'morning', name: 'James Yoo', avatarEmoji: '🦁', age: 12,
        level: 'advanced', booksReviewed: 18, avgScore: 92,
        lastActive: new Date(Date.now() - 1 * 86400000).toISOString(),
        status: 'active', streak: 14, totalWords: 231,
        recentSessions: [
          { bookTitle: 'A Wrinkle in Time', grammarScore: 94, completedAt: new Date(Date.now() - 86400000).toISOString(), vocabCount: 22 },
          { bookTitle: 'The Hobbit', grammarScore: 91, completedAt: new Date(Date.now() - 8 * 86400000).toISOString(), vocabCount: 25 },
          { bookTitle: 'Percy Jackson', grammarScore: 90, completedAt: new Date(Date.now() - 15 * 86400000).toISOString(), vocabCount: 20 },
        ],
        recentWords: ['formidable', 'perplexed', 'inevitable', 'tenacious', 'luminous'],
        aiFeedback: 'James is an outstanding student. Challenge him with more complex themes and encourage literary analysis.',
      },
      {
        id: 's5', classId: 'afternoon', name: 'Ava Nguyen', avatarEmoji: '🌺', age: 9,
        level: 'intermediate', booksReviewed: 10, avgScore: 81,
        lastActive: new Date(Date.now() - 2 * 86400000).toISOString(),
        status: 'active', streak: 5, totalWords: 118,
        recentSessions: [
          { bookTitle: 'Winnie-the-Pooh', grammarScore: 82, completedAt: new Date(Date.now() - 2 * 86400000).toISOString(), vocabCount: 12 },
          { bookTitle: 'The BFG', grammarScore: 80, completedAt: new Date(Date.now() - 9 * 86400000).toISOString(), vocabCount: 13 },
          { bookTitle: 'Fantastic Mr Fox', grammarScore: 81, completedAt: new Date(Date.now() - 16 * 86400000).toISOString(), vocabCount: 10 },
        ],
        recentWords: ['elegant', 'peculiar', 'vibrant', 'curious', 'generous'],
        aiFeedback: 'Ava shows consistent improvement. Encourage her to connect book themes to personal experiences.',
      },
      {
        id: 's6', classId: 'afternoon', name: 'Ethan Lim', avatarEmoji: '🚀', age: 11,
        level: 'intermediate', booksReviewed: 7, avgScore: 69,
        lastActive: new Date(Date.now() - 6 * 86400000).toISOString(),
        status: 'needs_attention', streak: 1, totalWords: 73,
        recentSessions: [
          { bookTitle: 'Harry Potter and the Sorcerer Stone', grammarScore: 71, completedAt: new Date(Date.now() - 6 * 86400000).toISOString(), vocabCount: 9 },
          { bookTitle: 'The Lion the Witch and the Wardrobe', grammarScore: 68, completedAt: new Date(Date.now() - 14 * 86400000).toISOString(), vocabCount: 8 },
          { bookTitle: 'Stuart Little', grammarScore: 68, completedAt: new Date(Date.now() - 22 * 86400000).toISOString(), vocabCount: 7 },
        ],
        recentWords: ['brave', 'wizard', 'mysterious', 'discover', 'challenge'],
        aiFeedback: 'Ethan needs more encouragement. Try pairing him with a reading buddy to build confidence.',
      },
      {
        id: 's7', classId: 'afternoon', name: 'Zoe Lin', avatarEmoji: '🦋', age: 7,
        level: 'beginner', booksReviewed: 14, avgScore: 79,
        lastActive: new Date(Date.now() - 1 * 86400000).toISOString(),
        status: 'active', streak: 9, totalWords: 105,
        recentSessions: [
          { bookTitle: 'Elephant and Piggie: Today I Will Fly', grammarScore: 80, completedAt: new Date(Date.now() - 86400000).toISOString(), vocabCount: 10 },
          { bookTitle: 'Frog and Toad Are Friends', grammarScore: 79, completedAt: new Date(Date.now() - 7 * 86400000).toISOString(), vocabCount: 9 },
          { bookTitle: 'Biscuit', grammarScore: 78, completedAt: new Date(Date.now() - 14 * 86400000).toISOString(), vocabCount: 8 },
        ],
        recentWords: ['friendship', 'hopeful', 'gentle', 'playful', 'wonder'],
        aiFeedback: 'Zoe is progressing beautifully for her age. Her vocabulary retention is impressive.',
      },
      {
        id: 's8', classId: 'saturday', name: 'Noah Kang', avatarEmoji: '🐉', age: 13,
        level: 'advanced', booksReviewed: 21, avgScore: 89,
        lastActive: new Date(Date.now() - 5 * 86400000).toISOString(),
        status: 'active', streak: 6, totalWords: 198,
        recentSessions: [
          { bookTitle: 'Inkheart', grammarScore: 90, completedAt: new Date(Date.now() - 5 * 86400000).toISOString(), vocabCount: 19 },
          { bookTitle: 'Eragon', grammarScore: 88, completedAt: new Date(Date.now() - 12 * 86400000).toISOString(), vocabCount: 21 },
          { bookTitle: 'The Giver', grammarScore: 89, completedAt: new Date(Date.now() - 19 * 86400000).toISOString(), vocabCount: 17 },
        ],
        recentWords: ['dystopian', 'resilience', 'identity', 'sacrifice', 'profound'],
        aiFeedback: 'Noah demonstrates sophisticated literary comprehension. Encourage him to write short summaries.',
      },
      {
        id: 's9', classId: 'saturday', name: 'Lily Han', avatarEmoji: '🌷', age: 10,
        level: 'intermediate', booksReviewed: 3, avgScore: 58,
        lastActive: new Date(Date.now() - 15 * 86400000).toISOString(),
        status: 'inactive', streak: 0, totalWords: 31,
        recentSessions: [
          { bookTitle: 'Judy Moody', grammarScore: 60, completedAt: new Date(Date.now() - 15 * 86400000).toISOString(), vocabCount: 6 },
          { bookTitle: 'Ramona Quimby Age 8', grammarScore: 56, completedAt: new Date(Date.now() - 28 * 86400000).toISOString(), vocabCount: 5 },
          { bookTitle: 'Clementine', grammarScore: 58, completedAt: new Date(Date.now() - 40 * 86400000).toISOString(), vocabCount: 5 },
        ],
        recentWords: ['moody', 'bossy', 'clever', 'silly', 'worried'],
        aiFeedback: 'Lily has been inactive for 2 weeks. A friendly reminder and encouragement call is recommended.',
      },
    ];
    const filtered = ALL_STUDENTS.filter((s) => s.classId === classId);
    return { students: filtered };
  }

  return apiFetch(`/teachers/classes/${encodeURIComponent(classId)}/students`);
}

/**
 * Get detailed profile for a single student (teacher view).
 * GET /teachers/students/:studentId
 *
 * @param {string} studentId
 */
export async function getStudentDetail(studentId) {
  if (USE_MOCK) {
    return { student: null };
  }

  return apiFetch(`/teachers/students/${encodeURIComponent(studentId)}`);
}

/**
 * Assign a book to all students in a class with an optional due date.
 * POST /teachers/classes/:classId/assign-book
 *
 * @param {string} classId
 * @param {string} bookId
 * @param {string|null} dueDate  ISO date string, e.g. "2026-04-01"
 */
export async function assignBookToClass(classId, bookId, dueDate = null) {
  if (USE_MOCK) {
    return { success: true, classId, bookId, dueDate };
  }

  return apiFetch(`/teachers/classes/${encodeURIComponent(classId)}/assign-book`, {
    method: 'POST',
    body: JSON.stringify({ bookId, dueDate }),
  });
}

/**
 * Export a class report as CSV.
 * GET /teachers/classes/:classId/export-csv
 *
 * In production the backend responds with text/csv.
 * In mock mode a CSV string is generated locally from the embedded student data.
 *
 * @param {string} classId
 * @returns {Promise<string>}  Raw CSV text
 */
export async function exportClassCSV(classId) {
  if (USE_MOCK) {
    // Build CSV from the same mock students used by getClassStudents
    const { students } = await getClassStudents(classId);
    const header = 'Name,Age,Level,Books Reviewed,Avg Score (%),Total Words,Streak (days),Status,Last Active';
    const rows = students.map((s) => {
      const lastActive = s.lastActive
        ? new Date(s.lastActive).toLocaleDateString('en-US')
        : 'Never';
      return [
        `"${s.name}"`,
        s.age,
        s.level,
        s.booksReviewed,
        s.avgScore,
        s.totalWords,
        s.streak,
        s.status,
        lastActive,
      ].join(',');
    });
    return [header, ...rows].join('\n');
  }

  // Real API: expect text/csv response
  const url = `${API_BASE}/api/teachers/classes/${encodeURIComponent(classId)}/export-csv`;
  const token = typeof window !== 'undefined' ? getItem('token') : null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(url, {
      credentials: 'include',
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = new Error(`Export failed: ${response.status} ${response.statusText}`);
      error.status = response.status;
      throw error;
    }

    return await response.text();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Export timed out. Please try again.');
    }
    throw error;
  }
}

/**
 * Get aggregate statistics for all classes managed by the teacher.
 * GET /teachers/stats
 *
 * Returns: { totalStudents, totalClasses, avgScore, activeRate, totalBooksRead, totalWords }
 */
export async function getTeacherStats() {
  if (USE_MOCK) {
    return {
      totalStudents: 9,
      totalClasses: 3,
      avgScore: 77,
      activeRate: 66,
      totalBooksRead: 98,
      totalWords: 1039,
    };
  }

  return apiFetch('/teachers/stats');
}

// ---------------------------------------------------------------------------
// Default export (namespace object for convenience)
// ---------------------------------------------------------------------------

const api = {
  // Auth
  parentRegister,
  addChild,
  parentLogin,
  childSelect,
  getCurrentUser,
  logout,
  getNotifications,
  // Books
  getBooks,
  getBook,
  // Sessions
  startSession,
  sendMessage,
  completeSession,
  getSessionReview,
  getSessionFeedback,
  getSessionStageScores,
  pauseSession,
  resumeSession,
  getStudentSessions,
  getStudentHighlights,
  savePrediction,
  verifyPrediction,
  getPredictionPortfolio,
  recordEmotionReaction,
  requestRephrase,
  // Student
  getStudentProgress,
  // Vocabulary
  getVocabulary,
  getStudentVocabulary,
  getVocabDueToday,
  getVocabStats,
  recordPracticeResult,
  // Notifications
  getParentNotifications,
  updateNotificationPrefs,
  markNotificationRead,
  // Admin
  getStudentAnalytics,
  // Safety
  getSafetyLogs,
  getSafetyStats,
  reviewSafetyLog,
  // COPPA
  createCoppaIntent,
  confirmCoppaVerification,
  getCoppaStatus,
  // Teacher / Academy
  getTeacherClasses,
  getClassStudents,
  getStudentDetail,
  assignBookToClass,
  exportClassCSV,
  getTeacherStats,
};

export default api;
