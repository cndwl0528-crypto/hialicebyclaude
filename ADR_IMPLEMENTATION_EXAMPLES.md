# ADR v1.0 Implementation Examples
## Code Snippets & Migration Patterns

This document provides concrete code examples for implementing each of the 6 refactorings outlined in the ADR.

---

## 1. SessionProvider & Context

### Before: 36 useState hooks

**File:** `frontend/src/app/session/page.js` (lines 179-217 + hidden in render)

```javascript
// BEFORE: Scattered useState declarations
const [bookId, setBookId] = useState(null);
const [bookTitle, setBookTitle] = useState('');
const [session, setSession] = useState(null);
const [sessionId, setSessionId] = useState(null);
const [messages, setMessages] = useState([]);
const [currentStage, setCurrentStage] = useState(0);
const [currentTurn, setCurrentTurn] = useState(0);
const [bodyReasonCount, setBodyReasonCount] = useState(0);
const [inputText, setInputText] = useState('');
const [loading, setLoading] = useState(false);
const [sessionComplete, setSessionComplete] = useState(false);
const [showStageTransition, setShowStageTransition] = useState(false);
const [nextStageName, setNextStageName] = useState('');
const [apiAvailable, setApiAvailable] = useState(true);
const [stageScores, setStageScores] = useState({});
const [sessionVocabulary, setSessionVocabulary] = useState([]);
const [sessionStartTime, setSessionStartTime] = useState(null);
const [error, setError] = useState(null);
const [showSkipButton, setShowSkipButton] = useState(false);
const [worksheetAnswers, setWorksheetAnswers] = useState({});
const [loadingPromptIndex, setLoadingPromptIndex] = useState(0);
// ... 16+ more (from useSpeech hook, UI overlays, etc.)
```

### After: SessionProvider & useSessionContext

**File 1: `frontend/src/session/providers/SessionProvider.jsx`**

```javascript
'use client';

import { createContext, useReducer, useCallback } from 'react';

export const SessionContext = createContext();

// Initial state shape
const initialState = {
  // Session metadata
  session: null,
  sessionId: null,
  bookId: null,
  bookTitle: '',
  sessionStartTime: null,
  sessionComplete: false,

  // Stage progression
  currentStage: {
    index: 0,
    key: 'warm_connection',  // 'title', 'introduction', 'body', 'conclusion', 'cross_book'
    turn: 1,
    maxTurns: 3,
  },
  bodyReasonCount: 0,  // For body stage specifically

  // Conversation
  messages: [],
  inputText: '',
  loading: false,
  apiAvailable: true,
  error: null,

  // Scores & analytics
  stageScores: {},  // { stage: score }
  sessionVocabulary: [],
  grammarFeedback: [],
  worksheetAnswers: {},

  // UI state
  ui: {
    showStageTransition: false,
    nextStageName: '',
    showSkipButton: false,
    loadingPromptIndex: 0,
    vocabCard: null,  // { word, definition, example }
    showConfetti: false,
    showAchievements: false,
    pendingAchievements: [],
  },

  // Voice state
  voice: {
    isListening: false,
    transcript: '',
    isFinal: false,
  },
};

// Reducer: centralized state updates
function sessionReducer(state, action) {
  switch (action.type) {
    // ---- Session initialization ----
    case 'INIT_SESSION':
      return {
        ...state,
        session: action.payload.session,
        sessionId: action.payload.sessionId,
        bookId: action.payload.bookId,
        bookTitle: action.payload.bookTitle,
        sessionStartTime: action.payload.startTime,
      };

    // ---- Stage progression ----
    case 'SET_CURRENT_STAGE':
      return {
        ...state,
        currentStage: action.payload,
      };

    case 'NEXT_STAGE':
      const nextIndex = state.currentStage.index + 1;
      const nextStageKey = STAGE_KEYS[nextIndex] || state.currentStage.key;
      return {
        ...state,
        currentStage: {
          ...state.currentStage,
          index: nextIndex,
          key: nextStageKey,
          turn: 1,
        },
        bodyReasonCount: 0,
        inputText: '',
      };

    case 'NEXT_TURN':
      return {
        ...state,
        currentStage: {
          ...state.currentStage,
          turn: Math.min(state.currentStage.turn + 1, state.currentStage.maxTurns),
        },
        bodyReasonCount: state.currentStage.key === 'body'
          ? state.bodyReasonCount + 1
          : 0,
        inputText: '',
      };

    // ---- Messages & conversation ----
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    case 'SET_INPUT_TEXT':
      return { ...state, inputText: action.payload };

    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    // ---- Scores ----
    case 'UPDATE_STAGE_SCORE':
      return {
        ...state,
        stageScores: {
          ...state.stageScores,
          [action.payload.stage]: action.payload.score,
        },
      };

    case 'SET_VOCABULARY':
      return {
        ...state,
        sessionVocabulary: action.payload,
      };

    // ---- UI state ----
    case 'SET_VOCAB_CARD':
      return {
        ...state,
        ui: { ...state.ui, vocabCard: action.payload },
      };

    case 'SHOW_CONFETTI':
      return {
        ...state,
        ui: { ...state.ui, showConfetti: true },
      };

    case 'HIDE_CONFETTI':
      return {
        ...state,
        ui: { ...state.ui, showConfetti: false },
      };

    case 'SHOW_ACHIEVEMENTS':
      return {
        ...state,
        ui: {
          ...state.ui,
          showAchievements: true,
          pendingAchievements: action.payload,
        },
      };

    case 'HIDE_ACHIEVEMENTS':
      return {
        ...state,
        ui: { ...state.ui, showAchievements: false, pendingAchievements: [] },
      };

    case 'SET_STAGE_TRANSITION':
      return {
        ...state,
        ui: {
          ...state.ui,
          showStageTransition: action.payload.show,
          nextStageName: action.payload.nextStageName || '',
        },
      };

    // ---- Voice state ----
    case 'SET_VOICE_LISTENING':
      return {
        ...state,
        voice: { ...state.voice, isListening: action.payload },
      };

    case 'SET_VOICE_TRANSCRIPT':
      return {
        ...state,
        voice: { ...state.voice, transcript: action.payload },
      };

    case 'SET_VOICE_FINAL':
      return {
        ...state,
        voice: { ...state.voice, isFinal: action.payload },
      };

    // ---- Session completion ----
    case 'COMPLETE_SESSION':
      return {
        ...state,
        sessionComplete: true,
      };

    // ---- Error handling ----
    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    default:
      return state;
  }
}

// Provider component
export function SessionProvider({ children }) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);

  // Convenience dispatchers (optional, for common actions)
  const dispatchers = {
    initSession: useCallback((sessionData) => {
      dispatch({ type: 'INIT_SESSION', payload: sessionData });
    }, []),

    addMessage: useCallback((message) => {
      dispatch({ type: 'ADD_MESSAGE', payload: message });
    }, []),

    nextStage: useCallback(() => {
      dispatch({ type: 'NEXT_STAGE' });
    }, []),

    nextTurn: useCallback(() => {
      dispatch({ type: 'NEXT_TURN' });
    }, []),

    setLoading: useCallback((loading) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    }, []),

    setVocabCard: useCallback((card) => {
      dispatch({ type: 'SET_VOCAB_CARD', payload: card });
    }, []),

    showConfetti: useCallback(() => {
      dispatch({ type: 'SHOW_CONFETTI' });
    }, []),

    completeSession: useCallback(() => {
      dispatch({ type: 'COMPLETE_SESSION' });
    }, []),
  };

  const value = {
    state,
    dispatch,
    ...dispatchers,  // Convenience methods
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export default SessionProvider;
```

**File 2: `frontend/src/session/hooks/useSessionContext.js`**

```javascript
import { useContext } from 'react';
import { SessionContext } from '../providers/SessionProvider';

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error(
      'useSessionContext must be used inside <SessionProvider>'
    );
  }
  return context;
}
```

**File 3: `frontend/src/app/session/page.js` (REFACTORED)**

```javascript
'use client';

import { useRouter } from 'next/navigation';
import SessionProvider from '@/session/providers/SessionProvider';
import FeatureGateProvider from '@/session/providers/FeatureGateProvider';
import StageRenderer from '@/session/components/StageRenderer';
import SessionComplete from '@/session/components/SessionComplete';

// Just a router/orchestrator
export default function SessionPage() {
  const router = useRouter();

  return (
    <SessionProvider>
      <FeatureGateProvider>
        <div className="session-container">
          <SessionContentWrapper />
        </div>
      </FeatureGateProvider>
    </SessionProvider>
  );
}

function SessionContentWrapper() {
  const { state } = useSessionContext();

  if (state.sessionComplete) {
    return <SessionComplete />;
  }

  return (
    <StageRenderer
      stageName={state.currentStage.key}
      turn={state.currentStage.turn}
    />
  );
}
```

### Migration Checklist

- [ ] Create SessionProvider.jsx with useReducer
- [ ] Define complete initialState shape
- [ ] Implement all action types in reducer
- [ ] Create useSessionContext hook
- [ ] Update SessionPage to use provider + context
- [ ] Unit test reducer with 30+ action/state combos
- [ ] Performance test: confirm no unnecessary re-renders (React DevTools)
- [ ] All existing tests still pass (behavior identical)

---

## 2. TaskAdapter & ModelStrategy Pattern

### Before: Monolithic engine.js

**File:** `backend/src/alice/engine.js` (lines 89-286)

```javascript
// BEFORE: Single function handles everything
export async function getAliceResponse({
  bookTitle, studentName, level, stage, turn, studentMessage, conversationHistory = [], ...
}) {
  if (!anthropic) return getMockResponse({ ... });

  const book = bookTitle ? { title: bookTitle } : { title: 'this book' };
  let systemPrompt = getSystemPrompt(book, studentName, level, stage, turn, { ... });
  const messages = formatConversationHistory(conversationHistory);
  if (studentMessage) messages.push({ role: 'user', content: studentMessage });

  const { model } = selectModel('session_response', { level, turn, historyLength: messages.length });
  const response = await anthropic.messages.create({
    model,
    max_tokens: 300,
    temperature: 0.7,
    system: systemPrompt,
    messages,
  });

  return {
    content: response.content[0]?.text || '',
    grammarFeedback: '',
    usage: response.usage,
  };
}
```

### After: TaskAdapter + ModelStrategy

**File 1: `backend/src/services/taskAdapters/TaskAdapter.js`**

```javascript
/**
 * Base class for all AI task adapters.
 * Subclasses implement the template method pattern:
 * execute() → buildPrompt() + selectModel() + callModel() + parseResponse()
 */
export class TaskAdapter {
  /**
   * Template method: orchestrates the full task execution.
   * Subclasses should not override this.
   */
  async execute(params, modelStrategy) {
    // 1. Build task-specific system prompt
    const systemPrompt = this.buildPrompt(params);

    // 2. Format conversation messages
    const messages = this.formatMessages(params);

    // 3. Select appropriate model for this task
    const { model, costMultiplier, strategy: selectedStrategy } = this.selectModel(params);

    // 4. Call the model via strategy
    const response = await modelStrategy.callModel({
      model,
      systemPrompt,
      messages,
      maxTokens: this.getMaxTokens(),
      strategy: selectedStrategy,
    });

    // 5. Parse and return task-specific result
    return this.parseResponse(response, params);
  }

  // ---- Subclass overrides ----

  buildPrompt(params) {
    throw new Error('Subclass must implement buildPrompt()');
  }

  formatMessages(params) {
    throw new Error('Subclass must implement formatMessages()');
  }

  selectModel(params) {
    throw new Error('Subclass must implement selectModel()');
  }

  getMaxTokens() {
    return 300;  // Default; override if needed
  }

  parseResponse(response, params) {
    throw new Error('Subclass must implement parseResponse()');
  }
}
```

**File 2: `backend/src/services/taskAdapters/SessionResponseAdapter.js`**

```javascript
import { TaskAdapter } from './TaskAdapter.js';
import { getSystemPrompt } from '../../alice/prompts.js';
import { selectModel } from '../modelRouter.js';
import { formatConversationHistory } from '../../alice/engine.js';

export class SessionResponseAdapter extends TaskAdapter {
  buildPrompt(params) {
    const { book, studentName, level, stage, turn, depthAnalysis } = params;
    return getSystemPrompt(book, studentName, level, stage, turn, { depthAnalysis });
  }

  formatMessages(params) {
    const { conversationHistory, studentMessage } = params;
    const messages = formatConversationHistory(conversationHistory);

    if (studentMessage && studentMessage.trim()) {
      messages.push({ role: 'user', content: studentMessage });
    }

    return messages;
  }

  selectModel(params) {
    const { level, turn, historyLength, budget = 'standard', featureMultiplier = 1.0 } = params;
    const { model, costMultiplier: baseCost } = selectModel('session_response', {
      level,
      turn,
      historyLength,
      budget,
    });

    return {
      model,
      costMultiplier: (baseCost || 1.0) * featureMultiplier,
      strategy: 'anthropic',  // Always use Anthropic for session responses
    };
  }

  getMaxTokens() {
    return 300;
  }

  parseResponse(response, params) {
    const content = response.content?.[0]?.text || '';

    // Generate grammar feedback for advanced students
    let grammarFeedback = '';
    if (params.level === 'advanced' && params.studentMessage) {
      grammarFeedback = generateBasicGrammarFeedback(params.studentMessage);
    }

    return {
      content,
      grammarFeedback,
      usage: response.usage,
      isMock: false,
    };
  }
}
```

**File 3: `backend/src/services/taskAdapters/DebateFacilitationAdapter.js`**

```javascript
import { TaskAdapter } from './TaskAdapter.js';
import { getDebateSystemPrompt } from '../../features/debate/debatePrompts.js';
import { selectModel } from '../modelRouter.js';

export class DebateFacilitationAdapter extends TaskAdapter {
  buildPrompt(params) {
    const { book, studentName, level, currentPosition, opposingView, turn } = params;
    return getDebateSystemPrompt({
      book,
      studentName,
      level,
      currentPosition,
      opposingView,
      turn,
    });
  }

  formatMessages(params) {
    const { conversationHistory, studentPosition } = params;
    // Format similar to session but include debate-specific context
    const messages = [];

    conversationHistory.forEach(d => {
      messages.push({
        role: d.speaker === 'student' ? 'user' : 'assistant',
        content: d.content,
      });
    });

    if (studentPosition) {
      messages.push({ role: 'user', content: studentPosition });
    }

    return messages;
  }

  selectModel(params) {
    const { level, budget = 'standard' } = params;

    // Debate always needs strong reasoning → prefer SONNET
    const { model } = selectModel('debate_facilitation', { level, budget });

    return {
      model,
      costMultiplier: 1.2,  // Debate costs 20% more
      strategy: 'anthropic',
    };
  }

  getMaxTokens() {
    return 400;  // More tokens for nuanced debate responses
  }

  parseResponse(response, params) {
    const content = response.content?.[0]?.text || '';

    // Extract counter-argument from debate response
    const counterArgument = this.extractCounterpoint(content);

    return {
      content,
      counterArgument,
      usage: response.usage,
      isMock: false,
    };
  }

  extractCounterpoint(text) {
    // Simple heuristic: look for "I disagree" or "However" or "On the other hand"
    const patterns = [
      /I(?:\s+would)?\s+(?:disagree|argue)[^.!?]*[.!?]/i,
      /However[^.!?]*[.!?]/i,
      /On the other hand[^.!?]*[.!?]/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }

    return null;  // No clear counter-argument found
  }
}
```

**File 4: `backend/src/services/modelStrategies/ModelStrategy.js`**

```javascript
export class ModelStrategy {
  async callModel({ model, systemPrompt, messages, maxTokens, strategy }) {
    throw new Error('Subclass must implement callModel()');
  }

  estimateCost(model, inputTokens, outputTokens) {
    throw new Error('Subclass must implement estimateCost()');
  }
}
```

**File 5: `backend/src/services/modelStrategies/HybridStrategy.js`**

```javascript
import { AnthropicStrategy } from './AnthropicStrategy.js';
import { LocalModelStrategy } from './LocalModelStrategy.js';

export class HybridStrategy extends ModelStrategy {
  constructor() {
    this.anthropic = new AnthropicStrategy(process.env.ANTHROPIC_API_KEY);
    this.local = process.env.LOCAL_MODEL_ENDPOINT
      ? new LocalModelStrategy('phi-3', process.env.LOCAL_MODEL_ENDPOINT)
      : null;
  }

  async callModel({ model, systemPrompt, messages, maxTokens, strategy = 'auto' }) {
    const selected = this.selectStrategy(model, strategy);
    return await selected.callModel({ model, systemPrompt, messages, maxTokens });
  }

  selectStrategy(model, strategy = 'auto') {
    if (strategy === 'local' && this.local) {
      return this.local;
    }
    if (strategy === 'anthropic') {
      return this.anthropic;
    }
    // Auto: route based on model name
    if (model.includes('phi') || model.includes('mistral')) {
      return this.local || this.anthropic;  // Use local if available
    }
    return this.anthropic;  // Default to Anthropic for Claude models
  }

  estimateCost(model, inputTokens, outputTokens, strategy = 'auto') {
    const selected = this.selectStrategy(model, strategy);
    return selected.estimateCost(model, inputTokens, outputTokens);
  }
}
```

**File 6: `backend/src/alice/engine.js` (REFACTORED)**

```javascript
import { SessionResponseAdapter } from '../services/taskAdapters/SessionResponseAdapter.js';
import { HybridStrategy } from '../services/modelStrategies/HybridStrategy.js';

const modelStrategy = new HybridStrategy();

export async function getAliceResponse(params) {
  try {
    const adapter = new SessionResponseAdapter();
    const response = await adapter.execute(params, modelStrategy);
    return response;
  } catch (error) {
    console.error('[Alice Engine] Error:', error.message);
    return getMockResponse(params);
  }
}

export async function getDebateResponse(params) {
  const { DebateFacilitationAdapter } = await import(
    '../services/taskAdapters/DebateFacilitationAdapter.js'
  );

  try {
    const adapter = new DebateFacilitationAdapter();
    const response = await adapter.execute(params, modelStrategy);
    return response;
  } catch (error) {
    console.error('[Alice Engine] Debate error:', error.message);
    return getMockDebateResponse(params);
  }
}

// ... rest of engine.js unchanged ...
```

### Migration Checklist

- [ ] Create TaskAdapter base class
- [ ] Implement SessionResponseAdapter
- [ ] Create ModelStrategy abstraction
- [ ] Implement AnthropicStrategy (wrapper around existing code)
- [ ] Implement LocalModelStrategy (stub for future)
- [ ] Create HybridStrategy
- [ ] Refactor engine.js to use adapters
- [ ] Unit test each adapter in isolation (20+ test cases)
- [ ] Integration test: new adapters produce identical responses to old code
- [ ] All existing tests pass

---

## 3. Feature Plugins

### Example: Debate Mode Plugin

**File 1: `frontend/src/features/debate/DebateModuleStageBody.jsx`**

```javascript
'use client';

import { useContext, useState, useCallback } from 'react';
import { SessionContext } from '@/session/providers/SessionProvider';
import VoiceButton from '@/components/VoiceButton';

const DEBATE_SUB_QUESTIONS = [
  "What's one reason this character's choice was RIGHT?",
  "What's one reason someone might DISAGREE with that choice?",
  "If you had to DEFEND the character's choice to someone who disagrees, what would you say?",
];

export default function DebateModuleStageBody() {
  const { state, dispatch, setLoading } = useContext(SessionContext);
  const { currentStage, messages, loading } = state;
  const [isListening, setIsListening] = useState(false);

  if (currentStage.key !== 'body') {
    return null;  // Only render for body stage
  }

  const turn = currentStage.turn;
  const question = DEBATE_SUB_QUESTIONS[turn - 1] || DEBATE_SUB_QUESTIONS[0];

  const handleDebateResponse = useCallback(async (text) => {
    if (!text.trim()) return;

    dispatch({ type: 'ADD_MESSAGE', payload: { role: 'student', content: text } });
    setLoading(true);

    try {
      const response = await fetch(`/api/sessions/${state.sessionId}/debate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentPosition: text,
          turn,
          sessionId: state.sessionId,
        }),
      });

      const data = await response.json();
      dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          role: 'assistant',
          content: data.content,
          counterArgument: data.counterArgument,
        },
      });
    } catch (error) {
      console.error('Debate error:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      setLoading(false);
    }
  }, [state.sessionId, turn, dispatch, setLoading]);

  return (
    <div className="debate-module">
      <h3 className="text-lg font-bold text-[#5C8B5C] mb-4">🤔 Debate Mode</h3>

      {/* Display debate-specific guidance */}
      <div className="bg-[#F0F8F0] border-l-4 border-[#5C8B5C] p-4 mb-4 rounded-lg">
        <p className="text-sm font-semibold text-[#3D2E1E]">
          {turn === 1 && "First, let's hear what you think is right about this choice."}
          {turn === 2 && "Now, let's think about what someone might disagree with."}
          {turn === 3 && "Finally, how would you defend this choice?"}
        </p>
      </div>

      {/* Question */}
      <div className="mb-6 p-4 bg-[#FFF8E8] rounded-lg border-l-4 border-[#D4A843]">
        <p className="text-base font-bold text-[#3D2E1E]">{question}</p>
      </div>

      {/* Voice or text input */}
      <div className="flex flex-col gap-3 items-center">
        <VoiceButton
          isListening={isListening}
          onStart={() => setIsListening(true)}
          onStop={(transcript) => {
            setIsListening(false);
            if (transcript) handleDebateResponse(transcript);
          }}
          disabled={loading}
          size={80}
        />
        <p className="text-sm text-[#5C8B5C] font-semibold">
          {isListening ? '🎙️ Listening to your debate argument...' : '🎤 Tap to give your argument'}
        </p>
      </div>

      {/* Display debate counter-arguments */}
      {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
        <div className="mt-6 p-4 bg-[#E8F5E8] rounded-lg border-l-4 border-[#27AE60]">
          <p className="text-sm font-semibold text-[#3D2E1E] mb-2">Alice's Response:</p>
          <p className="text-sm text-[#3D2E1E]">{messages[messages.length - 1].content}</p>

          {messages[messages.length - 1].counterArgument && (
            <div className="mt-3 p-3 bg-[#FFF8E8] rounded border border-[#D4A843]">
              <p className="text-xs font-bold text-[#A8822E] mb-1">🤔 Counter-argument:</p>
              <p className="text-xs text-[#A8822E]">
                {messages[messages.length - 1].counterArgument}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**File 2: `frontend/src/features/debate/debatePrompts.js`**

```javascript
export function getDebateSystemPrompt({
  book,
  studentName,
  level,
  currentPosition,
  opposingView,
  turn,
}) {
  const levelDesc = {
    beginner: '6-8 years old, beginner level',
    intermediate: '9-11 years old, intermediate level',
    advanced: '12-13 years old, advanced level',
  }[level] || 'intermediate level';

  return `You are HiAlice, an encouraging debate facilitator for a child reader.

STUDENT: ${studentName}, ${levelDesc}
BOOK: "${book.title}"
DEBATE MODE - Turn ${turn}/3

${turn === 1 ? `
TURN 1: ${studentName} should explain why a character's choice was justified or right.
Help them build a positive argument. Don't play devil's advocate yet — just help them articulate the case FOR the choice.
CRITICAL: Validate their reasoning. Ask follow-up questions that strengthen their argument.
Example follow-up: "That's a great point! What part of the story supports that?"
` : ''}

${turn === 2 ? `
TURN 2: Help ${studentName} see the opposing view. Ask them to imagine someone who disagreed with the character's choice.
CRITICAL: Don't say their previous argument was wrong! Say "That's a strong argument. Now let's play with another angle..."
Example: "Interesting perspective. What would someone who was angry at this choice say?"
` : ''}

${turn === 3 ? `
TURN 3: ${studentName} should now defend their original argument AGAINST the opposing view.
This is where they synthesize both sides.
Example: "You've understood both sides really well! How would you convince someone who disagreed?"
` : ''}

TONE: Warm, curious, never dismissive. This is a thinking exercise, not a competition.
RULES:
- NEVER say "you're wrong"
- ALWAYS validate the direction of their thinking
- ASK QUESTIONS that deepen their thinking
- For ${level}: Keep vocabulary and sentence length age-appropriate`;
}
```

### Migration Checklist

- [ ] Create features/ directory structure
- [ ] Implement DebateModuleStageBody.jsx component
- [ ] Create debatePrompts.js with system prompt builder
- [ ] Register plugin in featurePlugins.js
- [ ] Create FEATURE_GATE for DEBATE_MODE
- [ ] Backend: Create DebateFacilitationAdapter
- [ ] Backend: Add /api/sessions/:id/debate route
- [ ] Unit tests: Plugin renders only when feature enabled
- [ ] Integration tests: Full debate flow (ask 3 questions, get responses)
- [ ] Smoke test: Standard body stage still works when debate disabled

---

## 4. Feature Flags & Progressive Disclosure

### Feature Gates Configuration

**File: `frontend/src/lib/featureGates.js`**

```javascript
export const FEATURE_GATES = {
  DEBATE_MODE: {
    enabled: process.env.NEXT_PUBLIC_DEBATE_ENABLED === 'true',
    minLevel: 'intermediate',
    ageGate: { min: 9, max: 13 },
    costMultiplier: 1.2,
    description: 'Multi-perspective debate for deeper critical thinking',
  },
  STORY_STUDIO: {
    enabled: process.env.NEXT_PUBLIC_STORY_STUDIO_ENABLED === 'true',
    minLevel: 'intermediate',
    ageGate: { min: 8, max: 13 },
    costMultiplier: 1.5,
    description: 'AI-powered creative writing tool',
  },
  PRE_READING: {
    enabled: process.env.NEXT_PUBLIC_PRE_READING_ENABLED === 'true',
    minLevel: 'beginner',
    ageGate: { min: 6, max: 13 },
    costMultiplier: 0.8,
    description: 'Prepare for reading with preview questions',
  },
  ADAPTIVE_ENGINE: {
    enabled: process.env.NEXT_PUBLIC_ADAPTIVE_ENABLED === 'true',
    minLevel: 'beginner',
    ageGate: { min: 6, max: 13 },
    costMultiplier: 0.4,  // Lightweight analysis
    requires: ['session_count_5'],  // Requires 5+ sessions
    description: 'Dynamically adjust difficulty based on performance',
  },
  SOCIAL_READING: {
    enabled: process.env.NEXT_PUBLIC_SOCIAL_READING_ENABLED === 'true',
    minLevel: 'intermediate',
    ageGate: { min: 9, max: 13 },
    costMultiplier: 0.3,  // Just data aggregation
    requiresParentConsent: true,
    coppaGate: 13,  // Requires parent consent for <13
    description: 'Connect with other young readers',
  },
  PARENT_HUB: {
    enabled: process.env.NEXT_PUBLIC_PARENT_HUB_ENABLED === 'true',
    requiredRole: 'parent',
    costMultiplier: 0,  // Parent-only, no student API costs
    description: 'Parent dashboard for student progress',
  },
  B2B_ACADEMY: {
    enabled: process.env.NEXT_PUBLIC_B2B_ACADEMY_ENABLED === 'true',
    requiredRole: 'teacher|admin',
    costMultiplier: 0,  // Teacher-only
    description: 'Teacher management and class tools',
  },
};

export function isFeatureAvailable(featureKey, student, userRole = null) {
  const gate = FEATURE_GATES[featureKey];
  if (!gate?.enabled) return false;

  // Role-gated features
  if (gate.requiredRole) {
    const requiredRoles = gate.requiredRole.split('|');
    return requiredRoles.includes(userRole);
  }

  // Age-gated features
  if (gate.ageGate && student?.age) {
    const { min, max } = gate.ageGate;
    if (student.age < min || student.age > max) return false;
  }

  // Level-gated features
  if (gate.minLevel && student?.level) {
    const levels = { beginner: 1, intermediate: 2, advanced: 3 };
    if (levels[student.level] < levels[gate.minLevel]) return false;
  }

  // COPPA compliance: parental consent for social features on <13
  if (gate.coppaGate && student?.age < gate.coppaGate) {
    if (!student?.parentConsent) return false;
  }

  // Prerequisite requirements
  if (gate.requires) {
    for (const req of gate.requires) {
      if (req === 'session_count_5' && (student?.sessionCount || 0) < 5) {
        return false;
      }
      // Add more complex prerequisites as needed
    }
  }

  return true;
}

export function getCostMultiplier(features = []) {
  let multiplier = 1.0;
  for (const featureKey of features) {
    const gate = FEATURE_GATES[featureKey];
    if (gate?.costMultiplier) {
      multiplier *= gate.costMultiplier;
    }
  }
  return multiplier;
}
```

**File: `frontend/src/session/providers/FeatureGateProvider.jsx`**

```javascript
'use client';

import { createContext, useMemo } from 'react';
import { FEATURE_GATES, isFeatureAvailable } from '@/lib/featureGates';
import { getItem } from '@/lib/clientStorage';

export const FeatureGateContext = createContext();

export function FeatureGateProvider({ children }) {
  // Get current student/user context
  const studentAge = parseInt(getItem('studentAge') || '8', 10);
  const studentLevel = getItem('studentLevel') || 'beginner';
  const studentSessionCount = parseInt(getItem('studentSessionCount') || '0', 10);
  const parentConsent = getItem('parentConsent') === 'true';
  const userRole = getItem('userRole') || 'student';

  const activeFeatures = useMemo(() => {
    const student = {
      age: studentAge,
      level: studentLevel,
      sessionCount: studentSessionCount,
      parentConsent,
    };

    return Object.entries(FEATURE_GATES)
      .filter(([key]) => isFeatureAvailable(key, student, userRole))
      .map(([key]) => key);
  }, [studentAge, studentLevel, studentSessionCount, parentConsent, userRole]);

  const value = {
    activeFeatures,
    FEATURE_GATES,
    isFeatureAvailable: (featureKey) =>
      activeFeatures.includes(featureKey),
  };

  return (
    <FeatureGateContext.Provider value={value}>
      {children}
    </FeatureGateContext.Provider>
  );
}
```

### Migration Checklist

- [ ] Create featureGates.js with all 7+ features
- [ ] Implement isFeatureAvailable() function
- [ ] Implement getCostMultiplier() for cost tracking
- [ ] Create FeatureGateProvider with context
- [ ] Add feature gate checks to NavBarProgressive
- [ ] Add COPPA compliance checks for SOCIAL_READING
- [ ] Unit tests: All 32+ combinations of (feature, age, role, consent)
- [ ] Integration tests: Features hide/show based on gates

---

## 5. Enhanced Cost Tracking

**File: `backend/src/services/modelRouter.js` (ENHANCED)**

```javascript
// Track costs per feature, per model
export class CostTracker {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.totalCost = 0;
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.callCount = 0;

    this.modelBreakdown = {};  // per model
    this.featureBreakdown = {};  // per feature (DEBATE_MODE, STORY_STUDIO, etc.)
    this.taskBreakdown = {};    // per task type (session_response, debate_facilitation, etc.)
  }

  recordWithFeature(model, inputTokens, outputTokens, feature = null, taskType = null, costMultiplier = 1.0) {
    const pricing = PRICING[model] || PRICING[MODELS.SONNET];

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    let callCost = (inputCost + outputCost) * costMultiplier;

    // Update totals
    this.totalCost += callCost;
    this.totalInputTokens += inputTokens;
    this.totalOutputTokens += outputTokens;
    this.callCount += 1;

    // Update model breakdown
    if (!this.modelBreakdown[model]) {
      this.modelBreakdown[model] = { calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
    }
    this.modelBreakdown[model].calls += 1;
    this.modelBreakdown[model].inputTokens += inputTokens;
    this.modelBreakdown[model].outputTokens += outputTokens;
    this.modelBreakdown[model].cost += callCost;

    // Update feature breakdown
    if (feature) {
      if (!this.featureBreakdown[feature]) {
        this.featureBreakdown[feature] = { calls: 0, cost: 0 };
      }
      this.featureBreakdown[feature].calls += 1;
      this.featureBreakdown[feature].cost += callCost;
    }

    // Update task breakdown
    if (taskType) {
      if (!this.taskBreakdown[taskType]) {
        this.taskBreakdown[taskType] = { calls: 0, cost: 0 };
      }
      this.taskBreakdown[taskType].calls += 1;
      this.taskBreakdown[taskType].cost += callCost;
    }

    return {
      callCost,
      totalCost: this.totalCost,
      costBreakdown: {
        inputCost: inputCost * costMultiplier,
        outputCost: outputCost * costMultiplier,
      },
    };
  }

  getSummary() {
    return {
      sessionId: this.sessionId,
      totalCost: parseFloat(this.totalCost.toFixed(4)),
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalTokens: this.totalInputTokens + this.totalOutputTokens,
      callCount: this.callCount,
      costPerCall: parseFloat((this.totalCost / this.callCount).toFixed(4)),

      modelBreakdown: this.modelBreakdown,
      featureBreakdown: this.featureBreakdown,
      taskBreakdown: this.taskBreakdown,

      // Percentages
      featurePercentages: this.calculatePercentages(this.featureBreakdown),
    };
  }

  calculatePercentages(breakdown) {
    const percentages = {};
    for (const [key, data] of Object.entries(breakdown)) {
      percentages[key] = parseFloat(((data.cost / this.totalCost) * 100).toFixed(1));
    }
    return percentages;
  }
}
```

### Example Cost Summary

```json
{
  "sessionId": "sess-xyz-123",
  "totalCost": 0.2847,
  "totalInputTokens": 4250,
  "totalOutputTokens": 1890,
  "totalTokens": 6140,
  "callCount": 9,
  "costPerCall": 0.0316,
  "modelBreakdown": {
    "claude-haiku-4-5-20251001": {
      "calls": 3,
      "inputTokens": 1200,
      "outputTokens": 450,
      "cost": 0.0058
    },
    "claude-sonnet-4-20250514": {
      "calls": 6,
      "inputTokens": 3050,
      "outputTokens": 1440,
      "cost": 0.2789
    }
  },
  "featureBreakdown": {
    "base_session": {
      "calls": 9,
      "cost": 0.2847
    }
  },
  "taskBreakdown": {
    "session_response": {
      "calls": 6,
      "cost": 0.2200
    },
    "feedback": {
      "calls": 2,
      "cost": 0.0098
    },
    "rephrase": {
      "calls": 1,
      "cost": 0.0025
    }
  },
  "featurePercentages": {
    "base_session": 100
  }
}
```

### Migration Checklist

- [ ] Enhance CostTracker with feature/task breakdown
- [ ] Update getAliceResponse() to track feature + task
- [ ] Add cost tracking to adapter.execute() calls
- [ ] Backend: Log cost summary per session
- [ ] Frontend: Display cost estimate (parent/teacher view only)
- [ ] Tests: Verify cost calculations for 5+ task types
- [ ] Monitoring: Alert if session cost > $1.00

---

## Testing Examples

### Unit Test: SessionReducer

**File: `frontend/src/session/providers/__tests__/SessionProvider.test.js`**

```javascript
import { sessionReducer, initialState } from '../SessionProvider';

describe('sessionReducer', () => {
  it('should handle INIT_SESSION action', () => {
    const action = {
      type: 'INIT_SESSION',
      payload: {
        session: { id: 'sess-1' },
        sessionId: 'sess-1',
        bookId: 'book-1',
        bookTitle: 'Charlotte\'s Web',
        startTime: Date.now(),
      },
    };

    const newState = sessionReducer(initialState, action);

    expect(newState.sessionId).toBe('sess-1');
    expect(newState.bookTitle).toBe('Charlotte\'s Web');
  });

  it('should handle NEXT_TURN action', () => {
    const state = {
      ...initialState,
      currentStage: { index: 0, key: 'title', turn: 1, maxTurns: 3 },
    };

    const action = { type: 'NEXT_TURN' };
    const newState = sessionReducer(state, action);

    expect(newState.currentStage.turn).toBe(2);
  });

  it('should increment bodyReasonCount on NEXT_TURN when in body stage', () => {
    const state = {
      ...initialState,
      currentStage: { index: 3, key: 'body', turn: 1, maxTurns: 3 },
      bodyReasonCount: 0,
    };

    const action = { type: 'NEXT_TURN' };
    const newState = sessionReducer(state, action);

    expect(newState.bodyReasonCount).toBe(1);
  });

  it('should handle ADD_MESSAGE action', () => {
    const state = { ...initialState, messages: [] };
    const action = {
      type: 'ADD_MESSAGE',
      payload: { role: 'student', content: 'Hello!' },
    };

    const newState = sessionReducer(state, action);

    expect(newState.messages.length).toBe(1);
    expect(newState.messages[0].content).toBe('Hello!');
  });

  it('should handle SET_VOCAB_CARD action', () => {
    const card = { word: 'metamorphosis', definition: 'A big change' };
    const action = { type: 'SET_VOCAB_CARD', payload: card };

    const newState = sessionReducer(initialState, action);

    expect(newState.ui.vocabCard).toEqual(card);
  });

  it('should handle NEXT_STAGE action', () => {
    const state = {
      ...initialState,
      currentStage: { index: 0, key: 'title', turn: 3, maxTurns: 3 },
      bodyReasonCount: 2,
    };

    const action = { type: 'NEXT_STAGE' };
    const newState = sessionReducer(state, action);

    expect(newState.currentStage.index).toBe(1);
    expect(newState.currentStage.turn).toBe(1);
    expect(newState.bodyReasonCount).toBe(0);
  });
});
```

### Integration Test: Feature Plugin

**File: `frontend/src/features/debate/__tests__/DebateModuleStageBody.test.jsx`**

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import DebateModuleStageBody from '../DebateModuleStageBody';
import { SessionContext } from '@/session/providers/SessionProvider';

describe('DebateModuleStageBody', () => {
  const mockContextValue = {
    state: {
      currentStage: { key: 'body', turn: 1 },
      sessionId: 'sess-1',
      messages: [],
      loading: false,
    },
    dispatch: jest.fn(),
    setLoading: jest.fn(),
  };

  it('should render only when currentStage.key is "body"', () => {
    const contextWithDifferentStage = {
      ...mockContextValue,
      state: { ...mockContextValue.state, currentStage: { key: 'title', turn: 1 } },
    };

    const { container } = render(
      <SessionContext.Provider value={contextWithDifferentStage}>
        <DebateModuleStageBody />
      </SessionContext.Provider>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render debate question for turn 1', () => {
    render(
      <SessionContext.Provider value={mockContextValue}>
        <DebateModuleStageBody />
      </SessionContext.Provider>
    );

    expect(screen.getByText(/What's one reason this character's choice was RIGHT/i)).toBeInTheDocument();
  });

  it('should render debate question for turn 2', () => {
    const contextTurn2 = {
      ...mockContextValue,
      state: { ...mockContextValue.state, currentStage: { key: 'body', turn: 2 } },
    };

    render(
      <SessionContext.Provider value={contextTurn2}>
        <DebateModuleStageBody />
      </SessionContext.Provider>
    );

    expect(screen.getByText(/What's one reason someone might DISAGREE/i)).toBeInTheDocument();
  });

  it('should dispatch ADD_MESSAGE on voice input', async () => {
    render(
      <SessionContext.Provider value={mockContextValue}>
        <DebateModuleStageBody />
      </SessionContext.Provider>
    );

    // Simulate voice input (mocked in test)
    const voiceButton = screen.getByRole('button');
    fireEvent.click(voiceButton);

    // In real test, mock useSpeech hook to return transcript
    // Then simulate voice stop event
  });
});
```

---

## Deployment Checklist

- [ ] All code reviewed by architecture + backend + frontend leads
- [ ] Unit test coverage: ≥75%
- [ ] Integration tests pass: SessionProvider + components + plugins
- [ ] Performance profiling: No unexpected re-renders, bundle size OK
- [ ] Security audit: COPPA compliance verified, server-side role validation
- [ ] Feature flags tested: All features can be disabled
- [ ] Rollback plan documented and tested
- [ ] Monitoring set up: Cost per session, error rates, latency
- [ ] Documentation: ADR + implementation guide + runbook
- [ ] A/B test plan: 10% → 20% → 50% → 100% rollout

---

**Document Version:** 1.0
**Created:** 2026-03-14
**Status:** Reference Implementation (not production code)
