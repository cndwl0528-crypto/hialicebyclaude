/**
 * aiQualityEval.test.js
 * HiAlice — AI Prompt Quality Evaluation Tests
 *
 * These tests verify the OUTPUT strings produced by the prompt-builder
 * functions in prompts.js.  No Claude API calls are made — every assertion
 * inspects the raw text that would be sent to the model, so the suite runs
 * in milliseconds and requires no network access.
 *
 * Coverage areas:
 *   1. Prompt Safety            — critical safety phrases and adult-content absence
 *   2. Level Appropriateness    — vocabulary and complexity constraints per level
 *   3. Response Format          — structural expectations for feedback/utility prompts
 *   4. Stage Progression        — each stage produces distinct, stage-appropriate content
 *   5. T.E.A.A. Framework       — phase definitions, level guidance, and integration
 */

import { describe, it, expect } from 'vitest';
import {
  getSystemPrompt,
  getSessionFeedbackPrompt,
  getStageInstructions,
  getDepthScaffoldingPrompt,
  isShortAnswer,
  getShortAnswerFollowUp,
  getMetacognitivePrompt,
  getRephrasePrompt,
} from '../alice/prompts.js';

// ============================================================================
// Shared test fixtures
// ============================================================================

const SAMPLE_BOOK = {
  title: 'Charlotte\'s Web',
  author: 'E.B. White',
  synopsis: 'A young pig named Wilbur befriends a spider called Charlotte who saves his life.',
  key_themes: ['friendship', 'loyalty', 'sacrifice'],
  emotional_keywords: ['wonder', 'sadness', 'joy'],
  key_characters: [
    { name: 'Charlotte', trait: 'wise and selfless' },
    { name: 'Wilbur', trait: 'innocent and loving' },
  ],
  moral_lesson: 'True friendship means giving without expectation of return.',
};

const SIMPLE_BOOK_TITLE = 'The Very Hungry Caterpillar';
const STUDENT_NAME = 'Emma';

// ============================================================================
// 1. PROMPT SAFETY TESTS
// ============================================================================

describe('Prompt Safety', () => {
  const levels = ['beginner', 'intermediate', 'advanced'];
  const stages = ['title', 'introduction', 'body', 'conclusion'];

  it('every level/stage combination includes the word "Socratic" in the system prompt', () => {
    for (const level of levels) {
      for (const stage of stages) {
        const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, level, stage, 1);
        expect(
          prompt.toLowerCase(),
          `Expected "socratic" in ${level}/${stage} prompt`
        ).toContain('socratic');
      }
    }
  });

  it('system prompt contains age-appropriate language guidance (CONTENT SAFETY section)', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'title', 1);
    // The CONTENT SAFETY block explicitly calls out the 6-13 age range.
    expect(prompt).toMatch(/6.?13/);
    expect(prompt.toUpperCase()).toContain('CONTENT SAFETY');
  });

  it('system prompt includes response length restriction (max response)', () => {
    const levels = ['beginner', 'intermediate', 'advanced'];
    for (const level of levels) {
      const prompt = getSystemPrompt(SIMPLE_BOOK_TITLE, STUDENT_NAME, level, 'title', 1);
      expect(
        prompt.toLowerCase(),
        `Expected "max response" in ${level} prompt`
      ).toContain('max response');
    }
  });

  it('system prompt does NOT contain adult content keywords', () => {
    const adultKeywords = ['sex', 'porn', 'nude', 'naked', 'erotic', 'explicit content'];
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'advanced', 'conclusion', 3);
    for (const keyword of adultKeywords) {
      expect(
        prompt.toLowerCase(),
        `System prompt must not contain adult keyword: "${keyword}"`
      ).not.toContain(keyword);
    }
  });

  it('system prompt instructs Alice never to give direct answers (no-answer-giving rule)', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'body', 2);
    // The SOCRATIC METHOD block starts with "NEVER give answers directly"
    expect(prompt.toUpperCase()).toMatch(/NEVER give answers directly/i);
  });

  it('system prompt forbids asking for personal identifying information', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'beginner', 'title', 1);
    // The CONTENT SAFETY block tells Alice never to ask for personal info.
    expect(prompt.toLowerCase()).toContain('personal information');
  });

  it('system prompt provides a distress-signal redirect response for concerning student input', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'body', 1);
    // Must include instruction about handling danger/distress mentions.
    expect(prompt.toLowerCase()).toMatch(/trusted adult|distress|danger|concerning/);
  });

  it('metacognitive prompt does not introduce new adult or off-topic content', () => {
    const metaPrompt = getMetacognitivePrompt(STUDENT_NAME, SAMPLE_BOOK.title, 'beginner');
    const forbidden = ['sex', 'violence', 'adult', 'porn', 'explicit'];
    for (const word of forbidden) {
      expect(metaPrompt.toLowerCase()).not.toContain(word);
    }
  });
});

// ============================================================================
// 2. LEVEL APPROPRIATENESS TESTS
// ============================================================================

describe('Level Appropriateness', () => {
  it('beginner system prompt references the 6-8 age range', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'beginner', 'title', 1);
    expect(prompt).toContain('6-8');
  });

  it('intermediate system prompt references the 9-11 age range', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'title', 1);
    expect(prompt).toContain('9-11');
  });

  it('advanced system prompt references the 12-13 age range', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'advanced', 'title', 1);
    expect(prompt).toContain('12-13');
  });

  it('beginner prompt instructs Alice to use only the 1000 most common words', () => {
    const prompt = getSystemPrompt(SIMPLE_BOOK_TITLE, STUDENT_NAME, 'beginner', 'introduction', 1);
    expect(prompt).toContain('1000');
    expect(prompt.toLowerCase()).toContain('common english words');
  });

  it('beginner prompt has a max response limit of 20 words', () => {
    const prompt = getSystemPrompt(SIMPLE_BOOK_TITLE, STUDENT_NAME, 'beginner', 'title', 1);
    expect(prompt).toContain('20');
  });

  it('advanced prompt instructs Alice to ask analytical and inferential questions', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'advanced', 'body', 2);
    expect(prompt.toLowerCase()).toMatch(/analytic|inferential|evidence-based/);
  });

  it('advanced prompt contains critical thinking directive keywords', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'advanced', 'conclusion', 3);
    const criticalKeywords = ['analyze', 'evaluate', 'compare', 'evidence', 'support'];
    const promptLower = prompt.toLowerCase();
    const found = criticalKeywords.some(kw => promptLower.includes(kw));
    expect(found, `Expected at least one critical thinking keyword (${criticalKeywords.join(', ')})`).toBe(true);
  });

  it('each level produces a distinct system prompt (prompts are not identical)', () => {
    const beginner     = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'beginner',     'title', 1);
    const intermediate = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'title', 1);
    const advanced     = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'advanced',     'title', 1);

    expect(beginner).not.toBe(intermediate);
    expect(intermediate).not.toBe(advanced);
    expect(beginner).not.toBe(advanced);
  });

  it('beginner prompt includes YES/NO or choice-based answer acceptance language', () => {
    const prompt = getSystemPrompt(SIMPLE_BOOK_TITLE, STUDENT_NAME, 'beginner', 'introduction', 1);
    // LEVEL_RULES.beginner.answerExpectation includes YES/NO language.
    expect(prompt.toUpperCase()).toMatch(/YES\/NO|YES.NO/);
  });

  it('advanced prompt mentions textual evidence expectation', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'advanced', 'body', 3);
    expect(prompt.toLowerCase()).toContain('evidence');
  });

  it('rephrase prompt for beginner instructs offering A or B choices', () => {
    const prompt = getRephrasePrompt('What did you think of the story?', STUDENT_NAME, 'beginner', SIMPLE_BOOK_TITLE);
    expect(prompt.toLowerCase()).toMatch(/choice|a or b|beginners.*choice/i);
  });

  it('short-answer thresholds are correctly ordered: beginner < intermediate < advanced', () => {
    // isShortAnswer returns true when word count is BELOW the threshold.
    // Beginner threshold: 5 words; intermediate: 10; advanced: 15.
    const fiveWordResponse  = 'I like the book very';           // 5 words
    const tenWordResponse   = 'I really enjoyed this story and the main character was fun'; // 10 words
    const fifteenWordResponse = 'I really enjoyed this story and the main character was great I loved every moment reading it'; // 16 words

    // 5 words is short for intermediate (needs 10) and advanced (needs 15), but not beginner (needs 5 — boundary).
    expect(isShortAnswer(fiveWordResponse, 'intermediate')).toBe(true);
    expect(isShortAnswer(fiveWordResponse, 'advanced')).toBe(true);

    // 10 words is not short for intermediate (exactly at threshold — actually < 10 is short, so 10 words is fine).
    expect(isShortAnswer(tenWordResponse, 'beginner')).toBe(false);

    // 16 words clears all thresholds.
    expect(isShortAnswer(fifteenWordResponse, 'advanced')).toBe(false);
  });
});

// ============================================================================
// 3. RESPONSE FORMAT TESTS
// ============================================================================

describe('Response Format', () => {
  it('session feedback prompt requests plain text with no markdown', () => {
    const feedbackPrompt = getSessionFeedbackPrompt({
      student: { name: STUDENT_NAME, level: 'intermediate' },
      book:    { title: SAMPLE_BOOK.title },
      dialogues: [
        { speaker: 'student', content: 'I think Charlotte was very brave and kind.' },
        { speaker: 'alice',   content: 'That is a wonderful observation!' },
      ],
      levelScore: 85,
      grammarScore: 78,
    });

    // Must explicitly forbid markdown
    expect(feedbackPrompt.toLowerCase()).toContain('no markdown');
    // Must include a word-count cap
    expect(feedbackPrompt).toMatch(/\d+\s+words/i);
  });

  it('session feedback prompt includes the student name and book title', () => {
    const feedbackPrompt = getSessionFeedbackPrompt({
      student: { name: STUDENT_NAME, level: 'beginner' },
      book:    { title: SIMPLE_BOOK_TITLE },
      dialogues: [],
      levelScore: 60,
      grammarScore: 55,
    });

    expect(feedbackPrompt).toContain(STUDENT_NAME);
    expect(feedbackPrompt).toContain(SIMPLE_BOOK_TITLE);
  });

  it('session feedback prompt injects actual student dialogue responses', () => {
    const studentResponse = 'The caterpillar was very hungry and ate everything!';
    const feedbackPrompt = getSessionFeedbackPrompt({
      student: { name: STUDENT_NAME, level: 'beginner' },
      book:    { title: SIMPLE_BOOK_TITLE },
      dialogues: [
        { speaker: 'student', content: studentResponse },
      ],
      levelScore: 70,
      grammarScore: 65,
    });

    // The actual student quote should appear in the prompt so the model can reference it.
    expect(feedbackPrompt).toContain(studentResponse);
  });

  it('session feedback prompt filters out alice (non-student) dialogue turns', () => {
    const feedbackPrompt = getSessionFeedbackPrompt({
      student: { name: STUDENT_NAME, level: 'intermediate' },
      book:    { title: SAMPLE_BOOK.title },
      dialogues: [
        { speaker: 'alice',   content: 'Tell me more about Charlotte.' },
        { speaker: 'student', content: 'She was smart and caring.' },
      ],
      levelScore: 80,
      grammarScore: 75,
    });

    // Alice's turn should NOT appear in the responses block.
    expect(feedbackPrompt).not.toContain('Tell me more about Charlotte.');
    // Student's turn should appear.
    expect(feedbackPrompt).toContain('She was smart and caring.');
  });

  it('depth scaffolding prompt contains the depth label in uppercase', () => {
    const depths = ['surface', 'developing', 'analytical', 'deep'];
    for (const depth of depths) {
      const scaffolding = getDepthScaffoldingPrompt(depth, 'intermediate', []);
      expect(
        scaffolding.toUpperCase(),
        `Expected depth label "${depth.toUpperCase()}" in scaffolding for depth "${depth}"`
      ).toContain(depth.toUpperCase());
    }
  });

  it('depth scaffolding prompt mentions detected strength indicators when provided', () => {
    const indicators = ['causal_reasoning', 'personal_connection'];
    const scaffolding = getDepthScaffoldingPrompt('developing', 'intermediate', indicators);
    // The strengths line uses "causal reasoning" and "made a personal connection" labels.
    expect(scaffolding.toLowerCase()).toMatch(/causal reasoning|personal connection/);
    expect(scaffolding.toUpperCase()).toContain('STUDENT STRENGTHS DETECTED');
  });

  it('depth scaffolding prompt does not throw for unknown depth values (graceful fallback)', () => {
    expect(() => getDepthScaffoldingPrompt('nonexistent_depth', 'intermediate', [])).not.toThrow();
    const result = getDepthScaffoldingPrompt('nonexistent_depth', 'intermediate', []);
    // Falls back to "surface" — should still return a non-empty string.
    expect(result.length).toBeGreaterThan(0);
  });

  it('getShortAnswerFollowUp returns a non-empty string for each level', () => {
    const levels = ['beginner', 'intermediate', 'advanced'];
    for (const level of levels) {
      const followUp = getShortAnswerFollowUp(level);
      expect(typeof followUp).toBe('string');
      expect(followUp.trim().length).toBeGreaterThan(0);
    }
  });

  it('getShortAnswerFollowUp returns a fallback (not throw) for an unknown level', () => {
    expect(() => getShortAnswerFollowUp('unknown_level')).not.toThrow();
    const result = getShortAnswerFollowUp('unknown_level');
    expect(typeof result).toBe('string');
    expect(result.trim().length).toBeGreaterThan(0);
  });

  it('metacognitive prompt includes exactly two self-reflection questions', () => {
    const metaPrompt = getMetacognitivePrompt(STUDENT_NAME, SAMPLE_BOOK.title, 'advanced');
    // Prompt defines "Question 1" and "Question 2".
    expect(metaPrompt).toContain('Question 1');
    expect(metaPrompt).toContain('Question 2');
    // Should NOT contain a "Question 3".
    expect(metaPrompt).not.toContain('Question 3');
  });

  it('metacognitive prompt includes the book title and student name', () => {
    const metaPrompt = getMetacognitivePrompt(STUDENT_NAME, SAMPLE_BOOK.title, 'intermediate');
    expect(metaPrompt).toContain(STUDENT_NAME);
    expect(metaPrompt).toContain(SAMPLE_BOOK.title);
  });

  it('rephrase prompt returns single-question instructions (not a full session prompt)', () => {
    const original = 'What themes did you notice in the story?';
    const rephrasePrompt = getRephrasePrompt(original, STUDENT_NAME, 'beginner', SIMPLE_BOOK_TITLE);
    // Must include the original question text.
    expect(rephrasePrompt).toContain(original);
    // Must instruct model to return only the rephrased question.
    expect(rephrasePrompt.toLowerCase()).toMatch(/return only|only the rephrased|no explanation|no preamble/);
  });
});

// ============================================================================
// 4. STAGE PROGRESSION TESTS
// ============================================================================

describe('Stage Progression', () => {
  it('title stage prompt focuses on first impressions / title interpretation', () => {
    const stageGuide = getStageInstructions('title');
    expect(stageGuide.focus.toLowerCase()).toMatch(/first impression|title/);
  });

  it('body stage prompt explicitly mentions three reasons / 3 sub-questions', () => {
    const stageGuide = getStageInstructions('body');
    // The body instructions contain "3" (as in 3 reasons).
    const allText = (stageGuide.instructions || []).join(' ') + stageGuide.focus;
    expect(allText).toMatch(/3|three/i);
  });

  it('conclusion stage prompt asks for personal opinion / recommendation', () => {
    const stageGuide = getStageInstructions('conclusion');
    const allText = (stageGuide.instructions || []).join(' ') + stageGuide.focus;
    expect(allText.toLowerCase()).toMatch(/personal|recommend|feel|meaning/);
  });

  it('introduction stage prompt focuses on character empathy or setting', () => {
    const stageGuide = getStageInstructions('introduction');
    const allText = (stageGuide.instructions || []).join(' ') + stageGuide.focus;
    expect(allText.toLowerCase()).toMatch(/character|empathy|setting/);
  });

  it('each stage has a distinct focus field (no two stages share the same focus)', () => {
    const stages = ['warm_connection', 'title', 'introduction', 'body', 'conclusion', 'cross_book'];
    const foci = stages.map(s => getStageInstructions(s).focus);
    const uniqueFoci = new Set(foci);
    expect(uniqueFoci.size).toBe(stages.length);
  });

  it('body stage system prompt (turn 1) contains emotion-focused sub-question directive', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'body', 1);
    // The BODY STAGE section calls out "Turn 1/3" and directs to the emotion sub-question.
    expect(prompt).toContain('BODY STAGE');
    expect(prompt).toContain('Turn 1/3');
  });

  it('body stage system prompt (turn 2) references creativity follow-up style', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'body', 2);
    expect(prompt).toContain('Creativity');
  });

  it('body stage system prompt (turn 3) references life lesson follow-up style', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'body', 3);
    expect(prompt).toContain('Lesson');
  });

  it('title and conclusion stage system prompts are distinct from each other', () => {
    const titlePrompt      = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'title', 1);
    const conclusionPrompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'conclusion', 1);
    expect(titlePrompt).not.toBe(conclusionPrompt);
  });

  it('title stage system prompt references title interpretation focus', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'title', 1);
    expect(prompt.toLowerCase()).toMatch(/title|first impression/);
    // The STAGE-SPECIFIC FOCUS line includes the stage name.
    expect(prompt.toUpperCase()).toContain('TITLE');
  });

  it('conclusion stage system prompt references personal meaning or recommendation', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'conclusion', 1);
    expect(prompt.toLowerCase()).toMatch(/personal|recommend|meaning|lasting/);
  });

  it('warm_connection stage system prompt references prior knowledge / rapport', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'beginner', 'warm_connection', 1);
    expect(prompt.toLowerCase()).toMatch(/rapport|prior knowledge|excited|safe/);
  });

  it('cross_book stage instructions mention comparing books or reading identity', () => {
    const stageGuide = getStageInstructions('cross_book');
    const allText = (stageGuide.instructions || []).join(' ') + stageGuide.focus;
    expect(allText.toLowerCase()).toMatch(/compare|another book|reading identity|reader/);
  });

  it('each stage has a maxTurns value of 3', () => {
    const stages = ['warm_connection', 'title', 'introduction', 'body', 'conclusion', 'cross_book'];
    for (const stage of stages) {
      const guide = getStageInstructions(stage);
      expect(
        guide.maxTurns,
        `Stage "${stage}" should have maxTurns === 3`
      ).toBe(3);
    }
  });

  it('each stage has exactly 3 sub-questions defined', () => {
    const stages = ['warm_connection', 'title', 'introduction', 'body', 'conclusion', 'cross_book'];
    for (const stage of stages) {
      const guide = getStageInstructions(stage);
      expect(
        (guide.subQuestions || []).length,
        `Stage "${stage}" should have exactly 3 subQuestions`
      ).toBe(3);
    }
  });

  it('turn number is reflected in the system prompt (current turn tracking)', () => {
    const promptTurn1 = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'title', 1);
    const promptTurn2 = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'title', 2);
    const promptTurn3 = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'title', 3);

    expect(promptTurn1).toContain('Current Turn: 1');
    expect(promptTurn2).toContain('Current Turn: 2');
    expect(promptTurn3).toContain('Current Turn: 3');
  });
});

// ============================================================================
// 5. T.E.A.A. FRAMEWORK TESTS
// ============================================================================

describe('T.E.A.A. Framework', () => {
  it('system prompt for turn 1 maps to THINK phase', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'title', 1);
    expect(prompt).toContain('THINK');
    expect(prompt.toUpperCase()).toContain('T.E.A.A.');
  });

  it('system prompt for turn 2 maps to EXPLAIN phase', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'title', 2);
    expect(prompt).toContain('EXPLAIN');
  });

  it('system prompt for turn 3 maps to ADD / APPLY phase', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'title', 3);
    expect(prompt).toMatch(/ADD|APPLY/);
  });

  it('T.E.A.A. block includes the phase goal for turn 1 (invite free thinking)', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'advanced', 'introduction', 1);
    expect(prompt.toLowerCase()).toMatch(/free.*thinking|open.ended|no pressure/);
  });

  it('T.E.A.A. block includes the phase goal for turn 2 (explain reasoning)', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'introduction', 2);
    expect(prompt.toLowerCase()).toMatch(/explain|elaborate|why|how/);
  });

  it('T.E.A.A. block includes the phase goal for turn 3 (expand or connect to real life)', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'introduction', 3);
    expect(prompt.toLowerCase()).toMatch(/connect|real life|experience|expand/);
  });

  it('T.E.A.A. block includes level-specific guidance for beginners (simple choices)', () => {
    const prompt = getSystemPrompt(SIMPLE_BOOK_TITLE, STUDENT_NAME, 'beginner', 'title', 1);
    // TEAA_LEVEL_GUIDANCE.beginner.think includes "two choices" or "very simple question".
    expect(prompt.toLowerCase()).toMatch(/two choices|very simple question|simple question/);
  });

  it('T.E.A.A. block includes level-specific guidance for advanced (text evidence / counter-argument)', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'advanced', 'conclusion', 2);
    // TEAA_LEVEL_GUIDANCE.advanced.explain references textual evidence.
    expect(prompt.toLowerCase()).toMatch(/text.*support|supports that|how do you know|evidence/);
  });

  it('T.E.A.A. block explicitly states it is a guide, not a rigid script', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'body', 1);
    expect(prompt.toLowerCase()).toMatch(/guide.*not a rigid|guide, not a rigid/);
  });

  it('T.E.A.A. block instructs Alice never to label phases out loud to the student', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'title', 2);
    expect(prompt.toLowerCase()).toMatch(/never label the phases|not.*out loud|keep it conversational/);
  });

  it('T.E.A.A. note for beginner level tells Alice not to insist on EXPLAIN step if enthusiasm is shown', () => {
    const prompt = getSystemPrompt(SIMPLE_BOOK_TITLE, STUDENT_NAME, 'beginner', 'title', 2);
    // TEAA_LEVEL_GUIDANCE.beginner.note content.
    expect(prompt.toLowerCase()).toMatch(/never insist|joyful|enthusiastic|celebrate and transition/);
  });

  it('T.E.A.A. phases cover turns 1, 2, and 3 without gaps', () => {
    // Each turn should produce a different T.E.A.A. label.
    const turn1 = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'title', 1);
    const turn2 = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'title', 2);
    const turn3 = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'title', 3);

    expect(turn1).toContain('THINK');
    expect(turn2).toContain('EXPLAIN');
    expect(turn3).toMatch(/ADD|APPLY/);
    // All three prompts contain the T.E.A.A. section header.
    expect(turn1.toUpperCase()).toContain('T.E.A.A.');
    expect(turn2.toUpperCase()).toContain('T.E.A.A.');
    expect(turn3.toUpperCase()).toContain('T.E.A.A.');
  });

  it('T.E.A.A. example sentence starters are included in the system prompt', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'introduction', 1);
    // The THINK phase always includes "What do you think about" or "How did you feel when" starters.
    expect(prompt.toLowerCase()).toMatch(/what do you think|what comes to your mind|how did you feel/);
  });
});

// ============================================================================
// 6. BOOK CONTEXT INJECTION TESTS
// ============================================================================

describe('Book Context Injection', () => {
  it('system prompt includes the book title in the STUDENT PROFILE section', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'title', 1);
    expect(prompt).toContain(`"${SAMPLE_BOOK.title}"`);
  });

  it('system prompt includes the book author when provided', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'title', 1);
    expect(prompt).toContain(SAMPLE_BOOK.author);
  });

  it('system prompt includes BOOK CONTEXT section when synopsis is provided', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'title', 1);
    expect(prompt.toUpperCase()).toContain('BOOK CONTEXT');
  });

  it('system prompt does NOT include BOOK CONTEXT section when synopsis is absent', () => {
    const bookWithoutSynopsis = { title: 'Simple Book' };
    const prompt = getSystemPrompt(bookWithoutSynopsis, STUDENT_NAME, 'intermediate', 'title', 1);
    expect(prompt.toUpperCase()).not.toContain('BOOK CONTEXT');
  });

  it('system prompt includes key themes from the book when provided', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'advanced', 'body', 1);
    for (const theme of SAMPLE_BOOK.key_themes) {
      expect(prompt.toLowerCase()).toContain(theme.toLowerCase());
    }
  });

  it('system prompt includes character names when provided', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'introduction', 1);
    expect(prompt).toContain('Charlotte');
    expect(prompt).toContain('Wilbur');
  });

  it('system prompt includes the moral lesson when provided', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'advanced', 'conclusion', 1);
    expect(prompt).toContain('True friendship means giving without expectation of return.');
  });

  it('system prompt works correctly with a legacy string book title (backwards compatibility)', () => {
    expect(() => {
      getSystemPrompt(SIMPLE_BOOK_TITLE, STUDENT_NAME, 'beginner', 'title', 1);
    }).not.toThrow();
    const prompt = getSystemPrompt(SIMPLE_BOOK_TITLE, STUDENT_NAME, 'beginner', 'title', 1);
    expect(prompt).toContain(SIMPLE_BOOK_TITLE);
  });

  it('system prompt works correctly with a legacy string student name (backwards compatibility)', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, 'Alice', 'intermediate', 'title', 1);
    expect(prompt).toContain('Alice');
  });

  it('system prompt interpolates [CHARACTER] and [BOOK_TITLE] tokens in sub-questions', () => {
    const prompt = getSystemPrompt(SAMPLE_BOOK, STUDENT_NAME, 'intermediate', 'introduction', 1);
    // After interpolation, raw tokens should not remain.
    expect(prompt).not.toContain('[CHARACTER]');
    expect(prompt).not.toContain('[BOOK_TITLE]');
    // The primary character name should appear instead.
    expect(prompt).toContain('Charlotte');
  });
});

// ============================================================================
// 7. isShortAnswer UTILITY TESTS
// ============================================================================

describe('isShortAnswer utility', () => {
  it('returns true for an empty string regardless of level', () => {
    expect(isShortAnswer('', 'beginner')).toBe(true);
    expect(isShortAnswer('', 'advanced')).toBe(true);
  });

  it('returns true for null/undefined input (not a string)', () => {
    expect(isShortAnswer(null, 'intermediate')).toBe(true);
    expect(isShortAnswer(undefined, 'intermediate')).toBe(true);
  });

  it('returns true when response word count is below the beginner threshold (5)', () => {
    expect(isShortAnswer('Yes', 'beginner')).toBe(true);              // 1 word
    expect(isShortAnswer('I like it', 'beginner')).toBe(true);        // 3 words
  });

  it('returns false when response meets the beginner threshold', () => {
    // beginner threshold is 5 — 5 words should be NOT short (< 5 is short).
    expect(isShortAnswer('I really liked the story', 'beginner')).toBe(false); // 5 words
  });

  it('returns true when response word count is below the intermediate threshold (10)', () => {
    const shortForIntermediate = 'It was exciting and fun'; // 5 words
    expect(isShortAnswer(shortForIntermediate, 'intermediate')).toBe(true);
  });

  it('returns false when response meets the intermediate threshold', () => {
    const goodForIntermediate = 'I think Charlotte was very brave because she worked hard to save Wilbur from danger'; // 15+ words
    expect(isShortAnswer(goodForIntermediate, 'intermediate')).toBe(false);
  });

  it('returns true when response word count is below the advanced threshold (15)', () => {
    const shortForAdvanced = 'The themes were interesting'; // 4 words
    expect(isShortAnswer(shortForAdvanced, 'advanced')).toBe(true);
  });

  it('returns false for an advanced-level response with 15 or more words', () => {
    const goodForAdvanced = 'I think the author uses the contrast between Charlotte\'s wisdom and Wilbur\'s innocence to explore the beauty of selfless friendship'; // 20+ words
    expect(isShortAnswer(goodForAdvanced, 'advanced')).toBe(false);
  });

  it('returns false for an unknown level (uses the default threshold of 10)', () => {
    const longEnough = 'I really enjoyed reading this book and learning about all of the characters'; // 13 words
    expect(isShortAnswer(longEnough, 'unknown_level')).toBe(false);
  });
});
