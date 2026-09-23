'use client';

import { useSyncExternalStore } from 'react';
import { currentTheme, type Theme } from '@/lib/theme';

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

/** The panel's theme as it is now, following the theme toggle. */
export function useDocumentTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => 'dark');
}
