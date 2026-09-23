'use client';

import Link from 'next/link';
import { AlertTriangle, History } from 'lucide-react';
import { NoticeBox } from '@/components/chrome/Notice';
import { ToneBadge, type Tone } from '@/components/chrome/ToneBadge';
import type { VersionBadge } from '@/lib/template-history/history';
import { seedRefusalBadge, seedRefusalText } from '@/lib/template-history/seed-refusal';
import { templateHref, type MailTemplate } from '@/lib/templates';

/** The sent version is good news, a draft on its way (or stale) wants attention, the rest is history. */
function badgeTone(badge: VersionBadge): Tone {
  if (badge.state === 'sent') return 'good';
  if (badge.state === 'stale' || (badge.state === 'draft' && badge.inProgress)) return 'busy';
  return 'idle';
}

/** How a version stands: Gönderilen, Yayımlanmış, Süren taslak, Bayat taslak, Taslak or Atılmış taslak. */
export function VersionStateBadge({ badge }: { badge: VersionBadge }) {
  return <ToneBadge tone={badgeTone(badge)} label={badge.label} />;
}

const LINK_CLASS =
  'text-skylab-300 focus-visible:ring-skylab-400/40 inline-flex items-center gap-1 rounded text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none';

/**
 * The way to a template's version history from its header, and beside it a
 * refused Template seed, said where the template is looked at (story 41);
 * the history says it in full.
 */
export function HistoryLinks({
  template,
  fullNavigation = false,
}: {
  template: Pick<MailTemplate, 'id' | 'seed_refusal'>;
  /** Leave by a real navigation, so a page's `beforeunload` question is asked. */
  fullNavigation?: boolean;
}) {
  const href = templateHref.history(template.id);
  const refused = seedRefusalBadge(template.seed_refusal);
  const label = (
    <>
      <History className="h-3 w-3" aria-hidden />
      Sürüm geçmişi
    </>
  );
  return (
    <>
      {fullNavigation ? (
        <a href={href} className={LINK_CLASS}>
          {label}
        </a>
      ) : (
        <Link href={href} className={LINK_CLASS}>
          {label}
        </Link>
      )}
      {refused ? (
        <span className="text-2xs inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 font-medium text-amber-300">
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
          {refused}
        </span>
      ) : null}
    </>
  );
}

/**
 * A Template seed refused for this template because of an operator's change
 * (ADR-0047): when, which rule held, what forcing it would mean and what the
 * operator can do. Nothing when no seed is refused.
 */
export function SeedRefusalNotice({ template }: { template: Pick<MailTemplate, 'key' | 'seed_refusal'> }) {
  const text = seedRefusalText(template.seed_refusal, template.key);
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
        <h3 className="mt-3 font-medium">Ne yapabilirsin?</h3>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          {text.whatToDo.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </NoticeBox>
    </section>
  );
}
