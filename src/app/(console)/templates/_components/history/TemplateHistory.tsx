'use client';

/**
 * A Mail template's version history (`/templates/history/<id>`, ticket 14):
 * every version newest first — who wrote it, when, how it stands and which
 * mode was main — filtered by state and paged; any two compared as rendered
 * mail; and, for a writer, any one restored as a new draft, which the editor
 * then opens. Nothing here changes what is sent. A Template seed refused
 * because of an operator's change is said in full at the top.
 */
import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { FilterPills } from '@/components/chrome/FilterPills';
import { Notice } from '@/components/chrome/Notice';
import { Pagination } from '@/components/chrome/Pagination';
import { StateCard } from '@/components/chrome/StateCard';
import { Tag } from '@/components/chrome/Tag';
import { useConsole } from '@/components/layout/ConsoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { ROW_ACTION_CLASS } from '@/components/tables/RowActions';
import { Button } from '@/components/ui/Button';
import { ROLE, hasRole } from '@/lib/access';
import { useApi, useApiLoad } from '@/lib/api/react';
import { pageCount } from '@/lib/list-view';
import { flashNotice, useFlashNotice } from '@/lib/notice';
import { versionProblem } from '@/lib/template-editor/refusals';
import {
  HISTORY_FILTERS,
  HISTORY_PAGE_SIZE,
  defaultComparison,
  historyQuery,
  historyViewHref,
  readHistoryView,
  requestedSubject,
  restoreOutcome,
  togglePick,
  versionAuthor,
  versionBadge,
  versionName,
  versionWhen,
  type ComparisonRequest,
  type HistoryState,
  type HistoryView,
} from '@/lib/template-history/history';
import {
  fetchTemplate,
  fetchVersionPage,
  restoreVersion,
  templateHref,
  writtenBy,
  type MailTemplate,
  type TemplateVersionSummary,
} from '@/lib/templates';
import type { Refusal } from '../editor/EditorParts';
import { TemplateLoadFailure } from '../editor/TemplateLoadFailure';
import { MainSource } from '../TemplateRowParts';
import { RestoreDialog, VersionComparison } from './HistoryDialogs';
import { SeedRefusalNotice, VersionStateBadge } from './HistoryParts';

export function TemplateHistory({ id }: { id: string }) {
  const state = useApiLoad((api, signal) => fetchTemplate(api, id, signal), id);
  if (state.status === 'loading') return <StateCard isLoading title="Sürüm geçmişi yükleniyor" />;
  if (state.status === 'error') return <TemplateLoadFailure error={state.error} onRetry={() => void state.reload()} />;
  return <History template={state.data} />;
}

const EMPTY_TEXT: Readonly<Record<HistoryState, string>> = {
  all: "Bu template'in henüz sürümü yok.",
  published: 'Yayımlanmış sürüm yok.',
  draft: 'Taslak yok.',
};

type Restoring = { version: TemplateVersionSummary; refusal: Refusal | null };

function History({ template }: { template: MailTemplate }) {
  const api = useApi();
  const router = useRouter();
  const pathname = usePathname() || templateHref.history(template.id);
  const { roles, user } = useConsole();
  const viewerSub = user.sub ?? null;
  const canWrite = hasRole(roles, ROLE.templatesWrite);
  const view = readHistoryView(useSearchParams());
  const [notice, setNotice] = useFlashNotice(templateHref.history(template.id));

  const page = useApiLoad(
    (client, signal) => fetchVersionPage(client, template.id, historyQuery(view), signal),
    `${template.id}:${view.state}:${view.page}`,
  );
  const lastPage = page.status === 'success' ? pageCount(page.data.total, HISTORY_PAGE_SIZE) : null;

  const [picked, setPicked] = useState<string[]>([]);
  const [comparing, setComparing] = useState<ComparisonRequest | null>(null);
  const [restoring, setRestoring] = useState<Restoring | null>(null);
  const [busy, setBusy] = useState(false);

  const drafts = template.drafts ?? [];
  const draftsInProgress = drafts.map((draft) => draft.id);
  const viewerDraft = drafts.find((draft) => writtenBy(draft.author, viewerSub)) ?? null;

  function show(next: HistoryView) {
    router.push(historyViewHref(pathname, next), { scroll: false });
  }

  // A stale link past the end moves to the last page there is.
  const { state: filter, page: pageNumber } = view;
  useEffect(() => {
    if (lastPage !== null && pageNumber > lastPage) {
      router.replace(historyViewHref(pathname, { state: filter, page: lastPage }), { scroll: false });
    }
  }, [filter, lastPage, pageNumber, pathname, router]);

  async function restore(target: Restoring) {
    setBusy(true);
    try {
      const restored = await restoreVersion(api, template.id, target.version.id);
      const outcome = restoreOutcome(restored, target.version, viewerDraft?.id ?? null);
      if (outcome.openEditor) {
        // The editor opens the viewer's draft in progress: now the restored copy.
        flashNotice(templateHref.edit(template.id), { tone: 'success', text: outcome.text });
        router.push(templateHref.edit(template.id));
        return;
      }
      setRestoring(null);
      setComparing(null);
      setNotice({ tone: 'success', text: outcome.text });
      setBusy(false);
    } catch (error) {
      setRestoring({ ...target, refusal: { title: 'Geri getirilmedi', problem: versionProblem(error) } });
      setBusy(false);
    }
  }

  const rows = page.status === 'success' ? page.data.versions : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sürüm geçmişi"
        description={`“${template.name}” Mail template'inin her sürümü, en yenisi önce. Her kaydetme, yayım ve Template seed bir sürüm yazar; gönderilen, yayımlanmış olanlardan biridir.`}
        meta={
          <>
            {template.system ? <Tag tone="system">System</Tag> : null}
            {template.key ? <span className="font-mono text-xs break-all text-neutral-400">{template.key}</span> : null}
          </>
        }
        actions={
          <Button variant="secondary" href={canWrite ? templateHref.edit(template.id) : templateHref.show(template.id)}>
            {canWrite ? 'Editöre dön' : "Template'e dön"}
          </Button>
        }
      />

      {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} /> : null}
      <SeedRefusalNotice refusal={template.seed_refusal} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <FilterPills
            ariaLabel="Gösterilen sürümler"
            value={view.state}
            options={HISTORY_FILTERS}
            onChange={(next) => show({ state: next, page: 1 })}
          />
          <p className="text-xs text-neutral-500 tabular-nums" aria-live="polite">
            {page.status === 'success' ? `${page.data.total} sürüm` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-neutral-500" aria-live="polite">
            {picked.length === 0
              ? 'Yan yana görmek için iki sürüm seç.'
              : picked.length === 1
                ? 'Bir sürüm seçildi; bir tane daha seç.'
                : 'İki sürüm seçildi.'}
          </p>
          {picked.length > 0 ? (
            <button type="button" onClick={() => setPicked([])} className={`${ROW_ACTION_CLASS} text-xs text-neutral-400 hover:text-neutral-200`}>
              Seçimi temizle
            </button>
          ) : null}
          <Button
            variant="outlineBrand"
            disabled={picked.length !== 2}
            onClick={() => setComparing({ versionId: picked[0], againstId: picked[1] })}
          >
            Seçilenleri karşılaştır
          </Button>
        </div>
      </div>

      {page.status === 'loading' ? (
        <StateCard isLoading title="Sürümler yükleniyor" />
      ) : page.status === 'error' ? (
        <StateCard Icon={AlertTriangle} tone="danger" title="Sürümler yüklenemedi" description={page.error.message}>
          <Button variant="secondary" onClick={() => void page.reload()}>
            Tekrar dene
          </Button>
        </StateCard>
      ) : (
        <div className="space-y-2">
          <ul aria-label="Sürümler" className="divide-y divide-white/5 rounded-lg border border-white/5">
            {rows.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-neutral-500">{EMPTY_TEXT[view.state]}</li>
            ) : (
              rows.map((row) => (
                <VersionItem
                  key={row.id}
                  version={row}
                  templateName={template.name}
                  viewerSub={viewerSub}
                  draftsInProgress={draftsInProgress}
                  picked={picked.includes(row.id)}
                  onPick={() => setPicked((current) => togglePick(current, row.id))}
                  comparison={defaultComparison(row, template.published_version_id, rows)}
                  onCompare={setComparing}
                  onRestore={canWrite && !row.current ? () => setRestoring({ version: row, refusal: null }) : null}
                />
              ))
            )}
          </ul>
          <Pagination
            ariaLabel="Sürüm sayfaları"
            current={view.page}
            totalPages={lastPage ?? 1}
            onPageChange={(next) => show({ ...view, page: next })}
          />
        </div>
      )}

      {comparing ? (
        <VersionComparison
          template={template}
          pair={comparing}
          viewerSub={viewerSub}
          draftsInProgress={draftsInProgress}
          onRestore={canWrite ? (version) => setRestoring({ version, refusal: null }) : null}
          onClose={() => setComparing(null)}
        />
      ) : null}
      {restoring ? (
        <RestoreDialog
          version={restoring.version}
          viewerSub={viewerSub}
          viewerDraftSeq={viewerDraft?.seq ?? null}
          busy={busy}
          refusal={restoring.refusal}
          onConfirm={() => void restore(restoring)}
          onCancel={() => setRestoring(null)}
        />
      ) : null}
    </div>
  );
}

/** One version: its number, how it stands, its Main source mode, who wrote it and when, its subject. */
function VersionItem({
  version,
  templateName,
  viewerSub,
  draftsInProgress,
  picked,
  onPick,
  comparison,
  onCompare,
  onRestore,
}: {
  version: TemplateVersionSummary;
  templateName: string;
  viewerSub: string | null;
  draftsInProgress: readonly string[];
  picked: boolean;
  onPick: () => void;
  /** What its Karşılaştır shows; null when there is nothing to compare it with. */
  comparison: ComparisonRequest | null;
  onCompare: (pair: ComparisonRequest) => void;
  /** Null when the viewer may not restore it, or it is the version sent. */
  onRestore: (() => void) | null;
}) {
  const author = versionAuthor(version, viewerSub);
  const badge = versionBadge(version, draftsInProgress);
  const name = versionName(version, templateName);
  const asked = requestedSubject(version);
  // The one sent is compared with what came before it; any other with the one sent.
  const compareLabel = version.current ? 'Öncekiyle karşılaştır' : 'Gönderilenle karşılaştır';
  return (
    <li aria-label={`Sürüm #${version.seq}`} className="flex items-start gap-3 px-4 py-3">
      <input
        type="checkbox"
        checked={picked}
        onChange={onPick}
        aria-label={`Karşılaştırmak için seç: sürüm #${version.seq}`}
        className="accent-skylab-500 mt-1 h-4 w-4 shrink-0 cursor-pointer"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-sm font-medium text-neutral-100">#{version.seq}</span>
          <VersionStateBadge badge={badge} />
          <MainSource mode={version.main_mode} />
        </div>
        <p className="text-xs text-neutral-400">
          <span className={author.kind === 'unknown' ? 'text-neutral-500 italic' : 'text-neutral-300'}>{author.label}</span>
          {' · '}
          {versionWhen(version)}
        </p>
        {author.beforeHistory ? (
          <p className="text-2xs text-neutral-500">
            Sürüm geçmişi tutulmadan önceki içerik: yazanı kaydedilmedi, zamanı template&apos;in o güne kadarki son
            değişikliği.
          </p>
        ) : null}
        <p className="text-sm break-words text-neutral-300">
          <span className="text-neutral-500">Konu: </span>
          {version.subject}
        </p>
        {name !== null ? (
          <p className="text-xs break-words text-neutral-400">
            <span className="text-neutral-500">Bu sürümdeki ad: </span>“{name}”
          </p>
        ) : null}
        {asked !== null ? (
          <p className="text-xs break-words text-neutral-500">Template seed bu konuyu istemişti: “{asked}”; yukarıdaki korundu.</p>
        ) : null}
        {comparison || onRestore ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs">
            {comparison ? (
              <button
                type="button"
                onClick={() => onCompare(comparison)}
                aria-label={`${compareLabel}: sürüm #${version.seq}`}
                className={`${ROW_ACTION_CLASS} text-skylab-300 font-medium hover:underline`}
              >
                {compareLabel}
              </button>
            ) : null}
            {onRestore ? (
              <button
                type="button"
                onClick={onRestore}
                aria-label={`Geri getir: sürüm #${version.seq}`}
                className={`${ROW_ACTION_CLASS} text-skylab-300 font-medium hover:underline`}
              >
                Geri getir
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
