/**
 * club.management-term (grup-yonetimi 11, core-backend
 * docs/management-membership-terms.md "Mails"): one template, three notices.
 * core's internal/membershipterm sends every variable below, always, empty
 * when it does not apply; Notice says which mail it is:
 *   warning        14 days or 1 day before a YK, DK or Team Leader term
 *                  ends, to the holder (Self "yes") and those over them;
 *   expired-list   the terms marked expired, to every member of ADMIN;
 *   weekly-summary expired terms still in their Groups, by Group, to ADMIN.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findTemplate } from "../../../emails";
import { fillSampleValues, referencedVariables, renderComponent } from ".";

const KEY = "club.management-term";

/** What core-backend's membershipterm.Service.vars passes, beside Email and FullName. */
const CORE_SENDS = ["Count", "DaysLeft", "EndsAt", "GroupId", "GroupName", "Items", "Notice", "Role", "Self", "SubjectName"];

async function rendered() {
  const template = findTemplate(KEY);
  assert.ok(template, `${KEY} is not in emails/index.ts`);
  const result = await renderComponent(template.Component);
  assert.ok(result.ok, `${KEY} does not render`);
  return { meta: template.meta, html: result.html, plainText: result.plainText };
}

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .replace(/ ([,.;)])/g, "$1");

const empty = { Notice: "", DaysLeft: "", Self: "no", SubjectName: "", GroupName: "", GroupId: "", Role: "", EndsAt: "", Count: "", Items: "" };

/** The mail as a person reads it with exactly these values, as core sends them. */
async function received(vars: Record<string, string>) {
  const { html, plainText, meta } = await rendered();
  const all = { ...empty, ...vars };
  return {
    subject: fillSampleValues(meta.subject, all, { as: "text" }),
    rawHtml: fillSampleValues(html, all),
    html: text(fillSampleValues(html, all)),
    plainText: fillSampleValues(plainText, all, { as: "text" }),
  };
}

const warning = {
  Notice: "warning",
  DaysLeft: "14",
  GroupName: "YK · Yönetim Kurulu",
  GroupId: "g-yk",
  Role: "board",
  EndsAt: "31.05.2027",
};

describe("the management term mail", () => {
  it("is a System template reading exactly what core sends", async () => {
    const { meta, html } = await rendered();
    assert.equal(meta.system, true);
    // Names, Groups and dates: no code or link that acts as the recipient.
    assert.equal(meta.contentSensitive, false);
    assert.equal(meta.notification, undefined);
    assert.deepEqual([...meta.variables].sort(), CORE_SENDS);
    assert.deepEqual(Object.keys(meta.sample).sort(), CORE_SENDS);
    assert.deepEqual((meta.requiredVariables ?? []).map(({ name }) => name), ["Notice"]);
    assert.equal(meta.sensitiveVariables, undefined);
    const referenced = [...referencedVariables(html)].filter((name) => name !== "UnsubscribeUrl");
    assert.deepEqual(referenced.sort(), CORE_SENDS);
    // The subject reads only Notice and Self, which core always fills.
    const subjectVars = [...meta.subject.matchAll(/\.([A-Za-z]+)/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(subjectVars)].sort(), ["Notice", "Self"]);
  });

  it("warns the holder: the end, the days left, and whom to ask for an extension", async () => {
    const mail = await received({ ...warning, Self: "yes", SubjectName: "Ada Lovelace" });
    assert.equal(mail.subject, "Yönetim görevinin süresi doluyor");
    for (const body of [mail.html, mail.plainText]) {
      assert.match(body, /YK · Yönetim Kurulu grubundaki üyeliğinin süresi 31\.05\.2027 tarihinde doluyor; 14 gün kaldı\./);
      assert.match(body, /Süre dolunca üyelik kendiliğinden kalkmaz/);
      assert.match(body, /Süreni kendin uzatamazsın\. Uzatma ya da devir için Yönetim Kurulu'na ya da yönetici grubuna \(ADMIN\) başvur\./);
      assert.doesNotMatch(body, /Ada Lovelace/);
      assert.doesNotMatch(body, /yetkin varsa/);
    }
    for (const body of [mail.rawHtml, mail.plainText]) {
      assert.match(body, /https:\/\/admin\.yildizskylab\.com\/groups\/g-yk/);
    }
  });

  it("tells a Team Leader to ask YK or the Team above", async () => {
    const mail = await received({ ...warning, Self: "yes", Role: "team-leaders", GroupName: "LIDERLER", DaysLeft: "1" });
    for (const body of [mail.html, mail.plainText]) {
      assert.match(body, /1 gün kaldı\./);
      assert.match(body, /Uzatma ya da devir için Yönetim Kurulu'na ya da varsa üst ekibin liderlerine başvur\./);
      assert.doesNotMatch(body, /ADMIN/);
    }
  });

  it("names the holder to those over them, and leaves the change to whoever may make it", async () => {
    const mail = await received({ ...warning, Self: "no", SubjectName: "Ada Lovelace", Role: "audit", GroupName: "DK · Denetim Kurulu" });
    assert.equal(mail.subject, "Bir yönetim üyeliğinin süresi doluyor");
    for (const body of [mail.html, mail.plainText]) {
      assert.match(body, /Ada Lovelace adlı kişinin DK · Denetim Kurulu grubundaki üyeliğinin süresi 31\.05\.2027 tarihinde doluyor; 14 gün kaldı\./);
      assert.match(body, /Bu grubun üyeliğini değiştirme yetkin varsa süreyi uzatabilir ya da görevi devredebilirsin\./);
      assert.doesNotMatch(body, /kendin uzatamazsın/);
    }
  });

  it("leaves the panel link out when core has no Group id", async () => {
    const mail = await received({ ...warning, Self: "yes", GroupId: "" });
    assert.doesNotMatch(mail.rawHtml, /admin\.yildizskylab\.com\/groups\//);
  });

  it("lists the expired terms to ADMIN, one line each, and says nobody was removed", async () => {
    const mail = await received({
      Notice: "expired-list",
      Count: "2",
      Items: "Ada Lovelace · YK · Yönetim Kurulu · 31.05.2027\nAlan Turing · LIDERLER · 31.05.2027",
    });
    assert.equal(mail.subject, "Süresi dolan yönetim üyelikleri");
    assert.match(mail.html, /Şu 2 yönetim üyeliğinin süresi doldu\./);
    assert.match(mail.html, /Kimse gruptan kendiliğinden çıkarılmadı; yetkileri sürüyor\./);
    // Each term on a line of its own, in the HTML and in the plain text.
    assert.match(mail.rawHtml, /white-space:pre-wrap[^>]*>Ada Lovelace · YK · Yönetim Kurulu · 31\.05\.2027\nAlan Turing · LIDERLER · 31\.05\.2027</);
    assert.match(mail.plainText, /Ada Lovelace · YK · Yönetim Kurulu · 31\.05\.2027\nAlan Turing · LIDERLER · 31\.05\.2027/);
    assert.match(mail.html, /Uzatma, devir ya da gruptan çıkarma elle yapılır\./);
    assert.doesNotMatch(mail.html, /gün kaldı|yetkin varsa|Haftalık/);
  });

  it("sums up the expired terms still in their Groups for ADMIN once a week", async () => {
    const mail = await received({ Notice: "weekly-summary", Count: "3", Items: "YK · Yönetim Kurulu: 2\nLIDERLER: 1" });
    assert.equal(mail.subject, "Haftalık özet: süresi dolmuş yönetim üyelikleri");
    assert.match(mail.html, /Süresi dolduğu hâlde grubunda duran 3 yönetim üyeliği var\./);
    assert.match(mail.rawHtml, /white-space:pre-wrap[^>]*>YK · Yönetim Kurulu: 2\nLIDERLER: 1</);
    assert.match(mail.plainText, /YK · Yönetim Kurulu: 2\nLIDERLER: 1/);
    assert.doesNotMatch(mail.html, /gün kaldı|doldu\./);
  });
});
