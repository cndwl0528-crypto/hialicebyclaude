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
import { trackUsage } from '../services/costTracker.js';
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
import {
  selectModel as routerSelectModel,
  CostTracker,
  buildCachedMessages,
  callWithRetry
} from '../services/modelRouter.js';
import { evaluateResponse, evalLogger } from '../services/evalHarness.js';
import { getQuickContext, getFullContext } from '../services/contextRetriever.js';

// ============================================================================
// TASK ADAPTER — MODEL CONFIGS & ROUTING
// ============================================================================

/**
 * Named model configuration presets used by the TaskAdapter pattern.
 *
 * Each preset groups the Anthropic model identifier, a conservative max_tokens
 * ceiling for that use-case, and a human-readable label for logging/analytics.
 *
 * Routing decisions in selectModel() reference these keys so that changing a
 * model version only requires editing this single object.
 *
 * @type {Record<string, { model: string, maxTokens: number, label: string }>}
 */
export const MODEL_CONFIGS = {
  /** Complex conversational turns — body stage, advanced students, cross-book. */
  complex:  { model: 'claude-sonnet-4-20250514',   maxTokens: 1024, label: 'sonnet' },
  /** Simple, fast turns — title/introduction for beginners. */
  simple:   { model: 'claude-haiku-4-5-20251001',  maxTokens: 512,  label: 'haiku'  },
  /** End-of-session feedback generation — template-driven, low reasoning load. */
  feedback: { model: 'claude-haiku-4-5-20251001',  maxTokens: 768,  label: 'haiku'  },
};

/**
 * Select the most cost-appropriate MODEL_CONFIGS preset for a given session turn.
 *
 * Routing rules (evaluated top-to-bottom, first match wins):
 *  1. stage === 'feedback'                          → feedback preset (Haiku)
 *  2. stage === 'conclusion' || 'crossbook'         → complex preset (Sonnet)
 *  3. stage === 'body' && studentLevel === 'advanced' → complex preset (Sonnet)
 *  4. (stage === 'title' || 'introduction') && studentLevel === 'beginner'
 *                                                   → simple preset (Haiku)
 *  5. default                                       → complex preset (Sonnet)
 *
 * @param {string} stage        - Session stage: 'title' | 'introduction' | 'body' |
 *                                'conclusion' | 'crossbook' | 'feedback'
 * @param {number} turnInStage  - 1-indexed turn number within the current stage
 * @param {string} studentLevel - 'beginner' | 'intermediate' | 'advanced'
 * @returns {{ config: { model: string, maxTokens: number, label: string }, preset: string, reason: string }}
 */
export function selectModel(stage, turnInStage, studentLevel) {
  let preset;
  let reason;

  if (stage === 'feedback') {
    preset = 'feedback';
    reason = 'feedback stage — template-driven, Haiku preferred';
  } else if (stage === 'conclusion' || stage === 'crossbook') {
    preset = 'complex';
    reason = `${stage} stage — requires synthesis and nuance, Sonnet preferred`;
  } else if (stage === 'body' && studentLevel === 'advanced') {
    preset = 'complex';
    reason = 'body stage with advanced student — high reasoning demand, Sonnet preferred';
  } else if ((stage === 'title' || stage === 'introduction') && studentLevel === 'beginner') {
    preset = 'simple';
    reason = `${stage} stage for beginner (turn ${turnInStage}) — simple opening, Haiku preferred`;
  } else {
    preset = 'complex';
    reason = `default routing for stage="${stage}", level="${studentLevel}", turn=${turnInStage}`;
  }

  const resolvedConfig = MODEL_CONFIGS[preset];
  console.log(
    `[TaskAdapter] stage="${stage}" level="${studentLevel}" turn=${turnInStage}` +
    ` → preset="${preset}" model="${resolvedConfig.model}" (${reason})`
  );
  return { config: resolvedConfig, preset, reason };
}

// ============================================================================
// SESSION COST STORE
// ============================================================================

/**
 * In-memory session cost registry.
 *
 * Keys are sessionId strings; values are accumulated cost summaries produced
 * by CostTracker.getSummary(). Updated after every API call in getAliceResponse().
 *
 * Note: this store is process-scoped and is cleared on server restart. Persist
 * to a database for durability when the feature graduates from development.
 *
 * @type {Map<string, object>}
 */
const _sessionCostStore = new Map();

/**
 * Retrieve the accumulated cost summary for a session.
 *
 * Returns undefined when the session has not yet made any API calls (e.g.,
 * if it was served entirely from mock data).
 *
 * @param {string} sessionId - The session identifier passed into getAliceResponse()
 * @returns {object|undefined} CostTracker.getSummary() snapshot, or undefined
 */
export function getSessionCost(sessionId) {
  return _sessionCostStore.get(sessionId);
}

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
 * @param {string}        [params.sessionId='']  - Session ID for cost tracking (optional)
 * @returns {Promise<{ content: string, grammarFeedback: string, isMock?: boolean, usage?: object, costSummary?: object }>}
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
  crossBookContext = '',
  sessionId = ''
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

    // P2-AI-04: Enhanced short answer detection with auto follow-up
    // Very short answers (1-3 words) always trigger encouraging follow-up,
    // regardless of depth classification. Longer short answers only trigger
    // when depth is surface-level.
    if (hasStudentMessage) {
      const wordCount = studentMessage.trim().split(/\s+/).filter(Boolean).length;
      const isVeryShort = wordCount >= 1 && wordCount <= 3;
      const isLevelShort = isShortAnswer(studentMessage, level);

      if (isVeryShort) {
        // Very short (1-3 words): always provide an encouraging nudge
        const encouragingFollowUps = [
          "Can you tell me more about that?",
          "That's interesting! Why do you think so?",
          "Oh, I'd love to hear more! What made you think of that?",
          "Great start! Can you add one more thought?"
        ];
        const randomFollowUp = encouragingFollowUps[Math.floor(Math.random() * encouragingFollowUps.length)];
        systemPrompt +=
          `\n\nVERY SHORT ANSWER DETECTED (${wordCount} word${wordCount > 1 ? 's' : ''}): ${studentName} gave a very brief response.` +
          ` This is normal — do NOT make them feel bad about it.` +
          ` FIRST: warmly acknowledge what they said (repeat their word/phrase back positively).` +
          ` THEN: gently encourage more with something like: "${randomFollowUp}"` +
          ` Or offer two simple choices to help them elaborate.` +
          ` NEVER say "that's too short" or "can you say more" directly.`;
      } else if (isLevelShort && depthAnalysis?.depth === 'surface') {
        // Moderately short + surface depth: standard follow-up
        const followUp = getShortAnswerFollowUp(level, stage, bookContext.title);
        systemPrompt +=
          `\n\nSHORT ANSWER DETECTED: ${studentName}'s response was very brief.` +
          ` Gently encourage more detail using a choice-based follow-up such as: "${followUp}"` +
          ` Do NOT mention that the answer was short.`;
      }
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

    // Select the most cost-appropriate model using the TaskAdapter pattern.
    // The local selectModel() maps stage + turn + level to a MODEL_CONFIGS
    // preset; routerSelectModel() is kept as a lower-level fallback for other
    // callers (feedback, metacognitive, rephrase) that still use task-type keys.
    const {
      config: adapterConfig,
      preset: adapterPreset,
      reason: modelReason,
    } = selectModel(stage, turn, level);
    const model = adapterConfig.model;
    const adapterMaxTokens = adapterConfig.maxTokens;

    // Initialise a per-call cost tracker.  Session-level totals are persisted
    // into _sessionCostStore after each response so getSessionCost() can
    // query them without re-parsing individual call records.
    const costTracker = new CostTracker(sessionId || 'getAliceResponse');

    // Enrich system prompt with student context (non-blocking on failure).
    try {
      const studentId = sessionId ? sessionId.split('-')[0] : null;
      if (studentId && book) {
        const context = await getQuickContext(studentId, book.id || null);
        if (context) {
          systemPrompt += `\n\n${context}`;
        }
      }
    } catch (ctxErr) {
      console.warn('[Alice Engine] Context retrieval failed (non-fatal):', ctxErr.message);
    }

    // Apply prompt caching hints for long system prompts (> 1024 tokens).
    const { system: finalSystem, messages: finalMessages } =
      buildCachedMessages(systemPrompt, messages);

    // Call the Claude API with retry logic for transient errors.
    // Supports up to 1 regeneration if eval harness flags the response.
    let content = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let evalResult = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await callWithRetry(
        () => anthropic.messages.create({
          model,
          max_tokens: adapterMaxTokens,
          temperature: 0.7,
          system:   finalSystem,
          messages: finalMessages,
        })
      );

      content = response.content[0]?.text || '';
      const callInputTokens  = response.usage?.input_tokens  || 0;
      const callOutputTokens = response.usage?.output_tokens || 0;
      inputTokens  += callInputTokens;
      outputTokens += callOutputTokens;

      const { cost: callCost } = costTracker.record(model, callInputTokens, callOutputTokens);

      // Forward usage to the global cost tracker service for monitoring.
      // Normalise the full model identifier to the pricing-key format expected
      // by costTracker.js (e.g. 'claude-sonnet-4-20250514' → 'claude-sonnet-4').
      if (callInputTokens > 0 || callOutputTokens > 0) {
        const pricingKey = model.startsWith('claude-haiku') ? 'claude-haiku-4-5' : 'claude-sonnet-4';
        const studentId  = sessionId ? sessionId.split('-')[0] : undefined;
        trackUsage({
          model:        pricingKey,
          inputTokens:  callInputTokens,
          outputTokens: callOutputTokens,
          sessionId:    sessionId || undefined,
          studentId,
        });
      }

      // Log structured usage after each API call for observability.
      console.log('[TaskAdapter] API call cost log:', {
        sessionId:    sessionId || null,
        attempt:      attempt + 1,
        model,
        preset:       adapterPreset,
        inputTokens:  callInputTokens,
        outputTokens: callOutputTokens,
        estimatedCost: callCost,
      });

      // Evaluate AI response quality before sending to student.
      evalResult = evaluateResponse(content, { stage, turn, level });
      evalLogger.log(sessionId || 'unknown', evalResult);

      if (evalResult.recommendation !== 'regenerate') {
        break; // Response is safe — send it
      }

      console.warn(
        `[Alice Engine] Eval harness flagged response for regeneration (attempt ${attempt + 1}): ${evalResult.details}`
      );
      // Second attempt uses slightly different temperature
    }

    // Persist the accumulated cost summary for this session into the in-memory
    // store so callers can retrieve it via getSessionCost(sessionId).
    if (sessionId) {
      _sessionCostStore.set(sessionId, costTracker.getSummary());
    }

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
      evalResult: evalResult ? {
        score: evalResult.overallScore,
        recommendation: evalResult.recommendation,
        pass: evalResult.pass,
      } : null,
      usage: {
        inputTokens,
        outputTokens,
        model,
        modelPreset:  adapterPreset,
        modelLabel:   adapterConfig.label,
        modelReason,
      },
      costSummary: costTracker.getSummary(),
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

    // Feedback is template-driven with low reasoning demands — use HAIKU.
    // routerSelectModel() accepts task-type strings (not stage/turn/level tuples).
    const { model, reason: modelReason } = routerSelectModel('feedback');

    const response = await callWithRetry(
      () => anthropic.messages.create({
        model,
        max_tokens: 150,
        temperature: 0.8,
        messages: [{ role: 'user', content: feedbackPrompt }],
      })
    );

    console.log(`[ModelRouter] generateSessionFeedback used ${model} (${modelReason})`);
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

    // Metacognitive closing needs contextual nuance — use SONNET.
    // routerSelectModel() accepts task-type strings (not stage/turn/level tuples).
    const { model } = routerSelectModel('metacognitive');

    // Apply prompt caching hints for the metacognitive system prompt.
    const { system: cachedSystem, messages: cachedMessages } =
      buildCachedMessages(systemPrompt, messages);

    const response = await callWithRetry(
      () => anthropic.messages.create({
        model,
        max_tokens: 200,
        temperature: 0.7,
        system:   cachedSystem,
        messages: cachedMessages,
      })
    );

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

    // Rephrasing is simple reformatting — HAIKU is fast and cost-effective.
    // routerSelectModel() accepts task-type strings (not stage/turn/level tuples).
    const { model } = routerSelectModel('rephrase');

    const response = await callWithRetry(
      () => anthropic.messages.create({
        model,
        max_tokens: 150,
        temperature: 0.8,
        messages: [{ role: 'user', content: `Please rephrase this question for a stuck student: "${originalQuestion}"` }],
        system: systemPrompt,
      })
    );

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
  // Core session functions
  getAliceResponse,
  generateSessionFeedback,
  formatConversationHistory,
  getMetacognitiveResponse,
  rephraseQuestion,
  // TaskAdapter pattern — model routing and cost tracking
  MODEL_CONFIGS,
  selectModel,
  getSessionCost,
};
