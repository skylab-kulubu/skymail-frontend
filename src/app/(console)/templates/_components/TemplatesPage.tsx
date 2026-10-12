'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { ArchiveDialog } from '@/components/common/ArchiveDialog';
import { Button, FilterPills, Pagination, StateCard } from '@skylab-kulubu/skylcn-ui';
import { useConsole } from '@/components/layout/ConsoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { ResponsiveTable } from '@/components/tables/ResponsiveTable';
import { RowActions } from '@/components/tables/RowActions';
import { NavButton } from '@/components/common/NavButton';
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
import { OutcomeNotice } from '@/components/common/OutcomeNotice';

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
        <span className="block max-w-[15rem] truncate text-secondary-foreground" title={value}>
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
        row.drafts ? <DraftIndicator drafts={row.drafts} /> : <span className="text-subtle-foreground">—</span>,
    },
    ...(canWrite ? [{ key: 'actions', header: 'İşlemler', render: (_: unknown, row: TemplateRow) => rowActions(row) }] : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={sectionLabel('/templates')}
        description="Kulübün gönderdiği her mailin konusu ve gövdesi. Gönderilen, her Mail template'in yayımlanmış sürümüdür."
        actions={canWrite ? <NavButton variant="primary" href={templateHref.create}><Plus aria-hidden />Yeni template</NavButton> : null}
      />

      {list.notice ? <OutcomeNotice {...list.notice} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterPills
          aria-label="Gösterilen Mail template'ler"
          value={view.lifecycle}
          options={LIFECYCLE_FILTERS}
          onValueChange={(next) => list.show({ lifecycle: next, page: 1 })}
        />
        {/* Present from the start, so a screen reader hears the count change with the filter. */}
        <p className="text-xs text-subtle-foreground tabular-nums" aria-live="polite">
          {state.status === 'success' ? `${state.data.total} Mail template` : ''}
        </p>
      </div>

      {state.status === 'loading' ? (
        <StateCard loading title="Mail template'ler yükleniyor" />
      ) : state.status === 'error' ? (
        <StateCard
          icon={AlertTriangle}
          tone="danger"
          title="Mail template'ler yüklenemedi"
          description={state.error.message}
        >
          <Button variant="outline" onClick={() => void state.reload()}>
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
            aria-label="Mail template sayfaları"
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
            <strong className="font-medium text-foreground">“{template.name}”</strong> arşivlenecek. Sürümleri ve
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
      <p className="text-xs break-words text-secondary-foreground">
        <span className="text-subtle-foreground">Konu: </span>
        {row.subject}
      </p>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-subtle-foreground">Main source</span>
          <MainSource mode={row.mainSource} />
        </span>
        {row.drafts ? <DraftIndicator drafts={row.drafts} /> : null}
      </div>
      {children}
    </li>
  );
}
