/**
 * HiAlice Vocabulary Extractor
 * Extracts meaningful vocabulary from student responses with part-of-speech detection
 * and synonym generation
 */

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'or', 'she', 'that', 'the', 'to', 'was',
  'will', 'with', 'you', 'your', 'this', 'these', 'those', 'have', 'had', 'do',
  'does', 'did', 'can', 'could', 'would', 'should', 'may', 'might', 'must',
  'about', 'after', 'all', 'am', 'any', 'because', 'been', 'before', 'being',
  'between', 'both', 'but', 'if', 'into', 'just', 'me', 'my', 'myself', 'no',
  'not', 'our', 'ourselves', 'out', 'over', 'same', 'so', 'such', 'than',
  'them', 'themselves', 'then', 'there', 'their', 'theirs', 'we', 'what',
  'when', 'where', 'which', 'who', 'whom', 'why', 'now', 'here', 'there',
  'up', 'down', 'very', 'too', 'more', 'most', 'some', 'few', 'many', 'much',
  'also', 'like', 'only', 'him', 'her', 'us', 'such', 'how', 'while', 'during'
]);

const SYNONYM_MAP = {
  // Common beginner/intermediate words
  happy: ['joyful', 'glad', 'pleased', 'cheerful'],
  sad: ['unhappy', 'depressed', 'sorrowful', 'gloomy'],
  big: ['large', 'huge', 'enormous', 'great'],
  small: ['tiny', 'little', 'miniature', 'compact'],
  good: ['excellent', 'great', 'wonderful', 'fine'],
  bad: ['terrible', 'awful', 'poor', 'dreadful'],
  nice: ['pleasant', 'lovely', 'charming', 'wonderful'],
  funny: ['humorous', 'amusing', 'hilarious', 'comical'],
  scary: ['frightening', 'terrifying', 'spooky', 'sinister'],
  brave: ['courageous', 'fearless', 'bold', 'heroic'],
  scared: ['frightened', 'afraid', 'terrified', 'anxious'],
  smart: ['intelligent', 'clever', 'brilliant', 'wise'],
  stupid: ['foolish', 'silly', 'dumb', 'unintelligent'],
  tired: ['exhausted', 'weary', 'fatigued', 'sleepy'],
  angry: ['furious', 'mad', 'enraged', 'irritated'],
  love: ['adore', 'treasure', 'cherish', 'like'],
  hate: ['despise', 'dislike', 'detest', 'loathe'],
  
  // Action verbs
  walk: ['stroll', 'step', 'pace', 'trudge'],
  run: ['sprint', 'dash', 'race', 'jog'],
  jump: ['leap', 'hop', 'bound', 'spring'],
  eat: ['consume', 'devour', 'nibble', 'feast'],
  drink: ['sip', 'gulp', 'quench', 'guzzle'],
  sleep: ['rest', 'slumber', 'doze', 'nap'],
  think: ['contemplate', 'ponder', 'consider', 'reflect'],
  say: ['speak', 'tell', 'mention', 'declare'],
  look: ['see', 'gaze', 'observe', 'watch'],
  listen: ['hear', 'heed', 'attend', 'pay attention'],
  give: ['offer', 'present', 'hand', 'provide'],
  take: ['grab', 'seize', 'accept', 'receive'],
  help: ['assist', 'aid', 'support', 'help'],
  hurt: ['pain', 'injure', 'wound', 'damage'],
  learn: ['study', 'discover', 'understand', 'master'],
  
  // Advanced words
  interesting: ['fascinating', 'compelling', 'engaging', 'intriguing'],
  important: ['significant', 'crucial', 'essential', 'vital'],
  beautiful: ['gorgeous', 'stunning', 'exquisite', 'magnificent'],
  ugly: ['hideous', 'unsightly', 'grotesque', 'unattractive'],
  strange: ['peculiar', 'odd', 'unusual', 'bizarre'],
  lazy: ['idle', 'sluggish', 'slothful', 'indolent'],
  quick: ['fast', 'swift', 'rapid', 'speedy'],
  slow: ['sluggish', 'gradual', 'leisurely', 'dawdle'],
  loud: ['noisy', 'boisterous', 'clamorous', 'deafening'],
  quiet: ['silent', 'peaceful', 'tranquil', 'hushed'],
  
  // Character-related
  character: ['protagonist', 'figure', 'personality', 'individual'],
  story: ['narrative', 'tale', 'account', 'plot'],
  book: ['novel', 'volume', 'publication', 'tome'],
  author: ['writer', 'creator', 'novelist', 'composer'],
  ending: ['conclusion', 'finish', 'resolution', 'finale'],
  beginning: ['start', 'opening', 'commencement', 'inception'],
  middle: ['center', 'midst', 'mid-point', 'heart'],
  problem: ['issue', 'conflict', 'difficulty', 'challenge'],
  lesson: ['teaching', 'moral', 'insight', 'principle'],
  theme: ['subject', 'topic', 'idea', 'motif'],
  
  // Emotions/feelings
  surprised: ['amazed', 'astonished', 'shocked', 'stunned'],
  confused: ['puzzled', 'bewildered', 'perplexed', 'disoriented'],
  excited: ['thrilled', 'elated', 'enthusiastic', 'eager'],
  bored: ['uninterested', 'tedious', 'dull', 'monotonous'],
  worried: ['anxious', 'concerned', 'troubled', 'nervous'],
  proud: ['satisfied', 'honored', 'dignified', 'gratified'],
  
  // Actions with synonyms
  find: ['discover', 'locate', 'uncover', 'encounter'],
  lose: ['misplace', 'forfeit', 'mislay', 'squander'],
  win: ['triumph', 'succeed', 'prevail', 'conquer'],
  fail: ['flop', 'falter', 'stumble', 'blunder'],
  change: ['alter', 'transform', 'modify', 'evolve'],
  happen: ['occur', 'take place', 'transpire', 'unfold']
};

/**
 * Extract meaningful vocabulary from student text response
 * @param {string} text - Student's response text
 * @param {string} level - Student's level (beginner|intermediate|advanced)
 * @returns {array} Array of vocabulary objects
 */
export function extractVocabulary(text, level = 'intermediate') {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Extract and normalize words
  const words = text
    .toLowerCase()
    .match(/\b[a-z]+(?:'[a-z]+)?\b/g) || [];

  // Filter out stop words and get unique words
  const meaningfulWords = words.filter(word => !STOP_WORDS.has(word));
  const uniqueWords = [...new Set(meaningfulWords)];

  // Map to vocabulary objects
  const vocabulary = uniqueWords.map(word => {
    const pos = categorizePOS(word);
    const synonyms = SYNONYM_MAP[word] || generateBasicSynonyms(word);
    const isNew = isNewVocabulary(word, level);

    // Find the context sentence for this word
    const contextSentence = findContextSentence(text, word);

    return {
      word,
      pos,
      context: contextSentence,
      isNew,
      synonyms: synonyms || [],
      timestamp: new Date().toISOString()
    };
  });

  // Sort by importance (new words first, then by word frequency in original text)
  vocabulary.sort((a, b) => {
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    const freqA = countWordOccurrences(text, a.word);
    const freqB = countWordOccurrences(text, b.word);
    return freqB - freqA;
  });

  return vocabulary;
}

/**
 * Categorize part of speech using simple heuristic rules
 * @param {string} word - The word to categorize
 * @returns {string} 'noun' | 'verb' | 'adjective' | 'adverb' | 'other'
 */
export function categorizePOS(word) {
  // Adverbs ending in -ly
  if (word.endsWith('ly')) {
    return 'adverb';
  }

  // Nouns ending in common suffixes
  if (word.endsWith('tion') || word.endsWith('sion') || word.endsWith('ment') || 
      word.endsWith('ness') || word.endsWith('ance') || word.endsWith('ence')) {
    return 'noun';
  }

  // Adjectives ending in common suffixes
  if (word.endsWith('ful') || word.endsWith('less') || word.endsWith('ous') || 
      word.endsWith('ive') || word.endsWith('able') || word.endsWith('ible') ||
      word.endsWith('ant') || word.endsWith('ent')) {
    return 'adjective';
  }

  // Verbs (common base forms and patterns)
  if (word.endsWith('ing')) {
    return 'verb';
  }

  // Check if word is in known adjective/verb lists
  const commonAdjectives = ['beautiful', 'happy', 'sad', 'big', 'small', 'good', 'bad', 
                           'nice', 'funny', 'scary', 'brave', 'smart', 'interesting'];
  if (commonAdjectives.includes(word)) {
    return 'adjective';
  }

  const commonVerbs = ['run', 'walk', 'jump', 'eat', 'drink', 'sleep', 'think', 'say', 
                       'look', 'listen', 'give', 'take', 'help', 'learn', 'find', 'make'];
  if (commonVerbs.includes(word)) {
    return 'verb';
  }

  // Default to other for ambiguous words
  return 'other';
}

/**
 * Generate basic synonyms for words not in the main map
 * @private
 */
function generateBasicSynonyms(word) {
  // Simple rule-based synonym generation
  if (word.endsWith('ing')) {
    // Suggest related noun forms
    return [];
  }

  // For unknown words, return empty array
  // In production, could integrate with a thesaurus API
  return [];
}

/**
 * Determine if a word is "new" based on level
 * @private
 */
function isNewVocabulary(word, level) {
  // Beginner level: words over 2 syllables are "new"
  if (level === 'beginner') {
    const syllables = estimateSyllables(word);
    return syllables > 2;
  }

  // Intermediate level: words over 3 syllables are "new"
  if (level === 'intermediate') {
    const syllables = estimateSyllables(word);
    return syllables > 3;
  }

  // Advanced level: very complex words are "new"
  if (level === 'advanced') {
    const syllables = estimateSyllables(word);
    return syllables > 4 || /[aeiouy]{2,}/.test(word);
  }

  return false;
}

/**
 * Find the sentence containing the target word
 * @private
 */
function findContextSentence(text, word) {
  const sentences = text.split(/[.!?]+/);
  
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(word)) {
      return sentence.trim();
    }
  }

  return text.substring(0, 100);
}

/**
 * Count occurrences of a word in text
 * @private
 */
function countWordOccurrences(text, word) {
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Estimate syllable count (rough heuristic)
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
  extractVocabulary,
  categorizePOS,
  STOP_WORDS,
  SYNONYM_MAP
};
