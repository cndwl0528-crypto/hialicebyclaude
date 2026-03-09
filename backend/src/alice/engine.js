/**
 * HiAlice AI Engine
 * Claude API integration for conversational book review sessions
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../lib/config.js';
import { getSystemPrompt } from './prompts.js';

// Initialize Anthropic client if API key is available
let anthropic = null;
if (config.anthropic?.apiKey) {
  anthropic = new Anthropic({
    apiKey: config.anthropic.apiKey
  });
}

/**
 * Format conversation history from dialogues into Claude message format
 * @param {array} dialogues - Array of dialogue objects from database
 * @returns {array} Array of message objects for Claude API
 */
export function formatConversationHistory(dialogues) {
  return dialogues.map(dialogue => ({
    role: dialogue.speaker === 'student' ? 'user' : 'assistant',
    content: dialogue.content
  }));
}

/**
 * Generate HiAlice response using Claude API or fallback mock
 * @param {object} params - Configuration object
 * @param {string} params.bookTitle - Title of the book
 * @param {string} params.studentName - Name of the student
 * @param {string} params.level - Student level (beginner|intermediate|advanced)
 * @param {string} params.stage - Current session stage (title|introduction|body|conclusion)
 * @param {number} params.turn - Turn number in current stage (1, 2, or 3)
 * @param {string} params.studentMessage - The student's latest message
 * @param {array} params.conversationHistory - Array of dialogue objects
 * @returns {Promise<object>} { content: string, grammarFeedback: string }
 */
export async function getAliceResponse({
  bookTitle,
  studentName,
  level,
  stage,
  turn,
  studentMessage,
  conversationHistory = []
}) {
  try {
    // If Claude API is not available, use fallback
    if (!anthropic) {
      return getMockResponse({ bookTitle, studentName, level, stage, turn, studentMessage });
    }

    // Build system prompt — pass current turn for body sub-question targeting
    const systemPrompt = getSystemPrompt(bookTitle, studentName, level, stage, turn);

    // Format conversation history for Claude
    const messages = formatConversationHistory(conversationHistory);

    // Only add the student message when it is non-null and non-empty.
    // A null/empty studentMessage means this is an opening message request
    // (e.g., the very first Alice greeting at session start), so we let
    // Claude generate the opening question without a preceding user turn.
    const hasStudentMessage = studentMessage !== null && studentMessage !== undefined && studentMessage.trim() !== '';
    if (hasStudentMessage) {
      messages.push({
        role: 'user',
        content: studentMessage
      });
    }

    // If there are no messages at all (opening call with no history and no
    // student message), inject a minimal prompt so the Claude API receives
    // a valid non-empty messages array.
    if (messages.length === 0) {
      messages.push({
        role: 'user',
        content: `Please start the session for "${bookTitle}" and ask your opening question for the ${stage} stage.`
      });
    }

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      temperature: 0.7,
      system: systemPrompt,
      messages: messages
    });

    const content = response.content[0]?.text || '';

    // Basic grammar feedback for advanced level
    let grammarFeedback = '';
    if (level === 'advanced') {
      grammarFeedback = generateBasicGrammarFeedback(studentMessage);
    }

    return {
      content,
      grammarFeedback,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0
      }
    };
  } catch (error) {
    console.error('Claude API Error:', error.message);
    
    // Fallback to mock response if API fails
    return getMockResponse({
      bookTitle,
      studentName,
      level,
      stage,
      turn,
      studentMessage
    });
  }
}

/**
 * Generate mock responses for testing when Claude API is unavailable
 * @private
 */
function getMockResponse({ bookTitle, studentName, level, stage, turn, studentMessage }) {
  const mockResponses = {
    title: {
      1: `That's a great title! I wonder what it means to you. What do you think the author wanted us to know from the title?`,
      2: `I love your thinking! Can you tell me why you feel that way about the title?`,
      3: `You've given this a lot of thought. Based on the title, what do you think will happen in this book?`
    },
    introduction: {
      1: `Wonderful! Tell me more about the main character. What are they like?`,
      2: `That's interesting! How would you describe the setting where this story takes place?`,
      3: `Great observations! What problem does the character face at the beginning?`
    },
    body: {
      1: `Can you give me your first reason why you feel that way? Remember to think about what happened in the book.`,
      2: `Excellent! Now, what's your second reason? How does it connect to the story?`,
      3: `I like that! For your third reason, can you think of another example from the book that supports your thinking?`
    },
    conclusion: {
      1: `What did this book teach you? Or what made you think about something new?`,
      2: `That's wonderful! Would you recommend this book to a friend? Why or why not?`,
      3: `Thank you so much for sharing your thoughts about this book. I really enjoyed learning what you think!`
    }
  };

  const stageResponses = mockResponses[stage] || mockResponses.title;
  const responseTemplate = stageResponses[turn] || stageResponses[3] || `Tell me more about that. What do you think?`;

  return {
    content: responseTemplate,
    grammarFeedback: '',
    isMock: true
  };
}

/**
 * Generate basic grammar feedback for student response
 * Analyzes common grammar issues appropriate for advanced level
 * @private
 */
function generateBasicGrammarFeedback(text) {
  const feedback = [];

  // Check for common issues
  if (text.split(' ').length < 5) {
    feedback.push('Try to express your complete thoughts. Add more detail!');
  }

  // Check for subject-verb agreement issues (very simple heuristic)
  if (text.toLowerCase().includes('the student are') || text.toLowerCase().includes('the book are')) {
    feedback.push('Remember: "The student IS" (singular), not "are".');
  }

  // Check for tense consistency
  const hasPresentAndPast = /\b(am|is|are|do|does)\b/.test(text) && /\b(was|were|did|had)\b/.test(text);
  if (hasPresentAndPast && text.split('.').length > 2) {
    feedback.push('Nice work! Your tenses are mixed - make sure each sentence is clear about when events happened.');
  }

  return feedback.length > 0 ? feedback.join(' ') : 'Great expression!';
}

export default {
  getAliceResponse,
  formatConversationHistory
};
