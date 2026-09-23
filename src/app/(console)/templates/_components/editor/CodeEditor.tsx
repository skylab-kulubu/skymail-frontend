'use client';

/**
 * The code editor for a JSX or HTML source: Monaco, as the old panel had.
 *
 * Monaco loads from the panel itself — public/monaco/<version>/vs, copied
 * from the monaco-editor package by scripts/build-editor-assets.ts — not from the CDN
 * @monaco-editor/react defaults to: the editor works without a third party,
 * at the version yarn.lock pins, and a later CSP needs no outside host for it.
 * Imported only through next/dynamic, so it never renders on the server.
 */
import Editor, { loader, type BeforeMount } from '@monaco-editor/react';
import type { EditableMode } from '@/lib/template-editor/editor-state';
import { MONACO_VS_PATH } from '@/lib/template-editor/monaco-path';
import { useDocumentTheme } from '@/lib/ui/use-document-theme';

loader.config({ paths: { vs: MONACO_VS_PATH } });

const LANGUAGE: Readonly<Record<EditableMode, string>> = { jsx: 'typescript', html: 'html' };

/** Each mode's model has a path of its own, by which the browser tests find it. */
const MODEL_PATH: Readonly<Record<EditableMode, string>> = {
  jsx: 'file:///jsx/template.tsx',
  html: 'file:///html/template.html',
};

type TypeScriptDefaults = {
  setCompilerOptions(options: Record<string, unknown>): void;
  setDiagnosticsOptions(options: Record<string, unknown>): void;
};

type TypeScriptApi = {
  typescriptDefaults: TypeScriptDefaults;
  JsxEmit: { ReactJSX: number };
  ScriptTarget: { ES2020: number };
  ModuleKind: { ESNext: number };
};

/**
 * JSX parses as TSX with the automatic runtime, as the render module compiles
 * it. Only syntax errors are marked: the editor has no types for the club's
 * mail components, and the render tells what does not compile.
 */
const configure: BeforeMount = (monaco) => {
  const withTop = monaco as unknown as { typescript?: TypeScriptApi; languages: { typescript?: TypeScriptApi } };
  const typescript = withTop.typescript?.typescriptDefaults ? withTop.typescript : withTop.languages.typescript;
  if (!typescript?.typescriptDefaults) return;
  typescript.typescriptDefaults.setCompilerOptions({
    jsx: typescript.JsxEmit.ReactJSX,
    target: typescript.ScriptTarget.ES2020,
    module: typescript.ModuleKind.ESNext,
    allowNonTsExtensions: true,
    allowJs: true,
    esModuleInterop: true,
  });
  typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
};

export default function CodeEditor({
  mode,
  value,
  onChange,
  label,
}: {
  mode: EditableMode;
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const theme = useDocumentTheme();
  return (
    <Editor
      path={MODEL_PATH[mode]}
      language={LANGUAGE[mode]}
      value={value}
      onChange={(next) => onChange(next ?? '')}
      theme={theme === 'light' ? 'vs' : 'vs-dark'}
      beforeMount={configure}
      loading={<p className="p-4 text-xs text-neutral-500">Kod editörü yükleniyor…</p>}
      height="100%"
      options={{
        ariaLabel: label,
        minimap: { enabled: false },
        fontSize: 13,
        tabSize: 2,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        // Turkish text in a mail is not a homoglyph attack.
        unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: false, nonBasicASCII: false },
        renderControlCharacters: false,
      }}
    />
  );
}
