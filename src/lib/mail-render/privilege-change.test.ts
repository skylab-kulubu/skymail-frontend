/**
 * The privilege notice core-backend sends by key when management rights are
 * given or taken (core-backend docs/privilege-change-mail.md): a Group's role
 * mapping changed goes to ADMIN alone; a person added to or removed from a
 * Privileged Group goes to ADMIN and that root's other members. Core passes
 * every variable listed here, always, empty when it does not apply.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findTemplate } from "../../../emails";
import { fillSampleValues, referencedVariables, renderComponent } from ".";

/** What core-backend's teammail.Service passes, beside Email and FullName. */
const CORE_SENDS = [
  "Change",
  "GroupName",
  "GroupId",
  "Root",
  "SubjectName",
  "ActorName",
  "OccurredAt",
  "RolesAdded",
  "RolesRemoved",
  "AdminRole",
  "MemberCount",
];

async function rendered() {
  const template = findTemplate("club.privilege-change");
  assert.ok(template, "club.privilege-change is not in emails/index.ts");
  const result = await renderComponent(template.Component);
  assert.ok(result.ok, "club.privilege-change does not render");
  return { meta: template.meta, html: result.html };
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;|&#39;/g, "'").replace(/\s+/g, " ");

const base = {
  GroupName: "YK · Yönetim Kurulu",
  GroupId: "g-yk",
  Root: "",
  SubjectName: "",
  ActorName: "",
  OccurredAt: "12.10.2026 22:15",
  RolesAdded: "",
  RolesRemoved: "",
  AdminRole: "no",
  MemberCount: "",
};

describe("the privilege notice", () => {
  it("is seeded, visible to operators and reads what core sends", async () => {
    const { meta, html } = await rendered();
    // No code or link that acts as the recipient: an operator may read a send.
    assert.equal(meta.contentSensitive, false);
    assert.equal(meta.system, false);
    assert.deepEqual([...meta.variables].sort(), [...CORE_SENDS].sort());
    assert.deepEqual(Object.keys(meta.sample).sort(), [...CORE_SENDS].sort());
    const referenced = [...referencedVariables(html)].filter((name) => name !== "Email" && name !== "FullName");
    assert.deepEqual(referenced.sort(), [...CORE_SENDS].sort());
    // The subject reads no variable: a missing one would print <no value>.
    assert.ok(!meta.subject.includes("{{"));
  });

  const cases: { name: string; sample: Record<string, string>; says: string[]; not: string[] }[] = [
    {
      name: "a member added to YK",
      sample: { ...base, Change: "member-added", Root: "board", SubjectName: "Ada Lovelace", ActorName: "Fatih Naz" },
      says: [
        "Bir Yönetim Grubuna Üye Eklendi",
        "Ada Lovelace , YK · Yönetim Kurulu grubuna eklendi.",
        "Yönetim Kurulu'na bağlı",
        "Bu grubun yönetim yetkileri artık bu hesapta.",
        "Kişi Ada Lovelace",
        "İşlemi yapan Fatih Naz",
        "Zaman 12.10.2026 22:15",
        "ya da bu yönetim grubunda olduğun için",
        "beklemiyorsan",
        "https://admin.yildizskylab.com/groups/g-yk",
      ],
      not: ["çıkarıldı", "Rolleri", "rol eşlemesi", "Eklenen roller", "Etkilenen kişi"],
    },
    {
      name: "a member removed from a DK subgroup, by someone core cannot name",
      sample: { ...base, Change: "member-removed", Root: "audit", GroupName: "UYE", SubjectName: "", GroupId: "" },
      says: ["Bir Yönetim Grubundan Üye Çıkarıldı", "Bir hesap , UYE grubundan çıkarıldı.", "Denetim Kurulu'na bağlı", "yetkiler bu hesaptan kaldırıldı"],
      not: ["eklendi.", "İşlemi yapan", "Kişi ", "admin.yildizskylab.com", "Rolleri"],
    },
    {
      name: "a role mapped to the club",
      sample: {
        ...base,
        Change: "roles-changed",
        GroupName: "UYELER",
        RolesAdded: "core:users:manage, forms:viewer",
        AdminRole: "yes",
        MemberCount: "312",
        ActorName: "Fatih Naz",
      },
      says: [
        "Bir Grubun Rolleri Değişti",
        "UYELER grubunun rol eşlemesi değişti.",
        "en az biri bir yönetici rolü",
        "Eklenen roller core:users:manage, forms:viewer",
        "Etkilenen kişi 312",
        "yönetici grubunda (ADMIN) olduğun için alıyorsun. Grubun üyelerine",
      ],
      not: ["Kaldırılan roller", "Üye Eklendi", "Kişi ", "Kurulu'na bağlı", "bu yönetim grubunda olduğun"],
    },
    {
      name: "an app role removed",
      sample: { ...base, Change: "roles-changed", GroupName: "WEBLAB", RolesRemoved: "forms:viewer", MemberCount: "12" },
      says: ["Bir Grubun Rolleri Değişti", "Kaldırılan roller forms:viewer", "Etkilenen kişi 12"],
      not: ["yönetici rolü.", "Eklenen roller", "İşlemi yapan"],
    },
  ];
  for (const { name, sample, says, not } of cases) {
    it(`words ${name}`, async () => {
      const { html } = await rendered();
      const filled = fillSampleValues(html, sample);
      const shown = text(filled) + " " + filled;
      for (const phrase of says) assert.ok(shown.includes(phrase), `missing "${phrase}" in ${text(filled)}`);
      for (const phrase of not) assert.ok(!text(filled).includes(phrase) && !filled.includes(phrase), `unexpected "${phrase}" in ${text(filled)}`);
    });
  }
});
