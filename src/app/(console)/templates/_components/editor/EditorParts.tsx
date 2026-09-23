'use client';

import { AlertTriangle, Info, Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Field } from '@/components/chrome/Field';
import { formatDateTime } from '@/lib/format';
import type { SampleValues } from '@/lib/mail-render/preview';
import type { VersionProblem } from '@/lib/template-editor/api';
import type { Blocker } from '@/lib/template-editor/editor-state';
import { SYSTEM_TEMPLATE_NOTE, type MailTemplate, type VersionAuthor } from '@/lib/templates';

/** Who wrote a version, in the words the history uses. */
export function authorLabel(author: VersionAuthor, viewerSub: string | null): string {
  if (author.kind === 'template_seed') return 'Template seed';
  if (viewerSub && author.sub === viewerSub) return 'sen';
  return author.name?.trim() || 'Adı bilinmeyen operatör';
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

/** A note beside the editor: a stale draft, someone else's draft, what the preview shows. */
export function EditorNote({ tone = 'info', children }: { tone?: 'info' | 'warning'; children: ReactNode }) {
  const Icon = tone === 'warning' ? AlertTriangle : Info;
  const colours =
    tone === 'warning'
      ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
      : 'border-white/10 bg-white/[0.03] text-neutral-300';
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${colours}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 break-words">{children}</div>
    </div>
  );
}

export type Refusal = Readonly<{ title: string; problem?: VersionProblem; blockers?: readonly Blocker[] }>;

/**
 * Why a save, a Main source change or a publish did not happen: the editor's
 * own reasons (a source with no render), or the API's — by missing Required
 * variable with why the mail needs it, or by the part the mailer cannot parse.
 */
export function RefusalNotice({ refusal }: { refusal: Refusal }) {
  const { title, problem, blockers } = refusal;
  return (
    <div role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      <p className="flex items-start gap-2 font-medium">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {title}
      </p>
      <div className="mt-1.5 space-y-2 pl-6 break-words">
        {problem ? <p>{problem.message}</p> : null}
        {problem?.kind === 'missing-variables' && problem.missing.length > 0 ? (
          <ul className="space-y-1.5">
            {problem.missing.map((variable) => (
              <li key={`${variable.source}:${variable.name}`}>
                <code className="rounded bg-red-500/10 px-1 font-mono text-xs">{`{{.${variable.name}}}`}</code>{' '}
                <span className="text-red-300/90">
                  {variable.why} ({variable.source === 'contract' ? 'gönderen servisin sözleşmesi' : 'operatör işaretledi'})
                </span>
              </li>
            ))}
          </ul>
        ) : null}
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
      </div>
    </div>
  );
}

/**
 * The values the preview fills the template with. They come from the repo's
 * file for the template where there is one; the operator can type others.
 * Nothing here is saved or sent.
 */
export function SamplePanel({
  names,
  repo,
  typed,
  onType,
}: {
  names: readonly string[];
  repo: SampleValues;
  typed: Readonly<Record<string, string>>;
  onType: (name: string, value: string) => void;
}) {
  const shown = (name: string) => {
    if (Object.hasOwn(typed, name)) return typed[name];
    const value = repo[name];
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
          Önizleme bu değerlerle dolar; kaydedilmez, gönderilmez. Değeri olmayan değişken önizlemede «Ad» olarak görünür.
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
