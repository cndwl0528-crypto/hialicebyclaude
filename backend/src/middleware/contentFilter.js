/**
 * contentFilter.js
 * HiAlice — AI Response Safety Monitoring
 *
 * Provides two functions:
 *   filterAIResponse(text, studentAge)  — scan outbound AI text before it reaches the child
 *   filterStudentInput(text)            — scan inbound student text for concerning signals
 *
 * All violations are logged via the project's structured logger AND appended to the
 * in-process safetyLogs store (used by the /api/safety/* admin routes).
 *
 * Design philosophy — err on the side of caution:
 *   - A false positive (over-blocking) is far less harmful than a false negative
 *     for a child-safety system.
 *   - AI responses that trip a rule are replaced with a safe fallback phrase so the
 *     session can continue without exposing the child to inappropriate content.
 *   - Student inputs that trip a rule are flagged for admin review; the session is
 *     NOT blocked — a child expressing distress should still get a response.
 */

import logger from '../lib/logger.js';

// ============================================================================
// In-Process Safety Log Store
// NOTE: Replace with a persistent DB table (e.g. Supabase safety_logs) for
//       production.  The in-memory store is intentionally simple so that the
//       safety route can expose a working admin UI before the DB migration.
// ============================================================================

let _nextId = 1;

/**
 * @type {Array<{
 *   id: number,
 *   timestamp: string,
 *   source: 'ai_response' | 'student_input',
 *   studentId: string | null,
 *   studentAge: number | null,
 *   sessionId: string | null,
 *   originalText: string,
 *   filteredText: string | null,
 *   flags: string[],
 *   reviewed: boolean,
 *   reviewedAt: string | null,
 *   reviewedBy: string | null,
 * }>}
 */
export const safetyLogs = [];

/**
 * Append a new entry to the in-process safety log and emit a structured log line.
 *
 * @param {object} entry
 */
function recordSafetyLog(entry) {
  const record = {
    id: _nextId++,
    timestamp: new Date().toISOString(),
    reviewed: false,
    reviewedAt: null,
    reviewedBy: null,
    ...entry,
  };

  safetyLogs.push(record);

  // Keep the in-process store bounded — retain the most recent 10 000 entries.
  if (safetyLogs.length > 10_000) {
    safetyLogs.splice(0, safetyLogs.length - 10_000);
  }

  logger.warn(
    {
      safetyFlag: true,
      source: record.source,
      flags: record.flags,
      studentId: record.studentId ?? 'unknown',
      studentAge: record.studentAge ?? 'unknown',
      sessionId: record.sessionId ?? 'unknown',
      // Never log the raw text at warn level — only a short preview for debugging.
      preview: record.originalText?.slice(0, 120),
    },
    `[SafetyFilter] ${record.source} flagged — ${record.flags.join(', ')}`
  );

  return record;
}

// ============================================================================
// Pattern Definitions
// ============================================================================

/**
 * Profanity — always blocked regardless of context.
 * Keep the list short; the context-aware pass (below) handles ambiguous words.
 */
const PROFANITY_PATTERNS = [
  /\b(fuck(ing?|ed?|s)?|shit(ty|s|ting?)?|bitch(es|ing?)?|bastard|crap)\b/gi,
  /\b(ass(hole|es)?|dick(s|head)?|cock(s|sucker)?|pussy|cunt)\b/gi,
  /\b(damn(ed|it)?|hell)\b/gi,  // Mild — still inappropriate in children's app
  // Slurs — zero tolerance
  /\b(nigger|nigga|faggot|fag|dyke|retard(ed?)?|spaz)\b/gi,
];

/**
 * Violence-related patterns that are inappropriate in an AI teacher's voice.
 * (A student may discuss plot violence; the AI itself should never encourage it.)
 */
const VIOLENCE_PATTERNS = [
  /\b(you should (hurt|harm|kill|hit|beat|attack|fight|stab|shoot))\b/gi,
  /\b(go (hurt|harm|kill|hit|beat|attack|fight) (yourself|someone|people))\b/gi,
  /\b(cutting yourself|self.harm|hurt yourself)\b/gi,
  /\b(suicide|suicidal|end (your|my) life|kill (yourself|myself))\b/gi,
];

/**
 * Adult / sexual content patterns — none of these are appropriate in a
 * child-directed AI response.
 */
const ADULT_CONTENT_PATTERNS = [
  /\b(sex(ual(ly)?|ually)?|porn(ography)?|naked|nude|nudity)\b/gi,
  /\b(rape|sexual assault|molest(ation)?|abuse)\b/gi,
  /\b(erotic|explicit content|adult content|mature content)\b/gi,
  /\b(condom|contraception|masturbat)\b/gi,
];

/**
 * PII patterns — detect accidental PII leakage in AI responses.
 */
const PII_PATTERNS = [
  // Phone numbers (US formats and common international)
  {
    label: 'phone_number',
    regex: /(?<!\d)(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g,
  },
  // Email addresses
  {
    label: 'email_address',
    regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  },
  // US Social Security Number patterns
  {
    label: 'ssn',
    regex: /(?<!\d)\d{3}[- ]\d{2}[- ]\d{4}(?!\d)/g,
  },
  // Credit card numbers (basic 13-16 digit groups)
  {
    label: 'credit_card',
    regex: /(?<!\d)(?:\d{4}[\s\-]){3}\d{1,4}(?!\d)/g,
  },
  // Physical address patterns (street number + street name)
  {
    label: 'physical_address',
    regex: /\b\d{1,5}\s+[A-Z][a-zA-Z]+\s+(St(reet)?|Ave(nue)?|Blvd|Rd|Road|Dr(ive)?|Ln|Lane|Ct|Court|Pl|Place|Way|Pkwy)\b/gi,
  },
  // ZIP codes (standalone 5-digit or ZIP+4)
  {
    label: 'zip_code',
    regex: /(?<!\d)\d{5}(?:-\d{4})?(?!\d)/g,
  },
  // Full name patterns: two or three capitalised words (heuristic — high false-
  // positive risk so we flag but do NOT redact from AI responses automatically)
  {
    label: 'possible_full_name',
    regex: /\b([A-Z][a-z]{1,20})\s+([A-Z][a-z]{1,20})(\s+[A-Z][a-z]{1,20})?\b/g,
    flagOnly: true,   // Mark as flag; do not replace the text
  },
];

/**
 * Age-appropriateness rules.
 * Some topics are fine for older children (12–13) but not younger ones (6–8).
 */
const AGE_RESTRICTED_PATTERNS = [
  // War / graphic violence context — allowed for advanced readers (12+)
  {
    label: 'mature_violence',
    regex: /\b(war|battle|bomb|explosion|blood(shed)?|gore|graphic violence|killing field)\b/gi,
    maxAge: 11,  // Block if student is <= 11 years old
  },
  // Disturbing psychological themes
  {
    label: 'disturbing_themes',
    regex: /\b(trauma|ptsd|abuse|domestic violence|mental illness|depression)\b/gi,
    maxAge: 11,
  },
  // Romance / relationships — mild, but gate for youngest users
  {
    label: 'romance_themes',
    regex: /\b(kissing|romantic(ally)?|falling in love|boyfriend|girlfriend|dating)\b/gi,
    maxAge: 7,  // Only flag for 6–7 year olds
  },
];

/**
 * Student distress signals — concerning content from the child that the admin
 * should be alerted to immediately.  We DO NOT block the session when these
 * trigger; instead we flag for human review.
 */
const STUDENT_DISTRESS_PATTERNS = [
  {
    label: 'self_harm_signal',
    regex: /\b(i want to (hurt|harm|kill) (myself|me)|i (hate|don't like) (myself|my life|living)|i wish i was dead|i want to die)\b/gi,
  },
  {
    label: 'bullying_report',
    regex: /\b(someone (is |)(hitting|hurting|bullying|threatening|scaring) me|they (hit|beat|hurt) me|i (am|get) (hit|hurt|bullied|picked on))\b/gi,
  },
  {
    label: 'abuse_disclosure',
    regex: /\b(my (mom|dad|uncle|aunt|teacher|coach|step|family) (hits?|hurts?|touches?|abuses?|scared) me|someone touched me|i don't feel safe)\b/gi,
  },
  {
    label: 'extreme_distress',
    regex: /\b(i('m| am) going to (run away|hurt someone|bring a (gun|knife|weapon))|nobody (cares|loves) me)\b/gi,
  },
  {
    label: 'pii_sharing',  // Child sharing their own PII in chat
    regex: /\b(my (address|phone number|email) is|i live at|call me at)\b/gi,
  },
];

// ============================================================================
// Core Filter Functions
// ============================================================================

/**
 * Redact all matches of a regex within text.
 *
 * @param {string} text
 * @param {RegExp} regex
 * @param {string} [replacement='[REDACTED]']
 * @returns {string}
 */
function redact(text, regex, replacement = '[REDACTED]') {
  return text.replace(regex, replacement);
}

/**
 * Filter an AI-generated response before it is sent to the child.
 *
 * @param {string}      text          — Raw AI response text
 * @param {number|null} studentAge    — Student age (used for age-gate checks)
 * @param {object}      [context={}]  — Optional metadata: { studentId, sessionId }
 *
 * @returns {{
 *   safe:        boolean,    — false if ANY hard rule triggered
 *   filtered:    string,     — text safe to show the child (redacted / replaced)
 *   flags:       string[],   — list of triggered rule labels
 *   logId:       number|null — safetyLog id if a record was created, else null
 * }}
 */
export function filterAIResponse(text, studentAge = null, context = {}) {
  if (!text || typeof text !== 'string') {
    return { safe: true, filtered: text, flags: [], logId: null };
  }

  let filtered = text;
  const flags = [];

  // 1. Profanity — replace with asterisks so we can see word length in logs
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(filtered)) {
      flags.push('profanity');
      filtered = filtered.replace(pattern, (match) => '*'.repeat(match.length));
    }
    pattern.lastIndex = 0;
  }

  // 2. Violence
  for (const pattern of VIOLENCE_PATTERNS) {
    if (pattern.test(filtered)) {
      flags.push('violence');
      filtered = filtered.replace(pattern, '[REMOVED]');
    }
    pattern.lastIndex = 0;
  }

  // 3. Adult content
  for (const pattern of ADULT_CONTENT_PATTERNS) {
    if (pattern.test(filtered)) {
      flags.push('adult_content');
      filtered = filtered.replace(pattern, '[REMOVED]');
    }
    pattern.lastIndex = 0;
  }

  // 4. PII leakage
  for (const { label, regex, flagOnly } of PII_PATTERNS) {
    regex.lastIndex = 0;
    if (regex.test(filtered)) {
      flags.push(`pii_${label}`);
      if (!flagOnly) {
        regex.lastIndex = 0;
        filtered = redact(filtered, regex, `[${label.toUpperCase()} REMOVED]`);
      }
    }
    regex.lastIndex = 0;
  }

  // 5. Age-appropriateness gate
  if (studentAge !== null && typeof studentAge === 'number') {
    for (const { label, regex, maxAge } of AGE_RESTRICTED_PATTERNS) {
      if (studentAge <= maxAge) {
        regex.lastIndex = 0;
        if (regex.test(filtered)) {
          flags.push(`age_restricted_${label}`);
          regex.lastIndex = 0;
          filtered = filtered.replace(regex, '[REMOVED]');
        }
        regex.lastIndex = 0;
      }
    }
  }

  const isSafe = flags.length === 0;

  let logId = null;
  if (!isSafe) {
    // If the response is fundamentally broken by removing violations, replace
    // the whole thing with a safe fallback rather than showing a garbled string.
    const safetyFallback =
      "That's a great thought! Let's keep exploring the book together. " +
      "What else did you notice about the story?";

    const isUnusable =
      filtered.replace(/\[REMOVED\]|\[REDACTED\]|\*+/g, '').trim().length < 20;

    if (isUnusable) {
      filtered = safetyFallback;
    }

    const record = recordSafetyLog({
      source: 'ai_response',
      studentId: context.studentId ?? null,
      studentAge: studentAge ?? null,
      sessionId: context.sessionId ?? null,
      originalText: text,
      filteredText: filtered,
      flags,
    });

    logId = record.id;
  }

  return { safe: isSafe, filtered, flags, logId };
}

/**
 * Filter student input for concerning content that warrants admin review.
 *
 * This function DOES NOT modify the student's message — we want the AI to
 * receive and respond to what the child actually said.  It purely flags and
 * logs concerning content so admins can follow up.
 *
 * @param {string}     text         — Raw student input text
 * @param {object}     [context={}] — Optional metadata: { studentId, studentAge, sessionId }
 *
 * @returns {{
 *   safe:   boolean,   — false if ANY distress/PII pattern triggered
 *   flags:  string[],  — list of triggered rule labels
 *   logId:  number|null
 * }}
 */
export function filterStudentInput(text, context = {}) {
  if (!text || typeof text !== 'string') {
    return { safe: true, flags: [], logId: null };
  }

  const flags = [];

  // Check distress/safety signals
  for (const { label, regex } of STUDENT_DISTRESS_PATTERNS) {
    regex.lastIndex = 0;
    if (regex.test(text)) {
      flags.push(label);
    }
    regex.lastIndex = 0;
  }

  // Check if child is sharing their own PII
  for (const { label, regex } of PII_PATTERNS) {
    regex.lastIndex = 0;
    if (regex.test(text)) {
      // Only flag phone / email / address — not name heuristic
      if (!label.includes('name') && !label.includes('zip')) {
        flags.push(`student_pii_${label}`);
      }
    }
    regex.lastIndex = 0;
  }

  const isSafe = flags.length === 0;

  let logId = null;
  if (!isSafe) {
    const record = recordSafetyLog({
      source: 'student_input',
      studentId: context.studentId ?? null,
      studentAge: context.studentAge ?? null,
      sessionId: context.sessionId ?? null,
      originalText: text,
      filteredText: null, // Student input is not modified
      flags,
    });

    logId = record.id;
  }

  return { safe: isSafe, flags, logId };
}

// ============================================================================
// Express Middleware — wrap the filter functions for use in route handlers
// ============================================================================

/**
 * Express middleware that attaches filterAIResponse and filterStudentInput
 * helpers to `req` so route handlers can call them without importing directly.
 *
 * Usage in routes:
 *   router.use(contentFilterMiddleware);
 *   ...
 *   const { safe, filtered } = req.filterAIResponse(aiText, studentAge, { studentId, sessionId });
 */
export function contentFilterMiddleware(req, res, next) {
  req.filterAIResponse = filterAIResponse;
  req.filterStudentInput = filterStudentInput;
  next();
}
