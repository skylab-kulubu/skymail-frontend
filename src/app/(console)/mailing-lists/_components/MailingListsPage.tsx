'use client';

import Link from 'next/link';
import { AlertTriangle, Lock, Plus } from 'lucide-react';
import { Badge, Button, FilterPills, Pagination, StateCard } from '@skylab-kulubu/skylcn-ui';
import { useConsole } from '@/components/layout/ConsoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/tables/DataTable';
import { ROW_ACTION_CLASS, RowActions } from '@/components/tables/RowActions';
import { NavButton } from '@/components/common/NavButton';
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
import { OutcomeNotice } from '@/components/common/OutcomeNotice';

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
        value ? formatDateTime(value) : <span className="text-subtle-foreground">—</span>,
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
                      className={`${ROW_ACTION_CLASS} hover:text-skylab-300 text-muted-foreground`}
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
        actions={canWrite ? <NavButton variant="primary" href={listHref.create}><Plus aria-hidden />Yeni liste</NavButton> : null}
      />

      {list.notice ? <OutcomeNotice {...list.notice} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterPills
          aria-label="Gösterilen listeler"
          value={view.lifecycle}
          options={LIFECYCLE_FILTERS}
          onValueChange={(next) => list.show({ lifecycle: next, page: 1 })}
        />
        {state.status === 'success' ? (
          <p className="text-xs text-subtle-foreground tabular-nums">{state.data.total} liste</p>
        ) : null}
      </div>

      {state.status === 'loading' ? (
        <StateCard loading title="Listeler yükleniyor" />
      ) : state.status === 'error' ? (
        <StateCard icon={AlertTriangle} tone="danger" title="Listeler yüklenemedi" description={state.error.message}>
          <Button variant="outline" onClick={() => void state.reload()}>
            Tekrar dene
          </Button>
        </StateCard>
      ) : (
        <div className="space-y-2">
          <DataTable data={state.data.rows} columns={columns} emptyText={EMPTY_TEXT[view.lifecycle]} />
          <Pagination
            aria-label="Liste sayfaları"
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
            className="hover:text-skylab-300 font-medium text-foreground hover:underline"
          >
            {row.name}
          </Link>
        ) : (
          <span className="font-medium text-secondary-foreground">{row.name}</span>
        )}
        {row.external ? <Badge tone="warning" size="xs">Harici</Badge> : null}
        {row.archivedAt ? <Badge tone="neutral" size="xs">Arşivli</Badge> : null}
      </div>
      {row.groupPath ? <p className="mt-0.5 text-xs text-subtle-foreground">{row.groupPath}</p> : null}
      {actions.readOnly ? (
        <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-subtle-foreground">
          <Lock className="h-3 w-3 shrink-0" aria-hidden />
          {GROUP_READ_ONLY_NOTE}
        </p>
      ) : null}
      {row.archivedAt ? (
        <p className="mt-0.5 text-xs text-subtle-foreground">Arşivlendi: {formatDateTime(row.archivedAt)}</p>
      ) : null}
    </div>
  );
}
