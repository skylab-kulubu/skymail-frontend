'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { useApi } from '@/lib/api/react';
import { createList, listHref } from '@/lib/mailing-lists';
import { flashNotice } from './flash';
import { ListNameForm } from './ListNameForm';
import { WriteGate } from './WriteGate';

export function MailingListCreate() {
  return (
    <WriteGate>
      <CreateForm />
    </WriteGate>
  );
}

function CreateForm() {
  const api = useApi();
  const router = useRouter();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Yeni mail listesi"
        description="Internal bir liste oluştur; alıcılarını ardından listenin sayfasında eklersin."
      />
      <ListNameForm
        submitLabel="Oluştur"
        pendingLabel="Oluşturuluyor…"
        cancelHref={listHref.index}
        onSubmit={async (name) => {
          const created = await createList(api, name);
          flashNotice(listHref.show(created.id), {
            tone: 'success',
            text: `“${created.name}” oluşturuldu. Şimdi alıcı ekleyebilirsin.`,
          });
          router.push(listHref.show(created.id));
        }}
      />
    </div>
  );
}
