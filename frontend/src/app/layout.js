'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ErrorBoundary from '@/components/ErrorBoundary';
import OfflineBanner from '@/components/OfflineBanner';
import { clearClientSession, getCurrentUser, logout } from '@/services/api';
import { getItem, setItem, hydrateSessionFromLocal } from '@/lib/clientStorage';
import './globals.css';

export default function RootLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navReady, setNavReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState('');

  // Register service worker for PWA/offline support — production only.
  // Skipping in development prevents the SW from caching webpack hot-update
  // chunks and serving stale builds after a Next.js rebuild.
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().catch((error) => {
            console.warn('ServiceWorker cleanup failed:', error);
          });
        });
      });
      return;
    }

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

  // Track whether the initial hydration pass has completed.
  const [initialReady, setInitialReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setInitialReady(true);
  }, []);

  // Check login state and role on route change
  useEffect(() => {
    if (typeof window === 'undefined' || !initialReady) return;

    hydrateSessionFromLocal();

    const token = getItem('token');
    if (!token) {
      setIsLoggedIn(false);
      setUserRole(null);
      setUserName('');
      setNavReady(true);
      return;
    }

    const isDemoOrMockToken =
      ['demo-token', 'mock-token-', 'student-session-'].some((prefix) =>
        token.startsWith(prefix)
      );

    setIsLoggedIn(true);
    setUserRole(getItem('userRole'));
    setUserName(getItem('studentName') || getItem('parentEmail') || '');
    setNavReady(true);

    // Demo/mock tokens are not real JWTs — skip server-side validation.
    if (isDemoOrMockToken) {
      return;
    }

    let cancelled = false;

    getCurrentUser()
      .then((result) => {
        if (cancelled) return;

        const role =
          result?.student ? 'student'
          : result?.parent ? 'parent'
          : getItem('userRole');

        if (role) {
          setUserRole(role);
          setItem('userRole', role);
        }
      })
      .catch(() => {
        if (cancelled) return;
        clearClientSession();
        setIsLoggedIn(false);
        setUserRole(null);
        setUserName('');
        if (!['/', '/login', '/consent', '/privacy-policy'].includes(pathname)) {
          router.replace('/login');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router, initialReady]);

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

  const isTeacherOrAdmin =
    userRole === 'teacher' ||
    userRole === 'admin' ||
    userRole === 'super_admin';

  const navLinks = [
    ...(isLoggedIn
      ? [
          { href: '/books', label: 'Start', icon: '🚀' },
          { href: '/review', label: 'Studio', icon: '⭐' },
          { href: '/vocabulary', label: 'Words', icon: '📖' },
          { href: '/library', label: 'Library', icon: '📚' },
          { href: '/profile', label: 'Profile', icon: '👤' },
        ]
      : [{ href: '/?landing=1', label: 'Home', icon: '🏠' }]),
    // Only shown when the logged-in user has a parent or admin role.
    ...(isParentOrAdmin ? [{ href: '/parent', label: 'Parent', icon: '👪' }] : []),
    // Only shown when the logged-in user has a teacher or admin role.
    ...(isTeacherOrAdmin ? [{ href: '/teacher', label: 'Class', icon: '📚' }] : []),
  ];

  const mobileNavLinks = isLoggedIn
    ? isTeacherOrAdmin
      ? [
          { href: '/books', label: 'Start', icon: '🚀' },
          { href: '/review', label: 'Studio', icon: '⭐' },
          { href: '/vocabulary', label: 'Words', icon: '📖' },
          { href: '/library', label: 'Library', icon: '📚' },
          { href: '/teacher', label: 'Class', icon: '📚' },
        ]
      : isParentOrAdmin
      ? [
          { href: '/books', label: 'Start', icon: '🚀' },
          { href: '/review', label: 'Studio', icon: '⭐' },
          { href: '/vocabulary', label: 'Words', icon: '📖' },
          { href: '/library', label: 'Library', icon: '📚' },
          { href: '/parent', label: 'Parent', icon: '👪' },
        ]
      : [
          { href: '/books', label: 'Start', icon: '🚀' },
          { href: '/review', label: 'Studio', icon: '⭐' },
          { href: '/vocabulary', label: 'Words', icon: '📖' },
          { href: '/library', label: 'Library', icon: '📚' },
        ]
    : [
        { href: '/?landing=1', label: 'Home', icon: '🏠' },
        { href: '/login', label: 'Login', icon: '🔐' },
      ];

  const logoHref = '/?landing=1';
  const logoText = 'HiMax';
  const logoEmoji = '🌿';

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#5C8B5C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HiMax" />
        <meta name="apple-mobile-web-app-icon" content="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect fill='%235C8B5C' width='64' height='64'/><text x='50%' y='50%' font-size='40' dominant-baseline='middle' text-anchor='middle' fill='white'>🌿</text></svg>" />
        <title>HiMax — AI English Reading</title>
        <meta name="description" content="AI-powered English reading companion for children aged 6-13" />
      </head>
      <body className="bg-[#F5F0E8] min-h-screen font-nunito" suppressHydrationWarning>
        <ErrorBoundary>
          <OfflineBanner />

          {/* Top Navigation */}
          <nav suppressHydrationWarning aria-label="Primary navigation" className="bg-[#D6C9A8] shadow-[0_2px_12px_rgba(61,46,30,0.10)] px-4 sm:px-6 py-3 flex items-center justify-between ghibli-bg sticky top-0 z-40">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href={logoHref}
                className="text-xl font-extrabold text-[#3D6B3D] hover:text-[#5C8B5C] transition-colors flex-shrink-0 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[#5C8B5C] rounded-lg px-1"
              >
                <span className="leaf-sway inline-block" suppressHydrationWarning>{logoEmoji}</span>
                <span>{logoText}</span>
              </Link>
              {navReady && (
                <div className="hidden md:flex gap-1 flex-wrap">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={pathname === link.href ? 'page' : undefined}
                      className={`px-3 py-2 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#5C8B5C] ${
                        pathname === link.href
                          ? 'bg-[#3D6B3D] text-white shadow-[0_2px_8px_rgba(61,107,61,0.5)]'
                          : 'text-[#3D2E1E] hover:bg-[#B8CEB8]'
                      }`}
                    >
                      <span aria-hidden="true" suppressHydrationWarning>{link.icon}</span>{' '}{link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {!navReady ? null : isLoggedIn ? (
                <>
                  <div className="hidden sm:flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#7AC87A] flex-shrink-0" aria-hidden="true" />
                    <span className="text-xs text-[#3D2E1E] font-bold truncate max-w-[96px]">
                      {userName}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D6E9D6] text-[#3D2E1E] font-bold border border-[#A5D6A7]">
                      {userRole === 'parent' ? 'Parent' : 'Student'}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-xs px-3 py-2 min-h-[36px] rounded-xl bg-[#EDE5D4] text-[#6B5744] hover:bg-[#D4736B] hover:text-white font-bold transition-all focus-visible:ring-2 focus-visible:ring-[#D4736B]"
                    aria-label="Log out of HiMax"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="text-xs px-4 py-2 min-h-[36px] rounded-xl bg-[#5C8B5C] text-white font-bold hover:bg-[#3D6B3D] transition-all focus-visible:ring-2 focus-visible:ring-[#3D6B3D] flex items-center"
                >
                  Login
                </Link>
              )}
            </div>
          </nav>

          {/* Mobile Bottom Navigation */}
          {navReady && (
            <nav suppressHydrationWarning aria-label="Mobile navigation" className="md:hidden fixed bottom-0 left-0 right-0 bg-[#D6C9A8]/95 backdrop-blur border-t-2 border-[#C4B49A] flex gap-0.5 px-1 pt-1.5 z-40 shadow-[0_-4px_20px_rgba(61,46,30,0.12)]" style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}>
              {mobileNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-label={link.label}
                  aria-current={pathname === link.href ? 'page' : undefined}
                  className={`flex-1 min-h-[52px] flex flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 rounded-xl font-bold transition-all duration-150 active:scale-95 ${
                    pathname === link.href
                      ? 'bg-[#5C8B5C] text-white shadow-[0_2px_8px_rgba(92,139,92,0.4)]'
                      : 'text-[#3D2E1E] hover:bg-[#C8DBC8] active:bg-[#B8CEB8]'
                  }`}
                >
                  <span className="text-lg leading-none" aria-hidden="true" suppressHydrationWarning>{link.icon}</span>
                  <span className="text-[10px] xs:text-xs leading-none font-bold tracking-tight">{link.label}</span>
                </Link>
              ))}
            </nav>
          )}

          <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-32 md:pb-8">
            {children}
          </main>
        </ErrorBoundary>
      </body>
    </html>
  );
}
