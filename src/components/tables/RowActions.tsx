'use client';

import { Button } from '@skylab-kulubu/skylcn-ui';
import type { ReactNode } from 'react';

/** A row action's text link (Düzenle, Sürüm geçmişi): quiet until hovered, ringed on keyboard focus. */
export const ROW_ACTION_CLASS =
  'focus-visible:ring-ring cursor-pointer rounded-sm outline-hidden focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60';

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
    <div className="flex items-center gap-3">
      {children}
      {onArchive ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onArchive}
          className="hover:text-destructive"
          aria-label={`${target} arşivle`}
        >
          Arşivle
        </Button>
      ) : null}
      {onRestore ? (
        <Button variant="link" size="sm" onClick={onRestore} disabled={restoring} aria-label={`${target} geri al`}>
          {restoring ? 'Geri alınıyor…' : 'Geri al'}
        </Button>
      ) : null}
    </div>
  );
}
