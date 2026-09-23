/**
 * The variable fields a send asks for, built from the Mail template it sends:
 * its published body and subject, and its Required variables. A Required
 * variable's field is required and says why; so is one the subject uses. A
 * variable the body takes as markup (`safeHTML`) is written in the Visual
 * editor, one named like a link is an address. What the mailer fills per
 * recipient — Email, FullName — is not asked for.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVisual as b, visualSource } from "../mail-render/visual-document";
import { bodyVariables, fieldProblems, usesRecipientName, variableFields, type FieldInput } from "./fields";

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
      variableFields(FREE_BASIC).map(({ name, label, kind, required }) => ({ name, label, kind, required })),
      [
        { name: "Subject", label: "Konu", kind: "text", required: true },
        { name: "Heading", label: "Başlık", kind: "text", required: false },
        { name: "BodyHtml", label: "Gövde", kind: "rich", required: false },
        { name: "CtaUrl", label: "Buton bağlantısı", kind: "url", required: false },
        { name: "CtaLabel", label: "Buton yazısı", kind: "text", required: false },
      ],
    );
  });

  it("mark Required variables required and say why, and the subject's too; leave out what the mailer fills", () => {
    assert.deepEqual(variableFields(CERTIFICATE), [
      { name: "EventName", label: "EventName", kind: "text", required: true, why: "Konuda geçiyor: boş kalırsa konu eksik görünür." },
      {
        name: "VerifyURL",
        label: "VerifyURL",
        kind: "url",
        required: true,
        why: "Required variable: Sertifika sayfasının adresi; kaldırılırsa katılımcı sertifikasına ulaşamaz.",
      },
      { name: "Note", label: "Note", kind: "text", required: true, why: "Required variable: bu template'te zorunlu işaretlenmiş." },
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

  it("are refused while a required field is empty, an address is not one, or the body cannot go out", () => {
    const broken = visualSource(b.document([b.paragraph([b.text("x", [{ type: "link", href: "https://ornek.com/%zz" }])])]));
    assert.deepEqual(fieldProblems(fields, { values: { Subject: " ", CtaUrl: "skyl.app" }, rich: { BodyHtml: broken } }), {
      Subject: "Konu boş bırakılamaz.",
      CtaUrl: 'Geçerli bir adres gir: "skyl.app" bir adres değil.',
      BodyHtml: 'Gövde gönderilemez: blocks[0].content[0]: "https://ornek.com/%zz" adresini sunucu kabul etmiyor; mailde bağlantı düşer. Adresi düzelt.',
    });
    assert.deepEqual(fieldProblems(fields, input({ Subject: "GECEKODU" })), {});
    assert.equal(bodyVariables(fields, { values: {}, rich: {} }).ok, false);
  });

  it("need the body when the send needs one, and see an empty document as none", () => {
    const empty = visualSource(b.document([b.paragraph([])]));
    assert.deepEqual(fieldProblems(fields, { values: { Subject: "x" }, rich: { BodyHtml: empty } }, { require: ["BodyHtml"] }), {
      BodyHtml: "Gövde boş bırakılamaz.",
    });
  });
});
