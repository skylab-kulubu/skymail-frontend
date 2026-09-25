'use client';

import { useState } from 'react';
import { FormTextArea } from '@/components/chrome/FormField';
import { Modal } from '@/components/ui/Modal';
import { ModalDangerActions, ModalPrimaryActions } from '@/components/ui/modal-actions';
import { approvalAudience, approvalPeople, recipientName, type MailApproval } from '@/lib/mail-approvals/approvals';
import { DECISIONS, type Decision } from '@/lib/mail-approvals/decisions';
import type { PinnedSource } from '@/lib/mail-approvals/edit';
import type { VariableField } from '@/lib/send-form/fields';
import { formatCount } from '@/lib/sends';
import { EditComparison } from './EditComparison';

/** Who it goes to, and how many, in words: several people as the send form's confirmation says them. */
function audienceText(approval: MailApproval): string {
  const people = approvalPeople(approval);
  if (people.length > 1) return `${formatCount(people.length)} kişi, her biri ayrı bir gönderim`;
  const audience = approvalAudience(approval);
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
  pinned,
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
  pinned: PinnedSource;
  recipient: Readonly<{ full_name: string; email: string }>;
  busy: boolean;
  onCancel: () => void;
  /** A note, or a rejection's reason, trimmed; empty for none. */
  onConfirm: (decision: Decision, text: string) => void;
}) {
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  if (decision === null) return null;

  const words = DECISIONS[decision];
  const people = approvalPeople(approval);
  const missingReason = words.text?.required === true && text.trim() === '';
  const close = busy ? () => {} : onCancel;

  function confirm() {
    if (!decision) return;
    setTried(true);
    if (missingReason) return;
    onConfirm(decision, text.trim());
  }

  return (
    <Modal isOpen onClose={close} title={words.title} size={words.withEdit ? 'wide' : 'md'}>
      <div className="space-y-3">
        <dl className="space-y-2">
          <div>
            <dt className="text-xs text-neutral-500">Mail template</dt>
            <dd className="break-words text-neutral-100">{approval.template.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Kime</dt>
            <dd className="break-words text-neutral-100">{audienceText(approval)}</dd>
            {people.length > 1 ? (
              <dd className="mt-1 max-h-32 overflow-y-auto text-xs text-neutral-400">
                {people.map(recipientName).join(', ')}
              </dd>
            ) : null}
          </div>
        </dl>

        {words.withEdit ? (
          <EditComparison
            before={approval.body_variables}
            after={edited}
            fields={fields}
            pinned={pinned}
            recipient={recipient}
            labels={['Sunulan', 'Düzenlenmiş']}
          />
        ) : null}

        <p className="text-xs text-neutral-400">{words.explains}</p>

        {words.text ? (
          <FormTextArea
            label={words.text.label}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            maxLength={2000}
            required={words.text.required}
            placeholder={words.text.placeholder}
            error={tried && missingReason ? 'Gerekçe yaz: sunan neden reddedildiğini görecek.' : null}
          />
        ) : null}
      </div>
      {words.refusal ? (
        <ModalDangerActions onCancel={onCancel} onConfirm={confirm} confirmLabel={words.title} pendingLabel={words.pending} isPending={busy} />
      ) : (
        <ModalPrimaryActions onCancel={onCancel} onConfirm={confirm} confirmLabel={words.title} pendingLabel={words.pending} isPending={busy} />
      )}
    </Modal>
  );
}
