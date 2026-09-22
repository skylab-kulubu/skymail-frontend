'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertTriangle, Archive, Lock, Pencil, SearchX, Send, UserPlus } from 'lucide-react';
import { Pagination } from '@/components/chrome/Pagination';
import { StateCard } from '@/components/chrome/StateCard';
import { useCan } from '@/components/layout/ConsoleContext';
import { DataTable } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalDangerActions } from '@/components/ui/modal-actions';
import { ROLE } from '@/lib/access';
import { ApiError } from '@/lib/api/errors';
import { useApi } from '@/lib/api/react';
import { pageCount } from '@/lib/list-view';
import {
  GROUP_READ_ONLY_REASON,
  RECIPIENT_PAGE_SIZE,
  archiveList,
  fetchList,
  fetchRecipientPage,
  isInternal,
  listHref,
  removeRecipient,
  type MailingList,
  type Recipient,
} from '@/lib/mailing-lists';
import { AddRecipientModal } from './AddRecipientModal';
import { flashNotice, useFlashNotice } from './flash';
import { formatDateTime } from './format';
import { Notice, type NoticeData } from './Notice';
import { Tag } from './Tag';
import { useLoad } from './use-load';

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : new ApiError(0, 'network').message;
}

/** One list: what it is, who is on it, and — for an internal list — changing both. */
export function MailingListShow({ id }: { id: string }) {
  const state = useLoad((api, signal) => fetchList(api, id, signal), id);

  if (state.status === 'loading') return <StateCard isLoading title="Liste yükleniyor" />;
  if (state.status === 'error') {
    if (state.error.status === 404) {
      return (
        <StateCard
          Icon={SearchX}
          title="Liste bulunamadı"
          description="Bu adreste bir liste yok ya da liste arşivlenmiş. Arşivlenmiş bir liste, Mail listeleri ekranındaki Arşivli filtresinde görünür ve oradan geri alınabilir."
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
  return <ListDetail list={state.data} />;
}

function ListDetail({ list }: { list: MailingList }) {
  const api = useApi();
  const router = useRouter();
  const canWrite = useCan(ROLE.listsWrite);
  const canCompose = useCan(ROLE.mailsWrite);
  const internal = isInternal(list);
  const editable = internal && canWrite;

  const [notice, setNotice] = useFlashNotice(listHref.show(list.id));
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  async function archive() {
    setArchiving(true);
    setArchiveError(null);
    try {
      await archiveList(api, list.id);
      flashNotice(listHref.index, {
        tone: 'success',
        text: `“${list.name}” arşivlendi. Alıcıları ve geçmiş gönderimleri korunuyor.`,
        restore: { id: list.id, name: list.name },
      });
      router.push(listHref.index);
    } catch (error) {
      setArchiveError(message(error));
      setArchiving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 border-b border-white/5 pb-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-lg font-medium break-words text-neutral-100">{list.name}</h1>
            {internal ? null : <Tag tone="external">Harici</Tag>}
          </div>
          {internal ? (
            <p className="text-sm text-neutral-500">Internal liste</p>
          ) : (
            <p className="text-sm break-all text-neutral-500">{list.description ?? 'Keycloak grubu'}</p>
          )}
        </div>
        {internal && (canCompose || canWrite) ? (
          <div className="flex flex-wrap gap-2">
            {canCompose ? (
              <Button href={`/mail-tasks/create?mail_list_id=${encodeURIComponent(list.id)}`}>
                <Send className="h-4 w-4" aria-hidden />
                Yeni gönderim
              </Button>
            ) : null}
            {canWrite ? (
              <>
                <Button variant="secondary" href={listHref.edit(list.id)}>
                  <Pencil className="h-4 w-4" aria-hidden />
                  Düzenle
                </Button>
                <Button
                  variant="outlineDanger"
                  onClick={() => {
                    setArchiveError(null);
                    setArchiveOpen(true);
                  }}
                >
                  <Archive className="h-4 w-4" aria-hidden />
                  Arşivle
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {notice ? (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      ) : null}

      {internal ? null : (
        <div className="flex items-start gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-300">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">Salt okunur liste</p>
            <p className="leading-relaxed">{GROUP_READ_ONLY_REASON}</p>
          </div>
        </div>
      )}

      <dl className="grid gap-4 rounded-lg border border-white/5 bg-white/[0.02] p-4 sm:grid-cols-3">
        <div className="min-w-0 space-y-1">
          <dt className="text-2xs tracking-wider text-neutral-500 uppercase">Liste ID</dt>
          <dd className="font-mono text-xs break-all text-neutral-200">{list.id}</dd>
        </div>
        <div className="min-w-0 space-y-1">
          <dt className="text-2xs tracking-wider text-neutral-500 uppercase">Kaynak</dt>
          <dd className="text-sm text-neutral-200">{internal ? 'SkyMail' : 'Keycloak grubu'}</dd>
        </div>
        {internal ? (
          <div className="min-w-0 space-y-1">
            <dt className="text-2xs tracking-wider text-neutral-500 uppercase">Oluşturulma</dt>
            <dd className="text-sm text-neutral-200">{formatDateTime(list.created_at)}</dd>
          </div>
        ) : null}
      </dl>

      <Recipients list={list} editable={editable} />

      <Modal
        isOpen={archiveOpen}
        onClose={() => (archiving ? undefined : setArchiveOpen(false))}
        title="Listeyi arşivle"
      >
        <p className="leading-relaxed">
          <strong className="font-medium text-neutral-100">“{list.name}”</strong> arşivlenecek. Alıcıları ve geçmiş
          gönderimleri silinmez; listeyi Mail listeleri ekranındaki Arşivli filtresinden geri alabilirsin. Arşivdeki
          bir listeye gönderim yapılamaz.
        </p>
        {archiveError ? (
          <p role="alert" className="mt-3 text-red-300">
            {archiveError}
          </p>
        ) : null}
        <ModalDangerActions
          onCancel={() => setArchiveOpen(false)}
          onConfirm={() => void archive()}
          confirmLabel="Arşivle"
          pendingLabel="Arşivleniyor…"
          isPending={archiving}
        />
      </Modal>
    </div>
  );
}

function Recipients({ list, editable }: { list: MailingList; editable: boolean }) {
  const api = useApi();
  const external = !isInternal(list);
  const [page, setPage] = useState(1);
  // Said next to the table it changed, not at the top of a page scrolled past.
  const [notice, setNotice] = useState<NoticeData | null>(null);
  const [adding, setAdding] = useState(false);
  const [toRemove, setToRemove] = useState<Recipient | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const state = useLoad(
    (client, signal) => fetchRecipientPage(client, { id: list.id, external }, page, signal),
    `${list.id}:${page}`,
  );
  const lastPage = state.status === 'success' ? pageCount(state.data.total, RECIPIENT_PAGE_SIZE) : null;

  // Removing the last recipient on a later page moves back to the last page there is.
  useEffect(() => {
    if (lastPage !== null && page > lastPage) setPage(lastPage);
  }, [lastPage, page]);

  async function remove(recipient: Recipient) {
    setRemoving(true);
    setRemoveError(null);
    try {
      await removeRecipient(api, list.id, recipient.id);
      await state.reload();
      setToRemove(null);
      setNotice({ tone: 'success', text: `${recipient.full_name} (${recipient.email}) listeden çıkarıldı.` });
    } catch (error) {
      setRemoveError(message(error));
    } finally {
      setRemoving(false);
    }
  }

  const columns = [
    { key: 'full_name', header: 'Ad soyad' },
    { key: 'email', header: 'E-posta' },
    ...(editable
      ? [
          {
            key: 'actions',
            header: 'İşlemler',
            render: (_: unknown, recipient: Recipient) => (
              <button
                type="button"
                onClick={() => {
                  setRemoveError(null);
                  setToRemove(recipient);
                }}
                aria-label={`${recipient.full_name} alıcısını listeden çıkar`}
                className="focus-visible:ring-skylab-400/40 cursor-pointer rounded text-neutral-400 hover:text-red-300 focus-visible:ring-2 focus-visible:outline-none"
              >
                Çıkar
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <section aria-labelledby="recipients-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="recipients-heading" className="text-base font-medium text-neutral-100">
          Alıcılar
          {state.status === 'success' ? (
            <span className="ml-2 text-sm font-normal text-neutral-500 tabular-nums">{state.data.total}</span>
          ) : null}
        </h2>
        {editable ? (
          <Button onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" aria-hidden />
            Alıcı ekle
          </Button>
        ) : null}
      </div>

      {notice ? (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      ) : null}

      {state.status === 'loading' ? (
        <StateCard isLoading title="Alıcılar yükleniyor" />
      ) : state.status === 'error' ? (
        <StateCard Icon={AlertTriangle} tone="danger" title="Alıcılar yüklenemedi" description={state.error.message}>
          <Button variant="secondary" onClick={() => void state.reload()}>
            Tekrar dene
          </Button>
        </StateCard>
      ) : (
        <div className="space-y-2">
          <DataTable
            data={state.data.recipients}
            columns={columns}
            emptyText={
              external ? 'Bu grupta e-posta adresi olan üye yok.' : 'Bu listede henüz alıcı yok.'
            }
          />
          <Pagination current={page} totalPages={lastPage ?? 1} onPageChange={setPage} />
        </div>
      )}

      <AddRecipientModal
        isOpen={adding}
        listId={list.id}
        onClose={() => setAdding(false)}
        onAdded={async (recipient) => {
          // The API lists the newest recipients first.
          if (page === 1) await state.reload();
          else setPage(1);
          setAdding(false);
          setNotice({ tone: 'success', text: `${recipient.full_name} (${recipient.email}) listeye eklendi.` });
        }}
      />

      <Modal
        isOpen={toRemove !== null}
        onClose={() => (removing ? undefined : setToRemove(null))}
        title="Alıcıyı listeden çıkar"
      >
        {toRemove ? (
          <>
            <p className="leading-relaxed">
              <strong className="font-medium text-neutral-100">{toRemove.full_name}</strong> ({toRemove.email}) bu
              listeden çıkarılacak. Başka listelerdeyse orada kalır; geçmiş gönderimler etkilenmez.
            </p>
            {removeError ? (
              <p role="alert" className="mt-3 text-red-300">
                {removeError}
              </p>
            ) : null}
            <ModalDangerActions
              onCancel={() => setToRemove(null)}
              onConfirm={() => void remove(toRemove)}
              confirmLabel="Çıkar"
              pendingLabel="Çıkarılıyor…"
              isPending={removing}
            />
          </>
        ) : null}
      </Modal>
    </section>
  );
}
