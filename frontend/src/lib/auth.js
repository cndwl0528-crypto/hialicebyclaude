/**
 * auth.js
 * HiAlice — Shared Auth Utilities
 *
 * Centralizes token retrieval and auth header construction.
 */

import { getItem } from '@/lib/clientStorage';

export { API_BASE } from '@/lib/constants';

/**
 * Retrieve the current auth token from client storage.
 * Returns null during SSR or when no token is present.
 */
export const getToken = () => getItem('token');

/**
 * Build a headers object with Content-Type and Authorization for JSON API calls.
 */
export const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
});
