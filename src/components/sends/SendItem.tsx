import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  formatCount,
  formatSendTime,
  recipientSummary,
  SEND_LIST_PATH,
  type AudienceLabel,
  type RecipientCounts,
  type SendStatus,
} from '@/lib/sends';
import { Audience } from './Audience';
import { SendStatusBadge } from './StatusBadge';

/**
 * One send as a row that opens it — SkyForms' recent-form row: the Mail
 * template, when, who it went to, its status and its recipients. The home
 * screen lists recent sends this way; the send list does on a phone, where
 * its table would hide the status off to the side.
 */
export function SendItem({
  id,
  title,
  templateKey,
  createdAt,
  audience,
  status,
  counts,
}: {
  id: string;
  title: string;
  templateKey?: string | null;
  createdAt: string;
  audience: AudienceLabel;
  status: SendStatus;
  counts: RecipientCounts;
}) {
  const href = `${SEND_LIST_PATH}/show/${id}`;
  const recipients = recipientSummary(counts);

  return (
    <li className="group/row relative transition-colors hover:bg-white/[0.03]">
      {/* The whole row opens the send; the links inside it sit above this one. */}
      <Link href={href} className="absolute inset-0 z-0" aria-hidden tabIndex={-1} />
      <div className="flex items-start gap-3 px-3.5 py-3 sm:items-center">
        <div className="grid min-w-0 flex-1 gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <Link
              href={href}
              className="relative z-10 block truncate text-sm font-medium text-neutral-200 transition-colors group-hover/row:text-neutral-50"
            >
              {title}
            </Link>
            <p className="text-2xs truncate text-neutral-500">
              {templateKey ? (
                <>
                  <span className="font-mono">{templateKey}</span> ·{' '}
                </>
              ) : null}
              {formatSendTime(createdAt)}
            </p>
          </div>
          <Audience audience={audience} className="text-xs" />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:flex-col sm:items-end">
            <span className="flex items-center gap-2">
              <SendStatusBadge status={status} />
              <span className="text-2xs whitespace-nowrap text-neutral-400 tabular-nums">
                {recipients.total === 0 ? 'Alıcı yok' : `${formatCount(recipients.total)} alıcı`}
              </span>
            </span>
            {recipients.parts.length > 0 ? (
              <span className="text-3xs whitespace-nowrap text-neutral-500 tabular-nums">
                {recipients.parts.join(' · ')}
              </span>
            ) : null}
          </div>
        </div>
        <ArrowRight
          className="mt-1 h-3.5 w-3.5 shrink-0 text-neutral-700 transition-all group-hover/row:translate-x-0.5 group-hover/row:text-neutral-400 sm:mt-0"
          aria-hidden
        />
      </div>
    </li>
  );
}
