'use client';

// The send list: every send newest first, filtered by the status the API
// derives from its recipients. The filter and the page live in the address
// (`?status=failed&page=2`), so the home screen's failed tile, a bookmark and
// the back button all land on the same list.

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Plus } from 'lucide-react';
import { Button, FilterPills, Pagination, StateCard } from '@skylab-kulubu/skylcn-ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { ResponsiveTable } from '@/components/tables/ResponsiveTable';
import { useConsole } from '@/components/layout/ConsoleContext';
import { NavButton } from '@/components/common/NavButton';
import { sectionLabel } from '@/lib/access';
import { useApiLoad } from '@/lib/api/react';
import { knownPageCount } from '@/lib/list-view';
import { sendAccess } from '@/lib/send-form/access';
import { newsAccess, newsSendHref } from '@/lib/news-send';
import {
  audienceLabel,
  composeHref,
  fetchSendPage,
  formatCount,
  formatSendTime,
  readSendListView,
  recipientsLabel,
  recipientSummary,
  SEND_PAGE_SIZE,
  sendHref,
  sendListHref,
  STATUS_FILTERS,
  templateLabel,
  type Send,
  type SendFilter,
  type SendListView,
  type SendStatus,
} from '@/lib/sends';
import { useLastPage } from '@/lib/ui/use-last-page';
import { Audience } from './Audience';
import { SendItem } from './SendItem';
import { SenderPausedCheck } from './SenderPaused';
import { SendStatusBadge } from './StatusBadge';

const EMPTY_TEXT: Readonly<Record<SendFilter, string>> = {
  all: 'Henüz gönderim yok.',
  sending: 'Şu anda gönderilmekte olan bir gönderim yok.',
  sent: 'Tamamlanmış gönderim yok.',
  failed: 'Başarısız gönderim yok.',
};

export function SendList() {
  const router = useRouter();
  // Anyone who can pick a template may compose: what they cannot send goes for approval.
  const { roles } = useConsole();
  const canCompose = sendAccess(roles).people;
  const canNews = newsAccess(roles).prepare;
  const view = readSendListView(useSearchParams());
  const state = useApiLoad((api, signal) => fetchSendPage(api, view, signal), `${view.status}:${view.page}`);
  const lastPage =
    state.status === 'success'
      ? knownPageCount({ total: state.data.total, rows: state.data.items.length }, view.page, SEND_PAGE_SIZE)
      : null;

  function show(next: SendListView) {
    router.push(sendListHref(next), { scroll: false });
  }

  // A stale link past the end moves to the last page there is.
  useLastPage(view.page, lastPage, (page) => router.replace(sendListHref({ status: view.status, page }), { scroll: false }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={sectionLabel('/mail-tasks')}
        description="Her gönderimin durumu alıcılarının kuyruktaki durumundan çıkar: bir alıcısı bile başarısızsa gönderim başarısızdır."
        actions={
          canCompose || canNews ? (
            <>
              {canNews ? <NavButton variant="outline" href={newsSendHref('')}>Haberden gönder</NavButton> : null}
              {canCompose ? <NavButton variant="primary" href={composeHref()}><Plus aria-hidden />Yeni gönderim</NavButton> : null}
            </>
          ) : undefined
        }
      />

      <SenderPausedCheck />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills
          aria-label="Gösterilen gönderimler"
          value={view.status}
          options={STATUS_FILTERS}
          onValueChange={(next) => show({ status: next, page: 1 })}
        />
        {/* Present from the start, so a screen reader hears the count change with the filter. */}
        <p className="text-xs text-subtle-foreground tabular-nums" aria-live="polite">
          {state.status === 'success' && state.data.total !== null ? `${formatCount(state.data.total)} gönderim` : ''}
        </p>
      </div>

      {state.status === 'loading' ? (
        <StateCard loading title="Gönderimler yükleniyor" />
      ) : state.status === 'error' ? (
        <StateCard icon={AlertTriangle} tone="danger" title="Gönderimler yüklenemedi" description={state.error.message}>
          <Button variant="outline" onClick={() => void state.reload()}>
            Tekrar dene
          </Button>
        </StateCard>
      ) : (
        <div className="space-y-2">
          <ResponsiveTable<Send>
            rows={state.data.items}
            emptyText={EMPTY_TEXT[view.status]}
            renderItem={(send) => <SendItem send={send} />}
            columns={[
              {
                key: 'template_name',
                header: 'Mail template',
                render: (_, send) => (
                  <Link
                    href={sendHref(send.id)}
                    className="hover:text-skylab-300 block max-w-[16rem] truncate font-medium text-foreground transition-colors"
                  >
                    {templateLabel(send)}
                  </Link>
                ),
              },
              {
                key: 'audience',
                header: 'Kitle',
                render: (_, send) => <Audience audience={audienceLabel(send.audience)} className="max-w-[16rem]" />,
              },
              {
                key: 'status',
                header: 'Durum',
                render: (value: SendStatus) => <SendStatusBadge status={value} />,
              },
              {
                key: 'recipient_counts',
                header: 'Alıcılar',
                render: (_, send) => <RecipientCounts send={send} />,
              },
              {
                key: 'created_at',
                header: 'Tarih',
                render: (value: string) => <span className="text-muted-foreground tabular-nums">{formatSendTime(value)}</span>,
              },
            ]}
          />
          <Pagination
            aria-label="Gönderim sayfaları"
            current={view.page}
            totalPages={lastPage ?? 1}
            onPageChange={(next) => show({ ...view, page: next })}
          />
        </div>
      )}
    </div>
  );
}

function RecipientCounts({ send }: { send: Send }) {
  const { total, parts } = recipientSummary(send.recipient_counts);
  return (
    <span className="flex flex-col">
      <span className="text-secondary-foreground tabular-nums">{recipientsLabel(total)}</span>
      {parts.length > 0 ? <span className="text-2xs text-subtle-foreground tabular-nums">{parts.join(' · ')}</span> : null}
    </span>
  );
}
