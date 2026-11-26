/**
 * The organizer's announcement in the ticket mails (core-backend
 * docs/ticket-note.md; Yusuf, 2026-11-26): core sends TicketNote and
 * TicketNoteParts, the note cut at its https addresses. The mail shows it
 * under "Duyuru" with its links, and leaves it out when it is empty or core
 * sends neither.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findTemplate } from "../../../emails";
import { fillSampleValues, renderComponent } from ".";

const KEYS = ["event.ticket-created", "event.waitlist-promoted", "event.reminder"];

async function received(key: string, vars: Record<string, unknown> = {}, drop: string[] = []) {
  const template = findTemplate(key);
  assert.ok(template, `${key} yok`);
  const result = await renderComponent(template.Component);
  assert.ok(result.ok, `${key} render edilmedi`);
  const all: Record<string, unknown> = { ...template.meta.sample, ...vars };
  for (const name of drop) delete all[name];
  return { html: fillSampleValues(result.html, all), plainText: fillSampleValues(result.plainText, all, { as: "text" }) };
}

describe("the ticket note (Duyuru)", () => {
  for (const key of KEYS) {
    it(`${key} shows the note under Duyuru, its parts as links where core gave an address`, async () => {
      const template = findTemplate(key);
      assert.ok(template);
      const result = await renderComponent(template.Component);
      assert.ok(result.ok);
      // The parts keep the note's lines; a part with Url is a link, the rest text (as the welcome's note).
      const gap = String.raw`(?:\s|<!-- -->)*`;
      assert.match(
        result.html,
        new RegExp(
          String.raw`\{\{if \.TicketNote\}\}[\s\S]*Duyuru[\s\S]*white-space:pre-wrap[^>]*>` + gap +
            String.raw`\{\{range \.TicketNoteParts\}\}` + gap + String.raw`\{\{if \.Url\}\}` + gap +
            String.raw`<a[^>]*href="\{\{\.Url\}\}"[^>]*>\{\{\.Text\}\}</a>` + gap + String.raw`\{\{else\}\}` + gap +
            String.raw`\{\{\.Text\}\}` + gap + String.raw`\{\{end\}\}` + gap + String.raw`\{\{end\}\}`,
        ),
      );
      assert.match(result.plainText, /\{\{if \.TicketNote\}\}[\s\S]*Duyuru[\s\S]*\{\{range \.TicketNoteParts\}\}\{\{if \.Url\}\}/);
      const { html } = await received(key);
      assert.match(html, /Duyuru/);
    });

    it(`${key} leaves the section out when the note is empty, or core sends none`, async () => {
      for (const mail of [await received(key, { TicketNote: "", TicketNoteParts: [] }), await received(key, {}, ["TicketNote", "TicketNoteParts"])]) {
        assert.doesNotMatch(mail.html, /Duyuru|chat\.whatsapp/);
        assert.doesNotMatch(mail.plainText, /Duyuru|chat\.whatsapp/);
      }
    });
  }
});
