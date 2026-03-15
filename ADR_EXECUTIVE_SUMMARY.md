# ADR v1.0 Executive Summary
## HiAlice Flexible Transitional Architecture

**Document:** `/sessions/loving-dreamy-lamport/mnt/hi-alice/ARCHITECTURE_DECISION_RECORD_v1.md`
**Status:** PROPOSED
**Timeline:** 4-6 weeks
**Impact:** Non-breaking refactor enabling 7+ new features

---

## The Problem

HiAlice is at a critical inflection point:

| Aspect | Current State | Issue |
|--------|--------------|-------|
| **session/page.js** | 1,451 lines | Monolithic, unmaintainable |
| **useState hooks** | 36 scattered across component | Hard to track, test, extend |
| **Feature extensibility** | Must edit core logic | Can't add new features safely |
| **Backend coupling** | engine.js + prompts.js tightly coupled | Can't support new AI tasks |
| **Cost efficiency** | SONNET default for all tasks | $0.18/session, expensive at scale |
| **Navigation** | 6 fixed links, no age-gating | Beginner overwhelmed, COPPA risk |
| **Model support** | Only Anthropic Claude | Can't leverage fine-tuned models |

**Target:** Support 7+ features (Pre-Reading, Debate, Story Studio, Social Reading, Adaptive Engine, B2B Academy, Parent Hub) **without breaking child UX.**

---

## The Solution: 6 Coordinated Refactorings

### 1. Session Page Decomposition
**From:** 1,451-line monolith with 36 useState hooks
**To:** 150-line router + 5 composable modules (StageRenderer, VoicePanel, SessionProvider)
**Benefit:** Testable, maintainable, feature-friendly

```
Before: SessionPage (does everything) — 1,451 lines
After:  SessionPage (router only) → SessionProvider → components
        • StageRenderer (renders stage)
        • VoicePanel | TextPanel | HybridPanel (inputs)
        • VocabSidebar (vocab card)
        • PluginSlot (feature injection point)
```

### 2. Plugin Architecture
**From:** Hardcoded feature logic
**To:** FEATURE_GATES + lazy-loaded plugins
**Benefit:** New features (Debate, Story Studio, etc.) add zero lines to core

```javascript
FEATURE_GATES = {
  DEBATE_MODE: { enabled: true, ageGate: { min: 9, max: 13 }, costMultiplier: 1.2 },
  STORY_STUDIO: { enabled: true, ageGate: { min: 8, max: 13 }, costMultiplier: 1.5 },
  PRE_READING: { enabled: true, ageGate: { min: 6, max: 13 }, costMultiplier: 0.8 },
  // ...
}

// Feature plugins live in isolation:
features/debate/DebateModuleStageBody.jsx
features/story-studio/StoryStudioLauncher.jsx
// etc.
```

### 3. Backend Service Refactoring
**From:** Hardcoded switch/case in engine.js
**To:** TaskAdapter + ModelStrategy patterns
**Benefit:** New AI tasks and models add zero coupling

```
TaskAdapter (abstract)
├── SessionResponseAdapter    [current]
├── DebateFacilitationAdapter [new]
├── StoryGenerationAdapter    [new]
└── AdaptiveAnalysisAdapter   [new]

ModelStrategy (abstract)
├── AnthropicStrategy      [current]
├── LocalModelStrategy     [new: Phi-3, Mistral]
└── HybridStrategy         [cost-aware routing]
```

### 4. Progressive Disclosure Navigation
**From:** 6 fixed links (all visible)
**To:** Age-gated nav with "More" menu
**Benefit:** Beginner sees 3 items, Advanced sees 8; COPPA-compliant

```
Age 6-8:   🏠 Home, 🚀 Start, 📚 Library, 👤 Profile
Age 9-11:  + ⭐ Studio, 🤔 Debate, 👥 Readers
Age 12-13: + ✍️ Create, 🧠 Insights
Parent:    👨‍👩‍👧 Parent Hub (child never sees)
Teacher:   🏫 Academy (child never sees)
```

### 5. State Management Migration
**From:** 36 scattered useState hooks
**To:** SessionContext (useReducer) → Zustand
**Benefit:** Centralized, testable, composable state

```
// Before: scattered across 1,451 lines
const [messages, setMessages] = useState([]);
const [vocabCard, setVocabCard] = useState(null);
const [showConfetti, setShowConfetti] = useState(false);
// ... 33 more ...

// After: SessionProvider + useSessionContext()
const { state, dispatch } = useSessionContext();
dispatch({ type: 'ADD_MESSAGE', payload: message });
dispatch({ type: 'SET_VOCAB_CARD', payload: card });
dispatch({ type: 'SHOW_CONFETTI' });
```

### 6. Cost-Aware Model Routing
**From:** SONNET default for all tasks
**To:** Fine-tuned models for beginner (Phi-3), SONNET for advanced
**Benefit:** 68% cost reduction ($0.18 → $0.06) with optional fine-tuning

```
Cost-optimized budget:
• Base Q&A (Phi-3):      $0.006 per call (vs $0.018 SONNET)
• Story generation (Phi-3): $0.006 per call (vs $0.035 SONNET)
• Debate (SONNET):       $0.025 per call (reasoning needed)

Typical session: 9 calls → $0.054 (cost-optimized) vs $0.162 (standard)
→ 68% savings
```

---

## Impact Assessment

### What Stays the Same (Non-Breaking)
- Session flow (title → intro → body → conclusion)
- Q&A questions and Socratic method
- Voice input, text input, hybrid input
- Vocabulary learning, confetti celebration, achievement system
- Grade/parent reports
- **All existing tests pass**

### What Changes (Internal Only)
- Component architecture (invisible to student)
- State management (invisible to student)
- Backend abstraction (invisible to student)
- Navigation visibility (smart, but seamless for each age)

### What Becomes Possible (New)
- Add features without editing core session logic
- Support fine-tuned models + future LLMs
- Cost-optimize for B2B deployments
- A/B test new features via feature flags
- Analyze costs per feature, per student level

---

## Implementation Roadmap

| Week | Focus | Deliverables | Risk |
|------|-------|--------------|------|
| **1** | Component decomposition | SessionProvider, StageRenderer, PluginSlot | LOW |
| **2** | Backend refactoring | TaskAdapter, ModelStrategy, CostTracker | MEDIUM |
| **3** | State migration | useState → useReducer → Zustand | MEDIUM |
| **4** | Feature framework + integration | FeatureGates, Debate Mode stub, fine-tuned models | MEDIUM |
| **Post-4** | Validation | A/B test (10% → 20% → 50% → 100%), monitor metrics | LOW |

**Critical Path:**
1. Week 1: SessionProvider (blocks everything else)
2. Week 2: Backend refactoring (enables new AI tasks)
3. Week 3-4: State + nav + feature framework (integration)

**Total Effort:** 4-6 weeks (assuming 2 FTE)
**Breaking Changes:** 0 (all migrations non-breaking)
**Test Coverage:** 75%+ (from 40%)

---

## Risk Mitigation

### High-Risk Items
| Risk | Mitigation |
|------|-----------|
| SessionProvider context becomes perf bottleneck | Implement React.memo, split contexts by concern, profile with DevTools |
| Fine-tuned models degrade accuracy | A/B test with 10% of users, monitor eval harness, fallback to SONNET |
| Feature plugins interfere with core flow | Plugin interface spec, unit test each plugin, feature flag to isolate |
| State migration introduces bugs | Implement comprehensive reducer tests, parallel old/new code paths |
| COPPA compliance not enforced | Server-side role/age validation, parent consent stored securely |

### Rollback Strategy
- **SessionProvider fails:** Feature flag to old SessionPage
- **Adapter refactoring breaks responses:** Feature flag to old engine.js
- **Fine-tuned models fail:** Feature flag to SONNET (higher cost, but safe)

---

## Success Metrics

### Functional
- [ ] SessionPage ≤ 200 lines (vs 1,451)
- [ ] 5+ features added via plugins (zero core edits)
- [ ] All existing tests pass (behavior identical)
- [ ] 75%+ test coverage (up from 40%)

### Performance
- [ ] SessionPage re-render < 50ms
- [ ] No unnecessary Context re-renders (confirmed by DevTools)
- [ ] Bundle size increase < 15% (plugins lazy-loaded)
- [ ] FCP unchanged (< 2.5s)

### Cost
- [ ] Cost-optimized budget: $0.06/session (vs $0.18 standard)
- [ ] Fine-tuned models: 95% eval score match vs SONNET
- [ ] Cost tracking accuracy: ±2% vs Anthropic API
- [ ] Feature-specific costs tracked (debate +20%, story +50%)

### Child UX
- [ ] Nav items for Beginner: 3-4 (not overwhelming)
- [ ] Nav items for Advanced: 7-8 (discoverable)
- [ ] 90%+ story completion rate (not distracted)
- [ ] 0 COPPA violations

### Developer Experience
- [ ] New feature time: 3-5 days (vs 2-3 weeks)
- [ ] Onboarding time: < 4 hours (vs 2-3 days)
- [ ] Breaking changes: 0

---

## Next Steps

### Immediate (Before Week 1)
1. [ ] Architecture review by leads (Backend, Frontend, Security)
2. [ ] Finalize FEATURE_GATES catalog with product team
3. [ ] Prioritize Phase 1 features (Debate? Story Studio? Pre-Reading?)
4. [ ] Assign owners: SessionProvider, Backend Refactoring, Navigation
5. [ ] Set up feature branch + CI/CD for non-breaking tests

### Week 1 Kickoff
1. [ ] Create SessionProvider + hooks skeleton
2. [ ] Migrate session initialization to provider
3. [ ] Implement sessionReducer with 15+ action types
4. [ ] Extract StageRenderer component
5. [ ] Create PluginSlot + FeatureGateProvider
6. [ ] Daily standup: 15 min sync

### Ongoing
- [ ] Daily: Run test suite (must have 100% green)
- [ ] 2x weekly: Performance profiling with DevTools
- [ ] Weekly: Architecture sync (blockers, risks, decisions)
- [ ] Post-Week 4: A/B test plan with product + analytics

---

## Questions for Architecture Review

1. **SessionProvider scope:** Should we split into SessionContext + UIContext to minimize re-renders?
2. **Fine-tuned models:** Should we train Phi-3/Mistral in parallel with this work, or post-launch?
3. **Feature priority:** Which 3 features should Phase 1 plugins target (Debate, Story, Pre-Reading, Adaptive, Social)?
4. **COPPA enforcement:** Server-side or client + server? (Recommend: both)
5. **A/B test duration:** 2 weeks at 10%? Or faster ramp?

---

## Approval Sign-Off

| Role | Owner | Status | Date |
|------|-------|--------|------|
| Architecture Lead | [TBD] | PENDING | |
| Backend Lead | [TBD] | PENDING | |
| Frontend Lead | [TBD] | PENDING | |
| Security/COPPA | [TBD] | PENDING | |
| Product | [TBD] | PENDING | |

---

**ADR Status:** PROPOSED (awaiting architecture review)
**Full Document:** `/sessions/loving-dreamy-lamport/mnt/hi-alice/ARCHITECTURE_DECISION_RECORD_v1.md`
**Created:** 2026-03-14
**Last Updated:** 2026-03-14
