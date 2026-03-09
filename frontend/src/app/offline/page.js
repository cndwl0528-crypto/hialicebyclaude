'use client';

import { useEffect, useState } from 'react';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check current online status
    setIsOnline(navigator.onLine);

    // Listen for online event
    const handleOnline = () => {
      setIsOnline(true);
      // Optionally redirect back to home after coming online
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const handleRetry = () => {
    if (navigator.onLine) {
      window.location.href = '/';
    } else {
      // Stay on this page and let user wait
      alert('Still offline. Please check your connection and try again.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {/* Offline Icon */}
        <div className="text-7xl mb-6">📡</div>

        {/* Header */}
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          You're Offline
        </h1>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          No worries! HiAlice is still here. You can review books you've already
          loaded, or come back when you have an internet connection.
        </p>

        {/* What You Can Do */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
          <p className="font-semibold text-gray-800 mb-3">While offline you can:</p>
          <ul className="text-sm text-gray-700 space-y-2">
            <li>✓ Review your vocabulary</li>
            <li>✓ Look at completed sessions</li>
            <li>✓ Check your reading progress</li>
          </ul>
        </div>

        {/* Status */}
        {isOnline && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-700 font-semibold">
              ✓ You're back online!
            </p>
            <p className="text-sm text-green-600">
              Redirecting in a moment...
            </p>
          </div>
        )}

        {/* Try Again Button */}
        <button
          onClick={handleRetry}
          className={`w-full font-bold py-3 px-6 rounded-lg transition-colors ${
            isOnline
              ? 'bg-success text-white hover:bg-green-600'
              : 'bg-primary text-white hover:bg-blue-700'
          }`}
        >
          {isOnline ? '✓ Go Home' : 'Try Again'}
        </button>

        {/* Friendly Note */}
        <p className="text-xs text-gray-400 mt-6">
          🎓 Tip: Make sure your WiFi or mobile data is connected!
        </p>
      </div>
    </div>
  );
}
