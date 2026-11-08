'use client';

import { PanelDialog } from '@/components/common/PanelDialog';
import { PrimaryActions } from '@/components/common/PanelDialog';
import type { ApprovalRequest } from '@/lib/mail-approvals/edit';
import type { ListRow } from '@/lib/mailing-lists';
import { formatCount } from '@/lib/sends';
import { peopleSentApart, type PersonRow } from '@/lib/send-form/audience';
import { confirmTitle } from '@/lib/send-form/confirm';
import type { FormSourceSendRequest, ListSendRequest, Retry, SendPlan, SingleSendRequest } from '@/lib/send-form/send';
import { untrackedCount, untrackedRecipientsNote } from '@/lib/send-form/tracking';
import { COMMERCIAL_STATEMENT, guestsSkippedNote, ownEventText, purposeText, statementText, teamNames, type StoredPurpose } from '@/lib/send-form/purpose';
import { TEAM_PURPOSE_TEXT } from '@/lib/send-form/teams';
import type { Progress } from './use-sending';
import { Notice } from '@skylab-kulubu/skylcn-ui';

/**
 * What the dialog is asked to confirm: a send; a send to a list again when
 * the last one may already be open; sending again to people, some of whom
 * may already have the mail; or a send submitted — or resubmitted — for
 * approval (ticket 20). Each holds what the form said when the dialog
 * opened — the plan, the list and what goes — so a change made behind the
 * open dialog (another audience, another list) never reaches the send.
 */
export type Confirming =
  | { kind: 'send'; plan: SendPlan; list: ListRow | null; what: string }
  | { kind: 'resendList'; plan: Extract<SendPlan, { kind: 'list' }>; list: ListRow; what: string }
  | { kind: 'retryPeople'; retry: Retry }
  | { kind: 'submit'; plan: SendPlan; request: ApprovalRequest; resubmit: boolean; list: ListRow | null; what: string };

/** What a confirmed send does, from the dialog's own copy of the form: null for a list send that names no list. */
export type ConfirmedSend =
  | { kind: 'list'; request: ListSendRequest; list: ListRow; what: string }
  | { kind: 'form'; request: FormSourceSendRequest; formTitle: string; what: string }
  | { kind: 'people'; requests: readonly SingleSendRequest[]; what: string }
  | { kind: 'retry'; requests: readonly SingleSendRequest[] };

export function confirmedSend(chosen: Exclude<Confirming, { kind: 'submit' }>): ConfirmedSend | null {
  if (chosen.kind === 'retryPeople') return { kind: 'retry', requests: chosen.retry.requests };
  const { plan, what } = chosen;
  if (plan.kind === 'list') return chosen.list ? { kind: 'list', request: plan.request, list: chosen.list, what } : null;
  if (plan.kind === 'form') return { kind: 'form', request: plan.request, formTitle: plan.source.form_title, what };
  if (plan.kind === 'people') return { kind: 'people', requests: plan.requests, what };
  // Teams go only for approval.
  return null;
}

const person = ({ name, email }: PersonRow) => (name ? `${name} <${email}>` : email);

function audienceText(list: ListRow | null, size: number | null) {
  if (!list) return '';
  const count = size === null ? 'alıcı sayısı bilinmiyor' : list.external ? `${formatCount(size)} üye` : `${formatCount(size)} alıcı`;
  return `“${list.name}” listesi (${count})`;
}

/** The last word before a send opens: what goes, to whom, how many, and anything that may be a slip or a duplicate. */
export function ConfirmSend({
  confirming,
  what: formWhat,
  list: formList,
  size: formSize,
  draftNote,
  warnings,
  progress,
  submitting = false,
  trackingAlways = false,
  listConsent = false,
  teams = [],
  teamsText = null,
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
  /** The backend holds guests to their announcement consent (list_consent_available). */
  listConsent?: boolean;
  /** The lists the form offers, for a team category's name. */
  teams?: readonly ListRow[];
  /** A Team request (ekip-postasi 05): whom it goes to, in words. */
  teamsText?: string | null;
  onCancel: () => void;
  onConfirm: (confirming: Confirming) => void;
}) {
  const title = confirmTitle(confirming?.kind ?? 'send', { resubmit: confirming?.kind === 'submit' && confirming.resubmit });
  // What the dialog opened with, not what the form holds now.
  const opened = confirming && confirming.kind !== 'retryPeople' ? confirming : null;
  const list = opened ? opened.list : formList;
  const what = opened ? opened.what : formWhat;
  const size = list?.id === formList?.id ? formSize : null;
  const people =
    (confirming?.kind === 'send' || confirming?.kind === 'submit') && confirming.plan.kind === 'people'
      ? confirming.plan.requests.map((request) => ({ name: request.recipient_full_name, email: request.recipient_email }))
      : [];
  const busy = progress !== null || submitting;
  const submission = confirming?.kind === 'submit';
  const source = (confirming?.kind === 'send' || confirming?.kind === 'submit') && confirming.plan.kind === 'form' ? confirming.plan.source : null;
  const plan = confirming?.kind === 'send' || confirming?.kind === 'submit' || confirming?.kind === 'resendList' ? confirming.plan : null;
  const toTeams = plan?.kind === 'team';
  const tracked =
    plan !== null &&
    (plan.kind === 'list'
      ? plan.request.tracking === true
      : plan.kind === 'people'
        ? plan.requests.some((request) => request.tracking === true)
        : trackingAlways);
  const untrackedNote = plan && tracked ? untrackedRecipientsNote(untrackedCount(plan, list, size)) : null;
  const purposeOf: StoredPurpose | null = plan === null || plan.kind === 'team' ? null : plan.kind === 'people' ? (plan.requests[0] ?? null) : plan.request;
  // A Team request's purpose is fixed: duyuru, each Team with its own category.
  const purpose = toTeams ? TEAM_PURPOSE_TEXT : purposeOf ? purposeText(purposeOf, teamNames(teams)) : null;
  const statement = toTeams ? COMMERCIAL_STATEMENT : purposeOf ? statementText(purposeOf) : null;
  const ownEvent = purposeOf ? ownEventText(purposeOf) : null;
  const guestsNote = plan && plan.kind !== 'team' && purposeOf ? guestsSkippedNote(purposeOf, plan.kind, list, listConsent) : null;
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
                {toTeams ? teamsText : source ? `“${source.form_title}” formunun ${formatCount(source.recipient_count)} yanıtlayanı (sabit alıcılar)` : submission && people.length === 1
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
                {ownEvent ? <dd className="mt-1 text-xs text-muted-foreground">Beyan: {ownEvent}</dd> : null}
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
          {guestsNote ? (
            <div className="mt-3">
              <Notice tone="info">{guestsNote}</Notice>
            </div>
          ) : null}
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
