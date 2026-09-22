'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { FilterPills } from '@/components/chrome/FilterPills';
import { Pagination } from '@/components/chrome/Pagination';
import { StateCard } from '@/components/chrome/StateCard';
import { useCan } from '@/components/layout/ConsoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/Button';
import { CreatePageButton } from '@/components/ui/CreatePageButton';
import { Modal } from '@/components/ui/Modal';
import { ModalDangerActions } from '@/components/ui/modal-actions';
import { ROLE, sectionLabel } from '@/lib/access';
import { ApiError } from '@/lib/api/errors';
import { useApi } from '@/lib/api/react';
import {
  LIFECYCLE_FILTERS,
  listViewHref,
  pageCount,
  readListView,
  type Lifecycle,
  type ListView,
} from '@/lib/list-view';
import {
  GROUP_READ_ONLY_REASON,
  LIST_PAGE_SIZE,
  archiveList,
  fetchListPage,
  listActions,
  listHref,
  restoreList,
  type ListRow,
} from '@/lib/mailing-lists';
import { useFlashNotice } from './flash';
import { formatDateTime } from './format';
import { Notice } from './Notice';
import { Tag } from './Tag';
import { useLoad } from './use-load';

const EMPTY_TEXT: Record<Lifecycle, string> = {
  current: 'Henüz mail listesi yok.',
  inactive: 'Arşivlenmiş mail listesi yok.',
  all: 'Hiç mail listesi yok.',
};

const ACTION_CLASS =
  'focus-visible:ring-skylab-400/40 cursor-pointer rounded focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : new ApiError(0, 'network').message;
}

export function MailingListsPage() {
  const api = useApi();
  const router = useRouter();
  const pathname = usePathname() || listHref.index;
  const params = useSearchParams();
  const view = readListView(params);
  const canWrite = useCan(ROLE.listsWrite);

  const [notice, setNotice] = useFlashNotice(listHref.index);
  const [toArchive, setToArchive] = useState<ListRow | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const state = useLoad(
    (client, signal) => fetchListPage(client, view, signal),
    `${view.lifecycle}:${view.page}`,
  );
  const lastPage = state.status === 'success' ? pageCount(state.data.total, LIST_PAGE_SIZE) : null;

  function show(next: ListView) {
    router.push(listViewHref(pathname, next), { scroll: false });
  }

  // A page that emptied — its last row archived, or a stale link — moves to the last page there is.
  const { lifecycle, page } = view;
  useEffect(() => {
    if (lastPage !== null && page > lastPage) {
      router.replace(listViewHref(pathname, { lifecycle, page: lastPage }), { scroll: false });
    }
  }, [lastPage, lifecycle, page, pathname, router]);

  async function archive(row: ListRow) {
    setPending(row.id);
    setArchiveError(null);
    try {
      await archiveList(api, row.id);
      await state.reload();
      setToArchive(null);
      setNotice({
        tone: 'success',
        text: `“${row.name}” arşivlendi. Alıcıları ve geçmiş gönderimleri korunuyor.`,
        restore: { id: row.id, name: row.name },
      });
    } catch (error) {
      setArchiveError(message(error));
    } finally {
      setPending(null);
    }
  }

  async function restore(row: { id: string; name: string }) {
    setPending(row.id);
    try {
      await restoreList(api, row.id);
      await state.reload();
      setNotice({ tone: 'success', text: `“${row.name}” geri alındı; yeniden aktif.` });
    } catch (error) {
      setNotice({ tone: 'error', text: `“${row.name}” geri alınamadı. ${message(error)}` });
    } finally {
      setPending(null);
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Liste',
      render: (_: unknown, row: ListRow) => <ListName row={row} />,
    },
    {
      key: 'createdAt',
      header: 'Oluşturulma',
      render: (value: string | null) =>
        value ? formatDateTime(value) : <span className="text-neutral-500">—</span>,
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: 'İşlemler',
            render: (_: unknown, row: ListRow) => (
              <RowActions
                row={row}
                busy={pending === row.id}
                onArchive={() => {
                  setArchiveError(null);
                  setToArchive(row);
                }}
                onRestore={() => void restore(row)}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={sectionLabel('/mailing-lists')}
        description="Internal listeler ve Keycloak grupları."
        actions={canWrite ? <CreatePageButton href={listHref.create}>Yeni liste</CreatePageButton> : null}
      />

      {notice ? (
        <Notice
          tone={notice.tone}
          onDismiss={() => setNotice(null)}
          action={
            notice.restore && canWrite ? (
              <button
                type="button"
                disabled={pending === notice.restore.id}
                onClick={() => notice.restore && void restore(notice.restore)}
                className="focus-visible:ring-skylab-400/40 rounded text-sm font-medium underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              >
                Geri al
              </button>
            ) : null
          }
        >
          {notice.text}
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterPills
          ariaLabel="Gösterilen listeler"
          value={view.lifecycle}
          options={LIFECYCLE_FILTERS}
          onChange={(next) => show({ lifecycle: next, page: 1 })}
        />
        {state.status === 'success' ? (
          <p className="text-xs text-neutral-500 tabular-nums">{state.data.total} liste</p>
        ) : null}
      </div>

      {state.status === 'loading' ? (
        <StateCard isLoading title="Listeler yükleniyor" />
      ) : state.status === 'error' ? (
        <StateCard Icon={AlertTriangle} tone="danger" title="Listeler yüklenemedi" description={state.error.message}>
          <Button variant="secondary" onClick={() => void state.reload()}>
            Tekrar dene
          </Button>
        </StateCard>
      ) : (
        <div className="space-y-2">
          <DataTable data={state.data.rows} columns={columns} emptyText={EMPTY_TEXT[view.lifecycle]} />
          <Pagination
            current={view.page}
            totalPages={lastPage ?? 1}
            onPageChange={(next) => show({ ...view, page: next })}
          />
        </div>
      )}

      <Modal
        isOpen={toArchive !== null}
        onClose={() => (pending ? undefined : setToArchive(null))}
        title="Listeyi arşivle"
      >
        {toArchive ? (
          <>
            <p className="leading-relaxed">
              <strong className="font-medium text-neutral-100">“{toArchive.name}”</strong> arşivlenecek. Alıcıları
              ve geçmiş gönderimleri silinmez; listeyi Arşivli filtresinden geri alabilirsin. Arşivdeki bir listeye
              gönderim yapılamaz.
            </p>
            {archiveError ? (
              <p role="alert" className="mt-3 text-red-300">
                {archiveError}
              </p>
            ) : null}
            <ModalDangerActions
              onCancel={() => setToArchive(null)}
              onConfirm={() => void archive(toArchive)}
              confirmLabel="Arşivle"
              pendingLabel="Arşivleniyor…"
              isPending={pending === toArchive.id}
            />
          </>
        ) : null}
      </Modal>
    </div>
  );
}

/** The name, the Harici or Arşivli tag beside it, and the group path or archive time under it. */
function ListName({ row }: { row: ListRow }) {
  // Every read of an archived list answers 404; it is restored, not opened.
  const openable = !row.archivedAt;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        {openable ? (
          <Link
            href={listHref.show(row.id)}
            className="hover:text-skylab-300 font-medium text-neutral-100 hover:underline"
          >
            {row.name}
          </Link>
        ) : (
          <span className="font-medium text-neutral-300">{row.name}</span>
        )}
        {row.external ? <Tag tone="external">Harici</Tag> : null}
        {row.archivedAt ? <Tag tone="archived">Arşivli</Tag> : null}
      </div>
      {row.groupPath ? <p className="mt-0.5 text-xs text-neutral-500">{row.groupPath}</p> : null}
      {row.archivedAt ? (
        <p className="mt-0.5 text-xs text-neutral-500">Arşivlendi: {formatDateTime(row.archivedAt)}</p>
      ) : null}
    </div>
  );
}

function RowActions({
  row,
  busy,
  onArchive,
  onRestore,
}: {
  row: ListRow;
  busy: boolean;
  onArchive: () => void;
  onRestore: () => void;
}) {
  // The column is shown to writers only; a reader opens a list by its name.
  const actions = listActions(row, true);
  if (row.external) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500" title={GROUP_READ_ONLY_REASON}>
        <Lock className="h-3.5 w-3.5" aria-hidden />
        Salt okunur
      </span>
    );
  }
  return (
    <div className="flex gap-3">
      {actions.includes('edit') ? (
        <Link
          href={listHref.edit(row.id)}
          className={`${ACTION_CLASS} hover:text-skylab-300 text-neutral-400`}
          aria-label={`“${row.name}” listesini düzenle`}
        >
          Düzenle
        </Link>
      ) : null}
      {actions.includes('archive') ? (
        <button
          type="button"
          onClick={onArchive}
          className={`${ACTION_CLASS} text-neutral-400 hover:text-red-300`}
          aria-label={`“${row.name}” listesini arşivle`}
        >
          Arşivle
        </button>
      ) : null}
      {actions.includes('restore') ? (
        <button
          type="button"
          onClick={onRestore}
          disabled={busy}
          className={`${ACTION_CLASS} text-skylab-300 font-medium hover:underline`}
          aria-label={`“${row.name}” listesini geri al`}
        >
          {busy ? 'Geri alınıyor…' : 'Geri al'}
        </button>
      ) : null}
    </div>
  );
}
