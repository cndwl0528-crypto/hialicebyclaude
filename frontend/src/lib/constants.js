/**
 * HiAlice Constants
 * Centralized configuration for levels, stages, colors, and API settings
 */

export const LEVELS = {
  beginner: {
    id: 'beginner',
    label: 'Beginner',
    ageMin: 6,
    ageMax: 8,
    color: '#A8E6CF',
    description: 'Short sentences, picture-dependent books',
    icon: '🌱',
  },
  intermediate: {
    id: 'intermediate',
    label: 'Intermediate',
    ageMin: 9,
    ageMax: 11,
    color: '#FFD3B6',
    description: 'Chapter books, logical thinking begins',
    icon: '🌿',
  },
  advanced: {
    id: 'advanced',
    label: 'Advanced',
    ageMin: 12,
    ageMax: 13,
    color: '#F8B195',
    description: 'Complex narratives, critical thinking',
    icon: '🌳',
  },
};

export const STAGES = {
  title: {
    id: 'title',
    label: 'Title',
    order: 1,
    icon: '📖',
    description: 'Explore the title',
    instruction: 'What do you think the title means? Why did the author choose this title?',
  },
  introduction: {
    id: 'introduction',
    label: 'Introduction',
    order: 2,
    icon: '👋',
    description: 'Meet the characters',
    instruction: 'Who is the main character? How would you describe them?',
  },
  body: {
    id: 'body',
    label: 'Body',
    order: 3,
    icon: '💭',
    description: 'Share your thoughts',
    instruction: 'Can you give me three reasons why you think that? Let\'s start with your first reason.',
    maxReasons: 3,
  },
  conclusion: {
    id: 'conclusion',
    label: 'Conclusion',
    order: 4,
    icon: '⭐',
    description: 'Wrap up',
    instruction: 'What did this book teach you? Would you recommend it to a friend?',
  },
};

export const COLORS = {
  primary: '#4A90D9',
  primaryLight: '#6BA3E5',
  primaryDark: '#2E5AA6',
  background: '#F5F7FA',
  backgroundAlt: '#EAECEF',
  accent: '#F39C12',
  accentLight: '#F5AD3D',
  accentDark: '#D68910',
  success: '#27AE60',
  successLight: '#52BE80',
  successDark: '#1E8449',
  danger: '#E74C3C',
  dangerLight: '#EC7063',
  dangerDark: '#C0392B',
  textPrimary: '#2C3E50',
  textSecondary: '#7F8C8D',
  border: '#BDC3C7',
  borderLight: '#ECF0F1',
};

/**
 * API Configuration
 * Uses environment variable or defaults to localhost for development
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
export const API_TIMEOUT = 30000; // 30 seconds
export const API_VERSION = 'v1';

/**
 * Feature Flags
 */
export const FEATURES = {
  enableVoiceInput: true,
  enableTextInput: true,
  enableWordCloud: true,
  enableOfflineMode: false,
  enableGamification: false,
};

/**
 * UI Configuration
 */
export const UI = {
  touchTargetMinSize: 48, // pixels
  touchGapMinSize: 8, // pixels
  micButtonSize: 80, // pixels
  animationDuration: 300, // milliseconds
  debounceDelay: 300, // milliseconds
};

/**
 * Speech Configuration
 */
export const SPEECH = {
  language: 'en-US',
  maxRecordingDuration: 60000, // 1 minute in milliseconds
  silenceTimeout: 3000, // 3 seconds of silence
};

/**
 * Session Configuration
 */
export const SESSION = {
  maxTurnsPerStage: 3,
  stageTimeoutMinutes: 15,
  sessionTimeoutMinutes: 60,
};

/**
 * Helper function to get level by age
 */
export const getLevelByAge = (age) => {
  for (const [key, level] of Object.entries(LEVELS)) {
    if (age >= level.ageMin && age <= level.ageMax) {
      return key;
    }
  }
  return 'beginner'; // default
};

/**
 * Helper function to get stage by ID
 */
export const getStageById = (stageId) => {
  return Object.values(STAGES).find((stage) => stage.id === stageId);
};

/**
 * Helper function to get all stages in order
 */
export const getStagesInOrder = () => {
  return Object.values(STAGES).sort((a, b) => a.order - b.order);
};

/**
 * Helper function to get next stage
 */
export const getNextStage = (currentStageId) => {
  const stages = getStagesInOrder();
  const currentIndex = stages.findIndex((s) => s.id === currentStageId);
  return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;
};

/**
 * Helper function to check if stage is last
 */
export const isLastStage = (stageId) => {
  const stages = getStagesInOrder();
  return stages[stages.length - 1].id === stageId;
};

/**
 * Check if current user is a parent or admin (level info should be visible)
 */
export function isParentOrAdmin() {
  if (typeof window === 'undefined') return false;
  const role = sessionStorage.getItem('userRole');
  return ['parent', 'admin', 'super_admin'].includes(role);
}

export default {
  LEVELS,
  STAGES,
  COLORS,
  API_BASE,
  FEATURES,
  UI,
  SPEECH,
  SESSION,
  getLevelByAge,
  getStageById,
  getStagesInOrder,
  getNextStage,
  isLastStage,
};
