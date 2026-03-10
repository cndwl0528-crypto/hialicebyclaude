/**
 * Cross-Book Memory Module
 *
 * Retrieves relevant keywords, themes, and vocabulary from a student's
 * previous reading sessions to inject into the current session's prompt.
 * This enables HiAlice to make natural cross-book connections.
 */

import { supabase } from '../lib/supabase.js';

/**
 * Fetch a student's reading history summary for cross-book context injection.
 * Returns the last 3 completed sessions with their book titles, key themes,
 * and vocabulary words the student used.
 *
 * @param {string} studentId - The student's UUID
 * @param {string} [currentBookId] - Current book ID to exclude from history
 * @returns {Promise<{ previousBooks: Array, sharedVocabulary: Array, crossBookContext: string }>}
 */
export async function getCrossBookContext(studentId, currentBookId = null) {
  try {
    // Fetch last 3 completed sessions with book info
    let query = supabase
      .from('sessions')
      .select('id, book_id, completed_at, books(id, title, author, key_themes, moral_lesson)')
      .eq('student_id', studentId)
      .eq('is_complete', true)
      .order('completed_at', { ascending: false })
      .limit(3);

    if (currentBookId) {
      query = query.neq('book_id', currentBookId);
    }

    const { data: recentSessions, error: sessionsError } = await query;

    if (sessionsError || !recentSessions || recentSessions.length === 0) {
      return { previousBooks: [], sharedVocabulary: [], crossBookContext: '' };
    }

    // Fetch vocabulary from those sessions
    const sessionIds = recentSessions.map(s => s.id);
    const { data: vocabulary } = await supabase
      .from('vocabulary')
      .select('word, mastery_level, session_id')
      .in('session_id', sessionIds)
      .gte('mastery_level', 2)
      .order('mastery_level', { ascending: false })
      .limit(15);

    // Build previous books summary
    const previousBooks = recentSessions.map(s => ({
      title: s.books?.title || 'Unknown',
      author: s.books?.author || '',
      themes: s.books?.key_themes || [],
      moralLesson: s.books?.moral_lesson || '',
      completedAt: s.completed_at,
    }));

    // Extract shared/notable vocabulary
    const sharedVocabulary = (vocabulary || []).map(v => v.word);

    // Build the context string for prompt injection
    const crossBookContext = buildCrossBookContextString(previousBooks, sharedVocabulary);

    return { previousBooks, sharedVocabulary, crossBookContext };
  } catch (error) {
    console.error('[CrossBookMemory] Error fetching context:', error.message);
    return { previousBooks: [], sharedVocabulary: [], crossBookContext: '' };
  }
}

/**
 * Build a formatted context string for injection into the system prompt.
 * @private
 */
function buildCrossBookContextString(previousBooks, sharedVocabulary) {
  if (previousBooks.length === 0) return '';

  let context = `\n═══════════════════════════════════════════════
CROSS-BOOK MEMORY (use naturally when relevant — never force):
`;

  context += `${previousBooks.length} previous book(s) this student has discussed:\n`;

  previousBooks.forEach((book, i) => {
    context += `  ${i + 1}. "${book.title}"${book.author ? ` by ${book.author}` : ''}`;
    if (book.themes && book.themes.length > 0) {
      context += ` — Themes: ${book.themes.join(', ')}`;
    }
    if (book.moralLesson) {
      context += ` — Lesson: ${book.moralLesson}`;
    }
    context += '\n';
  });

  if (sharedVocabulary.length > 0) {
    context += `\nVocabulary this student has mastered: ${sharedVocabulary.join(', ')}
(Try to naturally reference these words or themes when they connect to the current book)`;
  }

  context += `\n\nIMPORTANT: Only mention previous books if there's a GENUINE thematic connection.
Do not force connections. If a student naturally mentions a previous book, celebrate it!
═══════════════════════════════════════════════\n`;

  return context;
}

export default { getCrossBookContext };
