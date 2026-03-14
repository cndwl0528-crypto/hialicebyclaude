'use client';

/**
 * StageRenderer.js
 *
 * Left-side worksheet panel (desktop) / top panel (mobile).
 * Renders:
 *   - Worksheet header with book title and dev skip button
 *   - Tree garden progress bar (StageProgress component)
 *   - Worksheet rows (one per stage, Think Deeper expands to 3)
 *   - Progress summary bar at the bottom
 */

import StageProgress from '@/components/StageProgress';
import { useSession } from './SessionContext';

export default function StageRenderer() {
  const {
    bookTitle,
    currentStage,
    activeStages,
    activeWorksheetRows,
    activeRowIndex,
    activeRowRef,
    worksheetAnswers,
    handleSkipToNextStage,
  } = useSession();

  return (
    <div className="w-full max-h-[260px] overflow-y-auto border-r border-[#D6C9A8] bg-[#FFFCF3] shadow-[2px_0_12px_rgba(61,46,30,0.06)] flex-shrink-0 lg:h-full lg:w-80 lg:max-h-none">
      {/* Worksheet Header */}
      <div className="bg-[linear-gradient(180deg,#6B9A6B_0%,#5C8B5C_100%)] text-white px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
        <span className="text-xl" aria-hidden="true">📝</span>
        <div>
          <h2 className="font-extrabold text-sm">My Reading Notes</h2>
          <p className="text-xs text-white/80 truncate">{bookTitle || 'Book Title'}</p>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={handleSkipToNextStage}
            className="ml-auto px-2 py-1 text-xs font-bold bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors"
            title="Skip to next stage (dev only)"
          >
            Skip →
          </button>
        )}
      </div>

      {/* Tree Garden Progress Bar */}
      <div className="bg-[#F5F0E8] border-b border-[#D6C9A8] px-2 pb-1">
        <StageProgress currentStage={currentStage} stages={activeStages} />
      </div>

      {/* Worksheet Table */}
      <div className="divide-y divide-[#EDE5D4]">
        {activeWorksheetRows.map((row, idx) => {
          const isActive = idx === activeRowIndex;
          const isCompleted = idx < activeRowIndex;
          const answer = worksheetAnswers[idx];

          return (
            <div
              key={idx}
              ref={isActive ? activeRowRef : null}
              className={`transition-all duration-300 ${
                isActive
                  ? 'bg-[#E8F5E8] border-l-4 border-[#5C8B5C]'
                  : isCompleted
                  ? 'bg-[#C8E6C9] bg-opacity-40 border-l-4 border-[#7AC87A]'
                  : 'bg-[#F5F0E8] border-l-4 border-transparent opacity-60'
              }`}
            >
              {/* Row Header */}
              <div className="flex items-center gap-2 px-3 py-3">
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-extrabold flex-shrink-0"
                  style={{ backgroundColor: isCompleted ? '#7AC87A' : row.color }}
                >
                  {isCompleted ? '✓' : row.icon}
                </span>
                <span
                  className="text-xs font-extrabold uppercase tracking-wide"
                  style={{ color: isCompleted ? '#5C8B5C' : row.color }}
                >
                  {row.label}
                </span>
                {isActive && (
                  <span className="ml-auto text-xs text-[#5C8B5C] font-bold animate-pulse">
                    Now
                  </span>
                )}
              </div>

              <div className="px-3 pb-3">
                {answer ? (
                  <div className="rounded-xl border border-[#C8E6C9] bg-[#FFFCF3] px-3 py-2 text-xs font-semibold text-[#5C8B5C] shadow-sm">
                    {answer.length > 80 ? `${answer.substring(0, 80)}...` : answer}
                  </div>
                ) : (
                  <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                    isActive ? 'bg-[#FFFCF3] text-[#3D2E1E] border border-[#C8E6C9]' : 'bg-[#FFF8E8] text-[#8D6E63]'
                  }`}>
                    {isActive ? 'Alice is talking with you about this part now.' : 'Your conversation will appear here.'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Summary */}
      <div className="sticky bottom-0 bg-[#FFFCF3] border-t border-[#D6C9A8] px-4 py-3">
        <div className="flex items-center justify-between text-xs text-[#6B5744] mb-1">
          <span className="font-bold">Progress</span>
          <span className="font-extrabold text-[#5C8B5C]">
            {Object.keys(worksheetAnswers).length} / {activeWorksheetRows.length}
          </span>
        </div>
        <div className="w-full bg-[#EDE5D4] rounded-full h-2">
          <div
            className="bg-[#5C8B5C] h-2 rounded-full transition-all duration-500"
            style={{ width: `${(Object.keys(worksheetAnswers).length / activeWorksheetRows.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
