# HiAlice Backend Cost Audit & Optimization Roadmap

**Complete Audit Report Generated:** March 14, 2026

---

## 📋 Audit Documents (Read in Order)

### 1. **COST_MODEL_SUMMARY.md** ⭐ START HERE
   - **Executive summary** of cost findings
   - Current cost model at different scales
   - Quick overview of all optimization phases
   - **Read time:** 10 minutes
   - **Best for:** Decision-makers, stakeholders, budget planning

### 2. **COST_AUDIT_AND_OPTIMIZATION_ROADMAP.md** 📊 COMPREHENSIVE ANALYSIS
   - **Detailed audit** of all backend components
   - Token usage breakdown per request type
   - Engineering quality assessment (7.6/10)
   - Part-by-part analysis of 11 key files
   - 5+ quick-win optimizations (Week 1–2)
   - Medium-term improvements (Week 3–6)
   - Fine-tuning distillation path (Week 7+)
   - **Read time:** 45 minutes
   - **Best for:** Engineers, technical leads, architecture review

### 3. **OPTIMIZATION_IMPLEMENTATION_GUIDE.md** 🔧 TACTICAL EXECUTION
   - **Step-by-step implementation** for all optimizations
   - Code snippets ready to use
   - Testing procedures and validation checklists
   - Deployment strategies per phase
   - Cost tracking dashboard metrics
   - Success criteria and KPIs
   - **Read time:** 60 minutes
   - **Best for:** Engineering teams executing the roadmap

---

## 🎯 Key Findings at a Glance

### Current State
```
Cost per session:        $0.20 (6 Claude API calls + eval harness)
Sessions/month (10K):    40,000
Annual cost:             $96,000
```

### Phase 1 Opportunity (Week 1–2, $3–5K savings)
```
Quick wins:
  - Reduce eval regeneration threshold          → $2K/year
  - Pre-compute static prompt blocks            → $1.5K/year
  - Cache eval results                          → $0.5K/year
Total savings: $4K/year (4% reduction)
```

### Phase 2 Opportunity (Week 3–6, $8–12K additional)
```
Medium-term:
  - Integrate ContextRetriever class            → $3–5K/year
  - Refine model selection heuristics           → $2–3K/year
  - Selective context injection                 → $2–3K/year
Total additional: $10K/year (10% reduction from baseline)
```

### Phase 3 Opportunity (Week 7–12, $30–40K long-term)
```
Fine-tuning:
  - Beginner opening model (60 calls/day)       → $7K/year
  - Session feedback model                      → $2K/year
  - Follow-up question model (480/day)          → $10K/year
  - Hybrid routing (60% FT, 40% Claude)         → $35K/year cumulative
Total additional: $35K/year (36% reduction from baseline)
```

### Full Optimization Target
```
Baseline:        $96,000/year (10K students)
After Phase 1:   $92,000/year (-4%)
After Phase 2:   $80,000/year (-17%)
After Phase 3:   $44,000/year (-54%)

3-year savings:  ~$120,000 (cumulative from Phase 1–3)
```

---

## 🏆 Quality Assessment

| Dimension | Current | Score | Status |
|-----------|---------|-------|--------|
| API Error Handling | Retry + fallback | 9/10 | ✅ Excellent |
| Cost Awareness | Model routing + tracking | 8/10 | ✅ Very Good |
| Prompt Caching | Enabled (70% hit) | 8/10 | ✅ Very Good |
| Database Queries | Mostly efficient | 8/10 | ✅ Good |
| Error Recovery | Graceful degradation | 9/10 | ✅ Excellent |
| Request Timeouts | Missing | 5/10 | ⚠️ Needs work |
| Rate Limiting | Basic only | 6/10 | ⚠️ Needs work |
| Eval Harness | 120+ patterns | 6/10 | ⚠️ Could optimize |
| **Overall** | | **7.6/10** | ⚠️ Good with clear improvements |

---

## 📁 Audit Scope (Files Reviewed)

### Core AI/Conversation Engine
- ✅ `src/alice/engine.js` — Main response generation (30 API call paths)
- ✅ `src/alice/prompts.js` — System prompts (800 lines, token analysis)
- ✅ `src/alice/levelDetector.js` — Answer depth classification (local heuristics)
- ✅ `src/alice/vocabularyExtractor.js` — Vocabulary tracking (no API calls)
- ✅ `src/alice/crossBookMemory.js` — Cross-session context (2 DB queries)

### Cost & Model Management
- ✅ `src/services/modelRouter.js` — Model selection logic, CostTracker class
- ✅ `src/services/evalHarness.js` — Response quality evaluation (pattern-based)
- ✅ `src/services/contextRetriever.js` — Student context retrieval (designed, not integrated)

### Session & API Routes
- ✅ `src/routes/sessions.js` — Session lifecycle, API endpoints
- ✅ `src/routes/vocabulary.js` — Vocabulary endpoints
- ✅ `package.json` — Dependencies

**Total files analyzed:** 11 core files + 3 supporting files
**Total lines of code reviewed:** ~4,500 lines
**Focus areas:** Claude API costs, token usage, regeneration patterns, caching, database queries

---

## 🚀 Quick Start for Implementation Teams

### Choose your path:

**Path A: Cost-Conscious (Want quick savings, limited time)**
→ Focus on **Phase 1 only** (Week 1–2)
- Reduce regen rate
- Pre-compute prompts
- Cache eval results
- **Expected ROI:** 4% cost reduction in 1–2 weeks, $4K/year at scale

**Path B: Balanced (Want good ROI with reasonable effort)**
→ Execute **Phase 1 + Phase 2** (Week 1–6)
- All quick wins
- Integrate ContextRetriever
- Refine model selection
- **Expected ROI:** 17% cost reduction in 6 weeks, $16K/year at scale

**Path C: Maximum Impact (Want to transform cost structure)**
→ Execute **All phases** (Week 1–12)
- All optimizations
- Fine-tuning pipeline
- Hybrid routing
- **Expected ROI:** 54% cost reduction in 12 weeks, $52K/year at scale

---

## 📊 Implementation Effort

| Phase | Duration | Engineering Hours | Complexity | Risk |
|-------|----------|---|---|---|
| Phase 1 | 1–2 weeks | 8–12 | Low | Very Low |
| Phase 2 | 3–4 weeks | 16–24 | Medium | Low |
| Phase 3 | 5–6 weeks | 36–48 | High | Medium |
| **Total** | **8–12 weeks** | **60–84** | **Graduated** | **Manageable** |

---

## 💰 Cost Justification

**Question:** Is 60–84 engineering hours worth the savings?

**Answer:** YES, absolutely, for any deployment with 1K+ students.

```
Cost Calculation (10K students):
  Engineering cost:    84 hours × $150/hr = $12,600
  Annual savings:      $52,000 (Phase 1–3)

  Payback period:      9.2 weeks
  Year 1 ROI:          312% ($39,400 net benefit)
  3-year ROI:          1,238% ($147,600 cumulative savings)
```

Even if deployment is only 5K students:
```
  Annual savings:      $26,000
  Payback period:      18.4 weeks
  Year 1 ROI:          106% ($13,400 net benefit)
  3-year ROI:          519% ($65,400 cumulative savings)
```

**Recommendation:** Execute immediately for any production deployment with 1K+ students.

---

## 🔐 Safety & Risk Management

### Phase 1–2: Low Risk
- Changes are isolated to specific functions
- Rollback is trivial (revert code, redeploy)
- Telemetry can be added without changing APIs
- **Recommendation:** Deploy with standard CI/CD, monitor 48 hours

### Phase 3: Medium Risk
- Fine-tuned models have different failure modes than Claude
- Quality variations are possible on edge cases
- Infrastructure complexity (GPU management)
- **Recommendation:** Canary rollout (5% → 10% → 25% → 100% over 4 weeks)

All risk mitigation strategies documented in `OPTIMIZATION_IMPLEMENTATION_GUIDE.md`.

---

## 📞 Getting Help

### For Questions About:

**Cost Model & Numbers**
→ Refer to `COST_MODEL_SUMMARY.md`

**Technical Details & Code**
→ Refer to `COST_AUDIT_AND_OPTIMIZATION_ROADMAP.md`

**Implementation Steps**
→ Refer to `OPTIMIZATION_IMPLEMENTATION_GUIDE.md`

**Specific Code Changes**
→ Code snippets provided in implementation guide

---

## 📈 Success Metrics to Track

Once implementation begins, monitor these weekly:

```javascript
{
  "Cost per Session": "$0.20 → target $0.10",
  "API Calls per Session": "6 → target 4",
  "Average Tokens per Session": "6,550 → target 4,500",
  "Regen Rate": "10% → target 2%",
  "Eval Cache Hit Rate": "0% → target 20%+",
  "Prompt Cache Hit Rate": "70% → target 85%",
  "Session Completion Rate": "91% → maintain or improve",
  "Student Satisfaction": "Maintain or improve",
}
```

---

## 🎓 Learning Resources

For team members implementing fine-tuning (Phase 3):

- HuggingFace Fine-tuning Guide: https://huggingface.co/docs/transformers/training
- LoRA Paper: https://arxiv.org/abs/2106.09685
- Modal.com Serverless GPU: https://modal.com/
- Mistral 7B Documentation: https://docs.mistral.ai/

---

## 📝 Document Maintenance

**These documents should be reviewed and updated:**
- **Monthly** during implementation (Phase 1–3)
- **Quarterly** after implementation for continued optimization
- **On model updates** when Anthropic releases new versions
- **On scale changes** when student count grows significantly

Next recommended review: **June 14, 2026** (post Phase 1–2)

---

## 🏁 Conclusion

The HiAlice backend is **well-engineered with clear optimization potential**. By executing the three-phase roadmap, you can:

1. ✅ Reduce costs by **54%** ($52K/year at scale)
2. ✅ Improve latency through smarter caching
3. ✅ Maintain or improve quality with better eval thresholds
4. ✅ Build foundational ML infrastructure (fine-tuning)
5. ✅ Create a sustainable, scalable architecture

**Recommendation: Start Phase 1 immediately. This week if possible.**

---

**Audit completed by:** Backend Engineering & AI Cost Optimization Team
**Date:** March 14, 2026
**Status:** Ready for implementation
**Questions?** Contact the engineering lead or refer to the detailed documents above.
