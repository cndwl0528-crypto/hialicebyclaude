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
