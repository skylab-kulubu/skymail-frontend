'use client';

import { NoticeBox } from '@/components/chrome/Notice';
import { Modal } from '@/components/ui/Modal';
import { ModalPrimaryActions } from '@/components/ui/modal-actions';
import type { ListRow } from '@/lib/mailing-lists';
import { formatCount } from '@/lib/sends';
import type { PersonRow } from '@/lib/send-form/audience';
import type { Retry, SendPlan } from '@/lib/send-form/send';
import type { Progress } from './use-sending';

/**
 * What the dialog is asked to confirm: a send; a send to a list again when
 * the last one may already be open; or sending again to people, some of
 * whom may already have the mail.
 */
export type Confirming =
  | { kind: 'send'; plan: SendPlan }
  | { kind: 'resendList'; plan: Extract<SendPlan, { kind: 'list' }> }
  | { kind: 'retryPeople'; retry: Retry };

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
  onCancel: () => void;
  onConfirm: (confirming: Confirming) => void;
}) {
  const title =
    confirming?.kind === 'resendList' ? 'Listeye yeniden gönder' : confirming?.kind === 'retryPeople' ? 'Kişilere yeniden gönder' : 'Gönderimi onayla';
  const people =
    confirming?.kind === 'send' && confirming.plan.kind === 'people'
      ? confirming.plan.requests.map((request) => ({ name: request.recipient_full_name, email: request.recipient_email }))
      : [];
  return (
    <Modal isOpen={confirming !== null} onClose={progress ? () => {} : onCancel} title={title}>
      {confirming?.kind === 'retryPeople' ? (
        <div className="space-y-3">
          {confirming.retry.uncertain.length > 0 ? (
            <NoticeBox tone="warning">
              <p className="font-medium">Bu kişilere gönderim açılmış olabilir; yeniden göndermek aynı maili ikinci kez gönderebilir:</p>
              <p className="mt-1 break-words">{confirming.retry.uncertain.map(person).join(', ')}</p>
            </NoticeBox>
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
              <dt className="text-xs text-neutral-500">Gönderilecek</dt>
              <dd className="break-words text-neutral-100">{what}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Kime</dt>
              <dd className="break-words text-neutral-100">
                {people.length > 0 ? `${formatCount(people.length)} kişi, her biri ayrı bir gönderim` : audienceText(list, size)}
              </dd>
              {people.length > 0 ? (
                <dd className="mt-1 max-h-32 overflow-y-auto text-xs text-neutral-400">{people.map(({ name, email }) => name || email).join(', ')}</dd>
              ) : null}
            </div>
          </dl>
          {confirming?.kind === 'resendList' ? (
            <div className="mt-3">
              <NoticeBox tone="warning">
                Bu listeye az önceki gönderim açılmış olabilir. Yeniden göndermek listedeki herkese aynı maili ikinci kez gönderebilir.
              </NoticeBox>
            </div>
          ) : null}
          {warnings.length > 0 ? (
            <div className="mt-3">
              <NoticeBox tone="warning">
                <p className="font-medium">Göndermeden önce bak:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </NoticeBox>
            </div>
          ) : null}
          <p className="mt-3 text-xs text-neutral-500">
            {draftNote ?? 'Yalnız yayımlanmış sürüm gönderilir.'} Gönderim açıldıktan sonra geri alınamaz.
          </p>
        </>
      )}
      {progress && progress.total > 1 ? (
        <p className="mt-3 text-xs text-neutral-300" role="status">
          Gönderiliyor: {progress.done}/{progress.total}
        </p>
      ) : null}
      <ModalPrimaryActions
        onCancel={onCancel}
        onConfirm={() => confirming && onConfirm(confirming)}
        confirmLabel={
          confirming?.kind === 'send'
            ? 'Gönder'
            : confirming?.kind === 'retryPeople' && confirming.retry.uncertain.length === 0
              ? 'Yeniden gönder'
              : 'Yine de yeniden gönder'
        }
        pendingLabel="Gönderiliyor…"
        isPending={progress !== null}
      />
    </Modal>
  );
}
