/**
 * Input sanitization middleware for HiAlice
 * Protects against XSS and injection in a children's education app
 */

/**
 * Sanitize a string value - remove HTML tags and dangerous characters
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>'"]/g, '')  // Remove remaining angle brackets and quotes
    .trim();
}

/**
 * Deep sanitize an object's string values — handles nested objects recursively
 */
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => {
        if (typeof item === 'string') return sanitizeString(item);
        if (item && typeof item === 'object') return sanitizeObject(item); // recurse into array objects
        return item;
      });
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value); // recurse into nested objects
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Express middleware to sanitize request body
 */
export function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

/**
 * Express middleware to sanitize query params
 */
export function sanitizeQuery(req, res, next) {
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  next();
}

/**
 * Generic in-memory rate limiter factory.
 * For production, replace backing store with Redis.
 *
 * @param {number} windowMs  - Time window in milliseconds
 * @param {number} maxRequests - Max allowed requests per window per IP
 * @returns Express middleware function
 */
function createRateLimiter(windowMs, maxRequests) {
  const requestCounts = new Map();

  // Cleanup expired entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of requestCounts) {
      if (now > entry.resetAt) {
        requestCounts.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  return function rateLimiterMiddleware(req, res, next) {
    const key = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();

    if (!requestCounts.has(key)) {
      requestCounts.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    const entry = requestCounts.get(key);

    if (now > entry.resetAt) {
      entry.count = 1;
      entry.resetAt = now + windowMs;
      return next();
    }

    entry.count++;

    if (entry.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment and try again.',
      });
    }

    next();
  };
}

/**
 * Global rate limiter — 100 requests per minute per IP
 */
export const rateLimiter = createRateLimiter(60 * 1000, 100);

/**
 * Stricter rate limiter for login endpoints — 10 requests per minute per IP.
 * Apply to /auth/parent-login to mitigate brute-force attacks.
 */
export const authRateLimiter = createRateLimiter(60 * 1000, 10);
