/**
 * evalHarness.js
 * HiAlice — AI Response Quality Evaluation Harness
 *
 * Validates Alice's generated responses AFTER generation but BEFORE they are
 * sent to the student. All checks are synchronous, pattern-based, and make
 * zero external API calls so they add minimal latency to every response cycle.
 *
 * Evaluation pipeline:
 *   1. checkSocraticCompliance  — Socratic pedagogy adherence (35% weight)
 *   2. checkAgeAppropriateness — Vocabulary, sentence length, tone (25% weight)
 *   3. checkContentSafety      — Child safety hard stops (40% weight)
 *   4. evaluateResponse        — Composite scorer and routing decision
 *
 * EvalLogger tracks aggregate statistics across the process lifetime.
 * Replace the in-process store with a DB table for persistent analytics.
 *
 * Design principles:
 *   - False positives are acceptable; false negatives (missed violations) are not.
 *   - Pure functions throughout — no side effects except EvalLogger.log().
 *   - Aligned with the level/stage taxonomy defined in alice/prompts.js.
 */

import logger from '../lib/logger.js';

// ============================================================================
// LEVEL CONFIGURATION
// Mirrors constants in alice/prompts.js — kept local so this module has
// zero runtime dependencies and can be unit-tested in isolation.
// ============================================================================

/**
 * Per-level response length limits (words) and sentence length limits (words).
 * Source of truth: LEVEL_DESCRIPTIONS / LEVEL_RULES in alice/prompts.js.
 */
const LEVEL_LIMITS = {
  beginner:     { maxResponseWords: 20,  maxSentenceWords: 10 },
  intermediate: { maxResponseWords: 50,  maxSentenceWords: 20 },
  advanced:     { maxResponseWords: 100, maxSentenceWords: 30 },
};

// ============================================================================
// BEGINNER WORD LIST
// A representative sample of the ~1 000 most common English words used by
// 6-8 year-old learners. Words NOT found here contribute to a vocabulary
// complexity score. Syllable count serves as the complementary signal.
// ============================================================================

const BEGINNER_WORDS = new Set([
  // Articles / determiners
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'your', 'his',
  'her', 'its', 'our', 'their', 'some', 'any', 'all', 'no', 'every', 'each',
  // Pronouns
  'i', 'me', 'we', 'us', 'you', 'he', 'she', 'it', 'they', 'them', 'who',
  'what', 'which', 'that', 'there', 'here',
  // Common verbs (base + simple past)
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could',
  'may', 'might', 'shall', 'should', 'must', 'need',
  'go', 'went', 'gone', 'come', 'came', 'get', 'got', 'give', 'gave', 'given',
  'take', 'took', 'taken', 'make', 'made', 'see', 'saw', 'seen',
  'know', 'knew', 'think', 'thought', 'say', 'said', 'tell', 'told',
  'find', 'found', 'want', 'like', 'love', 'feel', 'look', 'seem', 'need',
  'play', 'run', 'walk', 'eat', 'drink', 'sleep', 'read', 'write', 'draw',
  'help', 'talk', 'listen', 'ask', 'answer', 'open', 'close', 'try', 'start',
  'stop', 'let', 'put', 'keep', 'turn', 'show', 'send', 'live', 'move',
  'jump', 'sit', 'stand', 'fall', 'leave', 'bring', 'buy', 'call', 'use',
  // Common adjectives
  'good', 'bad', 'big', 'little', 'small', 'large', 'long', 'short', 'high',
  'low', 'old', 'young', 'new', 'great', 'best', 'next', 'last', 'other',
  'same', 'different', 'real', 'right', 'wrong', 'easy', 'hard', 'happy',
  'sad', 'funny', 'scary', 'nice', 'beautiful', 'pretty', 'cool', 'hot',
  'cold', 'warm', 'light', 'dark', 'fast', 'slow', 'far', 'near', 'safe',
  'afraid', 'brave', 'kind', 'mean', 'quiet', 'loud', 'clean', 'dirty',
  'hungry', 'full', 'tired', 'strong', 'weak', 'sick', 'well', 'ready',
  'sure', 'true', 'false', 'own', 'free', 'open', 'close', 'early', 'late',
  // Common nouns
  'book', 'story', 'page', 'word', 'letter', 'picture', 'part', 'chapter',
  'thing', 'way', 'time', 'day', 'night', 'morning', 'evening',
  'year', 'week', 'month', 'today', 'tomorrow', 'yesterday',
  'boy', 'girl', 'man', 'woman', 'child', 'baby', 'people', 'person',
  'family', 'friend', 'teacher', 'parent', 'mom', 'dad', 'mother', 'father',
  'sister', 'brother', 'house', 'home', 'room', 'school', 'class',
  'dog', 'cat', 'bird', 'fish', 'animal', 'tree', 'flower', 'sun', 'moon',
  'star', 'water', 'food', 'color', 'number', 'name', 'place', 'land',
  'world', 'life', 'idea', 'question', 'answer', 'game', 'toy', 'car', 'bus',
  'heart', 'head', 'eye', 'ear', 'hand', 'foot', 'body', 'face', 'hair',
  // Conjunctions / prepositions / adverbs
  'and', 'but', 'or', 'so', 'because', 'if', 'when', 'while', 'then', 'now',
  'just', 'also', 'too', 'very', 'so', 'really', 'maybe', 'yes', 'no', 'not',
  'never', 'always', 'again', 'still', 'only', 'even', 'already', 'yet',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'from', 'by', 'as', 'up',
  'out', 'down', 'into', 'over', 'after', 'before', 'under', 'about',
  'between', 'through', 'during', 'around', 'near', 'off', 'along',
  // Question words
  'who', 'what', 'where', 'when', 'why', 'how',
  // Numbers / common quantifiers
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'first', 'second', 'third', 'many', 'much', 'more', 'most', 'few', 'less',
  'both', 'another', 'other', 'same',
  // Exclamations (common in Alice's voice)
  'oh', 'wow', 'great', 'hey', 'okay', 'ok', 'sure', 'please', 'thank', 'thanks',
  'sorry', 'hi', 'hello', 'bye', 'yes', 'yeah', 'no', 'nope',
  // Common contractions (stored without apostrophe — see normalisation below)
  "im", "ive", "ill", "id", "its", "weve", "theyre", "theyve", "wont",
  "cant", "dont", "doesnt", "didnt", "wasnt", "werent", "isnt", "arent",
  "havent", "hasnt", "hadnt", "couldnt", "wouldnt", "shouldnt", "thats",
  "whats", "whos", "hows", "wheres", "whens", "theres", "heres", "lets",
  "youre", "youve", "youll", "youd", "hed", "shed", "well", "theyd",
  // Book discussion vocabulary (domain-specific common words for this app)
  'character', 'main', 'author', 'title', 'setting', 'problem', 'ending',
  'beginning', 'middle', 'happen', 'happened', 'feel', 'felt', 'favorite',
  'think', 'thought', 'believe', 'remember', 'show', 'tell', 'learn', 'taught',
  'lesson', 'adventure', 'exciting', 'interesting', 'surprised', 'imagine',
  'wonder', 'special', 'important', 'change', 'choose', 'choose', 'decision',
]);

// ============================================================================
// SOCRATIC VIOLATION PATTERNS
// ============================================================================

/**
 * Patterns that indicate Alice is giving a direct factual answer rather than
 * guiding the student to discover it through questions.
 */
const DIRECT_ANSWER_PATTERNS = [
  // Declarative answer openers
  /\bthe (answer|correct answer|right answer) is\b/i,
  /\bactually[,\s]+(the|it|that|he|she|they|this|there|in)\b/i,
  /\bthe main (theme|idea|message|lesson|point|character|conflict) (is|was|are|were)\b/i,
  /\bthe (story|book|author) (is|was|means?|shows?|tells?|says?)\b/i,
  /\b(in fact|the truth is|the reality is|technically)[,\s]/i,
  /\bwhat (really |)(happened|it means) is\b/i,
  /\bthe (character|protagonist|hero|heroine) (is|was|did|felt|wanted)\b/i,
  /\bthat('?s| is) (not |)(right|correct|what happened|the answer)\b/i,
  /\blet me (explain|tell you|clarify|correct)\b/i,
  /\b(remember|recall) that (the|in the|this)\b/i,
];

/**
 * Words/phrases that signal closing questions — required in all non-final turns.
 */
const QUESTION_INDICATORS = [
  /\?/,                                             // Literal question mark
  /\b(what|why|how|when|where|who|which|whose)\b/i, // WH-question words
  /\b(can you|could you|would you|do you|did you|have you|are you|were you)\b/i,
  /\b(tell me|share|describe|explain|think about)\b/i,
];

/**
 * Closed (yes/no) question detection helpers.
 *
 * A question is "closed" when it:
 *   (a) starts with an auxiliary verb (did/do/have/are/is/was/were/will/would/
 *       could/should/can/may/might), AND
 *   (b) contains NO open WH-word (what/why/how/when/where/who/which/whose)
 *       anywhere within the same question fragment.
 *
 * This per-fragment approach (rather than a single regex) avoids false
 * positives on questions like "Why do you think...?" where an auxiliary
 * appears mid-question after a leading WH-word.
 */
const CLOSED_AUX_START = /^\s*(did|do|does|have|has|is|are|was|were|will|would|could|should|can|may|might)\b/i;
const OPEN_WH_WORD     = /\b(what|why|how|when|where|who|which|whose)\b/i;

/**
 * Return true if a single question fragment (ending in '?') is a closed/yes-no
 * question — i.e. auxiliary-led without any open WH-word.
 *
 * @param {string} fragment - A question fragment ending with '?'
 * @returns {boolean}
 */
function isClosedQuestion(fragment) {
  const f = fragment.trim();
  // Explicit yes/no framing is always closed
  if (/^(yes or no|true or false)[,?]/i.test(f)) return true;
  // Auxiliary opener + no WH-word anywhere in the fragment = closed
  return CLOSED_AUX_START.test(f) && !OPEN_WH_WORD.test(f);
}

/**
 * Negative feedback phrases — never acceptable regardless of level.
 */
const NEGATIVE_FEEDBACK_PATTERNS = [
  /\b(wrong|incorrect|not right|no,?\s+that('?s| is)|that('?s| is) (wrong|not right|incorrect))\b/i,
  /\bno,?\s+(actually|the|it|that|in)\b/i,
  /\b(you (are|were|got it) wrong|you('?re| are) (wrong|incorrect|mistaken))\b/i,
  /\bnot\s+quite\b/i,
  /\byou should (know|understand|remember)\b/i,
  /\byou don'?t (understand|get it|know)\b/i,
];

/**
 * Echo patterns — when Alice quotes the student's own words back, a direct-
 * answer flag should NOT be raised (this is a pedagogical technique, not a
 * violation).
 */
const ECHO_PATTERNS = [
  /\byou said\b/i,
  /\byou mentioned\b/i,
  /\byou (think|thought|feel|felt|believe)\b/i,
  /\baccording to you\b/i,
];

// ============================================================================
// UNSAFE CONTENT PATTERNS
// ============================================================================

/**
 * Each entry in this array is a pattern group. When any pattern within a group
 * matches, the group's flag is added to the result.
 *
 * Death/dying words receive special contextual treatment: they are flagged as
 * LOW_SEVERITY (not hard UNSAFE) when surrounded by book-discussion context
 * words, because children legitimately discuss character deaths in literature.
 */
const UNSAFE_PATTERN_GROUPS = [
  {
    flag: 'VIOLENCE',
    severity: 'high',
    patterns: [
      // Inflected forms included: kill(s/ed/ing), gun(s), weapon(s), knife/knives, etc.
      /\bkill(s|ed|ing|er|ers)?\b/i,
      /\b(murder(s|ed|ing|er|ers)?|slaughter(s|ed|ing)?|massacre(s|d)?)\b/i,
      /\b(gore|gory|weapon(s|ry)?|gun(s|fire)?|pistol(s)?|rifle(s)?)\b/i,
      /\b(knife|knives|stab(s|bed|bing)?|shoot(s|ing)?|shot|shooting)\b/i,
      /\b(bomb(s|ed|ing)?|explo(de|des|ded|ding|sion|sions)?)\b/i,
      /\b(blood(y|shed|bath)?|wound(s|ed|ing)?|bruise(s|d)?|assault(s|ed|ing)?)\b/i,
    ],
  },
  {
    flag: 'DEATH_CONTEXT',
    severity: 'low',
    // die/dead/death are common in children's literature (Charlotte dies, etc.)
    // Flagged as low severity so the evaluator only deducts lightly.
    patterns: [
      /\b(die(s|d)?|dying|dead|death(s)?|deceased|passed away|kill(s|ed|ing)?)\b/i,
    ],
  },
  {
    flag: 'INAPPROPRIATE_LANGUAGE',
    severity: 'high',
    patterns: [
      /\b(stupid|dumb|idiot|moron|loser|shut up|hate you|i hate)\b/i,
    ],
  },
  {
    flag: 'PERSONAL_INFO_REQUEST',
    severity: 'high',
    patterns: [
      /\b(your (real |full |last |)name|what'?s your name)\b/i,
      /\b(where do you live|your (home |street |)address|your (zip|postal) code)\b/i,
      /\b(your (phone|cell|mobile) (number|#)|call me at|text me)\b/i,
      /\b(which school do you go to|your school name|what school|your teacher'?s name)\b/i,
      /\b(your (email|email address)|how old are you exactly)\b/i,
    ],
  },
  {
    flag: 'OFF_TOPIC',
    severity: 'medium',
    patterns: [
      /\b(let'?s (play a game|talk about something else|change the subject))\b/i,
      /\b(forget (the book|about the story)|don'?t worry about the book)\b/i,
      /\b(instead of the book|not about the book)\b/i,
    ],
  },
  {
    flag: 'EMOTIONAL_HARM',
    severity: 'high',
    patterns: [
      /\b(wrong answer|that'?s (not right|incorrect)|you should know)\b/i,
      /\b(you don'?t understand|you (are|were) wrong|bad answer)\b/i,
      /\b(everyone (else |)(knows|can do)|other (kids|students|children) (can|know|do))\b/i,
      /\b(why can'?t you|is that the best you can do|try harder)\b/i,
    ],
  },
  {
    flag: 'ADULT_CONTENT',
    severity: 'high',
    patterns: [
      /\b(sex(ual(ly)?)?|porn(ography)?|nude|naked|nudity|erotic)\b/i,
      /\b(alcohol|drugs|smoke|cigarette|beer|wine|drunk|weed)\b/i,
    ],
  },
];

/**
 * Book-discussion context words that, when present near a death-related term,
 * indicate the word is being used in legitimate literary analysis.
 */
const BOOK_CONTEXT_WORDS = [
  /\b(character|story|book|chapter|author|plot|ending|happen(ed)?)\b/i,
  /\b(in the (story|book)|the (main|other) character|when (he|she|they|it))\b/i,
  /\b(feel|felt|think|thought|read|scene|moment|part)\b/i,
];

// ============================================================================
// TONE CHECK PATTERNS
// ============================================================================

/**
 * Positive tone signals — warm and encouraging language expected from Alice.
 */
const WARM_TONE_PATTERNS = [
  /\b(great|amazing|wonderful|fantastic|excellent|love|lovely|awesome|wow|cool)\b/i,
  /\b(nice|good|super|brilliant|clever|smart|beautiful|interesting|curious)\b/i,
  /\b(tell me|i'?d love to|i'?m curious|share|let'?s explore)\b/i,
  /[!]/,
];

/**
 * Academic/cold tone signals — inappropriate for a child-facing AI teacher.
 */
const COLD_TONE_PATTERNS = [
  /\b(furthermore|however|thus|hence|therefore|consequently|accordingly)\b/i,
  /\b(aforementioned|nevertheless|notwithstanding|aforementioned)\b/i,
  /\b(it is (noted|observed|evident|clear) that)\b/i,
  /\b(one (might|could|should) (argue|observe|note|consider))\b/i,
];

// ============================================================================
// SYLLABLE COUNTER
// ============================================================================

/**
 * Estimate the number of syllables in an English word using heuristics.
 * Accuracy is sufficient for proportion-based vocabulary scoring.
 *
 * @param {string} word
 * @returns {number}
 */
function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 2) return 1;

  // Remove silent trailing 'e'
  const stripped = w.replace(/e$/, '');
  // Count vowel groups as syllable nuclei
  const vowelGroups = stripped.match(/[aeiouy]+/g);
  const count = vowelGroups ? vowelGroups.length : 1;
  return Math.max(1, count);
}

// ============================================================================
// TEXT UTILITIES
// ============================================================================

/**
 * Tokenise text into lowercase words, stripping punctuation.
 * Contractions are normalised by removing apostrophes so "don't" → "dont".
 *
 * @param {string} text
 * @returns {string[]}
 */
function tokenise(text) {
  return text
    .toLowerCase()
    .replace(/'/g, '')       // Remove apostrophes (contractions → BEGINNER_WORDS set)
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Split text into sentences using common sentence-ending punctuation.
 *
 * @param {string} text
 * @returns {string[]}
 */
function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Count words in a string.
 *
 * @param {string} text
 * @returns {number}
 */
function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ============================================================================
// A. SOCRATIC COMPLIANCE CHECKER
// ============================================================================

/**
 * Evaluate whether Alice's response adheres to Socratic method principles.
 *
 * @param {string} response - Alice's generated response text
 * @param {object} context
 * @param {string} context.stage - Session stage: 'title' | 'introduction' | 'body' | 'conclusion' | etc.
 * @param {number} context.turn  - Turn number within the stage (1-3)
 * @param {string} context.level - 'beginner' | 'intermediate' | 'advanced'
 * @returns {{ pass: boolean, score: number, violations: string[] }}
 */
export function checkSocraticCompliance(response, { stage = 'title', turn = 1, level = 'intermediate' }) {
  if (!response || typeof response !== 'string') {
    return { pass: false, score: 0, violations: ['EMPTY_RESPONSE'] };
  }

  const violations = [];
  const text = response.trim();

  // ---- 1. DIRECT_ANSWER detection ----------------------------------------
  // Exception: if the response echoes the student's own words, it is not a
  // direct-answer violation even if it contains declarative phrasing.
  const isEchoing = ECHO_PATTERNS.some(p => p.test(text));

  if (!isEchoing) {
    const hasDirectAnswer = DIRECT_ANSWER_PATTERNS.some(p => p.test(text));
    if (hasDirectAnswer) {
      violations.push('DIRECT_ANSWER');
    }
  }

  // ---- 2. NO_QUESTION check -----------------------------------------------
  // The conclusion turn 3 is a celebratory close — a question is not required.
  const isCelebratoryClose = (stage === 'conclusion' && turn === 3);

  if (!isCelebratoryClose) {
    const hasQuestion = QUESTION_INDICATORS.some(p => p.test(text));
    if (!hasQuestion) {
      violations.push('NO_QUESTION');
    }
  }

  // ---- 3. CLOSED_QUESTION check -------------------------------------------
  // Beginners are explicitly allowed yes/no and choice questions (per prompts.js
  // answerExpectation for beginner level). Only flag for intermediate/advanced.
  // A response is flagged when EVERY question fragment it contains is closed.
  if (level !== 'beginner') {
    const questionMatches = text.match(/[^.!?]*\?/g) || [];
    const allClosed = questionMatches.length > 0
      && questionMatches.every(q => isClosedQuestion(q));

    if (allClosed) {
      violations.push('CLOSED_QUESTION');
    }
  }

  // ---- 4. MULTIPLE_QUESTIONS check ----------------------------------------
  // Count question marks as a proxy for number of questions asked.
  const questionCount = (text.match(/\?/g) || []).length;
  if (questionCount > 2) {
    violations.push('MULTIPLE_QUESTIONS');
  }

  // ---- 5. NEGATIVE_FEEDBACK check -----------------------------------------
  const hasNegativeFeedback = NEGATIVE_FEEDBACK_PATTERNS.some(p => p.test(text));
  if (hasNegativeFeedback) {
    violations.push('NEGATIVE_FEEDBACK');
  }

  // ---- Score calculation --------------------------------------------------
  // Start at 100, apply weighted deductions per violation.
  const VIOLATION_DEDUCTIONS = {
    DIRECT_ANSWER:    30,
    NO_QUESTION:      25,
    CLOSED_QUESTION:  15,
    MULTIPLE_QUESTIONS: 10,
    NEGATIVE_FEEDBACK: 40,
    EMPTY_RESPONSE:   100,
  };

  const totalDeduction = violations.reduce(
    (sum, v) => sum + (VIOLATION_DEDUCTIONS[v] ?? 10),
    0
  );

  const score = Math.max(0, 100 - totalDeduction);
  const pass = violations.length === 0;

  return { pass, score, violations };
}

// ============================================================================
// B. AGE APPROPRIATENESS CHECKER
// ============================================================================

/**
 * Evaluate whether Alice's response is appropriate for the student's level.
 *
 * @param {string} response - Alice's generated response text
 * @param {object} context
 * @param {string} context.level - 'beginner' | 'intermediate' | 'advanced'
 * @returns {{ pass: boolean, score: number, issues: string[] }}
 */
export function checkAgeAppropriateness(response, { level = 'intermediate' }) {
  if (!response || typeof response !== 'string') {
    return { pass: false, score: 0, issues: ['EMPTY_RESPONSE'] };
  }

  const issues = [];
  const text = response.trim();
  const limits = LEVEL_LIMITS[level] || LEVEL_LIMITS.intermediate;

  // ---- 1. RESPONSE_LENGTH -------------------------------------------------
  const totalWords = wordCount(text);
  if (totalWords > limits.maxResponseWords) {
    issues.push('RESPONSE_LENGTH');
  }

  // ---- 2. SENTENCE_LENGTH -------------------------------------------------
  const sentences = splitSentences(text);
  const longSentences = sentences.filter(
    s => wordCount(s) > limits.maxSentenceWords
  );
  if (longSentences.length > 0) {
    issues.push('SENTENCE_LENGTH');
  }

  // ---- 3. VOCABULARY_LEVEL ------------------------------------------------
  if (level === 'beginner') {
    const tokens = tokenise(text);
    if (tokens.length > 0) {
      const unknownCount  = tokens.filter(t => !BEGINNER_WORDS.has(t)).length;
      const unknownRatio  = unknownCount / tokens.length;

      // Also check average syllable count as a complementary signal
      const avgSyllables = tokens.reduce((sum, t) => sum + countSyllables(t), 0) / tokens.length;

      // Flag if more than 20% of words are outside the beginner list
      // OR if the average syllable count exceeds 2.0 (3-syllable words dominate)
      if (unknownRatio > 0.20 || avgSyllables > 2.0) {
        issues.push('VOCABULARY_LEVEL');
      }
    }
  } else if (level === 'intermediate') {
    const tokens = tokenise(text);
    if (tokens.length > 0) {
      // For intermediate, flag responses where the majority of words are
      // outside beginner vocabulary AND average syllables exceed 2.5
      // (indicating predominantly long, complex words).
      const avgSyllables = tokens.reduce((sum, t) => sum + countSyllables(t), 0) / tokens.length;
      if (avgSyllables > 2.5) {
        issues.push('VOCABULARY_LEVEL');
      }
    }
  }
  // Advanced level has no vocabulary restriction — any word is acceptable.

  // ---- 4. TONE_CHECK ------------------------------------------------------
  const warmSignals   = WARM_TONE_PATTERNS.filter(p => p.test(text)).length;
  const coldSignals   = COLD_TONE_PATTERNS.filter(p => p.test(text)).length;

  // Require at least one warm signal. Flag if cold signals outweigh warm ones.
  if (warmSignals === 0 || coldSignals > warmSignals) {
    issues.push('TONE_CHECK');
  }

  // ---- Score calculation --------------------------------------------------
  const ISSUE_DEDUCTIONS = {
    RESPONSE_LENGTH: 20,
    SENTENCE_LENGTH: 15,
    VOCABULARY_LEVEL: 25,
    TONE_CHECK: 20,
    EMPTY_RESPONSE: 100,
  };

  const totalDeduction = issues.reduce(
    (sum, issue) => sum + (ISSUE_DEDUCTIONS[issue] ?? 10),
    0
  );

  const score = Math.max(0, 100 - totalDeduction);
  const pass = issues.length === 0;

  return { pass, score, issues };
}

// ============================================================================
// C. CONTENT SAFETY CHECKER
// ============================================================================

/**
 * Evaluate whether Alice's response is safe for a child audience.
 * Uses pattern matching only — no API calls.
 *
 * @param {string} response - Alice's generated response text
 * @returns {{ pass: boolean, score: number, flags: string[] }}
 */
export function checkContentSafety(response) {
  if (!response || typeof response !== 'string') {
    return { pass: false, score: 0, flags: ['EMPTY_RESPONSE'] };
  }

  const flags = [];
  const text = response.trim();

  for (const group of UNSAFE_PATTERN_GROUPS) {
    const matched = group.patterns.some(p => {
      // Reset regex state for stateful patterns
      p.lastIndex = 0;
      return p.test(text);
    });

    if (!matched) continue;

    // Special handling: DEATH_CONTEXT — only flag as low severity when the
    // surrounding text lacks book-discussion context words.
    if (group.flag === 'DEATH_CONTEXT') {
      const hasBookContext = BOOK_CONTEXT_WORDS.some(p => p.test(text));
      if (hasBookContext) {
        // Death discussed in a literary context — not flagged.
        continue;
      }
    }

    flags.push(group.flag);
  }

  // ---- Score calculation --------------------------------------------------
  const SEVERITY_DEDUCTIONS = {
    high:   50,  // Hard violations (violence, PII request, emotional harm)
    medium: 25,  // Moderate (off-topic, mild inappropriate)
    low:    10,  // Contextual (death words without book context)
  };

  const groupsByFlag = Object.fromEntries(
    UNSAFE_PATTERN_GROUPS.map(g => [g.flag, g.severity])
  );

  const totalDeduction = flags.reduce((sum, flag) => {
    const severity = groupsByFlag[flag] || 'medium';
    return sum + SEVERITY_DEDUCTIONS[severity];
  }, 0);

  const score = Math.max(0, 100 - totalDeduction);

  // Safety check passes only when there are zero flags regardless of score.
  const pass = flags.length === 0;

  return { pass, score, flags };
}

// ============================================================================
// D. COMPOSITE EVALUATOR
// ============================================================================

/**
 * Run all three evaluators against an AI response and return a consolidated
 * result with a routing recommendation.
 *
 * Scoring weights:
 *   Content Safety:       40% — most critical; single hard flag can block send
 *   Socratic Compliance:  35%
 *   Age Appropriateness:  25%
 *
 * Recommendations:
 *   overallScore >= 70 → 'send'       (quality response, good to go)
 *   overallScore >= 50 → 'flag'       (send but log for human review)
 *   overallScore  < 50 → 'regenerate' (too many issues; request new response)
 *
 * Additional override: any HIGH-severity safety flag forces 'regenerate'
 * regardless of overall score.
 *
 * @param {string} response - Alice's generated response text
 * @param {object} context
 * @param {string} context.stage          - Session stage
 * @param {number} context.turn           - Turn number within stage
 * @param {string} context.level          - Student level
 * @param {string} [context.bookTitle]    - Book title (for context logging)
 * @param {string} [context.studentMessage] - Student's message (for context logging)
 * @returns {{
 *   pass: boolean,
 *   overallScore: number,
 *   socratic: object,
 *   ageAppropriate: object,
 *   contentSafety: object,
 *   recommendation: 'send' | 'flag' | 'regenerate',
 *   details: string
 * }}
 */
export function evaluateResponse(response, context = {}) {
  const { stage = 'title', turn = 1, level = 'intermediate' } = context;

  const socratic       = checkSocraticCompliance(response, { stage, turn, level });
  const ageAppropriate = checkAgeAppropriateness(response, { level });
  const contentSafety  = checkContentSafety(response);

  // Weighted composite score
  const overallScore = Math.round(
    contentSafety.score  * 0.40 +
    socratic.score       * 0.35 +
    ageAppropriate.score * 0.25
  );

  // Check for high-severity safety flags that force regeneration
  const highSeverityFlags = contentSafety.flags.filter(flag => {
    const group = UNSAFE_PATTERN_GROUPS.find(g => g.flag === flag);
    return group?.severity === 'high';
  });
  const hasCriticalSafetyFlag = highSeverityFlags.length > 0;

  // Routing decision
  let recommendation;
  if (hasCriticalSafetyFlag || overallScore < 50) {
    recommendation = 'regenerate';
  } else if (overallScore < 70) {
    recommendation = 'flag';
  } else {
    recommendation = 'send';
  }

  // Overall pass: all three checks pass AND no critical safety flags
  const pass = socratic.pass && ageAppropriate.pass && contentSafety.pass;

  // Human-readable summary
  const allIssues = [
    ...socratic.violations.map(v => `Socratic:${v}`),
    ...ageAppropriate.issues.map(i => `Age:${i}`),
    ...contentSafety.flags.map(f => `Safety:${f}`),
  ];

  const details = allIssues.length === 0
    ? `All checks passed. Score: ${overallScore}/100. Recommendation: ${recommendation}.`
    : `Score: ${overallScore}/100. Issues: ${allIssues.join(', ')}. Recommendation: ${recommendation}.`;

  return {
    pass,
    overallScore,
    socratic,
    ageAppropriate,
    contentSafety,
    recommendation,
    details,
  };
}

// ============================================================================
// E. EVAL LOGGER
// ============================================================================

/**
 * Tracks evaluation statistics across the process lifetime.
 * Attach a persistent backend (DB / time-series store) for production analytics.
 */
export class EvalLogger {
  constructor() {
    /** @type {number} Total number of responses evaluated */
    this._totalEvaluated = 0;

    /** @type {number} Count of evaluations where pass === true */
    this._passCount = 0;

    /** @type {number} Running sum of overallScore (for average calculation) */
    this._scoreSum = 0;

    /**
     * Violation/issue/flag frequency map.
     * Keys are namespaced strings, e.g. 'Socratic:DIRECT_ANSWER'.
     * @type {Map<string, number>}
     */
    this._violationCounts = new Map();

    /**
     * Recommendation distribution.
     * @type {{ send: number, flag: number, regenerate: number }}
     */
    this._recommendations = { send: 0, flag: 0, regenerate: 0 };
  }

  /**
   * Record a completed evaluation result.
   *
   * @param {string} sessionId - Session identifier for log correlation
   * @param {object} evalResult - Result returned by evaluateResponse()
   */
  log(sessionId, evalResult) {
    if (!evalResult || typeof evalResult !== 'object') return;

    this._totalEvaluated += 1;
    if (evalResult.pass) this._passCount += 1;
    this._scoreSum += evalResult.overallScore ?? 0;

    const rec = evalResult.recommendation;
    if (rec in this._recommendations) {
      this._recommendations[rec] += 1;
    }

    // Accumulate violation/issue/flag counts for trend analysis
    const allIssues = [
      ...(evalResult.socratic?.violations  || []).map(v => `Socratic:${v}`),
      ...(evalResult.ageAppropriate?.issues || []).map(i => `Age:${i}`),
      ...(evalResult.contentSafety?.flags   || []).map(f => `Safety:${f}`),
    ];

    for (const issue of allIssues) {
      this._violationCounts.set(issue, (this._violationCounts.get(issue) || 0) + 1);
    }

    // Structured log output — use warn for flag/regenerate so it surfaces in
    // production log aggregators at the appropriate alert level.
    const logPayload = {
      evalHarness: true,
      sessionId: sessionId ?? 'unknown',
      pass: evalResult.pass,
      overallScore: evalResult.overallScore,
      recommendation: evalResult.recommendation,
      socraticScore: evalResult.socratic?.score,
      ageScore: evalResult.ageAppropriate?.score,
      safetyScore: evalResult.contentSafety?.score,
      issues: allIssues,
    };

    if (rec === 'regenerate') {
      logger.warn(logPayload, `[EvalHarness] Response flagged for REGENERATION — ${evalResult.details}`);
    } else if (rec === 'flag') {
      logger.info(logPayload, `[EvalHarness] Response flagged for REVIEW — ${evalResult.details}`);
    } else {
      logger.debug(logPayload, `[EvalHarness] Response approved — ${evalResult.details}`);
    }
  }

  /**
   * Return aggregate statistics for monitoring dashboards or admin routes.
   *
   * @returns {{
   *   totalEvaluated: number,
   *   passRate: number,
   *   avgScore: number,
   *   recommendations: { send: number, flag: number, regenerate: number },
   *   commonViolations: Array<{ issue: string, count: number }>
   * }}
   */
  getStats() {
    const passRate = this._totalEvaluated > 0
      ? Math.round((this._passCount / this._totalEvaluated) * 100)
      : 0;

    const avgScore = this._totalEvaluated > 0
      ? Math.round(this._scoreSum / this._totalEvaluated)
      : 0;

    // Sort violations by frequency descending, return top 10
    const commonViolations = [...this._violationCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([issue, count]) => ({ issue, count }));

    return {
      totalEvaluated: this._totalEvaluated,
      passRate,
      avgScore,
      recommendations: { ...this._recommendations },
      commonViolations,
    };
  }

  /**
   * Reset all counters. Useful between test runs or monitoring windows.
   */
  reset() {
    this._totalEvaluated = 0;
    this._passCount = 0;
    this._scoreSum = 0;
    this._violationCounts.clear();
    this._recommendations = { send: 0, flag: 0, regenerate: 0 };
  }
}

// ============================================================================
// MODULE-LEVEL DEFAULT LOGGER INSTANCE
// ============================================================================

/**
 * Shared EvalLogger instance for use throughout the application.
 * Import and use this singleton rather than constructing new instances.
 *
 * @example
 * import { evaluateResponse, evalLogger } from './services/evalHarness.js';
 * const result = evaluateResponse(aliceResponse, context);
 * evalLogger.log(sessionId, result);
 */
export const evalLogger = new EvalLogger();

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  checkSocraticCompliance,
  checkAgeAppropriateness,
  checkContentSafety,
  evaluateResponse,
  EvalLogger,
  evalLogger,
};
