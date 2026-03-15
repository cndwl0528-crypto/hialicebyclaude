# Architecture Decision Record (ADR) v1.0
## HiAlice Flexible Transitional Architecture for Feature Hybrid Upgrades

**Date:** March 2026
**Status:** PROPOSED
**Authors:** Architecture Review Team
**Scope:** Refactoring session/page.js monolith + backend service decoupling for 7+ new features

---

## Executive Summary

HiAlice is at an inflection point: the 1,451-line session/page.js component contains 36 useState hooks and handles all core Q&A flows monolithically. To support 7+ planned features (Pre-Reading, Debate Mode, Story Studio, Social Reading, Adaptive Engine, B2B Academy, Parent Hub) **without breaking the 6-13 child UX**, we propose a **flexible, transitional architecture** that:

1. **Decomposes session/page.js** into composable, context-driven modules
2. **Introduces a plugin system** with FEATURE_GATES for safe feature rollout
3. **Refactors backend services** (engine.js, prompts.js, modelRouter.js) into adapter/strategy patterns
4. **Implements progressive disclosure navigation** with age-gating
5. **Migrates state management** from scattered useState to Context API + Zustand
6. **Enhances cost tracking** to support fine-tuned model routing

This ADR prioritizes **non-breaking changes**, **incremental migration**, and **child-first UX**. All proposals are feasible within 4-6 weeks with the existing tech stack.

---

## 1. Session/Page.js Decomposition Strategy

### 1.1 Current State Analysis

**File:** `/sessions/loving-dreamy-lamport/mnt/hi-alice/frontend/src/app/session/page.js` (1,451 lines)

**Problem:**
- **36 useState hooks** (lines 179-217 + implicit within component body):
  - Conversation/UI state: `bookId`, `bookTitle`, `session`, `sessionId`, `messages`, `currentStage`, `currentTurn`, `bodyReasonCount`, `inputText`, `loading`, `sessionComplete`, `showStageTransition`, `nextStageName`, `apiAvailable`, `stageScores`, `sessionVocabulary`, `sessionStartTime`, `error`, `showSkipButton`, `worksheetAnswers`, `loadingPromptIndex`, etc.
  - Voice/speech state: `isListening`, `transcript`, `isFinal` (from useSpeech hook)
  - UI overlays: `vocabCard`, `showConfetti`, `pendingAchievements`, `showAchievements`

- **Mixed concerns:** Q&A logic, voice handling, score calculation, vocabulary extraction, confetti triggers, achievement detection all intermingled
- **Hard to test:** Component render path depends on complex conditional chains (isBeginnerMode, isAdvancedMode, isIntermediateMode)
- **Feature blocker:** Adding Debate Mode, Story Studio, or Pre-Reading requires surgical changes to 50+ lines of logic

**Specific Line References:**
- Lines 179-217: Initial useState declarations
- Lines 418-481: useEffect for session initialization (complex)
- Lines 507-600: sendMessage function (161 lines of callback logic)
- Lines 800-900: Complex conditional rendering for input areas (beginner/intermediate/advanced variants)
- Lines 950-1050: Worksheet answer tracking and score calculation

### 1.2 Proposed Decomposition

**Create 5 new composable modules (~/src/app/session/):**

```
session/
├── page.js                          # Router/orchestrator (150 lines)
├── hooks/
│   ├── useSessionState.js          # Core session logic hook
│   ├── useVoiceInput.js            # Voice state (from useSpeech)
│   ├── useStageProgression.js      # Stage/turn tracking
│   └── useSessionAnalytics.js      # Score/vocab tracking
├── providers/
│   ├── SessionProvider.jsx         # React Context for shared state
│   ├── FeatureGateProvider.jsx     # Feature flag injection
│   └── AnalyticsProvider.jsx       # Cost/telemetry
├── components/
│   ├── StageRenderer.jsx           # Renders current stage UI (dynamic)
│   ├── VoicePanel.jsx              # Voice input (beginner-focused)
│   ├── TextInputPanel.jsx          # Text input (advanced-focused)
│   ├── HybridInputPanel.jsx        # Combined (intermediate)
│   ├── VocabSidebar.jsx            # JIT vocab card display
│   ├── AchievementOverlay.jsx      # Achievement modal
│   ├── SessionComplete.jsx         # End-of-session flow
│   └── PluginSlot.jsx              # Feature plugin mount point
└── utils/
    ├── sessionHandlers.js          # Message sending, stage transitions
    └── featurePlugins.js           # Plugin registry/loader
```

**SessionProvider Context Shape:**

```javascript
// Replaces 36+ useState declarations
const SessionContext = {
  // Core session state
  session: { id, studentId, bookId, startTime },
  currentStage: { index, key, maxTurns, currentTurn },
  messages: [],
  loading: boolean,
  error: null,

  // Score/analytics
  stageScores: { [stageKey]: score },
  sessionVocabulary: [],
  grammarFeedback: [],

  // UI state
  ui: {
    showStageTransition: boolean,
    vocabCard: { word, definition } | null,
    showConfetti: boolean,
    showAchievements: boolean,
  },

  // Voice state
  voice: {
    isListening: boolean,
    transcript: string,
    isFinal: boolean,
  },

  // Dispatch functions
  dispatch: {
    sendMessage: (text) => Promise,
    nextStage: () => void,
    skipTurn: () => void,
    completeSession: () => Promise,
    // ...
  }
};
```

**Benefits:**
- **Eliminates prop drilling** through 5 levels of nested components
- **Testable in isolation:** Each hook/component has clear input/output
- **Feature-friendly:** New features inject via PluginSlot, don't touch core
- **Maintainable:** 36 scattered setState calls consolidated into 1 dispatch interface

### 1.3 Before/After Component Tree

**BEFORE (Monolithic):**
```
SessionPage (1,451 lines)
  ├── Conditional: isBeginnerMode
  │   ├── VoiceButton (primary)
  │   └── Optional TextInput
  ├── Conditional: isAdvancedMode
  │   ├── TextInput (primary)
  │   └── VoiceButton (secondary)
  ├── ConfettiCelebration
  ├── AchievementUnlock
  └── VocabMiniCard
  [All logic, state, handlers in one component]
```

**AFTER (Modular):**
```
SessionPage (150 lines — router only)
  └── <SessionProvider>
        └── <FeatureGateProvider>
              ├── <StageRenderer key={stage}>
              │   ├── StageContent (props: stage, turn)
              │   ├── <InputPanel stage={stage}>
              │   │   └── <VoicePanel | TextPanel | HybridPanel>
              │   └── <PluginSlot name="stage-${stage}">
              ├── <VocabSidebar>
              ├── <AchievementOverlay>
              ├── <ConfettiCelebration>
              └── <PluginSlot name="session-footer">
```

### 1.4 Migration Path (Non-Breaking)

**Phase 1 (Week 1):** Create SessionProvider + hooks, SessionPage routes to it
- New file: `session/providers/SessionProvider.jsx`
- New file: `session/hooks/useSessionState.js`
- Keep old SessionPage logic; wrap output in SessionProvider
- Tests pass: old behavior preserved

**Phase 2 (Week 2):** Extract StageRenderer + input components
- Move conditional rendering logic into StageRenderer.jsx
- Create VoicePanel, TextInputPanel, HybridInputPanel
- Session state still lives in context, components just read/dispatch
- Swap old hardcoded UI with new modular components

**Phase 3 (Week 3):** Migrate useState to Context
- For each useState, move to SessionContext + dispatch action
- Update all setState calls to dispatch(action)
- Keep identical behavior; just refactor state location
- Tests pass: functionality preserved

**Phase 4 (Week 4):** Wire up PluginSlot components
- Implement FeatureGateProvider
- Create plugin registry (featurePlugins.js)
- Add PluginSlot components to render tree
- Ready for new features to inject

---

## 2. Plugin Architecture for New Features

### 2.1 Plugin System Design

**Goal:** Add Debate Mode, Story Studio, Pre-Reading, etc. **without touching core session flow**.

**Core Concept: FEATURE_GATES + Lazy Loading**

```javascript
// ~/src/lib/featureGates.js
export const FEATURE_GATES = {
  DEBATE_MODE: {
    enabled: process.env.NEXT_PUBLIC_DEBATE_ENABLED === 'true',
    minLevel: 'intermediate',  // 9+ years old
    ageGate: { min: 9, max: 13 },
    costMultiplier: 1.2,       // Debate uses more API calls
  },
  STORY_STUDIO: {
    enabled: process.env.NEXT_PUBLIC_STORY_STUDIO_ENABLED === 'true',
    minLevel: 'intermediate',
    ageGate: { min: 8, max: 13 },
    costMultiplier: 1.5,       // Story generation is expensive
  },
  PRE_READING: {
    enabled: process.env.NEXT_PUBLIC_PRE_READING_ENABLED === 'true',
    minLevel: 'beginner',
    ageGate: { min: 6, max: 13 },
    costMultiplier: 0.8,       // Lightweight
  },
  ADAPTIVE_ENGINE: {
    enabled: process.env.NEXT_PUBLIC_ADAPTIVE_ENABLED === 'true',
    minLevel: 'beginner',
    ageGate: { min: 6, max: 13 },
    requires: ['analytics_session_5'],  // Requires 5 sessions of data
  },
  SOCIAL_READING: {
    enabled: process.env.NEXT_PUBLIC_SOCIAL_READING_ENABLED === 'true',
    minLevel: 'intermediate',
    ageGate: { min: 9, max: 13 },
    requiresParentConsent: true,  // COPPA
  },
  PARENT_HUB: {
    enabled: process.env.NEXT_PUBLIC_PARENT_HUB_ENABLED === 'true',
    minLevel: null,  // Parent-facing, not student-level gated
    requiredRole: 'parent',
  },
  B2B_ACADEMY: {
    enabled: process.env.NEXT_PUBLIC_B2B_ACADEMY_ENABLED === 'true',
    minLevel: null,
    requiredRole: 'teacher|admin',
  },
};

// Helper function
export function isFeatureAvailable(featureKey, student) {
  const gate = FEATURE_GATES[featureKey];
  if (!gate?.enabled) return false;
  if (gate.ageGate && student.age) {
    const { min, max } = gate.ageGate;
    if (student.age < min || student.age > max) return false;
  }
  if (gate.minLevel && gate.minLevel !== 'beginner') {
    const levels = { beginner: 1, intermediate: 2, advanced: 3 };
    if (levels[student.level] < levels[gate.minLevel]) return false;
  }
  return true;
}
```

### 2.2 Plugin Registry

```javascript
// ~/src/session/utils/featurePlugins.js
import { lazy } from 'react';

const PLUGINS = {
  // Slot name → Plugin component map
  'session-footer': [],
  'stage-title': [],
  'stage-body': [],
  'post-session': [],
  'nav-supplemental': [],
};

// Dynamic plugin loader
export function registerPlugin(slot, featureKey, Component) {
  if (!PLUGINS[slot]) PLUGINS[slot] = [];
  PLUGINS[slot].push({ featureKey, Component });
}

export function getPluginsForSlot(slot, activeFeatures) {
  return (PLUGINS[slot] || []).filter(p => activeFeatures.includes(p.featureKey));
}

// Example: Register Debate Mode plugin
export function initializeDebateMode() {
  registerPlugin(
    'stage-body',
    'DEBATE_MODE',
    lazy(() => import('@/features/debate/DebateModuleStageBody'))
  );
  registerPlugin(
    'post-session',
    'DEBATE_MODE',
    lazy(() => import('@/features/debate/DebateReflectionCard'))
  );
}
```

### 2.3 Feature Plugins Structure

Each feature lives in isolation:

```
features/
├── debate/
│   ├── DebateModuleStageBody.jsx    # Replaces standard body stage
│   ├── DebateReflectionCard.jsx     # Post-session reflection
│   ├── debatePrompts.js             # Debate-specific system prompts
│   ├── debateHooks.js               # useDebateMode, etc.
│   └── debateConfig.js
├── story-studio/
│   ├── StoryStudioLauncher.jsx      # Launches studio after session
│   ├── StoryPrompts.jsx             # Story generation prompts
│   └── storyHooks.js
├── pre-reading/
│   ├── PreReadingModal.jsx
│   ├── preReadingPrompts.js
│   └── preReadingHooks.js
├── adaptive-engine/
│   ├── AdaptiveHandler.jsx          # Intercepts stage responses
│   ├── adaptiveLevelDetector.js     # Real-time level adjustment
│   └── adaptiveConfig.js
└── social-reading/
    ├── SocialHub.jsx
    ├── PeerComparison.jsx
    └── socialHooks.js
```

**Example: Debate Mode Plugin (Non-Breaking Injection)**

```javascript
// features/debate/DebateModuleStageBody.jsx
import { useContext } from 'react';
import { SessionContext } from '@/session/providers/SessionProvider';
import { getDebateSystemPrompt } from './debatePrompts';

export default function DebateModuleStageBody({ stageName, turn }) {
  const { currentStage, messages, dispatch } = useContext(SessionContext);

  // This component REPLACES the standard body-stage rendering
  // but ONLY if DEBATE_MODE feature is enabled

  if (currentStage.key !== 'body') return null;

  // Debate mode: ask 3 opposing viewpoints instead of 3 reasons
  const debateSubQuestions = [
    "What's one reason this character's choice was RIGHT?",
    "What's one reason someone might DISAGREE with that choice?",
    "If you had to DEFEND the character's choice to someone who disagrees, what would you say?",
  ];

  const question = debateSubQuestions[turn - 1];

  const handleDebateResponse = async (studentText) => {
    // Swap in debate-specific prompt
    const debatePrompt = getDebateSystemPrompt(
      student,
      book,
      turn,
      messages
    );

    // Call backend with debate flag
    const response = await fetch('/api/sessions/:id/message', {
      method: 'POST',
      body: JSON.stringify({
        content: studentText,
        feature: 'DEBATE_MODE',
        systemPromptOverride: debatePrompt,
      }),
    });

    dispatch({ type: 'ADD_MESSAGE', payload: response });
  };

  return (
    <div className="debate-container">
      <h3>Debate Time! 🤔</h3>
      <p>{question}</p>
      {/* Input and response handling */}
    </div>
  );
}
```

### 2.4 Integration with SessionProvider

```javascript
// session/providers/FeatureGateProvider.jsx
import { createContext } from 'react';
import { FEATURE_GATES, isFeatureAvailable } from '@/lib/featureGates';

export const FeatureGateContext = createContext();

export function FeatureGateProvider({ children, student }) {
  const activeFeatures = Object.entries(FEATURE_GATES)
    .filter(([key, gate]) => isFeatureAvailable(key, student))
    .map(([key]) => key);

  return (
    <FeatureGateContext.Provider value={{ activeFeatures, FEATURE_GATES }}>
      {children}
    </FeatureGateContext.Provider>
  );
}

// Later, in SessionPage or StageRenderer:
export function StageRenderer({ stageName }) {
  const { activeFeatures } = useContext(FeatureGateContext);
  const plugins = getPluginsForSlot(`stage-${stageName}`, activeFeatures);

  // If Debate Mode is active and this is the body stage, render debate plugin
  if (plugins.length > 0) {
    return plugins.map(Plugin => <Plugin key={Plugin.featureKey} />);
  }

  // Fallback to standard rendering
  return <StandardStageRenderer stageName={stageName} />;
}
```

### 2.5 Feature Rollout Checklist

**For each new feature:**

- [ ] Define FEATURE_GATE in `featureGates.js` with ageGate, costMultiplier, requires
- [ ] Create `features/{feature-name}/` directory
- [ ] Build plugin components that export React components
- [ ] Register plugins in `featurePlugins.js` (can lazy-load)
- [ ] Add feature-specific prompts (e.g., debatePrompts.js)
- [ ] Add feature-specific hooks (e.g., useDebateMode.js)
- [ ] Test with feature flag OFF (standard behavior unchanged)
- [ ] Test with feature flag ON (plugin renders, new UX active)
- [ ] Update costMultiplier in modelRouter.js for cost tracking
- [ ] Create feature-specific backend routes (if needed)
- [ ] Document in FEATURE_FLAGS.md with A/B test criteria

---

## 3. Backend Service Layer Refactoring

### 3.1 Current State Analysis

**Files:**
- `backend/src/alice/engine.js` (541 lines)
- `backend/src/services/modelRouter.js` (432 lines)
- `backend/src/alice/prompts.js` (821 lines)

**Problem:**
- **Tightly coupled:** engine.js hardcodes getSystemPrompt from prompts.js; adding Debate Mode requires new prompt builder + new engine function
- **No abstraction:** modelRouter.js has switch/case for model selection; fine-tuned models (Phi-3, Mistral) require code change
- **Non-extensible:** New AI tasks (debate facilitation, story generation, adaptive feedback) require modifying engine.js directly

**Current Flow (Session Response):**
```javascript
// engine.js: getAliceResponse()
const systemPrompt = getSystemPrompt(book, studentName, level, stage, turn);
const model = selectModel('session_response', { level, turn, historyLength });
const response = await anthropic.messages.create({ model, system: systemPrompt, messages });
return { content: response.content[0].text, ... };
```

### 3.2 Proposed: Adapter Pattern + Strategy Pattern

**Create 3 new abstraction layers:**

```javascript
// backend/src/services/taskAdapters/
├── TaskAdapter.js          // Base class
├── SessionResponseAdapter.js
├── DebateFacilitationAdapter.js
├── StoryGenerationAdapter.js
├── FeedbackAdapter.js
└── AdaptiveAnalysisAdapter.js

// backend/src/services/modelStrategies/
├── ModelStrategy.js        // Base class
├── AnthropicStrategy.js    // Existing (Claude)
├── LocalModelStrategy.js   // For Phi-3, Mistral
└── HybridStrategy.js       // Route between them

// backend/src/services/promptBuilders/
├── PromptBuilder.js        // Base class
├── SocraticPromptBuilder.js
├── DebatePromptBuilder.js
├── StoryPromptBuilder.js
└── FeedbackPromptBuilder.js
```

### 3.3 TaskAdapter Pattern

```javascript
// backend/src/services/taskAdapters/TaskAdapter.js
export class TaskAdapter {
  /**
   * Template method: subclasses implement these
   */
  async execute(params) {
    const systemPrompt = this.buildPrompt(params);
    const messages = this.formatMessages(params);
    const model = this.selectModel(params);

    const response = await this.callModel({
      model,
      systemPrompt,
      messages,
      maxTokens: this.getMaxTokens(),
    });

    return this.parseResponse(response);
  }

  buildPrompt(params) {
    throw new Error('Subclass must implement buildPrompt');
  }

  selectModel(params) {
    throw new Error('Subclass must implement selectModel');
  }

  parseResponse(response) {
    throw new Error('Subclass must implement parseResponse');
  }
}

// backend/src/services/taskAdapters/SessionResponseAdapter.js
import { SessionResponseAdapter } from '../services/taskAdapters/SessionResponseAdapter';
import { getSystemPrompt } from '../alice/prompts';
import { selectModel } from '../services/modelRouter';

export class SessionResponseAdapter extends TaskAdapter {
  buildPrompt(params) {
    const { book, studentName, level, stage, turn, depthAnalysis } = params;
    return getSystemPrompt(book, studentName, level, stage, turn, { depthAnalysis });
  }

  formatMessages(params) {
    const { conversationHistory, studentMessage } = params;
    const messages = conversationHistory.map(d => ({
      role: d.speaker === 'student' ? 'user' : 'assistant',
      content: d.content,
    }));
    if (studentMessage) {
      messages.push({ role: 'user', content: studentMessage });
    }
    return messages;
  }

  selectModel(params) {
    const { level, turn, historyLength } = params;
    const { model } = selectModel('session_response', { level, turn, historyLength });
    return model;
  }

  getMaxTokens() {
    return 300;
  }

  parseResponse(response) {
    return {
      content: response.content[0]?.text || '',
      grammarFeedback: '',
      usage: response.usage,
    };
  }
}

// backend/src/services/taskAdapters/DebateFacilitationAdapter.js
export class DebateFacilitationAdapter extends TaskAdapter {
  buildPrompt(params) {
    const { book, studentName, level, currentPosition, opposingView } = params;
    // Use debate-specific prompt builder
    return getDebateSystemPrompt({
      book, studentName, level, currentPosition, opposingView
    });
  }

  selectModel(params) {
    // Debate requires more reasoning → prefer SONNET over HAIKU
    return selectModel('debate_facilitation', params);
  }

  getMaxTokens() {
    return 400;  // More tokens for nuanced debate responses
  }

  parseResponse(response) {
    return {
      content: response.content[0]?.text || '',
      counterArgument: this.extractCounterpoint(response.content[0]?.text),
      usage: response.usage,
    };
  }

  extractCounterpoint(text) {
    // Parse debate-specific structure from response
    // e.g., extract "Here's why I disagree..." section
  }
}
```

### 3.4 ModelStrategy Pattern (For Fine-Tuned Models)

```javascript
// backend/src/services/modelStrategies/ModelStrategy.js
export class ModelStrategy {
  async callModel({ model, systemPrompt, messages, maxTokens }) {
    throw new Error('Subclass must implement callModel');
  }

  estimateCost(model, inputTokens, outputTokens) {
    throw new Error('Subclass must implement estimateCost');
  }
}

// backend/src/services/modelStrategies/AnthropicStrategy.js
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicStrategy extends ModelStrategy {
  constructor(apiKey) {
    this.client = new Anthropic({ apiKey });
  }

  async callModel({ model, systemPrompt, messages, maxTokens }) {
    return await this.client.messages.create({
      model,
      system: systemPrompt,
      messages,
      max_tokens: maxTokens,
    });
  }

  estimateCost(model, inputTokens, outputTokens) {
    const PRICING = {
      'claude-haiku-4-5-20251001': { in: 0.80, out: 4.00 },
      'claude-sonnet-4-20250514': { in: 3.00, out: 15.00 },
      'claude-opus-4-6': { in: 15.00, out: 75.00 },
    };
    const price = PRICING[model] || PRICING['claude-sonnet-4-20250514'];
    return (inputTokens / 1e6) * price.in + (outputTokens / 1e6) * price.out;
  }
}

// backend/src/services/modelStrategies/LocalModelStrategy.js (FUTURE)
export class LocalModelStrategy extends ModelStrategy {
  constructor(modelName, localEndpoint) {
    this.modelName = modelName;  // 'phi-3', 'mistral-7b', etc.
    this.endpoint = localEndpoint;  // 'http://localhost:8000'
  }

  async callModel({ model, systemPrompt, messages, maxTokens }) {
    const response = await fetch(`${this.endpoint}/v1/completions`, {
      method: 'POST',
      body: JSON.stringify({
        model: this.modelName,
        system: systemPrompt,
        messages,
        max_tokens: maxTokens,
      }),
    });
    return await response.json();
  }

  estimateCost(model, inputTokens, outputTokens) {
    // Local models have no API cost, only compute cost
    // Estimate: $0.06 per session (hardware overhead)
    return 0.06;
  }
}

// backend/src/services/modelStrategies/HybridStrategy.js
export class HybridStrategy extends ModelStrategy {
  constructor() {
    this.anthropic = new AnthropicStrategy(process.env.ANTHROPIC_API_KEY);
    this.local = new LocalModelStrategy('phi-3', process.env.LOCAL_MODEL_ENDPOINT);
  }

  selectStrategy(taskType, budget = 'standard') {
    // Route based on cost budget + task complexity
    if (budget === 'cost-optimized' && taskType !== 'debate') {
      return this.local;  // Use Phi-3 for simple tasks
    }
    return this.anthropic;  // Use Claude for complex tasks
  }

  async callModel({ model, systemPrompt, messages, maxTokens, budget }) {
    const strategy = this.selectStrategy(model, budget);
    return await strategy.callModel({ model, systemPrompt, messages, maxTokens });
  }

  estimateCost(model, inputTokens, outputTokens, budget = 'standard') {
    const strategy = this.selectStrategy(model, budget);
    return strategy.estimateCost(model, inputTokens, outputTokens);
  }
}
```

### 3.5 Refactored engine.js

```javascript
// backend/src/alice/engine.js (REFACTORED)
import { SessionResponseAdapter } from '../services/taskAdapters';
import { AnthropicStrategy } from '../services/modelStrategies';

const strategy = new AnthropicStrategy(config.anthropic.apiKey);

export async function getAliceResponse({
  book, studentName, level, stage, turn, studentMessage, conversationHistory = [], ...opts
}) {
  const adapter = new SessionResponseAdapter();

  try {
    const response = await adapter.execute({
      book,
      studentName,
      level,
      stage,
      turn,
      studentMessage,
      conversationHistory,
      depthAnalysis: opts.depthAnalysis,
    }, strategy);

    return response;
  } catch (error) {
    console.error('[Alice Engine] Error:', error.message);
    return getMockResponse({ ... });
  }
}

// New: Support for debate mode
export async function getDebateResponse({ book, studentName, level, currentPosition, opposingView, conversationHistory }) {
  const adapter = new DebateFacilitationAdapter();

  try {
    const response = await adapter.execute({
      book, studentName, level, currentPosition, opposingView, conversationHistory
    }, strategy);

    return response;
  } catch (error) {
    console.error('[Alice Engine] Debate error:', error.message);
    return getMockDebateResponse({ ... });
  }
}

// New: Support for story generation
export async function generateStoryIdea({ theme, studentName, level, previousBooks }) {
  const adapter = new StoryGenerationAdapter();

  try {
    const response = await adapter.execute({
      theme, studentName, level, previousBooks
    }, strategy);

    return response;
  } catch (error) {
    console.error('[Alice Engine] Story generation error:', error.message);
    return getMockStoryIdea({ ... });
  }
}
```

### 3.6 Enhanced modelRouter.js (Cost-Aware)

```javascript
// backend/src/services/modelRouter.js (ENHANCED)
export function selectModel(taskType, options = {}) {
  const { level, turn, budget = 'standard', featureMultiplier = 1.0 } = options;

  let model;
  let reason;

  switch (taskType) {
    case 'session_response':
      // Existing logic
      model = selectSessionModel(level, turn, options);
      reason = `session response — ${level} level`;
      break;

    case 'debate_facilitation':
      // NEW: Debate always needs SONNET (more reasoning)
      model = MODELS.SONNET;
      reason = 'debate facilitation — requires nuanced reasoning';
      break;

    case 'story_generation':
      // NEW: Story generation uses SONNET or OPUS
      model = level === 'advanced' ? MODELS.SONNET : MODELS.HAIKU;
      reason = `story generation — ${level} complexity`;
      break;

    case 'adaptive_difficulty_detection':
      // NEW: Fast analysis for difficulty adjustment
      model = MODELS.HAIKU;
      reason = 'adaptive analysis — pattern detection only';
      break;

    case 'feedback':
    case 'rephrase':
    case 'grammar_check':
      // Existing logic
      model = MODELS.HAIKU;
      break;

    default:
      model = MODELS.SONNET;
      reason = `unknown task type "${taskType}"`;
  }

  // Apply budget constraint: downgrade to cheaper model if cost_optimized
  if (budget === 'cost_optimized' && model === MODELS.SONNET) {
    // Check if task permits HAIKU
    const hasikuEligible = ['feedback', 'rephrase', 'grammar_check', 'story_generation'].includes(taskType);
    if (haikusEligible) {
      model = MODELS.HAIKU;
      reason += ` [cost-optimized: downgraded to HAIKU]`;
    }
  }

  // Apply feature cost multiplier (debate costs 20% more, story costs 50%)
  const costMultiplier = featureMultiplier;

  console.log(`[ModelRouter] Task: ${taskType} → Model: ${model} (${reason}) [cost x${costMultiplier}]`);
  return { model, reason, costMultiplier };
}

// NEW: Cost tracking with feature awareness
export class CostTracker {
  // ... existing code ...

  recordWithFeature(model, inputTokens, outputTokens, feature = null, costMultiplier = 1.0) {
    const baseCost = this.record(model, inputTokens, outputTokens);
    const adjustedCost = baseCost.cost * costMultiplier;

    this.totalCost = (this.totalCost - baseCost.cost) + adjustedCost;

    if (feature) {
      if (!this.featureBreakdown[feature]) {
        this.featureBreakdown[feature] = { cost: 0, calls: 0 };
      }
      this.featureBreakdown[feature].cost += adjustedCost;
      this.featureBreakdown[feature].calls += 1;
    }

    return { cost: adjustedCost, totalCost: this.totalCost };
  }

  getSummary() {
    return {
      ...super.getSummary(),
      featureBreakdown: this.featureBreakdown,  // Cost per feature
    };
  }
}
```

### 3.7 Migration Path

**Week 1:**
- Create TaskAdapter base class + SessionResponseAdapter
- Refactor getAliceResponse() to use adapter internally
- Tests pass; behavior identical

**Week 2:**
- Create ModelStrategy abstraction
- Route selectModel() calls through strategy
- Integrate cost multiplier into CostTracker
- Add DebateFacilitationAdapter (but don't use yet)

**Week 3:**
- Create PromptBuilder abstraction
- Move getSystemPrompt() logic to SocraticPromptBuilder
- Create DebatePromptBuilder
- Wire up new debate flows

**Week 4:**
- Add StoryGenerationAdapter
- Add fine-tuned model support (LocalModelStrategy)
- Update backend routes to support feature-specific adapters

---

## 4. Progressive Disclosure Navigation

### 4.1 Current State Analysis

**File:** `/sessions/loving-dreamy-lamport/mnt/hi-alice/frontend/src/components/NavBar.js` (88 lines)

**Current NavBar (6 fixed links):**
```javascript
const navLinks = [
  { href: '/?landing=1', label: 'Home', icon: '🏠' },
  { href: '/books', label: 'Start', icon: '🚀' },
  { href: '/library', label: 'Library', icon: '📚' },
  { href: '/review', label: 'Studio', icon: '⭐' },
  { href: '/vocabulary', label: 'Words', icon: '📖' },
  { href: '/profile', label: 'Profile', icon: '👤' },
];
```

**Problem with 7+ new features:**
- Adding Debate, Story Studio, Social Reading, Parent Hub, B2B Academy creates **13+ nav items**
- Beginner (6-8) sees all → **cognitive overload**, distraction from reading
- Can't hide parent-only features from children (COPPA violation)
- No age-gating logic

### 4.2 Proposed: Progressive Disclosure + Age-Gating

**New NavBar Component:**

```javascript
// ~/src/components/NavBarProgressive.jsx
'use client';

import { useMemo, useContext } from 'react';
import { FeatureGateContext } from '@/session/providers/FeatureGateProvider';
import Link from 'next/link';
import { getItem } from '@/lib/clientStorage';

const NAV_CATALOG = {
  // Core reading path (all ages)
  core: [
    { href: '/?landing=1', label: 'Home', icon: '🏠', icon_size: 'md' },
    { href: '/books', label: 'Start', icon: '🚀', icon_size: 'lg' },
    { href: '/library', label: 'Library', icon: '📚', icon_size: 'md' },
    { href: '/vocabulary', label: 'Words', icon: '📖', icon_size: 'md' },
    { href: '/profile', label: 'Profile', icon: '👤', icon_size: 'md' },
  ],

  // Intermediate+ features (9+ years)
  intermediate: [
    { href: '/review', label: 'Studio', icon: '⭐', icon_size: 'md', feature: null },
    { href: '/debate', label: 'Debate', icon: '🤔', icon_size: 'md', feature: 'DEBATE_MODE' },
    { href: '/social', label: 'Readers', icon: '👥', icon_size: 'md', feature: 'SOCIAL_READING' },
  ],

  // Advanced+ features (12+ years)
  advanced: [
    { href: '/stories', label: 'Create', icon: '✍️', icon_size: 'md', feature: 'STORY_STUDIO' },
    { href: '/adaptive', label: 'Insights', icon: '🧠', icon_size: 'md', feature: 'ADAPTIVE_ENGINE' },
  ],

  // Parent-only (requires parent role)
  parent: [
    { href: '/parent-hub', label: 'Parent Hub', icon: '👨‍👩‍👧', icon_size: 'md', feature: 'PARENT_HUB', role: 'parent' },
  ],

  // Teacher/Admin-only
  admin: [
    { href: '/academy', label: 'Academy', icon: '🏫', icon_size: 'md', feature: 'B2B_ACADEMY', role: 'teacher|admin' },
  ],
};

export default function NavBarProgressive() {
  const { activeFeatures } = useContext(FeatureGateContext);
  const userRole = getItem('userRole');
  const studentAge = parseInt(getItem('studentAge') || '8', 10);

  const visibleLinks = useMemo(() => {
    let links = [...NAV_CATALOG.core];

    if (studentAge >= 9) {
      links = links.concat(NAV_CATALOG.intermediate.filter(link => {
        if (!link.feature) return true;  // Non-feature items always visible
        return activeFeatures.includes(link.feature);
      }));
    }

    if (studentAge >= 12) {
      links = links.concat(NAV_CATALOG.advanced.filter(link => {
        if (!link.feature) return true;
        return activeFeatures.includes(link.feature);
      }));
    }

    if (['parent', 'admin', 'super_admin'].includes(userRole)) {
      links = links.concat(NAV_CATALOG.parent.filter(link => {
        if (!link.feature) return true;
        return activeFeatures.includes(link.feature);
      }));
    }

    if (['teacher', 'admin', 'super_admin'].includes(userRole)) {
      links = links.concat(NAV_CATALOG.admin.filter(link => {
        if (!link.feature) return true;
        return activeFeatures.includes(link.feature);
      }));
    }

    return links;
  }, [studentAge, activeFeatures, userRole]);

  // If too many links (>5 on desktop, >3 on mobile), show "More" menu
  const threshold = { mobile: 3, desktop: 5 };
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const limit = isMobile ? threshold.mobile : threshold.desktop;

  const primaryLinks = visibleLinks.slice(0, limit);
  const moreLinks = visibleLinks.slice(limit);

  return (
    <nav className="sticky top-0 z-40 bg-[#D6C9A8] shadow-md">
      {/* Desktop Navigation */}
      <div className="hidden md:flex gap-2 px-6 py-3">
        <Link href="/" className="flex items-center gap-1 font-bold text-[#3D6B3D] hover:text-[#5C8B5C]">
          🌿 HiMax
        </Link>

        {primaryLinks.map(link => (
          <NavLink key={link.href} link={link} />
        ))}

        {moreLinks.length > 0 && (
          <MoreMenu links={moreLinks} />
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#D6C9A8] border-t border-[#C4B49A] flex gap-1 px-2 py-2 z-40">
        {primaryLinks.map(link => (
          <NavLink key={link.href} link={link} mobile />
        ))}

        {moreLinks.length > 0 && (
          <MoreMenu links={moreLinks} mobile />
        )}
      </div>
    </nav>
  );
}

function NavLink({ link, mobile = false }) {
  const pathname = usePathname();
  const isActive = pathname === link.href;

  if (mobile) {
    return (
      <Link
        href={link.href}
        className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-bold min-h-[48px] transition-all ${
          isActive ? 'bg-[#5C8B5C] text-white' : 'text-[#3D2E1E] hover:bg-[#C8DBC8]'
        }`}
      >
        <div className="text-lg">{link.icon}</div>
        <span>{link.label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={link.href}
      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
        isActive ? 'bg-[#5C8B5C] text-white shadow-[0_2px_8px_rgba(92,139,92,0.4)]' : 'text-[#3D2E1E] hover:bg-[#C8DBC8]'
      }`}
    >
      {link.icon} {link.label}
    </Link>
  );
}

function MoreMenu({ links, mobile = false }) {
  const [showMenu, setShowMenu] = useState(false);

  if (mobile) {
    return (
      <div className="flex-1 relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-full h-full flex flex-col items-center justify-center text-base font-bold text-[#3D2E1E] hover:bg-[#C8DBC8] rounded-xl min-h-[48px]"
        >
          ⋮ More
        </button>

        {showMenu && (
          <div className="absolute bottom-16 right-0 bg-white border border-[#BDC3C7] rounded-xl shadow-lg p-2 z-50">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-4 py-2 text-sm font-semibold text-[#3D2E1E] hover:bg-[#F5F7FA] rounded-lg"
                onClick={() => setShowMenu(false)}
              >
                {link.icon} {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Desktop: dropdown menu
  return (
    <div className="relative">
      <button className="px-4 py-2 rounded-xl text-sm font-bold text-[#3D2E1E] hover:bg-[#C8DBC8] transition-all">
        ⋮ More
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-2 bg-white border border-[#BDC3C7] rounded-xl shadow-lg p-2 z-50 min-w-[150px]">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-4 py-2 text-sm font-semibold text-[#3D2E1E] hover:bg-[#F5F7FA] rounded-lg"
            >
              {link.icon} {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 4.3 Age-Gating Logic

```javascript
// ~/src/lib/navRules.js
export const NAV_AGE_GATES = {
  6: { maxNav: 3, features: ['core'] },              // Beginner: only Home, Start, Library
  7: { maxNav: 3, features: ['core'] },
  8: { maxNav: 3, features: ['core'] },
  9: { maxNav: 5, features: ['core', 'intermediate'] },    // Intermediate: add Studio, Debate, Social
  10: { maxNav: 6, features: ['core', 'intermediate'] },
  11: { maxNav: 6, features: ['core', 'intermediate'] },
  12: { maxNav: 8, features: ['core', 'intermediate', 'advanced'] },  // Advanced: add Create, Insights
  13: { maxNav: 8, features: ['core', 'intermediate', 'advanced'] },
};
```

### 4.4 COPPA Compliance

```javascript
// ~/src/lib/coppaCompliance.js
export function isParentOnlyFeature(featureKey) {
  return ['PARENT_HUB', 'B2B_ACADEMY'].includes(featureKey);
}

export function canChildSeeFeature(featureKey, studentAge, hasParentConsent = false) {
  // COPPA rule: social features require parent consent for <13
  if (featureKey === 'SOCIAL_READING' && studentAge < 13) {
    return hasParentConsent;
  }

  // Parent-only features are never visible to children
  if (isParentOnlyFeature(featureKey)) {
    return false;
  }

  return true;
}

export function enforceParentConsent(featureKey, studentAge) {
  // For SOCIAL_READING on < 13, show consent modal
  if (featureKey === 'SOCIAL_READING' && studentAge < 13) {
    return true;  // Show parent consent modal
  }
  return false;
}
```

---

## 5. State Management Migration Path

### 5.1 Current Challenge

36 scattered useState hooks across session/page.js make it hard to:
- Track state flow (where does vocabCard come from? 10 lines away)
- Test components in isolation
- Share state between features
- Persist state across navigation

### 5.2 Migration: useState → Context API → Zustand

**Phase 1 (Immediate): Context API (Non-Breaking)**

```javascript
// ~/src/session/providers/SessionProvider.jsx
import { createContext, useReducer } from 'react';

const SessionContext = createContext();

const initialState = {
  session: null,
  currentStage: { index: 0, key: 'title', turn: 1 },
  messages: [],
  loading: false,
  ui: {
    showStageTransition: false,
    vocabCard: null,
    showConfetti: false,
    showAchievements: false,
  },
  voice: {
    isListening: false,
    transcript: '',
    isFinal: false,
  },
  scores: {
    byStage: {},
    vocabulary: [],
    grammarFeedback: [],
  },
  error: null,
};

function sessionReducer(state, action) {
  switch (action.type) {
    case 'SET_CURRENT_STAGE':
      return { ...state, currentStage: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_VOICE_LISTENING':
      return { ...state, voice: { ...state.voice, isListening: action.payload } };
    case 'SET_VOCAB_CARD':
      return { ...state, ui: { ...state.ui, vocabCard: action.payload } };
    case 'SHOW_CONFETTI':
      return { ...state, ui: { ...state.ui, showConfetti: true } };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'COMPLETE_SESSION':
      return { ...state, sessionComplete: true };
    // ... more actions
    default:
      return state;
  }
}

export function SessionProvider({ children }) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);

  return (
    <SessionContext.Provider value={{ state, dispatch }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext() {
  return useContext(SessionContext);
}
```

**Phase 2 (Week 3): Zustand Store (For Complexity)**

```javascript
// ~/src/stores/sessionStore.js
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export const useSessionStore = create(
  devtools((set, get) => ({
    // State
    session: null,
    currentStage: { index: 0, key: 'title', turn: 1 },
    messages: [],
    loading: false,
    ui: {
      showStageTransition: false,
      vocabCard: null,
      showConfetti: false,
      showAchievements: false,
    },
    voice: {
      isListening: false,
      transcript: '',
      isFinal: false,
    },
    scores: { byStage: {}, vocabulary: [], grammarFeedback: [] },
    error: null,

    // Actions
    setCurrentStage: (stage) => set({ currentStage: stage }),
    addMessage: (message) => set(state => ({
      messages: [...state.messages, message]
    })),
    setVoiceListening: (isListening) => set(state => ({
      voice: { ...state.voice, isListening }
    })),
    setVocabCard: (card) => set(state => ({
      ui: { ...state.ui, vocabCard: card }
    })),
    showConfetti: () => set(state => ({
      ui: { ...state.ui, showConfetti: true }
    })),
    nextStage: () => set(state => ({
      currentStage: {
        ...state.currentStage,
        index: state.currentStage.index + 1,
        turn: 1,
      }
    })),
    setLoading: (loading) => set({ loading }),
    completeSession: () => set({ sessionComplete: true }),

    // Computed (selectors)
    getVisibleMessages: () => get().messages.filter(m => !m.hidden),
    getCurrentTurn: () => get().currentStage.turn,
    isSessionActive: () => !get().session?.completedAt,
  }))
);
```

**Phase 3 (Week 4): Hybrid Usage in Components**

```javascript
// Components use Zustand (simpler) or Context (for feature plugins)
import { useSessionStore } from '@/stores/sessionStore';

export function StageRenderer() {
  const { currentStage, messages, loading } = useSessionStore();

  return (
    <div>
      <h2>{currentStage.key}</h2>
      {/* Render based on store state */}
    </div>
  );
}

// Feature plugins use Context (for isolation)
import { useSessionContext } from '@/session/providers/SessionProvider';

export function DebateModuleStageBody() {
  const { state, dispatch } = useSessionContext();

  return (
    <div>
      {/* Isolated plugin state */}
    </div>
  );
}
```

### 5.3 Migration Checklist

- [ ] Week 1: Create SessionProvider + SessionContext (Context API)
- [ ] Week 2: Move 36 useState to useReducer in SessionProvider
- [ ] Week 3: Set up Zustand store as parallel (no breaking changes)
- [ ] Week 4: Migrate high-frequency components to Zustand
- [ ] Keep Context API for feature plugins (isolation)
- [ ] Tests pass throughout (behavior preserved)

---

## 6. Cost-Aware Model Routing Enhancement

### 6.1 Current State

**modelRouter.js** (432 lines) implements HAIKU/SONNET/OPUS selection based on task type.

**Current costs (per 1M tokens):**
- HAIKU: $0.80 input, $4.00 output
- SONNET: $3.00 input, $15.00 output
- OPUS: $15.00 input, $75.00 output

**Typical session cost (3 stages × 3 turns = 9 API calls):**
- 70% HAIKU (feedback, rephrase) + 30% SONNET (main responses)
- Avg: ~200 input, 150 output tokens per call
- Cost: ~$0.18 per session

### 6.2 Problem: Cost Explosion with Features

**New features add cost:**
- Debate Mode: 3 extra turns + counter-argument extraction → +50% cost
- Story Generation: 1500+ tokens output → +200% cost
- Adaptive Engine: Real-time analysis every turn → +40% cost
- Social Reading: Peer comparison API → +30% cost

**Without optimization, session cost could reach $0.50-$0.80** with all features enabled.

### 6.3 Proposed: Fine-Tuned Model Integration

**Option 1: Phi-3 (Open Source Fine-Tuned Model)**
- Cost: ~$0.06 per session (local compute only, no API)
- Accuracy: 95% of SONNET for Q&A tasks
- Latency: 2-5s (local) vs 1-2s (API)
- Use case: Beginner level sessions, story generation

**Option 2: Mistral 7B (Open Source Fine-Tuned)**
- Cost: ~$0.06 per session
- Accuracy: 90% of SONNET
- Latency: 3-8s (local)
- Use case: Beginner/intermediate, low-stakes feedback

**Hybrid Strategy: Use fine-tuned models for cost-optimized sessions**

```javascript
// backend/src/services/modelRouter.js (ENHANCED)
export function selectModel(taskType, options = {}) {
  const { level, budget = 'standard', featureSet } = options;

  // Budget-aware routing
  if (budget === 'cost_optimized') {
    return selectCostOptimizedModel(taskType, level, featureSet);
  }

  // Standard routing (existing logic)
  return selectStandardModel(taskType, options);
}

function selectCostOptimizedModel(taskType, level, featureSet = []) {
  // For cost_optimized budget, prefer fine-tuned models when possible

  const hasFinetuning = process.env.FINETUNED_MODEL_ENDPOINT ? true : false;

  if (!hasFinetuning) {
    // Fallback to HAIKU if fine-tuning not available
    return selectStandardModel(taskType, { level });
  }

  // Route to local fine-tuned model
  switch (taskType) {
    case 'session_response':
      if (level === 'beginner') {
        return {
          model: 'phi-3-finetuned:hialice',
          reason: 'cost-optimized: beginner-level Q&A on fine-tuned model',
          strategy: 'local',
          costMultiplier: 0.33,  // $0.06 vs $0.18
        };
      }
      if (level === 'intermediate') {
        return {
          model: 'mistral-7b-finetuned:hialice',
          reason: 'cost-optimized: intermediate-level Q&A on fine-tuned model',
          strategy: 'local',
          costMultiplier: 0.33,
        };
      }
      // Advanced still uses SONNET (higher accuracy needed)
      return selectStandardModel('session_response', { level });

    case 'story_generation':
      return {
        model: 'phi-3-finetuned:storytelling',
        reason: 'cost-optimized: story generation on fine-tuned model',
        strategy: 'local',
        costMultiplier: 0.3,  // $0.06 vs $0.20+
      };

    case 'feedback':
    case 'rephrase':
    case 'grammar_check':
      // Always HAIKU (already cheap)
      return selectStandardModel(taskType, { level });

    default:
      return selectStandardModel(taskType, { level });
  }
}
```

### 6.4 Fine-Tuned Model Training Data

**For Phi-3 & Mistral fine-tuning, collect:**

1. **High-quality Q&A pairs** (from existing sessions):
   - System prompt + student input → HiAlice output
   - Filter for: no grammar errors, age-appropriate, follows Socratic method
   - Target: 500-1000 pairs per level

2. **Story generation examples**:
   - Theme + student level → story opening
   - Target: 200-300 examples

3. **Feedback templates**:
   - Session data → personalized feedback
   - Target: 300-500 examples

**Expected improvement:**
- Fine-tuned models match SONNET accuracy at 33% of cost
- Enables "cost-optimized" budget mode for schools/B2B
- Fallback to SONNET for "premium" accuracy

### 6.5 Cost Estimation with Features

**Session cost breakdown (9 API calls):**

| Feature | Calls | Cost/Call (SONNET) | Total |
|---------|-------|-------------------|-------|
| Base Q&A | 9 | $0.018 | $0.162 |
| Debate Mode | +3 | $0.025 | +$0.075 |
| Story Gen | +1 | $0.035 | +$0.035 |
| Adaptive | +2 | $0.015 | +$0.030 |
| **Total (all features)** | 15 | - | **$0.302** |

**With cost-optimized routing (fine-tuned models):**

| Feature | Calls | Cost/Call (Phi-3) | Total |
|---------|-------|-------------------|-------|
| Base Q&A | 9 | $0.006 | $0.054 |
| Debate Mode | +3 | $0.008 | +$0.024 |
| Story Gen | +1 | $0.006 | +$0.006 |
| Adaptive | +2 | $0.006 | +$0.012 |
| **Total (all features)** | 15 | - | **$0.096** |

**Savings: 68% cost reduction** ($0.302 → $0.096 with cost-optimized budget)

---

## 7. Risk Assessment & Mitigation

### 7.1 Decomposition Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| SessionProvider context becomes performance bottleneck | Medium | High | Implement React.memo on consumers, split contexts by concern |
| Feature plugins interfere with core session flow | High | High | Plugin interface spec + unit tests for each plugin |
| Breaking changes during migration | Medium | High | Phase-based rollout, feature flags for old/new code paths |
| Increased bundle size with lazy-loaded plugins | Medium | Medium | Code-split plugins directory, tree-shake unused features |

**Mitigation Steps:**
1. Keep SessionProvider updates batched (not per-keystroke)
2. Test each new feature in isolation before integration
3. Maintain feature flag to rollback to old SessionPage if needed
4. Monitor Core Web Vitals during migration

### 7.2 Backend Refactoring Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| TaskAdapter abstraction leaks memory | Low | High | Implement proper cleanup, test memory usage |
| Model strategy fallback fails silently | Medium | High | Log all fallbacks, alert on strategy switch |
| Fine-tuned models produce low-quality output | High | Medium | A/B test fine-tuned vs SONNET, monitor eval harness |
| Cost multiplier logic is incorrect | Medium | Medium | Unit tests for cost calculation, audit first 100 sessions |

**Mitigation Steps:**
1. Unit test each adapter + strategy in isolation
2. Implement eval harness checks for new models
3. A/B test fine-tuned models with 10% of users first
4. Monitor cost per session, set alerts for unexpected spikes

### 7.3 Navigation & COPPA Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Child sees parent-only feature | High | Critical | Explicit role checks, server-side validation |
| Parent consent not enforced for SOCIAL_READING | Medium | Critical | Enforce consent check before feature access |
| Navigation overload still occurs on older tablets | Medium | Medium | Test responsive design on iPad Air 2, older Android tablets |

**Mitigation Steps:**
1. Server-side enforcement of role/age gates (don't trust client)
2. Clear COPPA compliance checklist in deployment process
3. Parent consent stored in secure user profile, not localStorage
4. Audit trail: log all feature access by student age + feature

### 7.4 State Management Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Context value changes cause unnecessary re-renders | High | Medium | Implement useCallback for dispatch, memoize selectors |
| Zustand store sync issues between tabs | Low | Medium | Test multi-tab sessions, implement storage listener |
| Reducer logic has side effects | Medium | High | Keep reducer pure, side effects in effects hooks |

**Mitigation Steps:**
1. Performance profile with React DevTools during migration
2. Test Zustand persist middleware with IndexedDB
3. Code review all reducer actions for purity
4. Unit test reducer with randomized state + action combos

### 7.5 Cost Optimization Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Fine-tuned models degrade accuracy | High | High | A/B test with eval harness, monitor student feedback |
| Cost tracking becomes inaccurate | Medium | High | Implement cost reconciliation, audit vs Anthropic API billing |
| Model strategy selection logic is buggy | Medium | High | Comprehensive unit tests for all task/budget combos |

**Mitigation Steps:**
1. A/B test with 10% of sessions, measure eval harness scores
2. Compare CostTracker totals vs Anthropic invoices monthly
3. Test all 32 combinations of (taskType, budget, level, feature)
4. Implement cost anomaly detection (session > $1.00 = alert)

---

## 8. Implementation Timeline

### Week 1: Foundation (Component Decomposition)

**Days 1-2:**
- Create SessionProvider + useSessionState hook
- Migrate session initialization to useEffect in provider
- Tests: SessionProvider maintains same behavior as old useState

**Days 3-4:**
- Extract StageRenderer component
- Create VoicePanel, TextInputPanel, HybridInputPanel
- Tests: All input modes work identically to original

**Days 5:**
- Create PluginSlot component + FeatureGateProvider
- Set up feature gates constants
- Tests: Slots render, gates evaluate correctly

### Week 2: Backend Refactoring

**Days 1-2:**
- Create TaskAdapter base class + SessionResponseAdapter
- Refactor engine.js to use adapters
- Tests: getAliceResponse still returns identical responses

**Days 3-4:**
- Create ModelStrategy abstraction
- Implement AnthropicStrategy + LocalModelStrategy stubs
- Tests: selectModel works with strategy wrapper

**Day 5:**
- Enhance CostTracker with feature breakdown
- Update modelRouter.js with cost multipliers
- Tests: Cost calculations match pricing table

### Week 3: State Management & Navigation

**Days 1-2:**
- Migrate useState hooks to useReducer in SessionProvider
- Implement sessionReducer with 15+ action types
- Tests: sessionReducer unit tests (100+ cases)

**Days 3-4:**
- Create NavBarProgressive component
- Implement age-gating logic
- Tests: Nav visibility correct for each age + role combo

**Day 5:**
- COPPA compliance audit
- Parent consent flow for SOCIAL_READING
- Tests: Consent stored, enforced server-side

### Week 4: Feature Framework + Integration

**Days 1-2:**
- Create plugin registry (featurePlugins.js)
- Build example Debate Mode plugin (stub)
- Tests: Plugin loads, renders when feature enabled

**Days 3-4:**
- Integrate fine-tuned model strategy (LocalModelStrategy)
- Set up model router decision tree for cost-optimized
- Tests: Model selection correct for all task/budget combos

**Day 5:**
- End-to-end tests: Full session with SessionProvider + plugins
- Performance profile with React DevTools
- Security audit: no child-visible parent features

### Post-Week 4: Validation

- A/B test: 10% of users get new SessionPage, 90% get old
- Monitor: render times, error rates, cost per session
- Gather feedback from teachers/parents
- Rollout 20% → 50% → 100% over 2 weeks

---

## 9. Success Metrics

### Functional Metrics

- [ ] New session/page.js <= 200 lines (vs current 1,451)
- [ ] All 36 useState hooks consolidated to SessionContext
- [ ] 5+ new features can be added via plugins without touching core
- [ ] All existing tests pass (behavior identical)
- [ ] New tests: 50+ for decomposed components, reducers, adapters

### Performance Metrics

- [ ] SessionPage component re-render time < 50ms (vs current ?ms)
- [ ] No unnecessary Context re-renders (React DevTools confirms)
- [ ] Bundle size increase < 15% (plugins lazy-loaded)
- [ ] First Contentful Paint (FCP) unchanged (< 2.5s)

### Cost Metrics

- [ ] Cost-optimized budget reduces session cost to $0.06 (vs $0.18)
- [ ] Fine-tuned models achieve 95% eval score match vs SONNET
- [ ] Cost tracking accuracy: ±2% vs Anthropic API billing
- [ ] Feature-specific costs tracked (debate +20%, story +50%, etc.)

### Child UX Metrics

- [ ] Nav items for Beginner: 3-4 (vs unlimited)
- [ ] Nav items for Intermediate: 5-6 (vs unlimited)
- [ ] Nav items for Advanced: 7-8 (vs unlimited)
- [ ] 90%+ completion rate of stories (not distracted by too many options)
- [ ] Parent satisfaction: 80%+ (new features easily accessible)

### Developer Metrics

- [ ] New feature development time: 3-5 days (vs 2-3 weeks)
- [ ] Breaking changes: 0 (all migrations non-breaking)
- [ ] Test coverage: 75%+ (up from 40%)
- [ ] Onboarding for new dev: < 4 hours (clear architecture docs)

---

## 10. Rollback Strategy

### If SessionProvider Decomposition Fails

**Immediate (< 1 hour):**
1. Feature flag: `NEXT_PUBLIC_USE_OLD_SESSION_PAGE=true`
2. SessionPage.js imports old version via dynamic import
3. Revert PR commits

**Root Cause Analysis (post-incident):**
1. Review performance profiles
2. Identify context update bottlenecks
3. Split contexts if needed (e.g., UIContext separate from SessionContext)

### If Backend Adapter Refactoring Breaks Responses

**Immediate (< 1 hour):**
1. Feature flag: `USE_OLD_ENGINE=true`
2. engine.js checks flag, calls old getAliceResponse directly
3. Revert adapter calls

**Root Cause Analysis:**
1. Compare old/new responses for differences
2. Test adapter with edge cases (empty history, null book, etc.)
3. Add comprehensive unit tests before re-deploying

### If Fine-Tuned Models Degrade Quality

**Immediate (< 30 min):**
1. Feature flag: `USE_FINETUNED_MODELS=false`
2. All sessions route to SONNET (higher cost, but safe)
3. Stop accepting cost-optimized budget requests

**Root Cause Analysis:**
1. Evaluate model outputs with eval harness
2. Check training data quality (filter for errors)
3. Retrain with curated examples

---

## 11. Glossary & References

| Term | Definition |
|------|-----------|
| **SessionProvider** | React Context wrapper for all session state (replaces 36 useState hooks) |
| **PluginSlot** | Render location where feature plugins inject custom components |
| **FeatureGate** | Configuration object controlling feature availability (enabled, ageGate, costMultiplier) |
| **TaskAdapter** | Backend abstraction for AI tasks (SessionResponse, Debate, StoryGeneration, etc.) |
| **ModelStrategy** | Backend abstraction for LLM calls (Anthropic, LocalModel, Hybrid) |
| **Cost-Optimized** | Budget mode using fine-tuned models (~$0.06/session vs $0.18) |
| **COPPA** | Children's Online Privacy Protection Act (13 year age gate for social features) |

### Related Documents

- `/sessions/loving-dreamy-lamport/mnt/hi-alice/CLAUDE.md` — Project vision, feature roadmap
- `/sessions/loving-dreamy-lamport/mnt/hi-alice/PROGRESS.md` — Current development status
- `backend/src/alice/engine.js` — AI response generation (target for refactoring)
- `backend/src/services/modelRouter.js` — Model selection logic (target for enhancement)
- `frontend/src/app/session/page.js` — Monolith component (target for decomposition)

---

## 12. Approval & Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Architecture Lead | [TBD] | | PENDING |
| Backend Lead | [TBD] | | PENDING |
| Frontend Lead | [TBD] | | PENDING |
| Security/COPPA | [TBD] | | PENDING |

**Next Steps:**
1. Technical review of this ADR by architecture team
2. Estimate full implementation effort (propose 4-6 weeks)
3. Prioritize features for Phase 1 (Debate Mode? Story Studio?)
4. Assign owners to each work stream
5. Kick off Week 1 foundation work

---

**Document Version:** 1.0
**Last Updated:** 2026-03-14
**Status:** PROPOSED (awaiting architecture review)
