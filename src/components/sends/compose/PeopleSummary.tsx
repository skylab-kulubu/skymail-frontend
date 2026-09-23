'use client';

import Link from 'next/link';
import { RotateCcw, Send as SendIcon } from 'lucide-react';
import { NoticeBox } from '@/components/chrome/Notice';
import { ToneBadge } from '@/components/chrome/ToneBadge';
import { Button } from '@/components/ui/Button';
import { SEND_LIST_PATH, formatCount, sendHref } from '@/lib/sends';
import type { PersonOutcome } from '@/lib/send-form/send';

/** How it went for each person: sent ones link to their send, failed ones say why. */
export function PeopleSummary({
  what,
  outcomes,
  canOpen,
  retrying,
  onRetry,
  onNew,
}: {
  /** What was sent, in words. */
  what: string;
  outcomes: readonly PersonOutcome[];
  /** The viewer may open a send's page (`mails:read`). */
  canOpen: boolean;
  /** How many of the retried are done, while retrying. */
  retrying: { done: number; total: number } | null;
  onRetry: () => void;
  onNew: () => void;
}) {
  const failed = outcomes.filter((outcome) => !outcome.ok).length;
  const sent = outcomes.length - failed;
  const summary =
    failed === 0
      ? `${formatCount(sent)} kişinin hepsine gönderim açıldı.`
      : `${formatCount(outcomes.length)} kişiden ${formatCount(sent)} kişiye gönderim açıldı, ${formatCount(failed)} kişiye açılamadı.`;

  return (
    <section aria-labelledby="people-summary-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="people-summary-heading" className="text-sm font-medium text-neutral-100">
          Gönderim sonucu
        </h2>
        <p className="text-xs text-neutral-500">{what}</p>
      </div>
      <NoticeBox tone={failed === 0 ? 'success' : 'error'}>{summary}</NoticeBox>
      <ul className="divide-y divide-white/5 rounded-lg border border-white/10" aria-label="Kişiler">
        {outcomes.map((outcome) => (
          <li key={outcome.email} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm break-words text-neutral-100">{outcome.name || outcome.email}</p>
              {outcome.name ? <p className="text-xs break-all text-neutral-500">{outcome.email}</p> : null}
              {outcome.ok ? null : <p className="mt-1 text-xs text-red-300">{outcome.reason}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <ToneBadge tone={outcome.ok ? 'good' : 'bad'} label={outcome.ok ? 'Kuyruğa alındı' : 'Açılamadı'} />
              {outcome.ok && canOpen ? (
                <Link href={sendHref(outcome.sendId)} className="text-skylab-300 text-xs hover:underline">
                  Gönderimi gör
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {failed > 0 ? (
          <Button onClick={onRetry} disabled={retrying !== null}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            {retrying ? `Yeniden deneniyor… ${retrying.done}/${retrying.total}` : 'Açılamayanlara yeniden dene'}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onNew} disabled={retrying !== null}>
          <SendIcon className="h-4 w-4" aria-hidden />
          Yeni gönderim
        </Button>
        {canOpen ? (
          <Button variant="secondary" href={SEND_LIST_PATH} disabled={retrying !== null}>
            Gönderimlere git
          </Button>
        ) : null}
      </div>
    </section>
  );
}
