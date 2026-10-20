/**
 * The mails SKY LAB Forms sends by key (forms-backend FormMailNotifier, keys
 * from FormMailOptions). Their bodies are Fatih's (forms-frontend
 * mail-templates/); the seed writes them from emails/. Forms passes exactly the
 * variables listed here, so a template that reads another one would print
 * `<no value>` in the plain text, and one that drops one would lose what Forms
 * sends. Each status and each kind Forms sends must say its own title.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findTemplate } from "../../../emails";
import { fillSampleValues, referencedVariables, renderComponent } from ".";

/** What FormMailNotifier passes for each key, beside Email and FullName; firstName and recipientName come from MailNames. */
const FORMS_SENDS: Record<string, string[]> = {
  "forms.status-changed": ["formTitle", "status", "reviewNote", "reviewedAt", "nextFormId", "questionCount", "firstName", "recipientName"],
  "forms.attempt-update": ["formTitle", "formId", "kind", "deadlineAt", "minutes", "duration", "nextFormId", "firstName", "recipientName"],
};

/** Read by the body but no longer sent: the old two-form chaining's next form, which the body still falls back to. */
const LEGACY: Record<string, string[]> = { "forms.status-changed": ["linkedFormId"], "forms.attempt-update": [] };

async function rendered(key: string) {
  const template = findTemplate(key);
  assert.ok(template, `${key} is not in emails/index.ts`);
  const result = await renderComponent(template.Component);
  assert.ok(result.ok, `${key} does not render`);
  return { meta: template.meta, html: result.html, plainText: result.plainText };
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;|&#39;/g, "'").replace(/\s+/g, " ");

describe("the Forms mails", () => {
  for (const [key, sends] of Object.entries(FORMS_SENDS)) {
    const variables = [...sends, ...LEGACY[key]];
    it(`${key} is a System template in the Forms brand, visible to operators, reading what Forms sends`, async () => {
      const { meta, html } = await rendered(key);
      assert.equal(meta.system, true);
      // No code or one-time link: an operator may read a send.
      assert.equal(meta.contentSensitive, false);
      assert.equal(meta.brand, "forms");
      assert.deepEqual([...meta.variables].sort(), [...variables].sort());
      assert.deepEqual(Object.keys(meta.sample).sort(), [...variables].sort());
      const referenced = [...referencedVariables(html)].filter((name) => name !== "Email" && name !== "FullName");
      assert.deepEqual(referenced.sort(), [...variables].sort());
    });
  }

  const base = { formTitle: "Başvuru 2026", firstName: "Ayşe", recipientName: "Ayşe Yılmaz", reviewedAt: "04 Ekim 2026, 22:10" };
  const statuses: { status: string; title: string; not: string[] }[] = [
    // The preview here shows every `if $next` as true; the mailer's own run (skymail-backend) picks the title.
    { status: "approved", title: "cevabınızı inceledik ve onayladık", not: ["kabul edilmedi", "düzeltme istendi", "Yeniden başvurabilirsiniz"] },
    { status: "declined", title: "Cevabınız kabul edilmedi", not: ["onaylandı", "düzeltme istendi", "Yeniden başvurabilirsiniz"] },
    { status: "returned", title: "Cevabınızda düzeltme istendi", not: ["onaylandı", "kabul edilmedi", "Yeniden başvurabilirsiniz"] },
    { status: "reopened", title: "Yeniden başvurabilirsiniz", not: ["onaylandı", "kabul edilmedi", "düzeltme istendi"] },
  ];
  for (const { status, title, not } of statuses) {
    it(`forms.status-changed says "${title}" for ${status}`, async () => {
      const { html } = await rendered("forms.status-changed");
      const shown = text(fillSampleValues(html, { ...base, status, reviewNote: "Not", nextFormId: "" }));
      assert.ok(shown.includes(title), `missing "${title}" in ${shown}`);
      assert.ok(shown.includes("Merhaba Ayşe,"), shown);
      for (const phrase of not) assert.ok(!shown.includes(phrase), `unexpected "${phrase}" in ${shown}`);
    });
  }

  it("each subject says the title of its status or kind", async () => {
    const subjects: [string, Record<string, unknown>, string][] = [
      ["forms.status-changed", { status: "approved", nextFormId: "n" }, "Sonraki adıma geçtiniz · Başvuru 2026"],
      // approved without a next step ("Cevabınız onaylandı") branches on `or`, which the preview shows as true; the mailer's own run checks it.
      ["forms.status-changed", { status: "declined" }, "Cevabınız kabul edilmedi · Başvuru 2026"],
      ["forms.status-changed", { status: "returned" }, "Cevabınızda düzeltme istendi · Başvuru 2026"],
      ["forms.status-changed", { status: "reopened" }, "Yeniden başvurabilirsiniz · Başvuru 2026"],
      ["forms.attempt-update", { kind: "reminder" }, "Görevi henüz başlatmadınız · Başvuru 2026"],
      ["forms.attempt-update", { kind: "extended" }, "Sürenizi uzattık · Başvuru 2026"],
      ["forms.attempt-update", { kind: "expired" }, "Süreniz doldu · Başvuru 2026"],
      ["forms.attempt-update", { kind: "expiredEmpty" }, "Süreniz doldu · Başvuru 2026"],
      ["forms.attempt-update", { kind: "accepted" }, "Tesliminiz kabul edildi · Başvuru 2026"],
      ["forms.attempt-update", { kind: "closed" }, "Tesliminiz kabul edilmedi · Başvuru 2026"],
    ];
    for (const [key, values, subject] of subjects) {
      const { meta } = await rendered(key);
      assert.equal(fillSampleValues(meta.subject, { formTitle: "Başvuru 2026", ...values }, { as: "text" }), subject);
    }
  });

  it("forms.status-changed links the next form and keeps the review note's lines", async () => {
    const { html } = await rendered("forms.status-changed");
    assert.ok(html.includes('href="https://forms.yildizskylab.com/{{$next}}"'), "the next step's link is not the next form");
    assert.ok(html.includes("{{$next := or .nextFormId .linkedFormId}}"), "$next is not set before its use");
    assert.ok(html.includes("white-space:pre-wrap"), "the review note loses its line breaks");
  });

  const kinds: { kind: string; title: string }[] = [
    { kind: "reminder", title: "Görevi henüz başlatmadınız" },
    { kind: "extended", title: "Sürenizi uzattık" },
    { kind: "expired", title: "O ana kadar girdiğiniz cevaplar bize ulaştı" },
    { kind: "expiredEmpty", title: "hiç cevap girilmemişti" },
    { kind: "accepted", title: "Tesliminiz kabul edildi" },
    { kind: "closed", title: "Tesliminiz kabul edilmedi" },
  ];
  for (const { kind, title } of kinds) {
    it(`forms.attempt-update says "${title}" for ${kind}, and only that`, async () => {
      const { html } = await rendered("forms.attempt-update");
      const shown = text(fillSampleValues(html, { ...base, kind, formId: "f1", minutes: 90, duration: "1 saat 30 dakika", deadlineAt: "06 Ekim 2026, 18:00", nextFormId: "" }));
      assert.ok(shown.includes(title), `missing "${title}" in ${shown}`);
      for (const other of kinds.filter((k) => k.kind !== kind && !title.includes(k.title) && !k.title.includes(title))) {
        assert.ok(!shown.includes(other.title), `unexpected "${other.title}" for ${kind} in ${shown}`);
      }
    });
  }

  it("the inbox line goes whole, with every action it branches on", async () => {
    for (const key of Object.keys(FORMS_SENDS)) {
      const html = (await rendered(key)).html.replace(/\s+/g, " ");
      assert.ok(html.includes("{{else if eq ." + (key === "forms.status-changed" ? "status `reopened`}}için yeniden başvurabilirsiniz" : "kind `closed`}}Süre dolduğunda")), `${key}: the preview was cut`);
    }
  });
});
