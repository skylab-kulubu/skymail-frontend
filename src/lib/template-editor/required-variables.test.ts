/**
 * The Required variable panel (ticket 13) over ticket 08's API: which
 * variables it shows locked, which it lets the operator release or mark, what
 * it says of a variable only the draft references, and which Required
 * variable it warns the edited body no longer references — before the server,
 * which stays the authority, refuses the save.
 *
 * Bodies are read with the render module's own rule (referencedVariables), and
 * the edited body comes from real renders, so the cases the server counts —
 * a conditional section, `$.X` in a range, an HTML comment — are the ones
 * checked here.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TEST_BASE_URL, json, scriptedClient } from "../api/testing";
import { renderSource } from "../mail-render";
import { markRequiredVariable, releaseRequiredVariable, type MailTemplate, type TemplateVersion } from "../templates";
import { storedFromVersion, type EditorState } from "./editor-state";
import { versionProblem, type VersionProblem } from "./refusals";
import {
  editorBody,
  isVariableName,
  requiredPanel,
  requiredSetsOf,
  requiredVariableProblem,
  type EditorBody,
  type RequiredSets,
} from "./required-variables";

const ID = "7e3a1c00-0000-4000-8000-000000000001";
const PUBLISHED = "9a1b2c00-0000-4000-8000-000000000001";
const RESET_REASON = "Parola sıfırlama bağlantısı; kaldırılırsa kişi parolasını sıfırlayamaz ve mail işe yaramaz.";

/** What is sent: the link, a first name, a conditional username, an event name from inside a range. */
const PUBLISHED_HTML = [
  "<p>Merhaba {{.firstName}},</p>",
  '<a href="{{.link}}">Yeni Parola Belirle</a>',
  "{{if .username}}<p>Kullanıcı adın: {{.username}}</p>{{end}}",
  "{{range .Items}}<p>{{.Title}} · {{$.EventName}}</p>{{end}}",
  "<!-- {{.Hidden}} -->",
  "<p>{{.İsim}}</p>",
].join("\n");

function template(overrides: Partial<MailTemplate> = {}): MailTemplate {
  return {
    id: ID,
    name: "Keycloak · Parola Sıfırlama",
    key: "keycloak.reset-password",
    subject: "SKY LAB parola sıfırlama isteği",
    system: true,
    html_content: PUBLISHED_HTML,
    plain_text_content: "Merhaba",
    react_email_content: "",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-20T10:00:00Z",
    archived_at: null,
    archived_by: null,
    published_version_id: PUBLISHED,
    main_mode: "html",
    drafts: [],
    contract_required_variables: [{ name: "link", reason: RESET_REASON }],
    operator_required_variables: ["firstName"],
    ...overrides,
  };
}

function version(html: string, draft = false): TemplateVersion {
  return {
    id: PUBLISHED,
    template_id: ID,
    seq: 3,
    subject: "SKY LAB parola sıfırlama isteği",
    requested_subject: null,
    main_mode: "html",
    author: { kind: "template_seed", sub: null, name: null },
    created_at: "2026-09-20T10:00:00Z",
    published_at: draft ? null : "2026-09-20T10:00:00Z",
    base_version_id: null,
    current: !draft,
    discarded: false,
    name: "Keycloak · Parola Sıfırlama",
    jsx_source: null,
    visual_source: null,
    html_source: html,
    html_content: html,
    plain_text_content: "Merhaba",
  };
}

/**
 * The editor with a version open — the published one, or else the viewer's
 * draft holding `opened` — edited to `edited`, rendered or not yet.
 */
async function editorWith(
  edited: string,
  { rendered = true, draft = false, opened = PUBLISHED_HTML }: { rendered?: boolean; draft?: boolean; opened?: string } = {},
): Promise<EditorState> {
  const stored = storedFromVersion(version(opened, draft), "Keycloak · Parola Sıfırlama");
  const renders = rendered ? { html: await renderSource({ mode: "html", source: edited }) } : {};
  return { editing: { ...stored, sources: { html: edited } }, renders, stored };
}

const sets = (): RequiredSets => requiredSetsOf(template())!;
const writer = (body: EditorBody | null, problem: VersionProblem | null = null) =>
  requiredPanel({ sets: sets(), body, problem, canWrite: true });
/** The published body with a part of it cut or replaced. */
const without = (part: string, instead = "") => PUBLISHED_HTML.replace(part, instead);
const LINK = '<a href="{{.link}}">Yeni Parola Belirle</a>';
const USERNAME = "{{if .username}}<p>Kullanıcı adın: {{.username}}</p>{{end}}";

describe("the Required variables the panel shows", () => {
  it("shows the contract's locked, with the reason the repo gives, and never offers to release them", () => {
    const [link] = writer(null).rows;
    assert.deepEqual(link, { name: "link", source: "contract", why: RESET_REASON, locked: true, removable: false, state: "kept" });
  });

  it("keeps a contract reason the server sent as null, and says the contract is why", () => {
    const sets = requiredSetsOf(template({ contract_required_variables: [{ name: "code", reason: null }] }))!;
    assert.deepEqual(sets.contract, [{ name: "code", reason: null }]);
    const panel = requiredPanel({ sets, body: null, canWrite: true });
    assert.equal(panel.rows[0].why, "Gönderen servisin sözleşmesi bu değişkeni istiyor.");
  });

  it("lets a writer release only what operators marked", () => {
    assert.deepEqual(
      writer(null).rows.map(({ name, locked, removable }) => ({ name, locked, removable })),
      [
        { name: "link", locked: true, removable: false },
        { name: "firstName", locked: false, removable: true },
      ],
    );
    assert.equal(writer(null).rows[1].why, "Bir operatör bu değişkeni zorunlu işaretledi.");
  });

  it("offers a reader nothing to release or mark", () => {
    const panel = requiredPanel({ sets: sets(), body: null, canWrite: false });
    assert.deepEqual(
      panel.rows.map(({ name, removable }) => ({ name, removable })),
      [
        { name: "link", removable: false },
        { name: "firstName", removable: false },
      ],
    );
    assert.deepEqual(panel.candidates, []);
    assert.deepEqual(panel.draftOnly, []);
  });

  it("is nothing for a backend before ticket 08, which has no Required variables to show", () => {
    assert.equal(
      requiredSetsOf(template({ contract_required_variables: undefined, operator_required_variables: undefined })),
      null,
    );
  });
});

describe("the body the panel reads", () => {
  it("is the Main source's render, with the variables the render module gave it", async () => {
    const state = await editorWith(without(LINK));
    const render = state.renders.html!;
    assert.ok(render.ok);
    const marked = { ...state, renders: { html: { ...render, variables: ["FromTheRender"] } } };
    assert.deepEqual(editorBody(marked), { variables: ["FromTheRender"], kind: "edited" });
  });

  it("is the stored body while the Main source is untouched and has no render", async () => {
    assert.deepEqual(editorBody(await editorWith(PUBLISHED_HTML, { rendered: false })), {
      variables: ["EventName", "Items", "firstName", "link", "username", "İsim"],
      kind: "published",
    });
  });

  it("is the saved draft while the operator has not touched it", async () => {
    const draft = without(LINK);
    assert.equal(editorBody(await editorWith(draft, { draft: true, opened: draft }))?.kind, "draft");
    assert.equal(editorBody(await editorWith(PUBLISHED_HTML, { draft: true, opened: draft }))?.kind, "edited");
  });

  it("is not known while the edited source has no render yet", async () => {
    assert.equal(editorBody(await editorWith(without("{{.link}}"), { rendered: false })), null);
  });
});

describe("what an operator may mark", () => {
  it("is what the published body references, as the server counts it, less what is required already", () => {
    // link and firstName are required; the element's Title, the commented
    // Hidden and the non-ASCII İsim are not variables the server would take.
    assert.deepEqual(
      writer(null).candidates.map((candidate) => candidate.name),
      ["EventName", "Items", "username"],
    );
  });

  it("flags one the body no longer references, before the operator marks it", async () => {
    const panel = writer(editorBody(await editorWith(without(USERNAME))));
    assert.deepEqual(panel.candidates, [
      { name: "EventName", dropped: false },
      { name: "Items", dropped: false },
      { name: "username", dropped: true },
    ]);
    assert.ok(writer(null).candidates.every((candidate) => !candidate.dropped));
  });

  it("names a variable only the edited body references, which can be marked once published", async () => {
    const edited = `${PUBLISHED_HTML}\n{{if .EventUrl}}<a href="{{.EventUrl}}">Etkinlik</a>{{end}}\n<!-- {{.Draft}} -->`;
    const panel = writer(editorBody(await editorWith(edited)));
    assert.deepEqual(panel.draftOnly, ["EventUrl"]);
    assert.ok(!panel.candidates.some((candidate) => candidate.name === "EventUrl"));
  });

  it("names none while the edited body is not known yet", () => {
    assert.deepEqual(writer(null).draftOnly, []);
  });

  it("takes only names the server accepts", () => {
    assert.ok(isVariableName("link"));
    assert.ok(isVariableName("_x9"));
    assert.ok(isVariableName("a".repeat(64)));
    assert.ok(!isVariableName("a".repeat(65)));
    assert.ok(!isVariableName("9link"));
    assert.ok(!isVariableName("İsim"));
    assert.ok(!isVariableName(""));
  });
});

describe("the live warning", () => {
  it("marks a Required variable the edited body no longer references", async () => {
    const [link, firstName] = writer(editorBody(await editorWith(without(LINK)))).rows;
    assert.equal(link.state, "dropped");
    assert.equal(firstName.state, "kept");
  });

  it("marks one only in an HTML comment too: the mailer leaves the comment out of the mail", async () => {
    assert.equal(writer(editorBody(await editorWith(without(LINK, `<!-- ${LINK} -->`)))).rows[0].state, "dropped");
  });

  it("takes a reference inside a conditional section as kept", async () => {
    assert.equal(writer(editorBody(await editorWith(without(LINK, `{{if .link}}${LINK}{{end}}`)))).rows[0].state, "kept");
  });

  it("says nothing while the edited source has no render yet", () => {
    assert.equal(writer(null).rows[0].state, "kept");
  });
});

describe("a refused save or publish", () => {
  const refusedLink: VersionProblem = {
    kind: "missing-variables",
    message: "",
    missing: [{ name: "link", source: "contract", why: RESET_REASON }],
  };

  it("points at the variable it names", async () => {
    const [link, firstName] = writer(editorBody(await editorWith(without(LINK))), refusedLink).rows;
    assert.equal(link.state, "refused");
    assert.equal(firstName.state, "kept");
  });

  it("stops pointing once the body references the variable again", async () => {
    assert.equal(writer(editorBody(await editorWith(PUBLISHED_HTML)), refusedLink).rows[0].state, "kept");
  });

  it("points only at rows the template has: the sets come from the template, never from a refusal", () => {
    // Named by a refusal that raced a release, or marked by someone else meanwhile: the panel re-reads the template.
    const problem: VersionProblem = {
      kind: "missing-variables",
      message: "",
      missing: [
        { name: "EventName", source: "operator", why: "Bir operatör bu değişkeni zorunlu işaretledi." },
        { name: "link", source: "contract", why: RESET_REASON },
      ],
    };
    const panel = writer({ variables: [], kind: "edited" }, problem);
    assert.deepEqual(
      panel.rows.map(({ name, state }) => ({ name, state })),
      [
        { name: "link", state: "refused" },
        { name: "firstName", state: "dropped" },
      ],
    );
  });

  it("points at nothing when the refusal is not about Required variables", () => {
    const problem: VersionProblem = { kind: "unparseable", message: "", detail: "x" };
    assert.deepEqual(
      writer(null, problem).rows.map((row) => row.state),
      ["kept", "kept"],
    );
  });
});

describe("marking and releasing through the API", () => {
  it("marks with POST …/required-variables and the name, and reads the template back", async () => {
    const answered = template({ operator_required_variables: ["firstName", "username"] });
    const { api, calls } = scriptedClient(json(200, answered));
    const result = await markRequiredVariable(api, ID, "username");
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, `${TEST_BASE_URL}/templates/${ID}/required-variables`);
    assert.deepEqual(JSON.parse(calls[0].body!), { name: "username" });
    assert.deepEqual(requiredSetsOf(result)?.operator, ["firstName", "username"]);
  });

  it("releases with DELETE …/required-variables/{name}", async () => {
    const { api, calls } = scriptedClient(json(200, template({ operator_required_variables: [] })));
    await releaseRequiredVariable(api, ID, "firstName");
    assert.equal(calls[0].method, "DELETE");
    assert.equal(calls[0].url, `${TEST_BASE_URL}/templates/${ID}/required-variables/firstName`);
  });

  /** What marking `name` threw, answered with `status` and `body`. */
  const markRefused = async (name: string, status: number, body: unknown) => {
    const { api } = scriptedClient(json(status, body));
    return markRequiredVariable(api, ID, name).catch((error: unknown) => error);
  };
  /** What releasing `name` threw. */
  const releaseRefused = async (name: string, status: number, body: unknown) => {
    const { api } = scriptedClient(json(status, body));
    return releaseRequiredVariable(api, ID, name).catch((error: unknown) => error);
  };
  const missing = (...entries: { name: string; source: string; reason: string | null }[]) => ({
    code: "template.required_variables_missing",
    params: { missing: entries },
  });
  const PUBLISH_FIRST =
    "SkyMail yalnız yayımlanmış gövdenin başvurduğu değişkeni zorunlu işaretler; ona başvuran taslağı yayımladıktan sonra işaretleyebilirsin.";

  it("says in Turkish that a contract variable cannot be released", async () => {
    const error = await releaseRefused("link", 409, { code: "template.required_variable_in_contract", params: { name: "link" } });
    assert.deepEqual(requiredVariableProblem(error, "link"), {
      text: "{{.link}} gönderen servisin sözleşmesinde; panelden çıkarılamaz.",
      blockers: [],
    });
  });

  it("says a variable the published body does not reference can be marked after publishing", async () => {
    const error = await markRefused("EventUrl", 422, missing({ name: "EventUrl", source: "operator", reason: null }));
    assert.deepEqual(requiredVariableProblem(error, "EventUrl"), {
      text: `{{.EventUrl}} gönderilen mailde geçmiyor. ${PUBLISH_FIRST}`,
      blockers: [],
    });
    // Not the save refusal's sentence, which is about a body that dropped a variable.
    assert.notEqual(requiredVariableProblem(error, "EventUrl").text, versionProblem(error).message);
  });

  it("names what the server named when another variable blocks the mark, with why", async () => {
    // The server checks the whole set against the published body, the new one included.
    const error = await markRefused("username", 422, missing({ name: "link", source: "contract", reason: RESET_REASON }));
    assert.deepEqual(requiredVariableProblem(error, "username"), {
      text: "{{.username}} işaretlenemedi: SkyMail her işaretlemede bütün Required variable'ları gönderilen maile karşı denetler, ve gönderilen mail şunlara başvurmuyor. Önce onlara başvuran bir sürümü yayımla.",
      blockers: [{ name: "link", source: "contract", why: RESET_REASON }],
    });
  });

  it("names the others too when the marked variable is among them", async () => {
    const error = await markRefused(
      "EventUrl",
      422,
      missing({ name: "EventUrl", source: "operator", reason: null }, { name: "link", source: "contract", reason: null }),
    );
    assert.deepEqual(requiredVariableProblem(error, "EventUrl"), {
      text: `{{.EventUrl}} gönderilen mailde geçmiyor. ${PUBLISH_FIRST} Gönderilen mail şunlara da başvurmuyor:`,
      blockers: [{ name: "link", source: "contract", why: "Gönderen servisin sözleşmesi bu değişkeni istiyor." }],
    });
  });

  it("blames no one when the refusal names nothing it can read", async () => {
    const error = await markRefused("EventUrl", 422, { code: "template.required_variables_missing" });
    assert.deepEqual(requiredVariableProblem(error, "EventUrl"), {
      text: "{{.EventUrl}} işaretlenemedi: gönderilen mail bu template'in Required variable'larının hepsine başvurmuyor.",
      blockers: [],
    });
  });

  it("says a published body the mailer cannot parse has no variables to mark", async () => {
    const error = await markRefused("link", 422, { code: "template.unparseable", params: { part: "html", error: "x" } });
    assert.deepEqual(requiredVariableProblem(error, "link"), {
      text: "Gönderilen gövde mailer'ın okuyabileceği bir Go template değil; SkyMail değişkenlerini okuyamadığı için zorunlu işaretleyemiyor.",
      blockers: [],
    });
  });

  it("is the API error's sentence for anything else", async () => {
    assert.equal(
      requiredVariableProblem(await releaseRefused("9x", 400, { code: "template.invalid_variable_name" }), "9x").text,
      "Değişken adı geçersiz: harf ya da alt çizgiyle başlamalı; yalnız İngilizce harf, rakam ve alt çizgi içerebilir, en çok 64 karakter.",
    );
    assert.equal(requiredVariableProblem(await markRefused("x", 403, { code: "server.forbidden" }), "x").text, "Bu işlem için yetkin yok.");
    assert.equal(
      requiredVariableProblem(await markRefused("x", 404, { code: "server.not_found" }), "x").text,
      "Aradığın kayıt bulunamadı. Silinmiş ya da arşivlenmiş olabilir.",
    );
  });
});
