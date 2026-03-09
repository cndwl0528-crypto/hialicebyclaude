'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const adminLinks = [
    { href: '/admin', label: 'Dashboard', icon: '📊' },
    { href: '/admin/students', label: 'Students', icon: '👨‍🎓' },
    { href: '/admin/books', label: 'Books', icon: '📚' },
    { href: '/admin/reports', label: 'Reports', icon: '📈' },
    { href: '/admin/prompts', label: 'AI Prompts', icon: '🤖' },
  ];

  const isActive = (href) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white shadow-lg transition-all duration-300 flex flex-col`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between min-h-20">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center w-full'}`}>
            <span className="text-2xl">⚙️</span>
            {sidebarOpen && <span className="font-bold text-primary hidden md:inline">Admin</span>}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:block p-2 hover:bg-gray-100 rounded-lg transition-all"
            style={{ minWidth: '48px', minHeight: '48px' }}
          >
            {sidebarOpen ? '←' : '→'}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 space-y-2 px-3">
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive(link.href)
                  ? 'bg-blue-100 text-primary font-semibold'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              style={{ minHeight: '48px' }}
            >
              <span className="text-xl">{link.icon}</span>
              {sidebarOpen && <span className="hidden md:inline text-sm">{link.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Back to App */}
        <div className="p-4 border-t border-gray-200">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-all"
            style={{ minHeight: '48px' }}
          >
            <span className="text-xl">←</span>
            {sidebarOpen && <span className="hidden md:inline text-sm">Back to App</span>}
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white shadow-sm px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">HiAlice Admin Panel</h1>
          <span className="text-sm text-gray-500">v1.0</span>
        </div>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>

      {/* Mobile Sidebar Toggle */}
      <style jsx>{`
        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            height: 100%;
            z-index: 40;
          }
        }
      `}</style>
    </div>
  );
}
