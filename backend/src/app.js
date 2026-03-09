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

// Security middleware
app.use(cors());
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
