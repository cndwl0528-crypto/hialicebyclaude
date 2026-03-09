'use client';

export default function BookCard({ book, onClick }) {
  const LEVEL_COLORS = {
    Beginner: '#FF6B9D',
    Intermediate: '#4A90D9',
    Advanced: '#27AE60',
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-smooth cursor-pointer overflow-hidden"
    >
      <div className="bg-gray-100 p-6 flex items-center justify-center min-h-[200px]">
        <div className="text-6xl text-center">{book.cover}</div>
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
