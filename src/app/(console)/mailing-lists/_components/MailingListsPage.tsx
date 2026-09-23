'use client';

import Link from 'next/link';
import { AlertTriangle, Lock } from 'lucide-react';
import { FilterPills } from '@/components/chrome/FilterPills';
import { Notice } from '@/components/chrome/Notice';
import { Pagination } from '@/components/chrome/Pagination';
import { StateCard } from '@/components/chrome/StateCard';
import { Tag } from '@/components/chrome/Tag';
import { useConsole } from '@/components/layout/ConsoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/tables/DataTable';
import { ROW_ACTION_CLASS, RowActions } from '@/components/tables/RowActions';
import { Button } from '@/components/ui/Button';
import { CreatePageButton } from '@/components/ui/CreatePageButton';
import { ROLE, hasRole, sectionLabel } from '@/lib/access';
import { formatDateTime } from '@/lib/format';
import { LIFECYCLE_FILTERS, type Lifecycle } from '@/lib/list-view';
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
import { useArchivableList } from '@/lib/ui/use-archivable-list';
import { ArchiveListDialog, archivedNotice } from './ArchiveListDialog';

const EMPTY_TEXT: Record<Lifecycle, string> = {
  current: 'Henüz mail listesi yok.',
  inactive: 'Arşivlenmiş mail listesi yok.',
  all: 'Hiç mail listesi yok.',
};

export function MailingListsPage() {
  const { roles } = useConsole();
  const canWrite = hasRole(roles, ROLE.listsWrite);
  const list = useArchivableList({
    index: listHref.index,
    pageSize: LIST_PAGE_SIZE,
    load: fetchListPage,
    restore: restoreList,
    archivedNotice,
    canRestore: canWrite,
  });
  const { view, state } = list;

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
            render: (_: unknown, row: ListRow) => {
              const actions = listActions(row, roles);
              return (
                <RowActions
                  target={`“${row.name}” listesini`}
                  onArchive={actions.change ? () => list.askArchive(row) : undefined}
                  onRestore={actions.restore ? () => list.restore(row) : undefined}
                  restoring={list.isRestoring(row.id)}
                >
                  {actions.change ? (
                    <Link
                      href={listHref.edit(row.id)}
                      className={`${ROW_ACTION_CLASS} hover:text-skylab-300 text-neutral-400`}
                      aria-label={`“${row.name}” listesini düzenle`}
                    >
                      Düzenle
                    </Link>
                  ) : null}
                </RowActions>
              );
            },
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

      {list.notice ? <Notice {...list.notice} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterPills
          ariaLabel="Gösterilen listeler"
          value={view.lifecycle}
          options={LIFECYCLE_FILTERS}
          onChange={(next) => list.show({ lifecycle: next, page: 1 })}
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
            totalPages={list.lastPage ?? 1}
            onPageChange={(next) => list.show({ ...view, page: next })}
          />
        </div>
      )}

      <ArchiveListDialog
        list={list.archiveDialog.record}
        onClose={list.archiveDialog.onClose}
        onArchived={list.archiveDialog.onArchived}
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
