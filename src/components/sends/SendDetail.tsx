'use client';

// One send: what went out, to whom, how its recipients fared, and each
// recipient's status and error, so a failure can be followed up. Ported from
// the old panel's src/pages/mail-tasks/show.tsx; the recipient filter and page
// live in the address (`?status=failed&page=2`) and the API filters and pages.

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { AlertTriangle, Clock, Eye, Inbox, Lock, SearchX } from 'lucide-react';
import { Button, FilterPills, Notice, Pagination, StateCard } from '@skylab-kulubu/skylcn-ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/tables/DataTable';
import { useApiLoad } from '@/lib/api/react';
import {
  audienceLabel,
  contentNote,
  fetchRecipientPage,
  fetchSend,
  formatSendTime,
  noRecipientsNote,
  readRecipientView,
  RECIPIENT_PAGE_SIZE,
  recipientFilters,
  recipientsLabel,
  recipientStatus,
  recipientSummary,
  SEND_LIST_PATH,
  sendHref,
  templateLabel,
  type RecipientFilter,
  type RecipientRow,
  type RecipientView,
  type Send,
} from '@/lib/sends';
import { knownPageCount } from '@/lib/list-view';
import { useFlashNotice, type NoticeData } from '@/lib/notice';
import { mailRecipientLabel } from '@/lib/people';
import { useLastPage } from '@/lib/ui/use-last-page';
import { Audience } from './Audience';
import { SectionTitle } from './SectionTitle';
import { RecipientStatusBadge, SendStatusBadge } from './StatusBadge';
import { OutcomeNotice } from '@/components/common/OutcomeNotice';
import { SentContentDialog } from './SentContentDialog';

export function SendDetail({ id }: { id: string }) {
  const send = useApiLoad((api, signal) => fetchSend(api, id, signal), id);
  // The send form leaves one here when it opens a send.
  const [notice, setNotice] = useFlashNotice(sendHref(id));

  if (send.status === 'loading') return <StateCard loading title="Gönderim yükleniyor" />;
  if (send.status === 'error') {
    return send.error.status === 404 ? (
      <StateCard icon={SearchX} title="Gönderim bulunamadı" description="Bu adreste bir gönderim yok.">
        <Link href={SEND_LIST_PATH} className="text-skylab-300 text-sm hover:underline">
          Gönderimlere dön
        </Link>
      </StateCard>
    ) : (
      <StateCard icon={AlertTriangle} tone="danger" title="Gönderim yüklenemedi" description={send.error.message}>
        <Button variant="outline" onClick={() => void send.reload()}>
          Tekrar dene
        </Button>
      </StateCard>
    );
  }
  return <SendView send={send.data} notice={notice} onDismiss={() => setNotice(null)} />;
}

function SendView({ send, notice, onDismiss }: { send: Send; notice: NoticeData | null; onDismiss: () => void }) {
  const recipients = recipientSummary(send.recipient_counts);

  return (
    <div className="space-y-6">
      <PageHeader
        title={templateLabel(send)}
        description={`Gönderim · ${formatSendTime(send.created_at)}`}
        meta={
          <>
            <SendStatusBadge status={send.status} />
            {send.template_key ? (
              <span className="text-2xs font-mono text-subtle-foreground">{send.template_key}</span>
            ) : null}
          </>
        }
      />

      {notice ? <OutcomeNotice notice={notice} onDismiss={onDismiss} /> : null}

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Fact term="Kitle" className="col-span-2 sm:col-span-1">
          <Audience audience={audienceLabel(send.audience)} />
        </Fact>
        <Fact term="Oluşturulma">{formatSendTime(send.created_at)}</Fact>
        <Fact term="Alıcılar">
          <span className="tabular-nums">{recipientsLabel(recipients.total)}</span>
          {recipients.parts.length > 0 ? (
            <span className="text-2xs block whitespace-normal text-subtle-foreground tabular-nums">
              {recipients.parts.join(' · ')}
            </span>
          ) : null}
        </Fact>
      </dl>

      <ContentNotice send={send} />

      <section aria-labelledby="recipients-title">
        <SectionTitle id="recipients-title">Alıcılar</SectionTitle>
        {recipients.total === 0 ? (
          <StateCard icon={Inbox} title="Kuyrukta alıcı yok" description={noRecipientsNote(send.created_at)} />
        ) : (
          <Recipients send={send} />
        )}
      </section>
    </div>
  );
}

const EMPTY_TEXT: Readonly<Record<RecipientFilter, string>> = {
  all: 'Bu gönderimde alıcı yok.',
  failed: 'Başarısız alıcı yok.',
  pending: 'Bekleyen alıcı yok.',
  processing: 'İşlenen alıcı yok.',
  sent: 'Gönderilmiş alıcı yok.',
};

/** Whether the send's content can be opened, and if not why (skymail-backend, sent mail content). */
function ContentNotice({ send }: { send: Send }) {
  const note = contentNote(send);
  if (!note) return null;
  const icon = send.content_access === 'available' ? Eye : send.content_access === 'expired' ? Clock : Lock;
  return (
    <Notice tone="info" icon={icon} title="İçerik" aria-label="İçerik">
      {note.text}
    </Notice>
  );
}

function Recipients({ send }: { send: Send }) {
  const router = useRouter();
  const canOpen = send.content_access === 'available';
  const [opened, setOpened] = useState<{ rowId: string; recipient: string } | null>(null);
  const open = (row: RecipientRow) =>
    setOpened({ rowId: row.id, recipient: mailRecipientLabel(row.recipient_full_name, row.recipient_email).name });
  const view = readRecipientView(useSearchParams());
  const state = useApiLoad(
    (api, signal) => fetchRecipientPage(api, send.id, view, signal),
    `${send.id}:${view.status}:${view.page}`,
  );
  const lastPage =
    state.status === 'success'
      ? knownPageCount({ total: state.data.total, rows: state.data.items.length }, view.page, RECIPIENT_PAGE_SIZE)
      : null;

  function show(next: RecipientView) {
    router.push(sendHref(send.id, next), { scroll: false });
  }

  // A stale link past the end moves to the last page there is.
  useLastPage(view.page, lastPage, (page) => router.replace(sendHref(send.id, { status: view.status, page }), { scroll: false }));

  const emptyText = EMPTY_TEXT[view.status];

  return (
    <div className="space-y-3">
      <div className="max-w-full overflow-x-auto">
        <FilterPills
          aria-label="Gösterilen alıcılar"
          value={view.status}
          options={recipientFilters(send.recipient_counts, view.status)}
          onValueChange={(next) => show({ status: next, page: 1 })}
        />
      </div>

      {state.status === 'loading' ? (
        <StateCard loading title="Alıcılar yükleniyor" />
      ) : state.status === 'error' ? (
        <StateCard icon={AlertTriangle} tone="danger" title="Alıcılar yüklenemedi" description={state.error.message}>
          <Button variant="outline" onClick={() => void state.reload()}>
            Tekrar dene
          </Button>
        </StateCard>
      ) : (
        <div className="space-y-2">
          {/* A phone gets each recipient as a block, with the error readable underneath. */}
          <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle md:hidden">
            {state.data.items.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-subtle-foreground">{emptyText}</li>
            ) : (
              state.data.items.map((row) => (
                <li key={row.id} className="space-y-1.5 px-3.5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Recipient row={row} />
                    </div>
                    <span className="shrink-0">
                      <RecipientStatusBadge status={recipientStatus(row.status)} />
                    </span>
                  </div>
                  {row.error ? <p className="text-xs break-words text-destructive">{row.error}</p> : null}
                  <Attempts row={row} inline />
                  {canOpen ? <OpenContent row={row} onOpen={open} /> : null}
                </li>
              ))
            )}
          </ul>
          <div className="hidden md:block">
            <DataTable<RecipientRow>
              data={state.data.items}
              emptyText={emptyText}
              columns={[
                { key: 'recipient_email', header: 'Alıcı', render: (_, row) => <Recipient row={row} /> },
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
                      <span className="block max-w-md min-w-[14rem] text-xs break-words whitespace-normal text-destructive">
                        {value}
                      </span>
                    ) : (
                      <span className="text-faint-foreground">—</span>
                    ),
                },
                { key: 'attempts', header: 'Deneme', render: (_, row) => <Attempts row={row} /> },
                ...(canOpen
                  ? [
                      {
                        key: 'id' as const,
                        header: 'İçerik',
                        render: (_: unknown, row: RecipientRow) => <OpenContent row={row} onOpen={open} />,
                      },
                    ]
                  : []),
              ]}
            />
          </div>
          <Pagination
            aria-label="Alıcı sayfaları"
            current={view.page}
            totalPages={lastPage ?? 1}
            onPageChange={(next) => show({ ...view, page: next })}
          />
        </div>
      )}
      {opened ? (
        <SentContentDialog sendId={send.id} rowId={opened.rowId} recipient={opened.recipient} onClose={() => setOpened(null)} />
      ) : null}
    </div>
  );
}

/** Opens one recipient's mail as it was sent. */
function OpenContent({ row, onOpen }: { row: RecipientRow; onOpen: (row: RecipientRow) => void }) {
  const { name } = mailRecipientLabel(row.recipient_full_name, row.recipient_email);
  return (
    <Button variant="outline" size="sm" aria-label={`${name}: içeriği gör`} onClick={() => onOpen(row)}>
      İçeriği gör
    </Button>
  );
}

function Fact({ term, children, className = '' }: { term: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 rounded-md border border-border-subtle bg-card px-3.5 py-3 ${className}`}>
      <dt className="text-2xs text-subtle-foreground">{term}</dt>
      <dd className="mt-1 min-w-0 truncate text-sm text-secondary-foreground">{children}</dd>
    </div>
  );
}

/** A recipient by name, the address underneath; one whose address erasure emptied is Silinmiş kullanıcı. */
function Recipient({ row }: { row: RecipientRow }) {
  const { name, address } = mailRecipientLabel(row.recipient_full_name, row.recipient_email);
  return (
    <span className="flex max-w-[18rem] flex-col">
      <span className="truncate text-secondary-foreground">{name}</span>
      {address ? <span className="text-2xs truncate text-subtle-foreground">{address}</span> : null}
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
      <p className="text-2xs text-subtle-foreground tabular-nums">
        {row.attempts} deneme{next ? ` · ${next}` : ''}
      </p>
    );
  }
  return (
    <span className="flex flex-col">
      <span className="text-secondary-foreground tabular-nums">{row.attempts > 0 ? row.attempts : '—'}</span>
      {next ? <span className="text-2xs text-subtle-foreground">{next}</span> : null}
    </span>
  );
}
