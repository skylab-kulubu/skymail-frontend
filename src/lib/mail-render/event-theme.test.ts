/**
 * The event's theme (emails/theme.tsx, <Shell themed>): core sends each
 * participant mail Theme and EventBannerUrl, and a mail of an event themed
 * "artlab" opens with the event's banner (or the written band without one)
 * and takes ARTLAB's accent. For any other theme, and from a core that sends
 * no Theme, the mail is the same bytes as before: Go drops every
 * {{if}} … {{end -}} of the theme then and trims the white space after it, so
 * cutting those spans here is what a send does.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as React from "react";
import { templates } from "../../../emails";
import { EVENT_BANNER_URL, Paragraph, Shell, THEME, ifArtlabTheme } from "../../../emails/theme";
import { renderComponent } from ".";

/** The mails a participant of an event gets. */
const THEMED = [
  "event.ticket-created",
  "event.reminder",
  "event.ticket-cancelled",
  "event.updated",
  "core.certificate",
  "core.feedback-request",
  "core.feedback-reminder",
  "event.attendance-welcome",
  "event.attendance-recorded",
];

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every {{if}} … {{end -}} of the theme with the white space Go trims after it. */
const SPAN = new RegExp(`${escaped(ifArtlabTheme)}[\\s\\S]*?\\{\\{end -\\}\\}\\s*`, "g");

/** The mail as Go sends it for any theme but "artlab". */
const withoutTheme = (body: string) => body.replace(SPAN, "");

async function rendered(Component: React.ComponentType) {
  const result = await renderComponent(Component);
  assert.ok(result.ok, result.ok ? "" : result.message);
  return result;
}

describe("the event's theme", () => {
  it("reads the variables core sends, guarded for a send without them, in quotes React does not escape", () => {
    assert.equal(THEME, "Theme");
    assert.equal(EVENT_BANNER_URL, "EventBannerUrl");
    assert.equal(ifArtlabTheme, "{{if and .Theme (eq .Theme `artlab`)}}");
  });

  it("adds nothing outside its {{if}}s to the shell", async () => {
    // createElement, not JSX: the unit tests are .ts files.
    const h = React.createElement;
    const body = h(Paragraph, null, "Gövde.");
    const plain = () => h(Shell, { preview: "Önizleme.", reason: null, children: body });
    const themed = () => h(Shell, { preview: "Önizleme.", reason: null, themed: true, children: body });
    const before = await rendered(plain);
    const after = await rendered(themed);
    assert.equal(after.html.match(SPAN)?.length, 2, "biri <head>'de stil, biri gövdede bant");
    assert.equal(withoutTheme(after.html), before.html);
    assert.equal(withoutTheme(after.plainText), before.plainText);
  });

  for (const key of THEMED) {
    it(`frames ${key} for the ARTLAB theme and leaves it as it was for any other`, async () => {
      const template = templates.find(({ meta }) => meta.key === key);
      assert.ok(template, `${key} yok`);
      for (const name of ["EventName", THEME, EVENT_BANNER_URL]) {
        assert.ok(template.meta.variables.includes(name), `${key} ${name} değişkenini bildirmiyor`);
      }
      const required = (template.meta.requiredVariables ?? []).map(({ name }) => name);
      assert.ok(!required.includes(THEME) && !required.includes(EVENT_BANNER_URL), `${key}: tema zorunlu olmamalı (eski core göndermiyor)`);
      const { html, plainText } = await rendered(template.Component);

      const spans = html.match(SPAN) ?? [];
      assert.equal(spans.length, 2, `${key}: tema bir stil, bir bant olmalı`);
      const [style, band] = spans;
      assert.ok(html.indexOf(style) < html.indexOf("</head>"), `${key}: tema stili <head>'de değil`);
      assert.match(style, /^\{\{if[^}]*\}\}\s*<style>[\s\S]*\.email-bg \.t-link[\s\S]*<\/style>\s*\{\{end -\}\}\s*$/);

      // The banner when core sends its address, the written band when not.
      const img = /<img[^>]*>/.exec(band)?.[0] ?? "";
      assert.ok(band.includes(`{{if .${EVENT_BANNER_URL}}}`), `${key}: görsel koşulu yok`);
      assert.ok(img.includes(`src="{{.${EVENT_BANNER_URL}}}"`), `${key}: afiş görseli yok`);
      assert.ok(img.includes('alt="{{.EventName}}"'), `${key}: alt metin yok`);
      assert.ok(img.includes('width="472"'), `${key}: Outlook genişliği yok`);
      assert.ok(img.includes('fetchpriority="low"'), `${key}: görsel <head>'de önceden yüklenir`);
      const written = band.slice(band.indexOf("{{else}}"));
      assert.match(written, />\s*ARTLAB\s*<\/p>/, `${key}: yazılı bant yok`);
      assert.ok(written.includes("{{.EventName}}"), `${key}: yazılı bantta etkinlik adı yok`);
      assert.ok(band.includes('bgcolor="#0a1222"'), `${key}: koyu zemin yok`);
      assert.ok(band.includes('data-skip-in-text="true"'), `${key}: bant düz metne giriyor`);
      // The band comes first in the body, before the status line.
      assert.ok(html.indexOf(band) < html.indexOf(`class="tone-`), `${key}: bant gövdenin başında değil`);

      // Nothing of the theme outside its {{if}}s: no preload in the head, no stray reference.
      const otherwise = withoutTheme(html);
      for (const word of ["artlab", "ARTLAB", EVENT_BANNER_URL, `.${THEME}`, "#0a1222"]) {
        assert.ok(!otherwise.includes(word), `${key}: ${word} {{if}} dışında`);
      }

      // The plain text carries only the empty condition, which Go trims to nothing.
      assert.equal(plainText.match(SPAN)?.length, 1, `${key}: düz metinde koşul yok`);
      assert.ok(!withoutTheme(plainText).includes("ARTLAB"));
      assert.ok(!plainText.includes(EVENT_BANNER_URL));
    });
  }

  it("frames no other template", async () => {
    for (const { meta, Component } of templates) {
      if (THEMED.includes(meta.key)) continue;
      const { html } = await rendered(Component);
      assert.ok(!html.includes(`.${THEME}`) && !html.includes("ARTLAB"), `${meta.key} tema taşıyor`);
    }
  });
});
