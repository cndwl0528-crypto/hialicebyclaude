/**
 * Stage-specific guide questions for the Q&A session
 * Each stage has a main guide question shown in a bubble (like the worksheet)
 * Body stage has 3 sub-questions
 *
 * These are default templates - the AI may adapt them based on the book
 */

export const STAGE_GUIDE = {
  warm_connection: {
    label: "Let's Say Hi!",
    guideQuestion: 'What kind of stories do you enjoy?',
    description: 'Let\'s warm up and get ready to talk about books!',
    example: 'e.g. I really love adventure stories because they are so exciting.',
    icon: '🌟',
    color: '#FF6B6B',
  },
  title: {
    label: 'About This Book',
    guideQuestion: 'What is this book about?',
    description: 'Share what you think the book is about',
    example: 'e.g. This book is about a caterpillar that becomes a butterfly.',
    icon: '📖',
    color: '#4A90D9',
  },
  introduction: {
    label: 'Meet the Characters',
    guideQuestion: 'Who is your favorite character? Why?',
    description: 'Tell me about the characters and setting',
    example: 'e.g. I would choose the caterpillar because it is brave.',
    icon: '👤',
    color: '#8B5CF6',
  },
  body: {
    label: 'Think Deeper',
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
    label: 'My Thoughts',
    guideQuestion: 'How do you feel about this book?',
    description: 'Share your final thoughts and feelings',
    example: 'e.g. Reading this book was really fun and I learned a lot.',
    icon: '⭐',
    color: '#27AE60',
  },
  cross_book: {
    label: 'Connect the Stories',
    guideQuestion: 'Does this book remind you of another book you have read?',
    description: 'Connect this story to other books you know and love',
    example: 'e.g. This book reminds me of Charlotte\'s Web because both stories have animal friends.',
    icon: '🔗',
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
