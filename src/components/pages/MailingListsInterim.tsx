'use client';

import { InterimList } from '@/components/pages/InterimList';

type ListRow = { id: string; name: string; description?: string | null };

export function MailingListsInterim() {
  return (
    <InterimList<ListRow>
      title="Mail listeleri"
      description="Internal listeler ve Keycloak grupları."
      path="/mailing_lists"
      columns={[
        { key: 'name', header: 'Ad' },
        { key: 'description', header: 'Açıklama', render: (value) => (value ? String(value) : '—') },
      ]}
    />
  );
}
