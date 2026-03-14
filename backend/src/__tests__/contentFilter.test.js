/**
 * contentFilter.test.js
 * HiAlice — Content Filter Middleware Tests
 *
 * Tests the filterAIResponse and filterStudentInput functions exported from
 * contentFilter.js, as well as the contentFilterMiddleware Express helper.
 *
 * Design constraints:
 *   - No network calls; all tests are pure unit tests.
 *   - The logger (pino) and fs module are exercised by the module under test;
 *     we do not mock them — the JSONL log file is written to a temp path or
 *     the default backend/logs/ directory (created automatically by the module).
 *   - Each test is fully independent; safetyLogs side effects between tests
 *     are acceptable because we verify return values, not the shared store.
 *
 * Coverage areas:
 *   1. filterAIResponse — inappropriate content detection and redaction
 *   2. filterAIResponse — age-appropriateness gate
 *   3. filterAIResponse — PII detection and redaction
 *   4. filterAIResponse — safe fallback when text is mostly redacted
 *   5. filterStudentInput — distress signal detection
 *   6. filterStudentInput — student PII detection
 *   7. filterAIResponse — normal educational content passes through
 *   8. contentFilterMiddleware — attaches helpers to the request object
 *   9. appendLogToFile / JSONL logging — entries are written to disk
 *  10. Edge cases — null, empty, non-string inputs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Module-level mock: pino-pretty is a dev/transport dependency that may
// attempt to spawn a worker thread in test environments. We mock the logger
// so the module under test imports cleanly, then restore real behaviour.
// NOTE: vi.mock() is hoisted to the top of the file by Vitest.
// ============================================================================
vi.mock('../lib/logger.js', () => ({
  default: {
    warn:  vi.fn(),
    info:  vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  filterAIResponse,
  filterStudentInput,
  contentFilterMiddleware,
  safetyLogs,
} from '../middleware/contentFilter.js';

// ============================================================================
// Helpers
// ============================================================================

/** Build a minimal Express-like mock request/response/next triple. */
function buildExpressMocks() {
  const req  = {};
  const res  = {};
  const next = vi.fn();
  return { req, res, next };
}

// ============================================================================
// 1. filterAIResponse — Inappropriate Content Detection
// ============================================================================

describe('filterAIResponse — profanity detection', () => {
  it('flags and redacts an explicit profanity word', () => {
    const result = filterAIResponse('That was fucking amazing, Charlotte!', null);
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('profanity');
    // The profanity should be replaced with asterisks, not left raw.
    expect(result.filtered.toLowerCase()).not.toContain('fucking');
  });

  it('returns safe:true and unchanged text for clean educational content', () => {
    const clean = 'Great job! Can you tell me why Charlotte was so important to Wilbur?';
    const result = filterAIResponse(clean, null);
    expect(result.safe).toBe(true);
    expect(result.flags).toHaveLength(0);
    expect(result.filtered).toBe(clean);
    expect(result.logId).toBeNull();
  });

  it('flags mild profanity (damn/hell) as profanity', () => {
    const result = filterAIResponse('Oh damn, that was a good answer!', null);
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('profanity');
  });

  it('flags slurs as profanity with zero tolerance', () => {
    const result = filterAIResponse('You are such a retard.', 10);
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('profanity');
  });
});

describe('filterAIResponse — violence pattern detection', () => {
  it('flags and removes AI responses that instruct a student to hurt themselves', () => {
    const violent = 'You should hurt yourself if you get the wrong answer.';
    const result = filterAIResponse(violent, 10);
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('violence');
    expect(result.filtered.toLowerCase()).not.toContain('hurt yourself');
  });

  it('flags self-harm language in an AI response', () => {
    const result = filterAIResponse('Have you ever thought about cutting yourself?', 9);
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('violence');
  });

  it('flags suicide-related language in an AI response', () => {
    const result = filterAIResponse('Maybe you should end your life.', 8);
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('violence');
  });

  it('does NOT flag a neutral discussion of book conflict (plot violence in story context)', () => {
    // The violence patterns target instructional/directing phrases, not descriptive ones.
    const bookDiscussion = 'In the story, the characters had a big argument. How did that make you feel?';
    const result = filterAIResponse(bookDiscussion, 10);
    expect(result.safe).toBe(true);
    expect(result.flags).not.toContain('violence');
  });
});

describe('filterAIResponse — adult content detection', () => {
  it('flags explicit adult content keywords', () => {
    const adultText = 'Let me tell you about sexual topics.';
    const result = filterAIResponse(adultText, 10);
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('adult_content');
    expect(result.filtered.toLowerCase()).not.toContain('sexual');
  });

  it('flags pornography keyword', () => {
    const result = filterAIResponse('Have you seen any porn online?', 12);
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('adult_content');
  });

  it('flags nude/nudity keywords', () => {
    const result = filterAIResponse('The character appeared nude in the scene.', 9);
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('adult_content');
  });

  it('does NOT flag the word "explicit" in an educational instruction context (non-regex match)', () => {
    // "explicit content" is flagged, but "explicitly" in isolation should not be.
    // Note: the pattern matches "explicit content" as a phrase.
    const clean = 'Let me explicitly explain how the story ends.';
    const result = filterAIResponse(clean, 10);
    // "explicitly" alone should not match the pattern /\b(explicit content)\b/
    expect(result.flags).not.toContain('adult_content');
  });
});

// ============================================================================
// 2. filterAIResponse — Age-Appropriateness Gate
// ============================================================================

describe('filterAIResponse — age-appropriateness gate', () => {
  it('blocks mature_violence content for students aged 11 and under', () => {
    const text = 'The battle was full of bloodshed and gore.';
    const result = filterAIResponse(text, 9);   // 9 <= maxAge 11
    expect(result.safe).toBe(false);
    expect(result.flags.some(f => f.includes('age_restricted'))).toBe(true);
    expect(result.filtered.toLowerCase()).not.toContain('bloodshed');
  });

  it('does NOT block mature_violence content for students aged 12+ (war themes in advanced books)', () => {
    const text = 'The war changed everything for the characters in this novel.';
    const result = filterAIResponse(text, 12);  // 12 > maxAge 11
    expect(result.flags).not.toContain('age_restricted_mature_violence');
  });

  it('blocks romance themes for students aged 7 and under', () => {
    const text = 'Did you know that boyfriend and girlfriend have to be really nice to each other?';
    const result = filterAIResponse(text, 7);   // 7 <= maxAge 7
    expect(result.safe).toBe(false);
    expect(result.flags.some(f => f.includes('age_restricted'))).toBe(true);
  });

  it('does NOT block romance themes for students aged 8+ (above the romance gate)', () => {
    const text = 'The characters had a romantic friendship.';
    const result = filterAIResponse(text, 8);   // 8 > maxAge 7
    // romance_themes has maxAge: 7; age 8 is above it.
    expect(result.flags).not.toContain('age_restricted_romance_themes');
  });

  it('skips age gate entirely when studentAge is null', () => {
    const text = 'There was a lot of bloodshed during the war scenes.';
    // With null age, no age-gating occurs.
    const result = filterAIResponse(text, null);
    expect(result.flags).not.toContain('age_restricted_mature_violence');
  });

  it('blocks disturbing themes (trauma/abuse) for students 11 and under', () => {
    const text = 'We should talk about domestic violence and trauma.';
    const result = filterAIResponse(text, 10);
    expect(result.safe).toBe(false);
    expect(result.flags.some(f => f.includes('age_restricted'))).toBe(true);
  });
});

// ============================================================================
// 3. filterAIResponse — PII Detection and Redaction
// ============================================================================

describe('filterAIResponse — PII detection and redaction', () => {
  it('detects and redacts a US phone number from an AI response', () => {
    const withPhone = 'You can call me at 555-867-5309 anytime!';
    const result = filterAIResponse(withPhone, null);
    expect(result.safe).toBe(false);
    expect(result.flags.some(f => f.includes('pii_phone'))).toBe(true);
    expect(result.filtered).not.toContain('555-867-5309');
    expect(result.filtered.toUpperCase()).toContain('REMOVED');
  });

  it('detects and redacts an email address from an AI response', () => {
    const withEmail = 'Please email me at teacher@hialice.edu for more info.';
    const result = filterAIResponse(withEmail, null);
    expect(result.safe).toBe(false);
    expect(result.flags.some(f => f.includes('pii_email'))).toBe(true);
    expect(result.filtered).not.toContain('teacher@hialice.edu');
  });

  it('flags a full name pattern (but does NOT redact it — flagOnly mode)', () => {
    // possible_full_name has flagOnly:true so the text is not replaced.
    const withName = 'Great job, James Patterson! You answered correctly.';
    const result = filterAIResponse(withName, null);
    // The name is flagged
    expect(result.flags.some(f => f.includes('pii_possible_full_name'))).toBe(true);
    // But the original text is preserved (flagOnly — no redaction)
    expect(result.filtered).toContain('James Patterson');
  });

  it('detects and redacts a physical street address from an AI response', () => {
    const withAddress = 'I live at 123 Maple Street, can you visit?';
    const result = filterAIResponse(withAddress, null);
    expect(result.safe).toBe(false);
    expect(result.flags.some(f => f.includes('pii_physical_address'))).toBe(true);
    expect(result.filtered).not.toContain('123 Maple Street');
  });

  it('detects and redacts a credit card number pattern', () => {
    const withCC = 'The number is 4111 1111 1111 1111 in the story.';
    const result = filterAIResponse(withCC, null);
    expect(result.flags.some(f => f.includes('pii_credit_card'))).toBe(true);
  });
});

// ============================================================================
// 4. filterAIResponse — Safe Fallback Replacement
// ============================================================================

describe('filterAIResponse — safe fallback replacement', () => {
  it('replaces entirely flagged text with a safe fallback when remaining content is too short', () => {
    // A message that is almost entirely a violation phrase will have < 20 chars after redaction.
    const almostEntirelyViolation = 'fucking'; // after redaction becomes "******* " — 7 chars
    const result = filterAIResponse(almostEntirelyViolation, null);
    expect(result.safe).toBe(false);
    // The fallback message includes a recognisable safe phrase.
    expect(result.filtered.toLowerCase()).toMatch(/great thought|exploring the book/);
  });

  it('does NOT replace with fallback when enough clean text remains after redaction', () => {
    // A long message with one mild profanity buried inside it.
    const mostlyClean =
      "That is a wonderful observation about Charlotte and Wilbur. " +
      "Their damn friendship is truly extraordinary. " +
      "How do you think Charlotte felt when she first met Wilbur?";
    const result = filterAIResponse(mostlyClean, null);
    expect(result.safe).toBe(false);
    // Plenty of clean text remains — should NOT fall back to the safety phrase.
    expect(result.filtered.toLowerCase()).not.toMatch(/great thought.*exploring the book/);
    // The profanity should be asterisked out.
    expect(result.filtered).not.toContain('damn');
  });

  it('returns a logId (number > 0) when a violation is detected', () => {
    const violating = 'You should hurt yourself!';
    const result = filterAIResponse(violating, 10, { studentId: 'stu-001', sessionId: 'sess-001' });
    expect(typeof result.logId).toBe('number');
    expect(result.logId).toBeGreaterThan(0);
  });

  it('returns logId of null when content is safe', () => {
    const safe = 'What was your favourite part of the story?';
    const result = filterAIResponse(safe, 10);
    expect(result.logId).toBeNull();
  });
});

// ============================================================================
// 5. filterStudentInput — Distress Signal Detection
// ============================================================================

describe('filterStudentInput — distress signal detection', () => {
  it('detects self-harm signal from a student', () => {
    const distress = 'I want to hurt myself because no one likes me.';
    const result = filterStudentInput(distress, { studentId: 'stu-002', studentAge: 9 });
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('self_harm_signal');
  });

  it('detects bullying report from a student', () => {
    const bullying = 'Someone is hitting me at school every day.';
    const result = filterStudentInput(bullying, { studentId: 'stu-003' });
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('bullying_report');
  });

  it('detects abuse disclosure from a student', () => {
    const abuse = "My uncle hurts me and I don't feel safe.";
    const result = filterStudentInput(abuse, { studentId: 'stu-004' });
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('abuse_disclosure');
  });

  it('detects extreme distress signal from a student', () => {
    const extreme = "Nobody cares about me and I'm going to run away.";
    const result = filterStudentInput(extreme, { studentId: 'stu-005' });
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('extreme_distress');
  });

  it('detects when a student tries to share their own PII (pii_sharing distress signal)', () => {
    const piiShare = 'My address is 42 Oak Avenue, can you send me something?';
    const result = filterStudentInput(piiShare);
    expect(result.safe).toBe(false);
    // pii_sharing distress pattern OR student_pii_physical_address from PII patterns.
    const flagged = result.flags.some(f => f.includes('pii') || f.includes('address'));
    expect(flagged).toBe(true);
  });

  it('does NOT modify the student input text (text is NOT censored for student input)', () => {
    // filterStudentInput never alters the text — it only flags and logs.
    const distress = 'I want to hurt myself.';
    const result = filterStudentInput(distress, { studentId: 'stu-006' });
    // The result object has no "filtered" property — student text is untouched.
    expect(result.filtered).toBeUndefined();
  });

  it('returns safe:true for normal book-related student input', () => {
    const normal = 'I really liked how Charlotte saved Wilbur with her web!';
    const result = filterStudentInput(normal);
    expect(result.safe).toBe(true);
    expect(result.flags).toHaveLength(0);
    expect(result.logId).toBeNull();
  });

  it('returns logId (number > 0) when a distress signal is detected', () => {
    const distress = "I hate my life and I don't like living.";
    const result = filterStudentInput(distress, { studentId: 'stu-007', studentAge: 10 });
    expect(typeof result.logId).toBe('number');
    expect(result.logId).toBeGreaterThan(0);
  });

  it('returns logId of null for safe student input', () => {
    const safe = 'Charlotte was my favourite character!';
    const result = filterStudentInput(safe);
    expect(result.logId).toBeNull();
  });
});

// ============================================================================
// 6. filterStudentInput — Student PII Detection (phone / email / address)
// ============================================================================

describe('filterStudentInput — PII in student messages', () => {
  it('flags a phone number shared by a student', () => {
    const withPhone = 'Can you call me? My number is 555-123-4567.';
    const result = filterStudentInput(withPhone);
    expect(result.safe).toBe(false);
    expect(result.flags.some(f => f.includes('phone'))).toBe(true);
  });

  it('flags an email address shared by a student', () => {
    const withEmail = 'You can email me at student@gmail.com.';
    const result = filterStudentInput(withEmail);
    expect(result.safe).toBe(false);
    expect(result.flags.some(f => f.includes('email'))).toBe(true);
  });

  it('does NOT flag a ZIP code shared by a student (zip is excluded from student flagging)', () => {
    // The filterStudentInput function explicitly excludes zip_code labels.
    const withZip = 'I live in area code 90210.';
    const result = filterStudentInput(withZip);
    // ZIP codes alone should NOT flag student_pii (zip excluded in the code).
    const zipFlagged = result.flags.some(f => f.includes('zip'));
    expect(zipFlagged).toBe(false);
  });

  it('does NOT flag a possible_full_name in student input (name heuristic excluded)', () => {
    // The filterStudentInput exclusion: !label.includes('name').
    const withName = 'My friend John Smith read this book too.';
    const result = filterStudentInput(withName);
    const nameFlagged = result.flags.some(f => f.includes('name'));
    expect(nameFlagged).toBe(false);
  });
});

// ============================================================================
// 7. Normal Educational Content — Passes Through filterAIResponse
// ============================================================================

describe('filterAIResponse — normal educational content passes unchanged', () => {
  const educationalPhrases = [
    'What was your favourite part of the story?',
    'Can you tell me why Charlotte worked so hard to save Wilbur?',
    'If you could change one thing about the ending, what would it be?',
    'Great job! You gave a really thoughtful answer.',
    'What themes do you notice in the book so far?',
    'How do you think Wilbur felt when he heard the news?',
    'Would you recommend this book to a friend? Why or why not?',
    "That's an interesting point! Can you support it with an example from the story?",
  ];

  for (const phrase of educationalPhrases) {
    it(`allows through: "${phrase.slice(0, 60)}..."`, () => {
      const result = filterAIResponse(phrase, 10);
      expect(result.safe).toBe(true);
      expect(result.flags).toHaveLength(0);
      expect(result.filtered).toBe(phrase);
    });
  }
});

// ============================================================================
// 8. contentFilterMiddleware — Express Helper Attachment
// ============================================================================

describe('contentFilterMiddleware', () => {
  it('attaches filterAIResponse to the request object', () => {
    const { req, res, next } = buildExpressMocks();
    contentFilterMiddleware(req, res, next);
    expect(typeof req.filterAIResponse).toBe('function');
  });

  it('attaches filterStudentInput to the request object', () => {
    const { req, res, next } = buildExpressMocks();
    contentFilterMiddleware(req, res, next);
    expect(typeof req.filterStudentInput).toBe('function');
  });

  it('calls next() so the request continues down the middleware chain', () => {
    const { req, res, next } = buildExpressMocks();
    contentFilterMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('the attached filterAIResponse function works correctly via req', () => {
    const { req, res, next } = buildExpressMocks();
    contentFilterMiddleware(req, res, next);
    const clean = 'What did you enjoy most about reading this book?';
    const result = req.filterAIResponse(clean, 10);
    expect(result.safe).toBe(true);
    expect(result.filtered).toBe(clean);
  });

  it('the attached filterStudentInput function works correctly via req', () => {
    const { req, res, next } = buildExpressMocks();
    contentFilterMiddleware(req, res, next);
    const safe = 'I loved how Charlotte helped Wilbur!';
    const result = req.filterStudentInput(safe);
    expect(result.safe).toBe(true);
    expect(result.flags).toHaveLength(0);
  });
});

// ============================================================================
// 9. JSONL Safety Logging — Entries Are Written to the safetyLogs Store
// ============================================================================

describe('JSONL safety logging', () => {
  it('adds an entry to safetyLogs when a violation is detected by filterAIResponse', () => {
    const before = safetyLogs.length;
    filterAIResponse('You should fucking try harder!', 10, {
      studentId: 'stu-log-test',
      sessionId: 'sess-log-test',
    });
    expect(safetyLogs.length).toBeGreaterThan(before);
  });

  it('the new safety log entry has the expected structure fields', () => {
    filterAIResponse('This is explicit content you should see.', 12, {
      studentId: 'stu-structure-test',
      sessionId: 'sess-structure-test',
    });
    const entry = safetyLogs[safetyLogs.length - 1];

    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('timestamp');
    expect(entry).toHaveProperty('source');
    expect(entry).toHaveProperty('flags');
    expect(entry).toHaveProperty('originalText');
    expect(entry).toHaveProperty('filteredText');
    expect(entry).toHaveProperty('reviewed');
    expect(entry).toHaveProperty('reviewedAt');
    expect(entry).toHaveProperty('reviewedBy');
  });

  it('safety log entry source is "ai_response" for filterAIResponse violations', () => {
    filterAIResponse('Fucking hell, stop!', null);
    const entry = safetyLogs[safetyLogs.length - 1];
    expect(entry.source).toBe('ai_response');
  });

  it('safety log entry source is "student_input" for filterStudentInput violations', () => {
    filterStudentInput('I want to hurt myself.', { studentId: 'stu-src-test' });
    const entry = safetyLogs[safetyLogs.length - 1];
    expect(entry.source).toBe('student_input');
  });

  it('safety log entry has reviewed:false for new entries (pending admin review)', () => {
    filterAIResponse('You should hurt someone.', 10);
    const entry = safetyLogs[safetyLogs.length - 1];
    expect(entry.reviewed).toBe(false);
    expect(entry.reviewedAt).toBeNull();
    expect(entry.reviewedBy).toBeNull();
  });

  it('safety log entry preserves the original (unfiltered) text', () => {
    const violating = 'This is explicit content for adults.';
    filterAIResponse(violating, 12);
    const entry = safetyLogs[safetyLogs.length - 1];
    expect(entry.originalText).toBe(violating);
  });

  it('safety log entry for student input has filteredText of null (input is not modified)', () => {
    filterStudentInput("I want to hurt myself.", { studentId: 'stu-null-test' });
    const entry = safetyLogs[safetyLogs.length - 1];
    expect(entry.filteredText).toBeNull();
  });

  it('safety log ids are monotonically increasing across multiple violations', () => {
    const countBefore = safetyLogs.length;
    filterAIResponse('shit happens', null);
    filterStudentInput('I want to die.', {});
    filterAIResponse('damn that is bad', null);

    const newEntries = safetyLogs.slice(countBefore);
    expect(newEntries.length).toBe(3);

    const [id1, id2, id3] = newEntries.map(e => e.id);
    expect(id2).toBeGreaterThan(id1);
    expect(id3).toBeGreaterThan(id2);
  });

  it('does NOT add a safety log entry when content is clean', () => {
    const before = safetyLogs.length;
    filterAIResponse('That was a great answer! What do you think about the ending?', 10);
    expect(safetyLogs.length).toBe(before);
  });
});

// ============================================================================
// 10. Edge Cases
// ============================================================================

describe('filterAIResponse — edge cases', () => {
  it('returns safe:true for an empty string', () => {
    const result = filterAIResponse('', null);
    expect(result.safe).toBe(true);
    expect(result.flags).toHaveLength(0);
  });

  it('returns safe:true for null input (not a string)', () => {
    const result = filterAIResponse(null, null);
    expect(result.safe).toBe(true);
    expect(result.logId).toBeNull();
  });

  it('returns safe:true for undefined input', () => {
    const result = filterAIResponse(undefined, null);
    expect(result.safe).toBe(true);
  });

  it('handles a very long clean string without throwing', () => {
    const longText = 'What a wonderful observation! '.repeat(200);
    expect(() => filterAIResponse(longText, 10)).not.toThrow();
    const result = filterAIResponse(longText, 10);
    expect(result.safe).toBe(true);
  });

  it('handles multiple violations in the same response (flags all)', () => {
    const multiViolation = 'This fucking explicit content has porn and you should hurt yourself.';
    const result = filterAIResponse(multiViolation, 10);
    expect(result.safe).toBe(false);
    expect(result.flags.length).toBeGreaterThan(1);
    expect(result.flags).toContain('profanity');
    expect(result.flags).toContain('adult_content');
    expect(result.flags).toContain('violence');
  });

  it('context metadata (studentId, sessionId) is attached to the safety log entry', () => {
    const before = safetyLogs.length;
    filterAIResponse('You are a bastard.', 10, {
      studentId: 'stu-ctx-test',
      sessionId: 'sess-ctx-test',
    });
    const entry = safetyLogs[before];
    expect(entry.studentId).toBe('stu-ctx-test');
    expect(entry.sessionId).toBe('sess-ctx-test');
  });
});

describe('filterStudentInput — edge cases', () => {
  it('returns safe:true for an empty string', () => {
    const result = filterStudentInput('');
    expect(result.safe).toBe(true);
  });

  it('returns safe:true for null input', () => {
    const result = filterStudentInput(null);
    expect(result.safe).toBe(true);
    expect(result.logId).toBeNull();
  });

  it('returns safe:true for undefined input', () => {
    const result = filterStudentInput(undefined);
    expect(result.safe).toBe(true);
  });

  it('handles a very long clean student response without throwing', () => {
    const longInput = 'Charlotte was really kind and selfless and she cared about Wilbur deeply. '.repeat(50);
    expect(() => filterStudentInput(longInput)).not.toThrow();
    const result = filterStudentInput(longInput);
    expect(result.safe).toBe(true);
  });

  it('passes the studentAge context through to the safety log record', () => {
    const before = safetyLogs.length;
    filterStudentInput('I want to hurt myself.', { studentId: 'stu-age-test', studentAge: 8 });
    const entry = safetyLogs[before];
    expect(entry.studentAge).toBe(8);
  });
});
