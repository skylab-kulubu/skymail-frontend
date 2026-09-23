'use client';

import { useId, useState } from 'react';
import { ChevronDown, PenLine } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import type { DraftAuthor, DraftIndicator as DraftIndicatorData } from '@/lib/templates';

/** Marks the viewer's own draft. */
function MineMark() {
  return (
    <span className="bg-skylab-500/15 text-skylab-300 text-3xs shrink-0 rounded px-1 py-px font-medium tracking-wider uppercase">
      Senin
    </span>
  );
}

function describe(author: DraftAuthor): string {
  return `${author.name}${author.mine ? ' (senin)' : ''}, ${formatDateTime(author.writtenAt)}`;
}

/**
 * Who has an unpublished draft of the template. One author is named on the
 * row. Several are counted ("2 taslak"), and their names open on a tap, or a
 * click or Enter, in the row itself, so a phone reads them too; a pointer
 * also gets them, with the times, on hover.
 */
export function DraftIndicator({ drafts }: { drafts: DraftIndicatorData }) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  if (drafts.authors.length === 1) {
    const [author] = drafts.authors;
    return (
      <span
        className="inline-flex max-w-full items-center gap-1.5 text-xs text-amber-300"
        title={`Yayımlanmamış taslak: ${describe(author)}`}
      >
        <PenLine className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">
          {/* The table's column already says Taslak; a phone's stacked row does not. */}
          <span className="md:hidden">Taslak: </span>
          {author.name}
        </span>
        {author.mine ? <MineMark /> : null}
      </span>
    );
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        title={`Yayımlanmamış taslaklar:\n${drafts.authors.map(describe).join('\n')}`}
        className="focus-visible:ring-skylab-400/40 inline-flex cursor-pointer items-center gap-1.5 rounded text-xs text-amber-300 hover:underline focus-visible:ring-2 focus-visible:outline-none"
      >
        <PenLine className="h-3 w-3 shrink-0" aria-hidden />
        <span>
          {drafts.summary}
          {drafts.mine ? ' · biri senin' : ''}
        </span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <ul
        id={listId}
        hidden={!open}
        aria-label="Taslağı olanlar"
        className="mt-1.5 space-y-1 border-l border-amber-400/30 pl-2.5"
      >
        {drafts.authors.map((author) => (
          <li key={author.versionId} className="flex flex-wrap items-center gap-x-1.5 text-xs text-neutral-300">
            <span>{author.name}</span>
            {author.mine ? <MineMark /> : null}
            <span className="text-2xs text-neutral-500">{formatDateTime(author.writtenAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
