'use client';

// The suppression list and the reversals of unsubscribes (abonelik-cikisi
// 04; src/lib/suppressions.ts). The section needs
// skymail:unsubscribes:reactivate (src/lib/access.ts), so everyone here may
// reverse an unsubscribe; removing a bounce is skymail-bounce-isleme 08's.

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, FilterPills, Notice, Pagination, StateCard } from '@skylab-kulubu/skylcn-ui';
import { useCan } from '@/components/layout/ConsoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/tables/DataTable';
import { FormField } from '@/components/common/FormField';
import { OutcomeNotice } from '@/components/common/OutcomeNotice';
import { PanelDialog, PrimaryActions } from '@/components/common/PanelDialog';
import { ROLE, sectionLabel } from '@/lib/access';
import { useApi, useApiLoad, type Query } from '@/lib/api/react';
import { formatDateTime } from '@/lib/format';
import { pageCount } from '@/lib/list-view';
import type { NoticeData } from '@/lib/notice';
import {
  REACTIVATE_WARNING,
  REASON_FILTERS,
  REASON_LENGTH,
  REASON_LABEL,
  SUPPRESSION_PAGE_SIZE,
  fetchReactivationPage,
  fetchSuppressionPage,
  reactivate,
  reactivateRefusal,
  reactivatedBy,
  reasonProblem,
  type Page,
  type ReasonFilter,
  type Reactivation,
  type Suppression,
} from '@/lib/suppressions';

type View = 'list' | 'reactivations';

const VIEWS: ReadonlyArray<{ value: View; label: string }> = [
  { value: 'list', label: 'Liste' },
  { value: 'reactivations', label: 'Geri almalar' },
];

const dash = <span className="text-subtle-foreground">—</span>;

function Loaded<T>({ query, title, children }: { query: Query<Page<T>>; title: string; children: (page: Page<T>) => React.ReactNode }) {
  if (query.status === 'loading') return <StateCard loading title={`${title} yükleniyor`} />;
  if (query.status === 'error') {
    return (
      <StateCard icon={AlertTriangle} tone="danger" title={`${title} yüklenemedi`} description={query.error.message}>
        <Button variant="outline" onClick={() => void query.reload()}>
          Tekrar dene
        </Button>
      </StateCard>
    );
  }
  return <>{children(query.data)}</>;
}

export function SuppressionsPage() {
  const canReactivate = useCan(ROLE.unsubscribesReactivate);
  const [view, setView] = useState<View>('list');
  const [reason, setReason] = useState<ReasonFilter>('all');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<NoticeData | null>(null);
  const [asked, setAsked] = useState<Suppression | null>(null);

  const suppressions = useApiLoad((api, signal) => fetchSuppressionPage(api, { reason, page }, signal), `list:${reason}:${page}`);
  const reactivations = useApiLoad(
    (api, signal) => (view === 'reactivations' ? fetchReactivationPage(api, page, signal) : Promise.resolve({ rows: [], total: 0 })),
    `reactivations:${view}:${page}`,
  );

  const show = (next: { view?: View; reason?: ReasonFilter }) => {
    if (next.view) setView(next.view);
    if (next.reason) setReason(next.reason);
    setPage(1);
    setNotice(null);
  };

  const listColumns = [
    { key: 'address', header: 'Adres', render: (value: string) => <span className="break-all">{value}</span> },
    { key: 'reason', header: 'Neden', render: (value: Suppression['reason']) => REASON_LABEL[value] },
    { key: 'first_seen', header: 'İlk kayıt', render: (value: string) => (value ? formatDateTime(value) : dash) },
    { key: 'last_seen', header: 'Son kayıt', render: (value: string) => (value ? formatDateTime(value) : dash) },
    ...(canReactivate
      ? [
          {
            key: 'actions',
            header: 'İşlemler',
            render: (_: unknown, row: Suppression) =>
              row.reason === 'unsubscribed' ? (
                <Button variant="outline" size="sm" onClick={() => setAsked(row)} aria-label={`${row.address} çıkışını geri al`}>
                  Geri al
                </Button>
              ) : null,
          },
        ]
      : []),
  ];

  // Who, when and why; never the address.
  const reactivationColumns = [
    { key: 'reactivated_at', header: 'Geri alındı', render: (value: string) => formatDateTime(value) },
    { key: 'actor', header: 'Kim', render: (_: unknown, row: Reactivation) => <span className="break-all">{reactivatedBy(row)}</span> },
    { key: 'reason', header: 'Gerekçe', render: (value: string | null) => (value ? <span className="whitespace-pre-wrap">{value}</span> : dash) },
    { key: 'unsubscribed_at', header: 'Çıkış tarihi', render: (value: string) => formatDateTime(value) },
  ];

  const current = view === 'list' ? suppressions : reactivations;
  const total = current.status === 'success' ? current.data.total : null;

  return (
    <div className="space-y-5">
      <PageHeader title={sectionLabel('/suppressions')} description="Posta gönderilmeyen adresler." />

      {notice ? <OutcomeNotice notice={notice} onDismiss={() => setNotice(null)} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <FilterPills aria-label="Görünüm" value={view} options={VIEWS} onValueChange={(next) => show({ view: next })} />
          {view === 'list' ? (
            <FilterPills aria-label="Neden" value={reason} options={REASON_FILTERS} onValueChange={(next) => show({ reason: next })} />
          ) : null}
        </div>
        {total !== null ? <p className="text-xs text-subtle-foreground tabular-nums">{total} kayıt</p> : null}
      </div>

      {view === 'list' ? (
        <Loaded query={suppressions} title="Liste">
          {(data) => <DataTable data={data.rows} columns={listColumns} emptyText="Listede adres yok." />}
        </Loaded>
      ) : (
        <Loaded query={reactivations} title="Geri almalar">
          {(data) => <DataTable data={data.rows} columns={reactivationColumns} emptyText="Henüz geri alma yok." />}
        </Loaded>
      )}

      {total !== null && total > SUPPRESSION_PAGE_SIZE ? (
        <Pagination aria-label="Sayfalar" current={page} totalPages={pageCount(total, SUPPRESSION_PAGE_SIZE)} onPageChange={setPage} />
      ) : null}

      <ReactivateDialog
        row={asked}
        onClose={() => setAsked(null)}
        onDone={async (said) => {
          setAsked(null);
          await suppressions.reload();
          setNotice(said);
        }}
      />
    </div>
  );
}

function ReactivateDialog({
  row,
  onClose,
  onDone,
}: {
  row: Suppression | null;
  onClose: () => void;
  onDone: (notice: NoticeData) => Promise<void>;
}) {
  const api = useApi();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const problem = reasonProblem(text);

  const close = () => {
    if (busy) return;
    setText('');
    setRefused(null);
    onClose();
  };

  async function confirm() {
    if (!row || problem) return;
    setBusy(true);
    setRefused(null);
    try {
      await reactivate(api, row.id, text);
      setText('');
      await onDone({ tone: 'success', text: `${row.address} yeniden duyuru alacak.` });
    } catch (error) {
      const refusal = reactivateRefusal(error);
      if (refusal.reload) {
        setText('');
        await onDone({ tone: 'error', text: refusal.text });
      } else {
        setRefused(refusal.text);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <PanelDialog isOpen={row !== null} onClose={close} title="Çıkışı geri al">
      <div className="space-y-3">
        <p className="break-all text-foreground">{row?.address}</p>
        <Notice tone="warning">{REACTIVATE_WARNING}</Notice>
        <FormField
          label="Gerekçe"
          hint="10–500 karakter. Adres yazma."
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={500}
          autoComplete="off"
          disabled={busy}
          error={refused ?? (problem !== REASON_LENGTH ? problem : null)}
        />
      </div>
      <PrimaryActions onCancel={close} onConfirm={() => void confirm()} confirmLabel="Geri al" pendingLabel="Geri alınıyor…" isPending={busy} confirmDisabled={problem !== null} />
    </PanelDialog>
  );
}
