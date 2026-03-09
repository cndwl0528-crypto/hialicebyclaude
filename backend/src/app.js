import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';
import authRouter from './routes/auth.js';
import booksRouter from './routes/books.js';
import sessionsRouter from './routes/sessions.js';
import vocabularyRouter from './routes/vocabulary.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'hialice-backend', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/books', booksRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/vocabulary', vocabularyRouter);

// Error handler
app.use(errorHandler);

export default app;
