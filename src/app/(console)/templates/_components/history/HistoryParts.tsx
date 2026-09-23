'use client';

import { AlertTriangle, History } from 'lucide-react';
import { NoticeBox } from '@/components/chrome/Notice';
import type { VersionBadge } from '@/lib/template-history/history';
import { seedRefusalBadge, seedRefusalText } from '@/lib/template-history/seed-refusal';
import { templateHref, type MailTemplate } from '@/lib/templates';

// Only tones the light theme redefines (globals.css): emerald and amber
// 300/400, the neutral scale and "white" washes.
const BADGE_TONE = {
  sent: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  published: 'border-white/10 bg-white/5 text-neutral-300',
  draft: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  covered: 'border-dashed border-amber-400/30 text-amber-300',
  discarded: 'border-dashed border-white/15 text-neutral-500',
} as const;

/** How a version stands: Gönderilen, Yayımlanmış, Süren taslak, Taslak or Atılmış taslak. */
export function VersionStateBadge({ badge }: { badge: VersionBadge }) {
  const tone = badge.state === 'draft' && !badge.inProgress ? 'covered' : badge.state;
  return (
    <span
      className={`text-2xs inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-medium whitespace-nowrap ${BADGE_TONE[tone]}`}
    >
      {badge.label}
    </span>
  );
}

/**
 * The way to a template's version history from its header, and a refused
 * Template seed said where the template is looked at (story 41); the history
 * says it in full. Plain anchors rather than next/link: leaving the editor is
 * then a real navigation, so its question about unsaved changes
 * (`beforeunload`) is asked.
 */
export function HistoryLinks({ template }: { template: Pick<MailTemplate, 'id' | 'seed_refusal'> }) {
  const href = templateHref.history(template.id);
  const refused = seedRefusalBadge(template.seed_refusal);
  return (
    <>
      <a
        href={href}
        className="text-skylab-300 focus-visible:ring-skylab-400/40 inline-flex items-center gap-1 rounded text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
      >
        <History className="h-3 w-3" aria-hidden />
        Sürüm geçmişi
      </a>
      {refused ? (
        <a
          href={href}
          title="Neden ve zorlamanın ne yapacağı sürüm geçmişinde"
          className="focus-visible:ring-skylab-400/40 text-2xs inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 font-medium text-amber-300 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
          {refused}
        </a>
      ) : null}
    </>
  );
}

/**
 * A Template seed refused for this template because of an operator's change
 * (ADR-0047): when, which rule held, and what forcing it would do. Nothing
 * when no seed is refused.
 */
export function SeedRefusalNotice({ refusal }: { refusal: MailTemplate['seed_refusal'] }) {
  const text = seedRefusalText(refusal);
  if (!text) return null;
  return (
    <section aria-labelledby="seed-refusal-title">
      <NoticeBox tone="warning">
        <h2 id="seed-refusal-title" className="font-medium text-amber-300">
          Template seed reddedildi
        </h2>
        <p className="mt-1">{text.headline}</p>
        {text.reasons.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {text.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2">{text.forcing}</p>
        <p className="mt-1">{text.unforced}</p>
      </NoticeBox>
    </section>
  );
}
