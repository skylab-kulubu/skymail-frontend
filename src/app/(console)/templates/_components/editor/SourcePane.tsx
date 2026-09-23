'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { AUTHORING_MODE_LABEL } from '@/lib/templates';
import { EDITABLE_MODES, type EditableMode } from '@/lib/template-editor/editor-state';

const CodeEditor = dynamic(() => import('./CodeEditor'), {
  ssr: false,
  loading: () => <p className="p-4 text-xs text-neutral-500">Kod editörü yükleniyor…</p>,
});

const VisualEditor = dynamic(() => import('@/components/visual-editor/VisualEditor'), {
  ssr: false,
  loading: () => <p className="p-4 text-xs text-neutral-500">Visual editör yükleniyor…</p>,
});

/** One tab per Authoring mode the editor writes, marking the Main source. */
export function SourceTabs({
  active,
  main,
  present,
  changed,
  onSelect,
  idPrefix,
}: {
  active: EditableMode;
  main: string;
  /** Modes the template has a source in. */
  present: (mode: EditableMode) => boolean;
  /** Modes with unsaved changes. */
  changed?: (mode: EditableMode) => boolean;
  onSelect: (mode: EditableMode) => void;
  idPrefix: string;
}) {
  return (
    <div role="tablist" aria-label="Authoring mode" className="flex flex-wrap gap-1 border-b border-white/10">
      {EDITABLE_MODES.map((mode) => {
        const selected = mode === active;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${mode}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(mode)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
              const step = event.key === 'ArrowRight' ? 1 : -1;
              const next = EDITABLE_MODES[(EDITABLE_MODES.indexOf(mode) + step + EDITABLE_MODES.length) % EDITABLE_MODES.length];
              onSelect(next);
              document.getElementById(`${idPrefix}-tab-${next}`)?.focus();
            }}
            className={`focus-visible:ring-skylab-400/40 -mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
              selected
                ? 'border-skylab-400 text-neutral-100'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <span className="font-medium">{AUTHORING_MODE_LABEL[mode]}</span>
            {mode === main ? (
              // English glossary term: upper-cased as Turkish it would read "MAİN".
              <span
                lang="en"
                className="text-3xs border-skylab-400/40 bg-skylab-400/10 text-skylab-300 rounded border px-1.5 py-0.5 font-medium tracking-[0.1em] uppercase"
              >
                Main source
              </span>
            ) : null}
            {!present(mode) ? <span className="text-2xs text-neutral-500">yok</span> : null}
            {changed?.(mode) ? (
              <span className="text-2xs text-amber-300" title="Kaydedilmemiş değişiklik">
                ● <span className="sr-only">kaydedilmemiş değişiklik</span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The panel under the tabs: the source in its editor — the code editor for
 * JSX and HTML, the Visual editor for Visual — or what to do when there is none.
 */
export function SourcePanel({
  mode,
  source,
  onChange,
  idPrefix,
  empty,
  toolbar,
  underTabs = true,
  variables = [],
  readOnly = false,
}: {
  mode: EditableMode;
  source: string | undefined;
  onChange: (value: string) => void;
  idPrefix: string;
  empty: ReactNode;
  toolbar?: ReactNode;
  /** Shown under SourceTabs with the same idPrefix; false where a page picks the mode some other way. */
  underTabs?: boolean;
  /** The variables the Visual editor offers to insert. */
  variables?: readonly string[];
  /** Shown, not edited (the Visual editor; code is shown read-only elsewhere). */
  readOnly?: boolean;
}) {
  return (
    <div
      role={underTabs ? 'tabpanel' : undefined}
      id={`${idPrefix}-panel`}
      aria-labelledby={underTabs ? `${idPrefix}-tab-${mode}` : undefined}
      className="space-y-3 pt-3"
    >
      {source === undefined ? (
        empty
      ) : (
        <>
          {toolbar}
          {/* One editor per mode: switching tabs starts the next one from the text in hand. */}
          {mode === 'visual' ? (
            <VisualEditor
              key={mode}
              value={source}
              onChange={onChange}
              variables={variables}
              label="Visual kaynağı"
              editable={!readOnly}
            />
          ) : (
            <div className="h-[55vh] min-h-[360px] overflow-hidden rounded-lg border border-white/10">
              <CodeEditor key={mode} mode={mode} value={source} onChange={onChange} label={`${AUTHORING_MODE_LABEL[mode]} kaynağı`} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
