/**
 * The Mail template list as the operator sees it, driven through the one HTTP
 * client with a scripted fetch that answers the way skymail-backend's template
 * routes do (`GET /templates` with `main_mode` and `drafts` since ticket 07,
 * `DELETE /templates/{id}`, `POST /templates/{id}/restore`): which request the
 * list sends, and which rows, markers and actions come out of the answer.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TEST_BASE_URL, json, scriptedClient, type RecordedCall } from "./api/testing";
import {
  TEMPLATE_PAGE_SIZE,
  archiveTemplate,
  fetchTemplatePage,
  isSystemArchiveRefusal,
  mainSourceLabel,
  restoreTemplate,
  templateActions,
  templateHref,
  toTemplateRow,
  type AuthoringMode,
  type MailTemplate,
  type TemplateVersionSummary,
} from "./templates";

function answer(status: number, body: unknown, total?: number): Response {
  return json(status, body, total === undefined ? {} : { "X-Total-Count": String(total) });
}

/** The path a request went to, after the API base. */
const pathOf = (call: RecordedCall) => call.url.slice(TEST_BASE_URL.length);

const ID = {
  welcome: "11111111-1111-4111-8111-111111111111",
  newsletter: "22222222-2222-4222-8222-222222222222",
  published: "33333333-3333-4333-8333-333333333333",
  draftA: "44444444-4444-4444-8444-444444444444",
  draftB: "55555555-5555-4555-8555-555555555555",
};

const VIEWER = "f3b1c7aa-0000-4000-8000-000000000001";
const OTHER = "f3b1c7aa-0000-4000-8000-000000000002";

function template(overrides: Partial<MailTemplate> = {}): MailTemplate {
  return {
    id: ID.newsletter,
    name: "Aylık bülten",
    key: null,
    subject: "{{.Month}} bülteni",
    system: false,
    html_content: "<p>Merhaba</p>",
    plain_text_content: "Merhaba",
    react_email_content: "",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    archived_at: null,
    archived_by: null,
    published_version_id: ID.published,
    main_mode: "html",
    drafts: [],
    ...overrides,
  };
}

function systemTemplate(overrides: Partial<MailTemplate> = {}): MailTemplate {
  return template({
    id: ID.welcome,
    name: "Hoş geldin",
    key: "core.welcome",
    subject: "SKY LAB'e hoş geldin, {{.FirstName}}",
    system: true,
    main_mode: "jsx",
    ...overrides,
  });
}

function draft(id: string, author: { sub: string | null; name: string | null }, createdAt: string): TemplateVersionSummary {
  return {
    id,
    template_id: ID.newsletter,
    seq: 2,
    subject: "{{.Month}} bülteni",
    requested_subject: null,
    main_mode: "html",
    author: { kind: "operator", ...author },
    created_at: createdAt,
    published_at: null,
    base_version_id: ID.published,
    current: false,
    discarded: false,
  };
}

describe("a row of the Mail template list", () => {
  it("shows the name, Template key, subject and whether it is a System template", () => {
    const row = toTemplateRow(systemTemplate(), VIEWER);

    assert.equal(row.id, ID.welcome);
    assert.equal(row.name, "Hoş geldin");
    assert.equal(row.key, "core.welcome");
    assert.equal(row.subject, "SKY LAB'e hoş geldin, {{.FirstName}}");
    assert.equal(row.system, true);
    assert.equal(row.archivedAt, null);
  });

  it("has no Template key for a template no service addresses", () => {
    const row = toTemplateRow(template(), VIEWER);

    assert.equal(row.key, null);
    assert.equal(row.system, false);
  });

  it("carries the Authoring mode of the Main source", () => {
    assert.equal(toTemplateRow(template({ main_mode: "jsx" }), VIEWER).mainSource, "jsx");
    assert.equal(toTemplateRow(template({ main_mode: "visual" }), VIEWER).mainSource, "visual");
    assert.equal(toTemplateRow(template({ main_mode: "html" }), VIEWER).mainSource, "html");
  });

  it("names the Authoring modes as the glossary does, and nothing it cannot name", () => {
    assert.equal(mainSourceLabel("jsx"), "JSX");
    assert.equal(mainSourceLabel("visual"), "Visual");
    assert.equal(mainSourceLabel("html"), "HTML");
    assert.equal(mainSourceLabel(null), "—");
  });

  // Null for a template with no published version: nothing is sent yet.
  it("has no Main source when nothing is published", () => {
    assert.equal(toTemplateRow(template({ main_mode: null, published_version_id: null }), VIEWER).mainSource, null);
  });

  // A mode a newer backend adds must not show as a blank or a wrong mode.
  it("has no Main source it can name for a mode it does not know", () => {
    const row = toTemplateRow(template({ main_mode: "mjml" as unknown as AuthoringMode }), VIEWER);

    assert.equal(row.mainSource, null);
  });

  // A backend before ticket 07 serves neither main_mode nor drafts.
  it("shows a template from a backend that sends no Main source or drafts", () => {
    const older = template();
    delete older.main_mode;
    delete older.drafts;

    const row = toTemplateRow(older, VIEWER);

    assert.equal(row.mainSource, null);
    assert.equal(row.drafts, null);
    assert.equal(row.name, "Aylık bülten");
  });

  it("carries the time an archived template was archived", () => {
    const row = toTemplateRow(template({ archived_at: "2026-09-20T08:30:00Z", archived_by: OTHER }), VIEWER);

    assert.equal(row.archivedAt, "2026-09-20T08:30:00Z");
  });
});

describe("the unpublished-draft indicator", () => {
  it("is absent when no operator has a draft in progress", () => {
    assert.equal(toTemplateRow(template(), VIEWER).drafts, null);
  });

  it("names the one operator who has a draft", () => {
    const row = toTemplateRow(
      template({ drafts: [draft(ID.draftA, { sub: OTHER, name: "Mehmet Kaya" }, "2026-09-22T11:05:00Z")] }),
      VIEWER,
    );

    assert.deepEqual(row.drafts, {
      summary: "Mehmet Kaya",
      mine: false,
      authors: [{ versionId: ID.draftA, name: "Mehmet Kaya", mine: false, writtenAt: "2026-09-22T11:05:00Z" }],
    });
  });

  // The viewer is recognised by their Keycloak subject, which is what the API
  // records as the author; a name can be shared or changed.
  it("marks the viewer's own draft as theirs", () => {
    const row = toTemplateRow(
      template({ drafts: [draft(ID.draftA, { sub: VIEWER, name: "Ayşe Yılmaz" }, "2026-09-22T11:05:00Z")] }),
      VIEWER,
    );

    assert.equal(row.drafts?.summary, "Ayşe Yılmaz");
    assert.equal(row.drafts?.mine, true);
    assert.equal(row.drafts?.authors[0].mine, true);
  });

  it("counts several drafts, keeps every author newest first, and says whether one is the viewer's", () => {
    const row = toTemplateRow(
      template({
        drafts: [
          draft(ID.draftB, { sub: OTHER, name: "Mehmet Kaya" }, "2026-09-22T15:40:00Z"),
          draft(ID.draftA, { sub: VIEWER, name: "Ayşe Yılmaz" }, "2026-09-21T09:00:00Z"),
        ],
      }),
      VIEWER,
    );

    assert.equal(row.drafts?.summary, "2 taslak");
    assert.equal(row.drafts?.mine, true);
    assert.deepEqual(
      row.drafts?.authors.map((author) => [author.name, author.mine]),
      [
        ["Mehmet Kaya", false],
        ["Ayşe Yılmaz", true],
      ],
    );
  });

  it("does not call a draft the viewer's when the session carries no subject", () => {
    const row = toTemplateRow(
      template({ drafts: [draft(ID.draftA, { sub: null, name: "Ayşe Yılmaz" }, "2026-09-22T11:05:00Z")] }),
      null,
    );

    assert.equal(row.drafts?.mine, false);
  });

  it("still shows a draft whose author's name is not known", () => {
    const row = toTemplateRow(
      template({ drafts: [draft(ID.draftA, { sub: OTHER, name: "  " }, "2026-09-22T11:05:00Z")] }),
      VIEWER,
    );

    assert.equal(row.drafts?.summary, "Adı bilinmeyen operatör");
  });
});

describe("what a row allows", () => {
  const READER = ["skymail:access", "skymail:templates:read"];
  const WRITER = [...READER, "skymail:templates:write"];

  const current = toTemplateRow(template(), VIEWER);
  const system = toTemplateRow(systemTemplate(), VIEWER);
  const archived = toTemplateRow(template({ archived_at: "2026-09-20T08:30:00Z" }), VIEWER);

  const allowed = (actions: ReturnType<typeof templateActions>) =>
    Object.entries(actions)
      .filter(([, value]) => value === true)
      .map(([name]) => name)
      .sort();

  it("lets a writer open a template in the editor, and archive it", () => {
    const actions = templateActions(current, WRITER);

    assert.equal(actions.href, `/templates/edit/${ID.newsletter}`);
    assert.deepEqual(allowed(actions), ["archive"]);
  });

  // The API refuses it (409 template.system_protected); the row does not
  // offer what would be refused, and says why.
  it("never offers to archive a System template, and says why to every viewer", () => {
    assert.deepEqual(allowed(templateActions(system, WRITER)), ["systemNote"]);
    assert.equal(templateActions(system, WRITER).href, `/templates/edit/${ID.welcome}`);
    assert.deepEqual(allowed(templateActions(system, READER)), ["systemNote"]);
  });

  // Every read of an archived template answers 404, so it does not open.
  it("lets a writer only restore an archived template", () => {
    const actions = templateActions(archived, WRITER);

    assert.equal(actions.href, null);
    assert.deepEqual(allowed(actions), ["restore"]);
  });

  it("restores an archived System template like any other", () => {
    const archivedSystem = toTemplateRow(systemTemplate({ archived_at: "2026-09-20T08:30:00Z" }), VIEWER);

    assert.deepEqual(allowed(templateActions(archivedSystem, WRITER)), ["restore"]);
  });

  it("opens a template read-only for a reader and offers nothing that writes", () => {
    const actions = templateActions(current, READER);

    assert.equal(actions.href, `/templates/show/${ID.newsletter}`);
    assert.deepEqual(allowed(actions), []);
    assert.deepEqual(allowed(templateActions(archived, READER)), []);
  });

  it("offers nothing that writes without skymail:access, whatever else the token carries", () => {
    const actions = templateActions(current, ["skymail:templates:read", "skymail:templates:write"]);

    assert.deepEqual(allowed(actions), []);
    assert.equal(actions.href, `/templates/show/${ID.newsletter}`);
  });
});

describe("the addresses", () => {
  it("keep today's paths", () => {
    assert.equal(templateHref.index, "/templates");
    assert.equal(templateHref.create, "/templates/create");
    assert.equal(templateHref.edit(ID.welcome), `/templates/edit/${ID.welcome}`);
    assert.equal(templateHref.show(ID.welcome), `/templates/show/${ID.welcome}`);
  });
});

describe("a page of the list", () => {
  it("asks for the filter and the page's slice", async () => {
    const { api, calls } = scriptedClient(answer(200, [], 0));

    await fetchTemplatePage(api, { lifecycle: "inactive", page: 2 });

    assert.equal(
      pathOf(calls[0]),
      `/templates?lifecycle=inactive&_start=${TEMPLATE_PAGE_SIZE}&_end=${2 * TEMPLATE_PAGE_SIZE}`,
    );
  });

  it("asks for every template under Hepsi", async () => {
    const { api, calls } = scriptedClient(answer(200, [], 0));

    await fetchTemplatePage(api, { lifecycle: "all", page: 1 });

    assert.equal(pathOf(calls[0]), `/templates?lifecycle=all&_start=0&_end=${TEMPLATE_PAGE_SIZE}`);
  });

  it("hands over the templates and the API's total", async () => {
    const { api } = scriptedClient(answer(200, [systemTemplate(), template()], 12));

    const page = await fetchTemplatePage(api, { lifecycle: "current", page: 1 });

    assert.deepEqual(
      page.templates.map((item) => item.name),
      ["Hoş geldin", "Aylık bülten"],
    );
    assert.equal(page.total, 12);
  });

  it("counts what came back when the answer has no total", async () => {
    const { api } = scriptedClient(answer(200, [template()]));

    const page = await fetchTemplatePage(api, { lifecycle: "current", page: 2 });

    assert.equal(page.total, TEMPLATE_PAGE_SIZE + 1);
  });
});

describe("archiving and restoring", () => {
  // Archiving answers 204 with no body; that is a success.
  it("archives a template with DELETE and succeeds on 204", async () => {
    const { api, calls } = scriptedClient(new Response(null, { status: 204 }));

    await archiveTemplate(api, ID.newsletter);

    assert.deepEqual([calls[0].method, pathOf(calls[0])], ["DELETE", `/templates/${ID.newsletter}`]);
  });

  it("says in Turkish why a System template is not archived", async () => {
    const { api } = scriptedClient(
      answer(409, { code: "template.system_protected", message: "System templates cannot be archived." }),
    );

    const error = await archiveTemplate(api, ID.welcome).catch((reason: unknown) => reason);

    assert.equal(isSystemArchiveRefusal(error), true);
    assert.equal(
      (error as Error).message,
      "System template arşivlenemez: başka bir servis bu maili Template key ile gönderiyor.",
    );
  });

  it("tells a System refusal apart from other failures", async () => {
    const { api } = scriptedClient(answer(404, { code: "server.not_found", message: "Not found." }));

    const error = await archiveTemplate(api, ID.newsletter).catch((reason: unknown) => reason);

    assert.equal(isSystemArchiveRefusal(error), false);
    assert.equal(isSystemArchiveRefusal(new Error("boom")), false);
  });

  it("restores an archived template", async () => {
    const { api, calls } = scriptedClient(answer(200, template()));

    const restored = await restoreTemplate(api, ID.newsletter);

    assert.deepEqual([calls[0].method, pathOf(calls[0])], ["POST", `/templates/${ID.newsletter}/restore`]);
    assert.equal(restored.id, ID.newsletter);
  });
});
