/**
 * contentFilter.test.js
 * Unit tests for HiAlice Context-Aware Content Safety Filter
 *
 * Run with:  node --test backend/src/middleware/contentFilter.test.js
 *
 * Uses Node.js built-in test runner (node:test) — zero external dependencies.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  filterStudentInput,
  filterAIOutput,
  detectPII,
  detectProfanity,
  getChildFriendlyMessage,
  wordCount,
  sentenceCount,
  BOOK_CONTEXT_ALLOWLIST,
  AI_RESPONSE_LIMITS,
} from './contentFilter.js';

// ============================================================================
// HELPERS
// ============================================================================

const BEGINNER_CONTEXT = { studentLevel: 'beginner', stage: 'title', bookTitle: 'Charlotte\'s Web' };
const INTERMEDIATE_CONTEXT = { studentLevel: 'intermediate', stage: 'body', bookTitle: 'Harry Potter' };
const ADVANCED_CONTEXT = { studentLevel: 'advanced', stage: 'body', bookTitle: 'The Giver' };
const NO_CONTEXT = {};

// ============================================================================
// 1. PROFANITY DETECTION
// ============================================================================

describe('Profanity Detection', () => {
  it('should detect basic profanity in student input', () => {
    const result = filterStudentInput('This book is stupid and the character is an idiot', NO_CONTEXT);
    assert.equal(result.safe, false);
    assert.ok(result.flags.some((f) => f.includes('profanity')));
    assert.ok(result.sanitized.includes('***'));
  });

  it('should detect multi-word profanity phrases', () => {
    const result = filterStudentInput('Just shut up about this book', NO_CONTEXT);
    assert.equal(result.safe, false);
    assert.ok(result.flags.some((f) => f.includes('profanity')));
  });

  it('should detect violent language', () => {
    const result = filterStudentInput('I will kill you if you ask another question', NO_CONTEXT);
    assert.equal(result.safe, false);
    assert.ok(result.flags.some((f) => f.includes('profanity:V')));
    assert.equal(result.action, 'block');
  });

  it('should block slurs for all levels', () => {
    // Slur category S should always block
    const result = filterStudentInput('That character is such a retard', ADVANCED_CONTEXT);
    assert.equal(result.safe, false);
    assert.ok(result.flags.some((f) => f.includes('profanity:S')));
    assert.equal(result.action, 'block');
  });

  it('should block sexual content references', () => {
    const result = filterStudentInput('I found some porn online', NO_CONTEXT);
    assert.equal(result.safe, false);
    assert.ok(result.flags.some((f) => f.includes('profanity:SX')));
    assert.equal(result.action, 'block');
  });

  it('should allow clean text to pass', () => {
    const result = filterStudentInput('I really liked the main character because she was brave', BEGINNER_CONTEXT);
    assert.equal(result.safe, true);
    assert.equal(result.flags.length, 0);
    assert.equal(result.action, 'allow');
  });

  it('should handle empty or null input gracefully', () => {
    assert.deepEqual(filterStudentInput('', NO_CONTEXT), { safe: true, flags: [], sanitized: '', action: 'allow' });
    assert.deepEqual(filterStudentInput(null, NO_CONTEXT), { safe: true, flags: [], sanitized: '', action: 'allow' });
    assert.deepEqual(filterStudentInput(undefined, NO_CONTEXT), { safe: true, flags: [], sanitized: '', action: 'allow' });
  });

  it('should censor profanity with asterisks of matching length', () => {
    const result = filterStudentInput('that was stupid', NO_CONTEXT);
    // "stupid" = 6 chars -> "******"
    assert.ok(result.sanitized.includes('******'));
    assert.ok(!result.sanitized.toLowerCase().includes('stupid'));
  });

  it('should be case-insensitive in profanity detection', () => {
    const result = filterStudentInput('IDIOT character', NO_CONTEXT);
    assert.ok(result.flags.some((f) => f.includes('profanity')));
  });
});

// ============================================================================
// 2. PII DETECTION
// ============================================================================

describe('PII Detection', () => {
  describe('Email addresses', () => {
    it('should detect standard email addresses', () => {
      const result = filterStudentInput('My email is kid@school.com and I like books', NO_CONTEXT);
      assert.equal(result.safe, false);
      assert.ok(result.flags.some((f) => f === 'pii:email'));
      assert.equal(result.action, 'block');
    });

    it('should detect emails with plus addressing', () => {
      const result = filterStudentInput('Send it to parent+child@gmail.com please', NO_CONTEXT);
      assert.ok(result.flags.some((f) => f === 'pii:email'));
    });

    it('should not flag non-email text', () => {
      const result = filterStudentInput('I read the book at home', NO_CONTEXT);
      assert.ok(!result.flags.some((f) => f.includes('pii:email')));
    });
  });

  describe('Phone numbers', () => {
    it('should detect US formatted phone numbers (xxx) xxx-xxxx', () => {
      const result = filterStudentInput('Call me at (555) 123-4567', NO_CONTEXT);
      assert.ok(result.flags.some((f) => f === 'pii:phone'));
      assert.equal(result.action, 'block');
    });

    it('should detect phone numbers with dashes', () => {
      const result = filterStudentInput('My number is 555-123-4567', NO_CONTEXT);
      assert.ok(result.flags.some((f) => f === 'pii:phone'));
    });

    it('should detect phone numbers with +1 prefix', () => {
      const result = filterStudentInput('Call +1 555 123 4567', NO_CONTEXT);
      assert.ok(result.flags.some((f) => f === 'pii:phone'));
    });

    it('should NOT flag short numbers like page numbers or ages', () => {
      const result = filterStudentInput('I read page 42 and I am 8 years old', NO_CONTEXT);
      assert.ok(!result.flags.some((f) => f === 'pii:phone'));
    });
  });

  describe('Physical addresses', () => {
    it('should detect street addresses', () => {
      const result = filterStudentInput('I live at 123 Main Street', NO_CONTEXT);
      assert.ok(result.flags.some((f) => f === 'pii:address'));
      assert.equal(result.action, 'block');
    });

    it('should detect various street types', () => {
      const tests = [
        '456 Oak Avenue',
        '789 Elm Boulevard',
        '321 Pine Drive',
        '100 Cedar Lane',
        '55 Maple Road',
        '12 Birch Court',
      ];
      for (const addr of tests) {
        const result = filterStudentInput(`I live at ${addr}`, NO_CONTEXT);
        assert.ok(
          result.flags.some((f) => f === 'pii:address'),
          `Expected address detection for: "${addr}"`
        );
      }
    });
  });

  describe('SSN', () => {
    it('should detect Social Security Number patterns', () => {
      const result = filterStudentInput('My number is 123-45-6789', NO_CONTEXT);
      assert.ok(result.flags.some((f) => f === 'pii:ssn'));
    });
  });

  describe('Full name disclosure', () => {
    it('should detect "my name is First Last" patterns', () => {
      const result = filterStudentInput('My name is John Smith and I like this book', NO_CONTEXT);
      assert.ok(result.flags.some((f) => f === 'pii:full_name'));
    });

    it('should detect "my full name is" pattern', () => {
      const result = filterStudentInput('My full name is Sarah Johnson', NO_CONTEXT);
      assert.ok(result.flags.some((f) => f === 'pii:full_name'));
    });

    it('should NOT flag first-name-only introductions', () => {
      // "My name is Alice" has no last name, should not flag
      const result = filterStudentInput('My name is Alice', NO_CONTEXT);
      assert.ok(!result.flags.some((f) => f === 'pii:full_name'));
    });
  });

  describe('PII sanitization', () => {
    it('should mask detected PII in sanitized output', () => {
      const result = filterStudentInput('Email me at test@example.com', NO_CONTEXT);
      assert.ok(!result.sanitized.includes('test@example.com'));
      // Should contain masked version
      assert.ok(result.sanitized.includes('*'));
    });
  });
});

// ============================================================================
// 3. DISTRESS SIGNAL DETECTION
// ============================================================================

describe('Distress Signal Detection', () => {
  describe('Critical distress (Tier 1)', () => {
    it('should escalate self-harm language', () => {
      const result = filterStudentInput('I want to hurt myself', NO_CONTEXT);
      // self-harm pattern
      const result2 = filterStudentInput('I have been cutting myself', NO_CONTEXT);
      assert.equal(result2.action, 'escalate');
      assert.ok(result2.flags.some((f) => f === 'distress:critical'));
    });

    it('should escalate suicide references', () => {
      const result = filterStudentInput('I have been thinking about suicide', NO_CONTEXT);
      assert.equal(result.action, 'escalate');
      assert.ok(result.flags.some((f) => f === 'distress:critical'));
    });

    it('should escalate abuse mentions', () => {
      const result = filterStudentInput('My uncle has been abusing me', NO_CONTEXT);
      assert.equal(result.action, 'escalate');
      assert.ok(result.flags.some((f) => f === 'distress:critical'));
    });

    it('should escalate physical violence against child', () => {
      const result = filterStudentInput('My dad hits me every day', NO_CONTEXT);
      assert.equal(result.action, 'escalate');
    });

    it('should escalate "want to die" signals', () => {
      const result = filterStudentInput('I want to die', NO_CONTEXT);
      assert.equal(result.action, 'escalate');
    });

    it('should escalate "want to disappear" signals', () => {
      const result = filterStudentInput('I wish to disappear from this world', NO_CONTEXT);
      assert.equal(result.action, 'escalate');
    });

    it('should escalate runaway mentions', () => {
      const result = filterStudentInput('I want to run away from home', NO_CONTEXT);
      assert.equal(result.action, 'escalate');
    });
  });

  describe('Concern-level distress (Tier 2)', () => {
    it('should escalate concern signals for beginners', () => {
      const result = filterStudentInput('Nobody likes me at school', BEGINNER_CONTEXT);
      assert.equal(result.action, 'escalate');
      assert.ok(result.flags.some((f) => f === 'distress:concern'));
    });

    it('should warn (not escalate) concern signals for intermediate/advanced', () => {
      const result = filterStudentInput('Nobody likes me at school', INTERMEDIATE_CONTEXT);
      assert.equal(result.action, 'warn');
      assert.ok(result.flags.some((f) => f === 'distress:concern'));
    });

    it('should detect loneliness signals', () => {
      const result = filterStudentInput("I'm all alone and no one cares", NO_CONTEXT);
      // Default level is beginner when no context
      assert.ok(result.flags.some((f) => f.includes('distress')));
    });
  });

  describe('Non-distress emotional language', () => {
    it('should allow normal emotional discussion about books', () => {
      const result = filterStudentInput(
        'The character felt sad when her friend moved away',
        INTERMEDIATE_CONTEXT
      );
      assert.equal(result.action, 'allow');
    });

    it('should allow discussing scary elements in books', () => {
      const result = filterStudentInput(
        'The part with the ghost was really scary',
        INTERMEDIATE_CONTEXT
      );
      assert.equal(result.action, 'allow');
    });
  });
});

// ============================================================================
// 4. CONTEXT-AWARE FILTERING
// ============================================================================

describe('Context-Aware Filtering', () => {
  describe('Book-context emotional vocabulary', () => {
    it('should allow "kill" in book context for intermediate students', () => {
      const result = filterStudentInput(
        'The wolf killed the three pigs in the story',
        INTERMEDIATE_CONTEXT
      );
      // "kill" is in BOOK_CONTEXT_ALLOWLIST and category V
      // For intermediate with book context, the allowlist applies only for non-V
      // Since "kill" is not in the decoded word list as a standalone (it's "kill you"),
      // this should pass
      assert.equal(result.action, 'allow');
    });

    it('should allow "stupid" in book context for intermediate students', () => {
      const result = filterStudentInput(
        'I think the decision the character made was stupid',
        INTERMEDIATE_CONTEXT
      );
      assert.equal(result.action, 'allow');
    });

    it('should still block "stupid" for beginners even in book context', () => {
      const result = filterStudentInput(
        'I think the character was stupid',
        BEGINNER_CONTEXT
      );
      // Beginner + mild profanity in book context = still flagged
      assert.ok(result.flags.some((f) => f.includes('profanity')));
    });

    it('should allow literary emotions: sad, scared, angry', () => {
      const emotions = ['sad', 'scared', 'angry', 'afraid', 'lonely', 'jealous'];
      for (const emotion of emotions) {
        const result = filterStudentInput(
          `The character felt ${emotion} in the story`,
          INTERMEDIATE_CONTEXT
        );
        assert.equal(result.action, 'allow', `Expected "${emotion}" to be allowed in book context`);
      }
    });

    it('should allow "hell" for advanced students discussing literature', () => {
      const result = filterStudentInput(
        'The author describes it as a living hell',
        ADVANCED_CONTEXT
      );
      assert.equal(result.action, 'allow');
    });
  });

  describe('Level-based strictness', () => {
    it('should be stricter for beginner level', () => {
      // Same text, different levels
      const text = 'This is such a dumb book';
      const beginnerResult = filterStudentInput(text, BEGINNER_CONTEXT);
      const advancedResult = filterStudentInput(text, ADVANCED_CONTEXT);

      // Beginner should block mild profanity; advanced should warn or allow
      assert.ok(
        beginnerResult.action === 'block' || beginnerResult.action === 'warn',
        'Beginner should be more restrictive'
      );
    });

    it('should block concern-level distress for beginners but warn for others', () => {
      const text = "I don't have any friends";
      const beginnerResult = filterStudentInput(text, BEGINNER_CONTEXT);
      const advancedResult = filterStudentInput(text, ADVANCED_CONTEXT);

      assert.equal(beginnerResult.action, 'escalate');
      assert.equal(advancedResult.action, 'warn');
    });
  });

  describe('Stage-based awareness', () => {
    it('should recognize book context from stage alone', () => {
      const result = filterStudentInput(
        'The character felt dumb for making that mistake',
        { studentLevel: 'intermediate', stage: 'body' }
      );
      // With stage context (no explicit bookTitle), should still recognize book context
      assert.equal(result.action, 'allow');
    });

    it('should recognize book context from bookTitle alone', () => {
      const result = filterStudentInput(
        'The villain was a real jerk in this part',
        { studentLevel: 'intermediate', bookTitle: 'The BFG' }
      );
      // "jerk" in book context for intermediate = allowed
      assert.equal(result.action, 'allow');
    });
  });
});

// ============================================================================
// 5. AI OUTPUT FILTERING
// ============================================================================

describe('AI Output Filtering', () => {
  it('should pass clean, on-topic AI responses', () => {
    const response = "That's a wonderful observation about the character! Can you tell me more about why you think she was brave?";
    const result = filterAIOutput(response, BEGINNER_CONTEXT);
    assert.equal(result.safe, true);
    assert.equal(result.flags.length, 0);
  });

  it('should detect PII leakage in AI output', () => {
    const response = "Your parent's email parent@example.com shows they signed up for updates. Now, what did you think about the story?";
    const result = filterAIOutput(response, INTERMEDIATE_CONTEXT);
    assert.ok(result.flags.some((f) => f.includes('ai_pii_leak')));
    assert.ok(result.filtered.includes('[REDACTED]'));
    assert.ok(!result.filtered.includes('parent@example.com'));
  });

  it('should detect inappropriate words in AI output', () => {
    const response = "That character was a real idiot for making that choice. What do you think?";
    const result = filterAIOutput(response, BEGINNER_CONTEXT);
    assert.ok(result.flags.some((f) => f.includes('ai_inappropriate')));
  });

  it('should flag off-topic AI responses', () => {
    const response = "The weather today is sunny. I ate pasta for lunch earlier.";
    const result = filterAIOutput(response, INTERMEDIATE_CONTEXT);
    assert.ok(result.flags.some((f) => f === 'ai_off_topic'));
  });

  it('should flag responses that are too long for beginner level', () => {
    // Generate a response that exceeds beginner limits (80 words)
    const longWords = Array(100).fill('wonderful').join(' ');
    const response = `That is a great point about the book! ${longWords}`;
    const result = filterAIOutput(response, BEGINNER_CONTEXT);
    assert.ok(result.flags.some((f) => f.includes('ai_too_long')));
    // Should be truncated
    const filteredWordCount = wordCount(result.filtered);
    assert.ok(filteredWordCount <= AI_RESPONSE_LIMITS.beginner.maxWords + 25); // allow margin for sentence boundary
  });

  it('should flag responses that are too short', () => {
    const response = "Yes.";
    const result = filterAIOutput(response, INTERMEDIATE_CONTEXT);
    assert.ok(result.flags.some((f) => f.includes('ai_too_short')));
  });

  it('should flag non-Socratic answer-giving patterns', () => {
    const response = "The correct answer is that the character was lonely. Now tell me what you think.";
    const result = filterAIOutput(response, INTERMEDIATE_CONTEXT);
    assert.ok(result.flags.some((f) => f === 'ai_non_socratic'));
  });

  it('should flag "that is wrong" patterns', () => {
    const response = "That's wrong. The character did not feel happy. Think about the story again.";
    const result = filterAIOutput(response, INTERMEDIATE_CONTEXT);
    assert.ok(result.flags.some((f) => f === 'ai_non_socratic'));
  });

  it('should allow longer responses for advanced students', () => {
    const words = Array(300).fill('wonderful').join(' ');
    const response = `Great analysis of the theme! ${words}`;
    const resultBeginner = filterAIOutput(response, BEGINNER_CONTEXT);
    const resultAdvanced = filterAIOutput(response, ADVANCED_CONTEXT);

    // Both should flag as too long, but advanced truncation threshold is higher
    assert.ok(resultBeginner.flags.some((f) => f.includes('ai_too_long')));
    assert.ok(resultAdvanced.flags.some((f) => f.includes('ai_too_long')));

    const beginnerWords = wordCount(resultBeginner.filtered);
    const advancedWords = wordCount(resultAdvanced.filtered);
    assert.ok(advancedWords >= beginnerWords, 'Advanced should allow longer responses');
  });

  it('should handle empty AI output gracefully', () => {
    const result = filterAIOutput('', BEGINNER_CONTEXT);
    assert.equal(result.safe, true);
    assert.equal(result.filtered, '');
  });
});

// ============================================================================
// 6. COMBINED SCENARIOS
// ============================================================================

describe('Combined Threat Scenarios', () => {
  it('should prioritize escalation over block for distress + profanity', () => {
    const result = filterStudentInput('I want to die, this stupid world', NO_CONTEXT);
    assert.equal(result.action, 'escalate');
    assert.ok(result.flags.some((f) => f.includes('distress:critical')));
  });

  it('should handle PII + profanity together', () => {
    const result = filterStudentInput('My email is kid@bad.com and this is stupid', NO_CONTEXT);
    assert.ok(result.flags.some((f) => f.includes('pii:email')));
    assert.ok(result.flags.some((f) => f.includes('profanity')));
    // PII should block, profanity is secondary
    assert.ok(result.action === 'block' || result.action === 'escalate');
  });

  it('should handle PII + distress together', () => {
    const result = filterStudentInput('I want to die, call me at 555-123-4567', NO_CONTEXT);
    assert.equal(result.action, 'escalate');
    assert.ok(result.flags.some((f) => f.includes('distress:critical')));
    assert.ok(result.flags.some((f) => f.includes('pii:phone')));
  });
});

// ============================================================================
// 7. CHILD-FRIENDLY MESSAGES
// ============================================================================

describe('Child-Friendly Messages', () => {
  it('should return age-appropriate escalation message for beginners', () => {
    const msg = getChildFriendlyMessage('escalate', 'beginner');
    assert.ok(msg.includes('grown-up'));
    assert.ok(msg.length > 20);
  });

  it('should return more mature escalation message for advanced', () => {
    const msg = getChildFriendlyMessage('escalate', 'advanced');
    assert.ok(msg.includes('parent') || msg.includes('teacher') || msg.includes('adult'));
  });

  it('should return kind block message for beginners', () => {
    const msg = getChildFriendlyMessage('block', 'beginner');
    assert.ok(msg.includes('kind') || msg.includes('friendly'));
  });

  it('should return respectful block message for advanced', () => {
    const msg = getChildFriendlyMessage('block', 'advanced');
    assert.ok(msg.includes('respectful') || msg.includes('rephrase'));
  });
});

// ============================================================================
// 8. UTILITY FUNCTIONS
// ============================================================================

describe('Utility Functions', () => {
  it('wordCount should accurately count words', () => {
    assert.equal(wordCount('hello world'), 2);
    assert.equal(wordCount('  one  two  three  '), 3);
    assert.equal(wordCount('single'), 1);
    assert.equal(wordCount(''), 0);
  });

  it('sentenceCount should count sentence-ending punctuation', () => {
    assert.equal(sentenceCount('Hello. World.'), 2);
    assert.equal(sentenceCount('Wow! Really? Yes.'), 3);
    assert.equal(sentenceCount('No punctuation here'), 1);
  });
});

// ============================================================================
// 9. INTERNAL FUNCTION: detectPII
// ============================================================================

describe('detectPII internal function', () => {
  it('should return empty array for clean text', () => {
    const result = detectPII('I enjoyed reading this book');
    assert.equal(result.length, 0);
  });

  it('should find multiple PII types in one string', () => {
    const result = detectPII('Email me at test@test.com, call 555-123-4567, I live at 123 Oak Street');
    const types = result.map((r) => r.type);
    assert.ok(types.includes('email'));
    assert.ok(types.includes('phone'));
    assert.ok(types.includes('address'));
  });
});

// ============================================================================
// 10. INTERNAL FUNCTION: detectProfanity
// ============================================================================

describe('detectProfanity internal function', () => {
  it('should return empty array for clean text', () => {
    const result = detectProfanity('The book was wonderful', false, 'beginner');
    assert.equal(result.length, 0);
  });

  it('should detect profanity without book context', () => {
    const result = detectProfanity('that was stupid', false, 'beginner');
    assert.ok(result.length > 0);
    assert.ok(result.some((r) => r.word === 'stupid'));
  });

  it('should allow book-context words for intermediate level', () => {
    const result = detectProfanity('the decision was stupid', true, 'intermediate');
    assert.equal(result.length, 0, 'Expected "stupid" to be allowed in book context for intermediate');
  });

  it('should still flag book-context words for beginner level', () => {
    const result = detectProfanity('the decision was stupid', true, 'beginner');
    assert.ok(result.length > 0, 'Expected "stupid" to be flagged for beginners even in book context');
  });
});

// ============================================================================
// 11. EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle very long input without crashing', () => {
    const longText = 'I really enjoyed reading this amazing book. '.repeat(500);
    const result = filterStudentInput(longText, INTERMEDIATE_CONTEXT);
    assert.equal(result.action, 'allow');
  });

  it('should handle special characters and unicode', () => {
    const result = filterStudentInput('I liked the book! It was great!!!', BEGINNER_CONTEXT);
    assert.equal(result.action, 'allow');
  });

  it('should handle mixed case and spacing in PII', () => {
    const result = filterStudentInput('my email is TEST@EXAMPLE.COM', NO_CONTEXT);
    assert.ok(result.flags.some((f) => f === 'pii:email'));
  });

  it('should not flag book-related numbers as phone numbers', () => {
    const result = filterStudentInput('I read pages 1 to 50 of the book', INTERMEDIATE_CONTEXT);
    assert.ok(!result.flags.some((f) => f === 'pii:phone'));
  });

  it('should not flag age mentions as PII', () => {
    const result = filterStudentInput('I am 9 years old and I like this book', BEGINNER_CONTEXT);
    assert.ok(!result.flags.some((f) => f === 'pii:phone'));
  });

  it('should return the original text as sanitized when input is clean', () => {
    const text = 'The main character was very brave and kind';
    const result = filterStudentInput(text, INTERMEDIATE_CONTEXT);
    assert.equal(result.sanitized, text);
  });

  it('should handle context with missing fields gracefully', () => {
    const result = filterStudentInput('Hello there', { studentLevel: 'advanced' });
    assert.equal(result.action, 'allow');
  });

  it('should handle context as empty object', () => {
    const result = filterStudentInput('Hello there', {});
    assert.equal(result.action, 'allow');
  });

  it('should handle non-string input types', () => {
    const result = filterStudentInput(12345, NO_CONTEXT);
    assert.equal(result.safe, true);
  });
});

// ============================================================================
// 12. BOOK_CONTEXT_ALLOWLIST COVERAGE
// ============================================================================

describe('Book Context Allowlist', () => {
  it('should contain expected emotional vocabulary', () => {
    const expected = ['sad', 'scared', 'angry', 'afraid', 'lonely', 'evil', 'villain', 'monster'];
    for (const word of expected) {
      assert.ok(BOOK_CONTEXT_ALLOWLIST.has(word), `Expected "${word}" in allowlist`);
    }
  });

  it('should contain narrative action words', () => {
    const expected = ['fight', 'battle', 'destroy', 'war'];
    for (const word of expected) {
      assert.ok(BOOK_CONTEXT_ALLOWLIST.has(word), `Expected "${word}" in allowlist`);
    }
  });
});

// ============================================================================
// 13. AI RESPONSE LIMITS
// ============================================================================

describe('AI Response Limits', () => {
  it('should have limits defined for all student levels', () => {
    assert.ok(AI_RESPONSE_LIMITS.beginner);
    assert.ok(AI_RESPONSE_LIMITS.intermediate);
    assert.ok(AI_RESPONSE_LIMITS.advanced);
  });

  it('should have progressively higher word limits for higher levels', () => {
    assert.ok(AI_RESPONSE_LIMITS.beginner.maxWords < AI_RESPONSE_LIMITS.intermediate.maxWords);
    assert.ok(AI_RESPONSE_LIMITS.intermediate.maxWords < AI_RESPONSE_LIMITS.advanced.maxWords);
  });

  it('should have progressively higher sentence limits for higher levels', () => {
    assert.ok(AI_RESPONSE_LIMITS.beginner.maxSentences < AI_RESPONSE_LIMITS.intermediate.maxSentences);
    assert.ok(AI_RESPONSE_LIMITS.intermediate.maxSentences < AI_RESPONSE_LIMITS.advanced.maxSentences);
  });
});
