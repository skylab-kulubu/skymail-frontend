'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Lock, SearchX } from 'lucide-react';
import { StateCard } from '@/components/chrome/StateCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { useApi } from '@/lib/api/react';
import {
  GROUP_READ_ONLY_REASON,
  fetchList,
  isInternal,
  listHref,
  renameList,
  type MailingList,
} from '@/lib/mailing-lists';
import { flashNotice } from './flash';
import { ListNameForm } from './ListNameForm';
import { useLoad } from './use-load';
import { WriteGate } from './WriteGate';

export function MailingListEdit({ id }: { id: string }) {
  return (
    <WriteGate>
      <EditLoader id={id} />
    </WriteGate>
  );
}

function EditLoader({ id }: { id: string }) {
  const state = useLoad((api, signal) => fetchList(api, id, signal), id);

  if (state.status === 'loading') return <StateCard isLoading title="Liste yükleniyor" />;
  if (state.status === 'error') {
    if (state.error.status === 404) {
      return (
        <StateCard
          Icon={SearchX}
          title="Liste bulunamadı"
          description="Bu adreste bir liste yok ya da liste arşivlenmiş. Arşivlenmiş bir listeyi düzenlemek için önce Arşivli filtresinden geri al."
        >
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href={listHref.index} className="text-skylab-300 hover:underline">
              Mail listelerine dön
            </Link>
            <Link href={listHref.archived} className="text-skylab-300 hover:underline">
              Arşivli listeler
            </Link>
          </div>
        </StateCard>
      );
    }
    return (
      <StateCard Icon={AlertTriangle} tone="danger" title="Liste yüklenemedi" description={state.error.message}>
        <Button variant="secondary" onClick={() => void state.reload()}>
          Tekrar dene
        </Button>
      </StateCard>
    );
  }
  if (!isInternal(state.data)) {
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
