/**
 * trainingExport.js — Training Data Export for Fine-Tuning
 *
 * Converts HiAlice conversation logs into JSONL format compatible with
 * Anthropic fine-tuning and open-source models (Phi-3 / Alpaca format).
 *
 * Pipeline overview:
 *   1. filterHighQuality  — drop low-signal sessions
 *   2. anonymizeDialogues — strip PII from content
 *   3. formatAnthropicJSONL | formatAlpacaJSONL — shape for target model
 *   4. estimateFineTuningCost — budget estimation before upload
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default grammar score threshold for quality filtering */
const DEFAULT_MIN_GRAMMAR_SCORE = 60;

/** Minimum dialogue turns required for a session to be training-worthy */
const MIN_TURN_COUNT = 4;

/**
 * Anthropic pricing reference (tokens).
 * Update when fine-tuning pricing changes.
 * https://docs.anthropic.com
 */
const ANTHROPIC_COST_PER_1K_TOKENS = 0.008;

/** Rough average characters per token (English text heuristic) */
const CHARS_PER_TOKEN = 4;

/** Stage labels used in system prompt construction */
const STAGE_LABELS = {
  warm_connection: 'Warm Connection',
  title:          'Title Exploration',
  introduction:   'Introduction & Characters',
  body:           'Body — Three Supporting Reasons',
  conclusion:     'Conclusion & Personal Reflection',
};

/** PII patterns to scrub during anonymization */
const PII_PATTERNS = [
  {
    label: 'email',
    pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL]',
  },
  {
    label: 'us_phone',
    pattern: /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/g,
    replacement: '[PHONE]',
  },
  {
    label: 'kr_phone',
    pattern: /0\d{1,2}[\s.\-]?\d{3,4}[\s.\-]?\d{4}/g,
    replacement: '[PHONE]',
  },
];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Return a human-readable stage label, falling back to the raw value.
 * @param {string} stage
 * @returns {string}
 */
function resolveStageLabel(stage) {
  return STAGE_LABELS[stage] || stage || 'General Discussion';
}

/**
 * Build the system prompt string for a session, embedding book/level context.
 * @param {object} metadata - { bookTitle, level, stage }
 * @returns {string}
 */
function buildSystemPrompt(metadata) {
  const { bookTitle = 'an English book', level = 'intermediate', stage } = metadata || {};
  const stageLabel = resolveStageLabel(stage);
  return (
    `You are HiAlice, a warm and encouraging English teacher from the East Coast. ` +
    `You are conducting a Socratic book review session with a ${level} level student ` +
    `who has just finished reading "${bookTitle}". ` +
    `Current session stage: ${stageLabel}. ` +
    `Guide the student to express their own thoughts through open-ended questions. ` +
    `Do not give away answers directly.`
  );
}

/**
 * Group a flat array of dialogue rows by session_id, preserving turn order.
 * Returns a new Map<session_id, dialogue[]>.
 * @param {Array<object>} dialogues
 * @returns {Map<string, Array<object>>}
 */
function groupDialoguesBySession(dialogues) {
  return dialogues.reduce((map, dialogue) => {
    const key = dialogue.session_id;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(dialogue);
    return map;
  }, new Map());
}

/**
 * Count the number of complete turns (student + alice pairs) in a dialogue list.
 * A "turn" here is counted as any individual dialogue row.
 * @param {Array<object>} dialogues
 * @returns {number}
 */
function countTurns(dialogues) {
  return Array.isArray(dialogues) ? dialogues.length : 0;
}

// ============================================================================
// FORMAT 1: ANTHROPIC JSONL
// ============================================================================

/**
 * Convert a set of dialogue rows for a single session into an Anthropic
 * fine-tuning record (messages array format).
 *
 * Output shape per record:
 * {
 *   "messages": [
 *     { "role": "system",    "content": "..." },
 *     { "role": "user",      "content": "..." },
 *     { "role": "assistant", "content": "..." },
 *     ...
 *   ]
 * }
 *
 * @param {Array<object>} dialogues - Ordered dialogue rows for one session.
 *   Each row: { session_id, stage, speaker, content, timestamp, grammar_score }
 * @param {object} metadata - { bookTitle, level, stage }
 * @returns {object} A single JSONL-ready record or null if dialogues is empty.
 */
export function formatAnthropicJSONL(dialogues, metadata) {
  if (!Array.isArray(dialogues) || dialogues.length === 0) {
    return null;
  }

  const systemPrompt = buildSystemPrompt(metadata);

  const conversationMessages = dialogues
    .filter(d => d.content && d.content.trim().length > 0)
    .map(d => ({
      role: d.speaker === 'alice' ? 'assistant' : 'user',
      content: d.content.trim(),
    }));

  if (conversationMessages.length === 0) {
    return null;
  }

  return {
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationMessages,
    ],
  };
}

/**
 * Convert multiple sessions worth of dialogues into Anthropic JSONL records.
 *
 * @param {Map<string, Array<object>>} sessionDialoguesMap - session_id -> dialogues[]
 * @param {Map<string, object>} sessionMetaMap - session_id -> metadata object
 * @returns {Array<object>} Array of JSONL-ready records (one per session).
 */
function formatAllSessionsAnthropic(sessionDialoguesMap, sessionMetaMap) {
  const records = [];

  for (const [sessionId, dialogues] of sessionDialoguesMap) {
    const metadata = sessionMetaMap.get(sessionId) || {};
    const record = formatAnthropicJSONL(dialogues, metadata);
    if (record !== null) {
      records.push(record);
    }
  }

  return records;
}

// ============================================================================
// FORMAT 2: ALPACA / PHI-3 JSONL
// ============================================================================

/**
 * Convert a single dialogue turn into an Alpaca-format training record.
 *
 * Output shape:
 * { "instruction": "...", "input": "...", "output": "..." }
 *
 * Mapping:
 *   instruction = HiAlice system context (stage, book, level)
 *   input       = student message (user turn)
 *   output      = alice response (assistant turn)
 *
 * @param {Array<object>} dialogues - Ordered dialogue rows for one session.
 * @param {object} metadata - { bookTitle, level, stage }
 * @returns {Array<object>} One Alpaca record per student+alice pair found.
 */
export function formatAlpacaJSONL(dialogues, metadata) {
  if (!Array.isArray(dialogues) || dialogues.length === 0) {
    return [];
  }

  const { bookTitle = 'an English book', level = 'intermediate', stage } = metadata || {};
  const stageLabel = resolveStageLabel(stage);

  const instruction = (
    `You are HiAlice, an encouraging English reading teacher. ` +
    `Help a ${level} level student discuss "${bookTitle}" ` +
    `during the "${stageLabel}" stage. Use the Socratic method.`
  );

  const records = [];
  const filtered = dialogues.filter(d => d.content && d.content.trim().length > 0);

  for (let i = 0; i < filtered.length - 1; i++) {
    const current = filtered[i];
    const next = filtered[i + 1];

    // Only pair student -> alice turns
    if (current.speaker === 'student' && next.speaker === 'alice') {
      records.push({
        instruction,
        input: current.content.trim(),
        output: next.content.trim(),
      });
    }
  }

  return records;
}

/**
 * Convert multiple sessions into Alpaca JSONL records.
 *
 * @param {Map<string, Array<object>>} sessionDialoguesMap
 * @param {Map<string, object>} sessionMetaMap
 * @returns {Array<object>}
 */
function formatAllSessionsAlpaca(sessionDialoguesMap, sessionMetaMap) {
  const records = [];

  for (const [sessionId, dialogues] of sessionDialoguesMap) {
    const metadata = sessionMetaMap.get(sessionId) || {};
    const sessionRecords = formatAlpacaJSONL(dialogues, metadata);
    records.push(...sessionRecords);
  }

  return records;
}

// ============================================================================
// QUALITY FILTERING
// ============================================================================

/**
 * Filter sessions to only include those suitable for training data.
 *
 * Inclusion criteria:
 *   - grammar_score >= minQuality (default 60)
 *   - At least MIN_TURN_COUNT dialogue turns in associated data
 *   - No content filter violations (session._hasProfanity !== true)
 *   - Session was completed (completed_at is truthy)
 *
 * @param {Array<object>} sessions - Session rows from the sessions table.
 *   Each row: { id, student_id, book_id, stage, level_score, grammar_score,
 *               completed_at, _hasProfanity? }
 * @param {object} [options]
 * @param {number} [options.minQuality=60] - Minimum grammar_score threshold.
 * @param {Map<string, Array>} [options.dialogueMap] - Optional session_id -> turns[]
 *   used to enforce the minimum turn count per session.
 * @returns {Array<object>} Filtered array of session objects.
 */
export function filterHighQuality(sessions, options = {}) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return [];
  }

  const minQuality = typeof options.minQuality === 'number'
    ? options.minQuality
    : DEFAULT_MIN_GRAMMAR_SCORE;

  const dialogueMap = options.dialogueMap instanceof Map
    ? options.dialogueMap
    : null;

  return sessions.filter(session => {
    // Must have a grammar score meeting the threshold
    if (typeof session.grammar_score !== 'number') return false;
    if (session.grammar_score < minQuality) return false;

    // Must be completed (not abandoned)
    if (!session.completed_at) return false;

    // Must not have content filter violations
    if (session._hasProfanity === true) return false;

    // Enforce minimum turn count when dialogue data is available
    if (dialogueMap) {
      const turns = dialogueMap.get(session.id) || [];
      if (countTurns(turns) < MIN_TURN_COUNT) return false;
    }

    return true;
  });
}

// ============================================================================
// ANONYMIZATION
// ============================================================================

/**
 * Replace student names and PII patterns in dialogue content.
 *
 * Mutates nothing — returns a new array of dialogue objects with sanitized
 * content fields.
 *
 * Anonymization steps:
 *   1. Replace student name occurrences with [STUDENT]
 *   2. Remove email addresses -> [EMAIL]
 *   3. Remove phone numbers  -> [PHONE]
 *
 * @param {Array<object>} dialogues - Dialogue rows to anonymize.
 * @param {object} [options]
 * @param {string} [options.studentName] - The actual student name to scrub.
 * @returns {Array<object>} New array with anonymized content fields.
 */
export function anonymizeDialogues(dialogues, options = {}) {
  if (!Array.isArray(dialogues) || dialogues.length === 0) {
    return [];
  }

  const { studentName } = options;

  return dialogues.map(dialogue => {
    let content = dialogue.content || '';

    // Replace student name (case-insensitive, whole-word match)
    if (studentName && typeof studentName === 'string' && studentName.trim().length > 0) {
      const escapedName = studentName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const namePattern = new RegExp(`\\b${escapedName}\\b`, 'gi');
      content = content.replace(namePattern, '[STUDENT]');
    }

    // Apply each PII pattern
    for (const { pattern, replacement } of PII_PATTERNS) {
      // Reset lastIndex for global regexes
      pattern.lastIndex = 0;
      content = content.replace(pattern, replacement);
    }

    return { ...dialogue, content };
  });
}

// ============================================================================
// METADATA BUILDER
// ============================================================================

/**
 * Build a Map of session metadata keyed by session_id, joining session and
 * student data so formatters have book/level context available.
 *
 * @param {Array<object>} sessions
 * @param {Array<object>} [books=[]] - Optional book rows for title lookup.
 * @param {Array<object>} [students=[]] - Optional student rows for level lookup.
 * @returns {Map<string, object>}
 */
function buildSessionMetaMap(sessions, books = [], students = []) {
  const bookIndex = new Map(books.map(b => [b.id, b]));
  const studentIndex = new Map(students.map(s => [s.id, s]));

  return sessions.reduce((map, session) => {
    const book = bookIndex.get(session.book_id) || {};
    const student = studentIndex.get(session.student_id) || {};

    map.set(session.id, {
      bookTitle: book.title || 'Unknown Book',
      level: student.level || 'intermediate',
      stage: session.stage || null,
    });

    return map;
  }, new Map());
}

// ============================================================================
// EXPORT PIPELINE
// ============================================================================

/**
 * Full training data export pipeline.
 *
 * Steps:
 *   1. Filter sessions by quality criteria
 *   2. Group dialogues by session
 *   3. Anonymize content if requested
 *   4. Format records according to chosen target format
 *   5. Return { data, stats }
 *
 * @param {Array<object>} sessions - All session rows.
 * @param {Array<object>} dialogues - All dialogue rows.
 * @param {object} [options]
 * @param {'anthropic'|'alpaca'} [options.format='anthropic'] - Output format.
 * @param {number} [options.minQuality=60] - Minimum grammar_score.
 * @param {boolean} [options.anonymize=true] - Whether to anonymize PII.
 * @param {Array<object>} [options.books=[]] - Book rows for metadata.
 * @param {Array<object>} [options.students=[]] - Student rows for metadata.
 * @returns {{
 *   data: Array<object>,
 *   stats: {
 *     totalSessions: number,
 *     filteredSessions: number,
 *     totalTurns: number,
 *     format: string
 *   }
 * }}
 */
export function exportTrainingData(sessions, dialogues, options = {}) {
  const {
    format = 'anthropic',
    minQuality = DEFAULT_MIN_GRAMMAR_SCORE,
    anonymize = true,
    books = [],
    students = [],
  } = options;

  if (!Array.isArray(sessions) || !Array.isArray(dialogues)) {
    return {
      data: [],
      stats: { totalSessions: 0, filteredSessions: 0, totalTurns: 0, format },
    };
  }

  const totalSessions = sessions.length;

  // Step 1: Group dialogues by session for turn-count enforcement
  const dialogueMap = groupDialoguesBySession(dialogues);

  // Step 2: Filter sessions to high-quality subset
  const qualifiedSessions = filterHighQuality(sessions, { minQuality, dialogueMap });
  const filteredSessions = qualifiedSessions.length;

  // Restrict dialogue map to qualified sessions only
  const qualifiedIds = new Set(qualifiedSessions.map(s => s.id));
  const qualifiedDialogueMap = new Map();
  for (const [sessionId, turns] of dialogueMap) {
    if (qualifiedIds.has(sessionId)) {
      qualifiedDialogueMap.set(sessionId, turns);
    }
  }

  // Step 3: Anonymize if requested
  const studentIndex = new Map((students || []).map(s => [s.id, s]));

  if (anonymize) {
    for (const [sessionId, turns] of qualifiedDialogueMap) {
      const session = qualifiedSessions.find(s => s.id === sessionId);
      const student = session ? studentIndex.get(session.student_id) : null;
      const studentName = student ? student.name : undefined;
      qualifiedDialogueMap.set(sessionId, anonymizeDialogues(turns, { studentName }));
    }
  }

  // Step 4: Build metadata lookup
  const sessionMetaMap = buildSessionMetaMap(qualifiedSessions, books, students);

  // Step 5: Format records
  let data;
  if (format === 'alpaca') {
    data = formatAllSessionsAlpaca(qualifiedDialogueMap, sessionMetaMap);
  } else {
    data = formatAllSessionsAnthropic(qualifiedDialogueMap, sessionMetaMap);
  }

  // Count total turns across qualified sessions
  const totalTurns = [...qualifiedDialogueMap.values()]
    .reduce((sum, turns) => sum + countTurns(turns), 0);

  return {
    data,
    stats: { totalSessions, filteredSessions, totalTurns, format },
  };
}

// ============================================================================
// COST ESTIMATION
// ============================================================================

/**
 * Estimate the token count and fine-tuning cost for a set of JSONL records.
 *
 * Token estimation: serialize each record to JSON, divide char count by
 * CHARS_PER_TOKEN (4 chars ≈ 1 token for English text).
 *
 * @param {Array<object>} data - Array of JSONL-ready records.
 * @param {object} [options]
 * @param {number} [options.costPer1kTokens] - Override default Anthropic pricing.
 * @returns {{
 *   totalTokens: number,
 *   estimatedCostUSD: number,
 *   averageTokensPerSession: number,
 *   recordCount: number
 * }}
 */
export function estimateFineTuningCost(data, options = {}) {
  if (!Array.isArray(data) || data.length === 0) {
    return {
      totalTokens: 0,
      estimatedCostUSD: 0,
      averageTokensPerSession: 0,
      recordCount: 0,
    };
  }

  const costPer1kTokens = typeof options.costPer1kTokens === 'number'
    ? options.costPer1kTokens
    : ANTHROPIC_COST_PER_1K_TOKENS;

  const tokenCounts = data.map(record => {
    const serialized = JSON.stringify(record);
    return Math.ceil(serialized.length / CHARS_PER_TOKEN);
  });

  const totalTokens = tokenCounts.reduce((sum, t) => sum + t, 0);
  const estimatedCostUSD = (totalTokens / 1000) * costPer1kTokens;
  const averageTokensPerSession = Math.round(totalTokens / data.length);

  return {
    totalTokens,
    estimatedCostUSD: Math.round(estimatedCostUSD * 10000) / 10000,
    averageTokensPerSession,
    recordCount: data.length,
  };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  formatAnthropicJSONL,
  formatAlpacaJSONL,
  filterHighQuality,
  anonymizeDialogues,
  exportTrainingData,
  estimateFineTuningCost,
};
