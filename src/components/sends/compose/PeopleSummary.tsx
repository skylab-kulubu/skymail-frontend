'use client';

import Link from 'next/link';
import { RotateCcw, Send as SendIcon } from 'lucide-react';
import { NoticeBox } from '@/components/chrome/Notice';
import { ToneBadge, type Tone } from '@/components/chrome/ToneBadge';
import { Button } from '@/components/ui/Button';
import { SEND_LIST_PATH, formatCount, sendHref } from '@/lib/sends';
import type { PersonOutcome } from '@/lib/send-form/send';

const BADGE: Readonly<Record<PersonOutcome['status'], { tone: Tone; label: string }>> = {
  sent: { tone: 'good', label: 'Kuyruğa alındı' },
  final: { tone: 'bad', label: 'Açılamadı' },
  notSent: { tone: 'busy', label: 'Gönderilmedi' },
  uncertain: { tone: 'busy', label: 'Açılmış olabilir' },
};

/** The outcomes in one sentence. */
function summaryOf(outcomes: readonly PersonOutcome[]): string {
  const count = (status: PersonOutcome['status']) => outcomes.filter((outcome) => outcome.status === status).length;
  const sent = count('sent');
  if (sent === outcomes.length) return `${formatCount(sent)} kişinin hepsine gönderim açıldı.`;
  const parts = [
    count('final') > 0 ? `${formatCount(count('final'))} kişiye açılamadı` : null,
    count('notSent') > 0 ? `${formatCount(count('notSent'))} kişiye gönderilmedi` : null,
    count('uncertain') > 0 ? `${formatCount(count('uncertain'))} kişiye açılıp açılmadığı belli değil` : null,
  ].filter(Boolean);
  return `${formatCount(outcomes.length)} kişiden ${formatCount(sent)} kişiye gönderim açıldı; ${parts.join(', ')}.`;
}

/**
 * How it went for each person: sent ones link to their send, the others say
 * why. Only those who have not got the mail for sure can be sent to again,
 * and only through a confirmation (ConfirmSend) that names who may get it
 * twice; a refusal is final.
 */
export function PeopleSummary({
  what,
  outcomes,
  canOpen,
  canRetry,
  busy,
  onRetry,
  onNew,
}: {
  /** What was sent, in words. */
  what: string;
  outcomes: readonly PersonOutcome[];
  /** The viewer may open a send's page (`mails:read`). */
  canOpen: boolean;
  /** Someone has not got the mail for sure. */
  canRetry: boolean;
  busy: boolean;
  onRetry: () => void;
  onNew: () => void;
}) {
  const allSent = outcomes.every((outcome) => outcome.status === 'sent');
  return (
    <section aria-labelledby="people-summary-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="people-summary-heading" className="text-sm font-medium text-neutral-100">
          Gönderim sonucu
        </h2>
        <p className="text-xs text-neutral-500">{what}</p>
      </div>
      <NoticeBox tone={allSent ? 'success' : 'warning'}>{summaryOf(outcomes)}</NoticeBox>
      <ul className="divide-y divide-white/5 rounded-lg border border-white/10" aria-label="Kişiler">
        {outcomes.map((outcome) => (
          <li key={outcome.email} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm break-words text-neutral-100">{outcome.name || outcome.email}</p>
              {outcome.name ? <p className="text-xs break-all text-neutral-500">{outcome.email}</p> : null}
              {outcome.status === 'sent' ? null : (
                <p className={`mt-1 text-xs ${outcome.status === 'final' ? 'text-red-300' : 'text-amber-300'}`}>{outcome.reason}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <ToneBadge tone={BADGE[outcome.status].tone} label={BADGE[outcome.status].label} />
              {outcome.status === 'sent' && canOpen ? (
                <Link href={sendHref(outcome.sendId)} className="text-skylab-300 text-xs hover:underline">
                  Gönderimi gör
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {canRetry ? (
          <Button onClick={onRetry} disabled={busy}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Yeniden gönder…
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onNew} disabled={busy}>
          <SendIcon className="h-4 w-4" aria-hidden />
          Yeni gönderim
        </Button>
        {canOpen ? (
          <Button variant="secondary" href={SEND_LIST_PATH} disabled={busy}>
            Gönderimlere git
          </Button>
        ) : null}
      </div>
    </section>
  );
}
