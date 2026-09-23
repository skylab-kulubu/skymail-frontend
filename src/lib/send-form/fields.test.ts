/**
 * The variable fields a send asks for, built from the Mail template it sends:
 * its published body and subject, and its Required variables. Only a Required
 * variable's field keeps a send from going when empty — a mail without it
 * cannot do its job (CONTEXT.md). An empty field the subject uses, an address
 * that does not look like one or an empty announcement is warned about, as
 * the old form warned. A variable the body takes as markup (`safeHTML`) is
 * written in the Visual editor, one named like a link is an address. What the
 * mailer fills per recipient — Email, FullName — is not asked for.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVisual as b, visualSource } from "../mail-render/visual-document";
import { bodyVariables, fieldProblems, fieldValues, fieldWarnings, usesRecipientName, variableFields, type FieldInput } from "./fields";

/** free.basic as the Template seed publishes it, trimmed to its actions. */
const FREE_BASIC = {
  subject: "{{.Subject}}",
  html_content:
    '<html><body><p style="display:none">{{.Subject}}</p>{{if .Heading}}<h1 class="t-title">{{.Heading}}</h1>{{end}}' +
    '<div class="t-body">{{safeHTML .BodyHtml}}</div>{{if .CtaUrl}}<a href="{{.CtaUrl}}">{{if .CtaLabel}}{{.CtaLabel}}{{end}}</a>{{end}}' +
    "<p>Bu e-postayı SKY LAB üyesi olduğun için alıyorsun.</p></body></html>",
  contract_required_variables: [],
  operator_required_variables: [],
};

const CERTIFICATE = {
  subject: "{{.EventName}} sertifikan hazır",
  html_content: '<p>Merhaba {{.FullName}},</p><p>{{.EventName}} için sertifikan: <a href="{{.VerifyURL}}">gör</a></p>{{if .Note}}<p>{{.Note}}</p>{{end}}<p>{{.Email}}</p>',
  contract_required_variables: [{ name: "VerifyURL", reason: "Sertifika sayfasının adresi; kaldırılırsa katılımcı sertifikasına ulaşamaz." }],
  operator_required_variables: ["Note"],
};

describe("a template's variable fields", () => {
  it("are free.basic's in the order the mail uses them, the body as markup, the button's link as an address", () => {
    assert.deepEqual(
      variableFields(FREE_BASIC).map(({ name, label, kind, required, inSubject }) => ({ name, label, kind, required, inSubject })),
      [
        { name: "Subject", label: "Konu", kind: "text", required: false, inSubject: true },
        { name: "Heading", label: "Başlık", kind: "text", required: false, inSubject: false },
        { name: "BodyHtml", label: "Gövde", kind: "rich", required: false, inSubject: false },
        { name: "CtaUrl", label: "Buton bağlantısı", kind: "url", required: false, inSubject: false },
        { name: "CtaLabel", label: "Buton yazısı", kind: "text", required: false, inSubject: false },
      ],
    );
  });

  it("mark only Required variables required, and say why; leave out what the mailer fills", () => {
    assert.deepEqual(variableFields(CERTIFICATE), [
      { name: "EventName", label: "EventName", kind: "text", required: false, why: null, inSubject: true },
      {
        name: "VerifyURL",
        label: "VerifyURL",
        kind: "url",
        required: true,
        why: "Required variable: Sertifika sayfasının adresi; kaldırılırsa katılımcı sertifikasına ulaşamaz.",
        inSubject: false,
      },
      { name: "Note", label: "Note", kind: "text", required: true, why: "Required variable: bu template'te zorunlu işaretlenmiş.", inSubject: false },
    ]);
  });

  it("are none for a template that uses no variables", () => {
    assert.deepEqual(variableFields({ ...FREE_BASIC, subject: "Duyuru", html_content: "<p>Merhaba {{.FullName}}</p>" }), []);
  });

  it("know when the mail greets the recipient by name", () => {
    assert.equal(usesRecipientName(CERTIFICATE), true);
    assert.equal(usesRecipientName(FREE_BASIC), false);
  });
});

describe("the values a send carries", () => {
  const fields = variableFields(FREE_BASIC);
  const body = visualSource(b.document([b.paragraph([b.text("Merhaba "), b.text("herkes", [{ type: "bold" }])])]));
  const input = (values: Record<string, string>): FieldInput => ({ values, rich: { BodyHtml: body } });

  it("are every field's, trimmed, with a markup field as its rendered body", () => {
    assert.deepEqual(bodyVariables(fields, input({ Subject: "  GECEKODU  ", CtaUrl: " https://skyl.app/g " })), {
      ok: true,
      variables: {
        Subject: "GECEKODU",
        Heading: "",
        BodyHtml: "<p>Merhaba <strong>herkes</strong></p>",
        CtaUrl: "https://skyl.app/g",
        CtaLabel: "",
      },
    });
  });

  it("are what each field would carry now, a body that cannot go out as none, for the preview", () => {
    const broken = visualSource(b.document([b.paragraph([b.text("x", [{ type: "link", href: "https://ornek.com/%zz" }])])]));
    assert.deepEqual(fieldValues(fields, { values: { Subject: " Duyuru ", Heading: "x" }, rich: { BodyHtml: broken } }), {
      Subject: "Duyuru",
      Heading: "x",
      BodyHtml: "",
      CtaUrl: "",
      CtaLabel: "",
    });
  });

  it("are refused only while a Required variable is empty, or the body cannot go out", () => {
    const broken = visualSource(b.document([b.paragraph([b.text("x", [{ type: "link", href: "https://ornek.com/%zz" }])])]));
    assert.deepEqual(fieldProblems(fields, { values: { Subject: " ", CtaUrl: "skyl.app" }, rich: { BodyHtml: broken } }), {
      BodyHtml: 'Gövde gönderilemez: blocks[0].content[0]: "https://ornek.com/%zz" adresini sunucu kabul etmiyor; mailde bağlantı düşer. Adresi düzelt.',
    });
    assert.deepEqual(fieldProblems(fields, { values: {}, rich: {} }), {});
    const certificate = variableFields(CERTIFICATE);
    assert.deepEqual(fieldProblems(certificate, { values: { Note: "x" }, rich: {} }), { VerifyURL: "VerifyURL boş bırakılamaz: bir Required variable." });
    assert.equal(bodyVariables(certificate, { values: { Note: "x" }, rich: {} }).ok, false);
    assert.equal(bodyVariables(certificate, { values: { Note: "x", VerifyURL: "https://skyl.app/v" }, rich: {} }).ok, true);
  });

  it("are warned about, not refused: an empty field the subject uses, an address that is not one, an empty announcement", () => {
    const empty = visualSource(b.document([b.paragraph([])]));
    assert.deepEqual(fieldWarnings(fields, { values: { Subject: " ", CtaUrl: "skyl.app" }, rich: { BodyHtml: empty } }, { expected: ["BodyHtml"] }), {
      Subject: "Konuda geçiyor: boş giderse konu eksik görünür.",
      CtaUrl: 'Bir adres gibi görünmüyor: "skyl.app" bir adres değil.',
      BodyHtml: "Gövde boş: duyuru metinsiz gider.",
    });
    assert.deepEqual(fieldWarnings(fields, input({ Subject: "GECEKODU", CtaUrl: "https://skyl.app/g" }), { expected: ["BodyHtml"] }), {});
    // A Required variable that is empty is a problem, not a warning; one that is filled in is checked as an address too.
    const certificate = variableFields(CERTIFICATE);
    assert.deepEqual(fieldWarnings(certificate, { values: { EventName: "GECEKODU" }, rich: {} }), {});
    assert.deepEqual(fieldWarnings(certificate, { values: { EventName: "GECEKODU", VerifyURL: "sertifika" }, rich: {} }), {
      VerifyURL: 'Bir adres gibi görünmüyor: "sertifika" bir adres değil.',
    });
  });
});
