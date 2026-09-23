'use client';

/**
 * The Mail template editor (`/templates/edit/<id>`): the operator's draft in
 * progress, or the published version a draft starts from; its name, subject
 * and a source per Authoring mode, with a live preview; and saving a draft,
 * choosing the Main source, publishing and discarding (ADR-0046, ADR-0047).
 *
 * Nothing here renders a source itself: renders come from the sandbox
 * (src/lib/template-editor/render-bridge.ts), and what may be sent is decided
 * by src/lib/template-editor/editor-state.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import { FileWarning } from 'lucide-react';
import { FormField } from '@/components/chrome/FormField';
import { Notice } from '@/components/chrome/Notice';
import { StateCard } from '@/components/chrome/StateCard';
import { Tag } from '@/components/chrome/Tag';
import { useConsole } from '@/components/layout/ConsoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { RoleGate } from '@/components/layout/RoleGate';
import { Button } from '@/components/ui/Button';
import { ROLE } from '@/lib/access';
import { useApi, useApiLoad } from '@/lib/api/react';
import { formatDateTime } from '@/lib/format';
import { useFlashNotice, type NoticeData } from '@/lib/notice';
import { renderOf } from '@/lib/mail-render/save';
import {
  EDITABLE_MODES,
  addSource,
  contentOf,
  isDirty,
  isEditableMode,
  planMainChange,
  planSave,
  revertSource,
  storedFromVersion,
  versionToOpen,
  type Content,
  type EditableMode,
  type EditorState,
} from '@/lib/template-editor/editor-state';
import { versionProblem } from '@/lib/template-editor/refusals';
import { useRepoSample } from '@/lib/template-editor/use-repo-sample';
import { useRenderBridge, useSourceRenders } from '@/lib/template-editor/use-renders';
import {
  AUTHORING_MODE_LABEL,
  discardDraft,
  fetchTemplate,
  fetchVersion,
  publishDraft,
  saveDraft,
  templateHref,
  writtenBy,
  type MailTemplate,
  type StaleConflict,
  type TemplateVersion,
} from '@/lib/templates';
import { EditorNote, RefusalNotice, TemplateKey, authorLabel, type Refusal } from './EditorParts';
import { DiscardDialog, MainSourceDialog, PublishDialog, StaleComparison } from './EditorDialogs';
import { PreviewPane, useSample } from './PreviewPane';
import { RequiredVariablesPanel } from './RequiredVariablesPanel';
import { SourcePanel, SourceTabs } from './SourcePane';
import { TemplateLoadFailure } from './TemplateLoadFailure';

type Loaded = { template: MailTemplate; version: TemplateVersion | null; loadedAt: number };

export function TemplateEditor({ id }: { id: string }) {
  return (
    <RoleGate role={ROLE.templatesWrite}>
      <EditorLoader id={id} />
    </RoleGate>
  );
}

function EditorLoader({ id }: { id: string }) {
  const { user } = useConsole();
  const viewerSub = user.sub ?? null;
  const [notice, setNotice] = useFlashNotice(templateHref.edit(id));
  const state = useApiLoad<Loaded>(async (api, signal) => {
    const template = await fetchTemplate(api, id, signal);
    const versionId = versionToOpen(template, viewerSub);
    const version = versionId ? await fetchVersion(api, id, versionId, signal) : null;
    return { template, version, loadedAt: Date.now() };
  }, id);

  if (state.status === 'loading') return <StateCard isLoading title="Mail template yükleniyor" />;
  if (state.status === 'error') return <TemplateLoadFailure error={state.error} onRetry={() => void state.reload()} />;
  if (!state.data.version) {
    return (
      <StateCard
        Icon={FileWarning}
        tone="warning"
        title="Bu template'in açılacak bir sürümü yok"
        description="Sürüm geçmişi tutulmadan önce yazılmış ve o günden beri hiç kaydedilmemiş olabilir. Yöneticine haber ver."
      />
    );
  }
  return (
    <Editor
      // A reload (after a publish or a discard) opens the template afresh.
      key={state.data.loadedAt}
      template={state.data.template}
      version={state.data.version}
      viewerSub={viewerSub}
      notice={notice}
      setNotice={setNotice}
      reload={state.reload}
    />
  );
}

type Busy = 'save' | 'publish' | 'discard' | 'main' | null;

type Dialog =
  | { kind: 'publish' }
  | { kind: 'discard' }
  | { kind: 'main'; mode: EditableMode; refusal: Refusal | null }
  | { kind: 'stale'; draft: TemplateVersion; published: TemplateVersion | null; again: boolean; conflict: StaleConflict };

function Editor({
  template,
  version,
  viewerSub,
  notice,
  setNotice,
  reload,
}: {
  template: MailTemplate;
  version: TemplateVersion;
  viewerSub: string | null;
  notice: NoticeData | null;
  setNotice: (notice: NoticeData | null) => void;
  reload: () => Promise<void>;
}) {
  const api = useApi();
  const [stored, setStored] = useState(() => storedFromVersion(version, template.name));
  const [editing, setEditing] = useState<Content>(() => contentOf(stored));
  const [active, setActive] = useState<EditableMode>(() => (isEditableMode(stored.mainMode) ? stored.mainMode : 'jsx'));
  const [busy, setBusy] = useState<Busy>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const dirty = isDirty(editing, stored);
  const main = editing.mainMode;
  const changed = (mode: EditableMode) => editing.sources[mode] !== stored.sources[mode];

  // Render what the operator looks at, what will be sent, and anything edited
  // (a save needs a render of every edited source).
  const wanted = useMemo(() => {
    const texts: Partial<Record<EditableMode, string>> = {};
    for (const mode of EDITABLE_MODES) {
      const source = editing.sources[mode];
      if (source !== undefined && (mode === active || mode === main || source !== stored.sources[mode])) texts[mode] = source;
    }
    return texts;
  }, [editing.sources, active, main, stored.sources]);
  const bridge = useRenderBridge();
  const { renders, good } = useSourceRenders(bridge, wanted);
  const state: EditorState = { editing, renders, stored };

  // The preview shows the tab's source, or the Main source while the tab has none.
  const shown: EditableMode | null = editing.sources[active] !== undefined ? active : isEditableMode(main) ? main : null;
  const shownSource = shown ? editing.sources[shown] : undefined;
  const untouchedMain = shown !== null && shown === stored.mainMode && shownSource === stored.sources[shown];
  const lastGood = shown ? good[shown] : undefined;
  const previewHtml = lastGood?.html ?? (untouchedMain || shown === null ? stored.html : null);
  const current = shown && shownSource !== undefined ? renderOf(renders[shown], { mode: shown, source: shownSource }) : null;
  const failure = current && !current.ok ? current.message : null;

  const repo = useRepoSample(template.key);
  const samples = useSample(lastGood?.variables, previewHtml, editing.subject, repo, template.id);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const stale = stored.draftId !== null && stored.baseVersionId !== template.published_version_id;
  const others = (template.drafts ?? []).filter((draft) => !writtenBy(draft.author, viewerSub));
  const canPublish = stored.draftId !== null && !dirty && busy === null;

  const setSource = (mode: EditableMode, value: string) =>
    setEditing((previous) => ({ ...previous, sources: { ...previous.sources, [mode]: value } }));
  const revert = (mode: EditableMode) => {
    setEditing((previous) => revertSource(mode, previous, stored));
    setRefusal(null);
  };

  async function save() {
    const plan = planSave(state);
    if (!plan.ok) {
      setRefusal({ title: 'Kaydedilmedi', blockers: plan.blockers });
      return;
    }
    setBusy('save');
    setRefusal(null);
    try {
      const saved = await saveDraft(api, template.id, plan.body);
      setStored(storedFromVersion(saved, template.name));
      setEditing((previous) => ({ ...previous, mainMode: saved.main_mode }));
      setNotice(
        saved.published_at === null
          ? { tone: 'success', text: 'Taslak kaydedildi. Canlı mail değişmedi; yayımlayana kadar gönderilen sürüm aynı kalır.' }
          : { tone: 'success', text: 'Kaydedilecek bir değişiklik yoktu.' },
      );
    } catch (error) {
      setRefusal({ title: 'Kaydedilmedi', problem: versionProblem(error) });
    } finally {
      setBusy(null);
    }
  }

  async function publish(over?: string) {
    if (!stored.draftId) return;
    setBusy('publish');
    setRefusal(null);
    try {
      const outcome = await publishDraft(api, template.id, stored.draftId, over);
      if (outcome.kind === 'published') {
        setDialog(null);
        // Said once the editor shows the published version, not before.
        await reload();
        setNotice({ tone: 'success', text: `Yayımlandı. “${outcome.template.name}” artık bu sürümle gönderiliyor.` });
        return;
      }
      const { draftId, publishedVersionId } = outcome.conflict;
      const [draft, published] = await Promise.all([
        fetchVersion(api, template.id, draftId),
        publishedVersionId ? fetchVersion(api, template.id, publishedVersionId) : Promise.resolve(null),
      ]);
      setDialog({ kind: 'stale', draft, published, again: over !== undefined, conflict: outcome.conflict });
    } catch (error) {
      setDialog(null);
      setRefusal({ title: 'Yayımlanmadı', problem: versionProblem(error) });
    } finally {
      setBusy(null);
    }
  }

  async function discard() {
    if (!stored.draftId) return;
    setBusy('discard');
    try {
      await discardDraft(api, template.id, stored.draftId);
      setDialog(null);
      await reload();
      setNotice({
        tone: 'success',
        text: 'Taslak atıldı. Geçmişte duruyor ve geri getirilebilir; editör şimdi gönderilen sürümü gösteriyor.',
      });
    } catch (error) {
      setDialog(null);
      setRefusal({ title: 'Taslak atılamadı', problem: versionProblem(error) });
    } finally {
      setBusy(null);
    }
  }

  async function makeMain(mode: EditableMode) {
    const plan = planMainChange(mode, state);
    if (!plan.ok) {
      setDialog({ kind: 'main', mode, refusal: { title: 'Main source değişmedi', blockers: plan.blockers } });
      return;
    }
    setBusy('main');
    try {
      const saved = await saveDraft(api, template.id, plan.body);
      setStored(storedFromVersion(saved, template.name));
      setEditing((previous) => ({ ...previous, mainMode: saved.main_mode }));
      setDialog(null);
      setNotice({
        tone: 'success',
        text: `Main source artık ${AUTHORING_MODE_LABEL[mode]}. Taslak olarak kaydedildi; yayımlayana kadar canlı mail değişmez.`,
      });
    } catch (error) {
      setDialog({ kind: 'main', mode, refusal: { title: 'Main source değişmedi', problem: versionProblem(error) } });
    } finally {
      setBusy(null);
    }
  }

  const added = addSource(active, state);
  const activeLabel = AUTHORING_MODE_LABEL[active];
  const kept = (mode: EditableMode) => EDITABLE_MODES.filter((other) => other !== mode && editing.sources[other] !== undefined);

  return (
    <div className="space-y-5">
      <PageHeader
        title={template.name}
        description="Kaydet taslak yazar; gönderilen mail ancak yayımlayınca değişir."
        meta={
          <>
            {template.system ? <Tag tone="system">System</Tag> : null}
            {template.key ? <span className="font-mono text-xs break-all text-neutral-400">{template.key}</span> : null}
          </>
        }
      />

      {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} /> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="min-w-0 flex-1 text-sm text-neutral-400">
          {stored.draftId
            ? `Taslağını düzenliyorsun: #${stored.seq}, ${formatDateTime(stored.savedAt)}.`
            : `Gönderilen sürümü görüyorsun: #${stored.seq}. Kaydettiğinde taslağın olur.`}
          {dirty ? <span className="text-amber-300"> Kaydedilmemiş değişiklikler var.</span> : null}
        </p>
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:flex-nowrap">
          {dirty ? (
            <Button variant="secondary" onClick={() => setEditing(contentOf(stored))} disabled={busy !== null}>
              Değişiklikleri geri al
            </Button>
          ) : null}
          {stored.draftId ? (
            <Button variant="outlineDanger" onClick={() => setDialog({ kind: 'discard' })} disabled={busy !== null}>
              Taslağı at
            </Button>
          ) : null}
          <Button
            variant="outlineBrand"
            onClick={() => setDialog({ kind: 'publish' })}
            disabled={!canPublish}
            title={dirty ? 'Yayımlamadan önce kaydet.' : stored.draftId ? undefined : 'Yayımlanacak bir taslak yok.'}
          >
            Yayımla
          </Button>
          <Button onClick={() => void save()} disabled={!dirty || busy !== null}>
            {busy === 'save' ? 'Kaydediliyor…' : 'Taslağı kaydet'}
          </Button>
        </div>
      </div>

      {stale ? (
        <EditorNote tone="warning">
          Bu taslağı başlattıktan sonra yeni bir sürüm yayımlandı. Yayımlarken ikisini yan yana görüp seçeceksin.
        </EditorNote>
      ) : null}
      {others.length > 0 ? (
        <EditorNote>
          Yayımlanmamış başka taslak var:{' '}
          {others.map((draft) => `${authorLabel(draft.author, viewerSub)} (${formatDateTime(draft.created_at)})`).join(', ')}.
          Senin kaydettiğin onlarınkini değiştirmez.
        </EditorNote>
      ) : null}
      {refusal ? <RefusalNotice refusal={refusal} onRevert={{ can: changed, revert }} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <FormField
          label="Template adı"
          value={editing.name}
          onChange={(event) => setEditing((previous) => ({ ...previous, name: event.target.value }))}
          autoComplete="off"
        />
        <FormField
          label="Konu"
          value={editing.subject}
          onChange={(event) => setEditing((previous) => ({ ...previous, subject: event.target.value }))}
          autoComplete="off"
        />
        <TemplateKey template={template} />
      </div>

      <RequiredVariablesPanel template={template} editing={{ state, refusal, writing: busy !== null }} />

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-label="Kaynak" className="min-w-0">
          <SourceTabs
            idPrefix="source"
            active={active}
            main={main}
            present={(mode) => editing.sources[mode] !== undefined}
            changed={changed}
            onSelect={setActive}
          />
          <SourcePanel
            idPrefix="source"
            mode={active}
            source={editing.sources[active]}
            onChange={(value) => setSource(active, value)}
            toolbar={
              active !== main || changed(active) ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 text-xs text-neutral-500">
                    {active !== main
                      ? `Bu kaynak gönderilmiyor; gönderilen mail ${AUTHORING_MODE_LABEL[main]} kaynağından üretilir.`
                      : null}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {changed(active) ? (
                      <Button variant="secondary" onClick={() => revert(active)} disabled={busy !== null}>
                        Bu kaynaktaki değişiklikleri geri al
                      </Button>
                    ) : null}
                    {active !== main ? (
                      <Button
                        variant="outlineBrand"
                        onClick={() => setDialog({ kind: 'main', mode: active, refusal: null })}
                        disabled={busy !== null}
                      >
                        Bu kaynağı Main source yap
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null
            }
            empty={
              <div className="rounded-lg border border-dashed border-white/15 px-4 py-8 text-center">
                <p className="text-sm text-neutral-300">Bu template&apos;in {activeLabel} kaynağı yok.</p>
                <p className="mx-auto mt-1 max-w-md text-xs text-neutral-500">
                  {active === 'html'
                    ? 'Eklediğin HTML kaynağı, Main source’un render edilmiş HTML’inden başlar. Diğer kaynaklar olduğu gibi kalır; Main source değişmez.'
                    : 'Eklediğin JSX kaynağı kulübün mail bileşenleriyle yazılmış bir başlangıçtan başlar. Diğer kaynaklar olduğu gibi kalır; Main source değişmez.'}
                </p>
                <div className="mt-4 flex justify-center">
                  <Button variant="outlineBrand" onClick={() => added && setEditing(added)} disabled={!added || busy !== null}>
                    {activeLabel} kaynağı ekle
                  </Button>
                </div>
                {!added ? (
                  <p className="mt-2 text-xs text-amber-300">Main source render edilmeden HTML kaynağı eklenemez.</p>
                ) : null}
              </div>
            }
          />
        </section>

        <PreviewPane
          html={previewHtml}
          pending={shown !== null && !current}
          failure={failure}
          failureKept={failure !== null && untouchedMain}
          note={
            shown !== null && shown !== main
              ? `Bu, ${AUTHORING_MODE_LABEL[shown]} kaynağının önizlemesi. Gönderilen mail ${AUTHORING_MODE_LABEL[main]} kaynağından (Main source) üretilir.`
              : undefined
          }
          subject={editing.subject}
          samples={samples}
        />
      </div>

      {dialog?.kind === 'publish' ? (
        <PublishDialog
          name={editing.name}
          busy={busy === 'publish'}
          onConfirm={() => void publish()}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'discard' ? (
        <DiscardDialog busy={busy === 'discard'} onConfirm={() => void discard()} onCancel={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === 'main' ? (
        <MainSourceDialog
          candidate={dialog.mode}
          render={renders[dialog.mode]}
          source={editing.sources[dialog.mode] ?? ''}
          kept={kept(dialog.mode)}
          subject={stored.subject}
          sample={samples.sample}
          busy={busy === 'main'}
          refusal={dialog.refusal}
          onConfirm={() => void makeMain(dialog.mode)}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'stale' ? (
        <StaleComparison
          draft={dialog.draft}
          published={dialog.published}
          again={dialog.again}
          viewerSub={viewerSub}
          sample={samples.sample}
          busy={busy === 'publish'}
          onConfirm={() => void publish(dialog.conflict.publishedVersionId ?? undefined)}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}
