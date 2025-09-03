import './globals.css';
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <header className="mb-6 flex items-center gap-3">
            <img src="/logo.svg" className="h-8" alt="QUIZZR" />
            <div className="text-sm text-slate-500">Canvas-friendly Quiz Generator</div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
