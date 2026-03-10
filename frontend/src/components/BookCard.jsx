'use client';

export default function BookCard({ book, onClick }) {
  const LEVEL_COLORS = {
    Beginner: '#D94878',
    Intermediate: '#2E6BBF',
    Advanced: '#1E8449',
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      aria-label={`Read ${book.title} by ${book.author}`}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-smooth cursor-pointer overflow-hidden focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
    >
      <div className="bg-gray-100 p-6 flex items-center justify-center min-h-[200px]">
        <div className="text-6xl text-center" role="img" aria-label={`${book.title} cover`}>{book.cover}</div>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-gray-800 text-lg mb-1 line-clamp-2">
          {book.title}
        </h3>
        <p className="text-gray-600 text-sm mb-3">{book.author}</p>

        <div className="flex items-center justify-between">
          <span
            className="px-3 py-1 rounded-full text-white text-xs font-semibold"
            style={{ backgroundColor: LEVEL_COLORS[book.level] }}
          >
            {book.level}
          </span>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {book.genre}
          </span>
        </div>

        <p className="text-gray-600 text-xs mt-3 line-clamp-2">
          {book.description}
        </p>
      </div>

      <div className="px-4 pb-4">
        <button className="w-full py-2 px-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-smooth text-sm font-semibold">
          Read Now
        </button>
      </div>
    </div>
  );
}
