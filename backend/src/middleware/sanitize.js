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
 * Words that are ALWAYS blocked regardless of context.
 * These have no legitimate use in a children's book discussion.
 */
const ALWAYS_BLOCKED = [
  'fuck', 'shit', 'bitch', 'ass', 'damn', 'bastard', 'crap',
  'nigger', 'faggot', 'retard',
];

/**
 * Words that are blocked ONLY when used with violent/harmful INTENT,
 * but allowed in literary discussion context.
 * Each entry has the word and patterns that indicate harmful vs literary use.
 */
const CONTEXT_SENSITIVE_WORDS = [
  {
    word: 'kill',
    allowedPatterns: [
      /the (character|hero|villain|protagonist|antagonist|knight|prince|princess|king|queen|witch|monster|dragon|wolf|bear|giant|pirate|captain|soldier|warrior).*kill/i,
      /kill.*the (character|hero|villain|protagonist|antagonist|dragon|monster|wolf|bear|giant|witch|pirate)/i,
      /killed?\s+(the|a|an|that|this|his|her|their|its)/i,
      /got\s+killed/i,
      /was\s+killed/i,
      /almost\s+killed/i,
      /tried\s+to\s+kill/i,
      /want(ed|s)?\s+to\s+kill\s+(the|a|an|that|this|him|her|it|them)/i,
    ],
    blockedPatterns: [
      /i\s+(will|want\s+to|wanna|gonna|am\s+going\s+to)\s+kill\s+(you|my|someone|everybody|everyone|people|myself)/i,
      /kill\s+(you|your|myself|themselves|ourselves)/i,
    ]
  },
  {
    word: 'die',
    allowedPatterns: [
      /the (character|hero|villain|protagonist|antagonist).*die/i,
      /(did|didn't|does|doesn't)\s+(he|she|it|they|the)\s+die/i,
      /die[ds]?\s+(in|at|from|because|when|before|after|during)/i,
      /almost\s+died/i,
      /going\s+to\s+die/i,
      /afraid\s+(to|of)\s+die/i,
      /didn't\s+(want\s+to\s+)?die/i,
    ],
    blockedPatterns: [
      /i\s+(want\s+to|wanna|gonna|wish\s+i\s+could)\s+die/i,
      /(go\s+)?die\s+already/i,
      /you\s+should\s+die/i,
    ]
  },
  {
    word: 'hate',
    allowedPatterns: [
      /hate[ds]?\s+(the|that|this|reading|books?|school|homework|test)/i,
      /hate[ds]?\s+(it|him|her|them|the\s+(book|story|character|ending|part))/i,
    ],
    blockedPatterns: [
      /i\s+hate\s+(you|myself|my\s+(life|self)|everyone|everything|this\s+app)/i,
    ]
  },
  {
    word: 'stupid',
    allowedPatterns: [
      /stupid\s+(idea|plan|decision|choice|thing|mistake|question)/i,
      /(that|it|the\s+\w+)\s+(is|was|seems?)\s+stupid/i,
    ],
    blockedPatterns: [
      /(i\s+am|i'm|you\s+are|you're|she\s+is|he\s+is)\s+stupid/i,
    ]
  },
];

/**
 * Context-aware profanity filter for children's book discussions.
 *
 * Strategy:
 * 1. ALWAYS block words with no literary value (slurs, explicit language)
 * 2. For context-sensitive words (kill, die, hate, stupid):
 *    - If matches a BLOCKED pattern -> censor it (harmful intent detected)
 *    - If matches an ALLOWED pattern -> let it through (literary discussion)
 *    - If matches neither -> censor it (err on the side of caution)
 * 3. Flag but don't block, to avoid frustrating young users
 */
export function profanityFilter(req, res, next) {
  if (!req.body?.content || typeof req.body.content !== 'string') {
    return next();
  }

  let content = req.body.content;
  let hasProfanity = false;

  // Step 1: Always-blocked words
  for (const word of ALWAYS_BLOCKED) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(content)) {
      hasProfanity = true;
      content = content.replace(regex, '*'.repeat(word.length));
    }
  }

  // Step 2: Context-sensitive words
  for (const { word, allowedPatterns, blockedPatterns } of CONTEXT_SENSITIVE_WORDS) {
    const wordRegex = new RegExp(`\\b${word}[a-z]*\\b`, 'gi');
    if (!wordRegex.test(content)) continue;

    // Check blocked patterns first (harmful intent)
    const isBlocked = blockedPatterns.some(pattern => pattern.test(content));
    if (isBlocked) {
      hasProfanity = true;
      content = content.replace(wordRegex, match => '*'.repeat(match.length));
      continue;
    }

    // Check allowed patterns (literary context)
    const isAllowed = allowedPatterns.some(pattern => pattern.test(content));
    if (isAllowed) {
      // Literary context — let it through
      continue;
    }

    // Neither explicitly blocked nor allowed — censor (err on caution)
    hasProfanity = true;
    content = content.replace(wordRegex, match => '*'.repeat(match.length));
  }

  req.body._hasProfanity = hasProfanity;
  req.body.content = content;
  next();
}
