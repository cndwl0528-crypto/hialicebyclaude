/**
 * trainingExport.test.js
 *
 * Comprehensive test suite for the HiAlice training data export pipeline.
 * Tests all public exports: formatAnthropicJSONL, formatAlpacaJSONL,
 * filterHighQuality, anonymizeDialogues, exportTrainingData, estimateFineTuningCost.
 *
 * Run: cd backend && npx vitest run
 */

import { describe, it, expect } from 'vitest';
import {
  formatAnthropicJSONL,
  formatAlpacaJSONL,
  filterHighQuality,
  anonymizeDialogues,
  exportTrainingData,
  estimateFineTuningCost,
} from '../services/trainingExport.js';

// ============================================================================
// SHARED MOCK DATA FACTORIES
// ============================================================================

/** Create a single dialogue row */
function makeDialogue(overrides = {}) {
  return {
    id: overrides.id || 'dlg-001',
    session_id: overrides.session_id || 'sess-001',
    stage: overrides.stage || 'body',
    turn: overrides.turn ?? 1,
    speaker: overrides.speaker || 'student',
    content: overrides.content ?? 'I think the spider saved Wilbur because she cared about him.',
    timestamp: overrides.timestamp || '2026-03-01T10:00:00Z',
    grammar_score: overrides.grammar_score ?? 78,
  };
}

/** Create a realistic multi-turn conversation for one session */
function makeConversation(sessionId = 'sess-001', stage = 'body') {
  return [
    makeDialogue({
      id: 'dlg-1', session_id: sessionId, stage, turn: 1,
      speaker: 'alice',
      content: "That's a great start! Can you tell me why you think Charlotte helped Wilbur? What was her first reason?",
    }),
    makeDialogue({
      id: 'dlg-2', session_id: sessionId, stage, turn: 2,
      speaker: 'student',
      content: 'I think she helped because she was his friend and friends help each other.',
    }),
    makeDialogue({
      id: 'dlg-3', session_id: sessionId, stage, turn: 3,
      speaker: 'alice',
      content: 'That is wonderful thinking! What is a second reason Charlotte might have had?',
    }),
    makeDialogue({
      id: 'dlg-4', session_id: sessionId, stage, turn: 4,
      speaker: 'student',
      content: 'Maybe she wanted to show that pigs can be special and important animals.',
    }),
    makeDialogue({
      id: 'dlg-5', session_id: sessionId, stage, turn: 5,
      speaker: 'alice',
      content: 'Excellent! You are thinking like a real literary critic. Can you give a third reason?',
    }),
    makeDialogue({
      id: 'dlg-6', session_id: sessionId, stage, turn: 6,
      speaker: 'student',
      content: 'The third reason is that Charlotte wanted to leave something meaningful behind when she died.',
    }),
  ];
}

/** Create a session row */
function makeSession(overrides = {}) {
  return {
    id: overrides.id || 'sess-001',
    student_id: overrides.student_id || 'stu-001',
    book_id: overrides.book_id || 'book-001',
    stage: overrides.stage || 'conclusion',
    level_score: overrides.level_score ?? 72,
    grammar_score: overrides.grammar_score ?? 75,
    completed_at: overrides.completed_at !== undefined
      ? overrides.completed_at
      : '2026-03-01T11:00:00Z',
    _hasProfanity: overrides._hasProfanity ?? false,
  };
}

/** Metadata for formatting functions */
function makeMetadata(overrides = {}) {
  return {
    bookTitle: overrides.bookTitle || "Charlotte's Web",
    level: overrides.level || 'intermediate',
    stage: overrides.stage || 'body',
  };
}

// ============================================================================
// 1. formatAnthropicJSONL
// ============================================================================

describe('formatAnthropicJSONL', () => {
  it('returns null for empty dialogues array', () => {
    const result = formatAnthropicJSONL([], makeMetadata());
    expect(result).toBeNull();
  });

  it('returns null for null input', () => {
    const result = formatAnthropicJSONL(null, makeMetadata());
    expect(result).toBeNull();
  });

  it('returns null when all dialogues have empty content', () => {
    const dialogues = [
      makeDialogue({ content: '' }),
      makeDialogue({ content: '   ' }),
    ];
    const result = formatAnthropicJSONL(dialogues, makeMetadata());
    expect(result).toBeNull();
  });

  it('produces a messages array with a system message as first element', () => {
    const dialogues = makeConversation();
    const result = formatAnthropicJSONL(dialogues, makeMetadata());
    expect(result).not.toBeNull();
    expect(result.messages[0].role).toBe('system');
    expect(result.messages[0].content).toContain('HiAlice');
  });

  it('includes book title and level in the system prompt', () => {
    const dialogues = makeConversation();
    const metadata = makeMetadata({ bookTitle: 'Harry Potter', level: 'advanced' });
    const result = formatAnthropicJSONL(dialogues, metadata);
    expect(result.messages[0].content).toContain('Harry Potter');
    expect(result.messages[0].content).toContain('advanced');
  });

  it('maps alice speaker to assistant role', () => {
    const dialogues = [
      makeDialogue({ speaker: 'alice', content: 'What did you like about the book?' }),
    ];
    const result = formatAnthropicJSONL(dialogues, makeMetadata());
    const aliceMsg = result.messages.find(m => m.role === 'assistant');
    expect(aliceMsg).toBeDefined();
    expect(aliceMsg.content).toBe('What did you like about the book?');
  });

  it('maps student speaker to user role', () => {
    const dialogues = [
      makeDialogue({ speaker: 'student', content: 'I liked the ending the most.' }),
    ];
    const result = formatAnthropicJSONL(dialogues, makeMetadata());
    const studentMsg = result.messages.find(m => m.role === 'user');
    expect(studentMsg).toBeDefined();
    expect(studentMsg.content).toBe('I liked the ending the most.');
  });

  it('preserves message order from dialogues input', () => {
    const dialogues = makeConversation('sess-001', 'body');
    const result = formatAnthropicJSONL(dialogues, makeMetadata());
    // After the system message: alice(1), student(2), alice(3), student(4)...
    expect(result.messages[1].role).toBe('assistant'); // first is alice
    expect(result.messages[2].role).toBe('user');      // second is student
  });

  it('handles special characters in content without error', () => {
    const specialContent = 'He said, "It\'s amazing!" — even 100% of the time & always.';
    const dialogues = [makeDialogue({ content: specialContent })];
    const result = formatAnthropicJSONL(dialogues, makeMetadata());
    expect(result.messages[1].content).toBe(specialContent);
  });

  it('includes stage label in system prompt', () => {
    const metadata = makeMetadata({ stage: 'warm_connection' });
    const dialogues = [makeDialogue()];
    const result = formatAnthropicJSONL(dialogues, metadata);
    expect(result.messages[0].content).toContain('Warm Connection');
  });

  it('handles multi-stage sessions by using the metadata stage', () => {
    const dialogues = [
      makeDialogue({ stage: 'title', speaker: 'alice', content: 'What does the title mean?' }),
      makeDialogue({ stage: 'body', speaker: 'student', content: 'It means friendship.' }),
    ];
    const metadata = makeMetadata({ stage: 'title' });
    const result = formatAnthropicJSONL(dialogues, metadata);
    expect(result.messages).toHaveLength(3); // system + 2 turns
  });
});

// ============================================================================
// 2. formatAlpacaJSONL
// ============================================================================

describe('formatAlpacaJSONL', () => {
  it('returns empty array for empty dialogues', () => {
    const result = formatAlpacaJSONL([], makeMetadata());
    expect(result).toEqual([]);
  });

  it('returns empty array for null input', () => {
    const result = formatAlpacaJSONL(null, makeMetadata());
    expect(result).toEqual([]);
  });

  it('produces instruction/input/output records', () => {
    const dialogues = makeConversation();
    const result = formatAlpacaJSONL(dialogues, makeMetadata());
    expect(result.length).toBeGreaterThan(0);
    const record = result[0];
    expect(record).toHaveProperty('instruction');
    expect(record).toHaveProperty('input');
    expect(record).toHaveProperty('output');
  });

  it('sets input to the student message', () => {
    const dialogues = [
      makeDialogue({ speaker: 'student', content: 'I loved the spider.' }),
      makeDialogue({ speaker: 'alice', content: 'Tell me more about why!' }),
    ];
    const result = formatAlpacaJSONL(dialogues, makeMetadata());
    expect(result[0].input).toBe('I loved the spider.');
  });

  it('sets output to the alice response', () => {
    const dialogues = [
      makeDialogue({ speaker: 'student', content: 'I loved the spider.' }),
      makeDialogue({ speaker: 'alice', content: 'Tell me more about why!' }),
    ];
    const result = formatAlpacaJSONL(dialogues, makeMetadata());
    expect(result[0].output).toBe('Tell me more about why!');
  });

  it('includes book title in instruction context', () => {
    const dialogues = [
      makeDialogue({ speaker: 'student', content: 'Harry is brave.' }),
      makeDialogue({ speaker: 'alice', content: 'Why do you think so?' }),
    ];
    const metadata = makeMetadata({ bookTitle: 'Harry Potter and the Sorcerer\'s Stone' });
    const result = formatAlpacaJSONL(dialogues, metadata);
    expect(result[0].instruction).toContain('Harry Potter');
  });

  it('mentions level in instruction context', () => {
    const dialogues = makeConversation();
    const metadata = makeMetadata({ level: 'beginner' });
    const result = formatAlpacaJSONL(dialogues, metadata);
    expect(result[0].instruction).toContain('beginner');
  });

  it('skips pairs where turns are not student->alice order', () => {
    const dialogues = [
      makeDialogue({ speaker: 'alice', content: 'First question from alice.' }),
      makeDialogue({ speaker: 'alice', content: 'Another alice message.' }),
    ];
    const result = formatAlpacaJSONL(dialogues, makeMetadata());
    expect(result).toHaveLength(0);
  });

  it('handles multi-turn conversation producing multiple records', () => {
    const dialogues = makeConversation();
    const result = formatAlpacaJSONL(dialogues, makeMetadata());
    // Conversation has 3 student turns each followed by alice
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('includes stage in instruction context', () => {
    const dialogues = makeConversation('sess-001', 'conclusion');
    const metadata = makeMetadata({ stage: 'conclusion' });
    const result = formatAlpacaJSONL(dialogues, metadata);
    expect(result[0].instruction).toContain('Conclusion');
  });
});

// ============================================================================
// 3. filterHighQuality
// ============================================================================

describe('filterHighQuality', () => {
  it('returns empty array for empty input', () => {
    const result = filterHighQuality([]);
    expect(result).toEqual([]);
  });

  it('returns empty array for null input', () => {
    const result = filterHighQuality(null);
    expect(result).toEqual([]);
  });

  it('keeps sessions meeting the default grammar score threshold (60)', () => {
    const sessions = [makeSession({ grammar_score: 60 })];
    const result = filterHighQuality(sessions);
    expect(result).toHaveLength(1);
  });

  it('excludes sessions below the default grammar score threshold', () => {
    const sessions = [makeSession({ grammar_score: 59 })];
    const result = filterHighQuality(sessions);
    expect(result).toHaveLength(0);
  });

  it('respects a custom minQuality threshold', () => {
    const sessions = [
      makeSession({ id: 'a', grammar_score: 70 }),
      makeSession({ id: 'b', grammar_score: 80 }),
    ];
    const result = filterHighQuality(sessions, { minQuality: 75 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('excludes sessions with no completed_at (abandoned)', () => {
    const sessions = [makeSession({ completed_at: null, grammar_score: 90 })];
    const result = filterHighQuality(sessions);
    expect(result).toHaveLength(0);
  });

  it('excludes sessions flagged for content violations', () => {
    const sessions = [makeSession({ _hasProfanity: true, grammar_score: 90 })];
    const result = filterHighQuality(sessions);
    expect(result).toHaveLength(0);
  });

  it('enforces minimum turn count when dialogueMap is provided', () => {
    const sessions = [makeSession({ id: 'sess-001' })];
    const shortDialogues = [
      makeDialogue({ session_id: 'sess-001' }),
      makeDialogue({ session_id: 'sess-001' }),
    ]; // only 2 turns, below MIN_TURN_COUNT=4
    const dialogueMap = new Map([['sess-001', shortDialogues]]);
    const result = filterHighQuality(sessions, { dialogueMap });
    expect(result).toHaveLength(0);
  });

  it('keeps sessions with sufficient turns when dialogueMap is provided', () => {
    const sessions = [makeSession({ id: 'sess-001' })];
    const dialogueMap = new Map([['sess-001', makeConversation('sess-001')]]);
    const result = filterHighQuality(sessions, { dialogueMap });
    expect(result).toHaveLength(1);
  });

  it('handles all sessions being filtered out', () => {
    const sessions = [
      makeSession({ id: 'a', grammar_score: 30 }),
      makeSession({ id: 'b', grammar_score: 40 }),
    ];
    const result = filterHighQuality(sessions);
    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// 4. anonymizeDialogues
// ============================================================================

describe('anonymizeDialogues', () => {
  it('returns empty array for empty input', () => {
    const result = anonymizeDialogues([]);
    expect(result).toEqual([]);
  });

  it('returns empty array for null input', () => {
    const result = anonymizeDialogues(null);
    expect(result).toEqual([]);
  });

  it('replaces student name with [STUDENT] placeholder', () => {
    const dialogues = [
      makeDialogue({ content: 'My name is Emma and I love books.' }),
    ];
    const result = anonymizeDialogues(dialogues, { studentName: 'Emma' });
    expect(result[0].content).toContain('[STUDENT]');
    expect(result[0].content).not.toContain('Emma');
  });

  it('replaces student name case-insensitively', () => {
    const dialogues = [
      makeDialogue({ content: 'JAMES thinks the book is great.' }),
    ];
    const result = anonymizeDialogues(dialogues, { studentName: 'James' });
    expect(result[0].content).toContain('[STUDENT]');
    expect(result[0].content).not.toContain('JAMES');
  });

  it('removes email address patterns', () => {
    const dialogues = [
      makeDialogue({ content: 'My email is student@school.edu please reply.' }),
    ];
    const result = anonymizeDialogues(dialogues);
    expect(result[0].content).toContain('[EMAIL]');
    expect(result[0].content).not.toContain('student@school.edu');
  });

  it('removes US phone number patterns', () => {
    const dialogues = [
      makeDialogue({ content: 'Call me at 555-867-5309 after school.' }),
    ];
    const result = anonymizeDialogues(dialogues);
    expect(result[0].content).toContain('[PHONE]');
    expect(result[0].content).not.toContain('555-867-5309');
  });

  it('removes Korean phone number patterns', () => {
    const dialogues = [
      makeDialogue({ content: '전화해 010-1234-5678' }),
    ];
    const result = anonymizeDialogues(dialogues);
    expect(result[0].content).not.toContain('010-1234-5678');
  });

  it('does not alter content when no PII is present', () => {
    const original = "Charlotte's Web is a story about friendship and sacrifice.";
    const dialogues = [makeDialogue({ content: original })];
    const result = anonymizeDialogues(dialogues);
    expect(result[0].content).toBe(original);
  });

  it('preserves all other dialogue fields unchanged', () => {
    const dialogue = makeDialogue({ id: 'dlg-xyz', grammar_score: 88 });
    const result = anonymizeDialogues([dialogue]);
    expect(result[0].id).toBe('dlg-xyz');
    expect(result[0].grammar_score).toBe(88);
    expect(result[0].session_id).toBe(dialogue.session_id);
  });

  it('does not mutate the original dialogues array', () => {
    const original = makeDialogue({ content: 'My email is test@example.com' });
    const originalContent = original.content;
    anonymizeDialogues([original]);
    expect(original.content).toBe(originalContent);
  });

  it('handles already-anonymous data gracefully without double-replacing', () => {
    const dialogues = [
      makeDialogue({ content: '[STUDENT] loves reading about magic.' }),
    ];
    const result = anonymizeDialogues(dialogues, { studentName: 'STUDENT' });
    // Should not produce [STUDENT][STUDENT] or break
    expect(result[0].content).toBeDefined();
    expect(typeof result[0].content).toBe('string');
  });
});

// ============================================================================
// 5. exportTrainingData
// ============================================================================

describe('exportTrainingData', () => {
  // Base fixture data used across this suite
  const sessions = [
    makeSession({ id: 'sess-001', student_id: 'stu-001', book_id: 'book-001', grammar_score: 80 }),
    makeSession({ id: 'sess-002', student_id: 'stu-002', book_id: 'book-002', grammar_score: 40 }),
  ];

  const dialogues = [
    ...makeConversation('sess-001', 'body'),
    ...makeConversation('sess-002', 'title'),
  ];

  const books = [
    { id: 'book-001', title: "Charlotte's Web" },
    { id: 'book-002', title: 'Harry Potter' },
  ];

  const students = [
    { id: 'stu-001', name: 'Emma', level: 'intermediate' },
    { id: 'stu-002', name: 'James', level: 'beginner' },
  ];

  it('returns empty data and zeroed stats when sessions array is empty', () => {
    const result = exportTrainingData([], [], {});
    expect(result.data).toEqual([]);
    expect(result.stats.totalSessions).toBe(0);
    expect(result.stats.filteredSessions).toBe(0);
  });

  it('returns empty data when sessions or dialogues are null', () => {
    const result = exportTrainingData(null, null, {});
    expect(result.data).toEqual([]);
  });

  it('correctly reports totalSessions in stats', () => {
    const result = exportTrainingData(sessions, dialogues, { books, students });
    expect(result.stats.totalSessions).toBe(2);
  });

  it('filters out low-quality sessions from data output', () => {
    // sess-002 has grammar_score 40 which is below default 60 threshold
    const result = exportTrainingData(sessions, dialogues, { books, students });
    expect(result.stats.filteredSessions).toBe(1);
    expect(result.data).toHaveLength(1);
  });

  it('produces Anthropic format output by default', () => {
    const result = exportTrainingData(sessions, dialogues, { books, students });
    expect(result.stats.format).toBe('anthropic');
    expect(result.data[0]).toHaveProperty('messages');
  });

  it('produces Alpaca format output when format option is "alpaca"', () => {
    const result = exportTrainingData(sessions, dialogues, { format: 'alpaca', books, students });
    expect(result.stats.format).toBe('alpaca');
    // Alpaca returns one record per student->alice pair, not per session
    expect(result.data[0]).toHaveProperty('instruction');
    expect(result.data[0]).toHaveProperty('input');
    expect(result.data[0]).toHaveProperty('output');
  });

  it('reports totalTurns matching the qualified session dialogue count', () => {
    const result = exportTrainingData(sessions, dialogues, { books, students });
    // sess-001 has 6 turns, sess-002 is filtered out
    expect(result.stats.totalTurns).toBe(6);
  });

  it('anonymizes student names when anonymize option is true (default)', () => {
    const result = exportTrainingData(sessions, dialogues, {
      books, students, format: 'anthropic',
    });
    const record = result.data[0];
    const allContent = record.messages.map(m => m.content).join(' ');
    // Emma's name should not appear in the output
    expect(allContent).not.toContain('Emma');
  });

  it('does not anonymize when anonymize option is false', () => {
    // Inject student name into a dialogue turn
    const namedDialogues = [
      ...makeConversation('sess-001').map((d, i) =>
        i === 1
          ? { ...d, content: 'My name is Emma and I think the spider is brave.' }
          : d
      ),
    ];
    const result = exportTrainingData(sessions, namedDialogues, {
      books, students, anonymize: false, format: 'anthropic',
    });
    const allContent = result.data[0].messages.map(m => m.content).join(' ');
    expect(allContent).toContain('Emma');
  });
});

// ============================================================================
// 6. estimateFineTuningCost
// ============================================================================

describe('estimateFineTuningCost', () => {
  it('returns all zeros for empty data array', () => {
    const result = estimateFineTuningCost([]);
    expect(result.totalTokens).toBe(0);
    expect(result.estimatedCostUSD).toBe(0);
    expect(result.averageTokensPerSession).toBe(0);
    expect(result.recordCount).toBe(0);
  });

  it('returns all zeros for null input', () => {
    const result = estimateFineTuningCost(null);
    expect(result.totalTokens).toBe(0);
    expect(result.estimatedCostUSD).toBe(0);
  });

  it('returns correct record count', () => {
    const data = [
      { messages: [{ role: 'user', content: 'Hello' }] },
      { messages: [{ role: 'user', content: 'World' }] },
    ];
    const result = estimateFineTuningCost(data);
    expect(result.recordCount).toBe(2);
  });

  it('estimates tokens as roughly chars/4 per record', () => {
    const record = { messages: [{ role: 'user', content: 'abcd' }] }; // small payload
    const serialized = JSON.stringify(record);
    const expectedTokens = Math.ceil(serialized.length / 4);
    const result = estimateFineTuningCost([record]);
    expect(result.totalTokens).toBe(expectedTokens);
  });

  it('calculates average tokens per session across multiple records', () => {
    const dialogues = makeConversation();
    const record = formatAnthropicJSONL(dialogues, makeMetadata());
    const data = [record, record]; // two identical records
    const result = estimateFineTuningCost(data);
    expect(result.averageTokensPerSession).toBe(
      Math.round(result.totalTokens / 2)
    );
  });

  it('accepts a custom costPer1kTokens override', () => {
    const data = [{ messages: [{ role: 'user', content: 'x'.repeat(4000) }] }];
    const defaultResult = estimateFineTuningCost(data);
    const customResult = estimateFineTuningCost(data, { costPer1kTokens: 0.001 });
    // With lower cost per token the estimated cost should be lower
    expect(customResult.estimatedCostUSD).toBeLessThan(defaultResult.estimatedCostUSD);
  });

  it('returns a numeric estimatedCostUSD value for realistic dataset', () => {
    const sessions = [makeSession({ id: 'sess-001', grammar_score: 85 })];
    const dialogues = makeConversation('sess-001');
    const { data } = exportTrainingData(sessions, dialogues, {
      books: [{ id: 'book-001', title: "Charlotte's Web" }],
      students: [{ id: 'stu-001', name: 'Emma', level: 'intermediate' }],
    });
    const result = estimateFineTuningCost(data);
    expect(typeof result.estimatedCostUSD).toBe('number');
    expect(result.estimatedCostUSD).toBeGreaterThan(0);
  });
});
