'use client';

import { useEffect, useState } from 'react';
import type { NoticeData } from './Notice';

/**
 * A notice for the page an action navigates to — "created", "archived" — kept
 * in memory for the next client-side navigation only, so a refresh does not
 * repeat it and the address stays clean.
 */
let pending: { path: string; notice: NoticeData } | null = null;

export function flashNotice(path: string, notice: NoticeData): void {
  pending = { path, notice };
}

/** The notice left for `path`, if any; it is shown once. */
export function useFlashNotice(path: string): [NoticeData | null, (notice: NoticeData | null) => void] {
  // Read in the initialiser, cleared in an effect: StrictMode runs the
  // initialiser twice, and both runs must see the notice.
  const [notice, setNotice] = useState<NoticeData | null>(() =>
    pending?.path === path ? pending.notice : null,
  );
  useEffect(() => {
    if (pending?.path === path) pending = null;
  }, [path]);
  return [notice, setNotice];
}
