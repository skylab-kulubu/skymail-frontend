'use client';

// SkyForms' dashboard trend chart (forms-frontend `src/app/admin/page.js`,
// WeeklyTrend): the same area, gradient, dots and tooltip in the house accent.
// The accent is the theme's (--sl-accent: #e0c8e5 dark, a darker lilac light)
// so the line still reads on the light surface.

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dayTitle, formatCount, type DailyPoint } from '@/lib/sends';

const ACCENT = 'var(--sl-accent)';

function DailyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: DailyPoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-md border border-white/10 bg-neutral-900/90 px-2.5 py-1.5 shadow-xl">
      <p className="text-3xs text-neutral-500">{dayTitle(point.date)}</p>
      <p className="text-2xs text-skylab-300 font-medium">{formatCount(point.sent)} mail</p>
    </div>
  );
}

export function DailySentChart({ points }: { points: readonly DailyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      {/* The page gives screen readers the days as a table; Recharts' keyboard layer would be a second, focusable copy. */}
      <AreaChart
        data={[...points]}
        margin={{ top: 5, right: 10, bottom: -2, left: 10 }}
        accessibilityLayer={false}
      >
        <defs>
          <linearGradient id="dailySentFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'rgb(100,100,110)' }}
          interval="preserveStartEnd"
          minTickGap={16}
          dy={4}
        />
        <YAxis hide domain={[0, 'auto']} />
        <Tooltip
          content={<DailyTooltip />}
          cursor={{ stroke: ACCENT, strokeWidth: 0.5, strokeDasharray: '3 3' }}
        />
        <Area
          type="monotone"
          dataKey="sent"
          stroke={ACCENT}
          strokeWidth={2}
          fill="url(#dailySentFill)"
          dot={{ r: 2.5, fill: ACCENT, strokeWidth: 0 }}
          activeDot={{ r: 4, fill: 'var(--color-skylab-300)', strokeWidth: 0 }}
          animationDuration={500}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
