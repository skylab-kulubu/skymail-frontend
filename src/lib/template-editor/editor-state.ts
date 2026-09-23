/**
 * The Mail template editor's state, and the rules on what it may send.
 *
 * The editor holds a version (CONTEXT.md, Mail template version): the
 * operator's draft in progress if there is one, or else the published
 * version a draft would start from. The operator edits its name, subject and
 * sources — one per Authoring mode — and chooses deliberately which source is
 * the Main source. Saving writes a new draft (`POST /templates/{id}/drafts`);
 * the API stores the render it is given and keeps any source a draft leaves
 * out, so no save and no Main source change can drop a source (ADR-0046).
 *
 * What may be sent is decided here: every source sent has a render of its own
 * text, or is untouched (the render module's decideSave), and the body is the
 * Main source's render. A Visual source is held as its document's JSON text,
 * which is what the render module renders, and sent as the document itself.
 */
import { decideSave, renderOf } from "../mail-render/save";
import type { AuthoringMode as EditableMode, SourceRender } from "../mail-render";
import { EMPTY_VISUAL_SOURCE, readVisualDocument } from "../mail-render/visual-document";
import {
  AUTHORING_MODE_LABEL,
  writtenBy,
  type AuthoringMode,
  type CreateBody,
  type DraftBody,
  type MailTemplate,
  type TemplateVersion,
} from "../templates";

export type { EditableMode };

/** The Authoring modes the editor writes, in tab order. */
export const EDITABLE_MODES: readonly EditableMode[] = ["jsx", "visual", "html"];

export function isEditableMode(mode: AuthoringMode): mode is EditableMode {
  return (EDITABLE_MODES as readonly AuthoringMode[]).includes(mode);
}

/** What the operator edits. */
export type Content = Readonly<{
  name: string;
  subject: string;
  mainMode: AuthoringMode;
  sources: Readonly<Partial<Record<EditableMode, string>>>;
}>;

/** The version the editor last opened or saved. */
export type Stored = Content &
  Readonly<{
    versionId: string;
    /** Its number in the template's history. */
    seq: number;
    /** When it was written. */
    savedAt: string;
    /** The operator's draft in progress, when that is what is held. */
    draftId: string | null;
    /** The published version a save starts from: the draft's base, or the published version itself. */
    baseVersionId: string | null;
    /** The Main source's render as stored. */
    html: string;
    plainText: string;
  }>;

/** The last render the editor has of each mode's source. */
export type Renders = Readonly<Partial<Record<EditableMode, SourceRender | null>>>;

/** Why a save cannot go yet; `mode` is the source it is about, null for the name or subject. */
export type Blocker = Readonly<{ mode: EditableMode | null; message: string }>;

export type SavePlan = { ok: true; body: DraftBody } | { ok: false; blockers: Blocker[] };

export type CreatePlan = { ok: true; body: CreateBody } | { ok: false; blockers: Blocker[] };

/**
 * What an HTML template sends as react_email_content, which may not be empty.
 * The API takes the field as a JSX source only when code is left once its
 * comments are removed; a comment alone makes the HTML the Main source.
 */
export const NO_JSX_SOURCE = "// Bu Mail template HTML modunda yazıldı; JSX kaynağı yok.\n";

/**
 * Where a new JSX source starts: the club's own mail components, which the
 * render module offers under the names the repo's templates import them by.
 */
export const JSX_STARTER = `import * as React from "react";
import { Cta, Heading, Paragraph, Shell } from "./theme";
import { v } from "./go";

// Kulübün mail bileşenleri "./theme"ten, Go template yardımcıları "./go"dan gelir.
// v("FirstName") gönderimde {{.FirstName}} olur ve alıcının adıyla dolar.
export default function Mail() {
  return (
    <Shell preview="Gelen kutusunda konunun yanında görünen kısa metin">
      <Heading>Merhaba {v("FirstName")}</Heading>
      <Paragraph>Mailin metnini buraya yaz.</Paragraph>
      <Cta href="https://yildizskylab.com">Devam et</Cta>
    </Shell>
  );
}
`;

/** Where a template created in HTML starts. */
export const HTML_STARTER = `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="light dark" />
  </head>
  <body style="margin:0;padding:24px;background-color:#f4f1f7;font-family:Helvetica,Arial,sans-serif;color:#1b1620;">
    <p>Merhaba {{.FirstName}},</p>
    <p>Mailin metnini buraya yaz.</p>
  </body>
</html>
`;

/**
 * The version the editor opens: the viewer's draft in progress, or else the
 * published version. Null for a template that has neither.
 */
export function versionToOpen(template: MailTemplate, viewerSub: string | null): string | null {
  const mine = (template.drafts ?? []).find((draft) => writtenBy(draft.author, viewerSub));
  return mine?.id ?? template.published_version_id;
}

/**
 * A stored Visual document as the text the editor holds: in the model's one
 * key order when the model reads it, so the order jsonb gives back is not an
 * edit; as it came when it does not, so its render says what is wrong and a
 * save that leaves it alone sends it back unchanged.
 */
function visualSourceFrom(document: unknown): string {
  const read = readVisualDocument(document);
  return JSON.stringify(read.ok ? read.document : document);
}

/** Where each mode's source goes in a draft: code and markup as text, a Visual source as the document itself. */
function sourceField(mode: EditableMode, source: string): Pick<DraftBody, "jsx_source" | "visual_source" | "html_source"> {
  switch (mode) {
    case "jsx":
      return { jsx_source: source };
    case "visual":
      // Always JSON: what storedFromVersion, addSource and the Visual editor put here.
      return { visual_source: JSON.parse(source) as Record<string, unknown> };
    case "html":
      return { html_source: source };
  }
}

export function storedFromVersion(version: TemplateVersion, rowName: string): Stored {
  const draftId = version.published_at === null ? version.id : null;
  const sources: Partial<Record<EditableMode, string>> = {};
  if (version.jsx_source !== null) sources.jsx = version.jsx_source;
  if (version.visual_source !== null && version.visual_source !== undefined) sources.visual = visualSourceFrom(version.visual_source);
  if (version.html_source !== null) sources.html = version.html_source;
  return {
    name: version.name ?? rowName,
    subject: version.subject,
    mainMode: version.main_mode,
    sources,
    versionId: version.id,
    seq: version.seq,
    savedAt: version.created_at,
    draftId,
    baseVersionId: draftId ? version.base_version_id : version.id,
    html: version.html_content,
    plainText: version.plain_text_content,
  };
}

export function contentOf(stored: Stored): Content {
  return { name: stored.name, subject: stored.subject, mainMode: stored.mainMode, sources: stored.sources };
}

export function isDirty(editing: Content, stored: Stored): boolean {
  return (
    editing.name !== stored.name ||
    editing.subject !== stored.subject ||
    editing.mainMode !== stored.mainMode ||
    EDITABLE_MODES.some((mode) => editing.sources[mode] !== stored.sources[mode])
  );
}

/** Everything the editor's rules read: what is edited, the renders it has, and what is stored. */
export type EditorState = Readonly<{ editing: Content; renders: Renders; stored: Stored }>;

/** The successful render of the source as it stands in `mode`, if the editor has it. */
function currentRender({ editing, renders }: EditorState, mode: EditableMode) {
  const source = editing.sources[mode];
  if (source === undefined) return null;
  const render = renderOf(renders[mode], { mode, source });
  return render?.ok ? render : null;
}

function notRendered(mode: EditableMode, source: string, render: SourceRender | null | undefined): Blocker {
  const label = AUTHORING_MODE_LABEL[mode];
  const current = renderOf(render, { mode, source });
  if (current && !current.ok) {
    return { mode, message: `${label} kaynağı render edilemedi: ${current.message}` };
  }
  return { mode, message: `${label} kaynağının önizlemesi henüz hazır değil; bir an bekle.` };
}

/**
 * The Main source's body as it stands: its render, or the stored render when
 * the source is untouched and was already main.
 */
function mainBody(state: EditorState): { html: string; plainText: string } | null {
  const { editing, stored } = state;
  const main = editing.mainMode;
  if (!isEditableMode(main)) {
    return stored.mainMode === main ? { html: stored.html, plainText: stored.plainText } : null;
  }
  const render = currentRender(state, main);
  if (render) return { html: render.html, plainText: render.plainText };
  const source = editing.sources[main];
  return stored.mainMode === main && source !== undefined && stored.sources[main] === source
    ? { html: stored.html, plainText: stored.plainText }
    : null;
}

function wordingBlockers({ name, subject }: { name: string; subject: string }): Blocker[] {
  const blockers: Blocker[] = [];
  if (name.trim() === "") blockers.push({ mode: null, message: "Template adı boş olamaz." });
  if (subject.trim() === "") blockers.push({ mode: null, message: "Konu boş olamaz." });
  return blockers;
}

export function planSave(state: EditorState): SavePlan {
  const { editing, renders, stored } = state;
  const blockers = wordingBlockers(editing);

  let body: Omit<DraftBody, "html_content" | "plain_text_content"> = {
    name: editing.name,
    subject: editing.subject,
    main_mode: editing.mainMode,
    base_version_id: stored.baseVersionId,
  };
  for (const mode of EDITABLE_MODES) {
    const source = editing.sources[mode];
    if (source === undefined) continue;
    const kept = stored.sources[mode];
    const decision = decideSave({ mode, source }, renders[mode] ?? null, kept === undefined ? null : { mode, source: kept });
    if (decision === "blocked") blockers.push(notRendered(mode, source, renders[mode]));
    body = { ...body, ...sourceField(mode, source) };
  }

  const main = mainBody(state);
  if (!main && !blockers.some((blocker) => blocker.mode === editing.mainMode)) {
    const mode = editing.mainMode;
    const source = isEditableMode(mode) ? editing.sources[mode] : undefined;
    blockers.push(
      isEditableMode(mode) && source !== undefined
        ? notRendered(mode, source, renders[mode])
        : { mode: null, message: `Main source ${AUTHORING_MODE_LABEL[mode]} modunda ama o modda kaynak yok.` },
    );
  }
  if (blockers.length > 0 || !main) return { ok: false, blockers };
  return { ok: true, body: { ...body, html_content: main.html, plain_text_content: main.plainText } };
}

/**
 * Making `candidate` the Main source: a draft with the new mode and the
 * render of the candidate as it stands — the render the operator confirmed —
 * and nothing else. The other sources, the name and any unsaved edit to them
 * stay out of it; the API keeps the sources as they are.
 */
export function planMainChange(candidate: EditableMode, state: EditorState): SavePlan {
  const { editing, renders, stored } = state;
  const label = AUTHORING_MODE_LABEL[candidate];
  if (candidate === editing.mainMode) {
    return { ok: false, blockers: [{ mode: candidate, message: `${label} kaynağı zaten Main source.` }] };
  }
  const source = editing.sources[candidate];
  if (source === undefined) {
    return { ok: false, blockers: [{ mode: candidate, message: `Bu template'in ${label} kaynağı yok.` }] };
  }
  const render = currentRender(state, candidate);
  if (!render) return { ok: false, blockers: [notRendered(candidate, source, renders[candidate])] };
  return {
    ok: true,
    body: {
      subject: stored.subject,
      main_mode: candidate,
      ...sourceField(candidate, source),
      html_content: render.html,
      plain_text_content: render.plainText,
      base_version_id: stored.baseVersionId,
    },
  };
}

/**
 * A source added in a mode the template has none in. It never replaces one,
 * and nothing is converted: HTML starts from the Main source's rendered HTML,
 * so the operator edits the real mail; JSX starts from the starter; Visual
 * starts empty. Null when there is a source already, or HTML has no rendered
 * Main source to start from.
 */
export function addSource(mode: EditableMode, state: EditorState): Content | null {
  const { editing } = state;
  if (editing.sources[mode] !== undefined) return null;
  const start = mode === "jsx" ? JSX_STARTER : mode === "visual" ? EMPTY_VISUAL_SOURCE : mainBody(state)?.html;
  if (start === undefined) return null;
  return { ...editing, sources: { ...editing.sources, [mode]: start } };
}

/**
 * The source in `mode` back as stored — or gone, if it was added since the
 * last save — with every other change kept. A save refuses a source that does
 * not render (story 29); this is how a half-written one is set aside so the
 * rest can still be saved.
 */
export function revertSource(mode: EditableMode, editing: Content, stored: Stored): Content {
  const sources = { ...editing.sources };
  const kept = stored.sources[mode];
  if (kept === undefined) delete sources[mode];
  else sources[mode] = kept;
  return { ...editing, sources };
}

/**
 * A new template: its name, subject and first source. With nothing stored to
 * keep, the save rule comes down to a successful render of the source as it
 * stands.
 */
export function planCreate(
  input: Readonly<{ name: string; subject: string; mode: EditableMode; source: string }>,
  render: SourceRender | null,
): CreatePlan {
  const blockers = wordingBlockers(input);
  const current = renderOf(render, input);
  if (!current?.ok) {
    blockers.push(notRendered(input.mode, input.source, render));
    return { ok: false, blockers };
  }
  if (blockers.length > 0) return { ok: false, blockers };
  return {
    ok: true,
    body: {
      name: input.name,
      subject: input.subject,
      html_content: current.html,
      plain_text_content: current.plainText,
      react_email_content: input.mode === "jsx" ? input.source : NO_JSX_SOURCE,
    },
  };
}
