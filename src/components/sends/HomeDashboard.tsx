'use client';

// The home screen answers "did my mail go out?": the stat row, the last 30
// days as an area chart and the last five sends, all from one summary call.
// The layout and the pieces follow SkyForms' dashboard (forms-frontend
// `src/app/admin/page.js`): stat tiles, a trend section, a recent-items list.

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Lock, Send } from 'lucide-react';
import type { ReactNode } from 'react';
import { StateCard } from '@/components/chrome/StateCard';
import { useCan } from '@/components/layout/ConsoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { ROLE, sectionLabel } from '@/lib/access';
import { useApiQuery } from '@/lib/api/react';
import {
  audienceOfRecentSend,
  dailySeries,
  formatCount,
  homeTiles,
  SEND_LIST_PATH,
  templateLabel,
  type HomeTile,
  type RecentSend,
  type SendSummary,
} from '@/lib/sends';
import { DailySentChart } from './DailySentChart';
import { SendItem } from './SendItem';

const DAYS = 30;
const RECENT = 5;

export function HomeDashboard() {
  const canReadMails = useCan(ROLE.mailsRead);
  return (
    <div className="space-y-6">
      <PageHeader title={sectionLabel('/')} description="Kulübün gönderdiği mailler bir bakışta." />
      {canReadMails ? (
        <Summary />
      ) : (
        <StateCard
          Icon={Lock}
          tone="warning"
          title="Gönderim özetini görme yetkin yok"
          description={`Gönderimleri görmek için ${ROLE.mailsRead} rolü gerekiyor. Erişime ihtiyacın varsa kulüp yönetimine başvur.`}
        />
      )}
    </div>
  );
}

function Summary() {
  const state = useApiQuery<SendSummary>('/mail_tasks/summary', { days: DAYS, recent: RECENT });

  if (state.status === 'error') {
    return (
      <StateCard
        Icon={AlertTriangle}
        tone="danger"
        title="Gönderim özeti yüklenemedi"
        description={state.error.message}
      />
    );
  }

  const summary = state.data;
  const points = summary ? dailySeries(summary.daily_sent) : [];
  const windowTotal = points.reduce((sum, point) => sum + point.sent, 0);

  return (
    <div className="space-y-6">
      <section aria-label="Sayılar" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {summary
          ? homeTiles(summary).map((tile) => <StatTile key={tile.key} tile={tile} />)
          : Array.from({ length: 3 }, (_, i) => <div key={i} className="shimmer h-[5.25rem] rounded-md" />)}
      </section>

      <section aria-labelledby="daily-sent-title">
        <SectionTitle id="daily-sent-title" aside={summary ? `Toplam ${formatCount(windowTotal)} mail` : null}>
          Son {DAYS} günde gönderilen mail
        </SectionTitle>
        {summary ? (
          <div
            className="h-44 w-full sm:h-52"
            role="img"
            aria-label={`Son ${DAYS} günde gün gün gönderilen mail; toplam ${formatCount(windowTotal)} mail.`}
          >
            <DailySentChart points={points} />
          </div>
        ) : (
          <div className="shimmer h-44 w-full rounded-md sm:h-52" />
        )}
      </section>

      <section aria-labelledby="recent-sends-title">
        <SectionTitle
          id="recent-sends-title"
          aside={
            <Link
              href={SEND_LIST_PATH}
              className="text-2xs inline-flex items-center gap-1 font-medium text-neutral-400 transition-colors hover:text-neutral-200"
            >
              Tümünü gör
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          }
        >
          Son gönderimler
        </SectionTitle>
        {summary ? <RecentSends sends={summary.recent_sends} /> : <RecentSendsSkeleton />}
      </section>
    </div>
  );
}

function SectionTitle({ id, children, aside }: { id: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 id={id} className="text-2xs font-medium text-neutral-500">
        {children}
      </h2>
      <span className="h-px flex-1 bg-white/5" aria-hidden />
      {aside ? <span className="text-2xs shrink-0 text-neutral-500">{aside}</span> : null}
    </div>
  );
}

const TILE_TONE: Readonly<Record<HomeTile['key'], { dot: string; value: string }>> = {
  pending: { dot: 'bg-amber-400 shadow-[0_0_6px] shadow-amber-400/40', value: 'text-amber-300' },
  sentToday: { dot: 'bg-skylab-400 shadow-[0_0_6px] shadow-skylab-400/40', value: 'text-neutral-100' },
  failed: { dot: 'bg-red-400 shadow-[0_0_6px] shadow-red-400/40', value: 'text-red-300' },
};

function StatTile({ tile }: { tile: HomeTile }) {
  // A zero is good news; only a number that asks for attention keeps its colour.
  const tone = TILE_TONE[tile.key];
  const quiet = tile.value === 0 && tile.key !== 'sentToday';
  const body = (
    <>
      <span className={`size-1.5 shrink-0 rounded-full ${quiet ? 'bg-neutral-500' : tone.dot}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="text-2xs block truncate text-neutral-500">{tile.label}</span>
        <span className="flex items-baseline gap-1.5">
          <span
            className={`text-2xl leading-tight font-semibold tabular-nums ${quiet ? 'text-neutral-100' : tone.value}`}
          >
            {formatCount(tile.value)}
          </span>
          <span className="text-xs text-neutral-400">{tile.unit}</span>
        </span>
        <span className="text-3xs block text-neutral-500">{tile.note}</span>
      </span>
      {tile.href ? (
        <ArrowRight
          className="h-3.5 w-3.5 shrink-0 text-neutral-600 transition-all group-hover/tile:translate-x-0.5 group-hover/tile:text-neutral-400"
          aria-hidden
        />
      ) : null}
    </>
  );
  const className =
    'flex items-center gap-3 rounded-md border border-white/5 bg-white/[0.03] px-3.5 py-3 transition-colors';

  return tile.href ? (
    <Link
      href={tile.href}
      className={`group/tile ${className} focus-visible:ring-skylab-400/40 hover:border-white/10 hover:bg-white/5 focus-visible:ring-2 focus-visible:outline-none`}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function RecentSends({ sends }: { sends: readonly RecentSend[] }) {
  if (sends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-white/5 py-10 text-center">
        <Send className="mb-1 h-6 w-6 text-neutral-600" strokeWidth={1.5} aria-hidden />
        <p className="text-xs text-neutral-400">Henüz gönderim yok.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-white/5 rounded-md border border-white/5">
      {sends.map((send) => (
        <SendItem
          key={send.id}
          id={send.id}
          title={templateLabel(send)}
          templateKey={send.template_key}
          createdAt={send.created_at}
          audience={audienceOfRecentSend(send.audience)}
          status={send.status}
          counts={send.recipient_counts}
        />
      ))}
    </ul>
  );
}

function RecentSendsSkeleton() {
  return (
    <div className="divide-y divide-white/5 rounded-md border border-white/5">
      {Array.from({ length: RECENT }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="shimmer h-3.5 w-40 rounded-md" />
            <div className="shimmer h-2.5 w-24 rounded-md" />
          </div>
          <div className="shimmer hidden h-2.5 w-20 rounded-md sm:block" />
        </div>
      ))}
    </div>
  );
}
