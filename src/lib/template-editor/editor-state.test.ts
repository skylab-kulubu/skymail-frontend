/**
 * What the editor opens, and what a save or a Main source change sends.
 *
 * The API keeps a source a draft leaves out (`null` or absent = kept), stores
 * the render it is given, and never renders; the rules on what may be sent
 * are the editor's. The renders here are real ones from the render module.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderSource, type AuthoringMode, type SourceRender } from "../mail-render";
import { EMPTY_VISUAL_SOURCE, visualSource, type VisualDocument } from "../mail-render/visual-document";
import type { MailTemplate, TemplateVersion, TemplateVersionSummary } from "../templates";
import {
  HTML_STARTER,
  JSX_STARTER,
  NO_JSX_SOURCE,
  addSource,
  contentOf,
  isDirty,
  planCreate,
  planMainChange,
  planSave,
  revertSource,
  storedFromVersion,
  versionToOpen,
  type Content,
} from "./editor-state";

const VIEWER = "8d0f5c2e-6b1a-4c3e-9f27-5a1d3b7e9c41";
const OTHER = "1b7e2d94-3c5a-4f08-8e61-2d9c4a7b3f10";
const PUBLISHED = "9a1b2c00-0000-4000-8000-000000000001";

const JSX = 'import { Text } from "@react-email/components";\n\nexport default () => <Text>Merhaba {"{{.FirstName}}"}</Text>;\n';
const JSX_EDITED = JSX.replace("Merhaba", "Selam");
const BROKEN_JSX = "export default () => <Text>";
const HTML = "<p>Merhaba {{.FirstName}}</p>";

const VISUAL_DOCUMENT: VisualDocument = {
  type: "skymail.visual",
  version: 1,
  blocks: [
    { type: "heading", content: [{ type: "text", text: "Merhaba " }, { type: "variable", name: "FirstName" }] },
    { type: "button", label: "Bilete git", link: { variable: "TicketUrl" } },
  ],
};
const VISUAL = visualSource(VISUAL_DOCUMENT);

/** The document as jsonb hands it back: the same, keys in another order. */
const FROM_JSONB = JSON.parse(
  '{"type":"skymail.visual","blocks":[{"content":[{"text":"Merhaba ","type":"text"},{"name":"FirstName","type":"variable"}],"type":"heading"},{"link":{"variable":"TicketUrl"},"type":"button","label":"Bilete git"}],"version":1}',
);

function summary(overrides: Partial<TemplateVersionSummary> = {}): TemplateVersionSummary {
  return {
    id: PUBLISHED,
    template_id: "7e3a1c00-0000-4000-8000-000000000001",
    seq: 3,
    subject: "Merhaba {{.FirstName}}",
    requested_subject: null,
    main_mode: "jsx",
    author: { kind: "operator", sub: OTHER, name: "Mehmet Kaya" },
    created_at: "2026-09-20T10:00:00Z",
    published_at: "2026-09-20T10:00:00Z",
    base_version_id: null,
    current: true,
    discarded: false,
    ...overrides,
  };
}

function version(overrides: Partial<TemplateVersion> = {}): TemplateVersion {
  return {
    ...summary(),
    name: "Hoş geldin",
    jsx_source: JSX,
    visual_source: null,
    html_source: null,
    html_content: "<p>stored</p>",
    plain_text_content: "stored",
    ...overrides,
  };
}

function template(overrides: Partial<MailTemplate> = {}): MailTemplate {
  return {
    id: "7e3a1c00-0000-4000-8000-000000000001",
    name: "Hoş geldin",
    key: "core.welcome",
    subject: "Merhaba {{.FirstName}}",
    system: true,
    html_content: "<p>stored</p>",
    plain_text_content: "stored",
    react_email_content: JSX,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-20T10:00:00Z",
    archived_at: null,
    archived_by: null,
    published_version_id: PUBLISHED,
    main_mode: "jsx",
    drafts: [],
    ...overrides,
  };
}

const render = async (mode: AuthoringMode, source: string): Promise<SourceRender> => renderSource({ mode, source });

describe("the version the editor opens", () => {
  it("is the viewer's own draft in progress when there is one", () => {
    const mine = summary({ id: "draft-mine", published_at: null, current: false, author: { kind: "operator", sub: VIEWER, name: "Ben" } });
    const theirs = summary({ id: "draft-theirs", published_at: null, current: false });
    assert.equal(versionToOpen(template({ drafts: [theirs, mine] }), VIEWER), "draft-mine");
  });

  it("is the published version otherwise, even when someone else has a draft", () => {
    const theirs = summary({ id: "draft-theirs", published_at: null, current: false });
    assert.equal(versionToOpen(template({ drafts: [theirs] }), VIEWER), PUBLISHED);
    assert.equal(versionToOpen(template({ drafts: [theirs] }), null), PUBLISHED);
  });
});

describe("what the editor holds of a version", () => {
  it("is its name, subject, Main source and sources, based on what it started from", () => {
    const draft = version({ id: "draft-mine", published_at: null, base_version_id: PUBLISHED, html_source: HTML, name: "Hoş geldin!" });
    const stored = storedFromVersion(draft, "Hoş geldin");
    assert.deepEqual(contentOf(stored), {
      name: "Hoş geldin!",
      subject: "Merhaba {{.FirstName}}",
      mainMode: "jsx",
      sources: { jsx: JSX, html: HTML },
    });
    assert.equal(stored.draftId, "draft-mine");
    assert.equal(stored.baseVersionId, PUBLISHED);
  });

  it("starts a draft from the published version itself", () => {
    const stored = storedFromVersion(version(), "Hoş geldin");
    assert.equal(stored.draftId, null);
    assert.equal(stored.baseVersionId, PUBLISHED);
  });

  it("holds a Visual source as the document's text, the same whatever order jsonb keeps its keys in", () => {
    const stored = storedFromVersion(version({ visual_source: FROM_JSONB }), "Hoş geldin");
    assert.equal(stored.sources.visual, VISUAL);
    assert.equal(isDirty(contentOf(stored), stored), false);
  });

  // An unknown block is never dropped on the way in: the render says what is
  // wrong, and a save that does not touch the source sends it back as it came.
  it("holds a Visual document the panel cannot read as it came", () => {
    const unknown = { type: "skymail.visual", version: 1, blocks: [{ type: "quote", text: "x" }] };
    const stored = storedFromVersion(version({ visual_source: unknown }), "Hoş geldin");
    assert.deepEqual(JSON.parse(stored.sources.visual ?? "null"), unknown);
  });

  it("takes the row's name when the version carries none", () => {
    assert.equal(storedFromVersion(version({ name: undefined }), "Satırdaki ad").name, "Satırdaki ad");
  });
});

describe("unsaved changes", () => {
  const stored = storedFromVersion(version({ html_source: HTML }), "Hoş geldin");
  const same = contentOf(stored);

  it("are none as opened", () => {
    assert.equal(isDirty(same, stored), false);
  });

  it("are any change to the name, the subject, the Main source or a source, and a source added", () => {
    assert.equal(isDirty({ ...same, name: "Yeni ad" }, stored), true);
    assert.equal(isDirty({ ...same, subject: "Selam" }, stored), true);
    assert.equal(isDirty({ ...same, mainMode: "html" }, stored), true);
    assert.equal(isDirty({ ...same, sources: { ...same.sources, jsx: JSX_EDITED } }, stored), true);
    const htmlless = storedFromVersion(version(), "Hoş geldin");
    assert.equal(isDirty({ ...contentOf(htmlless), sources: { jsx: JSX, html: HTML } }, htmlless), true);
  });
});

describe("a save", () => {
  it("writes the Main source's render and every source in hand, from the version it started from", async () => {
    const stored = storedFromVersion(version({ html_source: HTML }), "Hoş geldin");
    const editing: Content = { ...contentOf(stored), subject: "Selam {{.FirstName}}", sources: { jsx: JSX_EDITED, html: HTML } };
    const main = await render("jsx", JSX_EDITED);
    const plan = planSave({ editing, renders: { jsx: main, html: await render("html", HTML) }, stored });

    assert.ok(plan.ok);
    assert.ok(main.ok);
    assert.deepEqual(plan.body, {
      name: "Hoş geldin",
      subject: "Selam {{.FirstName}}",
      main_mode: "jsx",
      jsx_source: JSX_EDITED,
      html_source: HTML,
      html_content: main.html,
      plain_text_content: main.plainText,
      base_version_id: PUBLISHED,
    });
  });

  it("never writes a Main source that did not compile, and says why", async () => {
    const stored = storedFromVersion(version(), "Hoş geldin");
    const failed = await render("jsx", BROKEN_JSX);
    const plan = planSave({ editing: { ...contentOf(stored), sources: { jsx: BROKEN_JSX } }, renders: { jsx: failed }, stored });

    assert.equal(plan.ok, false);
    assert.ok(!plan.ok && plan.blockers.length === 1);
    assert.equal(!plan.ok && plan.blockers[0].mode, "jsx");
    assert.match((!plan.ok && plan.blockers[0].message) || "", /JSX kaynağı render edilemedi: Kod derlenemedi/);
  });

  it("never writes another source that was edited and does not render either", async () => {
    const stored = storedFromVersion(version({ main_mode: "html", html_source: HTML, html_content: HTML }), "Hoş geldin");
    const plan = planSave({ editing: { ...contentOf(stored), sources: { jsx: BROKEN_JSX, html: HTML } }, renders: { jsx: await render("jsx", BROKEN_JSX), html: await render("html", HTML) }, stored });
    assert.equal(!plan.ok && plan.blockers.map((blocker) => blocker.mode).join(), "jsx");
  });

  it("waits for a render that has not caught up with the text", async () => {
    const stored = storedFromVersion(version(), "Hoş geldin");
    const plan = planSave({ editing: { ...contentOf(stored), sources: { jsx: JSX_EDITED } }, renders: { jsx: await render("jsx", JSX) }, stored });
    assert.equal(plan.ok, false);
    assert.match((!plan.ok && plan.blockers[0].message) || "", /önizlemesi henüz hazır değil/);
  });

  // ADR-0045: a System template's wording is edited in SkyMail, and the stored
  // body of one the panel cannot render goes back unchanged.
  it("keeps the stored body of a Main source nobody touched, even one the panel cannot render", async () => {
    const stored = storedFromVersion(version({ jsx_source: BROKEN_JSX }), "Hoş geldin");
    const plan = planSave({ editing: { ...contentOf(stored), subject: "Yeni konu" }, renders: { jsx: await render("jsx", BROKEN_JSX) }, stored });
    assert.ok(plan.ok);
    assert.equal(plan.body.html_content, "<p>stored</p>");
    assert.equal(plan.body.plain_text_content, "stored");
    assert.equal(plan.body.jsx_source, BROKEN_JSX);
  });

  it("does not keep the stored body under another Main source", async () => {
    const stored = storedFromVersion(version({ html_source: HTML }), "Hoş geldin");
    const plan = planSave({ editing: { ...contentOf(stored), mainMode: "html" }, renders: { jsx: await render("jsx", JSX) }, stored });
    assert.equal(plan.ok, false);
    assert.equal(!plan.ok && plan.blockers[0].mode, "html");
  });

  it("needs a name and a subject", async () => {
    const stored = storedFromVersion(version(), "Hoş geldin");
    const plan = planSave({ editing: { ...contentOf(stored), name: " ", subject: "" }, renders: { jsx: await render("jsx", JSX) }, stored });
    assert.deepEqual(
      !plan.ok && plan.blockers.map((blocker) => blocker.message),
      ["Template adı boş olamaz.", "Konu boş olamaz."],
    );
  });

  it("sends a Visual source as the document itself, and its render when it is main", async () => {
    const stored = storedFromVersion(version({ main_mode: "visual", jsx_source: JSX, visual_source: FROM_JSONB }), "Hoş geldin");
    const edited = visualSource({ ...VISUAL_DOCUMENT, blocks: [...VISUAL_DOCUMENT.blocks, { type: "divider" }] });
    const main = await render("visual", edited);
    const plan = planSave({ editing: { ...contentOf(stored), sources: { jsx: JSX, visual: edited } }, renders: { visual: main }, stored });

    assert.ok(plan.ok, plan.ok ? "" : plan.blockers.map((blocker) => blocker.message).join());
    assert.ok(main.ok);
    assert.deepEqual(plan.body.visual_source, JSON.parse(edited));
    assert.equal(plan.body.jsx_source, JSX);
    assert.equal(plan.body.html_content, main.html);
    assert.equal(plan.body.plain_text_content, main.plainText);
  });

  it("never writes a Visual source that does not render, and says why", async () => {
    const stored = storedFromVersion(version(), "Hoş geldin");
    const plan = planSave({
      editing: { ...contentOf(stored), sources: { jsx: JSX, visual: EMPTY_VISUAL_SOURCE } },
      renders: { jsx: await render("jsx", JSX), visual: await render("visual", EMPTY_VISUAL_SOURCE) },
      stored,
    });
    assert.equal(!plan.ok && plan.blockers.map((blocker) => blocker.mode).join(), "visual");
    assert.match((!plan.ok && plan.blockers[0].message) || "", /Visual kaynağı render edilemedi/);
  });
});

describe("making another source the Main source", () => {
  it("saves the new Main source's render with the new mode, and leaves the other sources to the API to keep", async () => {
    const stored = storedFromVersion(version({ html_source: HTML }), "Hoş geldin");
    const editing: Content = { ...contentOf(stored), sources: { jsx: JSX_EDITED, html: HTML } };
    const html = await render("html", HTML);
    const plan = planMainChange("html", { editing, renders: { jsx: await render("jsx", JSX_EDITED), html }, stored });

    assert.ok(plan.ok);
    assert.ok(html.ok);
    assert.deepEqual(plan.body, {
      subject: "Merhaba {{.FirstName}}",
      main_mode: "html",
      html_source: HTML,
      html_content: html.html,
      plain_text_content: html.plainText,
      base_version_id: PUBLISHED,
    });
  });

  it("makes a Visual source main with its render and the document itself", async () => {
    const stored = storedFromVersion(version({ visual_source: FROM_JSONB }), "Hoş geldin");
    const visual = await render("visual", VISUAL);
    const plan = planMainChange("visual", { editing: contentOf(stored), renders: { visual }, stored });

    assert.ok(plan.ok && visual.ok);
    assert.deepEqual(plan.body, {
      subject: "Merhaba {{.FirstName}}",
      main_mode: "visual",
      visual_source: VISUAL_DOCUMENT,
      html_content: visual.html,
      plain_text_content: visual.plainText,
      base_version_id: PUBLISHED,
    });
  });

  it("needs a render of the candidate as it stands: that is what will be sent", async () => {
    const stored = storedFromVersion(version({ html_source: HTML }), "Hoş geldin");
    const editing: Content = { ...contentOf(stored), sources: { jsx: JSX, html: `${HTML}<p>more</p>` } };
    const plan = planMainChange("html", { editing, renders: { html: await render("html", HTML) }, stored });
    assert.equal(plan.ok, false);
  });

  it("is nothing to do for the source that is already main", async () => {
    const stored = storedFromVersion(version(), "Hoş geldin");
    const plan = planMainChange("jsx", { editing: contentOf(stored), renders: { jsx: await render("jsx", JSX) }, stored });
    assert.equal(plan.ok, false);
  });
});

describe("adding a source in another Authoring mode", () => {
  it("starts a new HTML source from the Main source's rendered HTML", async () => {
    const stored = storedFromVersion(version(), "Hoş geldin");
    const editing: Content = { ...contentOf(stored), sources: { jsx: JSX_EDITED } };
    const main = await render("jsx", JSX_EDITED);
    const added = addSource("html", { editing, renders: { jsx: main }, stored });
    assert.ok(main.ok);
    assert.equal(added?.sources.html, main.html);
    assert.equal(added?.sources.jsx, JSX_EDITED, "the other source stays");
    assert.equal(added?.mainMode, "jsx", "adding is not choosing a Main source");
  });

  it("uses the stored render while the Main source is untouched", () => {
    const stored = storedFromVersion(version(), "Hoş geldin");
    assert.equal(addSource("html", { editing: contentOf(stored), renders: {}, stored })?.sources.html, "<p>stored</p>");
  });

  it("cannot start from a Main source that has no render as it stands", async () => {
    const stored = storedFromVersion(version(), "Hoş geldin");
    const editing: Content = { ...contentOf(stored), sources: { jsx: BROKEN_JSX } };
    assert.equal(addSource("html", { editing, renders: { jsx: await render("jsx", BROKEN_JSX) }, stored }), null);
  });

  // No conversion (spec, Out of Scope): not from the Main source's HTML, not from JSX.
  it("starts a new Visual source empty, and keeps every other source and the Main source", async () => {
    const stored = storedFromVersion(version({ html_source: HTML }), "Hoş geldin");
    const added = addSource("visual", { editing: contentOf(stored), renders: { jsx: await render("jsx", JSX) }, stored });
    assert.equal(added?.sources.visual, EMPTY_VISUAL_SOURCE);
    assert.deepEqual(added && { ...added.sources, visual: undefined }, { jsx: JSX, html: HTML, visual: undefined });
    assert.equal(added?.mainMode, "jsx");
  });

  it("never replaces a source that is there", () => {
    const stored = storedFromVersion(version({ html_source: HTML }), "Hoş geldin");
    assert.equal(addSource("html", { editing: contentOf(stored), renders: {}, stored }), null);
  });

  it("starts a new JSX source from a starter that compiles with the club's components", async () => {
    const stored = storedFromVersion(version({ main_mode: "html", jsx_source: null, html_source: HTML, html_content: HTML }), "x");
    const added = addSource("jsx", { editing: contentOf(stored), renders: {}, stored });
    assert.equal(added?.sources.jsx, JSX_STARTER);
    assert.equal(added?.sources.html, HTML);
    const rendered = await render("jsx", JSX_STARTER);
    assert.equal(rendered.ok, true, !rendered.ok ? rendered.message : "");
  });
});


describe("creating a template", () => {
  it("sends the render of its first source, a JSX source as the code the API keeps", async () => {
    const rendered = await render("jsx", JSX);
    const plan = planCreate({ name: "Duyuru", subject: "Merhaba", mode: "jsx", source: JSX }, rendered);
    assert.ok(plan.ok && rendered.ok);
    assert.deepEqual(plan.body, {
      name: "Duyuru",
      subject: "Merhaba",
      html_content: rendered.html,
      plain_text_content: rendered.plainText,
      react_email_content: JSX,
    });
  });

  // The API reads react_email_content as a JSX source only when code is left
  // after its comments are taken out; otherwise the HTML is the Main source.
  it("marks an HTML template as having no JSX source, with a comment and nothing else", async () => {
    const rendered = await render("html", HTML_STARTER);
    const plan = planCreate({ name: "Duyuru", subject: "Merhaba", mode: "html", source: HTML_STARTER }, rendered);
    assert.ok(plan.ok && rendered.ok);
    assert.equal(plan.body.react_email_content, NO_JSX_SOURCE);
    assert.equal(plan.body.html_content, HTML_STARTER);
    assert.ok(NO_JSX_SOURCE.split("\n").every((line) => line.trim() === "" || line.trim().startsWith("//")));
  });

  it("never creates from a source with no render of its own", async () => {
    const failed = await render("jsx", BROKEN_JSX);
    const plan = planCreate({ name: "Duyuru", subject: "Merhaba", mode: "jsx", source: BROKEN_JSX }, failed);
    assert.match((!plan.ok && plan.blockers[0].message) || "", /render edilemedi/);
    const stale = planCreate({ name: "Duyuru", subject: "Merhaba", mode: "jsx", source: JSX_EDITED }, await render("jsx", JSX));
    assert.equal(stale.ok, false);
    assert.equal(planCreate({ name: "Duyuru", subject: "Merhaba", mode: "jsx", source: JSX }, null).ok, false);
  });

  it("needs a name and a subject", async () => {
    const plan = planCreate({ name: "", subject: " ", mode: "html", source: HTML }, await render("html", HTML));
    assert.deepEqual(!plan.ok && plan.blockers.map((blocker) => blocker.message), ["Template adı boş olamaz.", "Konu boş olamaz."]);
  });
});

describe("dropping one source's unsaved changes", () => {
  it("puts that source back as stored and keeps every other change", async () => {
    const stored = storedFromVersion(version({ html_source: HTML }), "Hoş geldin");
    const editing: Content = { ...contentOf(stored), subject: "Yeni konu", sources: { jsx: BROKEN_JSX, html: `${HTML}<p>ek</p>` } };
    const reverted = revertSource("jsx", editing, stored);
    assert.deepEqual(reverted, { ...editing, sources: { jsx: JSX, html: `${HTML}<p>ek</p>` } });
    // Then the rest can be saved.
    const plan = planSave({ editing: reverted, renders: { jsx: await render("jsx", BROKEN_JSX), html: await render("html", `${HTML}<p>ek</p>`) }, stored });
    assert.ok(plan.ok);
    assert.equal(plan.body.subject, "Yeni konu");
    assert.equal(plan.body.jsx_source, JSX);
  });

  it("takes away a source added since the last save", () => {
    const stored = storedFromVersion(version(), "Hoş geldin");
    const editing: Content = { ...contentOf(stored), sources: { jsx: JSX, html: HTML } };
    assert.deepEqual(revertSource("html", editing, stored).sources, { jsx: JSX });
  });
});
