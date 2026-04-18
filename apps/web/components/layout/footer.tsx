import React from 'react';
import Link from 'next/link';
import { Github } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-neutral-950/50 py-8 px-4 md:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-neutral-50 font-bold">
          <span className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xs">LP</span>
          <span>LesPaniersDe</span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-neutral-400">
          <Link
            href="https://github.com/antislash-studio/lespaniersde"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-neutral-200 transition-colors"
          >
            <Github className="w-4 h-4" />
            GitHub
          </Link>
          <Link href="/legal/mentions" className="hover:text-neutral-200 transition-colors">
            Mentions légales
          </Link>
          <Link href="/legal/privacy" className="hover:text-neutral-200 transition-colors">
            Confidentialité
          </Link>
        </nav>

        <p className="text-xs text-neutral-600">
          Licence AGPL-3.0 &mdash; Open source
        </p>
      </div>
    </footer>
  );
}
