'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

const navLinks = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/books', label: 'Library', icon: '📚' },
  { href: '/review', label: 'Review', icon: '⭐' },
  { href: '/vocabulary', label: 'Words', icon: '📖' },
  { href: '/profile', label: 'Profile', icon: '👤' },
];

export default function NavBar() {
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

  return (
    <>
      {/* Skip to main content */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:text-blue-700 focus:underline">
        Skip to main content
      </a>
      {/* Top Navigation */}
      <nav aria-label="Main navigation" className="bg-[#D6C9A8] shadow-[0_2px_12px_rgba(61,46,30,0.10)] px-4 sm:px-6 py-3 flex items-center justify-between overflow-x-auto ghibli-bg sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-xl font-extrabold text-[#3D6B3D] hover:text-[#5C8B5C] transition-colors flex-shrink-0 flex items-center gap-1"
          >
            <span className="leaf-sway inline-block">🌿</span>
            <span>HiAlice</span>
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
                {link.icon} {link.label}
              </Link>
            ))}
          </div>
        </div>
        <span className="text-xs text-[#6B5744] flex-shrink-0 font-semibold">v1.0</span>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav aria-label="Mobile navigation" className="md:hidden fixed bottom-0 left-0 right-0 bg-[#D6C9A8] border-t border-[#C4B49A] flex gap-1 px-2 py-2 z-40 shadow-[0_-4px_20px_rgba(61,46,30,0.10)]">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-label={link.label}
            className={`flex-1 px-2 py-3 text-center text-xs rounded-xl font-bold transition-all min-h-[48px] ${
              pathname === link.href
                ? 'bg-[#5C8B5C] text-white shadow-[0_2px_8px_rgba(92,139,92,0.4)]'
                : 'text-[#3D2E1E] hover:bg-[#C8DBC8]'
            }`}
          >
            <div className="text-lg mb-0.5">{link.icon}</div>
            {link.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
