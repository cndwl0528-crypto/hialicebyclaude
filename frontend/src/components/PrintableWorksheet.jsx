'use client';

/**
 * PrintableWorksheet
 *
 * Thin wrapper used in review/page.js.
 * It extracts worksheetAnswers from the sessionData object (API shape) or
 * from sessionStorage (local fallback), then delegates rendering and print
 * functionality to WorksheetPrint.
 *
 * Props:
 *   sessionData  {Object|null} — review object from the API or sessionStorage
 *   studentName  {string}      — student display name
 *   bookTitle    {string}      — book title
 */

import WorksheetPrint from './WorksheetPrint';

/**
 * Attempts to derive a worksheetAnswers map (rowIndex → string) from various
 * data shapes that may be present in sessionData or sessionStorage.
 *
 * Priority order:
 *   1. sessionData.worksheetAnswers (saved directly by session page)
 *   2. Reconstructed from sessionData.dialogues (API shape)
 *   3. sessionStorage.lastSessionData.worksheetAnswers
 *   4. Empty object (graceful degradation — blank worksheet is still printable)
 */
function resolveWorksheetAnswers(sessionData) {
  // 1. Direct worksheetAnswers map (best case — set by session/page.js)
  if (sessionData?.worksheetAnswers && typeof sessionData.worksheetAnswers === 'object') {
    return sessionData.worksheetAnswers;
  }

  // 2. Reconstruct from dialogues array (API response shape)
  //    dialogues entries have { stage, speaker, content }
  //    We map API stage names to row indices using the same order as WORKSHEET_ROWS.
  if (Array.isArray(sessionData?.dialogues) && sessionData.dialogues.length > 0) {
    const STAGE_TO_ROW = {
      'warm-up': 0,
      warmup: 0,
      title: 1,
      introduction: 2,
      body: 3, // first body answer → row 3; subsequent ones below
      conclusion: 6,
      reflection: 7,
    };

    const answers = {};
    const bodyCount = { count: 0 };

    sessionData.dialogues.forEach((d) => {
      if (d.speaker !== 'student') return;
      const stageKey = (d.stage || '').toLowerCase().replace(/\s+/g, '-');

      if (stageKey === 'body' || stageKey === 'body-1' || stageKey === 'body-2' || stageKey === 'body-3') {
        const idx = 3 + Math.min(bodyCount.count, 2);
        if (!answers[idx]) {
          answers[idx] = d.content;
          bodyCount.count += 1;
        }
      } else {
        const rowIdx = STAGE_TO_ROW[stageKey];
        if (rowIdx !== undefined && !answers[rowIdx]) {
          answers[rowIdx] = d.content;
        }
      }
    });

    if (Object.keys(answers).length > 0) return answers;
  }

  // 3. sessionStorage fallback
  try {
    const raw = typeof window !== 'undefined' && sessionStorage.getItem('lastSessionData');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.worksheetAnswers && typeof parsed.worksheetAnswers === 'object') {
        return parsed.worksheetAnswers;
      }
    }
  } catch {
    // sessionStorage unavailable or JSON malformed
  }

  // 4. Empty — blank worksheet
  return {};
}

export default function PrintableWorksheet({ sessionData = null, studentName = '', bookTitle = '' }) {
  const worksheetAnswers = resolveWorksheetAnswers(sessionData);

  return (
    <WorksheetPrint
      studentName={studentName}
      bookTitle={bookTitle}
      worksheetAnswers={worksheetAnswers}
      grammarScore={sessionData?.grammarScore ?? null}
      levelScore={sessionData?.levelScore ?? null}
      completedAt={sessionData?.completedAt ?? null}
    />
  );
}
