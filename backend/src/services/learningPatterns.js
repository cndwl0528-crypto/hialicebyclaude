/**
 * learningPatterns.js
 * HiAlice — Student Learning Pattern Detection Service
 *
 * Adapted from the ECC "Continuous Learning v2" instinct-based architecture.
 * Instead of detecting Claude Code usage patterns, this module detects
 * STUDENT learning patterns across reading-review sessions.
 *
 * Architecture overview:
 *   - StudentInstinct: a single learned pattern about a specific student
 *   - Pattern analyzers: four domain-specific functions that run synchronously
 *     on raw dialogue/session data and return candidate instincts
 *   - StudentPatternAnalyzer: per-student class that owns instinct lifecycle
 *     (load, merge, update confidence, decay, prune)
 *   - patternStore: module-level Map that acts as the in-memory store
 *   - onSessionComplete: main entry-point hook called from sessions.js
 *
 * Storage:
 *   In-memory Map for now; Supabase persistence marked with TODO comments.
 *   The Map key is studentId → StudentInstinct[].
 *
 * ES Modules — aligned with the rest of the HiAlice backend (package type "module").
 *
 * Usage (from sessions.js POST /:id/complete):
 *   import { onSessionComplete } from '../services/learningPatterns.js';
 *   await onSessionComplete(sessionId, studentId, sessionData);
 */

import { classifyAnswerDepth } from '../alice/levelDetector.js';
import logger from '../lib/logger.js';

// ============================================================================
// CONFIDENCE CONSTANTS
// ============================================================================

/**
 * Confidence scoring rules for the StudentInstinct lifecycle.
 *
 * Each instinct starts TENTATIVE and strengthens or weakens based on
 * subsequent observations. Natural decay prevents stale instincts from
 * accumulating indefinitely.
 */
export const CONFIDENCE = {
  /** New instinct — tentative, needs more evidence */
  INITIAL: 0.3,
  /** Each confirming observation adds this */
  CONFIRM_BOOST: 0.1,
  /** Each contradicting observation subtracts this */
  CONTRADICT_PENALTY: 0.15,
  /** Each session with no relevant observation subtracts this */
  DECAY_RATE: 0.02,
  /** Instinct is pruned when confidence falls below this */
  MIN_THRESHOLD: 0.1,
  /** Instinct is "active" (returned by getActiveInstincts) at or above this */
  ACTIVE_THRESHOLD: 0.5,
  /** High-confidence instinct — used in student profile synthesis */
  HIGH_CONFIDENCE: 0.7,
  /** Hard cap on confidence regardless of confirmations */
  MAX: 0.9,
};

// ============================================================================
// IN-MEMORY STORE
// ============================================================================

/**
 * Singleton in-memory store for all student instincts across requests.
 * Key  : studentId (string)
 * Value: StudentInstinct[] — all instincts for that student
 *
 * TODO(db): Replace with a Supabase `student_instincts` table.
 *   Schema suggestion:
 *     id          uuid primary key default gen_random_uuid()
 *     student_id  uuid references students(id) on delete cascade
 *     trigger     text not null
 *     action      text not null
 *     confidence  numeric(3,2) not null default 0.3
 *     domain      text not null  -- vocabulary|depth|engagement|style|difficulty
 *     evidence    text[] default '{}'
 *     created_at  timestamptz default now()
 *     updated_at  timestamptz default now()
 *
 * @type {Map<string, import('./learningPatterns.js').StudentInstinct[]>}
 */
export const patternStore = new Map();

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Generate a deterministic-ish short ID for a new instinct.
 * Format: domain-hash where hash is derived from trigger text.
 *
 * @param {string} domain
 * @param {string} trigger
 * @returns {string}
 * @private
 */
function _generateInstinctId(domain, trigger) {
  // Simple djb2-style hash — no crypto needed for internal IDs
  let hash = 5381;
  for (let i = 0; i < trigger.length; i++) {
    hash = ((hash << 5) + hash) ^ trigger.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return `${domain}-${hash.toString(16).padStart(8, '0')}`;
}

/**
 * Clamp a confidence value to [MIN_THRESHOLD, MAX].
 * @param {number} value
 * @returns {number}
 * @private
 */
function _clampConfidence(value) {
  return Math.min(CONFIDENCE.MAX, Math.max(CONFIDENCE.MIN_THRESHOLD, value));
}

/**
 * Round a confidence value to 2 decimal places for clean storage.
 * @param {number} value
 * @returns {number}
 * @private
 */
function _roundConf(value) {
  return Math.round(value * 100) / 100;
}

// ============================================================================
// VOCABULARY PATTERN ANALYZER
// ============================================================================

/**
 * Common "safe" filler words that children over-rely on.
 * Detecting these enables instincts that nudge toward synonym variety.
 *
 * Each entry: { word, synonyms, threshold }
 *   threshold — if the word appears >= threshold times in combined dialogue text,
 *               the instinct is generated.
 */
const OVERUSED_WORD_CANDIDATES = [
  { word: 'good',      synonyms: ['wonderful', 'fantastic', 'amazing', 'excellent'], threshold: 3 },
  { word: 'bad',       synonyms: ['terrible', 'awful', 'dreadful', 'unfortunate'], threshold: 3 },
  { word: 'nice',      synonyms: ['lovely', 'charming', 'pleasant', 'delightful'], threshold: 3 },
  { word: 'funny',     synonyms: ['hilarious', 'amusing', 'comical', 'witty'], threshold: 2 },
  { word: 'sad',       synonyms: ['heartbroken', 'sorrowful', 'gloomy', 'melancholy'], threshold: 2 },
  { word: 'scary',     synonyms: ['terrifying', 'spine-chilling', 'sinister', 'eerie'], threshold: 2 },
  { word: 'happy',     synonyms: ['overjoyed', 'elated', 'thrilled', 'delighted'], threshold: 3 },
  { word: 'like',      synonyms: ['appreciate', 'enjoy', 'admire', 'value'], threshold: 4 },
  { word: 'exciting',  synonyms: ['thrilling', 'riveting', 'exhilarating', 'captivating'], threshold: 3 },
  { word: 'big',       synonyms: ['enormous', 'massive', 'colossal', 'immense'], threshold: 3 },
  { word: 'got',       synonyms: ['received', 'obtained', 'acquired', 'discovered'], threshold: 3 },
  { word: 'said',      synonyms: ['exclaimed', 'whispered', 'announced', 'declared'], threshold: 3 },
  { word: 'went',      synonyms: ['traveled', 'journeyed', 'ventured', 'proceeded'], threshold: 3 },
  { word: 'interesting', synonyms: ['fascinating', 'captivating', 'compelling', 'intriguing'], threshold: 3 },
];

/**
 * Korean L1 transfer error patterns (common for Korean EFL learners aged 6-13).
 * These patterns reflect typical Korean-to-English interference errors.
 */
const KOREAN_TRANSFER_PATTERNS = [
  {
    pattern: /\b(I am|he is|she is|it is)\s+(more\s+)?(adjective|good|bad|happy|sad|excited)\b/i,
    description: 'copula overuse (Korean does not require copula in all contexts)',
    trigger: 'Korean transfer — copula pattern detected',
    action: 'Gently model natural adjective placement without over-correcting',
  },
  {
    pattern: /\b(the|a)\s+\w+\s+(it)\b/i,
    description: 'topic-comment structure (Korean SOV to SVO transfer)',
    trigger: 'Korean transfer — topic-comment structure',
    action: 'Use clarifying rephrasing to model SVO order naturally',
  },
  {
    pattern: /\b(\w+)\s+(is|are)\s+very\s+much\b/i,
    description: 'adverb placement from Korean',
    trigger: 'Korean transfer — "very much" misplacement',
    action: 'Model natural English adverb positioning in follow-up',
  },
];

/**
 * Analyzes dialogue text for vocabulary usage patterns and returns candidate instincts.
 *
 * Detects:
 *   - Preferred overused words (suggest synonym expansion)
 *   - Vocabulary growth rate (new unique content words per session)
 *   - Avoidance of certain word types (missing adverbs, adjectives)
 *   - Korean language transfer patterns (for Korean student population)
 *
 * @param {string} studentId - Student identifier
 * @param {Array<{content: string, speaker: string, session_id?: string}>} recentDialogues
 *   Recent dialogue rows for this student (student turns only, or all — filtered internally)
 * @returns {import('./learningPatterns.js').StudentInstinct[]} Candidate instincts
 */
export function analyzeVocabularyPatterns(studentId, recentDialogues) {
  if (!Array.isArray(recentDialogues) || recentDialogues.length === 0) return [];

  const instincts = [];

  // Filter to student turns only
  const studentTurns = recentDialogues.filter(
    (d) => d.speaker === 'student' || d.speaker === 'user'
  );

  if (studentTurns.length === 0) return [];

  const combinedText = studentTurns.map((d) => d.content || '').join(' ').toLowerCase();
  const allWords = (combinedText.match(/\b[a-z]+(?:'[a-z]+)?\b/g) || []);

  // -------------------------------------------------------------------------
  // A. Overused word detection
  // -------------------------------------------------------------------------
  for (const candidate of OVERUSED_WORD_CANDIDATES) {
    const regex = new RegExp(`\\b${candidate.word}\\b`, 'gi');
    const occurrences = (combinedText.match(regex) || []).length;

    if (occurrences >= candidate.threshold) {
      instincts.push({
        id: _generateInstinctId('vocabulary', `overuse-${candidate.word}-${studentId}`),
        studentId,
        trigger: `student uses "${candidate.word}" frequently (${occurrences}x detected)`,
        action: `Suggest richer alternatives: ${candidate.synonyms.join(', ')}`,
        confidence: _roundConf(
          // Scale confidence with occurrence count but cap contribution early
          CONFIDENCE.INITIAL + Math.min((occurrences - candidate.threshold) * 0.05, 0.3)
        ),
        domain: 'vocabulary',
        evidence: studentTurns
          .filter((d) => (d.content || '').toLowerCase().includes(candidate.word))
          .map((d) => d.session_id || 'unknown')
          .filter((v, i, a) => a.indexOf(v) === i), // deduplicate
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // -------------------------------------------------------------------------
  // B. Vocabulary growth rate — unique content words per recent session cluster
  // -------------------------------------------------------------------------
  // Group by session_id to compute growth across sessions
  const sessionGroups = {};
  for (const d of studentTurns) {
    const sid = d.session_id || 'default';
    if (!sessionGroups[sid]) sessionGroups[sid] = [];
    sessionGroups[sid].push(d.content || '');
  }

  const sessionIds = Object.keys(sessionGroups);
  if (sessionIds.length >= 2) {
    const STOP_WORDS_SET = new Set([
      'a','an','and','are','as','at','be','by','for','from','has','he','in','is',
      'it','its','of','on','or','she','that','the','to','was','will','with','you',
      'your','this','these','those','have','had','do','does','did','can','could',
      'would','should','i','me','my','we','they','them','but','so','if','not',
      'what','when','where','who','how','why','up','about','just','like','also',
    ]);

    const uniqueWordsBySession = sessionIds.map((sid) => {
      const text = sessionGroups[sid].join(' ').toLowerCase();
      const words = (text.match(/\b[a-z]{3,}\b/g) || []).filter((w) => !STOP_WORDS_SET.has(w));
      return new Set(words).size;
    });

    const avgGrowth = uniqueWordsBySession.reduce((a, b) => a + b, 0) / uniqueWordsBySession.length;

    if (avgGrowth < 8) {
      instincts.push({
        id: _generateInstinctId('vocabulary', `low-growth-${studentId}`),
        studentId,
        trigger: 'vocabulary growth rate is low (few new content words per session)',
        action: 'Introduce 2-3 new words organically per session; echo them back in Alice questions',
        confidence: CONFIDENCE.INITIAL,
        domain: 'vocabulary',
        evidence: sessionIds,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else if (avgGrowth >= 20) {
      instincts.push({
        id: _generateInstinctId('vocabulary', `high-growth-${studentId}`),
        studentId,
        trigger: 'vocabulary growth rate is high (many new content words per session)',
        action: 'Challenge with advanced synonyms and ask student to define words in their own words',
        confidence: CONFIDENCE.INITIAL,
        domain: 'vocabulary',
        evidence: sessionIds,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // -------------------------------------------------------------------------
  // C. Adjective avoidance — student rarely uses descriptive language
  // -------------------------------------------------------------------------
  const adjectivePattern = /\b(beautiful|ugly|clever|brave|curious|amazing|wonderful|terrible|delightful|mysterious|gentle|fierce|tiny|enormous|ancient|modern|bright|dark|silent|noisy)\b/gi;
  const adjectiveCount = (combinedText.match(adjectivePattern) || []).length;
  const wordCount = allWords.length;

  if (wordCount > 30 && adjectiveCount / wordCount < 0.03) {
    instincts.push({
      id: _generateInstinctId('vocabulary', `adjective-avoidance-${studentId}`),
      studentId,
      trigger: 'student rarely uses descriptive adjectives',
      action: 'Prompt with "Can you describe how that looked or felt?" to surface adjective use',
      confidence: CONFIDENCE.INITIAL,
      domain: 'vocabulary',
      evidence: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // -------------------------------------------------------------------------
  // D. Korean language transfer detection
  // -------------------------------------------------------------------------
  for (const transferPattern of KOREAN_TRANSFER_PATTERNS) {
    if (transferPattern.pattern.test(combinedText)) {
      instincts.push({
        id: _generateInstinctId('vocabulary', `korean-transfer-${transferPattern.trigger}-${studentId}`),
        studentId,
        trigger: transferPattern.trigger,
        action: transferPattern.action,
        confidence: CONFIDENCE.INITIAL,
        domain: 'vocabulary',
        evidence: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return instincts;
}

// ============================================================================
// DEPTH PATTERN ANALYZER
// ============================================================================

/**
 * Stage-level depth expectations.
 * If a student consistently scores BELOW expectedMin in a stage, they
 * have a weakness there. If they consistently score ABOVE expectedMax, they excel.
 */
const STAGE_DEPTH_EXPECTATIONS = {
  warm_connection: { expectedMin: 10, expectedMax: 40, label: 'warm-up stage' },
  title:           { expectedMin: 15, expectedMax: 50, label: 'title exploration stage' },
  introduction:    { expectedMin: 20, expectedMax: 55, label: 'introduction stage' },
  body:            { expectedMin: 35, expectedMax: 80, label: 'body/main-argument stage' },
  conclusion:      { expectedMin: 25, expectedMax: 65, label: 'conclusion stage' },
  cross_book:      { expectedMin: 40, expectedMax: 90, label: 'cross-book comparison stage' },
};

/**
 * Analyzes depth history across sessions to detect depth-level patterns.
 *
 * Detects:
 *   - Consistent depth level (student always stays surface/analytical)
 *   - Stage-specific depth variation (deep in body, shallow in conclusion)
 *   - Improvement trends (growing over time) or plateaus
 *
 * @param {string} studentId - Student identifier
 * @param {Array<{
 *   sessionId: string,
 *   stage: string,
 *   depthScore: number,
 *   depthLabel: string,
 *   bookTitle?: string,
 *   genre?: string
 * }>} depthHistory - Depth analysis records across multiple sessions
 * @returns {import('./learningPatterns.js').StudentInstinct[]} Candidate instincts
 */
export function analyzeDepthPatterns(studentId, depthHistory) {
  if (!Array.isArray(depthHistory) || depthHistory.length === 0) return [];

  const instincts = [];

  // -------------------------------------------------------------------------
  // A. Overall depth tendency
  // -------------------------------------------------------------------------
  const scores = depthHistory.map((h) => h.depthScore || 0);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  if (avgScore < 15 && depthHistory.length >= 3) {
    instincts.push({
      id: _generateInstinctId('depth', `consistently-surface-${studentId}`),
      studentId,
      trigger: 'student consistently gives surface-level responses across sessions',
      action: 'Use scaffolding prompts: "Tell me more — why do you think that?" before advancing',
      confidence: _roundConf(CONFIDENCE.INITIAL + 0.1),
      domain: 'depth',
      evidence: depthHistory.map((h) => h.sessionId).filter(Boolean),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else if (avgScore >= 55 && depthHistory.length >= 3) {
    instincts.push({
      id: _generateInstinctId('depth', `consistently-deep-${studentId}`),
      studentId,
      trigger: 'student consistently gives analytical or deep responses',
      action: 'Expect analytical depth; use challenging follow-ups like "What evidence supports that?"',
      confidence: _roundConf(CONFIDENCE.INITIAL + 0.2),
      domain: 'depth',
      evidence: depthHistory.map((h) => h.sessionId).filter(Boolean),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // -------------------------------------------------------------------------
  // B. Stage-specific depth weaknesses and strengths
  // -------------------------------------------------------------------------
  const byStage = {};
  for (const record of depthHistory) {
    const stage = record.stage;
    if (!stage) continue;
    if (!byStage[stage]) byStage[stage] = [];
    byStage[stage].push(record.depthScore || 0);
  }

  for (const [stage, stageScores] of Object.entries(byStage)) {
    if (stageScores.length < 2) continue; // need at least 2 data points

    const stageAvg = stageScores.reduce((a, b) => a + b, 0) / stageScores.length;
    const expectation = STAGE_DEPTH_EXPECTATIONS[stage];
    if (!expectation) continue;

    if (stageAvg < expectation.expectedMin) {
      instincts.push({
        id: _generateInstinctId('depth', `weak-at-${stage}-${studentId}`),
        studentId,
        trigger: `${stage} stage consistently produces shallow responses (avg score: ${Math.round(stageAvg)})`,
        action: `For ${expectation.label}: offer a structured prompt before asking the main question`,
        confidence: _roundConf(CONFIDENCE.INITIAL + (stageScores.length - 2) * 0.05),
        domain: 'depth',
        evidence: depthHistory.filter((h) => h.stage === stage).map((h) => h.sessionId).filter(Boolean),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else if (stageAvg > expectation.expectedMax && stage === 'body') {
      // Body stage over-performance is notable — student may be ready to advance
      instincts.push({
        id: _generateInstinctId('depth', `excels-at-body-${studentId}`),
        studentId,
        trigger: 'body stage responses are consistently deep and analytical',
        action: 'Advance body stage faster; use challenging cross-text connections',
        confidence: _roundConf(CONFIDENCE.INITIAL + 0.15),
        domain: 'depth',
        evidence: depthHistory.filter((h) => h.stage === stage).map((h) => h.sessionId).filter(Boolean),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // -------------------------------------------------------------------------
  // C. Improvement trend detection (linear regression on session order)
  // -------------------------------------------------------------------------
  if (scores.length >= 4) {
    const n = scores.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = scores.reduce((a, b) => a + b, 0);
    const sumXY = scores.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = scores.reduce((sum, _, x) => sum + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    if (slope > 2.5) {
      // Meaningful positive trend
      instincts.push({
        id: _generateInstinctId('depth', `improving-trend-${studentId}`),
        studentId,
        trigger: 'depth scores show a consistent upward trend across sessions',
        action: 'Gradually increase question complexity to match growth trajectory',
        confidence: _roundConf(CONFIDENCE.INITIAL + 0.15),
        domain: 'depth',
        evidence: depthHistory.map((h) => h.sessionId).filter(Boolean),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else if (slope < -2.5) {
      // Meaningful negative trend (possible fatigue or disengagement)
      instincts.push({
        id: _generateInstinctId('depth', `declining-trend-${studentId}`),
        studentId,
        trigger: 'depth scores show a consistent downward trend — possible fatigue or disengagement',
        action: 'Re-energize with a topic the student enjoys; reduce session length temporarily',
        confidence: _roundConf(CONFIDENCE.INITIAL + 0.1),
        domain: 'depth',
        evidence: depthHistory.map((h) => h.sessionId).filter(Boolean),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // -------------------------------------------------------------------------
  // D. Body vs Conclusion depth gap
  // -------------------------------------------------------------------------
  const bodyScores = (byStage['body'] || []);
  const conclusionScores = (byStage['conclusion'] || []);

  if (bodyScores.length >= 2 && conclusionScores.length >= 2) {
    const bodyAvg = bodyScores.reduce((a, b) => a + b, 0) / bodyScores.length;
    const concAvg = conclusionScores.reduce((a, b) => a + b, 0) / conclusionScores.length;

    if (bodyAvg - concAvg > 20) {
      instincts.push({
        id: _generateInstinctId('depth', `body-to-conclusion-drop-${studentId}`),
        studentId,
        trigger: 'depth drops significantly from body stage to conclusion stage',
        action: 'Wrap up body sooner; use a guided summary prompt to ease into the conclusion',
        confidence: _roundConf(CONFIDENCE.INITIAL + 0.1),
        domain: 'depth',
        evidence: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return instincts;
}

// ============================================================================
// ENGAGEMENT PATTERN ANALYZER
// ============================================================================

/**
 * Topics that tend to spark high engagement in children's books (by keyword).
 * Used to detect which themes produce the longest and deepest responses.
 */
const HIGH_ENGAGEMENT_TOPICS = [
  { keywords: ['animal', 'dog', 'cat', 'dragon', 'horse', 'lion', 'wolf', 'bird', 'rabbit'], topic: 'animals' },
  { keywords: ['adventure', 'quest', 'journey', 'explore', 'discover', 'treasure', 'mission'], topic: 'adventure' },
  { keywords: ['friend', 'friendship', 'together', 'team', 'help', 'trust', 'loyal'], topic: 'friendship' },
  { keywords: ['magic', 'wizard', 'witch', 'spell', 'enchant', 'fantasy', 'powers'], topic: 'magic/fantasy' },
  { keywords: ['scary', 'ghost', 'monster', 'spooky', 'haunted', 'mystery', 'detective'], topic: 'mystery/horror' },
  { keywords: ['family', 'parent', 'brother', 'sister', 'grandma', 'home'], topic: 'family' },
  { keywords: ['school', 'teacher', 'class', 'bully', 'study', 'grades'], topic: 'school life' },
  { keywords: ['funny', 'laugh', 'joke', 'silly', 'hilarious', 'humor'], topic: 'humor' },
];

/**
 * Analyzes session history to detect engagement patterns.
 *
 * Detects:
 *   - Average session duration preference (longer = prefers extended sessions)
 *   - Drop-off stages (consistently low engagement at a specific stage)
 *   - High-engagement topics (books/themes where student writes most)
 *   - Preferred input mode (voice vs text — if available in sessionData)
 *
 * @param {string} studentId - Student identifier
 * @param {Array<{
 *   sessionId: string,
 *   bookTitle?: string,
 *   genre?: string,
 *   totalTurns: number,
 *   completedStages: string[],
 *   engagementByStage: Record<string, 'high'|'medium'|'low'|'disengaged'>,
 *   inputMode?: 'voice'|'text',
 *   durationMinutes?: number
 * }>} sessionHistory - Session-level engagement summaries
 * @returns {import('./learningPatterns.js').StudentInstinct[]} Candidate instincts
 */
export function analyzeEngagementPatterns(studentId, sessionHistory) {
  if (!Array.isArray(sessionHistory) || sessionHistory.length === 0) return [];

  const instincts = [];

  // -------------------------------------------------------------------------
  // A. Drop-off stage detection
  // -------------------------------------------------------------------------
  // Count how many sessions have 'low' or 'disengaged' at each stage
  const stageDisengagementCount = {};
  let totalSessionsWithStageData = 0;

  for (const session of sessionHistory) {
    const byStage = session.engagementByStage || {};
    if (Object.keys(byStage).length === 0) continue;
    totalSessionsWithStageData++;

    for (const [stage, level] of Object.entries(byStage)) {
      if (!stageDisengagementCount[stage]) stageDisengagementCount[stage] = 0;
      if (level === 'low' || level === 'disengaged') {
        stageDisengagementCount[stage]++;
      }
    }
  }

  if (totalSessionsWithStageData >= 2) {
    for (const [stage, count] of Object.entries(stageDisengagementCount)) {
      const ratio = count / totalSessionsWithStageData;
      if (ratio >= 0.6) {
        instincts.push({
          id: _generateInstinctId('engagement', `dropoff-${stage}-${studentId}`),
          studentId,
          trigger: `student consistently loses engagement at the ${stage} stage`,
          action: `Shorten ${stage} to 2 turns maximum; add extra praise; consider choice-based questions`,
          confidence: _roundConf(CONFIDENCE.INITIAL + (ratio - 0.6) * 0.5 + 0.1),
          domain: 'engagement',
          evidence: sessionHistory.map((s) => s.sessionId).filter(Boolean),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // B. High-engagement topic detection
  // -------------------------------------------------------------------------
  const topicEngagement = {}; // topic -> array of totalTurns for sessions featuring that topic

  for (const session of sessionHistory) {
    const titleAndGenre = `${session.bookTitle || ''} ${session.genre || ''}`.toLowerCase();
    for (const topicDef of HIGH_ENGAGEMENT_TOPICS) {
      const matched = topicDef.keywords.some((kw) => titleAndGenre.includes(kw));
      if (matched) {
        if (!topicEngagement[topicDef.topic]) topicEngagement[topicDef.topic] = [];
        topicEngagement[topicDef.topic].push(session.totalTurns || 0);
      }
    }
  }

  // Find topics where average turn count is notably higher than the overall average
  const overallAvgTurns = sessionHistory.length > 0
    ? sessionHistory.reduce((a, s) => a + (s.totalTurns || 0), 0) / sessionHistory.length
    : 0;

  for (const [topic, turnCounts] of Object.entries(topicEngagement)) {
    if (turnCounts.length < 2) continue;
    const topicAvg = turnCounts.reduce((a, b) => a + b, 0) / turnCounts.length;
    if (topicAvg > overallAvgTurns * 1.25) {
      instincts.push({
        id: _generateInstinctId('engagement', `high-topic-${topic}-${studentId}`),
        studentId,
        trigger: `student shows higher engagement with ${topic}-themed books`,
        action: `Recommend ${topic} books; use ${topic} examples in analogies and questions`,
        confidence: _roundConf(CONFIDENCE.INITIAL + Math.min(turnCounts.length * 0.05, 0.3)),
        domain: 'engagement',
        evidence: sessionHistory.map((s) => s.sessionId).filter(Boolean),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // -------------------------------------------------------------------------
  // C. Session duration preference
  // -------------------------------------------------------------------------
  const durationsMinutes = sessionHistory
    .map((s) => s.durationMinutes)
    .filter((d) => typeof d === 'number' && d > 0);

  if (durationsMinutes.length >= 3) {
    const avgDuration = durationsMinutes.reduce((a, b) => a + b, 0) / durationsMinutes.length;

    if (avgDuration <= 8) {
      instincts.push({
        id: _generateInstinctId('engagement', `short-session-preference-${studentId}`),
        studentId,
        trigger: `average session duration is short (${Math.round(avgDuration)} min) — student prefers brief sessions`,
        action: 'Keep sessions under 10 minutes; prioritize high-value body stage; trim warm-up',
        confidence: _roundConf(CONFIDENCE.INITIAL + 0.1),
        domain: 'engagement',
        evidence: sessionHistory.map((s) => s.sessionId).filter(Boolean),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else if (avgDuration >= 20) {
      instincts.push({
        id: _generateInstinctId('engagement', `long-session-preference-${studentId}`),
        studentId,
        trigger: `average session duration is long (${Math.round(avgDuration)} min) — student enjoys extended conversation`,
        action: 'Allow more turns in body and conclusion; encourage elaboration with "tell me more"',
        confidence: _roundConf(CONFIDENCE.INITIAL + 0.1),
        domain: 'engagement',
        evidence: sessionHistory.map((s) => s.sessionId).filter(Boolean),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // -------------------------------------------------------------------------
  // D. Input mode preference (voice vs text)
  // -------------------------------------------------------------------------
  const voiceSessions = sessionHistory.filter((s) => s.inputMode === 'voice').length;
  const textSessions = sessionHistory.filter((s) => s.inputMode === 'text').length;
  const totalWithMode = voiceSessions + textSessions;

  if (totalWithMode >= 3) {
    if (voiceSessions / totalWithMode >= 0.75) {
      instincts.push({
        id: _generateInstinctId('engagement', `voice-preference-${studentId}`),
        studentId,
        trigger: 'student strongly prefers voice input mode',
        action: 'Ensure voice UI is always offered first; avoid text-only fallback unless necessary',
        confidence: _roundConf(CONFIDENCE.INITIAL + 0.15),
        domain: 'engagement',
        evidence: sessionHistory.map((s) => s.sessionId).filter(Boolean),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else if (textSessions / totalWithMode >= 0.75) {
      instincts.push({
        id: _generateInstinctId('engagement', `text-preference-${studentId}`),
        studentId,
        trigger: 'student strongly prefers text input mode',
        action: 'Default to text UI; voice button can remain secondary',
        confidence: _roundConf(CONFIDENCE.INITIAL + 0.15),
        domain: 'engagement',
        evidence: sessionHistory.map((s) => s.sessionId).filter(Boolean),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return instincts;
}

// ============================================================================
// DIFFICULTY PATTERN ANALYZER
// ============================================================================

/**
 * Analyzes session history to detect difficulty/level calibration patterns.
 *
 * Detects:
 *   - Current level appropriateness (is 'beginner' still the right assignment?)
 *   - Questions that consistently stump the student (by stage/type)
 *   - Topics where the student excels beyond their assigned level
 *
 * @param {string} studentId - Student identifier
 * @param {Array<{
 *   sessionId: string,
 *   level: string,
 *   overallScore: number,
 *   stageScores: Record<string, number>,
 *   suggestedLevel?: string,
 *   levelConfidence?: number,
 *   stumppedStages?: string[],
 *   excelStages?: string[]
 * }>} sessionHistory - Session summaries with level analysis data
 * @returns {import('./learningPatterns.js').StudentInstinct[]} Candidate instincts
 */
export function analyzeDifficultyPatterns(studentId, sessionHistory) {
  if (!Array.isArray(sessionHistory) || sessionHistory.length === 0) return [];

  const instincts = [];

  // -------------------------------------------------------------------------
  // A. Level appropriateness — aggregate suggested levels
  // -------------------------------------------------------------------------
  const suggestedLevels = sessionHistory
    .map((s) => s.suggestedLevel)
    .filter(Boolean);

  if (suggestedLevels.length >= 3) {
    const levelCounts = { beginner: 0, intermediate: 0, advanced: 0 };
    for (const level of suggestedLevels) {
      if (levelCounts[level] !== undefined) levelCounts[level]++;
    }

    const dominantLevel = Object.entries(levelCounts).sort(([, a], [, b]) => b - a)[0][0];
    const currentLevel = sessionHistory[sessionHistory.length - 1]?.level;

    if (dominantLevel !== currentLevel) {
      const isUpgrade = (
        (dominantLevel === 'intermediate' && currentLevel === 'beginner') ||
        (dominantLevel === 'advanced' && currentLevel !== 'advanced')
      );
      const isDowngrade = (
        (dominantLevel === 'beginner' && currentLevel !== 'beginner') ||
        (dominantLevel === 'intermediate' && currentLevel === 'advanced')
      );

      if (isUpgrade) {
        instincts.push({
          id: _generateInstinctId('difficulty', `level-upgrade-recommended-${studentId}`),
          studentId,
          trigger: `current level "${currentLevel}" may be too easy — student consistently performs at ${dominantLevel} level`,
          action: `Consider upgrading level to "${dominantLevel}"; run a test session at higher difficulty`,
          confidence: _roundConf(CONFIDENCE.INITIAL + 0.2),
          domain: 'difficulty',
          evidence: sessionHistory.map((s) => s.sessionId).filter(Boolean),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else if (isDowngrade) {
        instincts.push({
          id: _generateInstinctId('difficulty', `level-downgrade-recommended-${studentId}`),
          studentId,
          trigger: `current level "${currentLevel}" may be too hard — student consistently performs at ${dominantLevel} level`,
          action: `Consider temporarily stepping down to "${dominantLevel}"; rebuild confidence with accessible books`,
          confidence: _roundConf(CONFIDENCE.INITIAL + 0.2),
          domain: 'difficulty',
          evidence: sessionHistory.map((s) => s.sessionId).filter(Boolean),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // B. Stages that consistently stump the student
  // -------------------------------------------------------------------------
  const stumppedStageCount = {};
  let sessionsWithStumpData = 0;

  for (const session of sessionHistory) {
    if (!Array.isArray(session.stumppedStages) || session.stumppedStages.length === 0) continue;
    sessionsWithStumpData++;
    for (const stage of session.stumppedStages) {
      if (!stumppedStageCount[stage]) stumppedStageCount[stage] = 0;
      stumppedStageCount[stage]++;
    }
  }

  if (sessionsWithStumpData >= 2) {
    for (const [stage, count] of Object.entries(stumppedStageCount)) {
      if (count / sessionsWithStumpData >= 0.5) {
        const isComplexStage = stage === 'cross_book' || stage === 'body';
        instincts.push({
          id: _generateInstinctId('difficulty', `stumped-at-${stage}-${studentId}`),
          studentId,
          trigger: `student is consistently stumped at the ${stage} stage`,
          action: isComplexStage
            ? `Simplify ${stage} to comparison-only or single-reason format; skip analysis-heavy sub-questions`
            : `Provide more scaffolding before ${stage} questions; use a warm-up prompt first`,
          confidence: _roundConf(CONFIDENCE.INITIAL + (count / sessionsWithStumpData) * 0.2),
          domain: 'difficulty',
          evidence: sessionHistory
            .filter((s) => (s.stumppedStages || []).includes(stage))
            .map((s) => s.sessionId)
            .filter(Boolean),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // C. Stages where the student excels beyond their level
  // -------------------------------------------------------------------------
  const excelStageCount = {};
  let sessionsWithExcelData = 0;

  for (const session of sessionHistory) {
    if (!Array.isArray(session.excelStages) || session.excelStages.length === 0) continue;
    sessionsWithExcelData++;
    for (const stage of session.excelStages) {
      if (!excelStageCount[stage]) excelStageCount[stage] = 0;
      excelStageCount[stage]++;
    }
  }

  if (sessionsWithExcelData >= 2) {
    for (const [stage, count] of Object.entries(excelStageCount)) {
      if (count / sessionsWithExcelData >= 0.5) {
        instincts.push({
          id: _generateInstinctId('difficulty', `excels-at-${stage}-${studentId}`),
          studentId,
          trigger: `student consistently excels beyond their level at the ${stage} stage`,
          action: `Use advanced follow-up prompts at ${stage}; introduce elements from the next level`,
          confidence: _roundConf(CONFIDENCE.INITIAL + (count / sessionsWithExcelData) * 0.2),
          domain: 'difficulty',
          evidence: sessionHistory
            .filter((s) => (s.excelStages || []).includes(stage))
            .map((s) => s.sessionId)
            .filter(Boolean),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // D. Overall score trend — is difficulty calibration correct?
  // -------------------------------------------------------------------------
  const overallScores = sessionHistory.map((s) => s.overallScore || 0).filter((s) => s > 0);

  if (overallScores.length >= 3) {
    const avgScore = overallScores.reduce((a, b) => a + b, 0) / overallScores.length;

    if (avgScore > 75) {
      // Student consistently scores high — may need harder material
      instincts.push({
        id: _generateInstinctId('difficulty', `consistently-high-scores-${studentId}`),
        studentId,
        trigger: `session quality scores are consistently high (avg: ${Math.round(avgScore)}) — current difficulty may be too easy`,
        action: 'Introduce optional extension questions; offer advanced-level books as stretch reading',
        confidence: _roundConf(CONFIDENCE.INITIAL + 0.15),
        domain: 'difficulty',
        evidence: sessionHistory.map((s) => s.sessionId).filter(Boolean),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else if (avgScore < 25) {
      // Student consistently struggles
      instincts.push({
        id: _generateInstinctId('difficulty', `consistently-low-scores-${studentId}`),
        studentId,
        trigger: `session quality scores are consistently low (avg: ${Math.round(avgScore)}) — current difficulty may be too hard`,
        action: 'Reduce question complexity; offer picture-supported prompts; shorten turn counts',
        confidence: _roundConf(CONFIDENCE.INITIAL + 0.15),
        domain: 'difficulty',
        evidence: sessionHistory.map((s) => s.sessionId).filter(Boolean),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return instincts;
}

// ============================================================================
// STUDENT PATTERN ANALYZER (MAIN CLASS)
// ============================================================================

/**
 * Per-student class that owns the full instinct lifecycle:
 *   - Loading from the in-memory patternStore (with Supabase TODO)
 *   - Merging new candidate instincts with existing ones
 *   - Updating confidence on observations
 *   - Natural decay across sessions
 *   - Pruning weak instincts
 *   - Synthesizing a student profile from high-confidence instincts
 *
 * One instance is created per student per analysis cycle.
 * Long-running processes can cache instances by studentId if needed.
 *
 * @example
 * const analyzer = new StudentPatternAnalyzer('student-uuid-123');
 * await analyzer.loadInstincts();
 * const result = await analyzer.analyzeSession(sessionData);
 * const profile = analyzer.getStudentProfile();
 */
export class StudentPatternAnalyzer {
  /**
   * @param {string} studentId - UUID of the student
   */
  constructor(studentId) {
    this.studentId = studentId;
    /** @type {StudentInstinct[]} */
    this.instincts = [];
  }

  // --------------------------------------------------------------------------
  // LOAD / PERSIST
  // --------------------------------------------------------------------------

  /**
   * Load instincts from the in-memory patternStore.
   * Falls back to an empty array if no instincts exist yet.
   *
   * TODO(db): Replace with a Supabase query:
   *   const { data } = await supabase
   *     .from('student_instincts')
   *     .select('*')
   *     .eq('student_id', this.studentId)
   *     .gte('confidence', CONFIDENCE.MIN_THRESHOLD)
   *     .order('confidence', { ascending: false });
   *   this.instincts = data || [];
   *
   * @returns {Promise<void>}
   */
  async loadInstincts() {
    this.instincts = patternStore.get(this.studentId) || [];
    logger.debug({ studentId: this.studentId, count: this.instincts.length },
      '[LearningPatterns] Instincts loaded');
  }

  /**
   * Persist the current instinct list back to patternStore.
   * Called internally after every analyzeSession() or updateConfidence() call.
   *
   * TODO(db): Upsert to Supabase `student_instincts` table:
   *   await supabase.from('student_instincts').upsert(
   *     this.instincts.map(inst => ({ ...inst, student_id: inst.studentId })),
   *     { onConflict: 'id' }
   *   );
   *
   * @private
   * @returns {void}
   */
  _persistInstincts() {
    patternStore.set(this.studentId, this.instincts);
  }

  // --------------------------------------------------------------------------
  // MERGE LOGIC
  // --------------------------------------------------------------------------

  /**
   * Merge an array of candidate instincts into the existing list.
   *
   * Rules:
   *   - If an instinct with the same `id` already exists, boost its confidence
   *     by CONFIRM_BOOST and update its `updatedAt` and `evidence`.
   *   - If it is brand-new, add it at INITIAL confidence.
   *   - Returns { newInstincts, updatedInstincts }.
   *
   * @param {StudentInstinct[]} candidates
   * @returns {{ newInstincts: StudentInstinct[], updatedInstincts: StudentInstinct[] }}
   * @private
   */
  _mergeInstincts(candidates) {
    const newInstincts = [];
    const updatedInstincts = [];

    for (const candidate of candidates) {
      const existing = this.instincts.find((i) => i.id === candidate.id);

      if (existing) {
        // Confirming re-observation — boost confidence
        existing.confidence = _roundConf(
          _clampConfidence(existing.confidence + CONFIDENCE.CONFIRM_BOOST)
        );
        existing.updatedAt = new Date();
        // Merge evidence arrays (deduplicate)
        const mergedEvidence = [...new Set([...existing.evidence, ...candidate.evidence])];
        existing.evidence = mergedEvidence.slice(-20); // keep last 20 to bound size
        updatedInstincts.push(existing);
      } else {
        // New instinct
        const newInstinct = { ...candidate };
        this.instincts.push(newInstinct);
        newInstincts.push(newInstinct);
      }
    }

    return { newInstincts, updatedInstincts };
  }

  /**
   * Apply natural decay to all instincts that were NOT touched in this merge cycle.
   * Touched instincts are identified by their `updatedAt` timestamp (after the cycle starts).
   *
   * @param {Date} cycleStartTime
   * @private
   */
  _applyDecay(cycleStartTime) {
    for (const instinct of this.instincts) {
      // If updatedAt is before the cycle, the instinct was not re-observed
      if (instinct.updatedAt < cycleStartTime) {
        instinct.confidence = _roundConf(instinct.confidence - CONFIDENCE.DECAY_RATE);
        instinct.updatedAt = new Date();
      }
    }
  }

  /**
   * Remove instincts whose confidence has fallen below the minimum threshold.
   * @private
   */
  _pruneWeakInstincts() {
    const before = this.instincts.length;
    this.instincts = this.instincts.filter(
      (i) => i.confidence >= CONFIDENCE.MIN_THRESHOLD
    );
    const pruned = before - this.instincts.length;
    if (pruned > 0) {
      logger.debug({ studentId: this.studentId, pruned },
        '[LearningPatterns] Weak instincts pruned');
    }
  }

  // --------------------------------------------------------------------------
  // MAIN ANALYSIS
  // --------------------------------------------------------------------------

  /**
   * Run all pattern analyzers against fresh session data and merge results
   * into the existing instinct set.
   *
   * @param {{
   *   sessionId: string,
   *   dialogues: Array<{content: string, speaker: string, stage?: string, session_id?: string}>,
   *   stage: string,
   *   level: string,
   *   bookTitle?: string,
   *   genre?: string,
   *   depthScores: Array<{sessionId: string, stage: string, depthScore: number, depthLabel: string}>,
   *   engagementLevel: string,
   *   sessionHistory?: Array<object>,
   *   durationMinutes?: number,
   *   inputMode?: 'voice'|'text',
   *   overallScore?: number,
   *   stageScores?: Record<string, number>,
   *   suggestedLevel?: string,
   *   levelConfidence?: number,
   *   stumppedStages?: string[],
   *   excelStages?: string[]
   * }} sessionData
   * @returns {Promise<{
   *   newInstincts: StudentInstinct[],
   *   updatedInstincts: StudentInstinct[],
   *   totalInstincts: number
   * }>}
   */
  async analyzeSession(sessionData) {
    const cycleStartTime = new Date();
    const {
      sessionId,
      dialogues = [],
      level = 'intermediate',
      bookTitle,
      genre,
      depthScores = [],
      sessionHistory = [],
      durationMinutes,
      inputMode,
      overallScore,
      stageScores,
      suggestedLevel,
      levelConfidence,
      stumppedStages,
      excelStages,
      engagementByStage,
    } = sessionData;

    // Tag each dialogue with the current session ID for evidence tracking
    const taggedDialogues = dialogues.map((d) => ({
      ...d,
      session_id: d.session_id || sessionId,
    }));

    // Build a unified session summary for difficulty and engagement analyzers
    const currentSessionSummary = {
      sessionId,
      bookTitle,
      genre,
      level,
      totalTurns: dialogues.filter(
        (d) => d.speaker === 'student' || d.speaker === 'user'
      ).length,
      completedStages: [...new Set(dialogues.map((d) => d.stage).filter(Boolean))],
      engagementByStage: engagementByStage || {},
      inputMode,
      durationMinutes,
      overallScore,
      stageScores,
      suggestedLevel,
      levelConfidence,
      stumppedStages: stumppedStages || [],
      excelStages: excelStages || [],
    };

    const enrichedHistory = [...sessionHistory, currentSessionSummary];

    // -------------------------------------------------------------------
    // Run all four analyzers synchronously
    // -------------------------------------------------------------------
    const vocabCandidates     = analyzeVocabularyPatterns(this.studentId, taggedDialogues);
    const depthCandidates     = analyzeDepthPatterns(this.studentId, depthScores);
    const engagementCandidates = analyzeEngagementPatterns(this.studentId, enrichedHistory);
    const difficultyCandidates = analyzeDifficultyPatterns(this.studentId, enrichedHistory);

    const allCandidates = [
      ...vocabCandidates,
      ...depthCandidates,
      ...engagementCandidates,
      ...difficultyCandidates,
    ];

    // -------------------------------------------------------------------
    // Merge, decay, prune
    // -------------------------------------------------------------------
    const { newInstincts, updatedInstincts } = this._mergeInstincts(allCandidates);
    this._applyDecay(cycleStartTime);
    this._pruneWeakInstincts();

    // Persist
    this._persistInstincts();

    logger.info({
      studentId: this.studentId,
      sessionId,
      newCount: newInstincts.length,
      updatedCount: updatedInstincts.length,
      totalCount: this.instincts.length,
    }, '[LearningPatterns] Session analysis complete');

    return {
      newInstincts,
      updatedInstincts,
      totalInstincts: this.instincts.length,
    };
  }

  // --------------------------------------------------------------------------
  // ACTIVE INSTINCT RETRIEVAL
  // --------------------------------------------------------------------------

  /**
   * Return instincts that are active in the given session context.
   *
   * "Active" means:
   *   - confidence >= ACTIVE_THRESHOLD (0.5)
   *   - trigger text loosely matches the current stage, turn, or level
   *     (a broad keyword match is used — no NLP needed)
   *
   * Results are sorted by confidence descending so callers can take the top N.
   *
   * @param {{ stage?: string, turn?: number, level?: string }} context
   * @returns {StudentInstinct[]}
   */
  getActiveInstincts(context = {}) {
    const { stage = '', level = '' } = context;
    const contextKeywords = [stage, level].filter(Boolean).map((s) => s.toLowerCase());

    return this.instincts
      .filter((inst) => {
        if (inst.confidence < CONFIDENCE.ACTIVE_THRESHOLD) return false;
        // Match if no context keywords provided (return all active instincts)
        if (contextKeywords.length === 0) return true;
        // Match if trigger or action contains any context keyword
        const combined = `${inst.trigger} ${inst.action} ${inst.domain}`.toLowerCase();
        return contextKeywords.some((kw) => combined.includes(kw));
      })
      .sort((a, b) => b.confidence - a.confidence);
  }

  // --------------------------------------------------------------------------
  // CONFIDENCE UPDATES
  // --------------------------------------------------------------------------

  /**
   * Update the confidence of a specific instinct based on a real-world observation.
   *
   * @param {string} instinctId - The instinct's `id` field
   * @param {'confirmed'|'contradicted'|'neutral'} observation
   *   - 'confirmed'    : +CONFIRM_BOOST (0.1)
   *   - 'contradicted' : -CONTRADICT_PENALTY (0.15)
   *   - 'neutral'      : -DECAY_RATE (0.02)
   * @returns {Promise<{ ok: boolean, newConfidence?: number, removed?: boolean }>}
   */
  async updateConfidence(instinctId, observation) {
    const instinct = this.instincts.find((i) => i.id === instinctId);

    if (!instinct) {
      logger.warn({ studentId: this.studentId, instinctId },
        '[LearningPatterns] updateConfidence — instinct not found');
      return { ok: false };
    }

    const delta = {
      confirmed:    CONFIDENCE.CONFIRM_BOOST,
      contradicted: -CONFIDENCE.CONTRADICT_PENALTY,
      neutral:      -CONFIDENCE.DECAY_RATE,
    }[observation] ?? 0;

    instinct.confidence = _roundConf(_clampConfidence(instinct.confidence + delta));
    instinct.updatedAt  = new Date();

    // Prune if it fell below the minimum
    if (instinct.confidence < CONFIDENCE.MIN_THRESHOLD) {
      this.instincts = this.instincts.filter((i) => i.id !== instinctId);
      this._persistInstincts();
      logger.debug({ studentId: this.studentId, instinctId },
        '[LearningPatterns] Instinct removed after contradiction');
      return { ok: true, removed: true };
    }

    this._persistInstincts();
    return { ok: true, newConfidence: instinct.confidence };
  }

  // --------------------------------------------------------------------------
  // STUDENT PROFILE SYNTHESIS
  // --------------------------------------------------------------------------

  /**
   * Synthesize all high-confidence instincts into a human-readable student profile.
   *
   * Used by the admin dashboard, parent reports, and Alice's system prompt
   * enrichment to personalise the next session.
   *
   * @returns {{
   *   studentId: string,
   *   strengths: string[],
   *   areasForGrowth: string[],
   *   preferredTopics: string[],
   *   engagementStyle: string,
   *   levelRecommendation: string | null,
   *   activeInstinctCount: number,
   *   highConfidenceInstincts: StudentInstinct[]
   * }}
   */
  getStudentProfile() {
    const highConf = this.instincts.filter(
      (i) => i.confidence >= CONFIDENCE.HIGH_CONFIDENCE
    );

    const strengths        = [];
    const areasForGrowth   = [];
    const preferredTopics  = [];
    let engagementStyle    = 'standard';
    let levelRecommendation = null;

    for (const inst of highConf) {
      const trigger = inst.trigger.toLowerCase();
      const action  = inst.action.toLowerCase();

      // Strengths — deep/analytical patterns, topic excellence
      if (trigger.includes('consistently deep') || trigger.includes('excels')) {
        strengths.push(inst.trigger);
      }

      // Areas for growth — stumped, surface, avoidance, low vocabulary
      if (
        trigger.includes('stumped') ||
        trigger.includes('surface') ||
        trigger.includes('avoidance') ||
        trigger.includes('low') ||
        trigger.includes('declining')
      ) {
        areasForGrowth.push(inst.trigger);
      }

      // Preferred topics
      if (inst.domain === 'engagement' && trigger.includes('engagement with')) {
        const match = inst.trigger.match(/engagement with (.+?)-themed/i);
        if (match) preferredTopics.push(match[1]);
      }

      // Engagement style — voice/text preference, session length
      if (trigger.includes('voice input')) {
        engagementStyle = 'voice-first';
      } else if (trigger.includes('text input')) {
        engagementStyle = 'text-first';
      } else if (trigger.includes('short session')) {
        engagementStyle = 'brief-session';
      } else if (trigger.includes('long session')) {
        engagementStyle = 'extended-session';
      }

      // Level recommendation
      if (inst.domain === 'difficulty') {
        if (trigger.includes('upgrade')) {
          const match = inst.action.match(/upgrading level to "(\w+)"/i);
          if (match) levelRecommendation = match[1];
        } else if (trigger.includes('downgrade')) {
          const match = inst.action.match(/stepping down to "(\w+)"/i);
          if (match) levelRecommendation = match[1];
        }
      }
    }

    return {
      studentId:              this.studentId,
      strengths:              [...new Set(strengths)],
      areasForGrowth:         [...new Set(areasForGrowth)],
      preferredTopics:        [...new Set(preferredTopics)],
      engagementStyle,
      levelRecommendation,
      activeInstinctCount:    this.instincts.filter(
        (i) => i.confidence >= CONFIDENCE.ACTIVE_THRESHOLD
      ).length,
      highConfidenceInstincts: highConf,
    };
  }
}

// ============================================================================
// SESSION-END HOOK
// ============================================================================

/**
 * Main entry-point called after a session is marked complete.
 *
 * Wired into sessions.js POST /:id/complete — call this after all database
 * writes for the session are finished so the pattern analysis sees the
 * complete picture.
 *
 * Workflow:
 *   1. Instantiate StudentPatternAnalyzer for the student
 *   2. Load existing instincts from patternStore (or Supabase TODO)
 *   3. Run all analyzers against the session data
 *   4. Merge, decay, and prune instincts
 *   5. Return the analysis summary and updated student profile
 *
 * @param {string} sessionId  - Completed session UUID
 * @param {string} studentId  - Student UUID
 * @param {{
 *   dialogues: Array<{content: string, speaker: string, stage?: string}>,
 *   stage?: string,
 *   level: string,
 *   bookTitle?: string,
 *   genre?: string,
 *   depthScores?: Array<object>,
 *   engagementByStage?: Record<string, string>,
 *   sessionHistory?: Array<object>,
 *   durationMinutes?: number,
 *   inputMode?: 'voice'|'text',
 *   overallScore?: number,
 *   suggestedLevel?: string,
 *   stumppedStages?: string[],
 *   excelStages?: string[]
 * }} sessionData
 * @returns {Promise<{
 *   sessionId: string,
 *   studentId: string,
 *   newInstincts: StudentInstinct[],
 *   updatedInstincts: StudentInstinct[],
 *   totalInstincts: number,
 *   profile: object
 * }>}
 */
export async function onSessionComplete(sessionId, studentId, sessionData) {
  logger.info({ sessionId, studentId }, '[LearningPatterns] onSessionComplete — starting analysis');

  // Guard: sessionData must be a plain object
  if (!sessionData || typeof sessionData !== 'object' || Array.isArray(sessionData)) {
    logger.warn({ sessionId, studentId }, '[LearningPatterns] onSessionComplete — invalid sessionData, skipping');
    return {
      sessionId,
      studentId,
      newInstincts: [],
      updatedInstincts: [],
      totalInstincts: 0,
      profile: null,
      error: 'Invalid sessionData: must be a non-null object',
    };
  }

  try {
    const analyzer = new StudentPatternAnalyzer(studentId);
    await analyzer.loadInstincts();

    const { newInstincts, updatedInstincts, totalInstincts } =
      await analyzer.analyzeSession({ ...sessionData, sessionId });

    const profile = analyzer.getStudentProfile();

    logger.info({
      sessionId,
      studentId,
      newInstincts: newInstincts.length,
      updatedInstincts: updatedInstincts.length,
      totalInstincts,
      strengths: profile.strengths.length,
      areasForGrowth: profile.areasForGrowth.length,
    }, '[LearningPatterns] Analysis complete');

    return {
      sessionId,
      studentId,
      newInstincts,
      updatedInstincts,
      totalInstincts,
      profile,
    };
  } catch (err) {
    logger.error({ sessionId, studentId, err: err.message },
      '[LearningPatterns] onSessionComplete failed — non-fatal, session data is unaffected');
    // Pattern analysis is advisory — never let it crash the session flow
    return {
      sessionId,
      studentId,
      newInstincts: [],
      updatedInstincts: [],
      totalInstincts: 0,
      profile: null,
      error: err.message,
    };
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  CONFIDENCE,
  patternStore,
  analyzeVocabularyPatterns,
  analyzeDepthPatterns,
  analyzeEngagementPatterns,
  analyzeDifficultyPatterns,
  StudentPatternAnalyzer,
  onSessionComplete,
};
