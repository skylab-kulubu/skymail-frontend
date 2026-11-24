'use client';

// Who opened the send's masked content (hub ticket skymail-frontend-rewrite
// 32): to the holder of skynotify:audit:read alone (DK), newest first, with the
// recipient whose mail was opened. A send no one opened masked shows nothing,
// unless the viewer sees it is masked.

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Pagination, StateCard } from '@skylab-kulubu/skylcn-ui';
import { useConsole } from '@/components/layout/ConsoleContext';
import { DataTable } from '@/components/tables/DataTable';
import type { ApiPage } from '@/lib/api/client';
import { useApiLoad } from '@/lib/api/react';
import {
  CONTENT_VIEWS_PAGE_SIZE,
  fetchContentViews,
  fetchViewedRecipients,
  readsContentViews,
  showsContentViews,
  viewerName,
  type ContentView,
} from '@/lib/content-views';
import { knownPageCount } from '@/lib/list-view';
import { formatSendTime, type Send } from '@/lib/sends';
import { SectionTitle } from './SectionTitle';

export function ContentViewsSection({ send }: { send: Send }) {
  const { roles } = useConsole();
  if (!readsContentViews(roles)) return null;
  return <ContentViewsLoader send={send} />;
}

function ContentViewsLoader({ send }: { send: Send }) {
  const [page, setPage] = useState(1);
  const state = useApiLoad((api, signal) => fetchContentViews(api, send.id, page, signal), `${send.id}:${page}`);
  const answer =
    state.status === 'error'
      ? ({ status: 'error', code: state.error.status } as const)
      : state.status === 'success'
        ? ({ status: 'success', page, rows: state.data.items.length } as const)
        : ({ status: 'loading' } as const);
  if (!showsContentViews(send.content_access === 'masked', answer)) return null;

  return (
    <section aria-labelledby="content-views-title" className="space-y-3">
      <SectionTitle id="content-views-title">Kim açtı</SectionTitle>
      {state.status === 'loading' ? (
        <StateCard loading title="Açılışlar yükleniyor" />
      ) : state.status === 'error' ? (
        <StateCard icon={AlertTriangle} tone="danger" title="Açılışlar yüklenemedi" description={state.error.message}>
          <Button variant="outline" onClick={() => void state.reload()}>
            Tekrar dene
          </Button>
        </StateCard>
      ) : (
        <ContentViewsPage sendId={send.id} views={state.data} page={page} onPageChange={setPage} />
      )}
    </section>
  );
}

function ContentViewsPage({
  sendId,
  views,
  page,
  onPageChange,
}: {
  sendId: string;
  views: ApiPage<ContentView>;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const rowIds = [...new Set(views.items.map((view) => view.queue_item_id))];
  const recipients = useApiLoad(
    (api, signal) => fetchViewedRecipients(api, sendId, rowIds, signal),
    `${sendId}:${rowIds.join(',')}`,
  );
  return (
    <ContentViewsTable
      views={views}
      recipients={recipients.status === 'success' ? recipients.data : null}
      page={page}
      onPageChange={onPageChange}
    />
  );
}

/** The openings of one page; `recipients` names the rows, null while they load or when they could not be read. */
export function ContentViewsTable({
  views,
  recipients,
  page,
  onPageChange,
}: {
  views: ApiPage<ContentView>;
  recipients: ReadonlyMap<string, string> | null;
  page: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="space-y-2">
      <DataTable<ContentView>
        data={[...views.items]}
        emptyText="Maskeli içeriği açan olmadı."
        columns={[
          { key: 'actor', header: 'Kim', render: (_, view) => <span className="text-secondary-foreground">{viewerName(view.actor)}</span> },
          {
            key: 'created_at',
            header: 'Ne zaman',
            render: (value: string) => <span className="tabular-nums">{formatSendTime(value)}</span>,
          },
          {
            key: 'queue_item_id',
            header: 'Alıcı',
            render: (value: string) => recipients?.get(value) ?? <span className="text-faint-foreground">—</span>,
          },
        ]}
      />
      <Pagination
        aria-label="Açılış sayfaları"
        current={page}
        totalPages={knownPageCount({ total: views.total, rows: views.items.length }, page, CONTENT_VIEWS_PAGE_SIZE)}
        onPageChange={onPageChange}
      />
    </div>
  );
}
