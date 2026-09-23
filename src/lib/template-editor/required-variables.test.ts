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
  bodyVariables,
  isVariableName,
  requiredPanel,
  requiredSetsOf,
  requiredVariableProblem,
  withRefusal,
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

function version(html: string): TemplateVersion {
  return {
    id: PUBLISHED,
    template_id: ID,
    seq: 3,
    subject: "SKY LAB parola sıfırlama isteği",
    requested_subject: null,
    main_mode: "html",
    author: { kind: "template_seed", sub: null, name: null },
    created_at: "2026-09-20T10:00:00Z",
    published_at: "2026-09-20T10:00:00Z",
    base_version_id: null,
    current: true,
    discarded: false,
    name: "Keycloak · Parola Sıfırlama",
    jsx_source: null,
    visual_source: null,
    html_source: html,
    html_content: html,
    plain_text_content: "Merhaba",
  };
}

/** The editor with the published HTML open, edited to `edited`, rendered or not yet. */
async function editorWith(edited: string, rendered = true): Promise<EditorState> {
  const stored = storedFromVersion(version(PUBLISHED_HTML), "Keycloak · Parola Sıfırlama");
  const renders = rendered ? { html: await renderSource({ mode: "html", source: edited }) } : {};
  return { editing: { ...stored, sources: { html: edited } }, renders, stored };
}

const sets = (): RequiredSets => requiredSetsOf(template())!;
const writer = (body: readonly string[] | null, problem: VersionProblem | null = null) =>
  requiredPanel({ sets: sets(), body, problem, canWrite: true });

describe("the Required variables the panel shows", () => {
  it("shows the contract's locked, with the reason the repo gives, and never offers to release them", () => {
    const [link] = writer(null).rows;
    assert.deepEqual(link, { name: "link", source: "contract", why: RESET_REASON, locked: true, removable: false, state: "kept" });
  });

  it("says a contract variable with no reason is the sending service's contract", () => {
    const panel = requiredPanel({
      sets: requiredSetsOf(template({ contract_required_variables: [{ name: "code", reason: null }] }))!,
      body: null,
      canWrite: true,
    });
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

describe("what an operator may mark", () => {
  it("is what the published body references, as the server counts it, less what is required already", () => {
    // link and firstName are required; the element's Title, the commented
    // Hidden and the non-ASCII İsim are not variables the server would take.
    assert.deepEqual(writer(null).candidates, ["EventName", "Items", "username"]);
  });

  it("names a variable only the edited body references, which can be marked once published", async () => {
    const edited = `${PUBLISHED_HTML}\n{{if .EventUrl}}<a href="{{.EventUrl}}">Etkinlik</a>{{end}}\n<!-- {{.Draft}} -->`;
    const panel = writer(bodyVariables(await editorWith(edited)));
    assert.deepEqual(panel.draftOnly, ["EventUrl"]);
    assert.ok(!panel.candidates.includes("EventUrl"));
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
    const edited = PUBLISHED_HTML.replace('<a href="{{.link}}">Yeni Parola Belirle</a>', "");
    const [link, firstName] = writer(bodyVariables(await editorWith(edited))).rows;
    assert.equal(link.state, "dropped");
    assert.equal(firstName.state, "kept");
  });

  it("marks one only in an HTML comment too: the mailer leaves the comment out of the mail", async () => {
    const edited = PUBLISHED_HTML.replace('<a href="{{.link}}">Yeni Parola Belirle</a>', '<!-- <a href="{{.link}}">Yeni Parola Belirle</a> -->');
    assert.equal(writer(bodyVariables(await editorWith(edited))).rows[0].state, "dropped");
  });

  it("takes a reference inside a conditional section as kept", async () => {
    const edited = PUBLISHED_HTML.replace('<a href="{{.link}}">', '{{if .link}}<a href="{{.link}}">').replace("Belirle</a>", "Belirle</a>{{end}}");
    assert.equal(writer(bodyVariables(await editorWith(edited))).rows[0].state, "kept");
  });

  it("says nothing while the edited source has no render yet", async () => {
    const edited = PUBLISHED_HTML.replace("{{.link}}", "");
    assert.equal(bodyVariables(await editorWith(edited, false)), null);
    assert.equal(writer(null).rows[0].state, "kept");
  });

  it("reads the stored body while the Main source is untouched and has no render", async () => {
    const state = await editorWith(PUBLISHED_HTML, false);
    assert.deepEqual(bodyVariables(state), ["EventName", "Items", "firstName", "link", "username", "İsim"]);
  });
});

describe("a refused save or publish", () => {
  const refusedLink: VersionProblem = {
    kind: "missing-variables",
    message: "",
    missing: [{ name: "link", source: "contract", why: RESET_REASON }],
  };

  it("points at the variable it names", async () => {
    const edited = PUBLISHED_HTML.replace("{{.link}}", "");
    const [link, firstName] = writer(bodyVariables(await editorWith(edited)), refusedLink).rows;
    assert.equal(link.state, "refused");
    assert.equal(firstName.state, "kept");
  });

  it("stops pointing once the body references the variable again", async () => {
    assert.equal(writer(bodyVariables(await editorWith(PUBLISHED_HTML)), refusedLink).rows[0].state, "kept");
  });

  it("adds a variable the panel did not know of, as the refusal gives it", () => {
    // Marked, and taken into the contract, by someone else after the editor opened.
    const problem: VersionProblem = {
      kind: "missing-variables",
      message: "",
      missing: [
        { name: "code", source: "contract", why: "Doğrulama kodu." },
        { name: "EventName", source: "operator", why: "Bir operatör bu değişkeni zorunlu işaretledi." },
        { name: "link", source: "contract", why: RESET_REASON },
      ],
    };
    const learned = withRefusal(sets(), problem);
    assert.deepEqual(learned.contract, [
      { name: "link", reason: RESET_REASON },
      { name: "code", reason: "Doğrulama kodu." },
    ]);
    assert.deepEqual(learned.operator, ["firstName", "EventName"]);
    const panel = requiredPanel({ sets: learned, body: [], problem, canWrite: true });
    assert.deepEqual(
      panel.rows.map(({ name, locked, removable, state, why }) => ({ name, locked, removable, state, why })),
      [
        { name: "link", locked: true, removable: false, state: "refused", why: RESET_REASON },
        { name: "code", locked: true, removable: false, state: "refused", why: "Doğrulama kodu." },
        { name: "firstName", locked: false, removable: true, state: "dropped", why: "Bir operatör bu değişkeni zorunlu işaretledi." },
        { name: "EventName", locked: false, removable: true, state: "refused", why: "Bir operatör bu değişkeni zorunlu işaretledi." },
      ],
    );
    assert.ok(!panel.candidates.includes("EventName"));
  });

  it("leaves the sets as they are when the refusal names nothing new, or is not about variables", () => {
    const known = sets();
    assert.equal(withRefusal(known, { kind: "missing-variables", message: "", missing: [{ name: "link", source: "contract", why: "" }] }), known);
    assert.equal(withRefusal(known, { kind: "message", message: "" }), known);
    assert.equal(withRefusal(known, null), known);
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

  const refused = async (status: number, body: unknown) => {
    const { api } = scriptedClient(json(status, body));
    return releaseRequiredVariable(api, ID, "link").catch((error: unknown) => error);
  };

  it("says in Turkish that a contract variable cannot be released", async () => {
    const error = await refused(409, { code: "template.required_variable_in_contract", params: { name: "link" } });
    assert.equal(requiredVariableProblem(error, "link"), "{{.link}} gönderen servisin sözleşmesinde; panelden çıkarılamaz.");
  });

  it("says a variable the published body does not reference can be marked after publishing", async () => {
    const error = await refused(422, {
      code: "template.required_variables_missing",
      params: { missing: [{ name: "EventUrl", source: "operator", reason: null }] },
    });
    assert.equal(
      requiredVariableProblem(error, "EventUrl"),
      "{{.EventUrl}} gönderilen mailde geçmiyor. SkyMail yalnız yayımlanmış gövdenin başvurduğu değişkeni zorunlu işaretler; ona başvuran taslağı yayımladıktan sonra işaretleyebilirsin.",
    );
    // Not the save refusal's sentence, which is about a body that dropped a variable.
    assert.notEqual(requiredVariableProblem(error, "EventUrl"), versionProblem(error).message);
  });

  it("says a published body the mailer cannot parse has no variables to mark", async () => {
    const error = await refused(422, { code: "template.unparseable", params: { part: "html", error: "x" } });
    assert.equal(
      requiredVariableProblem(error, "link"),
      "Gönderilen gövde mailer'ın okuyabileceği bir Go template değil; SkyMail değişkenlerini okuyamadığı için zorunlu işaretleyemiyor.",
    );
  });

  it("is the API error's sentence for anything else", async () => {
    assert.equal(
      requiredVariableProblem(await refused(400, { code: "template.invalid_variable_name" }), "x"),
      "Değişken adı geçersiz: harf ya da alt çizgiyle başlamalı; yalnız İngilizce harf, rakam ve alt çizgi içerebilir, en çok 64 karakter.",
    );
    assert.equal(requiredVariableProblem(await refused(403, { code: "server.forbidden" }), "x"), "Bu işlem için yetkin yok.");
  });
});
