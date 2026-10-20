'use client';

// A tracked send's opens and clicks (hub ticket iletisim-servisi 15b): one
// caveat, the counts, the hours and days after the send, the links, and to
// those who may see them (skymail:mails:tracking:read, or the send's own
// sender) the recipients one by one. Everyone else gets the counts only, and
// the page never asks for the people. A year after the last mail went out only
// the kept totals remain.

import { useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { Badge, Button, FilterPills, Notice, Pagination, StatCard, StateCard } from '@skylab-kulubu/skylcn-ui';
import { AreaChart } from '@skylab-kulubu/skylcn-ui/charts';
import { useConsole } from '@/components/layout/ConsoleContext';
import { DataTable } from '@/components/tables/DataTable';
import { useApiLoad } from '@/lib/api/react';
import { pageCount } from '@/lib/list-view';
import { mailRecipientLabel } from '@/lib/people';
import { formatCount, formatSendTime, type Send } from '@/lib/sends';
import {
  clickedLinksText,
  fetchTrackingRecipients,
  fetchTrackingSummary,
  linkLabel,
  mayReadTrackingRecipients,
  noLikelyOpenText,
  recipientBadges,
  SERIES_LABELS,
  seriesHasEvents,
  shareOf,
  skipReasonLabel,
  TRACKING_CAVEAT,
  TRACKING_EXPIRED_TEXT,
  TRACKING_FILTERS,
  TRACKING_PAGE_SIZE,
  trackingSeries,
  untrackedParts,
  type TrackingAggregate,
  type TrackingFilter,
  type TrackingLinkCounts,
  type TrackingRecipient,
  type TrackingRecipientPage,
  type TrackingSummary,
} from '@/lib/tracking-report';
import { SectionTitle } from './SectionTitle';

/** The section of a send that asked for tracking and got it (SendDetail shows it only then). */
export function TrackingSection({ send }: { send: Send }) {
  const { roles, user } = useConsole();
  const summary = useApiLoad((api, signal) => fetchTrackingSummary(api, send.id, signal), send.id);
  const people = mayReadTrackingRecipients(roles, user.sub, send);

  if (summary.status === 'success' && !summary.data.tracking_requested) return null;

  return (
    <section aria-labelledby="tracking-title" className="space-y-4">
      <SectionTitle id="tracking-title">Açılma ve tıklama</SectionTitle>
      {summary.status === 'loading' ? (
        <StateCard loading title="Takip bilgisi yükleniyor" />
      ) : summary.status === 'error' ? (
        <StateCard icon={AlertTriangle} tone="danger" title="Takip bilgisi yüklenemedi" description={summary.error.message}>
          <Button variant="outline" onClick={() => void summary.reload()}>
            Tekrar dene
          </Button>
        </StateCard>
      ) : (
        <>
          <TrackingOverview summary={summary.data} />
          {people && !summary.data.retained ? (
            <TrackingRecipients sendId={send.id} links={summary.data.report?.clicks_by_link ?? []} />
          ) : null}
        </>
      )}
    </section>
  );
}

/** The caveat, the counts, the series and the links; after a year the kept totals only. */
export function TrackingOverview({ summary }: { summary: TrackingSummary }) {
  const report = summary.report;
  if (summary.retained) {
    return (
      <div className="space-y-4">
        <Notice tone="info" icon={Clock} title="1 yıl doldu" aria-label="Kişi bazında kayıt">
          {TRACKING_EXPIRED_TEXT}{' '}
          {report ? 'Aşağıda kişisiz toplamlar var.' : 'Toplamlar yalnız en az 10 takipli alıcısı olan gönderimlerde saklanır.'}
        </Notice>
        {report ? (
          <>
            <TrackingFigures report={report} />
            <TrackingLinks links={report.clicks_by_link} />
          </>
        ) : null}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Notice tone="info" aria-label="Açılma ve tıklama">
        {TRACKING_CAVEAT}
      </Notice>
      {report ? (
        <>
          <TrackingFigures report={report} />
          <TrackingChart report={report} />
          <TrackingLinks links={report.clicks_by_link} />
        </>
      ) : (
        <p className="text-sm text-subtle-foreground">Bu gönderim için takip bilgisi yok.</p>
      )}
    </div>
  );
}

function TrackingFigures({ report }: { report: TrackingAggregate }) {
  const tracked = report.tracked_recipients;
  const untracked = untrackedParts(report.untracked_by_reason);
  const ofTracked = (part: number) => {
    const share = shareOf(part, tracked);
    return share ? `Takip edilenlere oranı: ${share}` : undefined;
  };
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard label="Takip edilen" value={formatCount(tracked)} hint="kişi" />
      <StatCard
        label="Takip edilmeyen"
        value={formatCount(untracked.total)}
        hint={untracked.parts.length > 0 ? untracked.parts.join(' · ') : 'kişi'}
      />
      <StatCard label="Açılma görülen" value={formatCount(report.unique_likely_human_opens)} hint={ofTracked(report.unique_likely_human_opens) ?? 'insan olası'} />
      {report.automated_only_recipients !== undefined ? (
        <StatCard
          label="Yalnız otomatik açılma"
          value={formatCount(report.automated_only_recipients)}
          hint={ofTracked(report.automated_only_recipients) ?? 'kişi'}
        />
      ) : null}
      <StatCard label="Tıklayan" value={formatCount(report.unique_clickers)} hint={ofTracked(report.unique_clickers) ?? 'kişi'} />
    </div>
  );
}

function TrackingChart({ report }: { report: TrackingAggregate }) {
  const rows = trackingSeries(report.series);
  return (
    <AreaChart
      title="Zaman içinde"
      description="İlk 72 saat saatlik, sonrası günlük. Yalnız sayılar."
      data={seriesHasEvents(rows) ? rows : []}
      x="label"
      xLabel="Zaman"
      series={{
        likely_human_opens: { label: SERIES_LABELS.likely_human_opens },
        automated_opens: { label: SERIES_LABELS.automated_opens },
        clicks: { label: SERIES_LABELS.clicks },
      }}
      palette="categorical"
      formatValue={formatCount}
      emptyMessage="Henüz açılma ya da tıklama görülmedi."
    />
  );
}

function TrackingLinks({ links }: { links: readonly TrackingLinkCounts[] }) {
  return (
    <div className="space-y-1.5">
      <DataTable<TrackingLinkCounts>
        data={[...links].sort((a, b) => a.position - b.position)}
        emptyText="Bu postada takip edilen bağlantı yok."
        columns={[
          { key: 'position', header: 'Bağlantı', render: (position: number) => linkLabel(position) },
          {
            key: 'unique_clickers',
            header: 'Tekil tıklayan',
            render: (value: number) => <span className="tabular-nums">{formatCount(value)}</span>,
          },
          { key: 'clicks', header: 'Tıklama', render: (value: number) => <span className="tabular-nums">{formatCount(value)}</span> },
        ]}
      />
      {links.length > 0 ? <p className="text-2xs text-subtle-foreground">Sıra, bağlantının postadaki yeridir.</p> : null}
    </div>
  );
}

/** The recipients one by one: loaded only for a viewer who may see them. */
function TrackingRecipients({ sendId, links }: { sendId: string; links: readonly TrackingLinkCounts[] }) {
  const [view, setView] = useState<{ filter: TrackingFilter; page: number }>({ filter: 'all', page: 1 });
  const state = useApiLoad(
    (api, signal) => fetchTrackingRecipients(api, sendId, view, signal),
    `${sendId}:${view.filter}:${view.page}`,
  );

  if (state.status === 'error' && state.error.status === 410) {
    return (
      <Notice tone="info" icon={Clock} title="1 yıl doldu" aria-label="Kişi bazında kayıt">
        {TRACKING_EXPIRED_TEXT}
      </Notice>
    );
  }
  // The API decides who sees people; a refusal leaves the counts alone.
  if (state.status === 'error' && state.error.status === 403) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-secondary-foreground">Kişiler</h3>
      {state.status === 'loading' ? (
        <StateCard loading title="Kişiler yükleniyor" />
      ) : state.status === 'error' ? (
        <StateCard icon={AlertTriangle} tone="danger" title="Kişiler yüklenemedi" description={state.error.message}>
          <Button variant="outline" onClick={() => void state.reload()}>
            Tekrar dene
          </Button>
        </StateCard>
      ) : (
        <TrackingRecipientsView
          page={state.data}
          links={links}
          filter={view.filter}
          current={view.page}
          onFilterChange={(filter) => setView({ filter, page: 1 })}
          onPageChange={(page) => setView((prev) => ({ ...prev, page }))}
        />
      )}
    </div>
  );
}

const EMPTY_TEXT: Readonly<Record<TrackingFilter, string>> = {
  all: 'Bu gönderimde alıcı yok.',
  opened: 'Açılma görülen alıcı yok.',
  not_opened: 'Herkeste açılma görüldü.',
  clicked: 'Tıklayan alıcı yok.',
  automated_only: 'Yalnız otomatik açılması olan alıcı yok.',
};

export function TrackingRecipientsView({
  page,
  links,
  filter,
  current,
  onFilterChange,
  onPageChange,
}: {
  page: TrackingRecipientPage;
  links: readonly TrackingLinkCounts[];
  filter: TrackingFilter;
  current: number;
  onFilterChange: (filter: TrackingFilter) => void;
  onPageChange: (page: number) => void;
}) {
  const time = (value: string | null) => (value ? formatSendTime(value) : '—');
  return (
    <div className="space-y-2">
      <div className="max-w-full overflow-x-auto">
        <FilterPills aria-label="Gösterilen kişiler" value={filter} options={TRACKING_FILTERS} onValueChange={onFilterChange} />
      </div>
      <DataTable<TrackingRecipient>
        data={[...page.items]}
        emptyText={EMPTY_TEXT[filter]}
        columns={[
          { key: 'recipient_email', header: 'Alıcı', render: (_, row) => <Person row={row} /> },
          {
            key: 'first_likely_human_open_at',
            header: 'İlk gerçek açılma',
            render: (value: string | null, row) =>
              value ? (
                <span className="tabular-nums">{time(value)}</span>
              ) : (
                <span className="text-subtle-foreground">{noLikelyOpenText(row)}</span>
              ),
          },
          { key: 'first_open_at', header: 'İlk açılma', render: (value: string | null) => <span className="tabular-nums">{time(value)}</span> },
          { key: 'open_count', header: 'Açılma', render: (value: number) => <span className="tabular-nums">{formatCount(value)}</span> },
          { key: 'last_clicked_at', header: 'Son tıklama', render: (value: string | null) => <span className="tabular-nums">{time(value)}</span> },
          {
            key: 'clicked_links',
            header: 'Tıklanan bağlantılar',
            render: (_, row) => (
              <span className="block max-w-[14rem] whitespace-normal">{clickedLinksText(row.clicked_links, links)}</span>
            ),
          },
          { key: 'source_classes', header: 'İşaret', render: (_, row) => <Marks row={row} /> },
        ]}
      />
      <Pagination
        aria-label="Kişi sayfaları"
        current={current}
        totalPages={pageCount(page.total, TRACKING_PAGE_SIZE)}
        onPageChange={onPageChange}
      />
    </div>
  );
}

function Person({ row }: { row: TrackingRecipient }) {
  const { name, address } = mailRecipientLabel(row.recipient_full_name, row.recipient_email);
  return (
    <span className="flex max-w-[18rem] flex-col">
      <span className="truncate text-secondary-foreground">{name}</span>
      {address ? <span className="text-2xs truncate text-subtle-foreground">{address}</span> : null}
    </span>
  );
}

function Marks({ row }: { row: TrackingRecipient }) {
  if (!row.tracked) {
    return (
      <Badge tone="neutral" size="sm">
        Takip edilmedi: {skipReasonLabel(row.tracking_skip_reason)}
      </Badge>
    );
  }
  const badges = recipientBadges(row);
  if (badges.length === 0) return <span className="text-faint-foreground">—</span>;
  return (
    <span className="flex max-w-[20rem] flex-wrap gap-1 whitespace-normal">
      {badges.map((badge) => (
        <Badge key={badge.key} tone={badge.tone} size="sm">
          {badge.label}
        </Badge>
      ))}
    </span>
  );
}
