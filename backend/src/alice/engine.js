/**
 * HiAlice AI Engine v2.0
 *
 * Claude API integration for conversational book review sessions.
 *
 * Changes from v1.0:
 *  - getAliceResponse() now accepts a `book` object (with synopsis, themes,
 *    characters, etc.) and passes it to getSystemPrompt() for context-aware
 *    question generation.
 *  - Short-answer detection: when a student's response is below the level
 *    threshold, a follow-up context hint is appended to the system prompt
 *    so Alice's next question gently nudges for more elaboration.
 *  - generateSessionFeedback() — new export that calls Claude to produce a
 *    personalised end-of-session feedback message and returns it as a string.
 *
 * All existing exports remain backwards-compatible.
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../lib/config.js';
import {
  getSystemPrompt,
  getSessionFeedbackPrompt,
  isShortAnswer,
  getShortAnswerFollowUp
} from './prompts.js';

// ============================================================================
// CLIENT INITIALISATION
// ============================================================================

// Lazily initialised; null when API key is absent (dev / test mode).
let anthropic = null;
if (config.anthropic?.apiKey) {
  anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format conversation history from dialogue rows into the Claude message format.
 *
 * @param {Array} dialogues - Dialogue rows from the database
 * @returns {Array} Message objects compatible with the Claude messages API
 */
export function formatConversationHistory(dialogues) {
  return dialogues.map(dialogue => ({
    role: dialogue.speaker === 'student' ? 'user' : 'assistant',
    content: dialogue.content
  }));
}

// ============================================================================
// MAIN RESPONSE GENERATOR
// ============================================================================

/**
 * Generate HiAlice's response using the Claude API, with fallback to mock data.
 *
 * @param {object} params
 * @param {string|object} params.bookTitle  - Book title string (legacy) OR full book object
 *   { title, author, synopsis, key_themes, emotional_keywords, key_characters, moral_lesson }
 * @param {string}        params.studentName - Student's name
 * @param {string}        params.level       - 'beginner' | 'intermediate' | 'advanced'
 * @param {string}        params.stage       - 'title' | 'introduction' | 'body' | 'conclusion'
 * @param {number}        params.turn        - Turn number within the stage (1-3)
 * @param {string|null}   params.studentMessage - Student's latest message (null for opening)
 * @param {Array}         [params.conversationHistory=[]] - Prior dialogue rows
 * @param {object}        [params.book]      - Full book object (preferred over bookTitle string)
 * @returns {Promise<{ content: string, grammarFeedback: string, isMock?: boolean, usage?: object }>}
 */
export async function getAliceResponse({
  bookTitle,
  studentName,
  level,
  stage,
  turn,
  studentMessage,
  conversationHistory = [],
  book = null,
  priorVocabulary = []
}) {
  try {
    // If the Claude API is not configured, fall back to canned responses.
    if (!anthropic) {
      return getMockResponse({ bookTitle, studentName, level, stage, turn, studentMessage });
    }

    // Resolve the book object used for context injection.
    // If a full book object was supplied use it; otherwise build a minimal
    // wrapper around the legacy bookTitle string.
    const bookContext = book
      ? book
      : { title: bookTitle || 'this book' };

    // Detect short answers and, when warranted, append a follow-up hint to
    // the system prompt so Alice naturally nudges for elaboration.
    const hasStudentMessage = studentMessage !== null
      && studentMessage !== undefined
      && studentMessage.trim() !== '';

    let systemPrompt = getSystemPrompt(bookContext, studentName, level, stage, turn, { priorVocabulary });

    if (hasStudentMessage && isShortAnswer(studentMessage, level)) {
      const followUp = getShortAnswerFollowUp(level, stage, bookContext.title);
      systemPrompt +=
        `\n\nSHORT ANSWER DETECTED: ${studentName}'s response was very brief.` +
        ` Gently encourage more detail using a choice-based follow-up such as: "${followUp}"` +
        ` Do NOT mention that the answer was short.`;
    }

    // Build the messages array from prior conversation history.
    const messages = formatConversationHistory(conversationHistory);

    // Append the current student message (if present).
    if (hasStudentMessage) {
      messages.push({ role: 'user', content: studentMessage });
    }

    // If there are still no messages (opening call with no history and no
    // student message), inject a minimal bootstrap prompt so the Claude API
    // receives a valid non-empty messages array.
    if (messages.length === 0) {
      const resolvedTitle = bookContext.title || bookTitle || 'this book';
      messages.push({
        role: 'user',
        content: `Please start the session for "${resolvedTitle}" and ask your opening question for the ${stage} stage.`
      });
    }

    // Call the Claude API.
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      temperature: 0.7,
      system: systemPrompt,
      messages
    });

    const content = response.content[0]?.text || '';

    // Grammar feedback is only surfaced for advanced students to avoid
    // overwhelming beginners and intermediates.
    let grammarFeedback = '';
    if (level === 'advanced' && hasStudentMessage) {
      grammarFeedback = generateBasicGrammarFeedback(studentMessage);
    }

    // Classify answer depth when a student message was provided
    let cognitiveTag = null;
    if (hasStudentMessage) {
      cognitiveTag = classifyAnswerDepth(studentMessage, level);
    }

    return {
      content,
      grammarFeedback,
      cognitiveTag,
      usage: {
        inputTokens: response.usage?.input_tokens   || 0,
        outputTokens: response.usage?.output_tokens || 0
      }
    };
  } catch (error) {
    console.error('[Alice Engine] Claude API error:', error.message);
    // Degrade gracefully to mock responses if the API call fails.
    return getMockResponse({ bookTitle, studentName, level, stage, turn, studentMessage });
  }
}

// ============================================================================
// SESSION FEEDBACK GENERATOR
// ============================================================================

/**
 * Generate a personalised end-of-session feedback message using Claude.
 *
 * Called after a session is marked complete. The returned string is stored
 * in sessions.ai_feedback for later retrieval via GET /:id/feedback.
 *
 * @param {object} sessionData
 * @param {object} sessionData.student   - { name, level }
 * @param {object} sessionData.book      - { title }
 * @param {Array}  sessionData.dialogues - All dialogue rows for the session
 * @param {number} [sessionData.levelScore=0]
 * @param {number} [sessionData.grammarScore=0]
 * @returns {Promise<string>} Feedback text (falls back to a generic message on error)
 */
export async function generateSessionFeedback(sessionData) {
  const { student, book } = sessionData;
  const studentName = student?.name || 'you';
  const bookTitle   = book?.title   || 'this book';

  // Return a safe generic message when the API is unavailable.
  if (!anthropic) {
    return `Amazing work today, ${studentName}! You shared so many wonderful thoughts about "${bookTitle}". Keep reading and keep sharing — you're growing every session!`;
  }

  try {
    const feedbackPrompt = getSessionFeedbackPrompt(sessionData);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      temperature: 0.8,
      messages: [{ role: 'user', content: feedbackPrompt }]
    });

    return response.content[0]?.text?.trim() || buildFallbackFeedback(studentName, bookTitle);
  } catch (error) {
    console.error('[Alice Engine] Feedback generation error:', error.message);
    return buildFallbackFeedback(studentName, bookTitle);
  }
}

// ============================================================================
// ANSWER DEPTH CLASSIFIER
// ============================================================================

/**
 * Bloom's taxonomy level labels mapped to numeric IDs (1-6).
 */
const BLOOMS_LEVELS = {
  1: 'remember',
  2: 'understand',
  3: 'apply',
  4: 'analyze',
  5: 'evaluate',
  6: 'create'
};

/**
 * Linguistic markers that indicate different cognitive depths.
 * Each marker maps to the minimum Bloom's level it suggests.
 */
const DEPTH_MARKERS = {
  // Level 5-6: Evaluate / Create
  deep: {
    patterns: [
      /\bI think\b.*\bbecause\b/i,
      /\bI believe\b/i,
      /\bI would\b.*\bbecause\b/i,
      /\bif I were\b/i,
      /\bif I could\b/i,
      /\bin my opinion\b/i,
      /\bI disagree\b/i,
      /\bI agree\b.*\bbecause\b/i,
      /\bwhat if\b/i,
      /\bI wonder\b/i,
      /\bI imagine\b/i,
      /\bfor example\b/i,
      /\bthis reminds me of\b/i,
      /\bin my life\b/i,
      /\bI learned that\b/i,
      /\bthe lesson is\b/i,
      /\bI would change\b/i,
      /\bI noticed that\b/i,
      /\bon the other hand\b/i,
      /\bhowever\b/i,
      /\balthough\b/i
    ],
    minBlooms: 5
  },
  // Level 3-4: Apply / Analyze
  analytical: {
    patterns: [
      /\bbecause\b/i,
      /\bthe reason\b/i,
      /\bso that\b/i,
      /\bwhich means\b/i,
      /\bthis shows\b/i,
      /\bfor instance\b/i,
      /\bcompared to\b/i,
      /\bsimilar to\b/i,
      /\bdifferent from\b/i,
      /\bfirst\b.*\bsecond\b/i,
      /\bI felt\b/i,
      /\bit made me feel\b/i,
      /\bthe character\b/i,
      /\bthe story\b/i,
      /\bthe author\b/i,
      /\bthat part\b/i,
      /\bmy favorite\b.*\bbecause\b/i
    ],
    minBlooms: 3
  },
  // Level 1-2: Remember / Understand
  surface: {
    patterns: [
      /^(yes|no|ok|okay|yeah|yep|nope|idk|I don't know)\.?$/i,
      /^it was (good|bad|fun|nice|okay|boring|cool)\.?$/i,
      /^I (liked|loved|hated) it\.?$/i,
      /^the (book|story) (was|is) (about|good|nice)\.?/i
    ],
    minBlooms: 1
  }
};

/**
 * Classify a student's answer depth and Bloom's taxonomy level.
 *
 * Returns an object with:
 *  - depthClass: 'surface' | 'analytical' | 'deep'
 *  - bloomsLevel: 1-6 (numeric Bloom's taxonomy level)
 *  - bloomsLabel: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create'
 *  - evidenceMarkers: Array of matched pattern descriptions
 *  - wordCount: Number of words in the response
 *
 * @param {string} response - The student's answer text
 * @param {string} [level='intermediate'] - Student level for threshold context
 * @returns {object} Classification result
 */
export function classifyAnswerDepth(response, level = 'intermediate') {
  if (!response || typeof response !== 'string') {
    return {
      depthClass: 'surface',
      bloomsLevel: 1,
      bloomsLabel: 'remember',
      evidenceMarkers: [],
      wordCount: 0
    };
  }

  const text = response.trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const evidenceMarkers = [];

  // Check from deepest to shallowest
  let maxBlooms = 1;

  // Deep markers (Bloom's 5-6)
  for (const pattern of DEPTH_MARKERS.deep.patterns) {
    if (pattern.test(text)) {
      evidenceMarkers.push(pattern.source);
      maxBlooms = Math.max(maxBlooms, DEPTH_MARKERS.deep.minBlooms);
    }
  }

  // Analytical markers (Bloom's 3-4)
  for (const pattern of DEPTH_MARKERS.analytical.patterns) {
    if (pattern.test(text)) {
      evidenceMarkers.push(pattern.source);
      maxBlooms = Math.max(maxBlooms, DEPTH_MARKERS.analytical.minBlooms);
    }
  }

  // Surface patterns override only if NO deeper markers were found
  if (evidenceMarkers.length === 0) {
    for (const pattern of DEPTH_MARKERS.surface.patterns) {
      if (pattern.test(text)) {
        evidenceMarkers.push(pattern.source);
      }
    }
  }

  // Word count boosts: longer responses tend to be more analytical
  if (wordCount >= 30 && maxBlooms < 4) maxBlooms = Math.max(maxBlooms, 3);
  if (wordCount >= 50 && maxBlooms < 5) maxBlooms = Math.max(maxBlooms, 4);

  // Multiple "because" clauses suggest structured reasoning
  const becauseCount = (text.match(/\bbecause\b/gi) || []).length;
  if (becauseCount >= 2 && maxBlooms < 4) maxBlooms = 4;
  if (becauseCount >= 3 && maxBlooms < 5) maxBlooms = 5;

  // Sentence count: multiple sentences suggest more elaboration
  const sentenceCount = text.split(/[.!?]+/).filter(s => s.trim()).length;
  if (sentenceCount >= 3 && maxBlooms < 3) maxBlooms = 3;

  // Refine Bloom's within the band using additional heuristics
  // Deep band: distinguish evaluate (5) from create (6)
  if (maxBlooms >= 5) {
    const hasCreative = /\bif I\b|\bI would\b|\bI imagine\b|\bwhat if\b|\bI would change\b/i.test(text);
    maxBlooms = hasCreative ? 6 : 5;
  }
  // Analytical band: distinguish apply (3) from analyze (4)
  if (maxBlooms >= 3 && maxBlooms <= 4) {
    const hasAnalysis = /\bthe reason\b|\bwhich means\b|\bthis shows\b|\bcompared to\b/i.test(text);
    maxBlooms = hasAnalysis ? 4 : 3;
  }

  // Map to depth class
  let depthClass;
  if (maxBlooms >= 5) depthClass = 'deep';
  else if (maxBlooms >= 3) depthClass = 'analytical';
  else depthClass = 'surface';

  return {
    depthClass,
    bloomsLevel: maxBlooms,
    bloomsLabel: BLOOMS_LEVELS[maxBlooms] || 'remember',
    evidenceMarkers,
    wordCount
  };
}

/**
 * Calculate "Thinking Momentum" score for a sequence of classified turns.
 * Positive = answers are getting deeper over time.
 * Negative = answers are getting shallower.
 * Zero = flat.
 *
 * Uses weighted linear regression slope on Bloom's levels.
 *
 * @param {Array<{bloomsLevel: number}>} turns - Ordered array of classified turns
 * @returns {number} Momentum score (-5.0 to +5.0)
 */
export function calculateThinkingMomentum(turns) {
  if (!Array.isArray(turns) || turns.length < 2) return 0;

  const n = turns.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i + 1; // turn number (1-based)
    const y = turns[i].bloomsLevel || 1;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  const slope = (n * sumXY - sumX * sumY) / denominator;

  // Clamp to [-5, 5] range
  return Math.max(-5, Math.min(5, Math.round(slope * 100) / 100));
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Build a safe fallback feedback string when Claude is unavailable or errors.
 * @private
 */
function buildFallbackFeedback(studentName, bookTitle) {
  return `Fantastic session, ${studentName}! You expressed so many thoughtful ideas about "${bookTitle}" today. Your creativity and curiosity really shine through — keep it up for your next book!`;
}

/**
 * Generate mock responses for development/testing when Claude API is unavailable.
 * @private
 */
function getMockResponse({ bookTitle, studentName, level, stage, turn, studentMessage }) {
  const mockResponses = {
    title: {
      1: `That's a great title! I wonder what it means to you. What picture comes to your mind when you hear "${bookTitle}"?`,
      2: 'I love your thinking! Does the title make you feel excited, curious, or something else?',
      3: "You've given this a lot of thought. Why do you think the author chose THIS title instead of a different one?"
    },
    introduction: {
      1: 'Wonderful! If you could BE one of the characters, which one would you choose — and why?',
      2: "That's interesting! How do you think that character felt at the very beginning of the story?",
      3: 'Great observations! If you could say one thing to that character right now, what would it be?'
    },
    body: {
      1: 'What was the most EXCITING or SURPRISING part of the story? How did it make you feel inside?',
      2: 'Excellent thinking! If YOU could change one part of the story, what would you change — and why?',
      3: 'I love that! What did this story teach YOU about your own life? Can you think of a time something similar happened to you?'
    },
    conclusion: {
      1: "What a session! If you could write a letter to the main character, what would you want to say?",
      2: 'Would you recommend this book to your best friend? What would you tell them to get them excited?',
      3: 'Thank you so much for sharing your thoughts! What ONE word best describes how this book made you feel?'
    }
  };

  const stageResponses = mockResponses[stage] || mockResponses.title;
  const content = stageResponses[turn]
    || stageResponses[3]
    || 'Tell me more about that. What do you think?';

  return { content, grammarFeedback: '', isMock: true };
}

/**
 * Generate basic grammar feedback for a student response (advanced level only).
 * Applies simple heuristic checks; not a substitute for a proper NLP pipeline.
 * @private
 */
function generateBasicGrammarFeedback(text) {
  if (!text) return 'Great expression!';

  const feedback = [];

  if (text.trim().split(/\s+/).filter(Boolean).length < 5) {
    feedback.push('Try to express your complete thoughts — add more detail!');
  }

  // Simple subject-verb agreement heuristic
  if (/\bthe student are\b/i.test(text) || /\bthe book are\b/i.test(text)) {
    feedback.push('Remember: "The student IS" (singular), not "are".');
  }

  // Mixed tense across multiple sentences (rough heuristic)
  const hasPresentVerbs = /\b(am|is|are|do|does)\b/.test(text);
  const hasPastVerbs    = /\b(was|were|did|had)\b/.test(text);
  if (hasPresentVerbs && hasPastVerbs && text.split('.').filter(Boolean).length > 2) {
    feedback.push('Nice work! Check your tenses — make sure each sentence is clear about when events happened.');
  }

  return feedback.length > 0 ? feedback.join(' ') : 'Great expression!';
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  getAliceResponse,
  generateSessionFeedback,
  formatConversationHistory,
  classifyAnswerDepth,
  calculateThinkingMomentum
};
