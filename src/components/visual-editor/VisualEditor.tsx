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
 * goes. `allow` narrows what the document may use — the send form's free
 * announcement (ticket 16) may use only what the server's allow-list keeps —
 * and the editor then offers nothing else; `wording` says things in the words
 * of where it is mounted.
 *
 * What it hands back may not pass the model yet — an image address half
 * typed — and the render says so. A document from outside that the model
 * does not read is not opened at all: opening it would drop what the editor
 * cannot show.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import {
  Bold,
  Braces,
  GitBranch,
  Heading2,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Link2,
  Minus,
  MousePointerClick,
  Pilcrow,
  Redo2,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { FormField } from '@/components/chrome/FormField';
import { NoticeBox } from '@/components/chrome/Notice';
import { Button } from '@/components/ui/Button';
import {
  TEMPLATE_BODY_ALLOWANCE,
  isVariableName,
  linkAddressProblem,
  parseVisualSource,
  visualDocumentVariables,
  type VisualAllowance,
} from '@/lib/mail-render/visual-document';
import { createEchoes } from './echoes';
import { visualEditorExtensions } from './extensions';
import { fromEditorContent, toEditorContent } from './tiptap-document';
import {
  GENERIC_WORDING,
  VariableInsertPanel,
  VisualEditorContext,
  type VisualEditorShared,
  type VisualEditorWording,
} from './VariableField';

export type { VisualEditorWording } from './VariableField';

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

type Tool = {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  /** A toggle's state (aria-pressed), or a choice's (aria-checked) inside a single-choice group. */
  pressed?: boolean;
  disabled?: boolean;
  /** Shown beside the icon where there is room. */
  text?: string;
};

/**
 * A toolbar button: one tab stop for the whole toolbar, arrow keys between
 * its buttons (roving tabindex). A button that cannot act now stays
 * focusable and says so (aria-disabled), so moving through the toolbar never
 * skips one.
 */
function ToolButton({
  tool: { icon: Icon, label, onClick, pressed, disabled, text },
  role,
  tabbable,
  register,
}: {
  tool: Tool;
  role?: 'radio';
  tabbable: boolean;
  register: (element: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={register}
      type="button"
      role={role}
      tabIndex={tabbable ? 0 : -1}
      // Keep the editor's selection: the button acts on it.
      onMouseDown={(event) => event.preventDefault()}
      onClick={disabled ? undefined : onClick}
      title={label}
      aria-label={label}
      aria-pressed={role ? undefined : pressed}
      aria-checked={role ? Boolean(pressed) : undefined}
      aria-disabled={disabled || undefined}
      className={`focus-visible:ring-skylab-400/40 inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-30 ${
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
        // The link's text is left behind, not selected: what is typed next follows it, and does not replace it.
        editor
          .chain()
          .focus()
          .extendMarkRange('link')
          .setLink({ href })
          .command(({ tr }) => {
            tr.setSelection(TextSelection.create(tr.doc, tr.selection.to));
            return true;
          })
          .run();
        onClose();
      }}
    >
      <FormField
        label="Bağlantı adresi"
        value={href}
        onChange={(event) => setHref(event.target.value.trim())}
        type="url"
        inputMode="url"
        autoComplete="off"
        autoFocus
        error={problem ? `${problem}.` : null}
      />
      {nothingSelected ? <p className="text-xs text-amber-300">Önce bağlantı yapılacak metni seç.</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outlineBrand" disabled={problem !== null || nothingSelected}>
          Bağlantıyı uygula
        </Button>
        {current ? (
          <Button
            variant="outlineDanger"
            onClick={() => {
              editor.chain().focus().extendMarkRange('link').unsetLink().run();
              onClose();
            }}
          >
            Bağlantıyı kaldır
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onClose}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}

function Toolbar({
  editor,
  allow,
  panel,
  setPanel,
}: {
  editor: Editor;
  allow: VisualAllowance;
  panel: Panel;
  setPanel: (panel: Panel) => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      heading: current.isActive('heading'),
      bulletList: current.isActive('bulletList'),
      orderedList: current.isActive('orderedList'),
      paragraph: current.isActive('paragraph'),
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      link: current.isActive('link'),
      canBold: current.can().toggleBold?.() ?? false,
      canItalic: current.can().toggleItalic?.() ?? false,
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  // A new block goes after a selected block, never in its place.
  const insert = (content: Record<string, unknown>) => {
    const { selection } = editor.state;
    return selection instanceof NodeSelection
      ? chain().insertContentAt(selection.to, content).run()
      : chain().insertContent(content).run();
  };
  const blocks = new Set(allow.blocks);
  const marks = new Set(allow.marks);

  const kinds: Tool[] = blocks.has('heading')
    ? [
        { icon: Pilcrow, label: 'Paragraf', pressed: state.paragraph, onClick: () => chain().setNode('paragraph').run() },
        { icon: Heading2, label: 'Başlık', pressed: state.heading, onClick: () => chain().setNode('heading').run() },
      ]
    : [];
  const styles: Tool[] = [
    ...(marks.has('bold')
      ? [{ icon: Bold, label: 'Kalın', pressed: state.bold, disabled: !state.canBold, onClick: () => chain().toggleBold().run() }]
      : []),
    ...(marks.has('italic')
      ? [{ icon: Italic, label: 'İtalik', pressed: state.italic, disabled: !state.canItalic, onClick: () => chain().toggleItalic().run() }]
      : []),
    ...(marks.has('link')
      ? [
          {
            icon: Link2,
            label: 'Bağlantı',
            pressed: state.link || panel === 'link',
            disabled: state.heading,
            onClick: () => setPanel(panel === 'link' ? null : 'link'),
          },
        ]
      : []),
  ];
  const lists: Tool[] = blocks.has('list')
    ? [
        { icon: List, label: 'Madde listesi', pressed: state.bulletList, onClick: () => chain().toggleBulletList().run() },
        { icon: ListOrdered, label: 'Numaralı liste', pressed: state.orderedList, onClick: () => chain().toggleOrderedList().run() },
      ]
    : [];
  const inserts: Tool[] = [
    ...(allow.variables
      ? [
          {
            icon: Braces,
            label: 'Değişken ekle',
            text: 'Değişken',
            pressed: panel === 'variable',
            onClick: () => setPanel(panel === 'variable' ? null : 'variable'),
          },
        ]
      : []),
    ...(blocks.has('button')
      ? [
          {
            icon: MousePointerClick,
            label: 'Buton ekle',
            text: 'Buton',
            onClick: () =>
              insert({ type: 'button', attrs: { label: 'Devam et', linkKind: 'url', url: 'https://yildizskylab.com', variable: '' } }),
          },
        ]
      : []),
    ...(blocks.has('image')
      ? [{ icon: ImageIcon, label: 'Görsel ekle', text: 'Görsel', onClick: () => insert({ type: 'image', attrs: { src: '', alt: '', width: null } }) }]
      : []),
    ...(blocks.has('divider')
      ? [{ icon: Minus, label: 'Ayraç ekle', text: 'Ayraç', onClick: () => insert({ type: 'divider' }) }]
      : []),
    ...(blocks.has('conditional') && allow.variables
      ? [
          {
            icon: GitBranch,
            label: 'Koşullu bölüm ekle',
            text: 'Koşullu bölüm',
            onClick: () => {
              // The blocks under the cursor go into the section; where they cannot, a new one starts.
              if (!chain().wrapIn('conditional', { variable: '', when: 'set' }).run()) {
                insert({ type: 'conditional', attrs: { variable: '', when: 'set' }, content: [{ type: 'paragraph' }] });
              }
            },
          },
        ]
      : []),
  ];
  const history: Tool[] = [
    { icon: Undo2, label: 'Geri al', disabled: !state.canUndo, onClick: () => chain().undo().run() },
    { icon: Redo2, label: 'İleri al', disabled: !state.canRedo, onClick: () => chain().redo().run() },
  ];

  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [tabStop, setTabStop] = useState(0);
  const groups = [kinds, styles, lists, inserts, history].filter((group) => group.length > 0);
  const count = groups.reduce((total, group) => total + group.length, 0);
  let index = 0;
  const button = (tool: Tool, role?: 'radio') => {
    const at = index++;
    return (
      <ToolButton
        key={tool.label}
        tool={tool}
        role={role}
        tabbable={at === Math.min(tabStop, count - 1)}
        register={(element) => {
          buttons.current[at] = element;
        }}
      />
    );
  };
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = buttons.current.findIndex((element) => element === document.activeElement);
    if (at === -1) return;
    const to =
      event.key === 'ArrowRight' ? (at + 1) % count
      : event.key === 'ArrowLeft' ? (at - 1 + count) % count
      : event.key === 'Home' ? 0
      : event.key === 'End' ? count - 1
      : null;
    if (to === null) return;
    event.preventDefault();
    setTabStop(to);
    buttons.current[to]?.focus();
  };

  return (
    <div
      role="toolbar"
      aria-label="Visual editör araçları"
      onKeyDown={move}
      onFocus={(event) => {
        const at = buttons.current.findIndex((element) => element !== null && element === (event.target as Node));
        if (at !== -1) setTabStop(at);
      }}
      className="flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-white/10 bg-white/[0.02] p-1"
    >
      {groups.map((group, position) => (
        <div key={position} className="contents">
          {position > 0 ? <Separator /> : null}
          {group === kinds ? (
            <div role="radiogroup" aria-label="Blok türü" className="flex items-center gap-0.5">
              {group.map((tool) => button(tool, 'radio'))}
            </div>
          ) : (
            group.map((tool) => button(tool))
          )}
        </div>
      ))}
    </div>
  );
}

/** The mail's look in the editor, readable in both panel themes; the mail's own look is the preview's. */
const CONTENT_CLASS = [
  'min-h-[320px] px-4 py-3 text-sm leading-relaxed text-neutral-200 focus:outline-none',
  '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-neutral-100 [&_h2:first-child]:mt-1',
  '[&_p]:my-2',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li_p]:my-0.5',
  '[&_a]:text-skylab-300 [&_a]:underline [&_a]:underline-offset-2',
  '[&_strong]:font-semibold [&_strong]:text-neutral-100',
  '[&_hr]:my-4 [&_hr]:border-white/20 [&_hr.ProseMirror-selectednode]:border-skylab-400',
  '[&_.is-editor-empty:first-child]:before:pointer-events-none [&_.is-editor-empty:first-child]:before:float-left [&_.is-editor-empty:first-child]:before:h-0 [&_.is-editor-empty:first-child]:before:text-neutral-500 [&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
].join(' ');

export function VisualEditor({
  value,
  onChange,
  variables = [],
  label,
  editable = true,
  allow = TEMPLATE_BODY_ALLOWANCE,
  wording,
  footer,
  describedBy,
  invalid = false,
}: {
  /** A Visual source: the document's JSON text. A new one from outside replaces what is in the editor. */
  value: string;
  /** The document as the editor holds it, as JSON text. */
  onChange: (value: string) => void;
  /** Variables to offer, beside the ones the document already uses. */
  variables?: readonly string[];
  /** The editor's accessible name. */
  label: string;
  editable?: boolean;
  /** What the document may use; the editor offers nothing else. Fixed for the editor's life. */
  allow?: VisualAllowance;
  /** What it says, in the words of where it is mounted. */
  wording?: Partial<VisualEditorWording>;
  /** Shown under the editing area. */
  footer?: ReactNode;
  /** The id of what describes the text area — its error, say — for a screen reader. */
  describedBy?: string;
  /** What is written does not pass where the editor is mounted (aria-invalid). */
  invalid?: boolean;
}) {
  // Which values coming back are the editor's own (echoes.ts); only another one replaces the content.
  const [echoes] = useState(() => createEchoes(value));
  const handedOut = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const words = useMemo(() => ({ ...GENERIC_WORDING, ...wording }), [wording]);
  const [opened] = useState(() => parseVisualSource(value, allow));
  const [extensions] = useState(() => visualEditorExtensions(allow, words.placeholder));
  const [problems, setProblems] = useState<string[] | null>(opened.ok ? null : opened.problems);
  const [used, setUsed] = useState<string[]>(opened.ok ? visualDocumentVariables(opened.document) : []);
  const [panel, setPanel] = useState<Panel>(null);

  const attributes = useMemo(
    () => ({
      class: CONTENT_CLASS,
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-label': label,
      ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      ...(invalid ? { 'aria-invalid': 'true' } : {}),
    }),
    [label, describedBy, invalid],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: opened.ok ? toEditorContent(opened.document) : undefined,
    editable,
    editorProps: { attributes },
    onUpdate: ({ editor: current }) => {
      const { text, variables: inDocument } = sourceOf(current);
      setUsed(inDocument);
      if (text === handedOut.current) return;
      handedOut.current = text;
      echoes.handedOut(text);
      onChangeRef.current(text);
    },
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    editor?.setOptions({ editorProps: { attributes } });
  }, [editor, attributes]);

  // A value from outside — a change set back, a reload — replaces the content.
  useEffect(() => {
    if (!editor || !echoes.isOutside(value)) return;
    handedOut.current = value;
    const read = parseVisualSource(value, allow);
    setProblems(read.ok ? null : read.problems);
    if (read.ok) {
      editor.commands.setContent(toEditorContent(read.document), { emitUpdate: false });
      setUsed(visualDocumentVariables(read.document));
    }
  }, [editor, value, allow, echoes]);

  const offered = useMemo(
    () => (allow.variables ? [...new Set([...variables, ...used])].sort() : []),
    [allow.variables, variables, used],
  );
  const shared: VisualEditorShared = useMemo(() => ({ variables: offered, allow, wording: words }), [offered, allow, words]);

  if (problems) {
    return (
      <NoticeBox tone="error">
        <p className="font-medium">Bu Visual belge açılmadı: burada kullanılamayan bir şey içeriyor ve açmak onu düşürürdü.</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 font-mono text-xs">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </NoticeBox>
    );
  }

  return (
    <VisualEditorContext.Provider value={shared}>
      <div className="focus-within:border-skylab-400/40 rounded-lg border border-white/10">
        {editor && editable ? <Toolbar editor={editor} allow={allow} panel={panel} setPanel={setPanel} /> : null}
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
