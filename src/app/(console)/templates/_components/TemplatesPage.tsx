'use client';

import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ArchiveDialog } from '@/components/chrome/ArchiveDialog';
import { FilterPills } from '@/components/chrome/FilterPills';
import { Notice } from '@/components/chrome/Notice';
import { Pagination } from '@/components/chrome/Pagination';
import { StateCard } from '@/components/chrome/StateCard';
import { useConsole } from '@/components/layout/ConsoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { ResponsiveTable } from '@/components/tables/ResponsiveTable';
import { RowActions } from '@/components/tables/RowActions';
import { Button } from '@/components/ui/Button';
import { CreatePageButton } from '@/components/ui/CreatePageButton';
import { ROLE, hasRole, sectionLabel } from '@/lib/access';
import { useApi } from '@/lib/api/react';
import { LIFECYCLE_FILTERS, type Lifecycle } from '@/lib/list-view';
import type { NoticeData } from '@/lib/notice';
import {
  TEMPLATE_PAGE_SIZE,
  archiveTemplate,
  fetchTemplatePage,
  isSystemArchiveRefusal,
  restoreTemplate,
  templateActions,
  templateHref,
  toTemplateRow,
  type AuthoringMode,
  type TemplateActions,
  type TemplateRow,
} from '@/lib/templates';
import { useArchivableList, type ArchivableRecord } from '@/lib/ui/use-archivable-list';
import { DraftIndicator } from './DraftIndicator';
import { MainSource, TemplateName } from './TemplateRowParts';

const EMPTY_TEXT: Readonly<Record<Lifecycle, string>> = {
  current: 'Henüz Mail template yok.',
  inactive: 'Arşivlenmiş Mail template yok.',
  all: 'Hiç Mail template yok.',
};

/** What the page says after an archive: the template is kept, and can come back. */
function archivedNotice(template: ArchivableRecord): NoticeData {
  return {
    tone: 'success',
    text: `“${template.name}” arşivlendi. Sürümleri ve geçmiş gönderimleri korunuyor.`,
    restore: { id: template.id, name: template.name },
  };
}

export function TemplatesPage() {
  const api = useApi();
  const { roles, user } = useConsole();
  const canWrite = hasRole(roles, ROLE.templatesWrite);
  const viewerSub = user.sub ?? null;
  const list = useArchivableList({
    index: templateHref.index,
    pageSize: TEMPLATE_PAGE_SIZE,
    load: fetchTemplatePage,
    restore: restoreTemplate,
    archivedNotice,
    canRestore: canWrite,
  });
  const { view, state } = list;
  const rows = state.status === 'success' ? state.data.templates.map((item) => toTemplateRow(item, viewerSub)) : [];

  async function archive(template: ArchivableRecord) {
    try {
      await archiveTemplate(api, template.id);
    } catch (error) {
      // It became a System template after the list loaded: show it as one.
      if (isSystemArchiveRefusal(error)) void state.reload();
      throw error;
    }
  }

  const rowActions = (row: TemplateRow) => {
    const actions = templateActions(row, roles);
    return (
      <RowActions
        target={`“${row.name}” Mail template'ini`}
        onArchive={actions.archive ? () => list.askArchive(row) : undefined}
        onRestore={actions.restore ? () => list.restore(row) : undefined}
        restoring={list.isRestoring(row.id)}
      />
    );
  };

  const columns = [
    {
      key: 'name',
      header: 'Mail template',
      render: (_: unknown, row: TemplateRow) => (
        <div className="max-w-[20rem] min-w-[14rem]">
          <TemplateName row={row} actions={templateActions(row, roles)} />
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'Konu',
      render: (value: string) => (
        <span className="block max-w-[15rem] truncate text-neutral-300" title={value}>
          {value}
        </span>
      ),
    },
    {
      key: 'mainSource',
      header: 'Main source',
      render: (value: AuthoringMode | null) => <MainSource mode={value} />,
    },
    {
      key: 'drafts',
      header: 'Taslak',
      render: (_: unknown, row: TemplateRow) =>
        row.drafts ? <DraftIndicator drafts={row.drafts} /> : <span className="text-neutral-500">—</span>,
    },
    ...(canWrite ? [{ key: 'actions', header: 'İşlemler', render: (_: unknown, row: TemplateRow) => rowActions(row) }] : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={sectionLabel('/templates')}
        description="Kulübün gönderdiği her mailin konusu ve gövdesi. Gönderilen, her Mail template'in yayımlanmış sürümüdür."
        actions={canWrite ? <CreatePageButton href={templateHref.create}>Yeni template</CreatePageButton> : null}
      />

      {list.notice ? <Notice {...list.notice} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterPills
          ariaLabel="Gösterilen Mail template'ler"
          value={view.lifecycle}
          options={LIFECYCLE_FILTERS}
          onChange={(next) => list.show({ lifecycle: next, page: 1 })}
        />
        {/* Present from the start, so a screen reader hears the count change with the filter. */}
        <p className="text-xs text-neutral-500 tabular-nums" aria-live="polite">
          {state.status === 'success' ? `${state.data.total} Mail template` : ''}
        </p>
      </div>

      {state.status === 'loading' ? (
        <StateCard isLoading title="Mail template'ler yükleniyor" />
      ) : state.status === 'error' ? (
        <StateCard
          Icon={AlertTriangle}
          tone="danger"
          title="Mail template'ler yüklenemedi"
          description={state.error.message}
        >
          <Button variant="secondary" onClick={() => void state.reload()}>
            Tekrar dene
          </Button>
        </StateCard>
      ) : (
        <div className="space-y-2">
          <ResponsiveTable
            rows={rows}
            columns={columns}
            emptyText={EMPTY_TEXT[view.lifecycle]}
            renderItem={(row) => (
              <TemplateItem row={row} actions={templateActions(row, roles)}>
                {rowActions(row)}
              </TemplateItem>
            )}
          />
          <Pagination
            ariaLabel="Mail template sayfaları"
            current={view.page}
            totalPages={list.lastPage ?? 1}
            onPageChange={(next) => list.show({ ...view, page: next })}
          />
        </div>
      )}

      <ArchiveDialog
        {...list.archiveDialog}
        title="Mail template'i arşivle"
        archive={archive}
        isFinalRefusal={isSystemArchiveRefusal}
      >
        {(template) => (
          <p className="leading-relaxed">
            <strong className="font-medium text-neutral-100">“{template.name}”</strong> arşivlenecek. Sürümleri ve
            geçmiş gönderimleri silinmez; Mail template&apos;ler ekranındaki Arşivli filtresinden geri alabilirsin.
            Arşivdeki bir Mail template ile gönderim yapılamaz.
          </p>
        )}
      </ArchiveDialog>
    </div>
  );
}

/** One template as a phone shows it: everything the table's columns hold, stacked, then its actions. */
function TemplateItem({
  row,
  actions,
  children,
}: {
  row: TemplateRow;
  actions: TemplateActions;
  children: ReactNode;
}) {
  return (
    <li className="space-y-2 px-3.5 py-3 text-sm">
      <TemplateName row={row} actions={actions} />
      <p className="text-xs break-words text-neutral-300">
        <span className="text-neutral-500">Konu: </span>
        {row.subject}
      </p>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-neutral-500">Main source</span>
          <MainSource mode={row.mainSource} />
        </span>
        {row.drafts ? <DraftIndicator drafts={row.drafts} /> : null}
      </div>
      {children}
    </li>
  );
}
