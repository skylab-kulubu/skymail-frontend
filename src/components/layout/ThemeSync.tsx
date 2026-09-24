'use client';

import { useEffect } from 'react';
import { preferredTheme } from '@/lib/theme';

/**
 * The inline script sets the theme before the first paint, but when React
 * renders the document itself (after a not-found or an error, for instance)
 * it resets the attributes on <html>. Put the theme back afterwards.
 */
export function ThemeSync() {
  useEffect(() => {
    document.documentElement.dataset.theme = preferredTheme();
  }, []);
  return null;
}
