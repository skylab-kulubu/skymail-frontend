'use client';

/**
 * The Required variable panel (ticket 13): the variables a Mail template's
 * body must keep referencing, and why. The sending service's contract's are
 * locked; operators mark and release their own. In the editor it also warns
 * of a Required variable the body in the editor no longer references, before
 * marking one too, and points at the one a refused save or publish named;
 * for a reader it only shows them. The rules live in
 * src/lib/template-editor/required-variables.ts; the server, which checks
 * every save and publish, stays the authority.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Lock, Plus } from 'lucide-react';
import { NoticeBox } from '@/components/chrome/Notice';
import { Tag } from '@/components/chrome/Tag';
import { Button } from '@/components/ui/Button';
import { apiErrorMessage, asApiError } from '@/lib/api/errors';
import { useApi } from '@/lib/api/react';
import { variableAction } from '@/lib/mail-render/go-template';
import type { EditorState } from '@/lib/template-editor/editor-state';
import type { MissingVariable } from '@/lib/template-editor/refusals';
import {
  editorBody,
  requiredPanel,
  requiredSetsOf,
  requiredVariableProblem,
  type BodyKind,
  type RequiredRow,
} from '@/lib/template-editor/required-variables';
import { fetchTemplate, markRequiredVariable, releaseRequiredVariable, type MailTemplate } from '@/lib/templates';
import { MissingVariables, type Refusal } from './EditorParts';

/** What a Required variable's row says when the body in the editor does not reference it. */
const DROPPED: Readonly<Record<BodyKind, string>> = {
  edited: 'Düzenlediğin gövde buna artık başvurmuyor; bu hâliyle kaydedilemez ve yayımlanamaz.',
  draft: 'Kaydettiğin taslak buna başvurmuyor; bu hâliyle yayımlanamaz.',
  published: 'Gönderilen sürüm buna başvurmuyor; ona başvurmadan kaydedilemez.',
};

/** What marking a variable the body in the editor does not reference would do to it. */
const MARKING_DROPPED: Readonly<Record<BodyKind, string>> = {
  edited: 'Düzenlediğin gövde buna başvurmuyor; işaretlersen bu hâliyle kaydedilemez ve yayımlanamaz.',
  draft: 'Taslağın buna başvurmuyor; işaretlersen taslağın yayımlanamaz.',
  published: 'Açık olan sürüm buna başvurmuyor; işaretlersen ona başvurmadan kaydedilemez.',
};

type Outcome =
  | Readonly<{ tone: 'success'; text: string }>
  | Readonly<{ tone: 'error'; text: string; blockers: readonly MissingVariable[] }>;

type Working = Readonly<{ name: string; action: 'mark' | 'release' }>;

export function RequiredVariablesPanel({
  template,
  editing,
}: {
  template: MailTemplate;
  /**
   * The editor's state, its last refusal, and whether it is writing (a save
   * or publish on its way); left out, the panel is read-only.
   */
  editing?: { state: EditorState; refusal: Refusal | null; writing: boolean };
}) {
  const api = useApi();
  // As the API last answered: marking and releasing answer with the template, and it is read again when in doubt.
  const [sets, setSets] = useState(() => requiredSetsOf(template));
  const [working, setWorking] = useState<Working | null>(null);
  const [pending, setPending] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // Why the last read of the template failed: the panel may be out of date.
  const [unread, setUnread] = useState<string | null>(null);
  const hintId = useId();

  // One request at a time, in order, so an older answer never lands on a newer one.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const enqueue = useCallback((job: () => Promise<void>) => {
    setPending((count) => count + 1);
    queue.current = queue.current.then(job).finally(() => setPending((count) => count - 1));
  }, []);

  const reread = useCallback(async () => {
    try {
      setSets(requiredSetsOf(await fetchTemplate(api, template.id)));
      setUnread(null);
    } catch (error) {
      setUnread(apiErrorMessage(error));
    }
  }, [api, template.id]);

  // A save or publish refused for a Required variable: the sets may have
  // changed since the panel read them — marked by someone else, or released
  // while the save was on its way. They are read again; the refusal only
  // points at rows.
  const problem = editing?.refusal?.problem ?? null;
  useEffect(() => {
    if (problem?.kind === 'missing-variables') enqueue(reread);
  }, [problem, enqueue, reread]);

  if (!sets) return null;
  const body = editing ? editorBody(editing.state) : null;
  const panel = requiredPanel({ sets, body, problem, canWrite: editing !== undefined });
  // Nothing is marked or released while the editor writes, or the panel is waiting on the API.
  const idle = pending === 0 && !editing?.writing;

  function change(name: string, action: Working['action']) {
    setOutcome(null);
    enqueue(async () => {
      setWorking({ name, action });
      try {
        const answer =
          action === 'mark'
            ? await markRequiredVariable(api, template.id, name)
            : await releaseRequiredVariable(api, template.id, name);
        setSets(requiredSetsOf(answer));
        setUnread(null);
        setOutcome({
          tone: 'success',
          text:
            action === 'mark'
              ? `${variableAction(name)} artık zorunlu: bundan sonraki her kaydetme ve yayım ona başvurmak zorunda.`
              : `${variableAction(name)} artık zorunlu değil.`,
        });
      } catch (error) {
        setOutcome({ tone: 'error', ...requiredVariableProblem(error, name) });
        // The template changed under the panel (a publish, the contract): show it as it is now.
        const { status } = asApiError(error);
        if (status === 409 || status === 422) await reread();
      } finally {
        setWorking(null);
      }
    });
  }

  const workingOn = (name: string, action: Working['action']) => working?.name === name && working.action === action;
  const markButton = (name: string, describedBy?: string) => (
    <button
      key={name}
      type="button"
      onClick={() => change(name, 'mark')}
      disabled={!idle}
      aria-describedby={describedBy}
      className="border-skylab-400/40 text-skylab-300 hover:bg-skylab-500/10 focus-visible:ring-skylab-400/40 inline-flex max-w-full cursor-pointer items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      {workingOn(name, 'mark') ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Plus className="h-3 w-3 shrink-0" aria-hidden />
      )}
      <span className="truncate">{variableAction(name)}</span>
      <span className="sr-only">{workingOn(name, 'mark') ? ' işaretleniyor…' : ' değişkenini zorunlu işaretle'}</span>
    </button>
  );
  const referenced = panel.candidates.filter((candidate) => !candidate.dropped);
  const dropped = panel.candidates.filter((candidate) => candidate.dropped);

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

      {unread !== null ? (
        <NoticeBox tone="warning">
          <p>Panel güncel olmayabilir: template yeniden okunamadı. {unread}</p>
          <div className="mt-2">
            <Button variant="secondary" onClick={() => enqueue(reread)} disabled={pending > 0}>
              Yeniden dene
            </Button>
          </div>
        </NoticeBox>
      ) : null}

      {panel.rows.length === 0 ? (
        <p className="text-xs text-neutral-500">Bu template&apos;in Required variable&apos;ı yok.</p>
      ) : (
        <ul aria-label="Required variable'lar" className="divide-y divide-white/5">
          {panel.rows.map((row) => (
            <Row
              key={row.name}
              row={row}
              bodyKind={body?.kind ?? 'edited'}
              refusedBy={editing?.refusal?.title ?? null}
              releasing={workingOn(row.name, 'release')}
              disabled={!idle}
              onRelease={() => change(row.name, 'release')}
            />
          ))}
        </ul>
      )}

      {outcome ? (
        <NoticeBox tone={outcome.tone}>
          <p>{outcome.text}</p>
          {outcome.tone === 'error' && outcome.blockers.length > 0 ? (
            <div className="mt-1.5">
              <MissingVariables missing={outcome.blockers} />
            </div>
          ) : null}
        </NoticeBox>
      ) : null}

      {editing ? (
        <div className="space-y-2 border-t border-white/5 pt-3">
          <p className="text-xs font-medium text-neutral-300">Zorunlu işaretle</p>
          {panel.candidates.length > 0 ? (
            <>
              <p className="text-xs text-neutral-500">
                Gönderilen maildeki değişkenler. İşaretlediğin değişkene bundan sonraki her kaydetme ve yayım başvurmak zorunda.
              </p>
              {referenced.length > 0 ? (
                <div className="flex flex-wrap gap-2">{referenced.map(({ name }) => markButton(name))}</div>
              ) : null}
              {dropped.map(({ name }) => (
                <div key={name} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {markButton(name, `${hintId}-${name}`)}
                  <span id={`${hintId}-${name}`} className="flex items-start gap-1.5 text-xs text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                    {MARKING_DROPPED[body?.kind ?? 'edited']}
                  </span>
                </div>
              ))}
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
                  <code className="font-mono break-all text-neutral-200">{variableAction(name)}</code>
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
  bodyKind,
  refusedBy,
  releasing,
  disabled,
  onRelease,
}: {
  row: RequiredRow;
  /** Whose body a `dropped` row is about. */
  bodyKind: BodyKind;
  /** The refusal's title ("Kaydedilmedi", "Yayımlanmadı"), for a variable it named. */
  refusedBy: string | null;
  releasing: boolean;
  disabled: boolean;
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
          <code className="font-mono text-xs break-all text-neutral-100">{variableAction(row.name)}</code>
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
            {DROPPED[bodyKind]}
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
        <Button variant="secondary" onClick={onRelease} disabled={disabled}>
          {releasing ? 'Çıkarılıyor…' : 'Çıkar'}
          <span className="sr-only"> {variableAction(row.name)}</span>
        </Button>
      ) : null}
    </li>
  );
}
