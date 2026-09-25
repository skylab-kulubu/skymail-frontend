'use client';

import type { ReactNode } from 'react';

/** A row action's text button or link: quiet until hovered, ringed on keyboard focus. */
export const ROW_ACTION_CLASS =
  'focus-visible:ring-skylab-400/40 cursor-pointer rounded focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

/**
 * The actions at the end of a management list's row: whatever the page puts
 * first (Düzenle), then Arşivle and Geri al, each only when the page passes
 * its handler. `target` names the record for a screen reader, in the
 * accusative the labels need: “Beta” listesini, “Aylık bülten” Mail
 * template'ini.
 */
export function RowActions({
  target,
  onArchive,
  onRestore,
  restoring = false,
  children,
}: {
  target: string;
  onArchive?: () => void;
  onRestore?: () => void;
  restoring?: boolean;
  children?: ReactNode;
}) {
  if (!children && !onArchive && !onRestore) return null;
  return (
    <div className="flex gap-3">
      {children}
      {onArchive ? (
        <button
          type="button"
          onClick={onArchive}
          className={`${ROW_ACTION_CLASS} text-neutral-400 hover:text-red-300`}
          aria-label={`${target} arşivle`}
        >
          Arşivle
        </button>
      ) : null}
      {onRestore ? (
        <button
          type="button"
          onClick={onRestore}
          disabled={restoring}
          className={`${ROW_ACTION_CLASS} text-skylab-300 font-medium hover:underline`}
          aria-label={`${target} geri al`}
        >
          {restoring ? 'Geri alınıyor…' : 'Geri al'}
        </button>
      ) : null}
    </div>
  );
}
