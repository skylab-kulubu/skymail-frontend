/**
 * A preview is the stored body with sample values in place of its actions, so
 * a template is judged the way a recipient reads it. It is never saved.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fillSampleValues } from ".";

describe("a preview with sample values", () => {
  it("puts each sample value where its field is", () => {
    assert.equal(
      fillSampleValues('<p>Merhaba {{.FirstName}}, <a href="{{.Link}}">bağlantı</a></p>', {
        FirstName: "Yusuf",
        Link: "https://skyl.app/e/1",
      }),
      '<p>Merhaba Yusuf, <a href="https://skyl.app/e/1">bağlantı</a></p>',
    );
  });

  it("names a field that has no sample value rather than leaving it blank", () => {
    assert.equal(fillSampleValues("<p>{{.EventName}}</p>", {}), "<p>«EventName»</p>");
  });

  it("inserts a safeHTML value as markup, and nothing when it has none", () => {
    assert.equal(
      fillSampleValues("<div>{{safeHTML .BodyHtml}}</div><div>{{safeHTML .Footer}}</div>", {
        BodyHtml: "<p><strong>Kalın</strong></p>",
      }),
      "<div><p><strong>Kalın</strong></p></div><div></div>",
    );
  });

  it("shows a conditional section as if its value were present", () => {
    assert.equal(
      fillSampleValues("{{if .CtaUrl}}<a href=\"{{.CtaUrl}}\">Git</a>{{end}}", { CtaUrl: "https://skyl.app" }),
      '<a href="https://skyl.app">Git</a>',
    );
  });

  it("fills a subject the same way", () => {
    assert.equal(fillSampleValues("{{.Subject}}", { Subject: "GECEKODU başvuruları açıldı" }), "GECEKODU başvuruları açıldı");
  });
});
