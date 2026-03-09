/**
 * achievements.js
 * HiAlice — Achievement (Badge) System
 *
 * Defines all achievement criteria and provides a helper that
 * checks eligibility and upserts earned badges into the DB.
 *
 * Usage:
 *   import { checkAndAwardAchievements } from '../lib/achievements.js';
 *   await checkAndAwardAchievements(supabase, studentId, stats);
 *
 * stats shape expected by callers:
 *   {
 *     totalBooks    : number,  // total completed sessions
 *     totalWords    : number,  // total vocabulary entries
 *     streak        : number,  // current_streak from students table
 *     avgGrammar    : number,  // average grammar_score across all sessions (0-100)
 *   }
 */

// ============================================================================
// ACHIEVEMENT DEFINITIONS
// ============================================================================
// Each entry has:
//   key   — unique identifier stored in student_achievements
//   label — human-readable badge name
//   emoji — visual badge icon
//   check — pure function (stats) => boolean

export const ACHIEVEMENTS = [
  // --- Books read milestones ---
  {
    key: 'first-book',
    label: 'First Book',
    emoji: '📚',
    check: (stats) => stats.totalBooks >= 1,
  },
  {
    key: 'five-books',
    label: 'Book Explorer',
    emoji: '📖',
    check: (stats) => stats.totalBooks >= 5,
  },
  {
    key: 'ten-books',
    label: 'Bookworm',
    emoji: '🐛',
    check: (stats) => stats.totalBooks >= 10,
  },
  {
    key: 'twenty-books',
    label: 'Literary Champion',
    emoji: '🏆',
    check: (stats) => stats.totalBooks >= 20,
  },

  // --- Vocabulary milestones ---
  {
    key: 'word-10',
    label: 'Word Starter',
    emoji: '🌱',
    check: (stats) => stats.totalWords >= 10,
  },
  {
    key: 'word-50',
    label: 'Word Collector',
    emoji: '✏️',
    check: (stats) => stats.totalWords >= 50,
  },
  {
    key: 'word-100',
    label: 'Vocabulary Hero',
    emoji: '🦸',
    check: (stats) => stats.totalWords >= 100,
  },
  {
    key: 'word-250',
    label: 'Vocabulary Master',
    emoji: '🎓',
    check: (stats) => stats.totalWords >= 250,
  },

  // --- Reading streak milestones ---
  {
    key: 'streak-3',
    label: '3-Day Streak',
    emoji: '🔥',
    check: (stats) => stats.streak >= 3,
  },
  {
    key: 'streak-7',
    label: 'Week Warrior',
    emoji: '⚡',
    check: (stats) => stats.streak >= 7,
  },
  {
    key: 'streak-14',
    label: 'Dedicated Reader',
    emoji: '💪',
    check: (stats) => stats.streak >= 14,
  },
  {
    key: 'streak-30',
    label: 'Reading Legend',
    emoji: '🌟',
    check: (stats) => stats.streak >= 30,
  },

  // --- Grammar quality milestones ---
  {
    key: 'grammar-70',
    label: 'Grammar Improver',
    emoji: '📝',
    check: (stats) => stats.avgGrammar >= 70,
  },
  {
    key: 'grammar-90',
    label: 'Grammar Star',
    emoji: '⭐',
    check: (stats) => stats.avgGrammar >= 90,
  },
];

// ============================================================================
// AWARD HELPER
// ============================================================================

/**
 * Checks all achievement criteria against the given stats and upserts
 * any newly earned achievements into the student_achievements table.
 *
 * Uses ON CONFLICT DO NOTHING (ignoreDuplicates) so re-running this
 * function is always safe — already-earned badges are never duplicated.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} studentId — UUID of the student
 * @param {{ totalBooks: number, totalWords: number, streak: number, avgGrammar: number }} stats
 * @returns {Promise<{ awarded: string[] }>} — keys of achievements newly awarded this call
 */
export async function checkAndAwardAchievements(supabase, studentId, stats) {
  const awarded = [];

  for (const achievement of ACHIEVEMENTS) {
    // Skip if the student does not yet meet the criteria
    if (!achievement.check(stats)) {
      continue;
    }

    // Upsert — insert only if not already present (ON CONFLICT DO NOTHING)
    const { error } = await supabase
      .from('student_achievements')
      .upsert(
        {
          student_id: studentId,
          achievement_key: achievement.key,
          achievement_label: achievement.label,
          achievement_emoji: achievement.emoji,
        },
        {
          onConflict: 'student_id,achievement_key',
          ignoreDuplicates: true,
        }
      );

    if (error) {
      // Log but do not throw — achievement failure should not break session flow
      console.error(`Achievement upsert failed [${achievement.key}]:`, error.message);
    } else {
      awarded.push(achievement.key);
    }
  }

  return { awarded };
}

/**
 * Fetch all earned achievements for a student.
 * Returned in descending earned_at order so newest appears first.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} studentId
 * @returns {Promise<Array>}
 */
export async function getStudentAchievements(supabase, studentId) {
  const { data, error } = await supabase
    .from('student_achievements')
    .select('achievement_key, achievement_label, achievement_emoji, earned_at')
    .eq('student_id', studentId)
    .order('earned_at', { ascending: false });

  if (error) {
    console.error('getStudentAchievements error:', error.message);
    return [];
  }

  return data || [];
}
