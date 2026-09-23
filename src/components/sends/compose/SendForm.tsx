'use client';

// A new send (ticket 16): a Mail template or a free announcement, to a
// mailing list or to people one by one, with the template's variables filled
// in and the mail previewed as it goes out. superadmin links an Event's list
// here as ?mail_list_id=<id>, and the list is preselected. Only a template's
// published version is ever sent; a free announcement's body is written in
// the Visual editor and still goes through the server's allow-list.
//
// Who may open it: the shell's RoleGate asks for mails:send or mails:write
// (access.ts requiredRolesFor); a template to send needs templates:read too.

import { AlertTriangle } from 'lucide-react';
import { StateCard } from '@/components/chrome/StateCard';
import { useConsole } from '@/components/layout/ConsoleContext';
import { RoleGate } from '@/components/layout/RoleGate';
import { Button } from '@/components/ui/Button';
import { ROLE } from '@/lib/access';
import { useApiLoad } from '@/lib/api/react';
import type { ListRow } from '@/lib/mailing-lists';
import { sendAccess } from '@/lib/send-form/access';
import { fetchSendableLists, fetchSendableTemplates } from '@/lib/send-form/send';
import { Compose } from './Compose';

export function SendForm() {
  return (
    <RoleGate role={ROLE.templatesRead}>
      <Catalog />
    </RoleGate>
  );
}

/** The templates and lists to pick from, loaded once. */
function Catalog() {
  const access = sendAccess(useConsole().roles);
  const catalog = useApiLoad(
    async (api, signal) => {
      const [templates, lists] = await Promise.all([
        fetchSendableTemplates(api, signal),
        access.list ? fetchSendableLists(api, signal) : Promise.resolve<ListRow[]>([]),
      ]);
      return { templates, lists };
    },
    access.list ? 'templates+lists' : 'templates',
  );
  if (catalog.status === 'loading') return <StateCard isLoading title="Template'ler ve listeler yükleniyor" />;
  if (catalog.status === 'error') {
    return (
      <StateCard Icon={AlertTriangle} tone="danger" title="Gönderim formu açılamadı" description={catalog.error.message}>
        <Button variant="secondary" onClick={() => void catalog.reload()}>
          Tekrar dene
        </Button>
      </StateCard>
    );
  }
  return <Compose access={access} templates={catalog.data.templates} lists={catalog.data.lists} />;
}
