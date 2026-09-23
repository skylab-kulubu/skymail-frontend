'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { NoticeBox } from '@/components/chrome/Notice';
import { referencedVariables } from '@/lib/mail-render/go-template';
import type { SampleValues } from '@/lib/mail-render/preview';
import type { MailScheme } from '@/lib/template-editor/preview';
import { readTypedSamples, sampleNames, sampleValues, writeTypedSamples } from '@/lib/template-editor/samples';
import { EditorNote, RenderWarnings, SamplePanel } from './EditorParts';
import { MailFrame, SchemeToggle, SubjectPreview } from '@/components/mail-preview/MailPreview';

/** The variables of a stored body, for a preview that has no render of its own yet. */
function storedVariables(html: string | null): string[] {
  if (!html) return [];
  try {
    return referencedVariables(html);
  } catch {
    return [];
  }
}

/** The browser's storage, or null where reaching it throws (blocked site data). */
function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The sample values a page previews with, for the variables the body and
 * subject reference: what the operator typed, else the repo file's, else a
 * guess for a common name. What the operator types for a template is kept in
 * their browser under `storageKey` (its id), so a reload keeps it.
 */
export function useSample(
  variables: readonly string[] | undefined,
  fallbackHtml: string | null,
  subject: string,
  repo: SampleValues,
  storageKey?: string,
) {
  const [typed, setTyped] = useState<Record<string, string>>({});
  useEffect(() => {
    const storage = localStorageOrNull();
    if (storageKey && storage) setTyped(readTypedSamples(storage, storageKey));
  }, [storageKey]);
  const variablesKey = (variables ?? storedVariables(fallbackHtml)).join('\n');
  const names = useMemo(() => sampleNames(variablesKey === '' ? [] : variablesKey.split('\n'), subject), [variablesKey, subject]);
  const sample = useMemo(() => sampleValues(names, repo, typed), [names, repo, typed]);
  return {
    names,
    sample,
    type: (name: string, value: string) =>
      setTyped((previous) => {
        const next = { ...previous, [name]: value };
        const storage = localStorageOrNull();
        if (storageKey && storage) writeTypedSamples(storage, storageKey, next);
        return next;
      }),
  };
}

/**
 * The live preview: the subject and the mail as a recipient reads them, in
 * the theme picked, with sample values. While a newer text renders, or when
 * it does not render, the last render stays in view and says so.
 */
export function PreviewPane({
  html,
  pending,
  failure,
  failureKept = false,
  note,
  subject,
  samples,
  warnings = [],
}: {
  html: string | null;
  pending: boolean;
  failure: string | null;
  /**
   * The failing source is untouched and already main: a save keeps its stored
   * body (a template the panel cannot render keeps its wording editable).
   */
  failureKept?: boolean;
  note?: ReactNode;
  subject: string;
  samples: ReturnType<typeof useSample>;
  /** The shown render's warnings: said here, and again before a publish. */
  warnings?: readonly string[];
}) {
  const [scheme, setScheme] = useState<MailScheme>('light');
  return (
    <section aria-labelledby="preview-heading" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="preview-heading" className="flex items-center gap-2 text-sm font-medium">
          Önizleme
          {pending && html !== null ? (
            <span role="status" className="inline-flex items-center gap-1 text-xs font-normal text-neutral-500">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              güncelleniyor
            </span>
          ) : null}
        </h2>
        <SchemeToggle value={scheme} onChange={setScheme} />
      </div>
      {note ? <EditorNote>{note}</EditorNote> : null}
      {failure ? (
        <NoticeBox tone="error">
          <p className="font-medium">
            {failureKept
              ? 'Bu kaynak panelde render edilemedi. Ona dokunmadığın sürece kaydetmek, kayıtlı gövdeyi olduğu gibi korur.'
              : 'Render edilemedi; bu hâliyle kaydedilemez.'}
          </p>
          <p className="mt-1 font-mono text-xs whitespace-pre-wrap">{failure}</p>
          {html !== null ? <p className="mt-1 text-xs">Aşağıda son başarılı render duruyor.</p> : null}
        </NoticeBox>
      ) : null}
      <RenderWarnings warnings={warnings} when="Bu mail gönderilebilir, ama düzeltmen iyi olur:" />
      <SubjectPreview subject={subject} sample={samples.sample} />
      <MailFrame
        title="Mail önizlemesi"
        html={html}
        sample={samples.sample}
        scheme={scheme}
        emptyText={failure && html === null ? 'Gösterilecek bir render yok.' : undefined}
      />
      <SamplePanel names={samples.names} sample={samples.sample} onType={samples.type} />
    </section>
  );
}
