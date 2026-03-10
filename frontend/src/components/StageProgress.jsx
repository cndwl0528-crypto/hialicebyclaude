'use client';

export default function StageProgress({ currentStage = 0, stages = [] }) {
  if (stages.length === 0) return null;

  return (
    <div className="w-full py-6" role="progressbar" aria-valuenow={currentStage + 1} aria-valuemin={1} aria-valuemax={stages.length} aria-label={`Progress: Stage ${currentStage + 1} of ${stages.length}`}>
      <div className="flex items-center justify-between">
        {stages.map((stage, index) => (
          <div key={index} className="flex items-center flex-1">
            {/* Stage Circle */}
            <div className="relative flex items-center justify-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white transition-smooth ${
                  index < currentStage
                    ? 'bg-green-500'
                    : index === currentStage
                    ? 'bg-blue-500 ring-4 ring-blue-200'
                    : 'bg-gray-400 text-white'
                }`}
                aria-label={`Stage ${index + 1}: ${stages[index]}${index < currentStage ? ' (completed)' : index === currentStage ? ' (current)' : ''}`}
              >
                {index < currentStage ? (
                  <span>✓</span>
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
            </div>

            {/* Connecting Line (except for last stage) */}
            {index < stages.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 transition-smooth ${
                  index < currentStage ? 'bg-green-500' : 'bg-gray-300'
                }`}
                aria-hidden="true"
              ></div>
            )}
          </div>
        ))}
      </div>

      {/* Stage Labels */}
      <div className="flex items-center justify-between mt-3">
        {stages.map((stage, index) => (
          <div key={index} className="flex-1">
            <p
              className={`text-center text-xs font-semibold ${
                index === currentStage
                  ? 'text-blue-600'
                  : index < currentStage
                  ? 'text-green-600'
                  : 'text-gray-500'
              }`}
            >
              {stage}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
