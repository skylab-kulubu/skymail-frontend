'use client';

import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Field } from '@/components/chrome/Field';
import { NoticeBox } from '@/components/chrome/Notice';
import { formatDateTime } from '@/lib/format';
import { variableAction } from '@/lib/mail-render/go-template';
import type { SampleValues } from '@/lib/mail-render/preview';
import { Button } from '@/components/ui/Button';
import type { Blocker, EditableMode } from '@/lib/template-editor/editor-state';
import type { MissingVariable, VersionProblem } from '@/lib/template-editor/refusals';
import {
  AUTHORING_MODE_LABEL,
  SYSTEM_TEMPLATE_NOTE,
  authorName,
  writtenBy,
  type MailTemplate,
  type VersionAuthor,
} from '@/lib/templates';

/** Who wrote a version, in the words the history uses. */
export function authorLabel(author: VersionAuthor, viewerSub: string | null): string {
  if (author.kind === 'template_seed') return 'Template seed';
  return writtenBy(author, viewerSub) ? 'sen' : authorName(author);
}

/** "#4 · Mehmet Kaya · 23 Eylül 2026 10:12" */
export function versionLine(version: { seq: number; author: VersionAuthor; created_at: string; published_at: string | null }, viewerSub: string | null) {
  return `#${version.seq} · ${authorLabel(version.author, viewerSub)} · ${formatDateTime(version.published_at ?? version.created_at)}`;
}

/** The Template key, read-only here: a service may address the template by it (ADR-0045). */
export function TemplateKey({ template }: { template: MailTemplate }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-neutral-300">Template key</p>
      <p className="flex h-8 items-center rounded-md border border-white/5 bg-white/[0.02] px-3 font-mono text-xs break-all text-neutral-300">
        {template.key ?? <span className="font-sans text-neutral-500">Yok</span>}
      </p>
      {template.system ? (
        <p className="flex items-start gap-1.5 text-xs text-neutral-500">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          {SYSTEM_TEMPLATE_NOTE} Adı, konusu ve gövdesi burada düzenlenir; Template key değişmez.
        </p>
      ) : null}
    </div>
  );
}

/**
 * A render's warnings (src/lib/mail-render/warnings.ts): each says what to
 * fix. They stop nothing; a repo template fails emails:render for the same.
 */
export function RenderWarnings({ warnings, when }: { warnings: readonly string[]; when: string }) {
  if (warnings.length === 0) return null;
  return (
    <NoticeBox tone="warning">
      <p className="font-medium">{when}</p>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </NoticeBox>
  );
}

/** A note beside the editor: a stale draft, someone else's draft, what the preview shows. */
export function EditorNote({ tone = 'info', children }: { tone?: 'info' | 'warning'; children: ReactNode }) {
  return <NoticeBox tone={tone}>{children}</NoticeBox>;
}

export type Refusal = Readonly<{ title: string; problem?: VersionProblem; blockers?: readonly Blocker[] }>;

/** Required variables a body does not reference, each with why the mail needs it and where that comes from. */
export function MissingVariables({ missing }: { missing: readonly MissingVariable[] }) {
  return (
    <ul className="space-y-1.5">
      {missing.map((variable) => (
        <li key={`${variable.source}:${variable.name}`}>
          <code className="rounded bg-red-500/10 px-1 font-mono text-xs">{variableAction(variable.name)}</code>{' '}
          {variable.why} ({variable.source === 'contract' ? 'gönderen servisin sözleşmesi' : 'operatör işaretledi'})
        </li>
      ))}
    </ul>
  );
}

/**
 * Why a save, a Main source change or a publish did not happen: the editor's
 * own reasons (a source with no render), or the API's — by missing Required
 * variable with why the mail needs it, or by the part the mailer cannot parse.
 * A source that blocks a save because of unsaved changes can be set back from
 * here (`onRevert`), so the rest of the work still saves.
 */
export function RefusalNotice({
  refusal,
  onRevert,
}: {
  refusal: Refusal;
  /** Sets one source back as stored; offered for each source that blocks and has unsaved changes. */
  onRevert?: { can: (mode: EditableMode) => boolean; revert: (mode: EditableMode) => void };
}) {
  const { title, problem, blockers } = refusal;
  const revertable = (blockers ?? []).flatMap((blocker) =>
    blocker.mode && onRevert?.can(blocker.mode) ? [blocker.mode] : [],
  );
  return (
    <NoticeBox tone="error">
      <p className="font-medium">{title}</p>
      <div className="mt-1.5 space-y-2">
        {problem ? <p>{problem.message}</p> : null}
        {problem?.kind === 'missing-variables' && problem.missing.length > 0 ? <MissingVariables missing={problem.missing} /> : null}
        {problem?.kind === 'unparseable' && problem.detail ? (
          <pre className="overflow-x-auto rounded bg-red-500/10 px-2 py-1 font-mono text-xs whitespace-pre-wrap">{problem.detail}</pre>
        ) : null}
        {blockers && blockers.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4">
            {blockers.map((blocker) => (
              <li key={blocker.message}>{blocker.message}</li>
            ))}
          </ul>
        ) : null}
        {revertable.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {[...new Set(revertable)].map((mode) => (
              <Button key={mode} variant="secondary" onClick={() => onRevert?.revert(mode)}>
                {AUTHORING_MODE_LABEL[mode]} kaynağındaki değişiklikleri geri al
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </NoticeBox>
  );
}

/**
 * The values the preview fills the template with: the repo's file's for the
 * template where there is one, a guess for a common name, and whatever the
 * operator types, which their browser keeps for the template. Nothing here
 * is saved or sent.
 */
export function SamplePanel({
  names,
  sample,
  onType,
}: {
  names: readonly string[];
  /** The values in use, by name. */
  sample: SampleValues;
  onType: (name: string, value: string) => void;
}) {
  const shown = (name: string) => {
    const value = sample[name];
    if (value === undefined || value === null) return '';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  };
  return (
    <details className="group rounded-lg border border-white/10 bg-white/[0.02]">
      <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-neutral-300 select-none">
        Örnek değerler ({names.length})
      </summary>
      <div className="space-y-3 border-t border-white/5 px-4 py-3">
        <p className="text-xs text-neutral-500">
          Önizleme bu değerlerle dolar; kaydedilmez, gönderilmez. Yazdıkların bu tarayıcıda bu template için saklanır.
          Değeri olmayan değişken önizlemede «Ad» olarak görünür.
        </p>
        {names.length === 0 ? (
          <p className="text-xs text-neutral-500">Bu template değişken kullanmıyor.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {names.map((name) => (
              <label key={name} className="block min-w-0 space-y-1">
                <span className="block truncate font-mono text-xs text-neutral-400">{name}</span>
                <Field value={shown(name)} placeholder={`«${name}»`} onChange={(event) => onType(name, event.target.value)} />
              </label>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
