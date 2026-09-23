'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ArchiveDialog } from '@/components/chrome/ArchiveDialog';
import { FilterPills } from '@/components/chrome/FilterPills';
import { useFlashNotice } from '@/components/chrome/flash';
import { Notice, type NoticeData } from '@/components/chrome/Notice';
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
  TEMPLATE_PAGE_SIZE,
  archiveTemplate,
  fetchTemplatePage,
  isSystemProtected,
  restoreTemplate,
  templateActions,
  templateHref,
  toTemplateRow,
  type TemplateActions,
  type TemplateRow,
} from '@/lib/templates';
import { DraftIndicator } from './DraftIndicator';
import { MainSource, RowActions, TemplateName } from './TemplateRowParts';

const EMPTY_TEXT: Readonly<Record<Lifecycle, string>> = {
  current: 'Henüz Mail template yok.',
  inactive: 'Arşivlenmiş Mail template yok.',
  all: 'Hiç Mail template yok.',
};

type TemplateRef = Readonly<{ id: string; name: string }>;

/** What the page says after an archive: the template is kept, and can come back. */
function archivedNotice(template: TemplateRef): NoticeData {
  return {
    tone: 'success',
    text: `“${template.name}” arşivlendi. Sürümleri ve geçmiş gönderimleri korunuyor.`,
    restore: { id: template.id, name: template.name },
  };
}

export function TemplatesPage() {
  const api = useApi();
  const router = useRouter();
  const pathname = usePathname() || templateHref.index;
  const view = readListView(useSearchParams());
  const { roles, user } = useConsole();
  const canWrite = hasRole(roles, ROLE.templatesWrite);
  const viewerSub = user.sub ?? null;

  const [notice, setNotice] = useFlashNotice(templateHref.index);
  const [toArchive, setToArchive] = useState<TemplateRef | null>(null);
  // Per row: two restores in flight must not clear each other's busy state.
  const [restoring, setRestoring] = useState<ReadonlySet<string>>(() => new Set());

  const state = useApiLoad(
    (client, signal) => fetchTemplatePage(client, view, signal),
    `${view.lifecycle}:${view.page}`,
  );
  const rows = state.status === 'success' ? state.data.templates.map((item) => toTemplateRow(item, viewerSub)) : [];
  const lastPage = state.status === 'success' ? pageCount(state.data.total, TEMPLATE_PAGE_SIZE) : null;

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

  async function restore(template: TemplateRef) {
    markRestoring(template.id, true);
    try {
      await restoreTemplate(api, template.id);
      await state.reload();
      setNotice({ tone: 'success', text: `“${template.name}” geri alındı; yeniden aktif.` });
    } catch (error) {
      setNotice({ tone: 'error', text: `“${template.name}” geri alınamadı. ${apiErrorMessage(error)}` });
    } finally {
      markRestoring(template.id, false);
    }
  }

  async function archive(template: TemplateRef) {
    try {
      await archiveTemplate(api, template.id);
    } catch (error) {
      // It became a System template after the list loaded: show it as one.
      if (isSystemProtected(error)) void state.reload();
      throw error;
    }
  }

  const rowActions = (row: TemplateRow) => (
    <RowActions
      row={row}
      actions={templateActions(row, roles)}
      restoring={restoring.has(row.id)}
      onArchive={() => setToArchive(row)}
      onRestore={() => void restore(row)}
    />
  );

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
      render: (value: string | null) => <MainSource label={value} />,
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

      {notice ? (
        <Notice
          notice={notice}
          onDismiss={() => setNotice(null)}
          onRestore={canWrite ? (template) => void restore(template) : undefined}
          restoring={notice.restore ? restoring.has(notice.restore.id) : false}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterPills
          ariaLabel="Gösterilen Mail template'ler"
          value={view.lifecycle}
          options={LIFECYCLE_FILTERS}
          onChange={(next) => show({ lifecycle: next, page: 1 })}
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
          {/* A phone gets rows it can read without scrolling sideways. */}
          {rows.length > 0 ? (
            <ul className="divide-y divide-white/5 rounded-lg border border-white/5 bg-neutral-900 md:hidden">
              {rows.map((row) => (
                <TemplateItem key={row.id} row={row} actions={templateActions(row, roles)}>
                  {rowActions(row)}
                </TemplateItem>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-white/5 px-4 py-6 text-center text-sm text-neutral-500 md:hidden">
              {EMPTY_TEXT[view.lifecycle]}
            </p>
          )}
          <div className="hidden md:block">
            <DataTable data={rows} columns={columns} emptyText={EMPTY_TEXT[view.lifecycle]} />
          </div>
          <Pagination
            ariaLabel="Mail template sayfaları"
            current={view.page}
            totalPages={lastPage ?? 1}
            onPageChange={(next) => show({ ...view, page: next })}
          />
        </div>
      )}

      <ArchiveDialog
        record={toArchive}
        title="Mail template'i arşivle"
        archive={archive}
        onClose={() => setToArchive(null)}
        onArchived={async (template) => {
          await state.reload();
          setToArchive(null);
          setNotice(archivedNotice(template));
        }}
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-neutral-500">Main source</span>
          <MainSource label={row.mainSource} />
        </span>
        {row.drafts ? <DraftIndicator drafts={row.drafts} /> : null}
      </div>
      {children}
    </li>
  );
}
