import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV || 'development';

/**
 * Resolve JWT_SECRET with strict enforcement.
 * - production: missing secret → immediate process exit (no fallback)
 * - development: missing secret → warning printed, dev-only fallback used
 */
function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (nodeEnv === 'development') {
      console.warn(
        '[WARNING] JWT_SECRET is not set. Using insecure development fallback. ' +
        'Set JWT_SECRET in your .env file before running in production.'
      );
      return 'hialice-dev-secret-NOT-FOR-PRODUCTION';
    }

    console.error('[FATAL] JWT_SECRET environment variable is required in production. Server will not start.');
    process.exit(1);
  }

  return secret;
}

// ============================================================================
// Environment validation
// ============================================================================

/**
 * Required environment variables per runtime environment.
 * In production every variable in the list must be set or the process exits.
 * In development missing variables produce a console warning so local work
 * is not blocked, but the developer is clearly informed.
 */
const REQUIRED_ENV_VARS = {
  production: [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'ANTHROPIC_API_KEY',
    'JWT_SECRET',
    'ALLOWED_ORIGINS',
  ],
  development: [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
  ],
};

/**
 * Validate that all environment variables required for the current
 * NODE_ENV are present.
 *
 * - Production: any missing variable causes an immediate process exit (1).
 * - Development: missing variables log a warning; fallbacks keep the server running.
 *
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateEnv() {
  const env = nodeEnv;
  const required = REQUIRED_ENV_VARS[env] ?? REQUIRED_ENV_VARS.development;
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    const msg = `Missing required environment variables: ${missing.join(', ')}`;
    if (env === 'production') {
      console.error(`[CONFIG ERROR] ${msg}`);
      process.exit(1);
    } else {
      console.warn(`[CONFIG WARNING] ${msg} — Using fallbacks for development`);
    }
  }

  return { valid: missing.length === 0, missing };
}

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv,
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  jwt: {
    secret: resolveJwtSecret(),
  },
  elevenLabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY, // Whisper STT
  },
};
