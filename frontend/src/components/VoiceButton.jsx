'use client';

export default function VoiceButton({
  isListening = false,
  onStart = () => {},
  onStop = () => {},
  size = 80,
}) {
  const handleClick = () => {
    if (isListening) {
      onStop?.();
    } else {
      onStart?.();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`relative flex items-center justify-center rounded-full transition-smooth ${
        isListening
          ? 'bg-red-500 hover:bg-red-600 pulse'
          : 'bg-blue-500 hover:bg-blue-600'
      } text-white shadow-lg hover:shadow-xl active:scale-95`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: '64px',
        minHeight: '64px',
      }}
      title={isListening ? 'Stop listening' : 'Start listening'}
    >
      <svg
        width={Math.floor(size * 0.5)}
        height={Math.floor(size * 0.5)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 1a3 3 0 0 0-3 3v12a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
      </svg>

      {isListening && (
        <div
          className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            opacity: 0.75,
          }}
        ></div>
      )}
    </button>
  );
}
