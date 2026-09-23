'use client';

/**
 * The Required variable panel (ticket 13): the variables a Mail template's
 * body must keep referencing, and why. The sending service's contract's are
 * locked; operators mark and release their own. In the editor it also warns
 * of a Required variable the edited body no longer references and points at
 * the one a refused save or publish named; for a reader it only shows them.
 * The rules live in src/lib/template-editor/required-variables.ts; the
 * server, which checks every save and publish, stays the authority.
 */
import { useState } from 'react';
import { AlertTriangle, Lock, Plus } from 'lucide-react';
import { NoticeBox } from '@/components/chrome/Notice';
import { Tag } from '@/components/chrome/Tag';
import { Button } from '@/components/ui/Button';
import { asApiError } from '@/lib/api/errors';
import { useApi } from '@/lib/api/react';
import type { EditorState } from '@/lib/template-editor/editor-state';
import {
  bodyVariables,
  requiredPanel,
  requiredSetsOf,
  requiredVariableProblem,
  withRefusal,
  type RequiredRow,
} from '@/lib/template-editor/required-variables';
import { fetchTemplate, markRequiredVariable, releaseRequiredVariable, type MailTemplate } from '@/lib/templates';
import type { Refusal } from './EditorParts';

const asAction = (name: string) => `{{.${name}}}`;

type Outcome = Readonly<{ tone: 'success' | 'error'; text: string }>;

export function RequiredVariablesPanel({
  template,
  editing,
}: {
  template: MailTemplate;
  /** The editor's state and its last refusal; left out, the panel is read-only. */
  editing?: { state: EditorState; refusal: Refusal | null };
}) {
  const api = useApi();
  // As the last answer about the template has them: marking and releasing answer with it.
  const [sets, setSets] = useState(() => requiredSetsOf(template));
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // A refused save or publish may name one marked, or taken into the
  // contract, since the editor opened: the panel learns it from the refusal.
  const problem = editing?.refusal?.problem ?? null;
  const [seen, setSeen] = useState(problem);
  if (problem !== seen) {
    setSeen(problem);
    if (sets) setSets(withRefusal(sets, problem));
  }

  if (!sets) return null;
  const panel = requiredPanel({
    sets,
    body: editing ? bodyVariables(editing.state) : null,
    problem,
    canWrite: editing !== undefined,
  });

  async function change(name: string, action: 'mark' | 'release') {
    setBusy(name);
    setOutcome(null);
    try {
      const answer =
        action === 'mark'
          ? await markRequiredVariable(api, template.id, name)
          : await releaseRequiredVariable(api, template.id, name);
      setSets(requiredSetsOf(answer));
      setOutcome({
        tone: 'success',
        text:
          action === 'mark'
            ? `${asAction(name)} artık zorunlu: bundan sonraki her kaydetme ve yayım ona başvurmak zorunda.`
            : `${asAction(name)} artık zorunlu değil.`,
      });
    } catch (error) {
      setOutcome({ tone: 'error', text: requiredVariableProblem(error, name) });
      // The template changed under the panel (a publish, the contract): show it as it is now.
      const { status } = asApiError(error);
      if (status === 409 || status === 422) {
        await fetchTemplate(api, template.id).then((answer) => setSets(requiredSetsOf(answer)), () => undefined);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="required-variables-heading"
      className="space-y-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
    >
      <div>
        <h2 id="required-variables-heading" className="text-sm font-medium">
          Required variable&apos;lar
        </h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Gövde bunların her birine başvurmalı; başvurmayan bir kaydetme ya da yayım, eksik değişkenin adıyla reddedilir.
          Kilitli olanlar gönderen servisin sözleşmesinden gelir ve panelden çıkarılamaz.
        </p>
      </div>

      {panel.rows.length === 0 ? (
        <p className="text-xs text-neutral-500">Bu template&apos;in Required variable&apos;ı yok.</p>
      ) : (
        <ul aria-label="Required variable'lar" className="divide-y divide-white/5">
          {panel.rows.map((row) => (
            <Row
              key={row.name}
              row={row}
              refusedBy={editing?.refusal?.title ?? null}
              busy={busy}
              onRelease={() => void change(row.name, 'release')}
            />
          ))}
        </ul>
      )}

      {outcome ? <NoticeBox tone={outcome.tone}>{outcome.text}</NoticeBox> : null}

      {editing ? (
        <div className="space-y-2 border-t border-white/5 pt-3">
          <p className="text-xs font-medium text-neutral-300">Zorunlu işaretle</p>
          {panel.candidates.length > 0 ? (
            <>
              <p className="text-xs text-neutral-500">
                Gönderilen maildeki değişkenler. İşaretlediğin değişkene bundan sonraki her kaydetme ve yayım başvurmak zorunda.
              </p>
              <div className="flex flex-wrap gap-2">
                {panel.candidates.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => void change(name, 'mark')}
                    disabled={busy !== null}
                    className="border-skylab-400/40 text-skylab-300 hover:bg-skylab-500/10 focus-visible:ring-skylab-400/40 inline-flex max-w-full cursor-pointer items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate">{busy === name ? 'İşaretleniyor…' : asAction(name)}</span>
                    <span className="sr-only"> değişkenini zorunlu işaretle</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-neutral-500">Gönderilen mailde, henüz zorunlu olmayan bir değişken yok.</p>
          )}
          {panel.draftOnly.length > 0 ? (
            <p className="text-xs text-neutral-400">
              Yalnız taslağında geçiyor:{' '}
              {panel.draftOnly.map((name, index) => (
                <span key={name}>
                  {index > 0 ? ', ' : null}
                  <code className="font-mono break-all text-neutral-200">{asAction(name)}</code>
                </span>
              ))}
              . Gönderilen mailde olmadığı için henüz zorunlu işaretlenemez: SkyMail yalnız yayımlanmış gövdenin başvurduğu
              değişkeni zorunlu sayar. Taslağı yayımladıktan sonra burada işaretleyebilirsin.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Row({
  row,
  refusedBy,
  busy,
  onRelease,
}: {
  row: RequiredRow;
  /** The refusal's title ("Kaydedilmedi", "Yayımlanmadı"), for a variable it named. */
  refusedBy: string | null;
  busy: string | null;
  onRelease: () => void;
}) {
  const tint =
    row.state === 'refused'
      ? '-mx-2 rounded-md border border-red-400/30 bg-red-500/10 px-2'
      : row.state === 'dropped'
        ? '-mx-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-2'
        : '';
  return (
    <li className={`flex items-start gap-3 py-2.5 ${tint}`}>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-2">
          {row.locked ? <Lock className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden /> : null}
          <code className="font-mono text-xs break-all text-neutral-100">{asAction(row.name)}</code>
          {row.locked ? (
            <>
              <Tag tone="system">Sözleşme</Tag>
              <span className="sr-only">kilitli, çıkarılamaz</span>
            </>
          ) : null}
        </p>
        <p className="text-xs text-neutral-400">{row.why}</p>
        {row.state === 'dropped' ? (
          <p className="flex items-start gap-1.5 text-xs text-amber-300">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            Düzenlediğin gövde buna artık başvurmuyor; bu hâliyle kaydedilemez ve yayımlanamaz.
          </p>
        ) : null}
        {row.state === 'refused' ? (
          <p className="flex items-start gap-1.5 text-xs text-red-300">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            {refusedBy ?? 'Reddedildi'}: gövde bu değişkene başvurmuyor.
          </p>
        ) : null}
      </div>
      {row.removable ? (
        <Button variant="secondary" onClick={onRelease} disabled={busy !== null}>
          {busy === row.name ? 'Çıkarılıyor…' : 'Çıkar'}
          <span className="sr-only"> {asAction(row.name)}</span>
        </Button>
      ) : null}
    </li>
  );
}
