'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { FilterPills } from '@/components/chrome/FilterPills';
import { Pagination } from '@/components/chrome/Pagination';
import { StateCard } from '@/components/chrome/StateCard';
import { useConsole } from '@/components/layout/ConsoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/Button';
import { CreatePageButton } from '@/components/ui/CreatePageButton';
import { ROLE, hasRole, sectionLabel } from '@/lib/access';
import { apiErrorMessage } from '@/lib/api/errors';
import { useApi, useApiLoad } from '@/lib/api/react';
import {
  LIFECYCLE_FILTERS,
  listViewHref,
  pageCount,
  readListView,
  type Lifecycle,
  type ListView,
} from '@/lib/list-view';
import {
  GROUP_READ_ONLY_NOTE,
  LIST_PAGE_SIZE,
  fetchListPage,
  listActions,
  listHref,
  restoreList,
  type ListActions,
  type ListRow,
} from '@/lib/mailing-lists';
import { ArchiveListDialog, archivedNotice } from './ArchiveListDialog';
import { useFlashNotice } from '@/components/chrome/flash';
import { formatDateTime } from '@/lib/format';
import { Notice } from '@/components/chrome/Notice';
import { Tag } from '@/components/chrome/Tag';

const EMPTY_TEXT: Record<Lifecycle, string> = {
  current: 'Henüz mail listesi yok.',
  inactive: 'Arşivlenmiş mail listesi yok.',
  all: 'Hiç mail listesi yok.',
};

const ACTION_CLASS =
  'focus-visible:ring-skylab-400/40 cursor-pointer rounded focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

type ListRef = Readonly<{ id: string; name: string }>;

export function MailingListsPage() {
  const api = useApi();
  const router = useRouter();
  const pathname = usePathname() || listHref.index;
  const params = useSearchParams();
  const view = readListView(params);
  const { roles } = useConsole();
  const canWrite = hasRole(roles, ROLE.listsWrite);

  const [notice, setNotice] = useFlashNotice(listHref.index);
  const [toArchive, setToArchive] = useState<ListRef | null>(null);
  // Per row: two restores in flight must not clear each other's busy state.
  const [restoring, setRestoring] = useState<ReadonlySet<string>>(() => new Set());

  const state = useApiLoad(
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

  function markRestoring(id: string, busy: boolean) {
    setRestoring((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function restore(list: ListRef) {
    markRestoring(list.id, true);
    try {
      await restoreList(api, list.id);
      await state.reload();
      setNotice({ tone: 'success', text: `“${list.name}” geri alındı; yeniden aktif.` });
    } catch (error) {
      setNotice({ tone: 'error', text: `“${list.name}” geri alınamadı. ${apiErrorMessage(error)}` });
    } finally {
      markRestoring(list.id, false);
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Liste',
      render: (_: unknown, row: ListRow) => <ListName row={row} actions={listActions(row, roles)} />,
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
                actions={listActions(row, roles)}
                restoring={restoring.has(row.id)}
                onArchive={() => setToArchive(row)}
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
          notice={notice}
          onDismiss={() => setNotice(null)}
          onRestore={canWrite ? (list) => void restore(list) : undefined}
          restoring={notice.restore ? restoring.has(notice.restore.id) : false}
        />
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
            ariaLabel="Liste sayfaları"
            current={view.page}
            totalPages={lastPage ?? 1}
            onPageChange={(next) => show({ ...view, page: next })}
          />
        </div>
      )}

      <ArchiveListDialog
        list={toArchive}
        onClose={() => setToArchive(null)}
        onArchived={async (list) => {
          await state.reload();
          setToArchive(null);
          setNotice(archivedNotice(list));
        }}
      />
    </div>
  );
}

/**
 * The name, the Harici or Arşivli tag beside it, and under it the group path
 * and why the group is read-only, or the archive time. Written out, not in a
 * tooltip, so it reads on a phone and to a keyboard.
 */
function ListName({ row, actions }: { row: ListRow; actions: ListActions }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        {actions.open ? (
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
      {actions.readOnly ? (
        <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-neutral-500">
          <Lock className="h-3 w-3 shrink-0" aria-hidden />
          {GROUP_READ_ONLY_NOTE}
        </p>
      ) : null}
      {row.archivedAt ? (
        <p className="mt-0.5 text-xs text-neutral-500">Arşivlendi: {formatDateTime(row.archivedAt)}</p>
      ) : null}
    </div>
  );
}

function RowActions({
  row,
  actions,
  restoring,
  onArchive,
  onRestore,
}: {
  row: ListRow;
  actions: ListActions;
  restoring: boolean;
  onArchive: () => void;
  onRestore: () => void;
}) {
  return (
    <div className="flex gap-3">
      {actions.change ? (
        <>
          <Link
            href={listHref.edit(row.id)}
            className={`${ACTION_CLASS} hover:text-skylab-300 text-neutral-400`}
            aria-label={`“${row.name}” listesini düzenle`}
          >
            Düzenle
          </Link>
          <button
            type="button"
            onClick={onArchive}
            className={`${ACTION_CLASS} text-neutral-400 hover:text-red-300`}
            aria-label={`“${row.name}” listesini arşivle`}
          >
            Arşivle
          </button>
        </>
      ) : null}
      {actions.restore ? (
        <button
          type="button"
          onClick={onRestore}
          disabled={restoring}
          className={`${ACTION_CLASS} text-skylab-300 font-medium hover:underline`}
          aria-label={`“${row.name}” listesini geri al`}
        >
          {restoring ? 'Geri alınıyor…' : 'Geri al'}
        </button>
      ) : null}
    </div>
  );
}
