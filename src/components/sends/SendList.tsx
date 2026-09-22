'use client';

// The send list: every send newest first, filtered by the status the API
// derives from its recipients. The filter and the page live in the address
// (`?status=failed&page=2`), so the home screen's failed tile, a bookmark and
// the back button all land on the same list.

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { StateCard } from '@/components/chrome/StateCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/tables/DataTable';
import { sectionLabel } from '@/lib/access';
import { useApiPage } from '@/lib/api/react';
import {
  audienceOfSendRow,
  formatCount,
  formatSendTime,
  pageFromSearch,
  recipientSummary,
  SEND_LIST_PATH,
  sendListHref,
  sendListQuery,
  STATUS_FILTERS,
  statusFromSearch,
  templateLabel,
  type SendRow,
  type SendStatus,
} from '@/lib/sends';
import { Audience } from './Audience';
import { Pager } from './Pager';
import { SendItem } from './SendItem';
import { SendStatusBadge } from './StatusBadge';

const PAGE_SIZE = 20;

const EMPTY_TEXT: Readonly<Record<SendStatus | 'all', string>> = {
  all: 'Henüz gönderim yok.',
  sending: 'Şu anda gönderilmekte olan bir gönderim yok.',
  sent: 'Tamamlanmış gönderim yok.',
  failed: 'Başarısız gönderim yok.',
};

export function SendList() {
  const search = useSearchParams();
  const status = statusFromSearch(search.get('status'));
  const page = pageFromSearch(search.get('page'));
  const state = useApiPage<SendRow>('/mail_tasks', sendListQuery({ status, page, pageSize: PAGE_SIZE }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={sectionLabel('/mail-tasks')}
        description="Her gönderimin durumu alıcılarının kuyruktaki durumundan çıkar: bir alıcısı bile başarısızsa gönderim başarısızdır."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusFilter current={status} />
        {state.status === 'success' && state.data.total !== null ? (
          <p className="text-xs text-neutral-500 tabular-nums" aria-live="polite">
            {formatCount(state.data.total)} gönderim
          </p>
        ) : null}
      </div>

      {state.status === 'loading' ? (
        <StateCard isLoading title="Yükleniyor" />
      ) : state.status === 'error' ? (
        <StateCard
          Icon={AlertTriangle}
          tone="danger"
          title="Gönderimler yüklenemedi"
          description={state.error.message}
        />
      ) : state.data.items.length === 0 && page > 1 ? (
        <StateCard title="Bu sayfada gönderim yok" description="Liste bu sayfaya kadar uzanmıyor.">
          <Link href={sendListHref({ status })} className="text-skylab-300 text-sm hover:underline">
            İlk sayfaya dön
          </Link>
        </StateCard>
      ) : (
        <>
          {/* A phone gets rows it can read without scrolling sideways. */}
          {state.data.items.length > 0 ? (
            <ul className="divide-y divide-white/5 rounded-lg border border-white/5 md:hidden">
              {state.data.items.map((row) => (
                <SendItem
                  key={row.id}
                  id={row.id}
                  title={templateLabel(row)}
                  createdAt={row.created_at}
                  audience={audienceOfSendRow(row)}
                  status={row.status}
                  counts={row.recipient_counts}
                />
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-white/5 px-4 py-6 text-center text-sm text-neutral-500 md:hidden">
              {EMPTY_TEXT[status ?? 'all']}
            </p>
          )}
          <div className="hidden md:block">
            <DataTable<SendRow>
              data={state.data.items}
              emptyText={EMPTY_TEXT[status ?? 'all']}
              columns={[
                {
                  key: 'template_name',
                  header: 'Mail template',
                  render: (_, row) => (
                    <Link
                      href={`${SEND_LIST_PATH}/show/${row.id}`}
                      className="hover:text-skylab-300 block max-w-[16rem] truncate font-medium text-neutral-100 transition-colors"
                    >
                      {templateLabel(row)}
                    </Link>
                  ),
                },
                {
                  key: 'mail_list_name',
                  header: 'Kitle',
                  render: (_, row) => <Audience audience={audienceOfSendRow(row)} className="max-w-[14rem]" />,
                },
                {
                  key: 'status',
                  header: 'Durum',
                  render: (value: SendStatus) => <SendStatusBadge status={value} />,
                },
                {
                  key: 'recipient_counts',
                  header: 'Alıcılar',
                  render: (_, row) => <RecipientCounts row={row} />,
                },
                {
                  key: 'created_at',
                  header: 'Tarih',
                  render: (value: string) => (
                    <span className="text-neutral-400 tabular-nums">{formatSendTime(value)}</span>
                  ),
                },
              ]}
            />
          </div>
          <Pager
            page={page}
            pageSize={PAGE_SIZE}
            total={state.data.total}
            rowsOnPage={state.data.items.length}
            hrefFor={(next) => sendListHref({ status, page: next })}
          />
        </>
      )}
    </div>
  );
}

function StatusFilter({ current }: { current: SendStatus | null }) {
  return (
    <nav
      aria-label="Duruma göre süz"
      className="flex w-full items-center gap-0.5 rounded-md border border-white/10 bg-white/5 p-0.5 sm:w-auto"
    >
      {STATUS_FILTERS.map((filter) => {
        const active = filter.value === current;
        return (
          <Link
            key={filter.label}
            href={sendListHref({ status: filter.value })}
            aria-current={active ? 'page' : undefined}
            className={`flex-1 rounded px-2.5 py-1 text-center text-xs whitespace-nowrap transition sm:flex-none ${
              active ? 'bg-white/10 font-medium text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {filter.label}
          </Link>
        );
      })}
    </nav>
  );
}

function RecipientCounts({ row }: { row: SendRow }) {
  const { total, parts } = recipientSummary(row.recipient_counts);
  return (
    <span className="flex flex-col">
      <span className="text-neutral-200 tabular-nums">{total === 0 ? 'Alıcı yok' : `${formatCount(total)} alıcı`}</span>
      {parts.length > 0 ? (
        <span className="text-2xs text-neutral-500 tabular-nums">{parts.join(' · ')}</span>
      ) : null}
    </span>
  );
}
