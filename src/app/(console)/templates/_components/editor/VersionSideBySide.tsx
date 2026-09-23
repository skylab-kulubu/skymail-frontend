'use client';

import { useState, type ReactNode } from 'react';
import type { SampleValues } from '@/lib/mail-render/preview';
import type { MailScheme } from '@/components/mail-preview/preview-document';
import { versionLine } from '@/lib/template-history/history';
import { AUTHORING_MODE_LABEL, type TemplateVersion } from '@/lib/templates';
import { MailFrame, SchemeToggle, SubjectPreview } from '@/components/mail-preview/MailPreview';

/** One column of a side-by-side comparison. */
export type VersionSide = Readonly<{
  /** Names the column and its mail frame. */
  label: string;
  /** Null when there is no such version, e.g. nothing is published. */
  version: TemplateVersion | null;
  /** Beside the label: how the version stands, what can be done with it. */
  actions?: ReactNode;
}>;

function VersionColumn({
  side,
  viewerSub,
  sample,
  scheme,
}: {
  side: VersionSide;
  viewerSub: string | null;
  sample: SampleValues;
  scheme: MailScheme;
}) {
  const { label, version, actions } = side;
  // Beside a wide screen's other column, the rows line up (subgrid): the two
  // mails start at the same height however long either heading runs.
  return (
    <section aria-label={label} className="grid min-w-0 content-start gap-2 md:row-span-3 md:grid-rows-subgrid">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-neutral-100">{label}</h3>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {version ? (
          <p className="text-xs text-neutral-500">
            {versionLine(version, viewerSub)} · Main source {AUTHORING_MODE_LABEL[version.main_mode]}
          </p>
        ) : null}
      </div>
      {version ? (
        <>
          <SubjectPreview subject={version.subject} sample={sample} />
          <MailFrame title={label} html={version.html_content} sample={sample} scheme={scheme} className="h-[50vh] min-h-[320px]" />
        </>
      ) : (
        <p className="text-xs text-neutral-500">Yayımlanmış bir sürüm yok.</p>
      )}
    </section>
  );
}

/**
 * Two versions side by side as rendered mail — never as an HTML diff
 * (ADR-0046) — each with its subject filled with the same sample values, both
 * in the one mail theme picked above them. The stale-draft publish and the
 * version history both compare this way.
 */
export function VersionSideBySide({
  sides,
  viewerSub,
  sample,
}: {
  sides: readonly [VersionSide, VersionSide];
  viewerSub: string | null;
  sample: SampleValues;
}) {
  const [scheme, setScheme] = useState<MailScheme>('light');
  return (
    <>
      <div className="flex justify-end">
        <SchemeToggle value={scheme} onChange={setScheme} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:gap-y-2">
        {sides.map((side) => (
          <VersionColumn key={side.label} side={side} viewerSub={viewerSub} sample={sample} scheme={scheme} />
        ))}
      </div>
    </>
  );
}
