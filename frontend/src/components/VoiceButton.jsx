'use client';

export default function VoiceButton({
  isListening = false,
  onStart = () => {},
  onStop = () => {},
  size = 80,
  disabled = false,
}) {
  const handleClick = () => {
    if (disabled) return;
    if (isListening) {
      onStop?.();
    } else {
      onStart?.();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      aria-label={isListening ? 'Stop listening' : 'Start listening'}
      aria-pressed={isListening}
      className={`relative flex items-center justify-center rounded-full transition-all duration-200 focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-[#3D6B3D] ${
        isListening
          ? 'bg-[#D4736B] hover:bg-[#C0625A] animate-pulse'
          : 'bg-[#5C8B5C] hover:bg-[#3D6B3D]'
      } text-white shadow-[0_14px_30px_rgba(61,46,30,0.16)] hover:shadow-[0_18px_34px_rgba(61,46,30,0.2)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: '64px',
        minHeight: '64px',
        backgroundImage: isListening
          ? 'linear-gradient(180deg, #E28A84 0%, #D4736B 100%)'
          : 'linear-gradient(180deg, #7AAE7A 0%, #5C8B5C 100%)',
      }}
      title={isListening ? 'Stop listening' : 'Start listening'}
    >
      {!isListening && (
        <div
          aria-hidden="true"
          className="absolute -inset-2 rounded-full border border-[#7AC87A]/45"
        />
      )}
      <svg
        aria-hidden="true"
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
          aria-hidden="true"
          className="absolute inset-0 rounded-full border-4 border-[#D4736B] animate-ping"
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
