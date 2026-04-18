import React from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex flex-col">
      {/* Top logo */}
      <header className="flex justify-center pt-10 pb-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-foreground font-bold text-lg tracking-tight"
        >
          <span className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
            LP
          </span>
          <span>LesPaniersDe</span>
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} LesPaniersDe &mdash; AGPL-3.0
      </footer>
    </div>
  );
}
