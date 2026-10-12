'use client';

// The home screen answers "did my mail go out?": the stat row, the last 30
// days as an area chart and the last five sends, all from one summary call.
// The layout and the pieces follow SkyForms' dashboard (forms-frontend
// `src/app/admin/page.js`): stat tiles, a trend section, a recent-items list.

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Send } from 'lucide-react';
import { Button, StateCard, StatusDot } from '@skylab-kulubu/skylcn-ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { RoleGate } from '@/components/layout/RoleGate';
import { ROLE, sectionLabel } from '@/lib/access';
import { useApiQuery } from '@/lib/api/react';
import {
  dailySeries,
  dayTitle,
  formatCount,
  homeTiles,
  SEND_LIST_PATH,
  senderPaused,
  type DailyPoint,
  type HomeTile,
  type Send as SendRecord,
  type SendSummary,
} from '@/lib/sends';
import { DailySentChart } from './DailySentChart';
import { SectionTitle } from './SectionTitle';
import { SendItem } from './SendItem';
import { SenderPausedNotice } from './SenderPaused';
import { SKYLCN_TONE, TONE_TEXT, type Tone } from '@/components/common/ToneBadge';

const DAYS = 30;
const RECENT = 5;

export function HomeDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader title={sectionLabel('/')} description="Kulübün gönderdiği mailler bir bakışta." />
      {/* The home screen needs only skymail:access; its summary needs mails:read. */}
      <RoleGate role={ROLE.mailsRead}>
        <Summary />
      </RoleGate>
    </div>
  );
}

function Summary() {
  const state = useApiQuery<SendSummary>('/mail_tasks/summary', { days: DAYS, recent: RECENT });

  if (state.status === 'error') {
    return (
      <StateCard icon={AlertTriangle} tone="danger" title="Gönderim özeti yüklenemedi" description={state.error.message}>
        <Button variant="outline" onClick={() => void state.reload()}>
          Tekrar dene
        </Button>
      </StateCard>
    );
  }

  const summary = state.data;
  const points = summary ? dailySeries(summary.daily_sent) : [];
  const windowTotal = points.reduce((sum, point) => sum + point.sent, 0);

  return (
    <div className="space-y-6">
      {summary && senderPaused(summary) ? <SenderPausedNotice /> : null}

      <section aria-label="Sayılar" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {summary
          ? homeTiles(summary).map((tile) => <StatTile key={tile.key} tile={tile} />)
          : Array.from({ length: 3 }, (_, i) => <div key={i} className="shimmer-block h-[5.25rem] rounded-md" />)}
      </section>

      {/* relative: the visually hidden table is positioned inside the section, not against the page. */}
      <section aria-labelledby="daily-sent-title" className="relative">
        <SectionTitle id="daily-sent-title" aside={summary ? `Toplam ${formatCount(windowTotal)} mail` : null}>
          Son {DAYS} günde gönderilen mail
        </SectionTitle>
        {summary ? (
          <>
            <div className="h-44 w-full sm:h-52" aria-hidden>
              <DailySentChart points={points} />
            </div>
            <DailyTable points={points} />
          </>
        ) : (
          <div className="shimmer-block h-44 w-full rounded-md sm:h-52" />
        )}
      </section>

      <section aria-labelledby="recent-sends-title">
        <SectionTitle
          id="recent-sends-title"
          aside={
            <Link
              href={SEND_LIST_PATH}
              className="text-2xs inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-secondary-foreground"
            >
              Tümünü gör
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          }
        >
          Son gönderimler
        </SectionTitle>
        {summary ? (
          <RecentSends sends={summary.recent_sends} timeZone={summary.time_zone} />
        ) : (
          <RecentSendsSkeleton />
        )}
      </section>
    </div>
  );
}

/**
 * The chart's days for a screen reader, which the drawing cannot give it. The
 * wrapper is what hides it: a table grows with its rows whatever height it is
 * given, so on its own it would still push the page taller.
 */
function DailyTable({ points }: { points: readonly DailyPoint[] }) {
  return (
    <div className="sr-only">
      <table>
        <caption>Son {DAYS} günde gün gün gönderilen mail</caption>
        <thead>
          <tr>
            <th scope="col">Gün</th>
            <th scope="col">Gönderilen mail</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <th scope="row">{dayTitle(point.date)}</th>
              <td>{formatCount(point.sent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TILE_TONE: Readonly<Record<HomeTile['key'], Tone>> = {
  pending: 'busy',
  sentToday: 'good',
  failed: 'bad',
};

function StatTile({ tile }: { tile: HomeTile }) {
  // A zero is good news for pending and failed; only a number that asks for
  // attention keeps its colour.
  const tone = tile.value === 0 && tile.key !== 'sentToday' ? 'idle' : TILE_TONE[tile.key];
  const body = (
    <>
      <StatusDot tone={SKYLCN_TONE[tone]} />
      <span className="min-w-0 flex-1">
        <span className="text-2xs block truncate text-subtle-foreground">{tile.label}</span>
        <span className="flex items-baseline gap-1.5">
          <span className={`text-2xl leading-tight font-semibold tabular-nums ${TONE_TEXT[tone]}`}>
            {formatCount(tile.value)}
          </span>
          <span className="text-xs text-muted-foreground">{tile.unit}</span>
        </span>
        <span className="text-3xs block text-subtle-foreground">{tile.note}</span>
      </span>
      {tile.href ? (
        <ArrowRight
          className="h-3.5 w-3.5 shrink-0 text-faint-foreground transition-all group-hover/tile:translate-x-0.5 group-hover/tile:text-muted-foreground"
          aria-hidden
        />
      ) : null}
    </>
  );
  const className =
    'flex items-center gap-3 rounded-md border border-border-subtle bg-card px-3.5 py-3 transition-colors';

  return tile.href ? (
    <Link
      href={tile.href}
      className={`group/tile ${className} focus-visible:ring-ring hover:border-border hover:bg-accent focus-visible:ring-2 outline-hidden`}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function RecentSends({ sends, timeZone }: { sends: readonly SendRecord[]; timeZone: string }) {
  if (sends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-border-subtle py-10 text-center">
        <Send className="mb-1 h-6 w-6 text-faint-foreground" strokeWidth={1.5} aria-hidden />
        <p className="text-xs text-muted-foreground">Henüz gönderim yok.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border-subtle rounded-md border border-border-subtle">
      {sends.map((send) => (
        <SendItem key={send.id} send={send} timeZone={timeZone} />
      ))}
    </ul>
  );
}

function RecentSendsSkeleton() {
  return (
    <div className="divide-y divide-border-subtle rounded-md border border-border-subtle">
      {Array.from({ length: RECENT }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="shimmer-block h-3.5 w-40 rounded-md" />
            <div className="shimmer-block h-2.5 w-24 rounded-md" />
          </div>
          <div className="shimmer-block hidden h-2.5 w-20 rounded-md sm:block" />
        </div>
      ))}
    </div>
  );
}
