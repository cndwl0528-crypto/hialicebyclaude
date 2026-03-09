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

export default {
  analyzeStudentLevel,
  calculateGrammarScore
};
