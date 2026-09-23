/**
 * skymail-backend's template routes, answered in the browser (`page.route`),
 * with the behaviour the editor depends on as tickets 04, 07 and 08 built it
 * (internal/handlers/template*.go on feat/required-variables), plus the draft
 * `name` field of ticket 09's review:
 *
 *  - a draft save continues the author's draft in progress when it started
 *    from the same base, or else the base; a source left out or null is kept
 *    from that version, and so is the name; a save that changes nothing
 *    writes nothing and answers 200;
 *  - publishing a draft whose base is no longer the published version is
 *    refused with 409 template.stale_base naming the three versions, until
 *    the request names the published version it replaces
 *    (`{"force": {"over_version_id"}}`); publishing copies the draft onto the
 *    row;
 *  - creating a template publishes its first version; react_email_content
 *    with no code outside comments leaves HTML the Main source;
 *  - a draft save, or a publish, whose HTML body does not reference every
 *    Required variable is refused with 422 template.required_variables_missing,
 *    naming each missing one by name with its source and reason, as
 *    requiredvars.CheckBody does. The body is read with the rule the server is
 *    held to (referencedVariables, pinned to the same cases on both sides), so
 *    a link left only in an HTML comment is missing here as it is there. The
 *    mock does not parse: a body the mailer cannot parse is not refused;
 *  - an operator marks a variable (`POST …/required-variables`) only when the
 *    published body references it, and releases one (`DELETE
 *    …/required-variables/{name}`) unless the contract holds it (409); both
 *    answer with the template, need the write role and write no version.
 *
 * Every request is recorded, with whether it carried the minted session's
 * bearer token and which frame sent it. Anything else answers 501, so a test
 * never passes on a route nobody mocked.
 */
import type { Page, Route } from "@playwright/test";
import { referencedVariables } from "../../../src/lib/mail-render/go-template";
import { E2E_API_URL } from "./env";
import { VIEWER, accessToken } from "./session";

type Mode = "jsx" | "visual" | "html";

export type Author = { kind: "operator" | "template_seed"; sub: string | null; name: string | null };

export type Version = {
  id: string;
  template_id: string;
  seq: number;
  name: string;
  subject: string;
  requested_subject: null;
  main_mode: Mode;
  author: Author;
  created_at: string;
  published_at: string | null;
  base_version_id: string | null;
  discarded: boolean;
  jsx_source: string | null;
  visual_source: unknown;
  html_source: string | null;
  html_content: string;
  plain_text_content: string;
};

type Row = {
  id: string;
  name: string;
  key: string | null;
  subject: string;
  system: boolean;
  html_content: string;
  plain_text_content: string;
  react_email_content: string;
  created_at: string;
  updated_at: string;
  archived_at: null;
  archived_by: null;
  published_version_id: string | null;
  contract_required_variables: { name: string; reason: string | null }[];
  operator_required_variables: string[];
};

export type Recorded = {
  method: string;
  path: string;
  body: unknown;
  /** Carried the minted session's bearer token. */
  authorized: boolean;
  /** The URL of the frame that sent it. */
  frameUrl: string;
};

export const OTHER_OPERATOR: Author = { kind: "operator", sub: "1b7e2d94-3c5a-4f08-8e61-2d9c4a7b3f10", name: "Mehmet Kaya" };
export const TEMPLATE_SEED: Author = { kind: "template_seed", sub: null, name: "service-account-skymail-seed" };
const ME: Author = { kind: "operator", sub: VIEWER.sub, name: VIEWER.name };

type Content = Pick<Version, "name" | "subject" | "main_mode" | "jsx_source" | "visual_source" | "html_source" | "html_content" | "plain_text_content">;

const CONTENT_FIELDS = ["name", "subject", "main_mode", "jsx_source", "visual_source", "html_source", "html_content", "plain_text_content"] as const;

/** The server's template_jsx_source rule: code left once comments are removed. */
const hasCode = (text: string) => text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "").trim() !== "";

/** What an API route answers: a status and a JSON body, if any. */
export type Answer = { status: number; body?: unknown };

const refuse = (status: number, code: string, params?: Record<string, unknown>): Answer => ({
  status,
  body: { code, message: code, ...(params ? { params } : {}) },
});

const asFields = (body: unknown): Record<string, unknown> =>
  typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

const sourceOf = (content: Content, mode: Mode) =>
  mode === "jsx" ? content.jsx_source : mode === "html" ? content.html_source : content.visual_source;

export class MockSkymail {
  readonly requests: Recorded[] = [];
  private readonly rows = new Map<string, Row>();
  private readonly versions = new Map<string, Version>();
  private clock = Date.parse("2026-09-23T06:00:00Z");
  private ids = 0;

  private nextId(prefix: string) {
    this.ids += 1;
    return `${prefix}-0000-4000-8000-${String(this.ids).padStart(12, "0")}`;
  }

  private now() {
    this.clock += 60_000;
    return new Date(this.clock).toISOString();
  }

  /** A template with one published version. */
  addTemplate(input: {
    name: string;
    subject: string;
    key?: string | null;
    system?: boolean;
    mainMode: "jsx" | "html";
    jsx?: string;
    html?: string;
    htmlContent: string;
    plainText: string;
    author?: Author;
    /** The contract's Required variables, with why the mail needs them. */
    requiredVariables?: { name: string; reason: string | null }[];
    /** The Required variables operators marked. */
    operatorRequired?: string[];
  }): { id: string; versionId: string } {
    const id = this.nextId("7e3a1c00");
    const at = this.now();
    this.rows.set(id, {
      id,
      name: input.name,
      key: input.key ?? null,
      subject: input.subject,
      system: input.system ?? false,
      html_content: "",
      plain_text_content: "",
      react_email_content: "",
      created_at: at,
      updated_at: at,
      archived_at: null,
      archived_by: null,
      published_version_id: null,
      contract_required_variables: input.requiredVariables ?? [],
      operator_required_variables: input.operatorRequired ?? [],
    });
    const version = this.write(id, input.author ?? TEMPLATE_SEED, null, {
      name: input.name,
      subject: input.subject,
      main_mode: input.mainMode,
      jsx_source: input.jsx ?? null,
      visual_source: null,
      html_source: input.html ?? null,
      html_content: input.htmlContent,
      plain_text_content: input.plainText,
    });
    this.publish(version);
    return { id, versionId: version.id };
  }

  /**
   * Someone else publishes straight away — another operator's publish, or a
   * Template seed — starting from what is published now.
   */
  publishAs(templateId: string, author: Author, changes: Partial<Content>): Version {
    const row = this.row(templateId);
    const current = this.version(row.published_version_id!);
    const version = this.write(templateId, author, current.id, { ...this.contentOf(current), ...changes });
    this.publish(version);
    return version;
  }

  /** A draft by `author`, started from what is published now. */
  addDraft(templateId: string, author: Author, changes: Partial<Content>): Version {
    const current = this.version(this.row(templateId).published_version_id!);
    return this.write(templateId, author, current.id, { ...this.contentOf(current), ...changes });
  }

  row(id: string): Row {
    const row = this.rows.get(id);
    if (!row) throw new Error(`no template ${id}`);
    return row;
  }

  version(id: string): Version {
    const version = this.versions.get(id);
    if (!version) throw new Error(`no version ${id}`);
    return version;
  }

  versionsOf(templateId: string): Version[] {
    return [...this.versions.values()].filter((version) => version.template_id === templateId).sort((a, b) => b.seq - a.seq);
  }

  /** Requests to the API, without the ones the editor reads with. */
  writes(): Recorded[] {
    return this.requests.filter((request) => request.method !== "GET");
  }

  async attach(page: Page) {
    await page.route(`${E2E_API_URL}/**`, (route) => this.handle(route));
  }

  private contentOf(version: Version): Content {
    return Object.fromEntries(CONTENT_FIELDS.map((field) => [field, version[field]])) as Content;
  }

  private write(templateId: string, author: Author, base: string | null, content: Content): Version {
    const seq = this.versionsOf(templateId).length + 1;
    const version: Version = {
      id: this.nextId("9a1b2c00"),
      template_id: templateId,
      seq,
      requested_subject: null,
      author,
      created_at: this.now(),
      published_at: null,
      base_version_id: base,
      discarded: false,
      ...content,
    };
    this.versions.set(version.id, version);
    return version;
  }

  private publish(version: Version) {
    const row = this.row(version.template_id);
    version.published_at = this.now();
    Object.assign(row, {
      name: version.name,
      subject: version.subject,
      html_content: version.html_content,
      plain_text_content: version.plain_text_content,
      react_email_content: version.main_mode === "jsx" ? (version.jsx_source ?? "") : "",
      published_version_id: version.id,
      updated_at: version.published_at,
    });
  }

  /** A version without its sources or render, as the history and `drafts` list it. */
  private summary(version: Version) {
    const summary: Partial<Version> = { ...version };
    for (const field of ["jsx_source", "visual_source", "html_source", "html_content", "plain_text_content"] as const) {
      delete summary[field];
    }
    return { ...summary, current: this.rows.get(version.template_id)?.published_version_id === version.id };
  }

  private full(version: Version) {
    return { ...version, current: this.rows.get(version.template_id)?.published_version_id === version.id };
  }

  /** Each operator's newest version, while it is neither published nor discarded. */
  private drafts(templateId: string): Version[] {
    const newest = new Map<string, Version>();
    for (const version of this.versionsOf(templateId)) {
      if (version.author.kind !== "operator" || !version.author.sub || newest.has(version.author.sub)) continue;
      newest.set(version.author.sub, version);
    }
    return [...newest.values()].filter((version) => version.published_at === null && !version.discarded);
  }

  private served(row: Row) {
    const published = row.published_version_id ? this.versions.get(row.published_version_id) : undefined;
    return {
      ...row,
      main_mode: published?.main_mode ?? null,
      drafts: this.drafts(row.id).map((draft) => this.summary(draft)),
    };
  }

  private async handle(route: Route) {
    const request = route.request();
    let body: unknown = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = request.postData();
    }
    let frameUrl = "";
    try {
      frameUrl = request.frame().url();
    } catch {
      // A request from no frame (a worker) has none.
    }
    const answer = this.respond({
      method: request.method(),
      path: new URL(request.url()).pathname.slice(new URL(E2E_API_URL).pathname.length),
      body,
      authorization: request.headers().authorization,
      frameUrl,
    });
    await route.fulfill({
      status: answer.status,
      contentType: "application/json",
      body: answer.body === undefined ? "" : JSON.stringify(answer.body),
    });
  }

  /**
   * One request, answered: `path` is what follows the API base. The browser
   * tests reach it through `attach`; the dev server's stand-in API can serve
   * it over HTTP.
   */
  respond(request: { method: string; path: string; body: unknown; authorization?: string; frameUrl?: string }): Answer {
    const { method, path, body } = request;
    const authorized =
      request.authorization === `Bearer ${accessToken("writer")}` || request.authorization === `Bearer ${accessToken("reader")}`;
    this.requests.push({ method, path, body, authorized, frameUrl: request.frameUrl ?? "" });
    if (!authorized) return refuse(401, "server.unauthorized");

    const templateMatch = /^\/templates\/([^/]+)$/.exec(path);
    const requiredMatch = /^\/templates\/([^/]+)\/required-variables(?:\/([^/]+))?$/.exec(path);
    const versionMatch = /^\/templates\/([^/]+)\/versions\/([^/]+)(?:\/(publish|discard))?$/.exec(path);
    const draftsMatch = /^\/templates\/([^/]+)\/drafts$/.exec(path);

    if (method === "GET" && templateMatch) {
      const row = this.rows.get(templateMatch[1]);
      return row ? { status: 200, body: this.served(row) } : refuse(404, "server.not_found");
    }
    if (method === "POST" && path === "/templates") return this.create(asFields(body));
    if (versionMatch) {
      const [, templateId, versionId, action] = versionMatch;
      const version = this.versions.get(versionId);
      if (!this.rows.has(templateId) || !version || version.template_id !== templateId) return refuse(404, "server.not_found");
      if (method === "GET" && !action) return { status: 200, body: this.full(version) };
      if (method === "POST" && action === "publish") return this.publishDraft(version, body);
      if (method === "POST" && action === "discard") {
        if (version.published_at) return refuse(409, "template.not_a_draft");
        version.discarded = true;
        return { status: 200, body: this.full(version) };
      }
    }
    if (method === "POST" && draftsMatch) return this.saveDraft(draftsMatch[1], asFields(body));
    if (requiredMatch && ((method === "POST" && !requiredMatch[2]) || (method === "DELETE" && requiredMatch[2]))) {
      if (request.authorization !== `Bearer ${accessToken("writer")}`) return refuse(403, "server.forbidden");
      const [, templateId, name] = requiredMatch;
      return method === "POST"
        ? this.markRequired(templateId, asFields(body).name)
        : this.releaseRequired(templateId, decodeURIComponent(name));
    }

    return refuse(501, "e2e.not_mocked", { method, path });
  }

  private saveDraft(templateId: string, body: Record<string, unknown>): Answer {
    if (!this.rows.has(templateId)) return refuse(404, "server.not_found");
    const missing = (["subject", "main_mode", "html_content", "plain_text_content"] as const).filter(
      (field) => typeof body[field] !== "string" || (body[field] as string).trim() === "",
    );
    if (missing.length > 0) return refuse(400, "validation.error", { errors: missing.map((field) => ({ field, code: "required" })) });

    const base = typeof body.base_version_id === "string" ? this.versions.get(body.base_version_id) : undefined;
    if (!base || base.template_id !== templateId || !base.published_at) return refuse(400, "template.invalid_base");

    const mine = this.drafts(templateId).find((draft) => draft.author.sub === ME.sub);
    const continued = mine && mine.base_version_id === base.id ? mine : base;
    const kept = (field: "jsx_source" | "html_source" | "name") =>
      typeof body[field] === "string" ? (body[field] as string) : continued[field];
    const content: Content = {
      name: kept("name") as string,
      subject: body.subject as string,
      main_mode: body.main_mode as Mode,
      jsx_source: kept("jsx_source"),
      visual_source: continued.visual_source,
      html_source: kept("html_source"),
      html_content: body.html_content as string,
      plain_text_content: body.plain_text_content as string,
    };
    if (sourceOf(content, content.main_mode) === null) return refuse(400, "template.main_source_missing", { main_mode: content.main_mode });
    const missingVariables = this.missingRequired(templateId, content.html_content);
    if (missingVariables.length > 0) return refuse(422, "template.required_variables_missing", { missing: missingVariables });

    const before = this.contentOf(continued);
    if (CONTENT_FIELDS.every((field) => JSON.stringify(before[field]) === JSON.stringify(content[field]))) {
      return { status: 200, body: this.full(continued) };
    }
    return { status: 201, body: this.full(this.write(templateId, ME, base.id, content)) };
  }

  /**
   * The Required variables `html` does not reference, as requiredvars.CheckBody
   * lists them: each with its source and reason, sorted by name byte by byte.
   * `operator` stands in for the operator set, for a check before it is written.
   */
  private missingRequired(templateId: string, html: string, operator = this.row(templateId).operator_required_variables) {
    const referenced = new Set(referencedVariables(html));
    return [
      ...this.row(templateId).contract_required_variables.map(({ name, reason }) => ({ name, source: "contract", reason })),
      ...operator.map((name) => ({ name, source: "operator", reason: null })),
    ]
      .filter((variable) => !referenced.has(variable.name))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  /** The server's variable name rule (validator.IsVariableName). */
  private static isVariableName(name: unknown): name is string {
    return typeof name === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name);
  }

  private markRequired(templateId: string, name: unknown): Answer {
    const row = this.rows.get(templateId);
    if (!row) return refuse(404, "server.not_found");
    if (!MockSkymail.isVariableName(name)) {
      return refuse(400, "validation.error", { errors: [{ field: "name", code: "invalid_variable_name" }] });
    }
    // One the contract holds is required already, and stays the contract's.
    const inContract = row.contract_required_variables.some((variable) => variable.name === name);
    const operator = inContract || row.operator_required_variables.includes(name) ? row.operator_required_variables : [...row.operator_required_variables, name].sort();
    // The published body must reference every Required variable, the new one too.
    const missing = this.missingRequired(templateId, row.html_content, operator);
    if (missing.length > 0) return refuse(422, "template.required_variables_missing", { missing });
    row.operator_required_variables = operator;
    return { status: 200, body: this.served(row) };
  }

  private releaseRequired(templateId: string, name: string): Answer {
    const row = this.rows.get(templateId);
    if (!row) return refuse(404, "server.not_found");
    if (!MockSkymail.isVariableName(name)) return refuse(400, "template.invalid_variable_name");
    if (row.contract_required_variables.some((variable) => variable.name === name)) {
      return refuse(409, "template.required_variable_in_contract", { name });
    }
    row.operator_required_variables = row.operator_required_variables.filter((marked) => marked !== name);
    return { status: 200, body: this.served(row) };
  }

  private publishDraft(version: Version, body: unknown): Answer {
    const row = this.row(version.template_id);
    if (version.discarded) return refuse(409, "template.draft_discarded");
    if (version.published_at) {
      return row.published_version_id === version.id ? { status: 200, body: this.served(row) } : refuse(409, "template.not_a_draft");
    }
    const over = (body as { force?: { over_version_id?: unknown } } | null)?.force?.over_version_id;
    if (version.base_version_id !== row.published_version_id && over !== row.published_version_id) {
      return refuse(409, "template.stale_base", {
        version_id: version.id,
        base_version_id: version.base_version_id,
        published_version_id: row.published_version_id,
      });
    }
    // Against the Required variables as they are now, not as they were when the draft was saved.
    const missing = this.missingRequired(row.id, version.html_content);
    if (missing.length > 0) return refuse(422, "template.required_variables_missing", { missing });
    this.publish(version);
    return { status: 200, body: this.served(row) };
  }

  private create(body: Record<string, unknown>): Answer {
    const fields = ["name", "subject", "html_content", "plain_text_content", "react_email_content"] as const;
    const missing = fields.filter((field) => typeof body[field] !== "string" || body[field] === "");
    if (missing.length > 0) return refuse(400, "validation.error", { errors: missing.map((field) => ({ field, code: "required" })) });
    const jsx = hasCode(body.react_email_content as string) ? (body.react_email_content as string) : null;
    const { id } = this.addTemplate({
      name: body.name as string,
      subject: body.subject as string,
      mainMode: jsx ? "jsx" : "html",
      jsx: jsx ?? undefined,
      html: jsx ? undefined : (body.html_content as string),
      htmlContent: body.html_content as string,
      plainText: body.plain_text_content as string,
      author: ME,
    });
    return { status: 201, body: this.served(this.row(id)) };
  }
}
