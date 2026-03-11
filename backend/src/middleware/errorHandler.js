import logger from '../lib/logger.js';

export function errorHandler(err, req, res, next) {
  logger.error({ err, method: req.method, path: req.path }, 'Unhandled error');

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Authentication required' });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
}
