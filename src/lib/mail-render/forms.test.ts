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
  // NotifyResponseCopyAsync; answers is a list of { question, answer }.
  "forms.form-copy": ["formTitle", "submittedAt", "answers", "firstName", "recipientName"],
  // PendingResponseReminderWorker; forms is a list of { formId, formTitle, pendingCount }.
  "forms.pending-reminder": ["totalPending", "forms", "firstName", "recipientName"],
};

/** Mails whose content is the recipient's alone: the form copy's answers, the status mail's review note. */
const SENSITIVE = new Set(["forms.form-copy", "forms.status-changed"]);

/** Read by the body but no longer sent: the old two-form chaining's next form, which the body still falls back to. */
const LEGACY: Record<string, string[]> = { "forms.status-changed": ["linkedFormId"], "forms.attempt-update": [], "forms.form-copy": [], "forms.pending-reminder": [] };

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
      // No code or one-time link; the person's answers and the team's note
      // about them are for the recipient alone, so those sends stay masked.
      assert.equal(meta.contentSensitive, SENSITIVE.has(key));
      assert.equal(meta.brand, "forms");
      assert.deepEqual([...meta.variables].sort(), [...variables].sort());
      assert.deepEqual(Object.keys(meta.sample).sort(), [...variables].sort());
      const referenced = [...referencedVariables(html)].filter((name) => !["Email", "FullName", "UnsubscribeUrl"].includes(name));
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
      ["forms.form-copy", {}, "Cevabınızı aldık · Başvuru 2026"],
      ["forms.pending-reminder", { totalPending: 7 }, "İncelemeni bekleyen 7 cevap var"],
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

  // pre-wrap shows every space and line break the formatter would put around
  // the note: an empty first line, an indent of forty spaces, an empty last line.
  it("forms.status-changed keeps the review note against its tags", async () => {
    const { html } = await rendered("forms.status-changed");
    assert.ok(html.includes('pre-wrap">{{.reviewNote}}</p>'), "the review note is not against its tags");
    assert.ok(html.includes('pre-wrap">Not bırakılmadı.</p>'), "the empty note is not against its tags");
    // forms.form-copy's answer keeps its lines too: an answer is typed in a text area.
    const preWrap: Record<string, number> = { "forms.status-changed": 2, "forms.form-copy": 1 };
    for (const key of Object.keys(FORMS_SENDS)) {
      const notes = [...(await rendered(key)).html.matchAll(/white-space:pre-wrap">([^<]*)</g)].map((match) => match[1]);
      assert.equal(notes.length, preWrap[key] ?? 0, `${key}: pre-wrap notes`);
      for (const note of notes) assert.equal(note, note.trim(), `${key}: "${note}" has whitespace around it`);
    }
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
    for (const key of ["forms.status-changed", "forms.attempt-update"]) {
      const html = (await rendered(key)).html.replace(/\s+/g, " ");
      assert.ok(html.includes("{{else if eq ." + (key === "forms.status-changed" ? "status `reopened`}}için yeniden başvurabilirsiniz" : "kind `closed`}}Süre dolduğunda")), `${key}: the preview was cut`);
    }
  });

  // Inside a range dot is the element: .question and .answer, .formId,
  // .formTitle and .pendingCount are its fields, not variables Forms sends
  // (the test above), and the preview leaves the rows as written.
  it("forms.form-copy lists every answer, numbered, an empty one as left blank", async () => {
    const { html, meta } = await rendered("forms.form-copy");
    for (const part of [
      "{{range $index, $answer := .answers}}",
      "{{printf `%02d` (add1 $index)}}",
      "{{.question}}",
      'pre-wrap">{{if .answer}}{{.answer}}{{else}}<span',
      "Boş bırakıldı",
    ]) {
      assert.ok(html.includes(part), `missing ${part}`);
    }
    const shown = text(fillSampleValues(html, meta.sample));
    assert.ok(shown.includes("Merhaba Ayşe, cevabınız bize ulaştı."), shown);
    assert.ok(shown.includes("Cevaplarınız 3 soru"), `the answer count: ${shown}`);
    assert.ok(shown.includes("{{range $index, $answer := .answers}}"), "the preview does not leave the rows as written");
  });

  it("forms.pending-reminder links each form's responses and the panel", async () => {
    const { html, meta, plainText } = await rendered("forms.pending-reminder");
    assert.ok(html.includes("{{range .forms}}"), "the forms are not listed");
    assert.ok(html.includes('href="https://forms.yildizskylab.com/admin/forms/{{.formId}}/responses"'), "a form does not link its responses");
    assert.ok(html.includes('href="https://forms.yildizskylab.com/admin/forms"'), "no link to the panel");
    const shown = text(fillSampleValues(html, meta.sample));
    assert.ok(shown.includes("İncelemeni bekleyen 7 cevap var"), shown);
    assert.ok(shown.includes("Formlar 2 form"), `the form count: ${shown}`);
    assert.ok(plainText.includes("/responses {{.pendingCount}} bekliyor {{end}}"), `the address runs into the count, or a row into the next: ${plainText}`);
    assert.ok(plainText.includes("Formlar {{len .forms}} form"), plainText);
  });
});
