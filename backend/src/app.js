import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { errorHandler } from './middleware/errorHandler.js';
import { sanitizeBody, sanitizeQuery, rateLimiter, inputLengthLimiter, profanityFilter } from './middleware/sanitize.js';
import { validateEnv } from './lib/config.js';
import logger from './lib/logger.js';
import { sentryErrorHandler } from './lib/sentry.js';
import { supabase } from './lib/supabase.js';
import authRouter from './routes/auth.js';
import booksRouter from './routes/books.js';
import sessionsRouter from './routes/sessions.js';
import vocabularyRouter from './routes/vocabulary.js';
import adminRouter from './routes/admin.js';
import ttsRouter from './routes/tts.js';
import coppaRouter from './routes/coppa.js';

// Validate required environment variables at startup.
// Exits the process in production if critical vars are missing.
validateEnv();

const app = express();

// Structured request logging via pino-http
app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/health' || req.url === '/health/db',
  },
}));

// Restrict CORS to explicitly allowed origins only (no wildcard)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3001', 'http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json({ limit: '1mb' })); // Limit raw payload size
app.use(cookieParser());
app.use(rateLimiter);          // Per-IP rate limiting
app.use(inputLengthLimiter);   // Reject/truncate oversized request bodies
app.use(sanitizeBody);         // Strip HTML/XSS from all body strings
app.use(sanitizeQuery);        // Strip HTML/XSS from query params
app.use(profanityFilter);      // Flag and sanitise inappropriate content in student messages

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Allow microphone access only from same origin (required for STT voice input)
  res.setHeader('Permissions-Policy', 'microphone=(self)');
  // Basic CSP: restrict resource loading to same origin; allow HTTPS APIs
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "connect-src 'self' https:; media-src 'self' blob:; img-src 'self' data: https:; " +
    "frame-ancestors 'none'"
  );
  // Force HTTPS for 1 year including subdomains
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Health check — basic
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'hialice-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Health check — database connectivity
app.get('/health/db', async (req, res) => {
  try {
    const start = Date.now();
    const { error } = await supabase.from('books').select('id').limit(1);
    const latencyMs = Date.now() - start;

    if (error) {
      return res.status(503).json({
        status: 'error',
        database: 'unreachable',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      status: 'ok',
      database: 'connected',
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(503).json({
      status: 'error',
      database: 'unreachable',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/books', booksRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/vocabulary', vocabularyRouter);
app.use('/api/admin', adminRouter);
app.use('/api/tts', ttsRouter);
app.use('/api/coppa', coppaRouter);

// Sentry error handler (no-op when SENTRY_DSN is not set)
app.use(sentryErrorHandler);

// Error handler
app.use(errorHandler);

export default app;
