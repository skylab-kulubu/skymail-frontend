'use client';

// The suppression list and the reversals of unsubscribes (abonelik-cikisi
// 04; src/lib/suppressions.ts). The section needs
// skymail:suppressions:manage or skymail:unsubscribes:reactivate
// (src/lib/access.ts): the first removes a bounce and reads the bounce rate
// (skymail-bounce-isleme 08), the second reverses an unsubscribe and reads
// the reversals.

import { useState, type FormEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, FilterPills, Notice, Pagination, StateCard } from '@skylab-kulubu/skylcn-ui';
import { useCan } from '@/components/layout/ConsoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/tables/DataTable';
import { FormField } from '@/components/common/FormField';
import { OutcomeNotice } from '@/components/common/OutcomeNotice';
import { DangerActions, PanelDialog, PrimaryActions } from '@/components/common/PanelDialog';
import { ROLE, sectionLabel } from '@/lib/access';
import { useApi, useApiLoad, type Query } from '@/lib/api/react';
import { formatDateTime } from '@/lib/format';
import { pageCount } from '@/lib/list-view';
import type { NoticeData } from '@/lib/notice';
import {
  BOUNCE_DAYS,
  REACTIVATE_WARNING,
  REMOVE_WARNING,
  REASON_FILTERS,
  REASON_LENGTH,
  REASON_LABEL,
  SUPPRESSION_PAGE_SIZE,
  bounceSummaryParts,
  exemptNote,
  fetchBounceSummary,
  fetchReactivationPage,
  fetchSuppressionPage,
  reactivate,
  reactivateRefusal,
  reactivatedBy,
  readerLine,
  reasonProblem,
  removeRefusal,
  removeSuppression,
  rowAction,
  sectionParts,
  sourceLabel,
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
  const canManage = useCan(ROLE.suppressionsManage);
  const powers = { canManage, canReactivate };
  const parts = sectionParts(powers);
  const [view, setView] = useState<View>('list');
  const [reason, setReason] = useState<ReasonFilter>('all');
  const [page, setPage] = useState(1);
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<NoticeData | null>(null);
  const [asked, setAsked] = useState<Suppression | null>(null);
  const [removing, setRemoving] = useState<Suppression | null>(null);

  const suppressions = useApiLoad(
    (api, signal) => fetchSuppressionPage(api, { reason, page, q: search }, signal),
    `list:${reason}:${page}:${search}`,
  );
  const reactivations = useApiLoad(
    (api, signal) => (view === 'reactivations' ? fetchReactivationPage(api, page, signal) : Promise.resolve({ rows: [], total: 0 })),
    `reactivations:${view}:${page}`,
  );

  const show = (next: { view?: View; reason?: ReasonFilter; search?: string }) => {
    if (next.view) setView(next.view);
    if (next.reason) setReason(next.reason);
    if (next.search !== undefined) setSearch(next.search.trim());
    setPage(1);
    setNotice(null);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    show({ search: typed });
  };

  const listColumns = [
    { key: 'address', header: 'Adres', render: (value: string) => <span className="break-all">{value}</span> },
    {
      key: 'reason',
      header: 'Neden',
      render: (value: Suppression['reason'], row: Suppression) => {
        const flag = exemptNote(row);
        return (
          <>
            {REASON_LABEL[value]}
            {flag ? <span className="text-2xs block text-warning">{flag}</span> : null}
          </>
        );
      },
    },
    { key: 'source', header: 'Kaynak', render: (_: unknown, row: Suppression) => sourceLabel(row) },
    { key: 'count', header: 'Sayı', render: (value: number) => <span className="tabular-nums">{value}</span> },
    { key: 'first_seen', header: 'İlk kayıt', render: (value: string) => (value ? formatDateTime(value) : dash) },
    { key: 'last_seen', header: 'Son kayıt', render: (value: string) => (value ? formatDateTime(value) : dash) },
    ...(parts.actions
      ? [
          {
            key: 'actions',
            header: 'İşlemler',
            render: (_: unknown, row: Suppression) =>
              rowAction(row, powers) === 'reactivate' ? (
                <Button variant="outline" size="sm" onClick={() => setAsked(row)} aria-label={`${row.address} çıkışını geri al`}>
                  Geri al
                </Button>
              ) : rowAction(row, powers) === 'remove' ? (
                <Button variant="outline" size="sm" onClick={() => setRemoving(row)} aria-label={`${row.address} adresini listeden kaldır`}>
                  Kaldır
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

      {parts.bounceRate ? <BounceRate /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {parts.reactivations ? (
            <FilterPills aria-label="Görünüm" value={view} options={VIEWS} onValueChange={(next) => show({ view: next })} />
          ) : null}
          {view === 'list' ? (
            <FilterPills aria-label="Neden" value={reason} options={REASON_FILTERS} onValueChange={(next) => show({ reason: next })} />
          ) : null}
        </div>
        {total !== null ? <p className="text-xs text-subtle-foreground tabular-nums">{total} kayıt</p> : null}
      </div>

      {view === 'list' ? (
        <form role="search" onSubmit={submitSearch} className="max-w-sm">
          <FormField
            label="Adreste ara"
            labelHidden
            type="search"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Adreste ara"
            maxLength={254}
            autoComplete="off"
          />
        </form>
      ) : null}

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

      <RemoveDialog
        row={removing}
        onClose={() => setRemoving(null)}
        onDone={async (said) => {
          setRemoving(null);
          await suppressions.reload();
          setNotice(said);
        }}
      />

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

/** The bounce rate over the last days and each sender mailbox's last read (skymail:suppressions:manage). */
function BounceRate() {
  const summary = useApiLoad((api, signal) => fetchBounceSummary(api, BOUNCE_DAYS, signal), 'bounces');
  if (summary.status === 'loading') return null;
  if (summary.status === 'error') {
    return <Notice tone="warning">Ret oranı yüklenemedi: {summary.error.message}</Notice>;
  }
  const data = summary.data;
  return (
    <div className="space-y-1 rounded-lg border border-border-subtle px-3 py-2 text-xs">
      <p className="tabular-nums text-foreground">
        Son {data.days} gün: {bounceSummaryParts(data).join(' · ')}
      </p>
      {data.reader.length === 0 ? (
        <p className="text-subtle-foreground">Teslim raporu okuyucusu kapalı.</p>
      ) : (
        data.reader.map((state) => (
          <p key={`${state.mailbox}:${state.mode}`} className={`break-all ${state.last_error ? 'text-warning' : 'text-subtle-foreground'}`}>
            {readerLine(state)}
          </p>
        ))
      )}
    </div>
  );
}

function RemoveDialog({
  row,
  onClose,
  onDone,
}: {
  row: Suppression | null;
  onClose: () => void;
  onDone: (notice: NoticeData) => Promise<void>;
}) {
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setRefused(null);
    onClose();
  };

  async function confirm() {
    if (!row) return;
    setBusy(true);
    setRefused(null);
    try {
      await removeSuppression(api, row.id);
      await onDone({ tone: 'success', text: `${row.address} listeden kaldırıldı.` });
    } catch (error) {
      const refusal = removeRefusal(error);
      if (refusal.reload) await onDone({ tone: 'error', text: refusal.text });
      else setRefused(refusal.text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PanelDialog isOpen={row !== null} onClose={close} title="Listeden kaldır">
      <div className="space-y-3">
        <p className="break-all text-foreground">{row?.address}</p>
        {row ? <p>{sourceLabel(row)}</p> : null}
        <Notice tone="warning">{REMOVE_WARNING}</Notice>
        {refused ? <Notice tone="danger">{refused}</Notice> : null}
      </div>
      <DangerActions onCancel={close} onConfirm={() => void confirm()} confirmLabel="Kaldır" pendingLabel="Kaldırılıyor…" isPending={busy} />
    </PanelDialog>
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
