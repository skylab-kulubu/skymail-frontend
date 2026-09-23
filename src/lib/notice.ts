'use client';

import { useEffect, useState } from 'react';

/**
 * The outcome of an action, as a page says it (`components/chrome/Notice`):
 * a success as a success, an error as the API's Turkish sentence, and a
 * success with something left undone — an approval request no approver was
 * told of — as a warning.
 */
export type NoticeData = Readonly<{
  tone: 'success' | 'warning' | 'error';
  text: string;
  /** An archived record — a mailing list, a Mail template — the notice can bring back ("Geri al"). */
  restore?: Readonly<{ id: string; name: string }>;
}>;

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
