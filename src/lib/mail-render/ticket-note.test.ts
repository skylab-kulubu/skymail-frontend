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

/** The HTML as a reader sees its text: comments React adds gone, white space as one space. */
const flat = (html: string) => html.replace(/<!-- -->/g, "").replace(/\s+/g, " ");

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

    it(`${key} puts the note in a box with a button to its WhatsApp group, a plain label for another address, none without one`, async () => {
      const whatsApp = flat((await received(key)).html);
      assert.match(whatsApp, /class="card note-box"/);
      assert.match(
        whatsApp,
        /class="btn-solid" align="center" bgcolor="#8f5e98"[^>]*> <a href="https:\/\/chat\.whatsapp\.com\/OrnekDavet123" class="btn-solid-text"[^>]*>WhatsApp grubuna katıl<\/a/,
      );
      const other = flat((await received(key, { TicketNoteLink: "https://artlab.example/program", TicketNoteWhatsApp: "" })).html);
      assert.match(other, /href="https:\/\/artlab\.example\/program" class="btn-solid-text"[^>]*>Bağlantıyı aç<\/a/);
      assert.doesNotMatch(other, /WhatsApp grubuna katıl/);
      // A core of before sends no TicketNoteLink: the note, no button.
      for (const mail of [await received(key, { TicketNoteLink: "" }), await received(key, {}, ["TicketNoteLink", "TicketNoteWhatsApp"])]) {
        assert.match(mail.html, /Duyuru/);
        assert.doesNotMatch(mail.html, /class="btn-solid"|WhatsApp grubuna katıl|Bağlantıyı aç/);
      }
    });

    it(`${key} links the place to its directions, and has a Yol Tarifi button`, async () => {
      const map = String(findTemplate(key)?.meta.sample.MapUrl);
      const html = flat((await received(key)).html);
      const linked = [map, map.replaceAll("&", "&amp;")].some((href) => html.includes(`<a href="${href}" class="t-link"`));
      assert.ok(linked, `${key}: Yer satırı yol tarifine gitmiyor`);
      assert.match(html, /class="t-link"[^>]*>YTÜ Davutpaşa Kampüsü, D-Blok<\/a/);
      assert.match(html, /Yol Tarifi/);
      const none = flat((await received(key, { MapUrl: "" })).html);
      assert.doesNotMatch(none, /Yol Tarifi|>YTÜ Davutpaşa Kampüsü, D-Blok<\/a/);
      assert.match(none, /YTÜ Davutpaşa Kampüsü, D-Blok/);
    });

    it(`${key} leaves the section out when the note is empty, or core sends none`, async () => {
      for (const mail of [
        await received(key, { TicketNote: "", TicketNoteParts: [], TicketNoteLink: "", TicketNoteWhatsApp: "" }),
        await received(key, {}, ["TicketNote", "TicketNoteParts", "TicketNoteLink", "TicketNoteWhatsApp"]),
      ]) {
        assert.doesNotMatch(mail.html, /Duyuru|chat\.whatsapp/);
        assert.doesNotMatch(mail.plainText, /Duyuru|chat\.whatsapp/);
      }
    });
  }
});
