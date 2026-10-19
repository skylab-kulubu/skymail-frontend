import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findTemplate } from "../../../emails";
import { fillSampleValues, referencedVariables, renderComponent } from ".";

// core-backend/internal/mail/mail.go: present even when their values are empty.
const CORE_SENDS = ["FirstName", "LastName", "Email", "Username", "SchoolEmail", "SkyNumber", "CreatedAt"];

async function rendered() {
  const template = findTemplate("core.welcome");
  assert.ok(template);
  const result = await renderComponent(template.Component);
  assert.ok(result.ok, "core.welcome does not render");
  return { meta: template.meta, html: result.html, plainText: result.plainText };
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;|&#39;/g, "'").replace(/\s+/g, " ");

const sample = {
  FirstName: "Örnek", LastName: "Kullanıcı", Email: "ornek@example.com",
  Username: "ornek.kullanici2", SchoolEmail: "", SkyNumber: "SKY-0042", CreatedAt: "2026-10-16T09:00:00Z",
};

describe("the welcome mail", () => {
  it("declares only what core sends, including optional identity values", async () => {
    const { meta, html } = await rendered();
    assert.equal(meta.system, true);
    assert.equal(meta.brand, "skylab");
    assert.equal(meta.contentSensitive, false);
    assert.deepEqual(meta.requiredVariables, []);
    assert.deepEqual([...meta.variables].sort(), [...CORE_SENDS].sort());
    assert.deepEqual(Object.keys(meta.sample).sort(), [...CORE_SENDS].sort());
    assert.deepEqual([...referencedVariables(html)].sort(), [...CORE_SENDS].sort());
    assert.ok(!meta.subject.includes("{{"));
  });

  for (const SchoolEmail of ["", "ornek@std.yildiz.edu.tr"]) {
    it(`names the sign-in ways and ${SchoolEmail ? "omits" : "offers"} school linking`, async () => {
      const { html, plainText } = await rendered();
      for (const body of [text(fillSampleValues(html, { ...sample, SchoolEmail })), fillSampleValues(plainText, { ...sample, SchoolEmail }, { as: "text" })]) {
        for (const phrase of ["YTÜ hesabı", "e-posta kodu", "passkey", "Parola isteğe bağlı.", "ornek.kullanici2", "Kişisel e-posta ekle", "my.yildizskylab.com/email"]) {
          assert.ok(body.includes(phrase), `missing ${phrase}`);
        }
        assert.equal(body.includes("YTÜ hesabını bağla"), SchoolEmail === "");
        // Only what the member needs (Yusuf, 2026-10-19): no reassurance, no promotion, no "why you got this".
        for (const phrase of ["Microsoft görür", "ekosistem", "alıyorsun", "Bölümün otomatik gelir"]) {
          assert.ok(!body.includes(phrase), `still says ${phrase}`);
        }
        assert.ok(!body.includes("{{") && !body.includes("«"), "unresolved template action or sample value");
      }
    });
  }

  it("omits an unavailable username for an older core sender", async () => {
    const { html, plainText } = await rendered();
    const olderSample: Record<string, string> = { ...sample };
    delete olderSample.Username;
    delete olderSample.SchoolEmail;
    for (const body of [text(fillSampleValues(html, olderSample)), fillSampleValues(plainText, olderSample, { as: "text" })]) {
      assert.ok(!body.includes("Kullanıcı adı"));
      assert.ok(!body.includes("«Username»"));
      assert.ok(body.includes("YTÜ hesabını bağla"));
    }
  });

  it("escapes the identity value and links directly to the privacy notice", async () => {
    const { html } = await rendered();
    const filled = fillSampleValues(html, { ...sample, Username: "<img src=x onerror=alert(1)>" });
    assert.ok(filled.includes("&lt;img"));
    assert.ok(!filled.includes("<img src=x"));
    assert.ok(filled.includes('href="https://yildizskylab.com/kvkk-metni.pdf"'));
    assert.ok(filled.includes('href="https://my.yildizskylab.com/email?intent=add-personal"'));
    assert.ok(!filled.includes("https://skyl.app/kvkk-metni"));
  });
});
