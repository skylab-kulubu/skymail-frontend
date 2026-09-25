'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { applyTheme, currentTheme, type Theme } from '@/lib/theme';

/** Switches between the light and dark theme; the choice is kept in this browser. */
export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  const next: Theme = theme === 'light' ? 'dark' : 'light';
  const label = next === 'light' ? 'Açık temaya geç' : 'Koyu temaya geç';
  const Icon = next === 'light' ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
      aria-label={label}
      title={collapsed ? label : undefined}
      className={`focus-visible:ring-skylab-400/40 flex min-h-9 w-full items-center rounded-md py-2 text-sm text-neutral-400 hover:bg-white/5 hover:text-neutral-100 focus-visible:ring-2 focus-visible:outline-none ${
        collapsed ? 'justify-center px-1' : 'gap-3 px-2'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {collapsed ? null : <span>{next === 'light' ? 'Açık tema' : 'Koyu tema'}</span>}
    </button>
  );
}
