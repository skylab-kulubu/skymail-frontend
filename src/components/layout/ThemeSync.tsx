'use client';

import { useTheme } from '@skylab-kulubu/skylcn-ui';

/**
 * The inline script sets the theme before the first paint, but when React
 * renders the document itself (after a not-found or an error, for instance)
 * it resets the attributes on <html>. skylcn's useTheme writes the stored
 * choice back when it mounts, on every page, the sign-in screen included.
 */
export function ThemeSync() {
  useTheme();
  return null;
}
