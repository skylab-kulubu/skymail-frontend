'use client';

// A send submitted for approval (ticket 20) once the sender confirms it: a
// new request (`POST /mail_approvals`) or a rejected or declined one again
// (`…/resubmit`). It lands on the request's page, which says whether the
// approvers were told; a refusal is said on the form, in the words
// mail-approvals/refusals.ts has for it.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApi } from '@/lib/api/react';
import { approvalHref, notificationNote, type MailApproval } from '@/lib/mail-approvals/approvals';
import { approvalsChanged } from '@/lib/mail-approvals/changes';
import type { ApprovalRequest } from '@/lib/mail-approvals/edit';
import { approvalRefusal, type ApprovalRefusal } from '@/lib/mail-approvals/refusals';
import { flashNotice } from '@/lib/notice';

export function useSubmitting() {
  const api = useApi();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApprovalRefusal | null>(null);

  /**
   * Submits `request`, or resubmits the request `resubmitId`; `said` is what
   * the request's page says of it. Whether it went: on its way to the
   * request's page, or refused and said so here.
   */
  async function submit(request: ApprovalRequest, { resubmitId, said }: { resubmitId: string | null; said: string }): Promise<boolean> {
    setBusy(true);
    setFailure(null);
    try {
      const approval = resubmitId
        ? await api.post<MailApproval>(`/mail_approvals/${encodeURIComponent(resubmitId)}/resubmit`, request)
        : await api.post<MailApproval>('/mail_approvals', request);
      const problem = notificationNote(approval.notification);
      flashNotice(approvalHref(approval.id), { tone: problem ? 'warning' : 'success', text: problem ? `${said} ${problem}` : said });
      approvalsChanged();
      // Busy until the request's page takes over.
      router.push(approvalHref(approval.id));
      return true;
    } catch (error) {
      setFailure(approvalRefusal(error, resubmitId ? 'resubmit' : 'submit'));
      setBusy(false);
      return false;
    }
  }

  return { busy, failure, submit, clear: () => setFailure(null) };
}
