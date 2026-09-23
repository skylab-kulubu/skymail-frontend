'use client';

import { useId, useState } from 'react';
import { ChevronDown, PenLine } from 'lucide-react';
import { formatClubTime } from '@/lib/format';
import type { DraftAuthor, DraftsInProgress } from '@/lib/templates';

/** Marks the viewer's own draft. */
function MineMark() {
  return (
    <span className="bg-skylab-500/15 text-skylab-300 text-3xs shrink-0 rounded px-1 py-px font-medium tracking-wider uppercase">
      Sen
    </span>
  );
}

function describe(author: DraftAuthor): string {
  return `${author.name}${author.mine ? ' (sen)' : ''}, ${formatClubTime(author.writtenAt)}`;
}

/**
 * Who has an unpublished draft of the template. One author is named on the
 * row, with when they wrote it. Several are counted ("2 taslak"), and their
 * names and times open on a tap, or a click or Enter, in the row itself, so a
 * phone reads them too; a pointer also gets them on hover.
 */
export function DraftIndicator({ drafts }: { drafts: DraftsInProgress }) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  if (drafts.authors.length === 1) {
    const [author] = drafts.authors;
    return (
      <div className="min-w-0 text-xs">
        <span className="inline-flex max-w-full items-center gap-1.5 text-amber-300">
          <PenLine className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">
            {/* The table's column already says Taslak; a phone's stacked row does not. */}
            <span className="md:hidden">Taslak: </span>
            {author.name}
          </span>
          {author.mine ? <MineMark /> : null}
        </span>
        <span className="text-2xs block pl-[1.125rem] text-neutral-500">{formatClubTime(author.writtenAt)}</span>
      </div>
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
            <span className="text-2xs text-neutral-500">{formatClubTime(author.writtenAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
