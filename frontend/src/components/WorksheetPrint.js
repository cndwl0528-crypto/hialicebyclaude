'use client';

import { useRef, useCallback, useEffect } from 'react';

/**
 * All 8 worksheet rows in session order.
 * These mirror WORKSHEET_ROWS in session/page.js exactly.
 */
const WORKSHEET_ROWS = [
  {
    rowIndex: 0,
    stage: 'Warm-Up',
    label: 'Warm-Up',
    icon: '★',
    color: '#E8A87C',
    headerBg: '#F4C8A0',
    question: 'What kind of stories do you like?',
    example: 'e.g. I like adventure stories because they are exciting!',
  },
  {
    rowIndex: 1,
    stage: 'Title',
    label: 'Title',
    icon: '◉',
    color: '#4A90D9',
    headerBg: '#A8C8F0',
    question: 'What is this book about?',
    example: 'e.g. This book is about a caterpillar that becomes a butterfly.',
  },
  {
    rowIndex: 2,
    stage: 'Introduction',
    label: 'Introduction',
    icon: '◈',
    color: '#9B59B6',
    headerBg: '#C8A8D8',
    question: 'Who is your favorite character? Why?',
    example: 'e.g. I would choose the caterpillar because it is brave.',
  },
  {
    rowIndex: 3,
    stage: 'Body',
    label: 'Body 1',
    icon: '①',
    color: '#D4A843',
    headerBg: '#F0D890',
    question: 'What is the most important part of the story? Why?',
    example: 'e.g. The most important part is when the caterpillar eats all the food.',
  },
  {
    rowIndex: 4,
    stage: 'Body',
    label: 'Body 2',
    icon: '②',
    color: '#D4A843',
    headerBg: '#F0D890',
    question: 'What would you change about the story? Why?',
    example: 'e.g. I would add more animals because it would be more fun.',
  },
  {
    rowIndex: 5,
    stage: 'Body',
    label: 'Body 3',
    icon: '③',
    color: '#D4A843',
    headerBg: '#F0D890',
    question: 'What did you learn from this story?',
    example: 'e.g. Moreover, I learned that change can be beautiful.',
  },
  {
    rowIndex: 6,
    stage: 'Conclusion',
    label: 'Conclusion',
    icon: '✦',
    color: '#5C8B5C',
    headerBg: '#A8D0A8',
    question: 'How do you feel about this book?',
    example: 'e.g. Reading this book was really fun and I learned a lot.',
  },
  {
    rowIndex: 7,
    stage: 'Reflection',
    label: 'Reflection',
    icon: '◆',
    color: '#9B59B6',
    headerBg: '#C8A8D8',
    question: 'What helped you think about this book?',
    example: 'e.g. I think using my imagination helped me the most.',
  },
];

/**
 * Builds the complete, self-contained HTML document for the print window.
 * All styles are inlined — no Tailwind, no external resources.
 *
 * @param {Object} params
 * @param {string} params.studentName
 * @param {string} params.bookTitle
 * @param {string} params.dateStr        - Pre-formatted date string
 * @param {Object} params.worksheetAnswers - Map of rowIndex → answer string
 * @returns {string} Full HTML document string
 */
function buildPrintDocument({ studentName, bookTitle, dateStr, worksheetAnswers }) {
  const rowsHtml = WORKSHEET_ROWS.map((row) => {
    const answer = worksheetAnswers[row.rowIndex] || '';
    const hasAnswer = answer.trim().length > 0;

    const answerBlock = hasAnswer
      ? `<div class="answer-box answer-filled">
           <p>${escapeHtml(answer)}</p>
         </div>`
      : `<div class="answer-box answer-blank">
           <div class="blank-line"></div>
           <div class="blank-line"></div>
           <div class="blank-line"></div>
         </div>`;

    return `
      <div class="row" style="border-left: 4px solid ${row.color};">
        <div class="row-header" style="background-color: ${row.headerBg}; color: #2C2C2C;">
          <span class="row-icon">${row.icon}</span>
          <span class="row-label">${row.label}</span>
          ${hasAnswer ? '<span class="row-check">&#10003;</span>' : ''}
        </div>
        <div class="row-body">
          <p class="row-question">${escapeHtml(row.question)}</p>
          ${answerBlock}
          ${!hasAnswer ? `<p class="row-example">${escapeHtml(row.example)}</p>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const completedCount = WORKSHEET_ROWS.filter(
    (r) => (worksheetAnswers[r.rowIndex] || '').trim().length > 0
  ).length;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HiAlice Worksheet — ${escapeHtml(bookTitle)}</title>
    <style>
      /* ── Reset ─────────────────────────────────────────────────── */
      *, *::before, *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      /* ── Base typography ───────────────────────────────────────── */
      body {
        font-family: 'Helvetica Neue', Arial, 'Liberation Sans', sans-serif;
        font-size: 12pt;
        line-height: 1.55;
        color: #1A1A1A;
        background: #FFFFFF;
        padding: 18mm 16mm 20mm 16mm;
      }

      /* ── Logo / header band ────────────────────────────────────── */
      .page-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        border-bottom: 3px solid #4A7C59;
        padding-bottom: 12px;
        margin-bottom: 18px;
        gap: 12px;
      }

      .logo-block {
        flex: 0 0 auto;
      }

      .logo-title {
        font-size: 22pt;
        font-weight: 900;
        color: #4A7C59;
        letter-spacing: -0.5px;
        line-height: 1.1;
      }

      .logo-sub {
        font-size: 9pt;
        color: #6B8B6B;
        font-style: italic;
        margin-top: 2px;
      }

      .meta-block {
        flex: 1 1 auto;
        text-align: right;
        font-size: 10pt;
        color: #4A4A4A;
        line-height: 1.8;
      }

      .meta-block strong {
        color: #1A1A1A;
      }

      .meta-book {
        font-size: 11pt;
        font-weight: 700;
        color: #2C4A2E;
      }

      /* ── Section title ─────────────────────────────────────────── */
      .section-title {
        font-size: 10pt;
        font-weight: 700;
        color: #6B8B6B;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 10px;
      }

      /* ── Progress badge ────────────────────────────────────────── */
      .progress-badge {
        display: inline-block;
        background-color: #EAF4EA;
        border: 1.5px solid #4A7C59;
        border-radius: 20px;
        padding: 3px 12px;
        font-size: 9.5pt;
        font-weight: 700;
        color: #2C4A2E;
        margin-bottom: 14px;
      }

      /* ── Worksheet rows ────────────────────────────────────────── */
      .row {
        margin-bottom: 14px;
        border-radius: 8px;
        border: 1.5px solid #D0D7D0;
        overflow: hidden;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .row-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        font-size: 10.5pt;
        font-weight: 800;
      }

      .row-icon {
        font-size: 11pt;
        flex-shrink: 0;
        width: 18px;
        text-align: center;
      }

      .row-label {
        flex: 1;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-size: 9.5pt;
      }

      .row-check {
        color: #2C7A2C;
        font-size: 13pt;
        font-weight: 900;
      }

      .row-body {
        padding: 10px 14px 12px 14px;
        background: #FAFAFA;
      }

      .row-question {
        font-size: 10.5pt;
        font-weight: 700;
        color: #1A3A1A;
        margin-bottom: 8px;
      }

      /* Answer box — filled */
      .answer-box {
        border-radius: 6px;
        padding: 8px 10px;
        min-height: 52px;
      }

      .answer-filled {
        background: #F0F7F0;
        border: 1.5px solid #4A7C59;
      }

      .answer-filled p {
        font-size: 11pt;
        color: #1A3A1A;
        line-height: 1.6;
        white-space: pre-wrap;
      }

      /* Answer box — blank (lined) */
      .answer-blank {
        background: #FEFEFE;
        border: 1.5px dashed #B0C0B0;
      }

      .blank-line {
        border-bottom: 1px solid #C8D8C8;
        height: 22px;
        margin-bottom: 4px;
      }

      .blank-line:last-child {
        margin-bottom: 0;
      }

      /* Example hint shown only on blank rows */
      .row-example {
        font-size: 9pt;
        color: #8A9A8A;
        font-style: italic;
        margin-top: 6px;
      }

      /* ── Score strip ───────────────────────────────────────────── */
      .score-strip {
        display: flex;
        gap: 16px;
        margin-top: 18px;
        margin-bottom: 6px;
        border-top: 1.5px solid #D0D7D0;
        padding-top: 14px;
      }

      .score-item {
        flex: 1;
        text-align: center;
        border: 1.5px solid #D0D7D0;
        border-radius: 8px;
        padding: 8px 6px;
        background: #FAFAFA;
      }

      .score-label {
        font-size: 8.5pt;
        color: #6B6B6B;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }

      .score-value {
        font-size: 18pt;
        font-weight: 900;
        color: #2C4A2E;
        line-height: 1.2;
      }

      .score-unit {
        font-size: 9pt;
        color: #6B6B6B;
      }

      /* ── Footer ────────────────────────────────────────────────── */
      .page-footer {
        margin-top: 20px;
        border-top: 1.5px solid #D0D7D0;
        padding-top: 10px;
        text-align: center;
        font-size: 8.5pt;
        color: #8A8A8A;
        line-height: 1.8;
      }

      .page-footer strong {
        color: #4A7C59;
      }

      /* ── Print media overrides ─────────────────────────────────── */
      @page {
        size: A4 portrait;
        margin: 15mm 12mm 18mm 12mm;
      }

      @media print {
        body {
          padding: 0;
          font-size: 11pt;
        }

        .row {
          page-break-inside: avoid;
          break-inside: avoid;
        }
      }
    </style>
  </head>
  <body>

    <!-- Header -->
    <header class="page-header">
      <div class="logo-block">
        <div class="logo-title">HiAlice</div>
        <div class="logo-sub">AI English Reading Companion</div>
      </div>
      <div class="meta-block">
        <div class="meta-book">"${escapeHtml(bookTitle)}"</div>
        <div><strong>Student:</strong> ${escapeHtml(studentName)}</div>
        <div><strong>Date:</strong> ${escapeHtml(dateStr)}</div>
      </div>
    </header>

    <!-- Progress badge -->
    <div class="section-title">Reading Worksheet</div>
    <div class="progress-badge">
      ${completedCount} / ${WORKSHEET_ROWS.length} sections completed
    </div>

    <!-- Worksheet rows -->
    ${rowsHtml}

    <!-- Footer -->
    <footer class="page-footer">
      <div><strong>HiAlice</strong> &mdash; AI English Reading App for Ages 6&ndash;13</div>
      <div>Great job completing your reading session! Keep reading and keep growing. &#9733;</div>
    </footer>

  </body>
</html>`;
}

/** Simple HTML entity escaping to prevent XSS inside the print document */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * WorksheetPrint
 *
 * Renders a "Print Worksheet" button that opens the browser's native
 * print-to-PDF dialog pre-populated with a clean, A4-optimised reading
 * worksheet.  No external PDF libraries are used.
 *
 * The worksheet shows all 8 session stages:
 *   Warm-Up / Title / Introduction / Body 1-3 / Conclusion / Reflection
 *
 * For each stage it displays:
 *   - The guide question
 *   - The student's recorded answer (if any), or blank ruled lines
 *
 * Props:
 *   studentName      {string}  Student display name
 *   bookTitle        {string}  Book being reviewed
 *   worksheetAnswers {Object}  Map of rowIndex (0-7) to answer string.
 *                              Falls back to sessionStorage if omitted.
 *   grammarScore     {number|null}  Optional grammar score 0-100
 *   levelScore       {number|null}  Optional level score 0-100
 *   completedAt      {string|null}  ISO date string of session completion
 */
export default function WorksheetPrint({
  studentName = '',
  bookTitle = '',
  worksheetAnswers: propAnswers = null,
  grammarScore = null,
  levelScore = null,
  completedAt = null,
}) {
  const printWindowRef = useRef(null);

  /**
   * Resolves the worksheet answers from props or falls back to sessionStorage.
   * sessionStorage stores them under lastSessionData.worksheetAnswers.
   */
  const resolveAnswers = useCallback(() => {
    if (propAnswers && typeof propAnswers === 'object') {
      return propAnswers;
    }
    try {
      const raw = sessionStorage.getItem('lastSessionData');
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.worksheetAnswers || {};
      }
    } catch {
      // sessionStorage not available or JSON malformed — return empty
    }
    return {};
  }, [propAnswers]);

  const handlePrint = useCallback(() => {
    const answers = resolveAnswers();

    const date = completedAt ? new Date(completedAt) : new Date();
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = buildPrintDocument({
      studentName: studentName || 'Student',
      bookTitle: bookTitle || 'My Book',
      dateStr,
      worksheetAnswers: answers,
      grammarScore,
      levelScore,
    });

    // Close any previously opened print window to avoid accumulation
    if (printWindowRef.current && !printWindowRef.current.closed) {
      printWindowRef.current.close();
    }

    const printWindow = window.open('', '_blank', 'width=860,height=700,noopener,noreferrer');

    if (!printWindow) {
      // Pop-up was blocked — fall back to an in-page print using @media print
      alert(
        'Pop-ups are blocked in your browser.\n\nPlease allow pop-ups for this site, then click "Print Worksheet" again.'
      );
      return;
    }

    printWindowRef.current = printWindow;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    // Trigger the native print dialog once the document is fully parsed.
    // onload fires after all synchronous rendering is complete for a
    // document.write()-sourced page.
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      // Do not auto-close: the user may want to keep the preview open.
    };
  }, [studentName, bookTitle, completedAt, grammarScore, levelScore, resolveAnswers]);

  /**
   * Listen for the 'hialice:printWorksheet' custom event dispatched by the
   * compact PrintWorksheetButton in the action bar.  This keeps all print
   * logic in one place while allowing any element on the page to trigger it.
   */
  useEffect(() => {
    const onPrintEvent = () => handlePrint();
    window.addEventListener('hialice:printWorksheet', onPrintEvent);
    return () => window.removeEventListener('hialice:printWorksheet', onPrintEvent);
  }, [handlePrint]);

  return (
    <div className="ghibli-card p-6 worksheet-print-panel">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[#4A7C59] flex items-center justify-center flex-shrink-0">
          {/* Printer SVG icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-[#3D2E1E]">Print Worksheet</h3>
          <p className="text-xs text-[#6B5744] font-medium">
            Download or print a clean A4 worksheet with all your answers
          </p>
        </div>
      </div>

      {/* Worksheet preview summary */}
      <div className="bg-[#F5F0E8] rounded-xl p-4 mb-5 border border-[#E8DEC8]">
        <p className="text-xs font-bold text-[#6B5744] mb-2 uppercase tracking-wide">
          What&apos;s included
        </p>
        <ul className="space-y-1">
          {WORKSHEET_ROWS.map((row) => (
            <li key={row.rowIndex} className="flex items-center gap-2 text-xs text-[#3D2E1E]">
              <span
                className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[8px] font-extrabold"
                style={{ backgroundColor: row.color }}
                aria-hidden="true"
              >
                {row.rowIndex + 1}
              </span>
              <span className="font-semibold">{row.label}</span>
              <span className="text-[#9B8777]">—</span>
              <span className="text-[#6B5744]">{row.question}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Print button */}
      <button
        onClick={handlePrint}
        className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-[#4A7C59] text-white rounded-2xl font-bold text-sm hover:bg-[#2C5A3A] active:scale-[0.98] transition-all shadow-[0_4px_12px_rgba(74,124,89,0.35)] min-h-[52px]"
        aria-label="Open print worksheet dialog"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4"
          />
        </svg>
        Print Worksheet (PDF)
      </button>

      <p className="text-center text-xs text-[#9B8777] mt-3 font-medium">
        Opens a print-ready preview. Use &quot;Save as PDF&quot; in the print dialog to download.
      </p>
    </div>
  );
}
