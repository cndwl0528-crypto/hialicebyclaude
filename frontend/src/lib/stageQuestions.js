/**
 * Stage-specific guide questions for the Q&A session
 * Each stage has a main guide question shown in a bubble (like the worksheet)
 * Body stage has 3 sub-questions
 *
 * These are default templates - the AI may adapt them based on the book
 */

export const STAGE_GUIDE = {
  warmup: {
    label: 'Warm-Up',
    guideQuestion: 'What kind of stories do you like?',
    description: 'Tell me about your reading preferences',
    example: 'e.g. I like adventure stories because they are exciting!',
    icon: '🌟',
    color: '#E8A87C',
  },
  'warm-up': {
    label: 'Warm-Up',
    guideQuestion: 'What kind of stories do you like?',
    description: 'Tell me about your reading preferences',
    example: 'e.g. I like adventure stories because they are exciting!',
    icon: '🌟',
    color: '#E8A87C',
  },
  title: {
    label: 'Title',
    guideQuestion: 'What is this book about?',
    description: 'Share what you think the book is about',
    example: 'e.g. This book is about a caterpillar that becomes a butterfly.',
    icon: '📖',
    color: '#4A90D9',
  },
  introduction: {
    label: 'Introduction',
    guideQuestion: 'Who is your favorite character? Why?',
    description: 'Tell me about the characters and setting',
    example: 'e.g. I would choose the caterpillar because it is brave.',
    icon: '👤',
    color: '#8B5CF6',
  },
  body: {
    label: 'Body',
    guideQuestion: 'Tell me 3 things about the story',
    description: 'Share your thoughts with 3 reasons',
    icon: '💭',
    color: '#F39C12',
    subQuestions: [
      {
        number: 1,
        question: 'What is the most important part of the story? Why?',
        example: 'e.g. The most important part is when the caterpillar eats all the food.',
      },
      {
        number: 2,
        question: 'What would you change about the story? Why?',
        example: 'e.g. I would add more animals because it would be more fun.',
      },
      {
        number: 3,
        question: 'What did you learn from this story?',
        example: 'e.g. Moreover, I learned that change can be beautiful.',
      },
    ],
  },
  conclusion: {
    label: 'Conclusion',
    guideQuestion: 'How do you feel about this book?',
    description: 'Share your final thoughts and feelings',
    example: 'e.g. Reading this book was really fun and I learned a lot.',
    icon: '⭐',
    color: '#27AE60',
  },
  reflection: {
    label: 'Reflection',
    guideQuestion: 'What helped you think about this book?',
    description: 'Think about HOW you think',
    example: 'e.g. I think using my imagination helped me the most.',
    icon: '🧠',
    color: '#9B59B6',
  },
};

/**
 * Get the current guide question based on stage and body sub-question index
 */
export function getCurrentGuideQuestion(stage, bodyIndex = 0) {
  // Normalize stage key to lowercase for consistent lookup
  const normalizedStage = stage ? stage.toLowerCase() : '';
  const stageData = STAGE_GUIDE[normalizedStage];
  if (!stageData) return { question: '', example: '' };

  if (normalizedStage === 'body' && stageData.subQuestions) {
    const sub = stageData.subQuestions[Math.min(bodyIndex, stageData.subQuestions.length - 1)];
    return {
      question: sub.question,
      example: sub.example,
      number: sub.number,
    };
  }

  return {
    question: stageData.guideQuestion,
    example: stageData.example,
  };
}

export default STAGE_GUIDE;
