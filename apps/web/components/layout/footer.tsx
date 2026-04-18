import React from 'react';
import Link from 'next/link';
import { Github } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border bg-background/50 py-8 px-4 md:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-foreground font-bold">
          <span className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xs">LP</span>
          <span>LesPaniersDe</span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link
            href="https://github.com/antislash-studio/lespaniersde"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Github className="w-4 h-4" />
            GitHub
          </Link>
          <Link href="/legal/mentions" className="hover:text-foreground transition-colors">
            Mentions légales
          </Link>
          <Link href="/legal/privacy" className="hover:text-foreground transition-colors">
            Confidentialité
          </Link>
        </nav>

        <p className="text-xs text-muted-foreground/50">
          Licence AGPL-3.0 &mdash; Open source
        </p>
      </div>
    </footer>
  );
}
