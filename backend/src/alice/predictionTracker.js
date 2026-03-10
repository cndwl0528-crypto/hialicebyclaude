/**
 * Prediction Portfolio Tracker
 *
 * Manages student predictions about books — tracking, verifying, and
 * building metacognitive awareness through prediction-verification cycles.
 */

import { supabase } from '../lib/supabase.js';

/**
 * Save a student's prediction during a session.
 *
 * @param {object} params
 * @param {string} params.studentId
 * @param {string} params.sessionId
 * @param {string} params.bookId
 * @param {string} params.predictionText - The student's prediction
 * @param {string} params.predictionType - 'plot'|'character'|'theme'|'ending'|'connection'
 * @param {string} params.stage - Current session stage
 * @param {number} [params.confidenceBefore] - 1-5 how confident they are
 * @returns {Promise<{ prediction: object | null, error: string | null }>}
 */
export async function savePrediction({
  studentId, sessionId, bookId, predictionText, predictionType, stage, confidenceBefore
}) {
  try {
    const { data, error } = await supabase
      .from('student_predictions')
      .insert({
        student_id: studentId,
        session_id: sessionId,
        book_id: bookId,
        prediction_text: predictionText,
        prediction_type: predictionType,
        stage,
        confidence_before: confidenceBefore || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[PredictionTracker] Save error:', error.message);
      return { prediction: null, error: error.message };
    }

    return { prediction: data, error: null };
  } catch (err) {
    console.error('[PredictionTracker] Unexpected error:', err.message);
    return { prediction: null, error: err.message };
  }
}

/**
 * Verify a prediction after the student has more context.
 *
 * @param {string} predictionId
 * @param {boolean} wasCorrect
 * @param {string} verificationText - Why it was correct/incorrect
 * @param {number} [confidenceAfter] - 1-5 confidence after verification
 * @returns {Promise<{ success: boolean, error: string | null }>}
 */
export async function verifyPrediction(predictionId, wasCorrect, verificationText, confidenceAfter) {
  try {
    const { error } = await supabase
      .from('student_predictions')
      .update({
        was_correct: wasCorrect,
        verification_text: verificationText,
        verified_at: new Date().toISOString(),
        confidence_after: confidenceAfter || null,
      })
      .eq('id', predictionId);

    if (error) {
      console.error('[PredictionTracker] Verify error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('[PredictionTracker] Unexpected error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get a student's prediction portfolio summary.
 *
 * @param {string} studentId
 * @returns {Promise<{ portfolio: object, recentPredictions: Array }>}
 */
export async function getPortfolio(studentId) {
  try {
    const [{ data: accuracy }, { data: recent }] = await Promise.all([
      supabase
        .from('student_prediction_accuracy')
        .select('*')
        .eq('student_id', studentId)
        .single(),
      supabase
        .from('student_predictions')
        .select('id, prediction_text, prediction_type, was_correct, confidence_before, confidence_after, created_at, books(title)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    return {
      portfolio: accuracy || {
        total_predictions: 0,
        correct_predictions: 0,
        accuracy_percentage: null,
        avg_confidence_before: null,
        avg_confidence_after: null,
      },
      recentPredictions: (recent || []).map(p => ({
        id: p.id,
        text: p.prediction_text,
        type: p.prediction_type,
        wasCorrect: p.was_correct,
        confidenceBefore: p.confidence_before,
        confidenceAfter: p.confidence_after,
        bookTitle: p.books?.title || 'Unknown',
        createdAt: p.created_at,
      })),
    };
  } catch (err) {
    console.error('[PredictionTracker] Portfolio error:', err.message);
    return {
      portfolio: { total_predictions: 0 },
      recentPredictions: [],
    };
  }
}

/**
 * Get unverified predictions for a specific session (for end-of-session review).
 *
 * @param {string} sessionId
 * @returns {Promise<Array>}
 */
export async function getUnverifiedPredictions(sessionId) {
  try {
    const { data } = await supabase
      .from('student_predictions')
      .select('id, prediction_text, prediction_type, confidence_before, stage')
      .eq('session_id', sessionId)
      .is('was_correct', null)
      .order('created_at', { ascending: true });

    return data || [];
  } catch (err) {
    console.error('[PredictionTracker] Unverified fetch error:', err.message);
    return [];
  }
}

export default { savePrediction, verifyPrediction, getPortfolio, getUnverifiedPredictions };
