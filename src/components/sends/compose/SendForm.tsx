'use client';

// A new send (ticket 16): a Mail template or a free announcement, to a
// mailing list or to people one by one, with the template's variables filled
// in and the mail previewed as it goes out. superadmin links an Event's list
// here as ?mail_list_id=<id>, and the list is preselected. Only a template's
// published version is ever sent; a free announcement's body is written in
// the Visual editor and still goes through the server's allow-list.
//
// What the viewer may not send they submit for approval (ticket 20). The
// same form, filled from a request for approval, resubmits a rejected or
// declined one (`/mail-approvals/edit/:id`) or starts a new one from it
// (`?from_approval=<id>`, after it expired).
//
// Who may open it: anyone with access (access.ts requiredRolesFor); a
// template to send needs templates:read.

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, SearchX } from 'lucide-react';
import { PrefillIntro } from '@/components/mail-approvals/PrefillIntro';
import { StateCard } from '@/components/chrome/StateCard';
import { useConsole } from '@/components/layout/ConsoleContext';
import { RoleGate } from '@/components/layout/RoleGate';
import { Button } from '@/components/ui/Button';
import { ROLE, isApprover } from '@/lib/access';
import { useApiLoad } from '@/lib/api/react';
import { viewerActions } from '@/lib/mail-approvals/actions';
import { APPROVAL_LIST_PATH, APPROVAL_STATE_LABEL, approvalHref, fetchApproval, type MailApproval } from '@/lib/mail-approvals/approvals';
import { composePrefill, valuesBeforeEdit } from '@/lib/mail-approvals/edit';
import type { ListRow } from '@/lib/mailing-lists';
import { sendAccess } from '@/lib/send-form/access';
import { fetchSendableLists, fetchSendableTemplates } from '@/lib/send-form/send';
import { Compose } from './Compose';

export function SendForm() {
  const from = useSearchParams().get('from_approval');
  return (
    <RoleGate role={ROLE.templatesRead}>
      <ComposeCatalog from={from ? { kind: 'copy', id: from } : null} />
    </RoleGate>
  );
}

/** A rejected or declined request, edited and submitted again. */
export function ResubmitForm({ id }: { id: string }) {
  return (
    <RoleGate role={ROLE.templatesRead}>
      <ComposeCatalog from={{ kind: 'resubmit', id }} />
    </RoleGate>
  );
}

type From = Readonly<{ kind: 'copy' | 'resubmit'; id: string }>;

/**
 * A declined request carries the approver's edit; the submitter resubmits
 * from their own values, the ones before it.
 */
function resubmitted(approval: MailApproval): MailApproval {
  if (approval.state !== 'declined') return approval;
  return { ...approval, body_variables: valuesBeforeEdit(approval)?.before ?? approval.body_variables };
}

/** The templates and lists to pick from, and the request the form is filled from, loaded once. */
function ComposeCatalog({ from }: { from: From | null }) {
  const { roles, user } = useConsole();
  const access = sendAccess(roles);
  const catalog = useApiLoad(
    async (api, signal) => {
      const [templates, lists, approval] = await Promise.all([
        fetchSendableTemplates(api, signal),
        access.list ? fetchSendableLists(api, signal) : Promise.resolve<ListRow[]>([]),
        from ? fetchApproval(api, from.id, signal) : Promise.resolve(null),
      ]);
      return { templates, lists, approval };
    },
    `${access.list ? 'templates+lists' : 'templates'}:${from?.kind ?? ''}:${from?.id ?? ''}`,
  );
  if (catalog.status === 'loading') return <StateCard isLoading title="Template'ler ve listeler yükleniyor" />;
  if (catalog.status === 'error') {
    if (from && catalog.error.status === 404) {
      return (
        <StateCard Icon={SearchX} title="İstek bulunamadı" description="Bu adreste bir onay isteği yok ya da görme yetkin yok.">
          <Link href={APPROVAL_LIST_PATH} className="text-skylab-300 text-sm hover:underline">
            Mail onaylarına dön
          </Link>
        </StateCard>
      );
    }
    return (
      <StateCard Icon={AlertTriangle} tone="danger" title="Gönderim formu açılamadı" description={catalog.error.message}>
        <Button variant="secondary" onClick={() => void catalog.reload()}>
          Tekrar dene
        </Button>
      </StateCard>
    );
  }

  const { templates, lists, approval } = catalog.data;
  if (!from || !approval) return <Compose access={access} templates={templates} lists={lists} />;

  if (from.kind === 'resubmit') {
    const { state, actions } = viewerActions(approval, { sub: user.sub ?? null, approver: isApprover(roles) });
    if (!actions.includes('resubmit')) {
      return (
        <StateCard
          Icon={AlertTriangle}
          tone="warning"
          title="Bu istek yeniden sunulamaz"
          description={`Yalnız isteği sunan, reddedilen ya da düzenlemesi kabul edilmeyen bir isteği yeniden sunabilir. Bu istek: ${APPROVAL_STATE_LABEL[state]}.`}
        >
          <Link href={approvalHref(approval.id)} className="text-skylab-300 text-sm hover:underline">
            İsteğe dön
          </Link>
        </StateCard>
      );
    }
  }

  const source = from.kind === 'resubmit' ? resubmitted(approval) : approval;
  const prefill = composePrefill(source, { templates, lists, access });
  return (
    <Compose
      access={access}
      templates={templates}
      lists={lists}
      mode={{ kind: from.kind, approval }}
      prefill={prefill}
      intro={<PrefillIntro approval={approval} mode={from.kind} notes={prefill.notes} />}
    />
  );
}
