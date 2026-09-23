/**
 * The document a preview frame shows: a stored or rendered body with sample
 * values in place of its Go actions, in the theme the operator picked rather
 * than whichever theme their own system prefers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { forceColorScheme, previewDocument } from "./preview";

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
