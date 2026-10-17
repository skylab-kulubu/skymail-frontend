'use client';

import Link from 'next/link';
import { UserRound, Users } from 'lucide-react';
import { Badge } from '@skylab-kulubu/skylcn-ui';
import { useCan, useConsole } from '@/components/layout/ConsoleContext';
import { formResponsesHref } from '@/lib/form-mail-source';
import { ROLE } from '@/lib/access';
import { listHref } from '@/lib/mailing-lists';
import { formatCount, formatSendTime, type AudienceLabel } from '@/lib/sends';

/**
 * Who a send went to. A list or a group links to its mailing list for
 * someone who may read lists; a Keycloak group carries the Harici tag the
 * mailing list screens give it. A Mail onayı request's people are the first
 * few by name and how many more.
 */
export function Audience({ audience, className = '' }: { audience: AudienceLabel; className?: string }) {
  const canReadLists = useCan(ROLE.listsRead);
  const { config } = useConsole();
  const console = config.consoles.find((item) => item.id === 'forms');
  const formHref = audience.formId && console ? formResponsesHref(console.href, audience.formId) : null;
  const Icon = audience.kind === 'person' ? UserRound : Users;
  const name =
    audience.listId && canReadLists ? (
      <Link
        href={listHref.show(audience.listId)}
        className="hover:text-skylab-300 relative z-10 truncate transition-colors"
      >
        {audience.name}
      </Link>
    ) : formHref ? (
      <a href={formHref} target="_blank" rel="noopener noreferrer" className="relative z-10 truncate hover:text-skylab-300">{audience.name}</a>
    ) : (
      <span className="truncate">{audience.name}</span>
    );

  return (
    <span className={`flex min-w-0 items-start gap-1.5 ${className}`}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle-foreground" strokeWidth={1.75} aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-1.5 text-secondary-foreground">
          {name}
          {audience.kind === 'group' ? <Badge tone="warning" size="xs">Harici</Badge> : null}
          {audience.kind === 'form' ? <Badge tone="info" size="xs">Forms</Badge> : null}
          {audience.more ? <span className="shrink-0 text-muted-foreground">+{formatCount(audience.more)} kişi</span> : null}
        </span>
        {audience.detail ? (
          <span className="text-2xs truncate text-subtle-foreground">{audience.detail}</span>
        ) : null}
        {formHref ? <a href={formHref} target="_blank" rel="noopener noreferrer" className="relative z-10 text-2xs text-skylab-300 hover:underline">Forma git</a> : null}
        {audience.preparedAt ? <span className="text-2xs text-subtle-foreground">Hazırlanma: {formatSendTime(audience.preparedAt)}</span> : null}
      </span>
    </span>
  );
}
