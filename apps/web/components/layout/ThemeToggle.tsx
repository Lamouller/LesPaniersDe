'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

type ThemeMode = 'system' | 'light' | 'dark';

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else if (mode === 'light') {
    root.classList.remove('dark');
  } else {
    // system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as ThemeMode | null;
    const initial = stored ?? 'system';
    setMode(initial);
    applyTheme(initial);

    if (initial === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, []);

  function cycleTheme() {
    const next: ThemeMode = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
    setMode(next);
    localStorage.setItem('theme', next);
    applyTheme(next);

    if (next === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
    }
  }

  const icons = {
    system: <Monitor className="w-4 h-4" />,
    light: <Sun className="w-4 h-4" />,
    dark: <Moon className="w-4 h-4" />,
  };

  const labels = {
    system: 'Système',
    light: 'Clair',
    dark: 'Sombre',
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`Thème actuel : ${labels[mode]}. Cliquer pour changer.`}
      title={`Thème : ${labels[mode]}`}
      className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-neutral-50 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    >
      {icons[mode]}
    </button>
  );
}
