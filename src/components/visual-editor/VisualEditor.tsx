'use client';

/**
 * The Visual editor: a Mail body put together from blocks — headings,
 * paragraphs with bold, italic and links, buttons, images, rules, variables
 * and sections that show only when a variable is (or is not) set — by
 * someone who writes no code. Built on tiptap, as Skyforms' editor is
 * (ADR-0046), with blocks of our own.
 *
 * It edits a Visual source: the document's JSON text
 * (src/lib/mail-render/visual-document.ts), which the render module turns into
 * mail. It knows nothing of Mail templates, drafts or where the document
 * goes; the template editor mounts it for a template's Visual source, and the
 * send form can mount it for a free announcement's body.
 *
 * What it hands back may not pass the model yet — an image address half
 * typed — and the render says so. A document from outside that the model
 * does not read is not opened at all: opening it would drop what the editor
 * cannot show.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import {
  Bold,
  Braces,
  GitBranch,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  Minus,
  MousePointerClick,
  Pilcrow,
  Redo2,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import {
  isVariableName,
  linkAddressProblem,
  parseVisualSource,
  visualDocumentVariables,
} from '@/lib/mail-render/visual-document';
import { visualEditorExtensions } from './extensions';
import { fromEditorContent, toEditorContent } from './tiptap-document';
import { VariableInsertPanel, VisualEditorContext } from './VariableField';

type Panel = 'link' | 'variable' | null;

/**
 * The document in the editor as source text, and the variables it uses —
 * also while something in it does not pass the model yet, such as a section
 * whose variable is still to be chosen.
 */
function sourceOf(editor: Editor) {
  const document = fromEditorContent(editor.getJSON());
  return { text: JSON.stringify(document), variables: visualDocumentVariables(document).filter(isVariableName) };
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
  pressed,
  disabled,
  text,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  /** Shown beside the icon where there is room. */
  text?: string;
}) {
  return (
    <button
      type="button"
      // Keep the editor's selection: the button acts on it.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      className={`inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        pressed ? 'bg-white/15 text-neutral-100' : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {text ? <span className="hidden sm:inline">{text}</span> : null}
    </button>
  );
}

const Separator = () => <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-white/10" />;

function LinkPanel({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const current = (editor.getAttributes('link').href as string | undefined) ?? '';
  const [href, setHref] = useState(current || 'https://');
  const problem = linkAddressProblem(href);
  const nothingSelected = editor.state.selection.empty && !editor.isActive('link');
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (problem || nothingSelected) return;
        editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
        onClose();
      }}
    >
      <label className="block space-y-1.5">
        <span className="block text-xs font-medium text-neutral-300">Bağlantı adresi</span>
        <input
          value={href}
          onChange={(event) => setHref(event.target.value.trim())}
          type="url"
          inputMode="url"
          autoComplete="off"
          autoFocus
          aria-invalid={problem ? true : undefined}
          className="focus:border-skylab-400/50 h-8 w-full rounded-md border border-white/10 bg-white/3 px-3 text-xs text-neutral-100 focus:bg-white/5 focus:outline-none aria-invalid:border-red-400/60"
        />
      </label>
      {problem ? <p className="text-xs text-red-300">{problem}.</p> : null}
      {nothingSelected ? <p className="text-xs text-amber-300">Önce bağlantı yapılacak metni seç.</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={problem !== null || nothingSelected}
          className="border-skylab-400/40 text-skylab-300 hover:bg-skylab-500/10 h-8 rounded-md border px-3 text-xs font-medium disabled:opacity-50"
        >
          Bağlantıyı uygula
        </button>
        {current ? (
          <button
            type="button"
            onClick={() => {
              editor.chain().focus().extendMarkRange('link').unsetLink().run();
              onClose();
            }}
            className="h-8 rounded-md border border-red-400/40 px-3 text-xs text-red-300 hover:bg-red-500/10"
          >
            Bağlantıyı kaldır
          </button>
        ) : null}
        <button type="button" onClick={onClose} className="h-8 rounded-md border border-white/10 px-3 text-xs text-neutral-300 hover:bg-white/5">
          Vazgeç
        </button>
      </div>
    </form>
  );
}

function Toolbar({ editor, panel, setPanel }: { editor: Editor; panel: Panel; setPanel: (panel: Panel) => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      heading: current.isActive('heading'),
      paragraph: current.isActive('paragraph'),
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      link: current.isActive('link'),
      canBold: current.can().toggleBold(),
      canItalic: current.can().toggleItalic(),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const insert = (content: Record<string, unknown>) => chain().insertContent(content).run();

  return (
    <div
      role="toolbar"
      aria-label="Visual editör araçları"
      className="flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-white/10 bg-white/[0.02] p-1"
    >
      <ToolButton icon={Pilcrow} label="Paragraf" pressed={state.paragraph} onClick={() => chain().setNode('paragraph').run()} />
      <ToolButton icon={Heading2} label="Başlık" pressed={state.heading} onClick={() => chain().setNode('heading').run()} />
      <Separator />
      <ToolButton icon={Bold} label="Kalın" pressed={state.bold} disabled={!state.canBold} onClick={() => chain().toggleBold().run()} />
      <ToolButton
        icon={Italic}
        label="İtalik"
        pressed={state.italic}
        disabled={!state.canItalic}
        onClick={() => chain().toggleItalic().run()}
      />
      <ToolButton
        icon={Link2}
        label="Bağlantı"
        pressed={state.link || panel === 'link'}
        disabled={state.heading}
        onClick={() => setPanel(panel === 'link' ? null : 'link')}
      />
      <Separator />
      <ToolButton
        icon={Braces}
        label="Değişken ekle"
        text="Değişken"
        pressed={panel === 'variable'}
        onClick={() => setPanel(panel === 'variable' ? null : 'variable')}
      />
      <ToolButton
        icon={MousePointerClick}
        label="Buton ekle"
        text="Buton"
        onClick={() =>
          insert({ type: 'button', attrs: { label: 'Devam et', linkKind: 'url', url: 'https://yildizskylab.com', variable: '' } })
        }
      />
      <ToolButton icon={ImageIcon} label="Görsel ekle" text="Görsel" onClick={() => insert({ type: 'image', attrs: { src: '', alt: '', width: null } })} />
      <ToolButton icon={Minus} label="Ayraç ekle" text="Ayraç" onClick={() => insert({ type: 'divider' })} />
      <ToolButton
        icon={GitBranch}
        label="Koşullu bölüm ekle"
        text="Koşullu bölüm"
        onClick={() => {
          // The blocks under the cursor go into the section; where they cannot, a new one starts.
          if (!chain().wrapIn('conditional', { variable: '', when: 'set' }).run()) {
            insert({ type: 'conditional', attrs: { variable: '', when: 'set' }, content: [{ type: 'paragraph' }] });
          }
        }}
      />
      <Separator />
      <ToolButton icon={Undo2} label="Geri al" disabled={!state.canUndo} onClick={() => chain().undo().run()} />
      <ToolButton icon={Redo2} label="İleri al" disabled={!state.canRedo} onClick={() => chain().redo().run()} />
    </div>
  );
}

/** The mail's look in the editor, readable in both panel themes; the mail's own look is the preview's. */
const CONTENT_CLASS = [
  'min-h-[320px] px-4 py-3 text-sm leading-relaxed text-neutral-200 focus:outline-none',
  '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-neutral-100 [&_h2:first-child]:mt-1',
  '[&_p]:my-2',
  '[&_a]:text-skylab-300 [&_a]:underline [&_a]:underline-offset-2',
  '[&_strong]:font-semibold [&_strong]:text-neutral-100',
  '[&_hr]:my-4 [&_hr]:border-white/20 [&_hr.ProseMirror-selectednode]:border-skylab-400',
  '[&_.is-editor-empty:first-child]:before:pointer-events-none [&_.is-editor-empty:first-child]:before:float-left [&_.is-editor-empty:first-child]:before:h-0 [&_.is-editor-empty:first-child]:before:text-neutral-500 [&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
].join(' ');

export function VisualEditor({
  value,
  onChange,
  variables,
  label,
  editable = true,
  footer,
}: {
  /** A Visual source: the document's JSON text. A new one from outside replaces what is in the editor. */
  value: string;
  /** The document as the editor holds it, as JSON text. */
  onChange: (value: string) => void;
  /** Variables to offer, beside the ones the document already uses. */
  variables: readonly string[];
  /** The editor's accessible name. */
  label: string;
  editable?: boolean;
  /** Shown under the editing area. */
  footer?: ReactNode;
}) {
  // What the editor last handed out: a value that is not it came from outside.
  const emitted = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [opened] = useState(() => parseVisualSource(value));
  const [problems, setProblems] = useState<string[] | null>(opened.ok ? null : opened.problems);
  const [used, setUsed] = useState<string[]>(opened.ok ? visualDocumentVariables(opened.document) : []);
  const [panel, setPanel] = useState<Panel>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: visualEditorExtensions,
    content: opened.ok ? toEditorContent(opened.document) : undefined,
    editable,
    editorProps: {
      attributes: {
        class: CONTENT_CLASS,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
      },
    },
    onUpdate: ({ editor: current }) => {
      const { text, variables: inDocument } = sourceOf(current);
      setUsed(inDocument);
      if (text === emitted.current) return;
      emitted.current = text;
      onChangeRef.current(text);
    },
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  // A value from outside — a change set back, a reload — replaces the content.
  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    const read = parseVisualSource(value);
    setProblems(read.ok ? null : read.problems);
    if (read.ok) {
      editor.commands.setContent(toEditorContent(read.document), { emitUpdate: false });
      setUsed(visualDocumentVariables(read.document));
    }
  }, [editor, value]);

  const offered = useMemo(() => [...new Set([...variables, ...used])].sort(), [variables, used]);
  const shared = useMemo(() => ({ variables: offered }), [offered]);

  if (problems) {
    return (
      <div role="alert" className="rounded-lg border border-red-400/30 bg-red-500/5 p-4 text-sm text-red-300">
        <p className="font-medium">Bu Visual belge açılmadı: bu panelin bilmediği bir şey içeriyor ve açmak onu düşürürdü.</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 font-mono text-xs">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <VisualEditorContext.Provider value={shared}>
      <div className="focus-within:border-skylab-400/40 rounded-lg border border-white/10">
        {editor && editable ? <Toolbar editor={editor} panel={panel} setPanel={setPanel} /> : null}
        {editor && panel ? (
          <div className="border-b border-white/10 bg-white/[0.02] p-3">
            {panel === 'link' ? (
              <LinkPanel editor={editor} onClose={() => setPanel(null)} />
            ) : (
              <VariableInsertPanel
                onInsert={(name) => {
                  editor.chain().focus().insertContent({ type: 'variable', attrs: { name } }).run();
                  setPanel(null);
                }}
                onClose={() => setPanel(null)}
              />
            )}
          </div>
        ) : null}
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <p className="px-4 py-3 text-xs text-neutral-500">Visual editör yükleniyor…</p>
        )}
        {footer}
      </div>
    </VisualEditorContext.Provider>
  );
}

export default VisualEditor;
