'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertTriangle, Archive, Lock, Pencil, Send, UserPlus } from 'lucide-react';
import { Pagination } from '@/components/chrome/Pagination';
import { StateCard } from '@/components/chrome/StateCard';
import { useConsole } from '@/components/layout/ConsoleContext';
import { DataTable } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalDangerActions } from '@/components/ui/modal-actions';
import { apiErrorMessage } from '@/lib/api/errors';
import { useApi, useApiLoad } from '@/lib/api/react';
import { pageCount } from '@/lib/list-view';
import {
  GROUP_READ_ONLY_REASON,
  RECIPIENT_PAGE_SIZE,
  fetchList,
  fetchRecipientPage,
  listActions,
  listHref,
  removeRecipient,
  toListRow,
  type MailingList,
  type Recipient,
} from '@/lib/mailing-lists';
import { AddRecipientModal } from './AddRecipientModal';
import { ArchiveListDialog, archivedNotice } from './ArchiveListDialog';
import { flashNotice, useFlashNotice, type NoticeData } from '@/lib/notice';
import { formatDateTime } from '@/lib/format';
import { ListLoadFailure } from './ListLoadFailure';
import { Notice } from '@/components/chrome/Notice';
import { Tag } from '@/components/chrome/Tag';

/** One list: what it is, who is on it, and — for an internal list — changing both. */
export function MailingListShow({ id }: { id: string }) {
  const state = useApiLoad((api, signal) => fetchList(api, id, signal), id);

  if (state.status === 'loading') return <StateCard isLoading title="Liste yükleniyor" />;
  if (state.status === 'error') return <ListLoadFailure error={state.error} onRetry={() => void state.reload()} />;
  return <ListDetail list={state.data} />;
}

function ListDetail({ list }: { list: MailingList }) {
  const router = useRouter();
  const { roles } = useConsole();
  const row = toListRow(list);
  const actions = listActions(row, roles);

  const [notice, setNotice] = useFlashNotice(listHref.show(list.id));
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="space-y-3 border-b border-white/5 pb-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-lg font-medium break-words text-neutral-100">{list.name}</h1>
            {row.external ? <Tag tone="external">Harici</Tag> : null}
          </div>
          {row.external ? (
            <p className="text-sm break-all text-neutral-500">{row.groupPath ?? 'Keycloak grubu'}</p>
          ) : (
            <p className="text-sm text-neutral-500">Internal liste</p>
          )}
        </div>
        {actions.compose || actions.change ? (
          <div className="flex flex-wrap gap-2">
            {actions.compose ? (
              <Button href={`/mail-tasks/create?mail_list_id=${encodeURIComponent(list.id)}`}>
                <Send className="h-4 w-4" aria-hidden />
                Yeni gönderim
              </Button>
            ) : null}
            {actions.change ? (
              <>
                <Button variant="secondary" href={listHref.edit(list.id)}>
                  <Pencil className="h-4 w-4" aria-hidden />
                  Düzenle
                </Button>
                <Button variant="outlineDanger" onClick={() => setArchiveOpen(true)}>
                  <Archive className="h-4 w-4" aria-hidden />
                  Arşivle
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} /> : null}

      {actions.readOnly ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-300">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">Salt okunur liste</p>
            <p className="leading-relaxed">{GROUP_READ_ONLY_REASON}</p>
          </div>
        </div>
      ) : null}

      <dl className="grid gap-4 rounded-lg border border-white/5 bg-white/[0.02] p-4 sm:grid-cols-3">
        <div className="min-w-0 space-y-1">
          <dt className="text-2xs tracking-wider text-neutral-500 uppercase">Liste ID</dt>
          <dd className="font-mono text-xs break-all text-neutral-200">{list.id}</dd>
        </div>
        <div className="min-w-0 space-y-1">
          <dt className="text-2xs tracking-wider text-neutral-500 uppercase">Kaynak</dt>
          <dd className="text-sm text-neutral-200">{row.external ? 'Keycloak grubu' : 'SkyMail'}</dd>
        </div>
        {row.createdAt ? (
          <div className="min-w-0 space-y-1">
            <dt className="text-2xs tracking-wider text-neutral-500 uppercase">Oluşturulma</dt>
            <dd className="text-sm text-neutral-200">{formatDateTime(row.createdAt)}</dd>
          </div>
        ) : null}
      </dl>

      <Recipients list={list} external={row.external} editable={actions.change} />

      <ArchiveListDialog
        list={archiveOpen ? list : null}
        onClose={() => setArchiveOpen(false)}
        onArchived={(archived) => {
          flashNotice(listHref.index, archivedNotice(archived));
          router.push(listHref.index);
        }}
      />
    </div>
  );
}

function Recipients({ list, external, editable }: { list: MailingList; external: boolean; editable: boolean }) {
  const api = useApi();
  const [page, setPage] = useState(1);
  // Said next to the table it changed, not at the top of a page scrolled past.
  const [notice, setNotice] = useState<NoticeData | null>(null);
  const [adding, setAdding] = useState(false);
  const [toRemove, setToRemove] = useState<Recipient | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const state = useApiLoad(
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
      setRemoveError(apiErrorMessage(error));
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

      {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} /> : null}

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
            emptyText={external ? 'Bu grupta e-posta adresi olan üye yok.' : 'Bu listede henüz alıcı yok.'}
          />
          <Pagination
            ariaLabel="Alıcı sayfaları"
            current={page}
            totalPages={lastPage ?? 1}
            onPageChange={setPage}
          />
        </div>
      )}

      <AddRecipientModal
        isOpen={adding}
        listId={list.id}
        onClose={() => setAdding(false)}
        onAdded={async (recipient) => {
          // The API answers 201 whether the address was added or already on
          // the list, and orders recipients by when the recipient record was
          // first created, so the row may be on any page: refresh this one
          // (and the total) and say only what is sure.
          await state.reload();
          setAdding(false);
          setNotice({ tone: 'success', text: `${recipient.full_name} (${recipient.email}) listede.` });
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
