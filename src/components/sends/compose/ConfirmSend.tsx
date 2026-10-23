'use client';

import { PanelDialog } from '@/components/common/PanelDialog';
import { PrimaryActions } from '@/components/common/PanelDialog';
import type { ApprovalRequest } from '@/lib/mail-approvals/edit';
import type { ListRow } from '@/lib/mailing-lists';
import { formatCount } from '@/lib/sends';
import { peopleSentApart, type PersonRow } from '@/lib/send-form/audience';
import type { Retry, SendPlan } from '@/lib/send-form/send';
import { untrackedCount, untrackedRecipientsNote } from '@/lib/send-form/tracking';
import { purposeText, statementText, teamNames, type StoredPurpose } from '@/lib/send-form/purpose';
import type { Progress } from './use-sending';
import { Notice } from '@skylab-kulubu/skylcn-ui';

/**
 * What the dialog is asked to confirm: a send; a send to a list again when
 * the last one may already be open; sending again to people, some of whom
 * may already have the mail; or a send submitted — or resubmitted — for
 * approval (ticket 20).
 */
export type Confirming =
  | { kind: 'send'; plan: SendPlan }
  | { kind: 'resendList'; plan: Extract<SendPlan, { kind: 'list' }> }
  | { kind: 'retryPeople'; retry: Retry }
  | { kind: 'submit'; plan: SendPlan; request: ApprovalRequest; resubmit: boolean };

const person = ({ name, email }: PersonRow) => (name ? `${name} <${email}>` : email);

function audienceText(list: ListRow | null, size: number | null) {
  if (!list) return '';
  const count = size === null ? 'alıcı sayısı bilinmiyor' : list.external ? `${formatCount(size)} üye` : `${formatCount(size)} alıcı`;
  return `“${list.name}” listesi (${count})`;
}

/** The last word before a send opens: what goes, to whom, how many, and anything that may be a slip or a duplicate. */
export function ConfirmSend({
  confirming,
  what,
  list,
  size,
  draftNote,
  warnings,
  progress,
  submitting = false,
  trackingAlways = false,
  teams = [],
  onCancel,
  onConfirm,
}: {
  confirming: Confirming | null;
  what: string;
  list: ListRow | null;
  size: number | null;
  draftNote: string | null;
  /** What may be a slip, in words (sendPlan's warnings). */
  warnings: readonly string[];
  progress: Progress | null;
  /** A submission for approval is on its way. */
  submitting?: boolean;
  /** SkyMail tracks every send (tracking_always): a Forms source's too, which asks for nothing. */
  trackingAlways?: boolean;
  /** The lists the form offers, for a team category's name. */
  teams?: readonly ListRow[];
  onCancel: () => void;
  onConfirm: (confirming: Confirming) => void;
}) {
  const title =
    confirming?.kind === 'resendList'
      ? 'Listeye yeniden gönder'
      : confirming?.kind === 'retryPeople'
        ? 'Kişilere yeniden gönder'
        : confirming?.kind === 'submit'
          ? confirming.resubmit
            ? 'Yeniden onaya sun'
            : 'Onaya sun'
          : 'Gönderimi onayla';
  const people =
    (confirming?.kind === 'send' || confirming?.kind === 'submit') && confirming.plan.kind === 'people'
      ? confirming.plan.requests.map((request) => ({ name: request.recipient_full_name, email: request.recipient_email }))
      : [];
  const busy = progress !== null || submitting;
  const submission = confirming?.kind === 'submit';
  const source = (confirming?.kind === 'send' || confirming?.kind === 'submit') && confirming.plan.kind === 'form' ? confirming.plan.source : null;
  const plan = confirming?.kind === 'send' || confirming?.kind === 'submit' || confirming?.kind === 'resendList' ? confirming.plan : null;
  const tracked =
    plan !== null &&
    (plan.kind === 'list'
      ? plan.request.tracking === true
      : plan.kind === 'people'
        ? plan.requests.some((request) => request.tracking === true)
        : trackingAlways);
  const untrackedNote = plan && tracked ? untrackedRecipientsNote(untrackedCount(plan, list, size)) : null;
  const purposeOf: StoredPurpose | null = plan === null ? null : plan.kind === 'people' ? (plan.requests[0] ?? null) : plan.request;
  const purpose = purposeOf ? purposeText(purposeOf, teamNames(teams)) : null;
  const statement = purposeOf ? statementText(purposeOf) : null;
  return (
    <PanelDialog isOpen={confirming !== null} onClose={busy ? () => {} : onCancel} title={title}>
      {confirming?.kind === 'retryPeople' ? (
        <div className="space-y-3">
          {confirming.retry.uncertain.length > 0 ? (
            <Notice tone="warning">
              <p className="font-medium">Bu kişilere gönderim açılmış olabilir; yeniden göndermek aynı maili ikinci kez gönderebilir:</p>
              <p className="mt-1 break-words">{confirming.retry.uncertain.map(person).join(', ')}</p>
            </Notice>
          ) : null}
          {confirming.retry.notSent.length > 0 ? (
            <p className="break-words">
              Gönderimi açılmamış olanlar: {confirming.retry.notSent.map(person).join(', ')}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <dl className="space-y-2">
            <div>
              <dt className="text-xs text-subtle-foreground">{submission ? 'Onaya sunulacak' : 'Gönderilecek'}</dt>
              <dd className="break-words text-foreground">{what}</dd>
            </div>
            <div>
              <dt className="text-xs text-subtle-foreground">Kime</dt>
              <dd className="break-words text-foreground">
                {source ? `“${source.form_title}” formunun ${formatCount(source.recipient_count)} yanıtlayanı (sabit alıcılar)` : submission && people.length === 1
                  ? person(people[0])
                  : people.length > 0
                    ? peopleSentApart(people.length)
                    : audienceText(list, size)}
              </dd>
              {people.length > 0 && !(submission && people.length === 1) ? (
                <dd className="mt-1 max-h-32 overflow-y-auto text-xs text-muted-foreground">{people.map(({ name, email }) => name || email).join(', ')}</dd>
              ) : null}
            </div>
            {purpose ? (
              <div>
                <dt className="text-xs text-subtle-foreground">Amaç</dt>
                <dd className="text-foreground">{purpose}</dd>
                {statement ? <dd className="mt-1 text-xs text-muted-foreground">Beyan: {statement}</dd> : null}
              </div>
            ) : null}
            {tracked ? (
              <div>
                <dt className="text-xs text-subtle-foreground">Takip</dt>
                <dd className="text-foreground">Açık</dd>
                {untrackedNote ? <dd className="mt-1 text-xs text-muted-foreground">{untrackedNote}</dd> : null}
              </div>
            ) : null}
          </dl>
          {confirming?.kind === 'resendList' ? (
            <div className="mt-3">
              <Notice tone="warning">
                Bu listeye az önceki gönderim açılmış olabilir. Yeniden göndermek listedeki herkese aynı maili ikinci kez gönderebilir.
              </Notice>
            </div>
          ) : null}
          {warnings.length > 0 ? (
            <div className="mt-3">
              <Notice tone="warning">
                <p className="font-medium">Göndermeden önce bak:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </Notice>
            </div>
          ) : null}
          {submission ? (
            <p className="mt-3 text-xs text-subtle-foreground">
              {draftNote ?? 'Yalnız yayımlanmış sürüm gönderilir.'} Bir onaycı onaylayınca gönderilir; onaycı değişkenleri düzenleyebilir
              ya da gerekçesiyle reddedebilir. 7 gün içinde karar verilmezse süresi dolar ve gönderilmez.
            </p>
          ) : (
            <p className="mt-3 text-xs text-subtle-foreground">
              {draftNote ?? 'Yalnız yayımlanmış sürüm gönderilir.'} Gönderim açıldıktan sonra geri alınamaz.
            </p>
          )}
        </>
      )}
      {progress && progress.total > 1 ? (
        <p className="mt-3 text-xs text-secondary-foreground" role="status">
          Gönderiliyor: {progress.done}/{progress.total}
        </p>
      ) : null}
      <PrimaryActions
        onCancel={onCancel}
        onConfirm={() => confirming && onConfirm(confirming)}
        confirmLabel={
          confirming?.kind === 'send'
            ? 'Gönder'
            : confirming?.kind === 'submit'
              ? title
              : confirming?.kind === 'retryPeople' && confirming.retry.uncertain.length === 0
                ? 'Yeniden gönder'
                : 'Yine de yeniden gönder'
        }
        pendingLabel={submission ? 'Sunuluyor…' : 'Gönderiliyor…'}
        isPending={busy}
      />
    </PanelDialog>
  );
}
