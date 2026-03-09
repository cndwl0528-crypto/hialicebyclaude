'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import './globals.css';

export default function RootLayout({ children }) {
  const pathname = usePathname();

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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#4A90D9" />
        <title>HiAlice — AI English Reading</title>
        <meta name="description" content="AI-powered English reading companion for children aged 6-13" />
      </head>
      <body className="bg-background min-h-screen">
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
      </body>
    </html>
  );
}
