import './globals.css';

export const metadata = {
  title: 'HiAlice — AI English Reading',
  description: 'AI-powered English reading companion for children aged 6-13',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#4A90D9" />
      </head>
      <body className="bg-background min-h-screen">
        <nav className="bg-white shadow-sm px-6 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary">📚 HiAlice</h1>
          <span className="text-sm text-gray-400">v1.0</span>
        </nav>
        <main className="max-w-4xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
