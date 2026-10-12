/**
 * The membership mails core-backend sends by key when a person is added to a
 * Group or removed from one (core-backend docs/team-membership-mail.md): a
 * team's, a Privileged Group's and any other Group's. The seed writes them
 * from emails/; core passes exactly the variables listed here, so a template
 * that reads another one would print `<no value>`, and one that drops one
 * would lose what core sends.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findTemplate } from "../../../emails";
import { fillSampleValues, referencedVariables, renderComponent } from ".";

/** What core-backend's teammail.Service passes for each key, beside Email and FullName. */
const CORE_SENDS: Record<string, string[]> = {
  "club.team-membership": ["TeamName", "Action", "Role", "EffectiveAt", "LeaderName"],
  "club.role-membership": ["GroupName", "Role", "Action", "EffectiveAt", "ActorName"],
  "club.group-membership": ["GroupName", "Action", "EffectiveAt", "ActorName"],
};

async function rendered(key: string) {
  const template = findTemplate(key);
  assert.ok(template, `${key} is not in emails/index.ts`);
  const result = await renderComponent(template.Component);
  assert.ok(result.ok, `${key} does not render`);
  return { meta: template.meta, html: result.html };
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;|&#39;/g, "'").replace(/\s+/g, " ");

describe("the membership mails", () => {
  for (const [key, variables] of Object.entries(CORE_SENDS)) {
    it(`${key} is seeded, visible to operators and reads what core sends`, async () => {
      const { meta, html } = await rendered(key);
      // No code or link that acts as the recipient: an operator may read a send.
      assert.equal(meta.contentSensitive, false);
      assert.equal(meta.system, false);
      assert.deepEqual([...meta.variables].sort(), [...variables].sort());
      assert.deepEqual(Object.keys(meta.sample).sort(), [...variables].sort());
      const referenced = [...referencedVariables(html)].filter((name) => name !== "Email" && name !== "FullName");
      assert.deepEqual(referenced.sort(), [...variables].sort());
    });
  }

  const roleCases: { sample: Record<string, string>; says: string[]; not: string[] }[] = [
    {
      sample: { GroupName: "YK · Yönetim Kurulu", Role: "board", Action: "added", EffectiveAt: "12.10.2026", ActorName: "Fatih Naz" },
      says: ["Yönetim Kurulu'na Eklendin", "YK · Yönetim Kurulu grubuna eklendin", "Yönetim Kurulu'na bağlı", "Fatih Naz", "beklemiyorsan"],
      not: ["çıkarıldın", "Denetim"],
    },
    {
      sample: { GroupName: "DK · Denetim Kurulu", Role: "audit", Action: "removed", EffectiveAt: "12.10.2026", ActorName: "" },
      says: ["Denetim Kurulu Üyeliğin Sona Erdi", "grubundan çıkarıldın", "SKY LAB üyeliğin devam ediyor"],
      not: ["İşlemi yapan", "eklendin"],
    },
    {
      sample: { GroupName: "ADMIN", Role: "admin", Action: "added", EffectiveAt: "12.10.2026", ActorName: "" },
      says: ["Yönetici Grubuna Eklendin", "yönetici grubu"],
      not: ["Kurulu"],
    },
    {
      sample: { GroupName: "OPS", Role: "privileged", Action: "removed", EffectiveAt: "12.10.2026", ActorName: "" },
      says: ["Yönetim Grubu Üyeliğin Sona Erdi"],
      not: ["Kurulu"],
    },
  ];
  for (const { sample, says, not } of roleCases) {
    it(`club.role-membership words a ${sample.Role} ${sample.Action}`, async () => {
      const { html } = await rendered("club.role-membership");
      const shown = text(fillSampleValues(html, sample));
      for (const phrase of says) assert.ok(shown.includes(phrase), `missing "${phrase}" in ${shown}`);
      for (const phrase of not) assert.ok(!shown.includes(phrase), `unexpected "${phrase}" in ${shown}`);
    });
  }

  it("club.group-membership names the Group, added or removed", async () => {
    const { html } = await rendered("club.group-membership");
    const added = text(fillSampleValues(html, { GroupName: "ARGE · Ar-Ge", Action: "added", EffectiveAt: "12.10.2026", ActorName: "Fatih Naz" }));
    assert.ok(added.includes("Bir Gruba Eklendin") && added.includes("ARGE · Ar-Ge grubuna eklendin") && added.includes("Fatih Naz"), added);
    const removed = text(fillSampleValues(html, { GroupName: "ESKI-EDITORLER", Action: "removed", EffectiveAt: "12.10.2026", ActorName: "" }));
    assert.ok(removed.includes("Bir Gruptan Çıkarıldın") && removed.includes("ESKI-EDITORLER grubundan çıkarıldın"), removed);
    assert.ok(!removed.includes("İşlemi yapan") && !removed.includes("eklendin"), removed);
  });
});
