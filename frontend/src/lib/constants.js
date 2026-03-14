/**
 * HiMax Constants
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
  warm_connection: {
    id: 'warm_connection',
    label: "Let's Say Hi!",
    order: 1,
    icon: '🌟',
    description: 'Warm up and connect',
    instruction: 'What kind of stories do you enjoy?',
  },
  title: {
    id: 'title',
    label: 'About This Book',
    order: 2,
    icon: '📖',
    description: 'Explore the title',
    instruction: 'What do you think the title means? Why did the author choose this title?',
  },
  introduction: {
    id: 'introduction',
    label: 'Meet the Characters',
    order: 3,
    icon: '👤',
    description: 'Meet the characters',
    instruction: 'Who is the main character? How would you describe them?',
  },
  body: {
    id: 'body',
    label: 'Think Deeper',
    order: 4,
    icon: '💭',
    description: 'Share your thoughts',
    instruction: 'Can you give me three reasons why you think that? Let\'s start with your first reason.',
    maxReasons: 3,
  },
  conclusion: {
    id: 'conclusion',
    label: 'My Thoughts',
    order: 5,
    icon: '⭐',
    description: 'Wrap up',
    instruction: 'What did this book teach you? Would you recommend it to a friend?',
  },
  cross_book: {
    id: 'cross_book',
    label: 'Connect the Stories',
    order: 6,
    icon: '🔗',
    description: 'Connect to other books',
    instruction: 'Does this book remind you of another book you have read?',
  },
};

export const COLORS = {
  // Primary — Ghibli forest green (replaces old blue #4A90D9)
  primary: '#5C8B5C',
  primaryLight: '#7AAE7A',
  primaryDark: '#3D6B3D',
  // Background — warm cream palette (replaces cold grey #F5F7FA)
  background: '#F5F0E8',
  backgroundAlt: '#EDE5D4',
  // Accent — Ghibli gold (replaces old orange #F39C12)
  accent: '#D4A843',
  accentLight: '#E8C46A',
  accentDark: '#A8822E',
  // Success — soft leaf green
  success: '#7AC87A',
  successLight: '#9ED89E',
  successDark: '#5CAF5C',
  // Danger — warm rose (replaces harsh red #E74C3C; child-friendly)
  danger: '#D4736B',
  dangerLight: '#E09891',
  dangerDark: '#B85A53',
  // Text — warm bark tones (replaces cold grey-blue #2C3E50 / #7F8C8D)
  textPrimary: '#3D2E1E',
  textSecondary: '#9C8B74',
  // Borders — warm parchment tones (replaces cold grey #BDC3C7)
  border: '#D6C9A8',
  borderLight: '#E8DEC8',
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
  const role = getItem('userRole');
  return ['parent', 'admin', 'super_admin'].includes(role);
}

const constants = {
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

export default constants;
import { getItem } from './clientStorage';
