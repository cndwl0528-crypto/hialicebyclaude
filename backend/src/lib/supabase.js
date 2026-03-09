import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

// Service role client (for backend operations)
export const supabase = createClient(
  config.supabase.url || 'http://localhost:54321',
  config.supabase.serviceKey || config.supabase.anonKey || 'placeholder',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Anon client factory (for user-scoped operations)
export function createAnonClient(accessToken) {
  return createClient(
    config.supabase.url || 'http://localhost:54321',
    config.supabase.anonKey || 'placeholder',
    {
      global: {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      },
    }
  );
}
