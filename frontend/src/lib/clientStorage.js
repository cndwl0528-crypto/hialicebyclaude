'use client';

export const PERSISTED_KEYS = [
  'token',
  'parentId',
  'parentEmail',
  'userRole',
  'studentId',
  'studentName',
  'studentLevel',
  'studentAge',
  'bookId',
  'bookTitle',
  'children',
  'lastSessionData',
  'lastReviewData',
  'dueVocabIds',
];

export function hydrateSessionFromLocal() {
  if (typeof window === 'undefined') return;

  PERSISTED_KEYS.forEach((key) => {
    const sessionValue = window.sessionStorage.getItem(key);
    if (sessionValue !== null) return;

    const localValue = window.localStorage.getItem(key);
    if (localValue !== null) {
      window.sessionStorage.setItem(key, localValue);
    }
  });
}

export function getItem(key) {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
}

export function setItem(key, value) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(key, value);
  if (PERSISTED_KEYS.includes(key)) {
    window.localStorage.setItem(key, value);
  }
}

export function removeItem(key) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(key);
  window.localStorage.removeItem(key);
}

export function clearPersistedSession() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.clear();
  PERSISTED_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}
