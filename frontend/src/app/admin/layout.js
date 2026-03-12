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
    <div className="flex h-screen bg-[#F5F0E8]">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-[#3D6B3D] shadow-[4px_0_20px_rgba(61,46,30,0.15)] transition-all duration-300 flex flex-col`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-[#2E5230] flex items-center justify-between min-h-20 bg-[#2E5230]">
          <div className={`flex items-center gap-2 ${!sidebarOpen && 'justify-center w-full'}`}>
            <span className="text-2xl leaf-sway">🌿</span>
            {sidebarOpen && (
              <span className="font-extrabold text-white text-lg hidden md:inline">
                Admin
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:flex items-center justify-center p-2 hover:bg-[#3D6B3D] rounded-xl transition-all text-green-200"
            style={{ minWidth: '48px', minHeight: '48px' }}
          >
            {sidebarOpen ? '←' : '→'}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 space-y-1 px-3">
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold ${
                isActive(link.href)
                  ? 'bg-[#5C8B5C] text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
                  : 'text-green-100 hover:bg-[#4D7A4D]'
              }`}
              style={{ minHeight: '48px' }}
            >
              <span className="text-xl">{link.icon}</span>
              {sidebarOpen && (
                <span className="hidden md:inline text-sm">{link.label}</span>
              )}
            </Link>
          ))}
        </nav>

        {/* Back to App */}
        <div className="p-4 border-t border-[#2E5230]">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-green-200 hover:bg-[#4D7A4D] transition-all font-bold"
            style={{ minHeight: '48px' }}
          >
            <span className="text-xl">←</span>
            {sidebarOpen && (
              <span className="hidden md:inline text-sm">Back to App</span>
            )}
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-[#D6C9A8] shadow-[0_2px_12px_rgba(61,46,30,0.10)] px-6 py-4 border-b border-[#C4B49A] flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-[#3D2E1E]">
            <span className="mr-2">🌿</span>
            HiMax Admin Panel
          </h1>
          <span className="text-sm text-[#6B5744] font-semibold">v1.0</span>
        </div>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6 bg-[#F5F0E8]">
          {children}
        </main>
      </div>
    </div>
  );
}
