'use client';

import Link from 'next/link';
import { UserRound, Users } from 'lucide-react';
import { Tag } from '@/components/chrome/Tag';
import { useCan } from '@/components/layout/ConsoleContext';
import { ROLE } from '@/lib/access';
import { listHref } from '@/lib/mailing-lists';
import { formatCount, type AudienceLabel } from '@/lib/sends';

/**
 * Who a send went to. A list or a group links to its mailing list for
 * someone who may read lists; a Keycloak group carries the Harici tag the
 * mailing list screens give it. A Mail onayı request's people are the first
 * few by name and how many more.
 */
export function Audience({ audience, className = '' }: { audience: AudienceLabel; className?: string }) {
  const canReadLists = useCan(ROLE.listsRead);
  const Icon = audience.kind === 'person' ? UserRound : Users;
  const name =
    audience.listId && canReadLists ? (
      <Link
        href={listHref.show(audience.listId)}
        className="hover:text-skylab-300 relative z-10 truncate transition-colors"
      >
        {audience.name}
      </Link>
    ) : (
      <span className="truncate">{audience.name}</span>
    );

  return (
    <span className={`flex min-w-0 items-start gap-1.5 ${className}`}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" strokeWidth={1.75} aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-1.5 text-neutral-200">
          {name}
          {audience.kind === 'group' ? <Tag tone="external">Harici</Tag> : null}
          {audience.more ? <span className="shrink-0 text-neutral-400">+{formatCount(audience.more)} kişi</span> : null}
        </span>
        {audience.detail ? (
          <span className="text-2xs truncate text-neutral-500">{audience.detail}</span>
        ) : null}
      </span>
    </span>
  );
}
