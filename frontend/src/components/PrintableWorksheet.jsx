'use client';
import { useRef } from 'react';

/**
 * The four session stages in canonical display order.
 * Kept as a constant so both the screen-preview and the print document
 * share the same ordering without duplication.
 */
const STAGES = ['title', 'introduction', 'body', 'conclusion'];

const STAGE_LABELS = {
  title: 'Title',
  introduction: 'Introduction',
  body: 'Body',
  conclusion: 'Conclusion',
};

/** Print-safe hex colours for each stage header band */
const STAGE_COLORS = {
  title: '#3B82F6',
  introduction: '#10B981',
  body: '#D4A843',
  conclusion: '#EC4899',
};

/**
 * Builds the complete HTML string for a new print window.
 * Kept out of the component so it is easy to unit-test independently.
 *
 * @param {string} innerHtml   - Pre-rendered HTML from the printRef div
 * @param {string} bookTitle   - Used in the <title> element
 * @returns {string}
 */
function buildPrintDocument(innerHtml, bookTitle) {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>HiAlice Worksheet — ${bookTitle}</title>
        <style>
          *  { box-sizing: border-box; margin: 0; padding: 0; }

          body {
            font-family: 'Comic Sans MS', 'Chalkboard SE', 'Arial Rounded MT Bold', sans-serif;
            padding: 24px 32px;
            color: #3D2E1E;
            font-size: 13px;
            line-height: 1.6;
          }

          /* ── Header ────────────────────────────────────────────── */
          .ws-header {
            text-align: center;
            border-bottom: 3px solid #5C8B5C;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .ws-header h1 { font-size: 22px; margin-bottom: 6px; }
          .ws-header p  { font-size: 13px; color: #5C8B5C; }
          .ws-header .ws-date { font-size: 11px; color: #6B5744; margin-top: 4px; }

          /* ── Stage blocks ──────────────────────────────────────── */
          .ws-stage {
            margin-bottom: 20px;
            border: 2px solid #5C8B5C;
            border-radius: 12px;
            overflow: hidden;
            page-break-inside: avoid;
          }
          .ws-stage-header {
            color: white;
            padding: 8px 16px;
            font-weight: bold;
            font-size: 14px;
          }
          .ws-stage-body { padding: 12px 16px; }

          .ws-question {
            font-size: 12px;
            color: #6B5744;
            font-style: italic;
            margin-bottom: 8px;
          }

          /* Filled answer box */
          .ws-answer {
            border: 1.5px dashed #6B5744;
            border-radius: 8px;
            padding: 10px 12px;
            margin-bottom: 8px;
            background: #F9FAFB;
            min-height: 56px;
          }
          .ws-answer p { color: #374151; }

          /* Empty ruled lines for blank worksheet */
          .ws-line {
            border-bottom: 1px solid #D1D5DB;
            height: 28px;
            margin-bottom: 8px;
          }

          /* ── Footer ────────────────────────────────────────────── */
          .ws-footer {
            text-align: center;
            margin-top: 32px;
            font-size: 11px;
            color: #6B5744;
            border-top: 1px solid #D6C9A8;
            padding-top: 12px;
          }

          @media print {
            body { padding: 12px 16px; }
          }
        </style>
      </head>
      <body>${innerHtml}</body>
    </html>
  `;
}

/**
 * Groups a flat dialogue array by stage into a Map<stage, dialogues[]>.
 *
 * @param {Array<Object>} dialogues
 * @returns {Object<string, Array<Object>>}
 */
function groupByStage(dialogues = []) {
  return STAGES.reduce((acc, stage) => {
    acc[stage] = dialogues.filter((d) => d.stage === stage);
    return acc;
  }, {});
}

/**
 * PrintableWorksheet
 *
 * Renders a print-ready worksheet summarising all four Q&A stages of a session.
 * When the student has answers recorded those are shown inside answer boxes;
 * otherwise empty ruled lines are rendered so the sheet can be used as a blank
 * handout before the session.
 *
 * Props:
 *   sessionData  {Object|null} — session object containing a `dialogues` array
 *   studentName  {string}      — student's display name
 *   bookTitle    {string}      — title of the book reviewed
 */
export default function PrintableWorksheet({ sessionData = null, studentName = '', bookTitle = '' }) {
  const printRef = useRef(null);

  const handlePrint = () => {
    const innerHtml = printRef.current?.innerHTML;
    if (!innerHtml) return;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      // Browsers with pop-up blocking will return null — degrade gracefully
      alert('Please allow pop-ups to print the worksheet.');
      return;
    }

    printWindow.document.write(buildPrintDocument(innerHtml, bookTitle));
    printWindow.document.close();

    // Wait for styles to parse before triggering the print dialog
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };

  const dialoguesByStage = groupByStage(sessionData?.dialogues);
  const printDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div>
      {/* ── Print Trigger Button ─────────────────────────────────── */}
      <button
        onClick={handlePrint}
        className="w-full bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-[#5C8B5C]/30 p-4 flex items-center justify-center gap-3 text-[#5C8B5C] font-bold hover:shadow-md hover:border-[#5C8B5C]/60 active:scale-95 transition-all min-h-[52px]"
        aria-label="Print reading worksheet"
      >
        <span role="img" aria-label="printer" className="text-xl">🖨️</span>
        <span>Print My Worksheet</span>
      </button>

      {/* ── Hidden Printable Content ─────────────────────────────── */}
      {/*
        This div is hidden on-screen but its innerHTML is extracted and injected
        into the print window. The class names below are intentionally plain so
        they match the print-window stylesheet, not Tailwind.
      */}
      <div ref={printRef} className="hidden" aria-hidden="true">

        {/* Header */}
        <div className="ws-header">
          <h1>📚 HiAlice Reading Worksheet</h1>
          <p>Student: {studentName} &nbsp;|&nbsp; Book: <em>{bookTitle}</em></p>
          <p className="ws-date">Date: {printDate}</p>
        </div>

        {/* Stage sections */}
        {STAGES.map((stage) => {
          const all = dialoguesByStage[stage] || [];
          const aliceLines = all.filter((d) => d.speaker === 'alice');
          const studentAnswers = all.filter((d) => d.speaker === 'student');
          const firstQuestion = aliceLines[0]?.content;

          return (
            <div key={stage} className="ws-stage">
              <div
                className="ws-stage-header"
                style={{ backgroundColor: STAGE_COLORS[stage] }}
              >
                {STAGE_LABELS[stage]}
              </div>

              <div className="ws-stage-body">
                {/* HiAlice's opening question for this stage */}
                {firstQuestion && (
                  <p className="ws-question">
                    HiAlice asked: &ldquo;{firstQuestion}&rdquo;
                  </p>
                )}

                {/* Student answers (filled) or blank lines (empty) */}
                {studentAnswers.length > 0 ? (
                  studentAnswers.map((answer, idx) => (
                    <div key={idx} className="ws-answer">
                      <p>{answer.content}</p>
                    </div>
                  ))
                ) : (
                  <>
                    {/* Three blank lines when the stage has no recorded answers */}
                    <div className="ws-line" />
                    <div className="ws-line" />
                    <div className="ws-line" />
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <div className="ws-footer">
          <p>🌟 Great job finishing your book review! Keep reading! 📚</p>
          <p style={{ marginTop: '4px' }}>Generated by HiAlice</p>
        </div>

      </div>
    </div>
  );
}
