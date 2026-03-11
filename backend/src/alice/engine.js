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
  getDepthScaffoldingPrompt,
  isShortAnswer,
  getShortAnswerFollowUp,
  getMetacognitivePrompt,
  getRephrasePrompt
} from './prompts.js';
import { classifyAnswerDepth } from './levelDetector.js';
import { getCrossBookContext } from './crossBookMemory.js';

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
 * @param {string}        [params.crossBookContext=''] - Cross-book memory context string to append to system prompt
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
  crossBookContext = ''
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

    // Classify answer depth for scaffolding (only when student message exists)
    let depthAnalysis = null;
    let depthScaffolding = '';
    if (hasStudentMessage) {
      depthAnalysis = classifyAnswerDepth(studentMessage, level);
      depthScaffolding = getDepthScaffoldingPrompt(depthAnalysis.depth, level, depthAnalysis.indicators);
    }

    let systemPrompt = getSystemPrompt(bookContext, studentName, level, stage, turn, { depthScaffolding });

    // Inject cross-book memory context if available
    if (crossBookContext) {
      systemPrompt += crossBookContext;
    }

    // Additional short-answer hint for surface-level responses
    if (hasStudentMessage && depthAnalysis?.depth === 'surface' && isShortAnswer(studentMessage, level)) {
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

    return {
      content,
      grammarFeedback,
      depthAnalysis,
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
// METACOGNITIVE RESPONSE GENERATOR
// ============================================================================

/**
 * Generate HiAlice's response during the metacognitive closing stage.
 *
 * Called after the conclusion stage to ask the two self-reflection questions
 * one at a time. Falls back to a canned response when the API is unavailable.
 *
 * @param {object} params
 * @param {string} params.studentName          - Student's first name
 * @param {string} params.bookTitle            - Title of the book discussed
 * @param {string} params.level                - 'beginner' | 'intermediate' | 'advanced'
 * @param {Array}  [params.conversationHistory=[]] - Prior dialogue rows for this closing
 * @returns {Promise<{ content: string, isMock?: boolean }>}
 */
export async function getMetacognitiveResponse({ studentName, bookTitle, level, conversationHistory = [] }) {
  if (!anthropic) {
    return {
      content: `${studentName}, I loved hearing your thoughts today! Before we finish — which question was the hardest for you to answer? I'm really curious!`,
      isMock: true
    };
  }

  try {
    const systemPrompt = getMetacognitivePrompt(studentName, bookTitle, level);
    const messages = formatConversationHistory(conversationHistory);

    if (messages.length === 0) {
      messages.push({
        role: 'user',
        content: 'We just finished the conclusion stage. Please ask the first metacognitive closing question.'
      });
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      temperature: 0.7,
      system: systemPrompt,
      messages
    });

    return { content: response.content[0]?.text || '' };
  } catch (error) {
    console.error('[Alice Engine] Metacognitive response error:', error.message);
    return {
      content: `Great session, ${studentName}! Which of my questions today was the trickiest for you? I'd love to know!`,
      isMock: true
    };
  }
}

// ============================================================================
// QUESTION REPHRASE GENERATOR
// ============================================================================

/**
 * Generate a simpler version of a question when a student appears stuck.
 * Called when the silence detection threshold is exceeded.
 *
 * @param {object} params
 * @param {string} params.originalQuestion - The question to rephrase
 * @param {string} params.studentName - Student's name
 * @param {string} params.level - Student's level
 * @param {string} params.bookTitle - Current book title
 * @returns {Promise<{ content: string, isMock?: boolean }>}
 */
export async function rephraseQuestion({ originalQuestion, studentName, level, bookTitle }) {
  if (!anthropic) {
    // Mock: offer a simple choice-based alternative
    return {
      content: `That's a tricky one! Let me ask differently — did you think it was more EXCITING or more SURPRISING? Which one feels right to you?`,
      isMock: true,
    };
  }

  try {
    const systemPrompt = getRephrasePrompt(originalQuestion, studentName, level, bookTitle);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      temperature: 0.8,
      messages: [{ role: 'user', content: `Please rephrase this question for a stuck student: "${originalQuestion}"` }],
      system: systemPrompt,
    });

    return { content: response.content[0]?.text?.trim() || '' };
  } catch (error) {
    console.error('[Alice Engine] Rephrase error:', error.message);
    return {
      content: `Hmm, let me think of another way to ask! Was there something in the story that made you feel HAPPY or SURPRISED?`,
      isMock: true,
    };
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  getAliceResponse,
  generateSessionFeedback,
  formatConversationHistory,
  getMetacognitiveResponse,
  rephraseQuestion
};
