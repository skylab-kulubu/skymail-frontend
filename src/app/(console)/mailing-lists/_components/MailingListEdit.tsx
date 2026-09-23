'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { StateCard } from '@/components/chrome/StateCard';
import { useConsole } from '@/components/layout/ConsoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { RoleGate } from '@/components/layout/RoleGate';
import { ROLE } from '@/lib/access';
import { useApi, useApiLoad } from '@/lib/api/react';
import {
  GROUP_READ_ONLY_REASON,
  fetchList,
  listActions,
  listHref,
  renameList,
  toListRow,
  type MailingList,
} from '@/lib/mailing-lists';
import { flashNotice } from '@/components/chrome/flash';
import { ListLoadFailure } from './ListLoadFailure';
import { ListNameForm } from './ListNameForm';

export function MailingListEdit({ id }: { id: string }) {
  return (
    <RoleGate role={ROLE.listsWrite}>
      <EditLoader id={id} />
    </RoleGate>
  );
}

function EditLoader({ id }: { id: string }) {
  const { roles } = useConsole();
  const state = useApiLoad((api, signal) => fetchList(api, id, signal), id);

  if (state.status === 'loading') return <StateCard isLoading title="Liste yükleniyor" />;
  if (state.status === 'error') return <ListLoadFailure error={state.error} onRetry={() => void state.reload()} />;
  if (!listActions(toListRow(state.data), roles).change) {
    return (
      <StateCard Icon={Lock} tone="warning" title="Bu liste düzenlenemez" description={GROUP_READ_ONLY_REASON}>
        <Link href={listHref.show(state.data.id)} className="text-skylab-300 text-sm hover:underline">
          Listeye dön
        </Link>
      </StateCard>
    );
  }
  return <EditForm list={state.data} />;
}

function EditForm({ list }: { list: MailingList }) {
  const api = useApi();
  const router = useRouter();
  return (
    <div className="space-y-6">
      <PageHeader title="Mail listesini düzenle" description={`“${list.name}” listesinin adını değiştir.`} />
      <ListNameForm
        initialName={list.name}
        submitLabel="Kaydet"
        pendingLabel="Kaydediliyor…"
        cancelHref={listHref.show(list.id)}
        onSubmit={async (name) => {
          const saved = await renameList(api, list.id, name);
          flashNotice(listHref.show(list.id), {
            tone: 'success',
            text: `Liste adı “${saved.name}” olarak kaydedildi.`,
          });
          router.push(listHref.show(list.id));
        }}
      />
    </div>
  );
}
