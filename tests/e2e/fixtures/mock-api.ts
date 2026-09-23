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
 *  - a Visual source is a JSON object (400 otherwise), stored as jsonb
 *    stores it: its keys come back in jsonb's order, not the one sent;
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
 *    answer with the template, need the write role, write no version, and
 *    answer 404 for an archived template;
 *  - the history (ticket 14, feat/seed-conflict): versions newest first,
 *    filtered by `state` and paged with `_start`/`_end` and X-Total-Count;
 *    restoring a version copies it into a new draft by the caller started
 *    from what is published, or answers 200 with the version the copy would
 *    repeat (the caller's draft in progress on the published version, else
 *    the published one); a template carries `seed_refusal`.
 *
 * The send form's routes (ticket 16), as skymail-backend `origin/main`
 * answers them (internal/handlers/mail.go, list.go):
 *
 *  - `GET /templates` lists templates by `lifecycle` (default current), paged
 *    with `_start`/`_end` and X-Total-Count;
 *  - `GET /mailing_lists` pages internal lists and appends every Keycloak
 *    group to each page; a list, and its recipients (a group's members all
 *    at once);
 *  - `POST /mail_tasks` needs mails:write, and answers 404 for an archived
 *    template, an archived or unknown list, or a group without members;
 *    `POST /mail_tasks/single` needs mails:send or mails:write, answers 404
 *    for an archived template and 400 for an address that is not one — or
 *    what a test set for that address (`refuseSingle`) or for the next list
 *    send (`refuseListSend`). Both answer 201
 *    `{id}`, and the send can be read back — alone, with its recipients'
 *    queue, or in `GET /mail_tasks`, newest first.
 *
 * Mail onayı's routes (ticket 20), as skymail-backend `origin/main` answers
 * them (ticket 19, internal/handlers/mail_approval*.go):
 *
 *  - `POST /mail_approvals` takes the send form's body, to a list or to one
 *    person; refuses an archived template (422 template_unavailable), an
 *    unknown list (422 audience_unavailable) and an empty Required variable
 *    (422 required_variables_missing); pins the request to the version
 *    published now and gives it seven days;
 *  - an approver (`mails:approve`) lists and reads everyone's requests,
 *    anyone else only their own (404 for another's); a request past its
 *    deadline reads as expired; an action on it records the expiry and
 *    answers 409 mail_approval.expired;
 *  - approve (as it is, or with `body_variables`, recorded as an edit),
 *    return (an edit that must differ, 422 no_edit; seven days again),
 *    reject (a reason), accept and decline (the submitter's), resubmit (a
 *    rejected or declined request, pinned again). Another state is 409
 *    state_conflict; a template published again since the request is 409
 *    template_republished on approve and accept. An approval or acceptance
 *    opens a send, readable like any other;
 *  - the preview is the pinned version filled with the values
 *    (fillSampleValues), rendered for the single recipient or the submitter;
 *  - what a test set with `refuseApproval` answers the next such action, and
 *    `failApprovalNotifications` names a notification problem.
 *
 * A test can hold a request (`hold`) to put two in the order it needs.
 *
 * Every request is recorded, with whether it carried the minted session's
 * bearer token and which frame sent it. Anything else answers 501, so a test
 * never passes on a route nobody mocked.
 */
import type { Page, Route } from "@playwright/test";
import { referencedVariables } from "../../../src/lib/mail-render/go-template";
import { fillSampleValues } from "../../../src/lib/mail-render/preview";
import { isVariableName } from "../../../src/lib/template-editor/required-variables";
import { E2E_API_URL } from "./env";
import { ROLES, VIEWER, accessToken, personOf, type Person, type Profile } from "./session";

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

/** A refused Template seed, as the template carries it (`handlers.SeedRefusal`). */
export type SeedRefusal = { refused_at: string; rules: string[]; payload_sha256: string };

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
  /** Set by a test that archives the template behind the page's back. */
  archived_at: string | null;
  archived_by: string | null;
  published_version_id: string | null;
  contract_required_variables: { name: string; reason: string | null }[];
  operator_required_variables: string[];
  seed_refusal: SeedRefusal | null;
};

/**
 * A request a test holds, to put two requests in the order it wants: at
 * `request` before the mock answers it (as if the server had not got to it
 * yet), at `answer` after (the server acted; the answer is on its way).
 */
export type Hold = {
  /** Settles when the request reaches the hold. */
  readonly reached: Promise<void>;
  release(): void;
};

type HeldRequest = { method: string; path: string; stage: "request" | "answer"; used: boolean; reach: () => void; gate: Promise<void> };

export type Recorded = {
  method: string;
  path: string;
  body: unknown;
  /** Carried the minted session's bearer token. */
  authorized: boolean;
  /** The URL of the frame that sent it. */
  frameUrl: string;
};

/** A mailing list: an internal one, or a Keycloak group whose members are its recipients. */
export type ListFixture = {
  id: string;
  name: string;
  source: "internal" | "keycloak";
  /** A group's path. */
  description: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  recipients: { id: string; full_name: string; email: string; created_at: string; updated_at: string }[];
};

/** A send the mock opened, as the send routes read it back. */
type SendRecord = {
  id: string;
  created_at: string;
  template: Row;
  list: ListFixture | null;
  recipients: { full_name: string; email: string }[];
  body_variables: Record<string, unknown>;
};

const PLAUSIBLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ApprovalState = "pending" | "returned" | "approved" | "rejected" | "declined" | "expired";

type ApprovalChange = { field: "variable" | "template" | "audience"; name: string | null; before: unknown; after: unknown };

export type ApprovalEventRecord = {
  seq: number;
  kind: "submitted" | "resubmitted" | "edited" | "returned" | "accepted" | "declined" | "approved" | "rejected" | "expired";
  actor: { sub: string; name: string } | null;
  note: string | null;
  changes: ApprovalChange[];
  task_id: string | null;
  at: string;
};

/** A request for approval as the mock keeps it. */
export type ApprovalRecord = {
  id: string;
  state: ApprovalState;
  submitter: Person;
  templateId: string;
  /** The version published when it was last submitted. */
  versionId: string;
  listId: string | null;
  recipient: { full_name: string; email: string } | null;
  body_variables: Record<string, unknown>;
  created_at: string;
  submitted_at: string;
  deadline_at: string;
  updated_at: string;
  task_id: string | null;
  history: ApprovalEventRecord[];
};

type Decided = { kind: ApprovalEventRecord["kind"]; actor: Person | null; note?: string; changes?: ApprovalChange[] };

const WEEK = 7 * 24 * 3600_000;
const MAILER_FILLS = ["FullName", "Email"];

export const OTHER_OPERATOR: Author = { kind: "operator", sub: "1b7e2d94-3c5a-4f08-8e61-2d9c4a7b3f10", name: "Mehmet Kaya" };
export const TEMPLATE_SEED: Author = { kind: "template_seed", sub: null, name: "service-account-skymail-seed" };
const ME: Author = { kind: "operator", sub: VIEWER.sub, name: VIEWER.name };

type Content = Pick<Version, "name" | "subject" | "main_mode" | "jsx_source" | "visual_source" | "html_source" | "html_content" | "plain_text_content">;

const CONTENT_FIELDS = ["name", "subject", "main_mode", "jsx_source", "visual_source", "html_source", "html_content", "plain_text_content"] as const;

/** The server's template_jsx_source rule: code left once comments are removed. */
const hasCode = (text: string) => text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "").trim() !== "";

/** What an API route answers: a status, a JSON body if any, and headers such as X-Total-Count. */
export type Answer = { status: number; body?: unknown; headers?: Record<string, string> };

const refuse = (status: number, code: string, params?: Record<string, unknown>): Answer => ({
  status,
  body: { code, message: code, ...(params ? { params } : {}) },
});

const asFields = (body: unknown): Record<string, unknown> =>
  typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A JSON value as Postgres jsonb gives it back: object keys shorter first, then in byte order. */
function asJsonb(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(asJsonb);
  if (!isObject(value)) return value;
  const keys = Object.keys(value).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(keys.map((key) => [key, asJsonb(value[key])]));
}

const sourceOf = (content: Content, mode: Mode) =>
  mode === "jsx" ? content.jsx_source : mode === "html" ? content.html_source : content.visual_source;

export class MockSkymail {
  readonly requests: Recorded[] = [];
  private readonly rows = new Map<string, Row>();
  private readonly holds: HeldRequest[] = [];
  private readonly versions = new Map<string, Version>();
  private readonly lists = new Map<string, ListFixture>();
  private readonly sends = new Map<string, SendRecord>();
  private readonly singleRefusals = new Map<string, Answer>();
  private listRefusal: Answer | null = null;
  private readonly approvals = new Map<string, ApprovalRecord>();
  private readonly approvalRefusals = new Map<string, Answer>();
  private notificationProblem: string | null = null;
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
      seed_refusal: null,
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
   * Someone else publishes straight away — another operator's publish,
   * starting from what is published now, or a Template seed's, which starts
   * from nothing (only a forced seed names what it replaced).
   */
  publishAs(templateId: string, author: Author, changes: Partial<Content>): Version {
    const row = this.row(templateId);
    const current = this.version(row.published_version_id!);
    const base = author.kind === "template_seed" ? null : current.id;
    const version = this.write(templateId, author, base, { ...this.contentOf(current), ...changes });
    this.publish(version);
    return version;
  }

  /** A draft by `author`, started from what is published now. */
  addDraft(templateId: string, author: Author, changes: Partial<Content>): Version {
    const current = this.version(this.row(templateId).published_version_id!);
    return this.write(templateId, author, current.id, { ...this.contentOf(current), ...changes });
  }

  /** A Template seed refused for the template (ticket 09): the record the API keeps until a seed goes through. */
  refuseSeed(templateId: string, rules: string[], refusedAt = "2026-09-22T21:10:00Z") {
    this.row(templateId).seed_refusal = { refused_at: refusedAt, rules, payload_sha256: "e3".repeat(32) };
  }

  /** A mailing list: internal unless it is a Keycloak group, with its recipients. */
  addList(input: {
    name: string;
    source?: "internal" | "keycloak";
    groupPath?: string;
    recipients?: { full_name: string; email: string }[];
  }): string {
    const id = this.nextId("3f0c1a52");
    const at = this.now();
    this.lists.set(id, {
      id,
      name: input.name,
      source: input.source ?? "internal",
      description: input.groupPath ?? null,
      created_at: at,
      updated_at: at,
      archived_at: null,
      recipients: (input.recipients ?? []).map((recipient) => ({ id: this.nextId("5e1d7c00"), created_at: at, updated_at: at, ...recipient })),
    });
    return id;
  }

  /** The next single send to `email` gets this answer instead of opening. */
  refuseSingle(email: string, answer: Answer) {
    this.singleRefusals.set(email, answer);
  }

  /** The next send to a list gets this answer instead of opening. */
  refuseListSend(answer: Answer) {
    this.listRefusal = answer;
  }

  /** Archives a template behind the page's back. */
  archiveTemplate(id: string) {
    this.row(id).archived_at = this.now();
  }

  /**
   * A request for approval, submitted `submittedAgo` ago (23 hours by default)
   * with the version its template publishes now, then left in `state` by
   * `decided` — the approver's rejection, say. Its times are the real
   * clock's: the page counts its deadline from the browser's.
   */
  addApproval(input: {
    templateId: string;
    listId?: string;
    recipient?: { full_name: string; email: string };
    variables: Record<string, unknown>;
    submitter: Person;
    state?: ApprovalState;
    submittedAgo?: number;
    /** From now; seven days after submission by default. */
    deadlineIn?: number;
    /** What happened after the submission, in order: an approver's edit and its return, say. */
    decided?: Decided | Decided[];
  }): string {
    const id = this.nextId("5d1e7c2a");
    const submitted = Date.now() - (input.submittedAgo ?? 23 * 3600_000);
    const at = new Date(submitted).toISOString();
    const record: ApprovalRecord = {
      id,
      state: input.state ?? "pending",
      submitter: input.submitter,
      templateId: input.templateId,
      versionId: this.row(input.templateId).published_version_id!,
      listId: input.listId ?? null,
      recipient: input.recipient ?? null,
      body_variables: { ...input.variables },
      created_at: at,
      submitted_at: at,
      deadline_at: new Date(input.deadlineIn === undefined ? submitted + WEEK : Date.now() + input.deadlineIn).toISOString(),
      updated_at: at,
      task_id: null,
      history: [],
    };
    this.record(record, "submitted", input.submitter, { at });
    const decided = input.decided === undefined ? [] : Array.isArray(input.decided) ? input.decided : [input.decided];
    decided.forEach((event, index) =>
      this.record(record, event.kind, event.actor, {
        note: event.note ?? null,
        changes: event.changes ?? [],
        at: new Date(submitted + (index + 1) * 3600_000).toISOString(),
      }),
    );
    this.approvals.set(id, record);
    return id;
  }

  approval(id: string): ApprovalRecord {
    const record = this.approvals.get(id);
    if (!record) throw new Error(`no approval ${id}`);
    return record;
  }

  /** The next `action` (submit, resubmit, approve, return, reject, accept, decline) gets this answer instead. */
  refuseApproval(action: string, answer: Answer) {
    this.approvalRefusals.set(action, answer);
  }

  /** Every notification an approval action sends reports this problem. */
  failApprovalNotifications(problem: string | null) {
    this.notificationProblem = problem;
  }

  /** What the page asked of Mail onayı that writes, in order. */
  approvalRequests(): Recorded[] {
    return this.requests.filter((request) => request.method === "POST" && request.path.startsWith("/mail_approvals"));
  }

  /** The sends the page asked to open, in order. */
  sendRequests(): Recorded[] {
    return this.requests.filter((request) => request.method === "POST" && request.path.startsWith("/mail_tasks"));
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

  /** Holds the next `method` request to `path` (after the API base) at `stage`, until released. */
  hold(method: string, path: string, stage: "request" | "answer"): Hold {
    let reach = () => {};
    let release = () => {};
    const reached = new Promise<void>((resolve) => (reach = resolve));
    const gate = new Promise<void>((resolve) => (release = resolve));
    this.holds.push({ method, path, stage, used: false, reach, gate });
    return { reached, release };
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
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname.slice(new URL(E2E_API_URL).pathname.length);
    const held = this.holds.find((hold) => !hold.used && hold.method === method && hold.path === path);
    if (held) {
      held.used = true;
      held.reach();
      if (held.stage === "request") await held.gate;
    }
    const answer = this.respond({ method, path, search: url.search, body, authorization: request.headers().authorization, frameUrl });
    if (held?.stage === "answer") await held.gate;
    await route.fulfill({
      status: answer.status,
      contentType: "application/json",
      headers: answer.headers,
      body: answer.body === undefined ? "" : JSON.stringify(answer.body),
    });
  }

  /**
   * One request, answered: `path` is what follows the API base, `search` its
   * query string. The browser tests reach it through `attach`; the dev
   * server's stand-in API can serve it over HTTP.
   */
  respond(request: {
    method: string;
    path: string;
    search?: string;
    body: unknown;
    authorization?: string;
    frameUrl?: string;
  }): Answer {
    const { method, path, body } = request;
    const profile = (Object.keys(ROLES) as Profile[]).find((candidate) => request.authorization === `Bearer ${accessToken(candidate)}`);
    const authorized = profile !== undefined;
    this.requests.push({ method, path, body, authorized, frameUrl: request.frameUrl ?? "" });
    if (!profile) return refuse(401, "server.unauthorized");
    const can = (...roles: string[]) => roles.some((role) => (ROLES[profile] as readonly string[]).includes(role));
    const query = new URLSearchParams(request.search ?? "");

    if (path === "/mail_approvals" || path.startsWith("/mail_approvals/")) {
      return this.approvalRoute(method, path, body, query, personOf(profile), can("skymail:mails:approve"));
    }

    const templateMatch = /^\/templates\/([^/]+)$/.exec(path);
    const requiredMatch = /^\/templates\/([^/]+)\/required-variables(?:\/([^/]+))?$/.exec(path);
    const versionMatch = /^\/templates\/([^/]+)\/versions\/([^/]+)(?:\/(publish|discard|restore))?$/.exec(path);
    const historyMatch = /^\/templates\/([^/]+)\/versions$/.exec(path);
    const draftsMatch = /^\/templates\/([^/]+)\/drafts$/.exec(path);

    if (method === "GET" && path === "/templates") return this.templateList(query);
    if (method === "GET" && path === "/mailing_lists") return this.listPage(query);
    const listMatch = /^\/mailing_lists\/([^/]+)(\/recipients)?$/.exec(path);
    if (method === "GET" && listMatch) return this.listOrRecipients(listMatch[1], Boolean(listMatch[2]), query);
    if (method === "POST" && path === "/mail_tasks") {
      return can("skymail:mails:write") ? this.openListSend(asFields(body)) : refuse(403, "server.forbidden");
    }
    if (method === "POST" && path === "/mail_tasks/single") {
      return can("skymail:mails:send", "skymail:mails:write") ? this.openSingleSend(asFields(body)) : refuse(403, "server.forbidden");
    }
    if (method === "GET" && path === "/mail_tasks") {
      const sends = [...this.sends.keys()].reverse().map((id) => this.readSend(id, false).body);
      return this.page(sends, query);
    }
    const sendMatch = /^\/mail_tasks\/([^/]+)(\/queue)?$/.exec(path);
    if (method === "GET" && sendMatch) return this.readSend(sendMatch[1], Boolean(sendMatch[2]));

    if (method === "GET" && templateMatch) {
      // Every read of an archived template answers 404.
      const row = this.rows.get(templateMatch[1]);
      return row && row.archived_at === null ? { status: 200, body: this.served(row) } : refuse(404, "server.not_found");
    }
    if (method === "POST" && path === "/templates") return this.create(asFields(body));
    if (method === "GET" && historyMatch) return this.history(historyMatch[1], new URLSearchParams(request.search ?? ""));
    if (versionMatch) {
      const [, templateId, versionId, action] = versionMatch;
      const version = this.versions.get(versionId);
      if (!this.rows.has(templateId) || !version || version.template_id !== templateId) return refuse(404, "server.not_found");
      if (method === "GET" && !action) return { status: 200, body: this.full(version) };
      if (method === "POST" && action === "publish") return this.publishDraft(version, body);
      if (method === "POST" && action === "restore") return this.restore(version);
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

  private page<T>(items: T[], query: URLSearchParams, total = items.length): Answer {
    const start = Number(query.get("_start") ?? 0);
    const end = Number(query.get("_end") ?? start + 10);
    return { status: 200, body: items.slice(start, end), headers: { "X-Total-Count": String(total) } };
  }

  private templateList(query: URLSearchParams): Answer {
    const lifecycle = query.get("lifecycle") ?? "current";
    const rows = [...this.rows.values()].filter(
      (row) => lifecycle === "all" || (lifecycle === "inactive") === (row.archived_at !== null),
    );
    return this.page(rows.map((row) => this.served(row)), query);
  }

  /** Internal lists paged, every group on every page; X-Total-Count counts both. */
  private listPage(query: URLSearchParams): Answer {
    const current = [...this.lists.values()].filter((list) => list.archived_at === null);
    const internal = current.filter((list) => list.source === "internal");
    const groups = current.filter((list) => list.source === "keycloak");
    const start = Number(query.get("_start") ?? 0);
    const end = Number(query.get("_end") ?? start + 10);
    const shown = (list: ListFixture) => ({ ...list, recipients: undefined });
    return {
      status: 200,
      body: [...internal.slice(start, end), ...groups].map(shown),
      headers: { "X-Total-Count": String(internal.length + groups.length) },
    };
  }

  private listOrRecipients(id: string, recipients: boolean, query: URLSearchParams): Answer {
    const list = this.lists.get(id);
    if (!list || list.archived_at !== null) return refuse(404, "server.not_found");
    if (!recipients) return { status: 200, body: { ...list, recipients: undefined } };
    if (list.source === "keycloak") return { status: 200, body: list.recipients };
    return this.page(list.recipients, query);
  }

  private sendableTemplate(id: unknown): Row | null {
    const row = typeof id === "string" ? this.rows.get(id) : undefined;
    return row && row.archived_at === null ? row : null;
  }

  private open(template: Row, list: ListFixture | null, recipients: SendRecord["recipients"], body: Record<string, unknown>): Answer {
    const id = this.nextId("b1c2d3e4");
    const variables = asFields(body.body_variables);
    this.sends.set(id, { id, created_at: this.now(), template, list, recipients, body_variables: variables });
    return { status: 201, body: { id } };
  }

  private openListSend(body: Record<string, unknown>): Answer {
    if (this.listRefusal) {
      const refused = this.listRefusal;
      this.listRefusal = null;
      return refused;
    }
    const template = this.sendableTemplate(body.template_id);
    const list = typeof body.mail_list_id === "string" ? this.lists.get(body.mail_list_id) : undefined;
    if (!template || !list || list.archived_at !== null) return refuse(404, "server.not_found");
    if (list.source === "keycloak" && list.recipients.length === 0) return refuse(404, "server.not_found");
    return this.open(template, list, list.recipients, body);
  }

  private openSingleSend(body: Record<string, unknown>): Answer {
    const email = typeof body.recipient_email === "string" ? body.recipient_email : "";
    const refused = this.singleRefusals.get(email);
    if (refused) {
      this.singleRefusals.delete(email);
      return refused;
    }
    if (!PLAUSIBLE_EMAIL.test(email)) {
      return refuse(400, "validation.error", { errors: [{ field: "recipient_email", code: "invalid_email" }] });
    }
    const template = this.sendableTemplate(body.template_id);
    if (!template) return refuse(404, "server.not_found");
    const name = typeof body.recipient_full_name === "string" ? body.recipient_full_name : "";
    return this.open(template, null, [{ full_name: name, email }], body);
  }

  /** A send as the list, the detail and the summary give it (`Send`), or its recipients' queue. */
  private readSend(id: string, queue: boolean): Answer {
    const send = this.sends.get(id);
    if (!send) return refuse(404, "server.not_found");
    if (queue) {
      const rows = send.recipients.map((recipient, index) => ({
        id: `${send.id}-${index}`,
        recipient_full_name: recipient.full_name,
        recipient_email: recipient.email,
        status: { mail_queue_status: "pending", valid: true },
        error: null,
        attempts: 0,
        next_attempt_at: null,
        created_at: send.created_at,
      }));
      return { status: 200, body: rows, headers: { "X-Total-Count": String(rows.length) } };
    }
    const single = send.list === null ? send.recipients[0] : null;
    return {
      status: 200,
      body: {
        id: send.id,
        created_at: send.created_at,
        sent_by: VIEWER.sub,
        template_id: send.template.id,
        template_name: send.template.name,
        template_key: send.template.key,
        mail_list_id: send.list?.id ?? null,
        mail_list_name: send.list?.name ?? null,
        audience: {
          kind: send.list ? "mailing_list" : "single",
          mail_list_id: send.list?.id ?? null,
          name: send.list?.name ?? null,
          source: send.list?.source ?? null,
          recipient_full_name: single?.full_name ?? null,
          recipient_email: single?.email ?? null,
        },
        status: "sending",
        recipient_counts: { pending: send.recipients.length, processing: 0, sent: 0, failed: 0 },
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Mail onayı

  private record(
    record: ApprovalRecord,
    kind: ApprovalEventRecord["kind"],
    actor: Person | null,
    extra: { note?: string | null; changes?: ApprovalChange[]; task_id?: string | null; at?: string } = {},
  ) {
    const at = extra.at ?? new Date().toISOString();
    record.history.push({
      seq: record.history.length + 1,
      kind,
      actor: actor && { sub: actor.sub, name: actor.name },
      note: extra.note ?? null,
      changes: extra.changes ?? [],
      task_id: extra.task_id ?? null,
      at,
    });
    record.updated_at = at;
  }

  /** The state as the API reads it: pending or returned past the deadline is expired. */
  private stateOf(record: ApprovalRecord): ApprovalState {
    return (record.state === "pending" || record.state === "returned") && Date.parse(record.deadline_at) <= Date.now() ? "expired" : record.state;
  }

  private approvalView(record: ApprovalRecord, whole: boolean) {
    const row = this.row(record.templateId);
    const list = record.listId ? (this.lists.get(record.listId) ?? null) : null;
    const item = {
      id: record.id,
      state: this.stateOf(record),
      submitter: { sub: record.submitter.sub, name: record.submitter.name, email: record.submitter.email },
      template: {
        id: row.id,
        version_id: record.versionId,
        name: row.name,
        key: row.key,
        republished: row.published_version_id !== record.versionId,
      },
      audience: list
        ? { kind: "mailing_list", mail_list_id: list.id, name: list.name, source: list.source, recipient_full_name: null, recipient_email: null }
        : { kind: "single", mail_list_id: null, name: null, source: null, recipient_full_name: record.recipient!.full_name, recipient_email: record.recipient!.email },
      body_variables: record.body_variables,
      created_at: record.created_at,
      submitted_at: record.submitted_at,
      deadline_at: record.deadline_at,
      updated_at: record.updated_at,
      task_id: record.task_id,
      last_event: record.history.at(-1) ?? null,
    };
    if (!whole) return item;
    const version = this.version(record.versionId);
    const renderedFor = record.recipient ?? { full_name: record.submitter.name, email: record.submitter.email };
    const values = { ...record.body_variables, FullName: renderedFor.full_name, Email: renderedFor.email };
    return {
      ...item,
      recipient_count: list ? list.recipients.length : 1,
      preview: {
        subject: fillSampleValues(version.subject, values, { as: "text" }),
        html: fillSampleValues(version.html_content, values),
        plain_text: fillSampleValues(version.plain_text_content, values, { as: "text" }),
        rendered_for: renderedFor,
      },
      preview_error: null,
      history: record.history,
    };
  }

  private notified(templateKey: string) {
    return { template_key: templateKey, notified: this.notificationProblem ? 0 : 1, problem: this.notificationProblem };
  }

  /** A submission's body checked as the API checks it: the template, exactly one audience, the Required variables. */
  private checkSubmission(
    body: Record<string, unknown>,
  ): { ok: true; row: Row; list: ListFixture | null; recipient: ApprovalRecord["recipient"]; variables: Record<string, unknown> } | { ok: false; answer: Answer } {
    if (typeof body.template_id !== "string" || body.template_id === "") {
      return { ok: false, answer: refuse(400, "validation.error", { errors: [{ field: "template_id", code: "required" }] }) };
    }
    const row = this.sendableTemplate(body.template_id);
    if (!row || !row.published_version_id) return { ok: false, answer: refuse(422, "mail_approval.template_unavailable") };
    const listId = typeof body.mail_list_id === "string" && body.mail_list_id !== "" ? body.mail_list_id : null;
    const email = typeof body.recipient_email === "string" && body.recipient_email !== "" ? body.recipient_email : null;
    if ((listId === null) === (email === null)) {
      return { ok: false, answer: refuse(400, "validation.error", { errors: [{ field: "mail_list_id", code: "required_without" }] }) };
    }
    if (email !== null && !PLAUSIBLE_EMAIL.test(email)) {
      return { ok: false, answer: refuse(400, "validation.error", { errors: [{ field: "recipient_email", code: "invalid_email" }] }) };
    }
    const list = listId ? this.lists.get(listId) : null;
    if (listId && (!list || list.archived_at !== null)) return { ok: false, answer: refuse(422, "mail_approval.audience_unavailable") };
    const variables = asFields(body.body_variables);
    const missing = this.emptyRequired(row, variables);
    if (missing.length > 0) return { ok: false, answer: refuse(422, "mail_approval.required_variables_missing", { missing }) };
    const name = typeof body.recipient_full_name === "string" ? body.recipient_full_name : "";
    return { ok: true, row, list: list ?? null, recipient: email ? { full_name: name, email } : null, variables };
  }

  private emptyRequired(row: Row, variables: Record<string, unknown>) {
    return [
      ...row.contract_required_variables.map(({ name, reason }) => ({ name, source: "contract", reason })),
      ...row.operator_required_variables.map((name) => ({ name, source: "operator", reason: null })),
    ].filter(({ name }) => !MAILER_FILLS.includes(name) && (typeof variables[name] !== "string" || (variables[name] as string).trim() === ""));
  }

  private variableChanges(before: Record<string, unknown>, after: Record<string, unknown>): ApprovalChange[] {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter((name) => JSON.stringify(before[name] ?? null) !== JSON.stringify(after[name] ?? null))
      .map((name) => ({ field: "variable" as const, name, before: before[name] ?? null, after: after[name] ?? null }));
  }

  /** Opens the send an approval or an acceptance queues. */
  private sendOf(record: ApprovalRecord): string {
    const list = record.listId ? this.lists.get(record.listId)! : null;
    const recipients = list ? list.recipients : [record.recipient!];
    const answer = this.open(this.row(record.templateId), list, recipients, { body_variables: record.body_variables });
    return (answer.body as { id: string }).id;
  }

  private approvalRoute(method: string, path: string, body: unknown, query: URLSearchParams, caller: Person, approver: boolean): Answer {
    const fields = asFields(body);
    const refused = (action: string) => {
      const answer = this.approvalRefusals.get(action);
      if (answer) this.approvalRefusals.delete(action);
      return answer ?? null;
    };

    if (path === "/mail_approvals" && method === "POST") {
      const early = refused("submit");
      if (early) return early;
      const check = this.checkSubmission(fields);
      if (!check.ok) return check.answer;
      const now = Date.now();
      const at = new Date(now).toISOString();
      const record: ApprovalRecord = {
        id: this.nextId("5d1e7c2a"),
        state: "pending",
        submitter: caller,
        templateId: check.row.id,
        versionId: check.row.published_version_id!,
        listId: check.list?.id ?? null,
        recipient: check.recipient,
        body_variables: check.variables,
        created_at: at,
        submitted_at: at,
        deadline_at: new Date(now + WEEK).toISOString(),
        updated_at: at,
        task_id: null,
        history: [],
      };
      this.record(record, "submitted", caller, { at });
      this.approvals.set(record.id, record);
      return { status: 201, body: { ...this.approvalView(record, true), notification: this.notified("mail.approval-requested") } };
    }

    if (path === "/mail_approvals" && method === "GET") {
      const state = query.get("state");
      if (state && !["pending", "returned", "approved", "rejected", "declined", "expired"].includes(state)) {
        return refuse(400, "validation.error", { errors: [{ field: "state", code: "oneof" }] });
      }
      const own = !approver || query.get("mine") === "true";
      const listed = [...this.approvals.values()]
        .filter((record) => !own || record.submitter.sub === caller.sub)
        .filter((record) => !state || this.stateOf(record) === state)
        .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
        .map((record) => this.approvalView(record, false));
      return this.page(listed, query);
    }

    const match = /^\/mail_approvals\/([^/]+)(?:\/(approve|return|reject|accept|decline|resubmit))?$/.exec(path);
    if (!match) return refuse(404, "server.not_found");
    const [, id, action] = match;
    const record = this.approvals.get(id);
    if (!record || (!approver && record.submitter.sub !== caller.sub)) return refuse(404, "server.not_found");
    if (method === "GET" && !action) return { status: 200, body: this.approvalView(record, true) };
    if (method !== "POST" || !action) return refuse(405, "server.method_not_allowed");

    const approverAction = ["approve", "return", "reject"].includes(action);
    if (approverAction && !approver) return refuse(403, "server.forbidden");
    if (!approverAction && record.submitter.sub !== caller.sub) return refuse(403, "mail_approval.not_submitter");
    const early = refused(action);
    if (early) return early;

    const state = this.stateOf(record);
    const allowed = approverAction ? ["pending"] : action === "resubmit" ? ["rejected", "declined"] : ["returned"];
    if (state === "expired" && record.state !== "expired" && action !== "resubmit") {
      record.state = "expired";
      this.record(record, "expired", null);
      return refuse(409, "mail_approval.expired", { deadline_at: record.deadline_at });
    }
    if (action === "approve" && state === "approved" && fields.body_variables === undefined) {
      return { status: 200, body: this.approvalView(record, true) };
    }
    if (!allowed.includes(state)) return refuse(409, "mail_approval.state_conflict", { state, allowed });
    const row = this.row(record.templateId);
    const republished = row.published_version_id !== record.versionId;
    if ((action === "approve" || action === "accept") && republished) {
      return refuse(409, "mail_approval.template_republished", {
        submitted_version_id: record.versionId,
        published_version_id: row.published_version_id,
      });
    }
    const note = typeof fields.note === "string" && fields.note.trim() !== "" ? fields.note : null;
    const resolved = () => ({ status: 200, body: { ...this.approvalView(record, true), notification: this.notified("mail.approval-resolved") } });

    /** An approver's edit, recorded; or what refuses it. */
    const edit = (): Answer | null => {
      const variables = asFields(fields.body_variables);
      const missing = this.emptyRequired(row, variables);
      if (missing.length > 0) return refuse(422, "mail_approval.required_variables_missing", { missing });
      const changes = this.variableChanges(record.body_variables, variables);
      if (changes.length === 0) return action === "return" ? refuse(422, "mail_approval.no_edit") : null;
      record.body_variables = variables;
      this.record(record, "edited", caller, { changes });
      return null;
    };

    switch (action) {
      case "approve": {
        if (fields.body_variables !== undefined) {
          const refusal = edit();
          if (refusal) return refusal;
        }
        record.task_id = this.sendOf(record);
        record.state = "approved";
        this.record(record, "approved", caller, { note, task_id: record.task_id });
        return resolved();
      }
      case "return": {
        if (!isObject(fields.body_variables)) return refuse(400, "validation.error", { errors: [{ field: "body_variables", code: "required" }] });
        const refusal = edit();
        if (refusal) return refusal;
        record.state = "returned";
        record.deadline_at = new Date(Date.now() + WEEK).toISOString();
        this.record(record, "returned", caller, { note });
        return resolved();
      }
      case "reject": {
        if (typeof fields.reason !== "string" || fields.reason.trim() === "") {
          return refuse(400, "validation.error", { errors: [{ field: "reason", code: "required" }] });
        }
        record.state = "rejected";
        this.record(record, "rejected", caller, { note: fields.reason });
        return resolved();
      }
      case "accept": {
        record.task_id = this.sendOf(record);
        record.state = "approved";
        this.record(record, "accepted", caller, { task_id: record.task_id });
        return resolved();
      }
      case "decline": {
        record.state = "declined";
        this.record(record, "declined", caller, { note });
        return { status: 200, body: this.approvalView(record, true) };
      }
      default: {
        const check = this.checkSubmission(fields);
        if (!check.ok) return check.answer;
        const changes: ApprovalChange[] = [];
        if (check.row.id !== record.templateId || check.row.published_version_id !== record.versionId) {
          changes.push({
            field: "template",
            name: null,
            before: { id: record.templateId, version_id: record.versionId },
            after: { id: check.row.id, version_id: check.row.published_version_id },
          });
        }
        const audienceBefore = record.listId ? { mail_list_id: record.listId } : { ...record.recipient };
        const audienceAfter = check.list ? { mail_list_id: check.list.id } : { ...check.recipient };
        if (JSON.stringify(audienceBefore) !== JSON.stringify(audienceAfter)) {
          changes.push({ field: "audience", name: null, before: audienceBefore, after: audienceAfter });
        }
        changes.push(...this.variableChanges(record.body_variables, check.variables));
        Object.assign(record, {
          state: "pending",
          templateId: check.row.id,
          versionId: check.row.published_version_id!,
          listId: check.list?.id ?? null,
          recipient: check.recipient,
          body_variables: check.variables,
          submitted_at: new Date().toISOString(),
          deadline_at: new Date(Date.now() + WEEK).toISOString(),
        });
        this.record(record, "resubmitted", caller, { changes });
        return { status: 200, body: { ...this.approvalView(record, true), notification: this.notified("mail.approval-requested") } };
      }
    }
  }

  private saveDraft(templateId: string, body: Record<string, unknown>): Answer {
    if (!this.rows.has(templateId)) return refuse(404, "server.not_found");
    const missing = (["subject", "main_mode", "html_content", "plain_text_content"] as const).filter(
      (field) => typeof body[field] !== "string" || (body[field] as string).trim() === "",
    );
    if (missing.length > 0) return refuse(400, "validation.error", { errors: missing.map((field) => ({ field, code: "required" })) });

    if (body.visual_source !== undefined && body.visual_source !== null && !isObject(body.visual_source)) {
      return refuse(400, "validation.error", { errors: [{ field: "visual_source", code: "invalid" }] });
    }

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
      visual_source: isObject(body.visual_source) ? asJsonb(body.visual_source) : continued.visual_source,
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

  /** A template the two routes act on: an archived one is as good as unknown. */
  private inUse(templateId: string): Row | null {
    const row = this.rows.get(templateId);
    return row && row.archived_at === null ? row : null;
  }

  private markRequired(templateId: string, name: unknown): Answer {
    const row = this.inUse(templateId);
    if (!row) return refuse(404, "server.not_found");
    if (typeof name !== "string" || !isVariableName(name)) {
      return refuse(400, "validation.error", { errors: [{ field: "name", code: "invalid_variable_name" }] });
    }
    // One the contract holds is required already, and stays the contract's.
    const inContract = row.contract_required_variables.some((variable) => variable.name === name);
    const operator =
      inContract || row.operator_required_variables.includes(name)
        ? row.operator_required_variables
        : [...row.operator_required_variables, name].sort();
    // The published body must reference every Required variable, the new one too.
    const missing = this.missingRequired(templateId, row.html_content, operator);
    if (missing.length > 0) return refuse(422, "template.required_variables_missing", { missing });
    row.operator_required_variables = operator;
    return { status: 200, body: this.served(row) };
  }

  private releaseRequired(templateId: string, name: string): Answer {
    const row = this.inUse(templateId);
    if (!row) return refuse(404, "server.not_found");
    if (!isVariableName(name)) return refuse(400, "template.invalid_variable_name");
    if (row.contract_required_variables.some((variable) => variable.name === name)) {
      return refuse(409, "template.required_variable_in_contract", { name });
    }
    row.operator_required_variables = row.operator_required_variables.filter((marked) => marked !== name);
    return { status: 200, body: this.served(row) };
  }

  /** A page of the history, newest first: `state` published|draft|all, `_start`/`_end`, the total in X-Total-Count. */
  private history(templateId: string, query: URLSearchParams): Answer {
    if (!this.rows.has(templateId)) return refuse(404, "server.not_found");
    const state = query.get("state") ?? "all";
    if (!["all", "published", "draft"].includes(state)) {
      return refuse(400, "validation.error", { errors: [{ field: "state", code: "oneof" }] });
    }
    const listed = this.versionsOf(templateId).filter(
      (version) => state === "all" || (state === "published") === (version.published_at !== null),
    );
    const start = Number(query.get("_start") ?? 0);
    const end = Number(query.get("_end") ?? start + 10);
    return {
      status: 200,
      body: listed.slice(start, end).map((version) => this.summary(version)),
      headers: { "X-Total-Count": String(listed.length) },
    };
  }

  /**
   * Any version, copied into a new draft by the caller, started from what is
   * published now; checked as a saved draft is. A copy that would repeat the
   * version it continues writes nothing and answers that version with 200.
   */
  private restore(version: Version): Answer {
    const row = this.row(version.template_id);
    const published = this.version(row.published_version_id!);
    const mine = this.drafts(row.id).find((draft) => draft.author.sub === ME.sub);
    const continued = mine && mine.base_version_id === published.id ? mine : published;
    const content = this.contentOf(version);
    const missingVariables = this.missingRequired(row.id, content.html_content);
    if (missingVariables.length > 0) return refuse(422, "template.required_variables_missing", { missing: missingVariables });
    const before = this.contentOf(continued);
    if (CONTENT_FIELDS.every((field) => JSON.stringify(before[field]) === JSON.stringify(content[field]))) {
      return { status: 200, body: this.full(continued) };
    }
    return { status: 201, body: this.full(this.write(row.id, ME, published.id, content)) };
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
