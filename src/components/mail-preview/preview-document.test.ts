/**
 * The document a preview frame shows: a stored or rendered body with sample
 * values in place of its Go actions, in the theme the operator picked rather
 * than whichever theme their own system prefers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contentPolicy, forceColorScheme, previewDocument, withRemoteContentPolicy } from "./preview-document";

const MAIL = `<!DOCTYPE html><html><head><style>
body { background-color: #f4f1f7; }
@media (prefers-color-scheme: dark) {
  .card { background-color: #121115 !important; }
}
[data-ogsc] .t-primary { color: #ffffff !important; }
</style></head><body><p class="card">Merhaba {{.FirstName}}</p></body></html>`;

describe("a mail forced into one theme", () => {
  it("applies the dark rules unconditionally in the dark preview", () => {
    const dark = forceColorScheme(MAIL, "dark");
    assert.match(dark, /@media all \{\n {2}\.card/);
    assert.doesNotMatch(dark, /prefers-color-scheme/);
  });

  it("never applies them in the light preview", () => {
    const light = forceColorScheme(MAIL, "light");
    assert.match(light, /@media not all \{\n {2}\.card/);
    assert.doesNotMatch(light, /prefers-color-scheme/);
  });

  it("keeps the rest of the mail as it is", () => {
    const dark = forceColorScheme(MAIL, "dark");
    assert.equal(dark.replace("@media all", "@media (prefers-color-scheme: dark)"), MAIL);
  });

  it("reads the query however it is spaced or cased, and light-only rules the other way round", () => {
    const css = "@media screen and (PREFERS-COLOR-SCHEME:light){a{}} @media (prefers-color-scheme : dark) , print {b{}}";
    assert.equal(forceColorScheme(css, "light"), "@media screen and (min-width: 0px){a{}} @media print {b{}}");
    assert.equal(forceColorScheme(css, "dark"), "@media not all{a{}} @media all, print {b{}}");
  });

  it("leaves a mail without theme rules alone", () => {
    const plain = "<p>Merhaba</p>";
    assert.equal(forceColorScheme(plain, "dark"), plain);
  });
});

describe("the preview document", () => {
  it("fills the sample values and forces the theme", () => {
    const document = previewDocument(MAIL, { scheme: "dark", sample: { FirstName: "Ayşe <3" } });
    assert.match(document, /Merhaba Ayşe &lt;3/);
    assert.match(document, /@media all/);
  });

  it("marks a variable with no sample value so it stands out", () => {
    assert.match(previewDocument("<p>{{.FirstName}}</p>", { scheme: "light", sample: {} }), /«FirstName»/);
  });
});

// A mail the server already rendered — a request for approval's preview
// (ticket 20) — holds no Go actions any more: what looks like one is what the
// sender typed, and stays as it is.
describe("a mail already rendered", () => {
  it("is shown as it is, only its theme forced", () => {
    const rendered = MAIL.replace("{{.FirstName}}", "Ayşe, {{.Gizli}} yazdım");
    const document = previewDocument(rendered, { scheme: "dark" });
    assert.match(document, /Merhaba Ayşe, \{\{\.Gizli\}\} yazdım/);
    assert.match(document, /@media all/);
  });
});

describe("a sent mail shown with its remote content blocked", () => {
  const SENT = `<!DOCTYPE html><html lang="tr"><head><!-- <head> --><style>p{}</style></head><body><img src="https://iz.example.test/p.gif"><p>Merhaba</p></body></html>`;

  it("puts the policy first, right after the doctype, so nothing in the mail comes before it", () => {
    const shown = withRemoteContentPolicy(SENT, { remote: "blocked" });
    assert.match(shown, /^<!DOCTYPE html><meta http-equiv="Content-Security-Policy" content="[^"]+">\s*<html lang="tr">/);
    assert.equal(shown.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]+">\s*/, ""), SENT);
  });

  it("puts it at the very start of a mail without a doctype", () => {
    assert.match(withRemoteContentPolicy("<!-- <head> --><p>x</p>", { remote: "blocked" }), /^<meta http-equiv="Content-Security-Policy"/);
    assert.match(withRemoteContentPolicy("  <html><p>x</p>", { remote: "blocked" }), /^<meta http-equiv="Content-Security-Policy"/);
  });

  it("loads nothing from the network while blocked: images and fonts only from data:, no stylesheet, script, frame or form", () => {
    const policy = contentPolicy("blocked");
    assert.match(policy, /default-src 'none'/);
    assert.match(policy, /img-src data:(;|$)/);
    assert.match(policy, /style-src 'unsafe-inline'(;|$)/);
    assert.match(policy, /font-src data:(;|$)/);
    assert.match(policy, /form-action 'none'/);
    assert.match(policy, /base-uri 'none'/);
    assert.doesNotMatch(policy, /https:|script-src|'unsafe-eval'/);
  });

  it("lets images, fonts and stylesheets come over https once the operator asks, and still no script", () => {
    const policy = contentPolicy("allowed");
    assert.match(policy, /img-src data: https:(;|$)/);
    assert.match(policy, /font-src data: https:(;|$)/);
    assert.match(policy, /style-src 'unsafe-inline' https:(;|$)/);
    assert.match(policy, /default-src 'none'/);
    assert.doesNotMatch(policy, /script-src|http:(?!s)/);
  });

  it("is what a sent mail's preview document carries", () => {
    const shown = previewDocument(SENT, { scheme: "light", remote: "blocked" });
    assert.match(shown, /^<!DOCTYPE html><meta http-equiv="Content-Security-Policy" content="default-src 'none'/);
    assert.doesNotMatch(previewDocument(SENT, { scheme: "light" }), /Content-Security-Policy/);
  });
});
