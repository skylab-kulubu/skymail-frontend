'use client';

import { InterimList } from '@/components/pages/InterimList';
import { sectionLabel } from '@/lib/access';

type TemplateRow = { id: string; name: string; key: string | null; subject: string; system: boolean };

export function TemplatesInterim() {
  return (
    <InterimList<TemplateRow>
      title={sectionLabel('/templates')}
      description="Kulübün gönderdiği her mailin konusu ve gövdesi."
      path="/templates"
      columns={[
        { key: 'name', header: 'Ad' },
        { key: 'key', header: 'Template key', render: (value) => (value ? String(value) : '—') },
        { key: 'subject', header: 'Konu' },
        { key: 'system', header: 'System template', render: (value) => (value ? 'Evet' : '—') },
      ]}
    />
  );
}
