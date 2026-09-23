'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Tag } from '@/components/chrome/Tag';
import { formatDateTime } from '@/lib/format';
import {
  SYSTEM_TEMPLATE_NOTE,
  mainSourceLabel,
  type AuthoringMode,
  type TemplateActions,
  type TemplateRow,
} from '@/lib/templates';

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
      {actions.systemNote ? (
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
export function MainSource({ mode }: { mode: AuthoringMode | null }) {
  if (!mode) return <span className="text-neutral-500">{mainSourceLabel(null)}</span>;
  return (
    <span className="text-2xs inline-flex rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-neutral-300">
      {mainSourceLabel(mode)}
    </span>
  );
}
