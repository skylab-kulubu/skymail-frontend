'use client';

// One send: what went out, to whom, and each recipient's status and error, so
// a failure can be followed up. Ported from the old panel's
// src/pages/mail-tasks/show.tsx (the send, then its queue rows).

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Inbox, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';
import { StateCard } from '@/components/chrome/StateCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/tables/DataTable';
import { useApiPage, useApiQuery } from '@/lib/api/react';
import {
  audienceOfSendRow,
  countRecipients,
  followUpOrder,
  formatCount,
  formatSendTime,
  noRecipientsNote,
  pageFromSearch,
  pageRange,
  recipientStatus,
  recipientSummary,
  SEND_LIST_PATH,
  templateLabel,
  type RecipientRow,
  type SendRecord,
} from '@/lib/sends';
import { Audience } from './Audience';
import { Pager } from './Pager';
import { RecipientStatusBadge } from './StatusBadge';

const PAGE_SIZE = 100;

export function SendDetail({ id }: { id: string }) {
  const send = useApiQuery<SendRecord>(`/mail_tasks/${id}`);

  if (send.status === 'loading') return <StateCard isLoading title="Yükleniyor" />;
  if (send.status === 'error') {
    return send.error.status === 404 ? (
      <StateCard Icon={SearchX} title="Gönderim bulunamadı" description="Bu adreste bir gönderim yok.">
        <BackToList />
      </StateCard>
    ) : (
      <StateCard Icon={AlertTriangle} tone="danger" title="Gönderim yüklenemedi" description={send.error.message}>
        <BackToList />
      </StateCard>
    );
  }
  return <SendView send={send.data} />;
}

function BackToList() {
  return (
    <Link href={SEND_LIST_PATH} className="text-skylab-300 text-sm hover:underline">
      Gönderimlere dön
    </Link>
  );
}

function SendView({ send }: { send: SendRecord }) {
  const search = useSearchParams();
  const page = pageFromSearch(search.get('page'));
  const recipients = useApiPage<RecipientRow>(`/mail_tasks/${send.id}/queue`, pageRange(page, PAGE_SIZE));
  const loaded = recipients.status === 'success' ? recipients.data : null;
  const rows = loaded ? followUpOrder(loaded.items) : [];
  // The API does not count a send's recipients by status here; when one page
  // holds them all, the page's own count is the send's.
  const whole = loaded !== null && loaded.total !== null && loaded.total <= PAGE_SIZE && page === 1;
  const counted = recipientSummary(countRecipients(rows));
  const pageHref = (next: number) =>
    next > 1 ? `${SEND_LIST_PATH}/show/${send.id}?page=${next}` : `${SEND_LIST_PATH}/show/${send.id}`;

  return (
    <div className="space-y-6">
      <PageHeader title={templateLabel(send)} description={`Gönderim · ${formatSendTime(send.created_at)}`} />

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Fact term="Kitle" className="col-span-2 sm:col-span-1">
          <Audience audience={audienceOfSendRow(send)} />
        </Fact>
        <Fact term="Oluşturulma">{formatSendTime(send.created_at)}</Fact>
        <Fact term="Alıcı sayısı">{loaded?.total == null ? '—' : formatCount(loaded.total)}</Fact>
      </dl>

      <section aria-labelledby="recipients-title" className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 id="recipients-title" className="text-2xs font-medium text-neutral-500">
            Alıcılar
          </h2>
          <span className="h-px flex-1 bg-white/5" aria-hidden />
          {counted.parts.length > 0 ? (
            <span className="text-2xs shrink-0 text-neutral-500 tabular-nums">
              {whole ? '' : 'Bu sayfada: '}
              {counted.parts.join(' · ')}
            </span>
          ) : null}
        </div>

        {recipients.status === 'loading' ? (
          <StateCard isLoading title="Alıcılar yükleniyor" />
        ) : recipients.status === 'error' ? (
          <StateCard
            Icon={AlertTriangle}
            tone="danger"
            title="Alıcılar yüklenemedi"
            description={recipients.error.message}
          />
        ) : rows.length === 0 && page === 1 ? (
          <StateCard Icon={Inbox} title="Kuyrukta alıcı yok" description={noRecipientsNote(send.created_at)} />
        ) : (
          <>
            {!whole && rows.length > 0 ? (
              <p className="text-2xs text-neutral-500">
                Her sayfada önce başarısız alıcılar, sonra gönderilmeyi bekleyenler, en son gönderilenler.
              </p>
            ) : null}
            {/* A phone gets each recipient as a block, with the error readable underneath. */}
            <ul className="divide-y divide-white/5 rounded-lg border border-white/5 md:hidden">
              {rows.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-neutral-500">Bu sayfada alıcı yok.</li>
              ) : (
                rows.map((row) => (
                  <li key={row.id} className="space-y-1.5 px-3.5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Recipient row={row} />
                      </div>
                      <span className="shrink-0">
                        <RecipientStatusBadge status={recipientStatus(row.status)} />
                      </span>
                    </div>
                    {row.error ? (
                      <p className="text-xs break-words text-red-300">{row.error}</p>
                    ) : null}
                    <Attempts row={row} inline />
                  </li>
                ))
              )}
            </ul>
            <div className="hidden md:block">
              <DataTable<RecipientRow>
                data={rows}
                emptyText="Bu sayfada alıcı yok."
                columns={[
                  {
                    key: 'recipient_email',
                    header: 'Alıcı',
                    render: (_, row) => <Recipient row={row} />,
                  },
                  {
                    key: 'status',
                    header: 'Durum',
                    render: (_, row) => <RecipientStatusBadge status={recipientStatus(row.status)} />,
                  },
                  {
                    key: 'error',
                    header: 'Hata',
                    render: (value: string | null) =>
                      value ? (
                        <span className="block max-w-md min-w-[14rem] text-xs break-words whitespace-normal text-red-300">
                          {value}
                        </span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      ),
                  },
                  {
                    key: 'attempts',
                    header: 'Deneme',
                    render: (_, row) => <Attempts row={row} />,
                  },
                ]}
              />
            </div>
            {loaded ? (
              <Pager
                page={page}
                pageSize={PAGE_SIZE}
                total={loaded.total}
                rowsOnPage={loaded.items.length}
                hrefFor={pageHref}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function Fact({ term, children, className = '' }: { term: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 rounded-md border border-white/5 bg-white/[0.03] px-3.5 py-3 ${className}`}>
      <dt className="text-2xs text-neutral-500">{term}</dt>
      <dd className="mt-1 min-w-0 truncate text-sm text-neutral-200">{children}</dd>
    </div>
  );
}

function Recipient({ row }: { row: RecipientRow }) {
  const name = row.recipient_full_name.trim();
  return (
    <span className="flex max-w-[18rem] flex-col">
      <span className="truncate text-neutral-200">{name || row.recipient_email}</span>
      {name ? <span className="text-2xs truncate text-neutral-500">{row.recipient_email}</span> : null}
    </span>
  );
}

/** How many times the mailer tried; a pending row that already failed once says when it tries again. */
function Attempts({ row, inline = false }: { row: RecipientRow; inline?: boolean }) {
  const retrying = recipientStatus(row.status) === 'pending' && row.attempts > 0 && row.next_attempt_at;
  const next = retrying ? `Sonraki deneme: ${formatSendTime(row.next_attempt_at)}` : null;
  if (inline) {
    // One attempt is the ordinary case; say so only when the mailer had to try again.
    if (row.attempts <= 1 && !next) return null;
    return (
      <p className="text-2xs text-neutral-500 tabular-nums">
        {row.attempts} deneme{next ? ` · ${next}` : ''}
      </p>
    );
  }
  return (
    <span className="flex flex-col">
      <span className="text-neutral-300 tabular-nums">{row.attempts > 0 ? row.attempts : '—'}</span>
      {next ? <span className="text-2xs text-neutral-500">{next}</span> : null}
    </span>
  );
}
