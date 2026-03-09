'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import ErrorBoundary from '@/components/ErrorBoundary';
import OfflineBanner from '@/components/OfflineBanner';
import './globals.css';

export default function RootLayout({ children }) {
  const pathname = usePathname();

  // Register service worker for offline support and PWA
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('ServiceWorker registered successfully:', registration);
        })
        .catch((error) => {
          console.warn('ServiceWorker registration failed:', error);
        });
    }
  }, []);

  const navLinks = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/books', label: 'Books', icon: '📚' },
    { href: '/review', label: 'Review', icon: '⭐' },
    { href: '/vocabulary', label: 'Vocabulary', icon: '📖' },
    { href: '/profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#4A90D9" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HiAlice" />
        <meta name="apple-mobile-web-app-icon" content="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect fill='%234A90D9' width='64' height='64'/><text x='50%' y='50%' font-size='40' dominant-baseline='middle' text-anchor='middle' fill='white'>📚</text></svg>" />
        <title>HiAlice — AI English Reading</title>
        <meta name="description" content="AI-powered English reading companion for children aged 6-13" />
      </head>
      <body className="bg-background min-h-screen">
        <ErrorBoundary>
          <OfflineBanner />
          <nav className="bg-white shadow-sm px-4 sm:px-6 py-3 flex items-center justify-between overflow-x-auto">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold text-primary hover:text-blue-600 transition-colors flex-shrink-0">
              📚 HiAlice
            </Link>
            <div className="hidden md:flex gap-2">
              {navLinks.slice(1).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    pathname === link.href
                      ? 'bg-primary text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {link.icon} {link.label}
                </Link>
              ))}
            </div>
          </div>
          <span className="text-sm text-gray-400 flex-shrink-0">v1.0</span>
        </nav>

        {/* Mobile Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex gap-1 px-2 py-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 px-3 py-2 text-center text-xs rounded-lg font-semibold transition-all ${
                pathname === link.href
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="text-lg mb-1">{link.icon}</div>
              {link.label}
            </Link>
          ))}
        </div>

          <main className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-6">
            {children}
          </main>
        </ErrorBoundary>
      </body>
    </html>
  );
}
