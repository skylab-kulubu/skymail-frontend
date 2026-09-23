'use client';

/**
 * A Mail template for someone who may read it (`/templates/show/<id>`): the
 * published version — what is sent — previewed in both themes, its subject,
 * the Authoring mode of its Main source, and its sources read-only. Nothing
 * here saves or publishes; someone who may write is sent to the editor.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileWarning } from 'lucide-react';
import { StateCard } from '@/components/chrome/StateCard';
import { Tag } from '@/components/chrome/Tag';
import { useCan, useConsole } from '@/components/layout/ConsoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { ROLE } from '@/lib/access';
import { useApiLoad } from '@/lib/api/react';
import { fetchTemplate, fetchVersion } from '@/lib/template-editor/api';
import { storedFromVersion, type EditableMode } from '@/lib/template-editor/editor-state';
import { useRepoSample } from '@/lib/template-editor/use-repo-sample';
import { AUTHORING_MODE_LABEL, templateHref, type MailTemplate, type TemplateVersion } from '@/lib/templates';
import { TemplateKey, versionLine } from './EditorParts';
import { PreviewPane, useSample } from './PreviewPane';
import { SourceTabs } from './SourcePane';
import { TemplateLoadFailure } from './TemplateLoadFailure';

export function TemplateShow({ id }: { id: string }) {
  const router = useRouter();
  const canWrite = useCan(ROLE.templatesWrite);
  useEffect(() => {
    if (canWrite) router.replace(templateHref.edit(id));
  }, [canWrite, id, router]);
  if (canWrite) return <StateCard isLoading title="Editör açılıyor" />;
  return <ShowLoader id={id} />;
}

function ShowLoader({ id }: { id: string }) {
  const state = useApiLoad(async (api, signal) => {
    const template = await fetchTemplate(api, id, signal);
    const version = template.published_version_id ? await fetchVersion(api, id, template.published_version_id, signal) : null;
    return { template, version };
  }, id);

  if (state.status === 'loading') return <StateCard isLoading title="Mail template yükleniyor" />;
  if (state.status === 'error') return <TemplateLoadFailure error={state.error} onRetry={() => void state.reload()} />;
  if (!state.data.version) {
    return <StateCard Icon={FileWarning} tone="warning" title="Bu template'in yayımlanmış bir sürümü yok" />;
  }
  return <Show template={state.data.template} version={state.data.version} />;
}

function Show({ template, version }: { template: MailTemplate; version: TemplateVersion }) {
  const { user } = useConsole();
  const stored = storedFromVersion(version, template.name);
  const [active, setActive] = useState<EditableMode>(() =>
    stored.mainMode === 'jsx' || stored.mainMode === 'html' ? stored.mainMode : 'jsx',
  );
  const repo = useRepoSample(template.key);
  const samples = useSample(undefined, stored.html, stored.subject, repo);
  const source = stored.sources[active];

  return (
    <div className="space-y-5">
      <PageHeader
        title={template.name}
        description={`Gönderilen sürüm ${versionLine(version, user.sub ?? null)}. Main source: ${AUTHORING_MODE_LABEL[stored.mainMode]}.`}
        meta={template.system ? <Tag tone="system">System</Tag> : undefined}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-neutral-300">Konu</p>
          <p className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-1.5 font-mono text-xs break-words text-neutral-200">
            {stored.subject}
          </p>
        </div>
        <TemplateKey template={template} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-label="Kaynak" className="min-w-0">
          <SourceTabs
            idPrefix="show"
            active={active}
            main={stored.mainMode}
            present={(mode) => stored.sources[mode] !== undefined}
            onSelect={setActive}
          />
          <div role="tabpanel" id="show-panel" aria-labelledby={`show-tab-${active}`} className="pt-3">
            {source === undefined ? (
              <p className="rounded-lg border border-dashed border-white/15 px-4 py-8 text-center text-sm text-neutral-400">
                Bu template&apos;in {AUTHORING_MODE_LABEL[active]} kaynağı yok.
              </p>
            ) : (
              <pre
                tabIndex={0}
                aria-label={`${AUTHORING_MODE_LABEL[active]} kaynağı`}
                className="h-[55vh] min-h-[360px] overflow-auto rounded-lg border border-white/10 bg-white/[0.02] p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-neutral-200"
              >
                {source}
              </pre>
            )}
            {stored.hasVisual ? (
              <p className="mt-2 text-xs text-neutral-500">Bu sürümün bir Visual kaynağı da var; Visual editör geldiğinde görünecek.</p>
            ) : null}
          </div>
        </section>
        <PreviewPane html={stored.html} pending={false} failure={null} subject={stored.subject} samples={samples} repo={repo} />
      </div>
    </div>
  );
}
