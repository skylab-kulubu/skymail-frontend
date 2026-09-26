'use client';

import Link from 'next/link';
import { ToneBadge, type Tone } from '@/components/chrome/ToneBadge';
import { useCan } from '@/components/layout/ConsoleContext';
import { ROLE } from '@/lib/access';
import { formatClubTime } from '@/lib/format';
import {
  APPROVAL_STATE_LABEL,
  RECIPIENTS_ANCHOR,
  approvalSends,
  deadlineHint,
  effectiveState,
  isWaiting,
  submitterAddress,
  submitterName,
  type ApprovalItem,
  type ApprovalState,
  type ApprovalSubmitter,
} from '@/lib/mail-approvals/approvals';
import { sendHref } from '@/lib/sends';

const STATE_TONE: Readonly<Record<ApprovalState, Tone>> = {
  pending: 'busy',
  returned: 'busy',
  approved: 'good',
  rejected: 'bad',
  declined: 'idle',
  expired: 'idle',
};

export function ApprovalStateBadge({ state }: { state: ApprovalState }) {
  return <ToneBadge tone={STATE_TONE[state]} label={APPROVAL_STATE_LABEL[state]} />;
}

/**
 * When a request's time runs out, in the club's zone, and how long is left:
 * only while it waits for someone. An expired one says so; a decided one has
 * no deadline any more.
 */
export function Deadline({ item, now = new Date(), inline = false }: { item: Pick<ApprovalItem, 'state' | 'deadline_at'>; now?: Date; inline?: boolean }) {
  const state = effectiveState(item, now);
  if (state === 'expired') return <span className="text-neutral-400">Süresi doldu</span>;
  if (!isWaiting(state)) return <span className="text-neutral-600">—</span>;
  const hint = deadlineHint(item.deadline_at, now);
  return (
    <span className={inline ? 'inline-flex flex-wrap items-baseline gap-x-1.5' : 'flex flex-col'}>
      <span className="text-neutral-300 tabular-nums">{formatClubTime(item.deadline_at)}</span>
      {hint ? <span className={`text-2xs ${hint.urgent ? 'text-amber-300' : 'text-neutral-500'}`}>{hint.text}</span> : null}
    </span>
  );
}

/**
 * Where an approved request's sends are, for someone who reads sends: its
 * one send, or — one per person — the people on the page, each beside theirs.
 */
export function SendsLink({ item, className = 'text-sm' }: { item: Pick<ApprovalItem, 'task_id' | 'task_ids'>; className?: string }) {
  const canSeeSends = useCan(ROLE.mailsRead);
  const sends = approvalSends(item);
  if (!canSeeSends || sends.length === 0) return null;
  const style = `text-skylab-300 hover:underline ${className}`;
  return sends.length === 1 ? (
    <Link href={sendHref(sends[0])} className={style}>
      Gönderimi gör
    </Link>
  ) : (
    <a href={`#${RECIPIENTS_ANCHOR}`} className={style}>
      Gönderimleri gör
    </a>
  );
}

/** Who submitted it: a name and, under it, when (`at`) or else the address; Silinmiş kullanıcı has none. */
export function Submitter({ submitter, at }: { submitter: ApprovalSubmitter; at?: string }) {
  const name = submitterName(submitter);
  const email = submitterAddress(submitter);
  const under = at ? formatClubTime(at) : email && email !== name ? email : null;
  return (
    <span className="flex max-w-[14rem] min-w-0 flex-col" title={email ?? undefined}>
      <span className="truncate text-neutral-200">{name}</span>
      {under ? <span className={`text-2xs truncate text-neutral-500 ${at ? 'tabular-nums' : ''}`}>{under}</span> : null}
    </span>
  );
}
