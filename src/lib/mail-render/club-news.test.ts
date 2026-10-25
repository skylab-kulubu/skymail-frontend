/**
 * club.news (duyuru-haber 06): a News record as mail. skymail-backend
 * (internal/news Variables) writes the send's variables; core's audience
 * gives each recipient AudienceReason, CategoryLabel and UnsubscribeUrl. The
 * body is the record's whole text with FullBody, else its summary.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findTemplate } from "../../../emails";
import { findActions } from "./go-template";
import { fillSampleValues, referencedVariables, renderComponent } from ".";

async function rendered() {
  const template = findTemplate("club.news");
  assert.ok(template, "club.news");
  const result = await renderComponent(template.Component);
  assert.ok(result.ok, "club.news does not render");
  return { meta: template.meta, html: result.html, plainText: result.plainText };
}

const actionsOf = (body: string) => findActions(body).map(({ start, end }) => body.slice(start, end).replace(/\s+/g, ""));

describe("club.news", () => {
  it("is a System template, not sensitive, whose contract is ReadMoreUrl and UnsubscribeUrl", async () => {
    const { meta, html } = await rendered();
    assert.equal(meta.system, true);
    assert.equal(meta.contentSensitive, false);
    assert.equal(meta.subject, "{{.Subject}}");
    assert.deepEqual((meta.requiredVariables ?? []).map(({ name }) => name), ["ReadMoreUrl", "UnsubscribeUrl"]);
    // Subject is the subject's alone; the body reads every other variable.
    assert.deepEqual([...referencedVariables(html)].sort(), meta.variables.filter((name) => name !== "Subject").sort());
  });

  it("prints the body with safeHTML only with FullBody, else the summary", async () => {
    const { html } = await rendered();
    const actions = actionsOf(html);
    const open = actions.indexOf("{{if.FullBody}}");
    assert.ok(open >= 0, "no FullBody branch");
    const otherwise = actions.indexOf("{{else}}", open);
    const close = actions.indexOf("{{end}}", otherwise);
    assert.deepEqual(actions.slice(open + 1, otherwise), ["{{safeHTML.BodyHtml}}"]);
    assert.deepEqual(actions.slice(otherwise + 1, close), ["{{.Summary}}"]);
    assert.equal(actions.filter((action) => action.includes("BodyHtml")).length, 1);
  });

  it("says in the footer why this reader got it, beside their way out of that category", async () => {
    const { meta, html, plainText } = await rendered();
    const filled = fillSampleValues(html, meta.sample);
    assert.match(filled, /Bu e-postayı\s+SKY LAB üyesi olduğun için alıyorsun\s+\(Kulüp geneli · Duyurular\)\./);
    assert.ok(plainText.includes("{{if .AudienceReason}}Bu e-postayı {{.AudienceReason}} alıyorsun{{if .CategoryLabel}} ({{.CategoryLabel}}){{end}}.{{end}}"));
    assert.match(filled, /Gönderen: SKY LAB, Yıldız Teknik Üniversitesi ·\s*(<!-- -->)?\s*<a[^>]*href="mailto:info@yildizskylab.com"/);
    assert.match(html, /href="\{\{\.UnsubscribeUrl\}\}"/);
    assert.match(html, /href="\{\{\.ReadMoreUrl\}\}"/);
    assert.ok(plainText.includes("Sitede oku"));
    assert.ok(plainText.includes("{{.ReadMoreUrl}}"));
  });

  it("shows the cover and the button only when the send has them", async () => {
    const { html } = await rendered();
    assert.match(html, /\{\{if \.HeroUrl\}\}\s*<div[^>]*>\s*<img\s+alt="\{\{\.HeroAlt\}\}"\s+src="\{\{\.HeroUrl\}\}"[^>]*>\s*<\/div>\s*\{\{end\}\}/);
    assert.match(html, /\{\{if \.CtaHref\}\}[\s\S]*href="\{\{\.CtaHref\}\}"[\s\S]*\{\{\.CtaLabel\}\}[\s\S]*\{\{end\}\}/);
  });

  it("prints no reason sentence when core gave none", async () => {
    const { meta, html } = await rendered();
    const filled = fillSampleValues(html, { ...meta.sample, AudienceReason: "", CategoryLabel: "" });
    assert.ok(!filled.includes("Bu e-postayı"), "an empty reason left its sentence");
    assert.ok(!filled.includes("()"));
  });

  it("wraps long preformatted lines instead of widening the column", async () => {
    const { html } = await rendered();
    assert.match(html, /\.free-body pre \{[^}]*white-space: pre-wrap;[^}]*word-break: break-word;/);
    assert.match(html, /\.free-body code \{[^}]*monospace/);
    assert.match(html, /\.free-body hr \{/);
  });
});
