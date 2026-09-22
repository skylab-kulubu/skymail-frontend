'use client';

import { InterimList } from '@/components/pages/InterimList';
import { sectionLabel } from '@/lib/access';

type ListRow = { id: string; name: string; description?: string | null };

export function MailingListsInterim() {
  return (
    <InterimList<ListRow>
      title={sectionLabel('/mailing-lists')}
      description="Internal listeler ve Keycloak grupları."
      path="/mailing_lists"
      columns={[
        { key: 'name', header: 'Ad' },
        { key: 'description', header: 'Açıklama', render: (value) => (value ? String(value) : '—') },
      ]}
    />
  );
}
