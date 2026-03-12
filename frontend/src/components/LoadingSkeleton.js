'use client';

/**
 * Reusable skeleton loading components with shimmer animation
 * Used to display loading states while content is being fetched
 */

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-gray-200 rounded-lg overflow-hidden ${className}`}>
      <div className="animate-shimmer h-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]" />
      <div className="p-4 space-y-3">
        <div className="animate-shimmer h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] rounded w-3/4" />
        <div className="animate-shimmer h-3 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] rounded w-full" />
        <div className="animate-shimmer h-3 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] rounded w-5/6" />
      </div>
    </div>
  );
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`animate-shimmer h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] rounded ${
            i === lines - 1 ? 'w-5/6' : 'w-full'
          }`}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] ${className}`}
    />
  );
}

export function SkeletonChat({ variant = 'alice', className = '' }) {
  const alignClass = variant === 'alice' ? 'mr-auto' : 'ml-auto';
  const bgColor = variant === 'alice' ? 'bg-blue-100' : 'bg-green-100';

  return (
    <div className={`flex ${variant === 'alice' ? 'justify-start' : 'justify-end'} mb-4`}>
      <div className={`${alignClass} ${bgColor} rounded-lg p-4 max-w-xs`}>
        <div className="animate-shimmer h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] rounded w-48 mb-2" />
        <div className="animate-shimmer h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] rounded w-40" />
      </div>
    </div>
  );
}

export function PageLoader({ message = "Loading..." }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <div className="text-center">
        {/* HiMax Logo */}
        <div className="mb-8">
          <div className="text-6xl mb-4">📚</div>
          <h1 className="text-3xl font-bold text-primary mb-2">HiMax</h1>
          <p className="text-gray-600">Reading Companion</p>
        </div>

        {/* Spinner */}
        <div className="relative w-16 h-16 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary animate-spin" />
        </div>

        {/* Loading Message */}
        <p className="text-gray-600 text-lg font-medium">{message}</p>

        {/* Subtext */}
        <p className="text-gray-400 text-sm mt-4">
          Getting things ready for you...
        </p>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 4, className = '' }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
