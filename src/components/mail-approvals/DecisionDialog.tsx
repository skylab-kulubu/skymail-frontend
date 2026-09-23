'use client';

import { useState } from 'react';
import { FormTextArea } from '@/components/chrome/FormField';
import { Modal } from '@/components/ui/Modal';
import { ModalDangerActions, ModalPrimaryActions } from '@/components/ui/modal-actions';
import type { MailApproval } from '@/lib/mail-approvals/approvals';
import type { FieldSource, VariableField } from '@/lib/send-form/fields';
import { audienceLabel, formatCount } from '@/lib/sends';
import { EditComparison } from './EditComparison';

/** A decision on a request, confirmed before it is sent. */
export type Decision = 'approve' | 'approveEdited' | 'return' | 'reject' | 'accept' | 'decline';

const TITLE: Readonly<Record<Decision, string>> = {
  approve: 'Onayla ve gönder',
  approveEdited: 'Düzenlemeyle gönder',
  return: 'Sunana geri gönder',
  reject: 'Reddet',
  accept: 'Kabul et ve gönder',
  decline: 'Düzenlemeyi kabul etme',
};

const PENDING: Readonly<Record<Decision, string>> = {
  approve: 'Gönderiliyor…',
  approveEdited: 'Gönderiliyor…',
  return: 'Geri gönderiliyor…',
  reject: 'Reddediliyor…',
  accept: 'Gönderiliyor…',
  decline: 'Kaydediliyor…',
};

/** Who it goes to, and how many, in words. */
function audienceText(approval: MailApproval): string {
  const audience = audienceLabel(approval.audience);
  if (audience.kind === 'person') return audience.detail ? `${audience.name} <${audience.detail}>` : audience.name;
  const count = approval.recipient_count === null ? 'alıcı sayısı bilinmiyor' : `${formatCount(approval.recipient_count)} alıcı`;
  return `“${audience.name}” ${audience.kind === 'group' ? 'Keycloak grubu' : 'listesi'} (${count})`;
}

/**
 * The last word before a decision: what goes and to whom, an edit beside
 * what was submitted, a note for the submitter or a rejection's reason. A
 * rejection takes a reason; the submitter reads it. The page keys it by
 * the decision, so each one opens empty.
 */
export function DecisionDialog({
  decision,
  approval,
  edited,
  fields,
  source,
  recipient,
  busy,
  onCancel,
  onConfirm,
}: {
  decision: Decision | null;
  approval: MailApproval;
  /** The approver's edit, for approveEdited and return. */
  edited: Readonly<Record<string, unknown>> | null;
  fields: readonly VariableField[];
  source: FieldSource | null;
  recipient: Readonly<{ full_name: string; email: string }>;
  busy: boolean;
  onCancel: () => void;
  /** A note, or a rejection's reason, trimmed; empty for none. */
  onConfirm: (decision: Decision, text: string) => void;
}) {
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  if (decision === null) return null;

  const reject = decision === 'reject';
  const missingReason = reject && text.trim() === '';
  const withEdit = decision === 'approveEdited' || decision === 'return';
  const close = busy ? () => {} : onCancel;

  function confirm() {
    if (!decision) return;
    setTried(true);
    if (missingReason) return;
    onConfirm(decision, text.trim());
  }

  return (
    <Modal isOpen onClose={close} title={TITLE[decision]} size={withEdit ? 'wide' : 'md'}>
      <div className="space-y-3">
        <dl className="space-y-2">
          <div>
            <dt className="text-xs text-neutral-500">Mail template</dt>
            <dd className="break-words text-neutral-100">{approval.template.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Kime</dt>
            <dd className="break-words text-neutral-100">{audienceText(approval)}</dd>
          </div>
        </dl>

        {withEdit ? (
          <EditComparison
            before={approval.body_variables}
            after={edited}
            fields={fields}
            source={source}
            recipient={recipient}
            labels={['Sunulan', 'Düzenlenmiş']}
          />
        ) : null}

        <p className="text-xs text-neutral-400">
          {decision === 'approve'
            ? 'Sunulduğu gibi hemen gönderilir; gönderim açıldıktan sonra geri alınamaz. Sunana karar mail olarak bildirilir.'
            : decision === 'approveEdited'
              ? 'Düzenlenmiş hâli hemen gönderilir; gönderim açıldıktan sonra geri alınamaz. Neyi değiştirdiğin kayda geçer ve sunana bildirilir.'
              : decision === 'return'
                ? 'Hiçbir şey gönderilmez: istek düzenlemenle sunana döner, kabul ederse gönderilir. Sunanın karar vermek için 7 günü olur.'
                : decision === 'reject'
                  ? 'Hiçbir şey gönderilmez. Sunan gerekçeni görür; isteği düzenleyip yeniden sunabilir.'
                  : decision === 'accept'
                    ? 'Onaycının düzenlemesiyle hemen gönderilir; gönderim açıldıktan sonra geri alınamaz.'
                    : 'Hiçbir şey gönderilmez. Sonra isteği kendi değerlerinle düzenleyip yeniden sunabilirsin.'}
        </p>

        {decision === 'accept' ? null : (
          <FormTextArea
            label={reject ? 'Ret gerekçesi' : decision === 'decline' ? 'Neden (isteğe bağlı)' : 'Sunana not (isteğe bağlı)'}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            maxLength={2000}
            required={reject}
            placeholder={reject ? 'Sunan neden reddedildiğini görecek.' : undefined}
            error={tried && missingReason ? 'Gerekçe yaz: sunan neden reddedildiğini görecek.' : null}
          />
        )}
      </div>
      {reject || decision === 'decline' ? (
        <ModalDangerActions onCancel={onCancel} onConfirm={confirm} confirmLabel={TITLE[decision]} pendingLabel={PENDING[decision]} isPending={busy} />
      ) : (
        <ModalPrimaryActions onCancel={onCancel} onConfirm={confirm} confirmLabel={TITLE[decision]} pendingLabel={PENDING[decision]} isPending={busy} />
      )}
    </Modal>
  );
}
