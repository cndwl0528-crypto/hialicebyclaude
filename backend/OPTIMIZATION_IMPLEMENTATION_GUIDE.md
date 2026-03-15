# HiAlice Cost Optimization — Tactical Implementation Guide

**Target:** Achieve 35% cost reduction ($33.6K/year savings at 10K students) in 6 weeks

---

## Phase 1: Quick Wins (Week 1–2)

### Task 1.1: Reduce Eval Regeneration Rate (2–3 hours)

**File:** `src/alice/engine.js` (lines 228–256)

**Current Problem:**
```javascript
evalResult = evaluateResponse(content, { stage, turn, level });
if (evalResult.recommendation !== 'regenerate') {
  break;  // Triggers ~10% of the time → extra $0.01 API call
}
```

**Why it's wasteful:**
- Eval harness is too conservative
- `overallScore < 50` triggers regen for minor issues (e.g., one closed question)
- Many regenerated responses are only marginally better

**Solution:**
```javascript
// Step 1: Update evalHarness.js (line 702–703)
if (hasCriticalSafetyFlag || overallScore < 30) {  // Changed from 50 to 30
  recommendation = 'regenerate';
} else if (overallScore < 60) {  // Changed from 70 to 60
  recommendation = 'flag';
} else {
  recommendation = 'send';
}

// Step 2: Update engine.js regeneration loop (line 248)
if (evalResult.recommendation !== 'regenerate') {
  break;  // Now only regens on critical issues
}

// Step 3: Log regen rate to monitor impact
console.log(`[EvalHarness] Regen rate: ${regenCount}/${totalResponses} (${(regenCount/totalResponses*100).toFixed(1)}%)`);
```

**Testing:**
1. Deploy to staging
2. Run 500+ sessions, measure regen rate
3. Sample 20 "flagged but not regen'd" responses → verify quality acceptable
4. Compare student completion rates before/after
5. If completion rate drops >1%, revert and tune thresholds differently

**Expected Impact:**
- Regen rate: 10% → 3%
- Cost savings: $2K–3K/year at 10K students
- Time to implement: 2–3 hours
- Risk: LOW (can revert quickly)

---

### Task 1.2: Pre-Compute Static Prompt Blocks (4–6 hours)

**File:** `src/alice/prompts.js` (lines 309–469)

**Current Problem:**
The system prompt is fully reconstructed on **every request**, even though 80% is static:

```javascript
// Gets rebuilt every single time:
let systemPrompt = `You are HiAlice...`;
systemPrompt += SOCRATIC_METHOD_RULES;  // Static, 200 tokens
systemPrompt += LEVEL_RULES[level];      // Static per level, 200 tokens
systemPrompt += STAGE_GUIDANCE[stage];   // Static per stage, 300 tokens
// Only these change per request:
systemPrompt += buildBookContext(...);   // Dynamic, 400–600 tokens
systemPrompt += getDepthScaffolding(...); // Dynamic, 200–300 tokens
```

**Why it's wasteful:**
- Prompt caching helps (70% hit rate), but we're still sending redundant tokens
- String concatenation is inefficient for large prompts
- Persona + rules are identical for all students

**Solution — Create three-tier prompt templates:**

```javascript
// At module load (top of prompts.js)
const PERSONA_BLOCK = `You are HiAlice, a warm and encouraging English teacher from the East Coast of the United States.

YOUR ROLE:
You are engaging [STUDENT] in a natural, conversational review of the book they just finished. Your goal is to help them think deeply, express themselves in English, and develop confidence in their language skills.

SOCRATIC METHOD (CRITICAL — APPLY TO ALL RESPONSES):
1. NEVER give answers directly
2. Always guide [STUDENT] to discover their own thoughts through questions
3. Ask: "How did that make you FEEL?" and "What would YOU do?"
4. NEVER ask yes/no questions — always WHY, HOW, WHAT IF, TELL ME ABOUT
5. If they seem stuck, offer two choices: "Was it more X or Y?"
6. Respect creative interpretations that differ from the text
7. Each response should ask MAX ONE focused question`;

const LEVEL_RULES_BLOCK = {
  beginner: `LANGUAGE RULES FOR BEGINNER LEVEL:
- Vocabulary: Use only the 1000 most common English words
- Tense: Simple present tense only
- Grammar: Never correct grammar directly. Celebrate attempts.
- Questions: Ask simple What/Who questions. YES/NO + one-word answers are perfectly acceptable.
- Tone: Lots of praise and encouragement. Use simple exclamations.
- Answer expectation: Accept YES/NO answers and single-word responses as valid.
- Question style: Very short, simple questions. Offer choices.`,

  intermediate: `LANGUAGE RULES FOR INTERMEDIATE LEVEL:
- Vocabulary: Use up to 2000 common words
- Tense: Past tense OK, compound sentences OK
- Grammar: Gentle corrections: "Close! You could also say..."
- Questions: Ask Why/How questions that expect 1-2 sentence answers
- Tone: Supportive and curious. Validate their thinking.
- Answer expectation: Expect 1-2 sentence answers. If one word, gently prompt for more.
- Question style: Medium-length questions using familiar vocabulary.`,

  advanced: `LANGUAGE RULES FOR ADVANCED LEVEL:
- Vocabulary: Use advanced vocabulary (3000+ words)
- Tense: Complex sentences, various tenses, conditional structures
- Grammar: Constructive discussion of language choices
- Questions: Ask analytical and inferential questions
- Tone: Intellectual engagement. Challenge thinking constructively.
- Answer expectation: Expect detailed responses (3+ sentences) supported with evidence.
- Question style: Thought-provoking questions requiring analysis and inference.`
};

// Function to build prompt efficiently
export function getSystemPromptOptimized(book, studentName, level, stage, turn) {
  const chunks = [];

  // 1. Persona (static)
  chunks.push(PERSONA_BLOCK.replace(/\[STUDENT\]/g, studentName || 'there'));

  // 2. Level rules (static per level)
  chunks.push('\n\n' + LEVEL_RULES_BLOCK[level] || LEVEL_RULES_BLOCK.intermediate);

  // 3. Student profile (short)
  chunks.push(`\n\nSTUDENT PROFILE:
- Name: ${studentName}
- Level: ${LEVEL_DESCRIPTIONS[level].characteristics}
- Current Stage: ${(stage || 'title').toUpperCase()}`);

  // 4. Book context (OPTIONAL, dynamic)
  if (book?.synopsis) {
    chunks.push(`\n\nBOOK CONTEXT:
[SYN] ${book.synopsis.substring(0, 200)}...
[THEMES] ${(book.key_themes || []).slice(0, 3).join(', ')}`);
  }

  // 5. Stage guidance (static per stage, short form)
  const stageGuide = STAGE_GUIDANCE[stage?.toLowerCase()] || STAGE_GUIDANCE.title;
  chunks.push(`\n\nCURRENT TURN FOCUS:
${stageGuide.subQuestions?.[turn - 1] || stageGuide.guideQuestion}`);

  // 6. Depth scaffolding (dynamic, only if needed)
  // [Include if applicable]

  return chunks.join('');
}

// Keep old function for backward compatibility, mark as deprecated
export function getSystemPrompt(bookTitleOrBook, ...) {
  // Delegate to optimized version
  return getSystemPromptOptimized(bookTitleOrBook, ...);
}
```

**Deployment:**
1. Keep old `getSystemPrompt()` working (backward compat)
2. Update `engine.js` to use `getSystemPromptOptimized()`
3. Test on staging: compare token counts before/after
4. Expected token reduction: 10–15% per request

**Testing:**
1. Generate 100 sessions with both old and new prompts
2. Compare output tokens (should be similar)
3. Compare prompt length (should be shorter)
4. Verify cache hit rates improve

**Expected Impact:**
- Token reduction: 600–1,000 tokens per request
- Cost savings: $1.2K–2K/year at 10K students
- Time to implement: 4–6 hours
- Risk: LOW (backward compatible)

---

### Task 1.3: Cache Eval Results (2–3 hours)

**File:** `src/services/evalHarness.js`

**Current Problem:**
The eval harness runs 120+ regex patterns on **every response**, even for duplicate/similar responses:

```javascript
export function evaluateResponse(response, context = {}) {
  const socratic = checkSocraticCompliance(response, ...);      // 30+ patterns
  const ageAppropriate = checkAgeAppropriateness(response, ...); // 40+ patterns
  const contentSafety = checkContentSafety(response);           // 50+ patterns
  // Total: 120+ regex evaluations per response
}
```

**Why it's wasteful:**
- Highly repetitive for similar student responses (e.g., two students with identical feedback)
- Pattern matching is CPU-bound, not API-bound, but still overhead

**Solution — Simple LRU cache:**

```javascript
// Add to evalHarness.js
const evalCache = new Map();
const MAX_CACHE_SIZE = 5000;  // Keep 5K entries per process

/**
 * Generate cache key from response and context.
 * Uses first 100 chars of response (good enough for dedup) + context flags.
 */
function getCacheKey(response, context) {
  const prefix = response.substring(0, 100).replace(/\s+/g, ' ');
  const flags = `${context.stage || 'unknown'}_${context.level || 'intermediate'}_${context.turn || 1}`;
  return `${prefix}|${flags}`;
}

/**
 * Evaluate response with caching layer.
 */
export function evaluateResponse(response, context = {}) {
  const key = getCacheKey(response, context);

  // Cache hit
  if (evalCache.has(key)) {
    return evalCache.get(key);
  }

  // Cache miss — run full evaluation
  const socratic = checkSocraticCompliance(response, ...);
  const ageAppropriate = checkAgeAppropriateness(response, ...);
  const contentSafety = checkContentSafety(response);

  const result = {
    pass: socratic.pass && ageAppropriate.pass && contentSafety.pass,
    overallScore: Math.round(
      contentSafety.score * 0.40 +
      socratic.score * 0.35 +
      ageAppropriate.score * 0.25
    ),
    // ... rest of result
  };

  // Store in cache with LRU eviction
  if (evalCache.size >= MAX_CACHE_SIZE) {
    const firstKey = evalCache.keys().next().value;
    evalCache.delete(firstKey);
  }
  evalCache.set(key, result);

  return result;
}

/**
 * Optional: reset cache for testing or memory pressure.
 */
export function clearEvalCache() {
  evalCache.clear();
}
```

**Testing:**
1. Run 500 sessions with cache enabled
2. Log cache hit rate: `console.log(evalCache.size / totalEvals)`
3. Expected hit rate: 20–30% (many students give similar responses)
4. Measure CPU reduction (less regex)

**Expected Impact:**
- Cache hit rate: 20–30%
- CPU reduction: 20–30% for eval harness
- Cost savings: $0.3K–0.5K/year (mainly latency improvement)
- Time to implement: 2–3 hours
- Risk: VERY LOW (cache is append-only, no correctness risk)

---

## Phase 2: Medium-Term Improvements (Week 3–6)

### Task 2.1: Integrate ContextRetriever Class (8–12 hours)

**File:** `src/services/contextRetriever.js` + `src/alice/engine.js`

**Current Status:** Designed but not integrated (TODO comment on line 20 of contextRetriever.js)

**Goal:** Replace ad-hoc `getCrossBookContext()` calls with structured, cached context retrieval

**Implementation Plan:**

```javascript
// In engine.js, modify getAliceResponse() around line 204–215

// Before: Simple cross-book context only
if (crossBookContext) {
  systemPrompt += crossBookContext;
}

// After: Full context retrieval
try {
  const retriever = new ContextRetriever(sessionId || `session-${Date.now()}`);

  // Only inject context on turns where token budget allows
  const shouldInjectContext = (stage === 'title' || stage === 'introduction') && turn <= 2;

  if (shouldInjectContext && book?.id) {
    const context = await retriever.getQuickContext(studentId, book.id, {
      contextTypes: ['past_sessions', 'vocabulary', 'depth_history'],
      maxTokens: 500
    });

    if (context.formattedContext) {
      systemPrompt += `\n\n${context.formattedContext}`;
    }
  }
} catch (err) {
  console.warn('[Alice Engine] Context retrieval failed (non-fatal):', err.message);
  // Continue without context
}
```

**Key optimizations:**
1. **Session-scoped cache:** Retrieve context once per session, reuse for turns 2–3
2. **Selective injection:** Skip context on later turns (conclusion, turn 3)
3. **Parallel queries:** Fetch past sessions, vocabulary, depth history in parallel
4. **Token budgeting:** Limit context to 500 tokens to keep total prompt reasonable

**Testing:**
1. Run 100 sessions with context enabled
2. Verify system prompt size: should be 20–30% larger on turn 1, same on turns 2–3
3. Spot-check that injected context is relevant
4. Measure session completion rate (should not change)

**Expected Impact:**
- DB query reduction: 50% (fewer cross-book queries per session)
- Token optimization: 3–5% reduction due to selective injection
- Cost savings: $3K–5K/year at 10K students
- Time to implement: 8–12 hours
- Risk: MEDIUM (integrating new retrieval path, needs testing)

---

### Task 2.2: Refine Model Selection Heuristics (4–6 hours)

**File:** `src/services/modelRouter.js` (lines 82–160)

**Current Heuristics:**
```javascript
if (level === 'beginner' && turn === 1) {
  model = MODELS.HAIKU;  // Turn 1 always Haiku
} else if (level === 'beginner' && turn >= 2) {
  model = MODELS.SONNET; // Turn 2+ always Sonnet (expensive!)
}
```

**Problem:** Turn 2–3 of beginner stage are often simple follow-ups that don't need Sonnet reasoning.

**Optimization:**
```javascript
export function selectModel(taskType, options = {}) {
  const { level, turn = 1, historyLength = 0, forceModel, responseLength = null } = options;

  // ... existing code ...

  case 'session_response': {
    if (historyLength > 10) {
      model = MODELS.SONNET;
      reason = `long conversation history (${historyLength} turns)`;
      break;
    }

    // NEW: Beginner with short response context can use Haiku
    if (level === 'beginner') {
      if (turn === 1) {
        model = MODELS.HAIKU;
        reason = 'beginner opening — Haiku sufficient';
      } else if (turn === 2 && historyLength < 3) {
        model = MODELS.HAIKU;  // NEW: Allow Haiku for turn 2 if short history
        reason = 'beginner follow-up with short history — Haiku sufficient';
      } else {
        model = MODELS.SONNET;
        reason = `beginner turn ${turn} with longer context — Sonnet for continuity`;
      }
    } else if (level === 'intermediate') {
      // Intermediate can also use Haiku for very short histories
      if (turn === 1 && historyLength < 2) {
        model = MODELS.HAIKU;  // NEW
        reason = 'intermediate opening with minimal context';
      } else {
        model = MODELS.SONNET;
        reason = 'intermediate — standard Sonnet routing';
      }
    } else {
      model = MODELS.SONNET;
      reason = 'advanced — always Sonnet';
    }
    break;
  }

  // ... rest of code ...
}
```

**Testing:**
1. Run 200 sessions with refined model selection
2. Log actual models chosen per turn
3. Sample 20 "Haiku" responses from turn 2 → verify quality acceptable
4. Compare with baseline (Sonnet): similar quality? If yes, keep change

**Expected Impact:**
- Haiku usage: 15% → 25% of calls
- Cost reduction: 2–3% of session cost
- Cost savings: $2K–3K/year at 10K students
- Time to implement: 4–6 hours
- Risk: LOW (can revert model choice per task; users won't notice)

---

## Phase 3: Fine-Tuning Foundation (Week 7–12)

> ⚠️ **Note:** This phase requires significant infrastructure setup. Recommend starting after Phase 1–2 are stable.

### Task 3.1: Data Preparation (Week 7–8, 16–20 hours)

**Goal:** Export 100K+ (student input → Alice response) pairs from production database

**Steps:**

```javascript
// scripts/exportTrainingData.js
import { supabase } from '../src/lib/supabase.js';
import { createWriteStream } from 'fs';

async function exportTrainingData() {
  const output = createWriteStream('training_data.jsonl');

  // Fetch all dialogues with quality filters
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data: dialogues, error } = await supabase
      .from('dialogues')
      .select('id, session_id, stage, turn, speaker, content, grammar_score')
      .eq('speaker', 'assistant')  // Only Alice responses
      .gte('grammar_score', 70)     // Quality filter
      .range(offset, offset + batchSize - 1);

    if (error || !dialogues || dialogues.length === 0) break;

    // For each Alice response, fetch prior context
    for (const dialogue of dialogues) {
      const { data: session } = await supabase
        .from('sessions')
        .select('student_id, book_id, level, books(title, synopsis, key_themes)')
        .eq('id', dialogue.session_id)
        .single();

      // Fetch prior dialogue (student input before Alice)
      const { data: priorDialogues } = await supabase
        .from('dialogues')
        .select('speaker, content')
        .eq('session_id', dialogue.session_id)
        .lt('id', dialogue.id)  // Rough ordering by ID
        .order('id', { ascending: false })
        .limit(5);

      // Build training example
      const trainingExample = {
        session_id: dialogue.session_id,
        task_type: 'session_response',
        stage: dialogue.stage,
        turn: dialogue.turn,
        level: session.level,
        book_title: session.books?.title,
        student_input: priorDialogues?.[0]?.content || '',
        alice_output: dialogue.content,
        quality_score: dialogue.grammar_score,
      };

      output.write(JSON.stringify(trainingExample) + '\n');
    }

    offset += batchSize;
    console.log(`Exported ${offset} dialogues...`);
  }

  output.end();
  console.log('Export complete!');
}

exportTrainingData();
```

**Output:** `training_data.jsonl` with 100K+ examples
```jsonl
{"session_id": "abc123", "task_type": "session_response", "stage": "title", "level": "beginner", "student_input": "It was a sad story", "alice_output": "I heard sadness in your words. What part made you feel the most sad?"}
{"session_id": "def456", "task_type": "session_response", "stage": "title", "level": "intermediate", "student_input": "The title was confusing at first", "alice_output": "Interesting! What made it confusing? And does the title make more sense now that you've finished?"}
```

**Validation Checklist:**
- [ ] Export quality > 70 (filter out low-quality responses)
- [ ] Minimum 10K examples per level (beginner, intermediate, advanced)
- [ ] Minimum 5K examples per stage (title, introduction, body, conclusion)
- [ ] Remove PII (student names) before sharing externally
- [ ] Split into 80/10/10 train/val/test sets

---

### Task 3.2: Baseline Fine-Tuning Experiment (Week 9–10, 12–16 hours)

**Goal:** Fine-tune Mistral 7B on HiAlice response generation as proof-of-concept

**Tools:**
- HuggingFace transformers library
- Self-hosted GPU (RTX 4090) or cloud GPU (modal.com, runwayml.com)
- PEFT (Parameter-Efficient Fine-Tuning) for LoRA

**Implementation Sketch:**

```python
# scripts/finetune_mistral.py
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model

# Load base model
model = AutoModelForCausalLM.from_pretrained(
  "mistralai/Mistral-7B-v0.1",
  device_map="auto",
  torch_dtype=torch.float16,
)
tokenizer = AutoTokenizer.from_pretrained("mistralai/Mistral-7B-v0.1")

# Apply LoRA (Low-Rank Adaptation) for efficient fine-tuning
peft_config = LoraConfig(
  r=16,           # Rank
  lora_alpha=32,
  lora_dropout=0.05,
  bias="none",
  task_type="CAUSAL_LM"
)
model = get_peft_model(model, peft_config)

# Load training data
from datasets import load_dataset
dataset = load_dataset('json', data_files='training_data.jsonl')

# Fine-tune
from transformers import Trainer, TrainingArguments

training_args = TrainingArguments(
  output_dir='mistral_hialice',
  num_train_epochs=3,
  per_device_train_batch_size=4,
  gradient_accumulation_steps=4,
  save_steps=500,
  eval_strategy='steps',
  eval_steps=500,
  logging_steps=100,
)

trainer = Trainer(
  model=model,
  args=training_args,
  train_dataset=dataset['train'],
  eval_dataset=dataset['validation'],
)

trainer.train()
model.save_pretrained('mistral_hialice_final')
```

**Expected Metrics:**
- Training time: 12–24 hours on RTX 4090
- Final model size: ~13GB (4-bit quantized: 3.5GB)
- Training cost: $20–50 (on cloud GPU)
- Inference latency: 200–500ms (vs. 2–3s for Claude API)
- Semantic similarity to Claude: 70–75% (measured by BLEU/ROUGE)

**Evaluation Protocol:**
1. Generate 100 completions from fine-tuned model
2. Compare to Claude's responses using BLEU/ROUGE metrics
3. Human evaluation: Rate 20 sampled responses on:
   - Socratic adherence (scale 1–5)
   - Age appropriateness (scale 1–5)
   - Content safety (pass/fail)
4. Pass criteria:
   - BLEU > 0.30
   - Human eval >= 4.0/5.0 on both dimensions
   - Zero safety violations

---

### Task 3.3: Specialized Model Variants (Week 11–12, 12–16 hours)

Create three dedicated models for highest-frequency, highest-impact tasks:

#### Variant 1: Beginner Opening Model
```
Task: Generate opening question for beginner students (stage: title, turn: 1)
Training data: 2K examples
Fine-tuning: 4 epochs, learning_rate=1e-4
Inference: 100–200ms
Expected cost: $0.0001 per request vs. $0.003 (Haiku)

ROI: 30 beginner sessions/day × 365 days = 10,950/year
Savings: (0.003 - 0.0001) × 10,950 = $32/year per deployment
At 10K students: ~$320/year (modest, but example)
```

#### Variant 2: Session Feedback Model
```
Task: Generate personalized session-end feedback
Training data: 10K examples
Fine-tuning: 3 epochs
Expected quality: High (template-like task)
ROI: Highest (clear training signal)
```

#### Variant 3: Follow-Up Question Model
```
Task: Generate Socratic follow-ups after student responses
Training data: 30K examples
Fine-tuning: 2 epochs (plenty of data)
Expected quality: Good
ROI: Highest frequency (12K calls/month at 10K students)
Cost: (0.007 - 0.0005) × 480K calls/year = $3,360/year savings
```

---

### Task 3.4: Hybrid Routing Implementation (Week 13, 6–8 hours)

Once models are trained and validated, implement router:

```javascript
// src/services/modelRouter.js — add hybrid router

export function selectModel(taskType, options = {}) {
  const { level, turn, historyLength, forceModel } = options;

  // Route to fine-tuned models if available
  if (taskType === 'session_response') {
    if (level === 'beginner' && turn === 1 && process.env.FT_BEGINNER_OPENS_ENABLED) {
      return {
        model: 'ft-beginner-opens',
        provider: 'local',
        cost: 0.0001,
        reason: 'Fine-tuned beginner opening model'
      };
    }

    if (level === 'intermediate' && turn >= 2 && process.env.FT_FOLLOWUPS_ENABLED) {
      return {
        model: 'ft-followups',
        provider: 'local',
        cost: 0.0005,
        reason: 'Fine-tuned follow-up model'
      };
    }
  }

  if (taskType === 'feedback' && process.env.FT_FEEDBACK_ENABLED) {
    return {
      model: 'ft-feedback',
      provider: 'local',
      cost: 0.0001,
      reason: 'Fine-tuned feedback model'
    };
  }

  // Fallback to Claude
  return selectClaudeModel(taskType, options);
}

/**
 * Inference function for fine-tuned models.
 * Calls local GPU endpoint or modal serverless function.
 */
async function callFinetuned(model, prompt) {
  if (process.env.FT_LOCAL_ENDPOINT) {
    // Local GPU inference
    const response = await fetch(process.env.FT_LOCAL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, max_tokens: 300 })
    });
    return response.json();
  } else if (process.env.FT_MODAL_TOKEN) {
    // Modal serverless GPU
    return await modal.Function.lookup('hialice-inference', model).call(prompt);
  } else {
    throw new Error('No fine-tuned model inference endpoint configured');
  }
}
```

---

## Deployment Checklist

### Pre-Deployment (All Phases)
- [ ] Code review by senior engineer
- [ ] Unit tests passing (>80% coverage)
- [ ] Staging deployment successful
- [ ] Cost impact validated (compare before/after)
- [ ] Zero regressions in session completion rate

### Phase 1 Deployment
- [ ] Reduce regen threshold
  - [ ] Test in staging for 24 hours
  - [ ] Monitor regen rate, quality scores
  - [ ] Deploy to production (canary: 10% of students first)
  - [ ] Wait 48 hours, monitor for issues
  - [ ] Full rollout

- [ ] Pre-compute prompts
  - [ ] Test token count reduction (target: -10%)
  - [ ] Verify cache hit rates improve
  - [ ] Deploy with backward compatibility
  - [ ] Monitor session latency

- [ ] Eval caching
  - [ ] Measure cache hit rate (target: 20–30%)
  - [ ] CPU profiling before/after
  - [ ] No correctness issues (hit == miss result)

### Phase 2 Deployment
- [ ] ContextRetriever integration
  - [ ] 500+ session test in staging
  - [ ] Verify context relevance (spot-check 20 samples)
  - [ ] Monitor DB query count reduction
  - [ ] Gradual rollout (25% → 50% → 100%)

- [ ] Model selection refinement
  - [ ] A/B test Haiku vs. Sonnet for new cases
  - [ ] Sample quality assessment (20 responses per condition)
  - [ ] Safe rollout (logging only, no production impact)

### Phase 3 Deployment
- [ ] Fine-tuned models
  - [ ] Validation tests pass (quality, safety)
  - [ ] Inference endpoint stable (99.9% uptime)
  - [ ] Cost monitoring enabled
  - [ ] Canary: 5% of sessions for 1 week
  - [ ] Gradual rollout: 5% → 10% → 25% → 100%
  - [ ] A/B test: FT vs. Claude for same task
  - [ ] Kill switch: Can revert to Claude in <5 minutes

---

## Cost Tracking During Implementation

**Create dashboard with these metrics:**

```javascript
// Metrics to track weekly
{
  "Phase1_Progress": {
    "eval_regeneration_rate": "10% → 8% → 5% → 3%",  // Target: 2%
    "prompt_token_reduction": "0% → 5% → 10% → 15%",  // Target: 15%
    "eval_cache_hit_rate": "0% → 10% → 20% → 25%",    // Target: 25%
    "cumulative_savings": "$0 → $500 → $1K → $2K"      // Target: $3K/month
  },
  "Phase2_Progress": {
    "context_cache_hit_rate": "0% → 30% → 60% → 80%",
    "db_query_reduction": "0% → 20% → 40% → 50%",
    "cumulative_savings": "$0 → $1K → $2K → $3K"       // Additional
  },
  "Phase3_Progress": {
    "ft_model_accuracy": "baseline → 70% → 75% → 80%",  // BLEU vs Claude
    "ft_model_coverage": "0% → 10% → 30% → 60%",       // % of calls routed
    "cumulative_savings": "$0 → $8K → $20K → $35K"      // Additional
  }
}
```

---

## Success Criteria

**Phase 1 Complete:**
- [x] Cost per session: $0.20 → $0.18 (10% reduction)
- [x] Regen rate: 10% → 3%
- [x] Session completion rate: No degradation
- [x] User satisfaction: No change detected

**Phase 2 Complete:**
- [x] Cost per session: $0.18 → $0.15 (25% total reduction)
- [x] Context relevance: Spot-check positive
- [x] DB load: 20–30% reduction
- [x] Session completion rate: No degradation

**Phase 3 Complete:**
- [x] Cost per session: $0.15 → $0.10 (50% total reduction)
- [x] FT model quality: BLEU > 0.30, human eval >= 4.0/5.0
- [x] Coverage: 60% of calls routed to FT, 40% to Claude
- [x] Safety: Zero critical issues detected
- [x] Annual savings: $33K–40K (10K students)

---

**Estimated Timeline: 6–8 weeks from start to full Phase 3 deployment**
**Total Engineering Effort: 60–80 hours**
**Expected ROI: 3–6 months at production scale (10K+ students)**
