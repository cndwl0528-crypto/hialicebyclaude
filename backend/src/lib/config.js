import 'dotenv/config';

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'hialice-dev-secret',
  },
};
