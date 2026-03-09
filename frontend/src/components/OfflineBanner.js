'use client';

import { useEffect, useState } from 'react';

/**
 * OfflineBanner Component
 * Displays a banner when the user is offline
 * Auto-hides when connectivity is restored
 */

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Set initial state after mount (browser-only)
    setMounted(true);
    setIsOnline(navigator.onLine);

    // Handle online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Don't render until mounted (to avoid hydration mismatch)
  if (!mounted || isOnline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-400 text-gray-900 px-4 py-3 shadow-lg">
      <div className="max-w-4xl mx-auto flex items-center gap-3">
        <span className="text-xl">📡</span>
        <div>
          <p className="font-semibold">You're offline!</p>
          <p className="text-sm text-gray-800">
            No worries! You can still review what you've already loaded. We'll sync when you're back online.
          </p>
        </div>
      </div>
    </div>
  );
}
