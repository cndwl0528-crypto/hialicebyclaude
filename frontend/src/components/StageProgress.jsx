'use client';

/**
 * TreeGardenProgress — A child-friendly stage progress indicator
 * that visualizes the reading journey as a growing garden.
 *
 * Each stage is represented by a tree growth emoji:
 *   Stage 1: 🌱 seed
 *   Stage 2: 🌿 sprout
 *   Stage 3: 🌳 small tree
 *   Stage 4: 🌲 tall tree
 *   Stage 5: 🌸 blooming
 *   Stage 6: 🍎 fruit
 *
 * Props:
 *   currentStage {number} - 0-based index of the active stage
 *   stages       {string[]} - Array of display label strings
 */

const TREE_EMOJIS = ['🌱', '🌿', '🌳', '🌲', '🌸', '🍎'];

export default function StageProgress({ currentStage = 0, stages = [] }) {
  if (stages.length === 0) return null;

  return (
    <div
      className="w-full py-4 px-2"
      role="progressbar"
      aria-valuenow={currentStage + 1}
      aria-valuemin={1}
      aria-valuemax={stages.length}
      aria-label={`Garden progress: Stage ${currentStage + 1} of ${stages.length}`}
    >
      {/* Garden path row */}
      <div className="flex items-end justify-between gap-1">
        {stages.map((stage, index) => {
          const isCompleted = index < currentStage;
          const isCurrent = index === currentStage;
          const isFuture = index > currentStage;
          const treeEmoji = TREE_EMOJIS[index] || '🌿';

          return (
            <div key={index} className="flex items-end flex-1 min-w-0">
              {/* Tree node */}
              <div className="flex flex-col items-center flex-1">
                {/* Current-stage animated glow ring */}
                <div
                  className={`relative flex items-center justify-center rounded-full transition-all duration-500 ${
                    isCurrent
                      ? 'w-14 h-14 bg-[#E8F5E8] border-2 border-[#5C8B5C] shadow-[0_0_0_4px_rgba(92,139,92,0.20)]'
                      : isCompleted
                      ? 'w-11 h-11 bg-[#C8E6C9] border-2 border-[#7AC87A]'
                      : 'w-10 h-10 bg-[#F5F0E8] border-2 border-[#D6C9A8]'
                  }`}
                  aria-label={`${stage}${isCompleted ? ' (done)' : isCurrent ? ' (now)' : ''}`}
                >
                  <span
                    className={`transition-all duration-500 select-none ${
                      isCurrent
                        ? 'text-3xl animate-bounce'
                        : isCompleted
                        ? 'text-2xl'
                        : 'text-xl grayscale opacity-40'
                    }`}
                    style={isCurrent ? { animationDuration: '2s' } : undefined}
                    role="img"
                    aria-hidden="true"
                  >
                    {treeEmoji}
                  </span>

                  {/* Completed checkmark badge */}
                  {isCompleted && (
                    <span
                      className="absolute -top-1 -right-1 w-4 h-4 bg-[#5C8B5C] rounded-full flex items-center justify-center text-white text-[9px] font-extrabold leading-none"
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  )}
                </div>

                {/* Stage label */}
                <p
                  className={`mt-1.5 text-center leading-tight font-semibold transition-colors duration-300 ${
                    isCurrent
                      ? 'text-[10px] text-[#3D6B3D] font-extrabold'
                      : isCompleted
                      ? 'text-[9px] text-[#5C8B5C]'
                      : 'text-[9px] text-[#B0A090]'
                  }`}
                  style={{ maxWidth: '64px', wordBreak: 'break-word' }}
                >
                  {stage}
                </p>
              </div>

              {/* Connecting garden path line (except after last stage) */}
              {index < stages.length - 1 && (
                <div
                  className="flex-1 mb-5 mx-0.5 h-1.5 rounded-full transition-all duration-500 overflow-hidden"
                  style={{
                    backgroundColor: isCompleted ? '#C8E6C9' : '#EDE5D4',
                    minWidth: '8px',
                  }}
                  aria-hidden="true"
                >
                  {/* Animated fill for completed path */}
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: isCompleted ? '100%' : '0%',
                      backgroundColor: '#5C8B5C',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Garden tagline */}
      <p className="text-center text-[10px] text-[#8B7355] mt-2 font-medium select-none">
        🌻 Your reading garden is growing!
      </p>
    </div>
  );
}
