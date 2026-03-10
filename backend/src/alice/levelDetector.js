/**
 * HiAlice Level Detector
 * Analyzes English proficiency and grammar accuracy by level
 */

/**
 * Analyze student's English level based on their text response
 * @param {string} text - The student's written or transcribed response
 * @param {string} currentLevel - Current assigned level (beginner|intermediate|advanced)
 * @returns {object} {
 *   suggestedLevel: 'beginner'|'intermediate'|'advanced',
 *   confidence: 0-100,
 *   metrics: {
 *     sentenceComplexity: 0-100,
 *     vocabularyRange: 0-100,
 *     grammarAccuracy: 0-100,
 *     responseLength: number
 *   }
 * }
 */
export function analyzeStudentLevel(text, currentLevel = 'intermediate') {
  if (!text || text.trim().length === 0) {
    return {
      suggestedLevel: currentLevel,
      confidence: 0,
      metrics: {
        sentenceComplexity: 0,
        vocabularyRange: 0,
        grammarAccuracy: 0,
        responseLength: 0
      }
    };
  }

  // Calculate metrics
  const metrics = {
    sentenceComplexity: calculateSentenceComplexity(text),
    vocabularyRange: calculateVocabularyRange(text),
    grammarAccuracy: calculateGrammarAccuracy(text, currentLevel),
    responseLength: text.split(/\s+/).length
  };

  // Determine suggested level based on metrics
  const avgScore = (metrics.sentenceComplexity + metrics.vocabularyRange + metrics.grammarAccuracy) / 3;

  let suggestedLevel = 'intermediate';
  let confidence = Math.min(avgScore, 100);

  if (avgScore < 35) {
    suggestedLevel = 'beginner';
  } else if (avgScore > 65) {
    suggestedLevel = 'advanced';
  }

  return {
    suggestedLevel,
    confidence: Math.round(confidence),
    metrics
  };
}

/**
 * Calculate grammar score for a response based on the student's level
 * Scoring is more lenient for beginner, moderate for intermediate, strict for advanced
 * @param {string} text - Student's response
 * @param {string} level - Student's level (beginner|intermediate|advanced)
 * @returns {number} Score 0-100
 */
export function calculateGrammarScore(text, level = 'intermediate') {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  const issues = [];

  // Subject-verb agreement
  const svIssues = checkSubjectVerbAgreement(text);
  issues.push(...svIssues);

  // Tense consistency
  const tenseIssues = checkTenseConsistency(text);
  issues.push(...tenseIssues);

  // Article usage
  const articleIssues = checkArticleUsage(text);
  issues.push(...articleIssues);

  // Plural forms
  const pluralIssues = checkPluralForms(text);
  issues.push(...pluralIssues);

  // Preposition usage
  const prepIssues = checkPrepositions(text);
  issues.push(...prepIssues);

  // Calculate base score
  let totalIssues = issues.length;
  let baseScore = Math.max(0, 100 - (totalIssues * 10));

  // Apply level-specific scoring adjustments
  if (level === 'beginner') {
    // More lenient: only penalize critical issues
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    baseScore = Math.max(0, 100 - (criticalIssues.length * 15));
  } else if (level === 'intermediate') {
    // Moderate penalty
    baseScore = Math.max(0, 100 - (totalIssues * 8));
  } else if (level === 'advanced') {
    // Strict penalty
    baseScore = Math.max(0, 100 - (totalIssues * 10));
  }

  return Math.round(Math.min(baseScore, 100));
}

/**
 * Calculate sentence complexity score (0-100)
 * Looks at average sentence length, subordinate clauses, coordination
 * @private
 */
function calculateSentenceComplexity(text) {
  const sentences = text.match(/[.!?]+/g) || [];
  if (sentences.length === 0) return 20;

  const words = text.split(/\s+/);
  const avgWordsPerSentence = words.length / sentences.length;

  // Check for subordinate clauses
  const subordinateClues = /(because|although|while|if|when|that|which|who|after|before)/i;
  const hasSubordinate = subordinateClues.test(text);

  // Check for coordination
  const coordination = /(and|but|or|nor|yet|so)/i;
  const coordinationCount = (text.match(coordination) || []).length;

  let score = Math.min((avgWordsPerSentence / 25) * 100, 80);

  if (hasSubordinate) score += 10;
  if (coordinationCount > 2) score += 10;

  return Math.min(score, 100);
}

/**
 * Calculate vocabulary range score (0-100)
 * Based on unique words and word variety
 * @private
 */
function calculateVocabularyRange(text) {
  const words = text
    .toLowerCase()
    .match(/\b[a-z]+(?:'[a-z]+)?\b/g) || [];

  if (words.length === 0) return 0;

  // Count unique words
  const uniqueWords = new Set(words);
  const uniqueRatio = uniqueWords.size / words.length;

  // Count syllables (rough estimate)
  const avgSyllables = words.reduce((sum, word) => {
    return sum + estimateSyllables(word);
  }, 0) / words.length;

  // Score based on variety and word complexity
  let score = uniqueRatio * 80;
  score += Math.min((avgSyllables / 3) * 20, 20);

  return Math.round(Math.min(score, 100));
}

/**
 * Calculate grammar accuracy score (0-100)
 * @private
 */
function calculateGrammarAccuracy(text, level) {
  const issues = [];

  // Basic grammar checks
  issues.push(...checkSubjectVerbAgreement(text));
  issues.push(...checkTenseConsistency(text));
  issues.push(...checkArticleUsage(text));
  issues.push(...checkPluralForms(text));

  const baseScore = Math.max(0, 100 - (issues.length * 10));
  return Math.round(Math.min(baseScore, 100));
}

/**
 * Check subject-verb agreement issues
 * @private
 */
function checkSubjectVerbAgreement(text) {
  const issues = [];
  const patterns = [
    {
      pattern: /\b(the|a|an)\s+(\w+)\s+(are|were)\b/i,
      message: 'Subject-verb agreement (singular subject with plural verb)'
    },
    {
      pattern: /\b(they|we|you|I)\s+(is|was)\b/i,
      message: 'Subject-verb agreement (plural subject with singular verb)'
    }
  ];

  patterns.forEach(({ pattern }) => {
    if (pattern.test(text)) {
      issues.push({ type: 'subject-verb', severity: 'medium' });
    }
  });

  return issues;
}

/**
 * Check tense consistency within sentences
 * @private
 */
function checkTenseConsistency(text) {
  const issues = [];
  const sentences = text.split(/[.!?]+/);

  sentences.forEach(sentence => {
    const pastTenses = /(was|were|had|did)/i;
    const presentTenses = /(is|are|do|does|am)/i;

    if (pastTenses.test(sentence) && presentTenses.test(sentence)) {
      // Mixed tenses might be OK in some contexts, but flag as potential issue
      if (sentence.length > 50) {
        issues.push({ type: 'tense-consistency', severity: 'low' });
      }
    }
  });

  return issues;
}

/**
 * Check article usage (a, an, the)
 * @private
 */
function checkArticleUsage(text) {
  const issues = [];

  // Check for missing articles with countable nouns
  const missingArticles = /\s(book|character|story|book|author|page|word)\s/i;
  if (missingArticles.test(text) && !text.match(/\b(a|an|the)\s+(book|character|story|author|page|word)/i)) {
    issues.push({ type: 'article-usage', severity: 'low' });
  }

  return issues;
}

/**
 * Check plural form issues
 * @private
 */
function checkPluralForms(text) {
  const issues = [];

  // Check for obvious plural errors
  const pluralPatterns = [
    /\d+\s+(\w+)(?!s\b)/g,  // Numbers with singular nouns
    /(many|several|few)\s+(\w+)(?!s\b)/i // Plural quantifiers with singular
  ];

  pluralPatterns.forEach(pattern => {
    if (pattern.test(text)) {
      issues.push({ type: 'plural-form', severity: 'low' });
    }
  });

  return issues;
}

/**
 * Check preposition usage
 * @private
 */
function checkPrepositions(text) {
  const issues = [];

  // Check for common preposition errors
  const commonErrors = [
    /\bin the book\b/i,  // Usually "in the book" is OK, but check context
    /\bto go\b/i         // Might need better context
  ];

  return issues;
}

/**
 * Estimate syllable count for a word (rough heuristic)
 * @private
 */
function estimateSyllables(word) {
  word = word.toLowerCase();
  let syllables = 0;

  // Count vowel groups
  const vowels = word.match(/[aeiouy]/g) || [];
  syllables = vowels.length;

  // Adjust for silent e
  if (word.endsWith('e')) {
    syllables--;
  }

  // Adjust for consecutive vowels
  const vowelGroups = word.match(/[aeiouy]{2,}/g) || [];
  syllables -= (vowelGroups.length - 1);

  return Math.max(1, syllables);
}

// ============================================================================
// ANSWER DEPTH CLASSIFICATION
// ============================================================================

/**
 * Classify the cognitive depth of a student's response.
 * Returns one of: 'surface', 'developing', 'analytical', 'deep'
 *
 * @param {string} response - Student's response text
 * @param {string} level - 'beginner' | 'intermediate' | 'advanced'
 * @returns {object} { depth, score, indicators }
 */
export function classifyAnswerDepth(response, level = 'intermediate') {
  if (!response || typeof response !== 'string' || response.trim().length === 0) {
    return { depth: 'surface', score: 0, indicators: [] };
  }

  const text = response.trim();
  const words = text.split(/\s+/);
  const wordCount = words.length;
  const indicators = [];
  let score = 0;

  // --- Word count baseline (adjusted by level) ---
  const lengthThresholds = {
    beginner:     { developing: 5,  analytical: 12, deep: 20 },
    intermediate: { developing: 10, analytical: 20, deep: 35 },
    advanced:     { developing: 15, analytical: 30, deep: 50 }
  };
  const thresholds = lengthThresholds[level] || lengthThresholds.intermediate;

  if (wordCount >= thresholds.deep) { score += 15; indicators.push('extended_response'); }
  else if (wordCount >= thresholds.analytical) { score += 10; indicators.push('moderate_response'); }
  else if (wordCount >= thresholds.developing) { score += 5; indicators.push('brief_response'); }

  // --- Causal reasoning ---
  const causalPatterns = /\b(because|since|so that|therefore|that's why|the reason|due to)\b/i;
  if (causalPatterns.test(text)) { score += 20; indicators.push('causal_reasoning'); }

  // --- Contrastive thinking ---
  const contrastPatterns = /\b(but|however|although|even though|on the other hand|instead|unlike)\b/i;
  if (contrastPatterns.test(text)) { score += 15; indicators.push('contrastive_thinking'); }

  // --- Personal connection ---
  const personalPatterns = /\b(I think|I feel|I believe|I remember|in my life|when I|I would|me too|I also)\b/i;
  if (personalPatterns.test(text)) { score += 10; indicators.push('personal_connection'); }

  // --- Evidence from text ---
  const evidencePatterns = /\b(in the (book|story)|the (character|author)|for example|like when|the part where)\b/i;
  if (evidencePatterns.test(text)) { score += 15; indicators.push('text_evidence'); }

  // --- Evaluative language ---
  const evaluativePatterns = /\b(important|best|worst|should|shouldn't|fair|unfair|right|wrong|agree|disagree)\b/i;
  if (evaluativePatterns.test(text)) { score += 10; indicators.push('evaluative_language'); }

  // --- Creative/hypothetical thinking ---
  const creativePatterns = /\b(what if|imagine|I wonder|maybe|could be|might|would have|if I were)\b/i;
  if (creativePatterns.test(text)) { score += 15; indicators.push('creative_thinking'); }

  // --- Emotional vocabulary ---
  const emotionPatterns = /\b(happy|sad|scared|angry|excited|surprised|worried|proud|lonely|brave|curious|confused|nervous|grateful)\b/i;
  if (emotionPatterns.test(text)) { score += 5; indicators.push('emotional_expression'); }

  // --- Classify depth ---
  let depth;
  if (score >= 55) depth = 'deep';
  else if (score >= 35) depth = 'analytical';
  else if (score >= 15) depth = 'developing';
  else depth = 'surface';

  return { depth, score: Math.min(score, 100), indicators };
}

/**
 * Calculate "thinking momentum" — whether a student's responses are
 * getting deeper within a single session.
 *
 * A positive momentum means the student is engaging more deeply over time.
 * Score 0-100: 50 = neutral, >50 = improving, <50 = declining.
 *
 * @param {Array} studentTurns - Array of { content, stage } objects (student utterances only)
 * @returns {number} Momentum score 0-100
 */
export function calculateThinkingMomentum(studentTurns) {
  if (!Array.isArray(studentTurns) || studentTurns.length < 2) return 50;

  const depths = studentTurns.map(turn => {
    const result = classifyAnswerDepth(turn.content);
    return result.score;
  });

  // Calculate linear regression slope
  const n = depths.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = depths.reduce((a, b) => a + b, 0);
  const sumXY = depths.reduce((sum, y, x) => sum + x * y, 0);
  const sumX2 = depths.reduce((sum, _, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Normalize: slope of 0 = 50, positive = >50, negative = <50
  // Clamp to 0-100 range
  return Math.round(Math.min(100, Math.max(0, 50 + slope * 5)));
}

export default {
  analyzeStudentLevel,
  calculateGrammarScore,
  classifyAnswerDepth,
  calculateThinkingMomentum
};
