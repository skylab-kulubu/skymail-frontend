'use client';

import { ToneBadge, type Tone } from '@/components/chrome/ToneBadge';
import {
  APPROVAL_STATE_LABEL,
  deadlineHint,
  effectiveState,
  formatApprovalTime,
  isWaiting,
  submitterName,
  type ApprovalItem,
  type ApprovalState,
  type ApprovalSubmitter,
} from '@/lib/mail-approvals/approvals';

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
      <span className="text-neutral-300 tabular-nums">{formatApprovalTime(item.deadline_at)}</span>
      {hint ? <span className={`text-2xs ${hint.urgent ? 'text-amber-300' : 'text-neutral-500'}`}>{hint.text}</span> : null}
    </span>
  );
}

/** Who submitted it: a name and, under it, the address. */
export function Submitter({ submitter }: { submitter: ApprovalSubmitter }) {
  const name = submitterName(submitter);
  const email = submitter.email?.trim() || null;
  return (
    <span className="flex max-w-[14rem] min-w-0 flex-col">
      <span className="truncate text-neutral-200">{name}</span>
      {email && email !== name ? <span className="text-2xs truncate text-neutral-500">{email}</span> : null}
    </span>
  );
}
