import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';
import { sanitizeBody, sanitizeQuery, rateLimiter } from './middleware/sanitize.js';
import authRouter from './routes/auth.js';
import booksRouter from './routes/books.js';
import sessionsRouter from './routes/sessions.js';
import vocabularyRouter from './routes/vocabulary.js';
import adminRouter from './routes/admin.js';
import ttsRouter from './routes/tts.js';

const app = express();

// Restrict CORS to explicitly allowed origins only (no wildcard)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3001', 'http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json({ limit: '1mb' })); // Limit payload size
app.use(rateLimiter); // Rate limiting
app.use(sanitizeBody); // Sanitize request bodies
app.use(sanitizeQuery); // Sanitize query params

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'hialice-backend', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/books', booksRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/vocabulary', vocabularyRouter);
app.use('/api/admin', adminRouter);
app.use('/api/tts', ttsRouter);

// Error handler
app.use(errorHandler);

export default app;
