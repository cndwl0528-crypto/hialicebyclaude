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

// ============================================================================
// Input length limiter
// ============================================================================

const MAX_BODY_JSON_SIZE = 10_000; // 10 KB serialised JSON

/**
 * Reject payloads that exceed MAX_BODY_JSON_SIZE and truncate individual
 * string fields to 1 000 characters so runaway inputs never reach the AI or DB.
 *
 * This is a defence-in-depth complement to Express's built-in `limit` option
 * on `express.json()`, which guards the raw byte stream.  Here we guard the
 * parsed object, which can differ after compression.
 */
export function inputLengthLimiter(req, res, next) {
  const serialised = JSON.stringify(req.body || {});
  if (serialised.length > MAX_BODY_JSON_SIZE) {
    return res.status(413).json({ error: 'Request body too large' });
  }

  req.body = truncateStrings(req.body);
  next();
}

/**
 * Recursively truncate all string values in an object to maxLen characters.
 * Returns a new object; does not mutate the original.
 *
 * @param {unknown} obj
 * @param {number}  [maxLen=1000]
 * @returns {unknown}
 */
function truncateStrings(obj, maxLen = 1000) {
  if (!obj || typeof obj !== 'object') return obj;

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      if (typeof value === 'string') {
        return [key, value.length > maxLen ? value.substring(0, maxLen) : value];
      }
      if (Array.isArray(value)) {
        return [key, value.map(item => {
          if (typeof item === 'string') return item.length > maxLen ? item.substring(0, maxLen) : item;
          if (item && typeof item === 'object') return truncateStrings(item, maxLen);
          return item;
        })];
      }
      if (value && typeof value === 'object') {
        return [key, truncateStrings(value, maxLen)];
      }
      return [key, value];
    })
  );
}

// ============================================================================
// Profanity filter (children's safety net)
// ============================================================================

/**
 * Minimal blocklist.
 * This is a last-resort safety net; primary content moderation happens inside
 * the AI system prompt (prompts.js) which instructs HiAlice to stay on-topic
 * and age-appropriate.  A dedicated library (e.g. `bad-words`) should replace
 * this list before production.
 */
const BLOCKED_WORDS = [
  'stupid', 'idiot', 'hate', 'kill', 'die',
];

/**
 * Scan `req.body.content` for blocked words.
 * When found, the middleware does NOT block the request — instead it:
 *   1. Sets `req.body._hasProfanity = true` so downstream handlers can log/flag.
 *   2. Replaces each blocked word with asterisks of the same length.
 *
 * Keeping the message (sanitised) rather than rejecting it avoids frustrating
 * young users who may trigger false positives on common words.
 */
export function profanityFilter(req, res, next) {
  if (req.body?.content && typeof req.body.content === 'string') {
    const lower = req.body.content.toLowerCase();
    const hasBlocked = BLOCKED_WORDS.some(word => lower.includes(word));

    if (hasBlocked) {
      req.body._hasProfanity = true;
      req.body.content = BLOCKED_WORDS.reduce(
        (text, word) => text.replace(new RegExp(word, 'gi'), '*'.repeat(word.length)),
        req.body.content
      );
    }
  }
  next();
}
