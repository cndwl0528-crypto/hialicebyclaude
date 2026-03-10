'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ErrorBoundary from '@/components/ErrorBoundary';
import OfflineBanner from '@/components/OfflineBanner';
import { logout } from '@/services/api';
import './globals.css';

export default function RootLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);

  // Register service worker for PWA/offline support — production only.
  // Skipping in development prevents the SW from caching webpack hot-update
  // chunks and serving stale builds after a Next.js rebuild.
  useEffect(() => {
    if (
      process.env.NODE_ENV === 'production' &&
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('ServiceWorker registered:', registration.scope);
        })
        .catch((error) => {
          console.warn('ServiceWorker registration failed:', error);
        });
    }
  }, []);

  // Check login state and role on route change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = sessionStorage.getItem('token');
      setIsLoggedIn(!!token);
      setUserRole(sessionStorage.getItem('userRole'));
    }
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.warn('Logout error:', e);
    } finally {
      setIsLoggedIn(false);
      router.push('/');
    }
  };

  const isParentOrAdmin =
    userRole === 'parent' ||
    userRole === 'admin' ||
    userRole === 'super_admin';

  const navLinks = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/books', label: 'Books', icon: '📚' },
    { href: '/review', label: 'Review', icon: '⭐' },
    { href: '/vocabulary', label: 'Words', icon: '📖' },
    { href: '/profile', label: 'Profile', icon: '👤' },
    // Only shown when the logged-in user has a parent or admin role.
    ...(isParentOrAdmin ? [{ href: '/parent', label: 'Parent', icon: '👪' }] : []),
  ];

  const logoText = 'HiAlice';
  const logoEmoji = '🌿';

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#5C8B5C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HiAlice" />
        <meta name="apple-mobile-web-app-icon" content="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect fill='%235C8B5C' width='64' height='64'/><text x='50%' y='50%' font-size='40' dominant-baseline='middle' text-anchor='middle' fill='white'>🌿</text></svg>" />
        {/* Font optimisation: preconnect + preload the stylesheet as a high-priority resource.
            next/font/google would be ideal here but requires a Server Component root layout;
            the current layout is 'use client' so we optimise the Google Fonts request instead. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Preload the font CSS so the browser fetches it before layout paint */}
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Quicksand:wght@400;500;600;700&display=swap"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Quicksand:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <title>HiAlice — AI English Reading</title>
        <meta name="description" content="AI-powered English reading companion for children aged 6-13" />
      </head>
      <body className="bg-[#F5F0E8] min-h-screen font-nunito" suppressHydrationWarning>
        <ErrorBoundary>
          <OfflineBanner />

          {/* Top Navigation */}
          <nav suppressHydrationWarning className="bg-[#D6C9A8] shadow-[0_2px_12px_rgba(61,46,30,0.10)] px-4 sm:px-6 py-3 flex items-center justify-between overflow-x-auto ghibli-bg sticky top-0 z-40">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-xl font-extrabold text-[#3D6B3D] hover:text-[#5C8B5C] transition-colors flex-shrink-0 flex items-center gap-1"
              >
                <span className="leaf-sway inline-block" suppressHydrationWarning>{logoEmoji}</span>
                <span>{logoText}</span>
              </Link>
              <div className="hidden md:flex gap-1">
                {navLinks.slice(1).map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 ${
                      pathname === link.href
                        ? 'bg-[#5C8B5C] text-white shadow-[0_2px_8px_rgba(92,139,92,0.4)]'
                        : 'text-[#3D2E1E] hover:bg-[#C8DBC8]'
                    }`}
                  >
                    <span aria-hidden="true" suppressHydrationWarning>{link.icon}</span>{' '}{link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-xs text-[#9B8777] font-semibold">v1.0</span>
              {isLoggedIn && (
                <button
                  onClick={handleLogout}
                  className="text-xs px-3 py-1.5 rounded-xl bg-[#C8DBC8] text-[#3D6B3D] hover:bg-[#D4736B] hover:text-white font-bold transition-all"
                  title="Log out"
                >
                  Log out
                </button>
              )}
            </div>
          </nav>

          {/* Mobile Bottom Navigation */}
          <div suppressHydrationWarning className="md:hidden fixed bottom-0 left-0 right-0 bg-[#D6C9A8] border-t border-[#C4B49A] flex gap-1 px-2 py-2 z-40 shadow-[0_-4px_20px_rgba(61,46,30,0.10)]">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex-1 px-2 py-2 text-center text-xs rounded-xl font-bold transition-all ${
                  pathname === link.href
                    ? 'bg-[#5C8B5C] text-white shadow-[0_2px_8px_rgba(92,139,92,0.4)]'
                    : 'text-[#3D2E1E] hover:bg-[#C8DBC8]'
                }`}
              >
                <div className="text-lg mb-0.5" aria-hidden="true" suppressHydrationWarning>{link.icon}</div>
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
