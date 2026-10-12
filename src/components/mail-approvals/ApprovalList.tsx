'use client';

// Mail onayı's list (ticket 20): an approver sees everyone's requests,
// pending first, or only the ones they submitted, and filters by state;
// anyone else sees their own. The filters and the page live in the address
// (`?state=returned&mine=true&page=2`). A request to several people shows
// the first few and how many more (ticket 22).

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowRight, Plus } from 'lucide-react';
import { Button, FilterPills, Pagination, StateCard } from '@skylab-kulubu/skylcn-ui';
import { useConsole } from '@/components/layout/ConsoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Audience } from '@/components/sends/Audience';
import { ResponsiveTable } from '@/components/tables/ResponsiveTable';
import { NavButton } from '@/components/common/NavButton';
import { isApprover, sectionLabel } from '@/lib/access';
import { useApiLoad } from '@/lib/api/react';
import { knownPageCount } from '@/lib/list-view';
import { formatClubTime } from '@/lib/format';
import {
  APPROVAL_FILTERS,
  APPROVAL_PAGE_SIZE,
  APPROVAL_SCOPES,
  approvalAudience,
  approvalHref,
  approvalListHref,
  effectiveState,
  fetchApprovalPage,
  readApprovalListView,
  submitterName,
  type ApprovalFilter,
  type ApprovalItem,
  type ApprovalListView,
} from '@/lib/mail-approvals/approvals';
import { sendAccess } from '@/lib/send-form/access';
import { composeHref, formatCount } from '@/lib/sends';
import { useLastPage } from '@/lib/ui/use-last-page';
import { ApprovalStateBadge, Deadline, Submitter } from './ApprovalParts';

const EMPTY_TEXT: Readonly<Record<ApprovalFilter, string>> = {
  all: 'Henüz onaya sunulan bir gönderim yok.',
  pending: 'Onay bekleyen bir gönderim yok.',
  returned: 'Sunana geri gönderilmiş bir istek yok.',
  approved: 'Onaylanan bir istek yok.',
  rejected: 'Reddedilen bir istek yok.',
  declined: 'Düzenlemesi kabul edilmeyen bir istek yok.',
  expired: 'Süresi dolan bir istek yok.',
};

export function ApprovalList() {
  const router = useRouter();
  const { roles } = useConsole();
  const approver = isApprover(roles);
  const canCompose = sendAccess(roles).people;
  const view = readApprovalListView(useSearchParams(), { approver });
  const state = useApiLoad(
    (api, signal) => fetchApprovalPage(api, view, { approver }, signal),
    `${approver}:${view.state}:${view.mine}:${view.page}`,
  );
  const lastPage =
    state.status === 'success'
      ? knownPageCount({ total: state.data.total, rows: state.data.items.length }, view.page, APPROVAL_PAGE_SIZE)
      : null;
  const now = new Date();

  function show(next: ApprovalListView) {
    router.push(approvalListHref(next, { approver }), { scroll: false });
  }

  // A stale link past the end moves to the last page there is.
  useLastPage(view.page, lastPage, (page) => router.replace(approvalListHref({ ...view, page }, { approver }), { scroll: false }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={sectionLabel('/mail-approvals')}
        description={
          approver
            ? 'Onaya sunulan gönderimler. 7 gün içinde karar verilmeyen istek gönderilmez.'
            : 'Onaya sunduğun gönderimler. Bir onaycı onaylayınca gönderilir.'
        }
        actions={canCompose ? <NavButton variant="primary" href={composeHref()}><Plus aria-hidden />Yeni gönderim</NavButton> : undefined}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {approver ? (
            <FilterPills
              aria-label="Kimin istekleri"
              value={view.mine ? 'mine' : 'all'}
              options={APPROVAL_SCOPES}
              onValueChange={(next) => show({ ...view, mine: next === 'mine', page: 1 })}
            />
          ) : null}
          {/* On a phone the filter scrolls within itself, a label to a line. */}
          <div className="max-w-full overflow-x-auto">
            <div className="w-max">
              <FilterPills
                aria-label="Gösterilen istekler"
                value={view.state}
                options={APPROVAL_FILTERS}
                onValueChange={(next) => show({ ...view, state: next, page: 1 })}
              />
            </div>
          </div>
        </div>
        {/* Present from the start, so a screen reader hears the count change with the filter. */}
        <p className="text-xs text-subtle-foreground tabular-nums" aria-live="polite">
          {state.status === 'success' && state.data.total !== null ? `${formatCount(state.data.total)} istek` : ''}
        </p>
      </div>

      {state.status === 'loading' ? (
        <StateCard loading title="İstekler yükleniyor" />
      ) : state.status === 'error' ? (
        <StateCard icon={AlertTriangle} tone="danger" title="İstekler yüklenemedi" description={state.error.message}>
          <Button variant="outline" onClick={() => void state.reload()}>
            Tekrar dene
          </Button>
        </StateCard>
      ) : (
        <div className="space-y-2">
          <ResponsiveTable<ApprovalItem>
            rows={state.data.items}
            emptyText={EMPTY_TEXT[view.state]}
            renderItem={(item) => <ApprovalRow item={item} now={now} />}
            columns={[
              {
                key: 'template',
                header: 'Mail template',
                render: (_, item) => (
                  <span className="flex max-w-[16rem] flex-col">
                    <Link
                      href={approvalHref(item.id)}
                      className="hover:text-skylab-300 truncate font-medium text-foreground transition-colors"
                    >
                      {item.template.name}
                    </Link>
                    {item.template.key ? <span className="text-2xs truncate font-mono text-subtle-foreground">{item.template.key}</span> : null}
                  </span>
                ),
              },
              {
                key: 'audience',
                header: 'Kitle',
                render: (_, item) => <Audience audience={approvalAudience(item)} className="max-w-[12rem]" />,
              },
              {
                key: 'submitter',
                header: 'Sunan',
                render: (_, item) => <Submitter submitter={item.submitter} at={item.submitted_at} />,
              },
              { key: 'deadline_at', header: 'Son tarih', render: (_, item) => <Deadline item={item} now={now} /> },
              { key: 'state', header: 'Durum', render: (_, item) => <StateCell item={item} now={now} /> },
            ]}
          />
          <Pagination
            aria-label="İstek sayfaları"
            current={view.page}
            totalPages={lastPage ?? 1}
            onPageChange={(next) => show({ ...view, page: next })}
          />
        </div>
      )}
    </div>
  );
}

/** The state, and a rejection's reason under it: the list shows why without opening the request. */
function StateCell({ item, now }: { item: ApprovalItem; now: Date }) {
  const reason = item.state === 'rejected' && item.last_event?.kind === 'rejected' ? item.last_event.note : null;
  return (
    <span className="flex max-w-[14rem] flex-col items-start gap-1">
      <ApprovalStateBadge state={effectiveState(item, now)} />
      {reason ? <span className="text-2xs line-clamp-2 whitespace-normal text-subtle-foreground">“{reason}”</span> : null}
    </span>
  );
}

/** One request as a phone reads it: the template, who and to whom, the deadline and the state. */
function ApprovalRow({ item, now }: { item: ApprovalItem; now: Date }) {
  const href = approvalHref(item.id);
  return (
    <li className="group/row relative transition-colors hover:bg-accent">
      {/* The whole row opens the request; the links inside it sit above this one. */}
      <Link href={href} className="absolute inset-0 z-0" aria-hidden tabIndex={-1} />
      <div className="flex items-start gap-3 px-3.5 py-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <Link href={href} className="relative z-10 min-w-0 truncate text-sm font-medium text-secondary-foreground group-hover/row:text-foreground-strong">
              {item.template.name}
            </Link>
            <span className="shrink-0">
              <ApprovalStateBadge state={effectiveState(item, now)} />
            </span>
          </div>
          <Audience audience={approvalAudience(item)} className="text-xs" />
          <p className="text-2xs text-subtle-foreground">
            {submitterName(item.submitter)} · {formatClubTime(item.submitted_at)}
          </p>
          <p className="text-2xs text-subtle-foreground">
            Son tarih: <Deadline item={item} now={now} inline />
          </p>
        </div>
        <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-faint-foreground group-hover/row:text-muted-foreground" aria-hidden />
      </div>
    </li>
  );
}
