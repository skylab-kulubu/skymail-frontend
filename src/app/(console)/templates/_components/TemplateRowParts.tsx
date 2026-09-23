'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Tag } from '@/components/chrome/Tag';
import { formatDateTime } from '@/lib/format';
import { SYSTEM_TEMPLATE_NOTE, type TemplateActions, type TemplateRow } from '@/lib/templates';

const ACTION_CLASS =
  'focus-visible:ring-skylab-400/40 cursor-pointer rounded focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

/**
 * The name, the System and Arşivli tags beside it, and under it the Template
 * key and either why a System template is never archived or when the template
 * was archived. Written out, not in a tooltip, so it reads on a phone and to a
 * keyboard.
 */
export function TemplateName({ row, actions }: { row: TemplateRow; actions: TemplateActions }) {
  return (
    <div className="min-w-0 whitespace-normal">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {actions.href ? (
          <Link href={actions.href} className="hover:text-skylab-300 font-medium break-words text-neutral-100 hover:underline">
            {row.name}
          </Link>
        ) : (
          <span className="font-medium break-words text-neutral-300">{row.name}</span>
        )}
        {row.system ? <Tag tone="system">System</Tag> : null}
        {row.archivedAt ? <Tag tone="archived">Arşivli</Tag> : null}
      </div>
      {row.key ? (
        <p className="text-2xs mt-0.5 font-mono break-all text-neutral-400">
          <span className="sr-only">Template key: </span>
          {row.key}
        </p>
      ) : null}
      {actions.systemProtected ? (
        <p className="mt-0.5 flex items-start gap-1.5 text-xs text-neutral-500">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          {SYSTEM_TEMPLATE_NOTE}
        </p>
      ) : null}
      {row.archivedAt ? (
        <p className="mt-0.5 text-xs text-neutral-500">Arşivlendi: {formatDateTime(row.archivedAt)}</p>
      ) : null}
    </div>
  );
}

/** The Authoring mode of the Main source: what the template sends is written in it. */
export function MainSource({ label }: { label: string | null }) {
  if (!label) {
    return (
      <span className="text-neutral-500" title="Yayımlanmış sürümü yok">
        —
      </span>
    );
  }
  return (
    <span className="text-2xs inline-flex rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-neutral-300">
      {label}
    </span>
  );
}

export function RowActions({
  row,
  actions,
  restoring,
  onArchive,
  onRestore,
}: {
  row: TemplateRow;
  actions: TemplateActions;
  restoring: boolean;
  onArchive: () => void;
  onRestore: () => void;
}) {
  if (!actions.archive && !actions.restore) return null;
  return (
    <div className="flex gap-3 text-sm">
      {actions.archive ? (
        <button
          type="button"
          onClick={onArchive}
          className={`${ACTION_CLASS} text-neutral-400 hover:text-red-300`}
          aria-label={`“${row.name}” Mail template'ini arşivle`}
        >
          Arşivle
        </button>
      ) : null}
      {actions.restore ? (
        <button
          type="button"
          onClick={onRestore}
          disabled={restoring}
          className={`${ACTION_CLASS} text-skylab-300 font-medium hover:underline`}
          aria-label={`“${row.name}” Mail template'ini geri al`}
        >
          {restoring ? 'Geri alınıyor…' : 'Geri al'}
        </button>
      ) : null}
    </div>
  );
}
