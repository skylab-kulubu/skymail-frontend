/**
 * Mail templates as skymail-backend serves them (`internal/handlers/template.go`,
 * routes under `/templates` in `main.go`) and as the template list shows them.
 *
 * A template's row is a copy of its published version, which is what is sent.
 * Beside it the API serves, since ticket 07, the Authoring mode of that
 * version's Main source and each operator's draft in progress. Templates are
 * archived, never deleted (ADR-0042); a System template is not archived at
 * all (ADR-0045).
 *
 * The editor's routes are here too (tickets 04, 07 and 08): a save writes a
 * draft, which sends nothing to anyone; publishing it copies it onto the row.
 * A draft started before someone else published is stale, and the API
 * refuses to publish it until the operator has seen both versions and names
 * the one they replace.
 */
import { ROLE, hasRole } from "./access";
import type { ApiClient } from "./api/client";
import { asApiError } from "./api/errors";
import { listViewQuery, type ListView } from "./list-view";

export type AuthoringMode = "jsx" | "visual" | "html";

/** Who wrote a version (`database.VersionAuthor`). */
export type VersionAuthor = {
  kind: "operator" | "template_seed";
  /** The Keycloak subject of the token that wrote it; null for versions older than version history. */
  sub: string | null;
  /** The name that token carried at the time; null when not known. */
  name: string | null;
};

/** One version without its sources or render (`handlers.TemplateVersionSummary`). */
export type TemplateVersionSummary = {
  id: string;
  template_id: string;
  seq: number;
  /**
   * The template's name as this version has it; a publish copies it onto the
   * row. Absent from a backend where the name is not a version field yet.
   */
  name?: string | null;
  subject: string;
  requested_subject: string | null;
  main_mode: AuthoringMode;
  author: VersionAuthor;
  created_at: string;
  /** Null for a draft. */
  published_at: string | null;
  /** The published version a draft started from. */
  base_version_id: string | null;
  current: boolean;
  discarded: boolean;
};

/**
 * One version whole (`handlers.TemplateVersion`): at most one source per
 * Authoring mode, and the Main source's render — what the version sends.
 */
export type TemplateVersion = TemplateVersionSummary & {
  jsx_source: string | null;
  /** The Visual editor's document (ticket 15). */
  visual_source: unknown;
  html_source: string | null;
  html_content: string;
  plain_text_content: string;
};

/** A conflict rule the Template seed was refused by (`database.SeedConflictRule`, ticket 09). */
export type SeedConflictRule = "published_by_operator" | "newer_operator_version" | "operator_subject";

/**
 * A Template seed refused since the last one that went through, because an
 * operator changed the template (ADR-0047, `handlers.SeedRefusal`): a repo
 * change waiting on a decision.
 */
export type SeedRefusal = {
  /** The first refusal of the content the seed asked for last. */
  refused_at: string;
  /** The rules that held; a newer backend may name one the panel does not know. */
  rules: readonly string[];
  payload_sha256: string;
};

/** A Required variable from the sending service's contract, and why the mail needs it. */
export type ContractRequiredVariable = { name: string; reason: string | null };

/** One Mail template as the template routes serve it (`handlers.Template`). */
export type MailTemplate = {
  id: string;
  name: string;
  /** The Template key a service addresses it by; a System template always has one. */
  key: string | null;
  subject: string;
  system: boolean;
  html_content: string;
  plain_text_content: string;
  react_email_content: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archived_by: string | null;
  published_version_id: string | null;
  /**
   * The Authoring mode of the Main source the template sends; null with no
   * published version. Absent from a backend before ticket 07.
   */
  main_mode?: AuthoringMode | null;
  /** Each operator's draft in progress, newest first. Absent from a backend before ticket 07. */
  drafts?: TemplateVersionSummary[];
  /** Required variables the sending service's contract declares (ticket 08). */
  contract_required_variables?: ContractRequiredVariable[];
  /** Required variables operators marked (ticket 08). */
  operator_required_variables?: string[];
  /** Null when no Template seed is refused. Absent from a backend before ticket 09. */
  seed_refusal?: SeedRefusal | null;
};

export const TEMPLATE_PAGE_SIZE = 25;

/** Today's addresses. */
export const templateHref = {
  index: "/templates",
  create: "/templates/create",
  edit: (id: string) => `/templates/edit/${encodeURIComponent(id)}`,
  show: (id: string) => `/templates/show/${encodeURIComponent(id)}`,
  /** The version history (ticket 14), for anyone who may read the template. */
  history: (id: string) => `/templates/history/${encodeURIComponent(id)}`,
  archived: "/templates?lifecycle=inactive",
} as const;

/** The Authoring modes as the glossary names them. */
export const AUTHORING_MODE_LABEL: Readonly<Record<AuthoringMode, string>> = {
  jsx: "JSX",
  visual: "Visual",
  html: "HTML",
};

function isAuthoringMode(value: unknown): value is AuthoringMode {
  return typeof value === "string" && Object.hasOwn(AUTHORING_MODE_LABEL, value);
}

/** What the list says a Main source is written in; a dash when there is none it can name. */
export function mainSourceLabel(mode: AuthoringMode | null): string {
  return mode ? AUTHORING_MODE_LABEL[mode] : "—";
}

/** Why a System template has no Arşivle, short enough to stand on its row. */
export const SYSTEM_TEMPLATE_NOTE = "Bir servis bunu Template key ile gönderir; arşivlenemez.";

/** What an author with no name on record is called. */
export const UNKNOWN_AUTHOR = "Adı bilinmeyen operatör";

/** An operator author's name as shown, whatever the version recorded. */
export function authorName(author: VersionAuthor): string {
  return author.name?.trim() || UNKNOWN_AUTHOR;
}

/**
 * Whether the viewer wrote a version, told apart by their Keycloak subject:
 * that is what the API records as a version's author, where a name may be
 * shared or change.
 */
export function writtenBy(author: VersionAuthor, viewerSub: string | null): boolean {
  return viewerSub !== null && author.sub === viewerSub;
}

/** One operator's draft in progress, as the indicator lists it. */
export type DraftAuthor = Readonly<{
  versionId: string;
  name: string;
  /** Written by the person viewing the list. */
  mine: boolean;
  writtenAt: string;
}>;

/** Who has an unpublished draft of a template. */
export type DraftsInProgress = Readonly<{
  /** The one author's name, or "N taslak". */
  summary: string;
  /** One of the drafts is the viewer's. */
  mine: boolean;
  /** Newest first, as the API lists them. */
  authors: readonly DraftAuthor[];
}>;

/** What a row of the list shows. */
export type TemplateRow = Readonly<{
  id: string;
  name: string;
  key: string | null;
  subject: string;
  system: boolean;
  /**
   * The Main source's Authoring mode; null when nothing is published, or the
   * API names none the panel knows.
   */
  mainSource: AuthoringMode | null;
  drafts: DraftsInProgress | null;
  archivedAt: string | null;
}>;

/** The drafts in progress, the viewer's marked. */
function draftsInProgress(
  drafts: readonly TemplateVersionSummary[],
  viewerSub: string | null,
): DraftsInProgress | null {
  if (drafts.length === 0) return null;
  const authors = drafts.map((draft) => ({
    versionId: draft.id,
    name: authorName(draft.author),
    mine: writtenBy(draft.author, viewerSub),
    writtenAt: draft.created_at,
  }));
  return {
    summary: authors.length === 1 ? authors[0].name : `${authors.length} taslak`,
    mine: authors.some((author) => author.mine),
    authors,
  };
}

export function toTemplateRow(template: MailTemplate, viewerSub: string | null): TemplateRow {
  return {
    id: template.id,
    name: template.name,
    key: template.key,
    subject: template.subject,
    system: template.system,
    mainSource: isAuthoringMode(template.main_mode) ? template.main_mode : null,
    drafts: draftsInProgress(template.drafts ?? [], viewerSub),
    archivedAt: template.archived_at,
  };
}

/** Everything a row offers, decided in one place. */
export type TemplateActions = Readonly<{
  /**
   * Where its name leads: the editor for a writer, the read-only page for a
   * reader. Nowhere once archived: every read of an archived template answers 404.
   */
  href: string | null;
  archive: boolean;
  restore: boolean;
  /** A current System template: no one archives it, and its row tells every viewer why. */
  systemNote: boolean;
}>;

export function templateActions(row: TemplateRow, roles: readonly string[]): TemplateActions {
  const archived = row.archivedAt !== null;
  const canWrite = hasRole(roles, ROLE.templatesWrite);
  const href = archived ? null : canWrite ? templateHref.edit(row.id) : templateHref.show(row.id);
  return {
    href,
    archive: !archived && !row.system && canWrite,
    restore: archived && canWrite,
    systemNote: !archived && row.system,
  };
}

export async function fetchTemplatePage(
  api: ApiClient,
  view: ListView,
  signal?: AbortSignal,
): Promise<{ templates: MailTemplate[]; total: number }> {
  const query = listViewQuery(view, TEMPLATE_PAGE_SIZE);
  const page = await api.getPage<MailTemplate>("/templates", { query, signal });
  return { templates: page.items, total: page.total ?? query._start + page.items.length };
}

/** Archives a template (`DELETE`, 204). Its versions and past sends are kept. */
export function archiveTemplate(api: ApiClient, id: string): Promise<void> {
  return api.delete(`/templates/${id}`);
}

export function restoreTemplate(api: ApiClient, id: string): Promise<MailTemplate> {
  return api.post<MailTemplate>(`/templates/${id}/restore`);
}

/**
 * Whether an archive was refused because the template is a System template —
 * one that became System after the list was loaded, since its row offers no
 * Arşivle.
 */
export function isSystemArchiveRefusal(error: unknown): boolean {
  return asApiError(error).code === "template.system_protected";
}

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

/** One template, as the editor opens it. */
export function fetchTemplate(api: ApiClient, id: string, signal?: AbortSignal): Promise<MailTemplate> {
  return api.get<MailTemplate>(`/templates/${id}`, { signal });
}

export function fetchVersion(api: ApiClient, templateId: string, versionId: string, signal?: AbortSignal): Promise<TemplateVersion> {
  return api.get<TemplateVersion>(`/templates/${templateId}/versions/${versionId}`, { signal });
}

/** What `GET /templates/{id}/versions` takes: which versions, and the page's slice. */
export type VersionPageQuery = { state: "all" | "published" | "draft"; _start: number; _end: number };

/**
 * One page of a template's history, newest first, with how many versions are
 * in that state — null when X-Total-Count did not reach the browser; the page
 * then counts its pages with `knownPageCount`.
 */
export async function fetchVersionPage(
  api: ApiClient,
  templateId: string,
  query: VersionPageQuery,
  signal?: AbortSignal,
): Promise<{ versions: TemplateVersionSummary[]; total: number | null }> {
  const page = await api.getPage<TemplateVersionSummary>(`/templates/${templateId}/versions`, { query, signal });
  return { versions: page.items, total: page.total };
}

/** Creates a template; the API publishes its first version at once. */
export function createTemplate(api: ApiClient, body: CreateBody): Promise<MailTemplate> {
  return api.post<MailTemplate>("/templates", body);
}

/** Writes a draft: 201 with the new version, or 200 with the one it would have repeated. */
export function saveDraft(api: ApiClient, templateId: string, body: DraftBody): Promise<TemplateVersion> {
  return api.post<TemplateVersion>(`/templates/${templateId}/drafts`, body);
}

export function discardDraft(api: ApiClient, templateId: string, versionId: string): Promise<TemplateVersion> {
  return api.post<TemplateVersion>(`/templates/${templateId}/versions/${versionId}/discard`);
}

/**
 * Copies any version into a new draft by the caller, started from what is
 * published now; nothing that is sent changes. 201 with the draft, or 200
 * with the version the copy would have repeated: the caller's draft in
 * progress, or the published version. The status is kept: it alone says
 * which of the two happened.
 */
export async function restoreVersion(
  api: ApiClient,
  templateId: string,
  versionId: string,
): Promise<{ status: number; version: TemplateVersion }> {
  const { status, data } = await api.postForStatus<TemplateVersion>(`/templates/${templateId}/versions/${versionId}/restore`);
  return { status, version: data };
}

/** A draft someone else's publish overtook (409 `template.stale_base`). */
export type StaleConflict = Readonly<{
  draftId: string;
  /** What the draft started from. */
  baseVersionId: string | null;
  /** What is sent now: the version a forced publish replaces. */
  publishedVersionId: string | null;
}>;

export type PublishOutcome =
  | { kind: "published"; template: MailTemplate }
  | { kind: "stale"; conflict: StaleConflict };

const idOrNull = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

/**
 * Publishes a draft. `over` is the published version the operator was shown
 * and chose to replace; only a stale draft needs it. If yet another version
 * was published meanwhile, the answer is stale again, naming that one.
 */
export async function publishDraft(
  api: ApiClient,
  templateId: string,
  versionId: string,
  over?: string,
): Promise<PublishOutcome> {
  try {
    const template = await api.post<MailTemplate>(
      `/templates/${templateId}/versions/${versionId}/publish`,
      over === undefined ? undefined : { force: { over_version_id: over } },
    );
    return { kind: "published", template };
  } catch (error) {
    const refusal = asApiError(error);
    if (refusal.code !== "template.stale_base") throw error;
    return {
      kind: "stale",
      conflict: {
        draftId: idOrNull(refusal.params?.version_id) ?? versionId,
        baseVersionId: idOrNull(refusal.params?.base_version_id),
        publishedVersionId: idOrNull(refusal.params?.published_version_id),
      },
    };
  }
}
