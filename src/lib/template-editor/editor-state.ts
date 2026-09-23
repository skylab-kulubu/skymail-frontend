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
 * Main source's render. JSX and HTML are the modes the editor writes; a Visual
 * source (ticket 15) is carried by the API, never sent from here.
 */
import { decideSave } from "../mail-render/save";
import type { AuthoringMode as EditableMode, SourceRender } from "../mail-render";
import {
  AUTHORING_MODE_LABEL,
  type AuthoringMode,
  type MailTemplate,
  type TemplateVersion,
} from "../templates";

export type { EditableMode };

/** The Authoring modes the editor writes, in tab order. Visual joins with ticket 15. */
export const EDITABLE_MODES: readonly EditableMode[] = ["jsx", "html"];

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
    /** The version has a Visual source, which the API keeps. */
    hasVisual: boolean;
  }>;

/** The last render the editor has of each mode's source. */
export type Renders = Readonly<Partial<Record<EditableMode, SourceRender | null>>>;

/** What `POST /templates/{id}/drafts` takes (`requests.SaveTemplateDraft`). */
export type DraftBody = {
  /** Left out: kept from the version the save continues. */
  name?: string;
  subject: string;
  main_mode: AuthoringMode;
  /** Left out: kept. */
  jsx_source?: string;
  /** Left out: kept. */
  html_source?: string;
  html_content: string;
  plain_text_content: string;
  base_version_id: string | null;
};

/** What `POST /templates` takes (`requests.CreateTemplate`); the API publishes it as the first version. */
export type CreateBody = {
  name: string;
  subject: string;
  html_content: string;
  plain_text_content: string;
  /** The JSX source, or for an HTML template NO_JSX_SOURCE: the field may not be empty. */
  react_email_content: string;
};

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
 * The version the editor opens: the viewer's draft in progress, told apart by
 * their Keycloak subject as the API records a version's author; or else the
 * published version. Null for a template that has neither.
 */
export function versionToOpen(template: MailTemplate, viewerSub: string | null): string | null {
  const mine = viewerSub ? (template.drafts ?? []).find((draft) => draft.author.sub === viewerSub) : undefined;
  return mine?.id ?? template.published_version_id;
}

export function storedFromVersion(version: TemplateVersion, rowName: string): Stored {
  const draftId = version.published_at === null ? version.id : null;
  const sources: Partial<Record<EditableMode, string>> = {};
  if (version.jsx_source !== null) sources.jsx = version.jsx_source;
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
    hasVisual: version.visual_source !== null && version.visual_source !== undefined,
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

/** The render of exactly this source, if the editor has it and it succeeded. */
function renderOf(renders: Renders, mode: EditableMode, source: string | undefined) {
  const render = renders[mode];
  return render?.ok && render.mode === mode && render.source === source ? render : null;
}

function notRendered(mode: EditableMode, source: string, renders: Renders): Blocker {
  const render = renders[mode];
  const label = AUTHORING_MODE_LABEL[mode];
  if (render && !render.ok && render.mode === mode && render.source === source) {
    return { mode, message: `${label} kaynağı render edilemedi: ${render.message}` };
  }
  return { mode, message: `${label} kaynağının önizlemesi henüz hazır değil; bir an bekle.` };
}

/**
 * The Main source's body as it stands: its render, or the stored render when
 * the source is untouched and was already main.
 */
function mainBody(editing: Content, renders: Renders, stored: Stored): { html: string; plainText: string } | null {
  const main = editing.mainMode;
  if (!isEditableMode(main)) {
    return stored.mainMode === main ? { html: stored.html, plainText: stored.plainText } : null;
  }
  const source = editing.sources[main];
  const render = renderOf(renders, main, source);
  if (render) return { html: render.html, plainText: render.plainText };
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

export function planSave(editing: Content, renders: Renders, stored: Stored): SavePlan {
  const blockers = wordingBlockers(editing);

  const body: Omit<DraftBody, "html_content" | "plain_text_content"> = {
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
    if (decision === "blocked") blockers.push(notRendered(mode, source, renders));
    body[mode === "jsx" ? "jsx_source" : "html_source"] = source;
  }

  const main = mainBody(editing, renders, stored);
  if (!main && !blockers.some((blocker) => blocker.mode === editing.mainMode)) {
    const mode = editing.mainMode;
    const source = isEditableMode(mode) ? editing.sources[mode] : undefined;
    blockers.push(
      isEditableMode(mode) && source !== undefined
        ? notRendered(mode, source, renders)
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
export function planMainChange(candidate: EditableMode, editing: Content, renders: Renders, stored: Stored): SavePlan {
  const label = AUTHORING_MODE_LABEL[candidate];
  if (candidate === editing.mainMode) {
    return { ok: false, blockers: [{ mode: candidate, message: `${label} kaynağı zaten Main source.` }] };
  }
  const source = editing.sources[candidate];
  if (source === undefined) {
    return { ok: false, blockers: [{ mode: candidate, message: `Bu template'in ${label} kaynağı yok.` }] };
  }
  const render = renderOf(renders, candidate, source);
  if (!render) return { ok: false, blockers: [notRendered(candidate, source, renders)] };
  return {
    ok: true,
    body: {
      subject: stored.subject,
      main_mode: candidate,
      [candidate === "jsx" ? "jsx_source" : "html_source"]: source,
      html_content: render.html,
      plain_text_content: render.plainText,
      base_version_id: stored.baseVersionId,
    },
  };
}

/**
 * A source added in a mode the template has none in. It never replaces one,
 * and nothing is converted: HTML starts from the Main source's rendered HTML,
 * so the operator edits the real mail; JSX starts from the starter. Null when
 * there is a source already, or HTML has no rendered Main source to start from.
 */
export function addSource(mode: EditableMode, editing: Content, renders: Renders, stored: Stored): Content | null {
  if (editing.sources[mode] !== undefined) return null;
  const start = mode === "jsx" ? JSX_STARTER : mainBody(editing, renders, stored)?.html;
  if (start === undefined) return null;
  return { ...editing, sources: { ...editing.sources, [mode]: start } };
}

/**
 * A new template: its name, subject and first source, which must have a
 * render of its own text — there is nothing stored to keep.
 */
export function planCreate(
  input: Readonly<{ name: string; subject: string; mode: EditableMode; source: string }>,
  render: SourceRender | null,
): CreatePlan {
  const blockers = wordingBlockers(input);
  const decision = decideSave({ mode: input.mode, source: input.source }, render, null);
  if (decision !== "render" || !render?.ok) {
    blockers.push(notRendered(input.mode, input.source, { [input.mode]: render }));
  }
  if (blockers.length > 0 || !render?.ok) return { ok: false, blockers };
  return {
    ok: true,
    body: {
      name: input.name,
      subject: input.subject,
      html_content: render.html,
      plain_text_content: render.plainText,
      react_email_content: input.mode === "jsx" ? input.source : NO_JSX_SOURCE,
    },
  };
}
