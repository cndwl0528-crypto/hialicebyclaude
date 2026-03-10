/**
 * contentFilter.js
 * HiAlice -- Context-Aware Content Safety Filter
 *
 * Programmatic middleware layer that filters BOTH student inputs AND AI outputs
 * for a children's (ages 6-13) English reading tutoring app.
 *
 * Design decisions:
 *   - Self-contained: zero external dependencies. All detection uses regex
 *     patterns and curated word lists.
 *   - Defence-in-depth: complements (not replaces) the AI system prompt
 *     content policies in prompts.js.
 *   - COPPA-aligned: PII detection is aggressive; distress signals trigger
 *     parent escalation, not silent logging.
 *   - Context-aware: book-discussion emotional vocabulary (sad, scared, angry)
 *     is permitted when the session context indicates a literary discussion.
 *
 * Exports:
 *   filterStudentInput(text, context?)  -> { safe, flags, sanitized, action }
 *   filterAIOutput(text, context?)      -> { safe, flags, filtered }
 *   contentFilterMiddleware             -> Express middleware for req.body.content
 */

// ============================================================================
// WORD / PATTERN LISTS
// ============================================================================

/**
 * Inappropriate words stored as base64 to keep source readable and
 * non-offensive when browsing the codebase.  Each entry is a plain
 * lowercase word encoded with btoa().
 *
 * Category mapping (for audit trail):
 *   P  = profanity
 *   S  = slur
 *   V  = violent threat language
 *   SX = sexual content
 */
const ENCODED_INAPPROPRIATE = [
  // Category P -- profanity
  { encoded: 'ZGFtbg==',       category: 'P'  },  // mild
  { encoded: 'aGVsbA==',       category: 'P'  },  // mild (as expletive)
  { encoded: 'Y3JhcA==',       category: 'P'  },
  { encoded: 'c3R1cGlk',       category: 'P'  },
  { encoded: 'aWRpb3Q=',       category: 'P'  },
  { encoded: 'ZHVtYg==',       category: 'P'  },
  { encoded: 'c2h1dCB1cA==',   category: 'P'  },
  { encoded: 'c3Vja3M=',       category: 'P'  },
  { encoded: 'ZnJlYWs=',       category: 'P'  },
  { encoded: 'bG9zZXI=',       category: 'P'  },
  { encoded: 'amVyaw==',       category: 'P'  },
  { encoded: 'bW9yb24=',       category: 'P'  },
  // Category V -- violent language
  { encoded: 'a2lsbCB5b3U=',   category: 'V'  },
  { encoded: 'ZGllIGluIGE=',   category: 'V'  },
  { encoded: 'bXVyZGVy',       category: 'V'  },
  { encoded: 'c3VpY2lkZQ==',   category: 'V'  },
  // Category S -- slurs (minimal placeholders; expand before production)
  { encoded: 'cmV0YXJk',       category: 'S'  },
  // Category SX -- sexual
  { encoded: 'c2V4',           category: 'SX' },
  { encoded: 'cG9ybg==',       category: 'SX' },
  { encoded: 'bnVkZQ==',       category: 'SX' },
];

/**
 * Decoded word list, built once at module load.
 * Each entry: { word: string, category: string }
 */
const INAPPROPRIATE_WORDS = ENCODED_INAPPROPRIATE.map((entry) => ({
  word: Buffer.from(entry.encoded, 'base64').toString('utf-8').toLowerCase(),
  category: entry.category,
}));

/**
 * Words that are acceptable in a book-discussion context even though they
 * might superficially resemble blocked terms.  For example, discussing that
 * a character "felt angry" or "was scared" is normal literary analysis.
 */
const BOOK_CONTEXT_ALLOWLIST = new Set([
  'sad', 'scared', 'angry', 'mad', 'afraid',
  'cry', 'cried', 'crying',
  'hurt', 'pain', 'suffering',
  'hate', 'hated',             // "I hated the villain" is legitimate
  'die', 'died', 'dead', 'death', 'dying',  // plot events
  'fight', 'fought', 'fighting',
  'kill', 'killed', 'killing', // narrative events ("the wolf killed the pig")
  'evil', 'wicked', 'villain',
  'war', 'battle',
  'scary', 'terrifying', 'horrible',
  'mean', 'cruel', 'bully',
  'jerk',                      // "the villain was a real jerk"
  'loser',                     // character description
  'blood', 'wound',
  'ghost', 'monster', 'witch', 'dragon',
  'destroy', 'destroyed',
  'lost', 'lonely', 'alone',
  'jealous', 'greedy', 'selfish',
  'stupid',                    // "the decision was stupid" in literary context
  'dumb',                      // similar
  'hell',                      // often appears in middle-grade fiction
  'damn',                      // mild, may appear in advanced-level book quotes
  'freak',                     // "freak storm" etc.
  'sucks',                     // colloquial in book reviews
]);

/**
 * Distress / safety-concern keywords.
 * Grouped by severity so the system can choose the right action.
 */
const DISTRESS_PATTERNS = {
  // Tier 1 -- immediate escalation
  critical: [
    /\b(want|going|plan(?:ning)?)\s+to\s+(die|kill\s+my)/i,
    /\bsuicid/i,
    /\bself[- ]?harm/i,
    /\bcut(?:ting)?\s+my(?:self|\s+wrist)/i,
    /\b(abuse|abused|abusing)\b/i,
    /\b(molest|touching\s+me\s+(?:there|wrong))/i,
    /\bhit(?:s|ting)?\s+me\b/i,
    /\bbeat(?:s|ing)?\s+me\b/i,
    /\bno\s+one\s+(?:loves?|cares?)\s+(?:about\s+)?me\b/i,
    /\bi\s+(?:want|wish)\s+(?:to\s+)?disappear\b/i,
    /\brunaway|run\s+away\s+from\s+home\b/i,
  ],
  // Tier 2 -- log + gentle check-in
  concern: [
    /\bi(?:'m|\s+am)\s+(?:so\s+)?(?:sad|unhappy|depressed|scared|afraid)\b/i,
    /\bnobody\s+likes?\s+me\b/i,
    /\bi\s+(?:don'?t|do\s+not)\s+have\s+(?:any\s+)?friends?\b/i,
    /\bi\s+(?:hate|don'?t\s+like)\s+my(?:self|\s+life)\b/i,
    /\bhelp\s+me\b/i,
    /\bi(?:'m|\s+am)\s+(?:all\s+)?alone\b/i,
  ],
};

// ============================================================================
// PII DETECTION PATTERNS
// ============================================================================

const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,

  // US phone numbers: (123) 456-7890, 123-456-7890, 1234567890, +1 ...
  phone: /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,

  // Physical address heuristics:
  // "123 Main Street" / "456 Oak Ave, Apt 2" / "789 Elm Blvd"
  address: /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:St(?:reet)?|Ave(?:nue)?|Blvd|Boulevard|Dr(?:ive)?|Ln|Lane|Rd|Road|Ct|Court|Pl(?:ace)?|Way|Circle|Cir)\b/gi,

  // SSN: 123-45-6789
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,

  // Full-name heuristic: "My name is First Last"
  fullName: /\bmy\s+(?:full\s+)?name\s+is\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\b/gi,

  // ZIP code (standalone 5-digit)
  zipCode: /\b\d{5}(?:-\d{4})?\b/g,
};

/**
 * Short numeric sequences that should NOT be treated as phone numbers.
 * Children frequently type numbers for book pages, ages, counts, etc.
 * We require at least 7 consecutive digits (ignoring separators) to flag.
 */
const MIN_PHONE_DIGITS = 7;

// ============================================================================
// RESPONSE LENGTH GUIDELINES (by student level)
// ============================================================================

const AI_RESPONSE_LIMITS = {
  beginner:     { minWords: 5,  maxWords: 80,  maxSentences: 4  },
  intermediate: { minWords: 10, maxWords: 150, maxSentences: 8  },
  advanced:     { minWords: 10, maxWords: 250, maxSentences: 12 },
};

// ============================================================================
// UTILITY HELPERS
// ============================================================================

/**
 * Count words in a string (splitting on whitespace).
 */
function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Count sentence-ending punctuation as a rough sentence count.
 */
function sentenceCount(text) {
  const matches = text.match(/[.!?]+/g);
  return matches ? matches.length : 1;
}

/**
 * Extract raw digit count from a potential phone match,
 * filtering out short numeric strings that are not phone numbers.
 */
function isLikelyPhoneNumber(match) {
  const digits = match.replace(/\D/g, '');
  return digits.length >= MIN_PHONE_DIGITS;
}

/**
 * Mask a matched PII string: show first and last char, replace middle with *.
 * For very short strings, mask entirely.
 */
function maskPII(str) {
  if (str.length <= 3) return '*'.repeat(str.length);
  return str[0] + '*'.repeat(str.length - 2) + str[str.length - 1];
}

/**
 * Replace profane words with asterisks of the same length.
 */
function censorWord(text, word) {
  // Use word-boundary matching for single words; phrase matching for multi-word
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = word.includes(' ')
    ? new RegExp(escaped, 'gi')
    : new RegExp(`\\b${escaped}\\b`, 'gi');
  return text.replace(pattern, (m) => '*'.repeat(m.length));
}

// ============================================================================
// CORE FILTER: STUDENT INPUT
// ============================================================================

/**
 * Filter student input text for safety.
 *
 * @param {string} text - The student's message content
 * @param {Object} [context] - Session context for adaptive filtering
 * @param {string} [context.studentLevel]  - 'beginner' | 'intermediate' | 'advanced'
 * @param {string} [context.stage]         - 'title' | 'introduction' | 'body' | 'conclusion'
 * @param {string} [context.bookTitle]     - Title of the book being discussed
 * @returns {{ safe: boolean, flags: string[], sanitized: string, action: 'allow'|'warn'|'block'|'escalate' }}
 */
export function filterStudentInput(text, context = {}) {
  if (!text || typeof text !== 'string') {
    return { safe: true, flags: [], sanitized: '', action: 'allow' };
  }

  const flags = [];
  let sanitized = text;
  let action = 'allow';

  const level = (context.studentLevel || 'beginner').toLowerCase();
  const stage = (context.stage || '').toLowerCase();
  const hasBookContext = !!(context.bookTitle || stage);

  // ---- 1. Distress signal detection (highest priority) ----
  for (const pattern of DISTRESS_PATTERNS.critical) {
    if (pattern.test(text)) {
      flags.push('distress:critical');
      action = 'escalate';
      break;
    }
  }

  if (action !== 'escalate') {
    for (const pattern of DISTRESS_PATTERNS.concern) {
      if (pattern.test(text)) {
        flags.push('distress:concern');
        // Only escalate concern-level signals for younger students
        if (level === 'beginner') {
          action = 'escalate';
        } else if (action !== 'block') {
          action = 'warn';
        }
        break;
      }
    }
  }

  // ---- 2. PII detection ----
  const piiTypes = detectPII(text);
  if (piiTypes.length > 0) {
    for (const pii of piiTypes) {
      flags.push(`pii:${pii.type}`);
      // Sanitize PII from the text
      sanitized = sanitized.replace(pii.match, maskPII(pii.match));
    }
    // PII always blocks for children -- COPPA compliance
    if (action !== 'escalate') {
      action = 'block';
    }
  }

  // ---- 3. Profanity / inappropriate language ----
  const profanityHits = detectProfanity(text, hasBookContext, level);
  if (profanityHits.length > 0) {
    for (const hit of profanityHits) {
      flags.push(`profanity:${hit.category}:${hit.word}`);
      sanitized = censorWord(sanitized, hit.word);
    }

    // Determine action severity by category
    const hasViolent = profanityHits.some((h) => h.category === 'V');
    const hasSlur = profanityHits.some((h) => h.category === 'S');
    const hasSexual = profanityHits.some((h) => h.category === 'SX');

    if (hasViolent || hasSlur || hasSexual) {
      if (action !== 'escalate') action = 'block';
    } else {
      // Mild profanity: block for beginners, warn for others
      if (level === 'beginner') {
        if (action !== 'escalate' && action !== 'block') action = 'block';
      } else {
        if (action === 'allow') action = 'warn';
      }
    }
  }

  const safe = action === 'allow';

  return { safe, flags, sanitized, action };
}

// ============================================================================
// CORE FILTER: AI OUTPUT
// ============================================================================

/**
 * Filter AI (HiAlice) output before sending to the student.
 *
 * @param {string} text - The AI-generated response
 * @param {Object} [context] - Session context
 * @param {string} [context.studentLevel]  - 'beginner' | 'intermediate' | 'advanced'
 * @param {string} [context.stage]         - Session stage
 * @param {string} [context.bookTitle]     - Book title
 * @returns {{ safe: boolean, flags: string[], filtered: string }}
 */
export function filterAIOutput(text, context = {}) {
  if (!text || typeof text !== 'string') {
    return { safe: true, flags: [], filtered: '' };
  }

  const flags = [];
  let filtered = text;

  const level = (context.studentLevel || 'intermediate').toLowerCase();

  // ---- 1. PII leakage check ----
  const piiTypes = detectPII(text);
  if (piiTypes.length > 0) {
    for (const pii of piiTypes) {
      flags.push(`ai_pii_leak:${pii.type}`);
      filtered = filtered.replace(pii.match, '[REDACTED]');
    }
  }

  // ---- 2. Inappropriate content check ----
  // AI output should NEVER contain profanity regardless of context
  const lowerText = text.toLowerCase();
  for (const entry of INAPPROPRIATE_WORDS) {
    // For AI output, skip book-context allowlist -- Alice should not use profanity
    if (entry.category === 'P' && ['hell', 'damn', 'stupid', 'dumb', 'freak', 'sucks'].includes(entry.word)) {
      // Mild words: Alice might quote a book title or reference
      // Only flag if not clearly a quotation
      const quotedPattern = new RegExp(`["'][^"']*\\b${escapeRegex(entry.word)}\\b[^"']*["']`, 'i');
      if (quotedPattern.test(text)) continue;
    }

    const wordPattern = entry.word.includes(' ')
      ? new RegExp(escapeRegex(entry.word), 'i')
      : new RegExp(`\\b${escapeRegex(entry.word)}\\b`, 'i');

    if (wordPattern.test(lowerText)) {
      flags.push(`ai_inappropriate:${entry.category}:${entry.word}`);
      filtered = censorWord(filtered, entry.word);
    }
  }

  // ---- 3. On-topic check ----
  // Verify the response contains some book/reading/learning related signals.
  // This is a soft check -- we flag but do not block, since Alice might ask
  // a transition question.
  const onTopicSignals = [
    /\b(book|story|read|chapter|character|author|title|page)\b/i,
    /\b(think|feel|opinion|idea|reason|because|example)\b/i,
    /\b(great|good|nice|wonderful|interesting|tell\s+me|what|how|why)\b/i,
    /\b(learn|practice|word|sentence|write|speak|language)\b/i,
  ];
  const isOnTopic = onTopicSignals.some((pattern) => pattern.test(text));
  if (!isOnTopic) {
    flags.push('ai_off_topic');
  }

  // ---- 4. Response length check ----
  const limits = AI_RESPONSE_LIMITS[level] || AI_RESPONSE_LIMITS.intermediate;
  const words = wordCount(text);
  const sentences = sentenceCount(text);

  if (words > limits.maxWords) {
    flags.push(`ai_too_long:${words}words`);
    // Truncate to approximately maxWords and add ellipsis
    const wordsArray = text.split(/\s+/);
    // Find a sentence boundary near the limit
    let truncateAt = limits.maxWords;
    for (let i = limits.maxWords; i < Math.min(wordsArray.length, limits.maxWords + 20); i++) {
      if (/[.!?]$/.test(wordsArray[i])) {
        truncateAt = i + 1;
        break;
      }
    }
    filtered = wordsArray.slice(0, truncateAt).join(' ');
    if (truncateAt < wordsArray.length && !/[.!?]$/.test(filtered)) {
      filtered += '...';
    }
  }

  if (words < limits.minWords) {
    flags.push(`ai_too_short:${words}words`);
  }

  if (sentences > limits.maxSentences) {
    flags.push(`ai_too_many_sentences:${sentences}`);
  }

  // ---- 5. Ensure no answer-giving patterns (Socratic method enforcement) ----
  // Alice should ask questions, not give direct answers
  const answerGivingPatterns = [
    /\bthe (?:correct|right) answer is\b/i,
    /\bthe answer is\b/i,
    /\byou (?:should have|should've) said\b/i,
    /\bthat(?:'s| is) (?:wrong|incorrect)\b/i,
  ];
  for (const pattern of answerGivingPatterns) {
    if (pattern.test(text)) {
      flags.push('ai_non_socratic');
      break;
    }
  }

  const safe = flags.length === 0;

  return { safe, flags, filtered };
}

// ============================================================================
// EXPRESS MIDDLEWARE
// ============================================================================

/**
 * Express middleware that applies content filtering to req.body.content.
 *
 * Expects the request to optionally carry session context at:
 *   req.body.stage, req.body.level or req.sessionContext
 *
 * On block/escalate, responds with a child-friendly JSON error.
 * On warn, attaches flags to req.contentFilterFlags and continues.
 * On allow, passes through untouched.
 */
export function contentFilterMiddleware(req, res, next) {
  const content = req.body?.content;
  if (!content || typeof content !== 'string') {
    return next();
  }

  // Build context from available request data
  const context = req.sessionContext || {
    studentLevel: req.body.level || req.body.studentLevel || 'beginner',
    stage: req.body.stage || '',
    bookTitle: req.body.bookTitle || '',
  };

  const result = filterStudentInput(content, context);

  // Attach filter metadata to the request for downstream logging
  req.contentFilterResult = result;

  if (result.action === 'escalate') {
    // Log the escalation event (in production, trigger parent notification)
    console.warn(
      `[CONTENT-FILTER] ESCALATION for student input. Flags: ${result.flags.join(', ')}`
    );
    return res.status(200).json({
      reply: {
        speaker: 'alice',
        content: getChildFriendlyMessage('escalate', context.studentLevel),
      },
      filtered: true,
      action: 'escalate',
    });
  }

  if (result.action === 'block') {
    return res.status(200).json({
      reply: {
        speaker: 'alice',
        content: getChildFriendlyMessage('block', context.studentLevel),
      },
      filtered: true,
      action: 'block',
    });
  }

  if (result.action === 'warn') {
    // Let the request through but replace content with sanitized version
    req.body.content = result.sanitized;
    req.contentFilterFlags = result.flags;
  }

  next();
}

// ============================================================================
// CHILD-FRIENDLY REJECTION MESSAGES
// ============================================================================

/**
 * Return an age-appropriate response when content is blocked or escalated.
 */
function getChildFriendlyMessage(action, level = 'beginner') {
  if (action === 'escalate') {
    if (level === 'beginner') {
      return "I care about you! Let's take a little break. If something is bothering you, please talk to a grown-up you trust. Now, shall we get back to our fun book talk?";
    }
    return "I noticed something important in what you said. If you're going through a tough time, please talk to a parent, teacher, or trusted adult. They can help! When you're ready, let's continue our book discussion.";
  }

  if (action === 'block') {
    if (level === 'beginner') {
      return "Oops! Let's keep our words kind and friendly. Can you try saying that a different way? Let's talk about the book!";
    }
    return "Let's keep our conversation focused on the book and use respectful language. Could you rephrase what you wanted to say?";
  }

  return "Let's get back to talking about the book!";
}

// ============================================================================
// INTERNAL DETECTION FUNCTIONS
// ============================================================================

/**
 * Detect profanity in text, respecting book-context allowlist.
 *
 * @param {string} text
 * @param {boolean} hasBookContext - Whether this is within a book discussion
 * @param {string} level - Student level
 * @returns {Array<{word: string, category: string}>}
 */
function detectProfanity(text, hasBookContext, level) {
  const lower = text.toLowerCase();
  const hits = [];

  for (const entry of INAPPROPRIATE_WORDS) {
    const { word, category } = entry;

    // Check if the word appears in the text
    const wordPattern = word.includes(' ')
      ? new RegExp(escapeRegex(word), 'i')
      : new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');

    if (!wordPattern.test(lower)) continue;

    // Context-aware: allow book-discussion vocabulary
    if (hasBookContext && BOOK_CONTEXT_ALLOWLIST.has(word)) {
      // For serious categories (V, S, SX) only allow in book context for advanced students
      if (category === 'V' || category === 'S' || category === 'SX') {
        if (level === 'advanced') continue;
        // Beginners and intermediate: still flag violent/slur/sexual
      } else {
        // Mild profanity in book context: allow for intermediate+
        if (level !== 'beginner') continue;
        // Beginners: still flag mild profanity even in book context
      }
    }

    hits.push({ word, category });
  }

  return hits;
}

/**
 * Detect PII patterns in text.
 *
 * @param {string} text
 * @returns {Array<{type: string, match: string}>}
 */
function detectPII(text) {
  const findings = [];

  // Email
  const emails = text.match(PII_PATTERNS.email);
  if (emails) {
    for (const match of emails) {
      findings.push({ type: 'email', match });
    }
  }

  // Phone
  const phones = text.match(PII_PATTERNS.phone);
  if (phones) {
    for (const match of phones) {
      if (isLikelyPhoneNumber(match)) {
        findings.push({ type: 'phone', match: match.trim() });
      }
    }
  }

  // Physical address
  const addresses = text.match(PII_PATTERNS.address);
  if (addresses) {
    for (const match of addresses) {
      findings.push({ type: 'address', match });
    }
  }

  // SSN
  const ssns = text.match(PII_PATTERNS.ssn);
  if (ssns) {
    for (const match of ssns) {
      findings.push({ type: 'ssn', match });
    }
  }

  // Full name disclosure
  const nameMatches = [...text.matchAll(PII_PATTERNS.fullName)];
  if (nameMatches.length > 0) {
    for (const match of nameMatches) {
      findings.push({ type: 'full_name', match: match[1] });
    }
  }

  return findings;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// NAMED EXPORTS FOR TESTING INTERNALS
// ============================================================================

export {
  BOOK_CONTEXT_ALLOWLIST,
  DISTRESS_PATTERNS,
  PII_PATTERNS,
  AI_RESPONSE_LIMITS,
  detectPII,
  detectProfanity,
  getChildFriendlyMessage,
  wordCount,
  sentenceCount,
};
