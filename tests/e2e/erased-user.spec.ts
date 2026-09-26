/**
 * Silinmiş kullanıcı (ADR-0051, ticket 27): once core has had SkyMail erase
 * someone (skymail-backend #34), whatever they sent, submitted, decided or
 * wrote, and every request or mail that went to them, names them "Silinmiş
 * kullanıcı": never by the stand-in's subject or placeholder address, never
 * as someone whose name is unknown, never as the viewer. A request keeps the
 * erased person's place and send, and a send keeps every row and count. The
 * mock API erases as the backend does.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ERASED_EMAIL, ERASED_SUBJECT, type MockSkymail } from "./fixtures/mock-api";
import { MEMBER } from "./fixtures/session";

/** An approver who has left the club, and whose account core erased. */
const FORMER_APPROVER = { sub: "2e9d4b17-7c3a-4f05-9b81-6a0e3d5c2f98", name: "Can Öztürk", email: "can.ozturk@example.test" };
/** An operator who wrote versions of a template, erased since. */
const FORMER_OPERATOR = { kind: "operator" as const, sub: "5a7c1e30-2b9d-4e64-8f13-9d2b6c4a0e57", name: "Deniz Aydın" };

const ALI = { full_name: "Ali Can", email: "ali@ornek.com" };
const MERT = { full_name: "Mert Demir", email: "mert@ornek.com" };
const ECE = { full_name: "Ece Ak", email: "ece@ornek.com" };
/** Mert's own account: the Erasure command carries his addresses. */
const MERT_ACCOUNT = { sub: "7b3e9a52-1d4c-4f86-a0e7-2c5d8b1f6a39", emails: ["Mert@Ornek.com"] };

const fact = (page: Page, term: string) => page.locator("dt", { hasText: new RegExp(`^${term}$`) }).locator("xpath=following-sibling::dd[1]");
const people = (page: Page) => page.getByRole("region", { name: /^Kişiler/ });
const history = (page: Page) => page.getByRole("region", { name: "Geçmiş" });

/** Nothing on the page — text, a label, a link — is the stand-in's subject or address, or a name nobody recorded. */
async function namesNoTrace(page: Page) {
  const html = await page.content();
  expect(html).not.toContain(ERASED_SUBJECT);
  expect(html).not.toContain(ERASED_EMAIL);
  expect(html).not.toContain("Adı bilinmeyen");
}

function reminder(skymail: MockSkymail) {
  return skymail.addTemplate({
    name: "Etkinlik hatırlatması",
    key: "event.reminder",
    subject: "{{.EventName}} yarın",
    mainMode: "html",
    html: "<p>…</p>",
    htmlContent: "<p>Merhaba {{.FullName}}, {{.EventName}} yarın.</p>",
    plainText: "Merhaba {{.FullName}}, {{.EventName}} yarın.",
  });
}

test("an approved request names its erased submitter, approver and person Silinmiş kullanıcı, the person beside their send", async ({
  page,
  skymail,
  signIn,
}) => {
  await signIn("approver");
  const { id: templateId } = reminder(skymail);
  const id = skymail.addApproval({
    templateId,
    recipients: [ALI, MERT, ECE],
    variables: { EventName: "GECEKODU" },
    submitter: MEMBER,
    state: "approved",
    decided: [
      { kind: "edited", actor: FORMER_APPROVER, changes: [{ field: "variable", name: "EventName", before: "GECE", after: "GECEKODU" }] },
      { kind: "approved", actor: FORMER_APPROVER },
    ],
  });
  const sends = skymail.approval(id).task_ids;
  skymail.erase({ sub: MEMBER.sub, emails: [MEMBER.email] });
  skymail.erase({ sub: FORMER_APPROVER.sub, emails: [FORMER_APPROVER.email] });
  skymail.erase(MERT_ACCOUNT);

  await page.goto("/mail-approvals?state=approved");
  const row = page.getByRole("row").filter({ hasText: "Etkinlik hatırlatması" });
  await expect(row).toContainText("Ali Can, Silinmiş kullanıcı");
  await expect(row).toContainText("+1 kişi");
  await expect(row.getByRole("cell").filter({ hasText: /^Silinmiş kullanıcı/ })).toHaveCount(1);
  await namesNoTrace(page);

  await row.getByRole("link", { name: "Etkinlik hatırlatması" }).click();
  await expect(page.getByText(/^Mail onayı · Silinmiş kullanıcı .+ tarihinde sundu$/)).toBeVisible();
  await expect(fact(page, "Sunan")).toHaveText("Silinmiş kullanıcı");
  await expect(fact(page, "Kitle")).toHaveText("Ali Can, Silinmiş kullanıcı, Ece Ak");

  // Mert's place and send are his still: only the name changed.
  const everyone = people(page).getByRole("listitem");
  await expect(everyone).toHaveCount(3);
  await expect(everyone.nth(1)).toHaveText(/^2\.\s*Silinmiş kullanıcı\s*Gönderimi gör$/);
  await expect(people(page).getByRole("link", { name: "Silinmiş kullanıcı: gönderimi gör" })).toHaveAttribute("href", `/mail-tasks/show/${sends[1]}`);
  await expect(people(page).getByRole("link", { name: "Ece Ak: gönderimi gör" })).toHaveAttribute("href", `/mail-tasks/show/${sends[2]}`);

  // The one subject stands for everyone erased: the approver did not decide their own request.
  await expect(history(page)).toContainText("Silinmiş kullanıcı onaya sundu");
  await expect(history(page)).toContainText("Silinmiş kullanıcı değişkenleri düzenledi");
  await expect(history(page)).toContainText("Silinmiş kullanıcı onayladı; gönderildi");
  await expect(history(page)).not.toContainText("kendi isteği");
  await namesNoTrace(page);

  // His send: sent by the erased submitter, its one row emptied of him and still sent.
  await people(page).getByRole("link", { name: "Silinmiş kullanıcı: gönderimi gör" }).click();
  await expect(page).toHaveURL(`/mail-tasks/show/${sends[1]}`);
  await expect(fact(page, "Kitle")).toHaveText("Silinmiş kullanıcı");
  await expect(fact(page, "Alıcılar")).toHaveText(/^1 alıcı\s*1 gönderildi$/);
  const sent = page.getByRole("row").filter({ hasText: "Gönderildi" });
  await expect(sent).toHaveCount(1);
  await expect(sent.getByRole("cell").first()).toHaveText("Silinmiş kullanıcı");
  await namesNoTrace(page);

  await page.goto("/mail-tasks");
  await expect(page.getByRole("row").filter({ hasText: "Silinmiş kullanıcı" })).toHaveCount(1);
  await expect(page.getByRole("row").filter({ hasText: "Ece Ak" })).toContainText("ece@ornek.com");
  await namesNoTrace(page);
});

test("a list send by an erased member keeps every row and count, the erased recipient's as Silinmiş kullanıcı", async ({ page, skymail, signIn }) => {
  await signIn("approver");
  const { id: templateId } = reminder(skymail);
  const listId = skymail.addList({ name: "GECEKODU katılımcıları", recipients: [ALI, MERT, ECE] });
  const id = skymail.addApproval({
    templateId,
    listId,
    variables: { EventName: "GECEKODU" },
    submitter: MEMBER,
    state: "approved",
    decided: { kind: "approved", actor: FORMER_APPROVER },
  });
  const [send] = skymail.approval(id).task_ids;
  skymail.erase({ sub: MEMBER.sub, emails: [MEMBER.email] });
  skymail.erase(MERT_ACCOUNT);

  await page.goto(`/mail-tasks/show/${send}`);
  await expect(fact(page, "Kitle")).toHaveText("GECEKODU katılımcıları");
  await expect(fact(page, "Alıcılar")).toHaveText(/^3 alıcı\s*3 gönderildi$/);
  const rows = page.getByRole("row").filter({ hasText: "Gönderildi" });
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).getByRole("cell").first()).toHaveText(/^Ali Can\s*ali@ornek.com$/);
  await expect(rows.nth(1).getByRole("cell").first()).toHaveText("Silinmiş kullanıcı");
  await expect(rows.nth(2).getByRole("cell").first()).toHaveText(/^Ece Ak\s*ece@ornek.com$/);
  await namesNoTrace(page);
});

test("a rejected request whose only person and approver were erased reads so, and is resubmitted without the stand-in", async ({
  page,
  skymail,
  signIn,
}) => {
  await signIn("member");
  const { id: templateId } = reminder(skymail);
  const id = skymail.addApproval({
    templateId,
    recipients: [MERT],
    variables: { EventName: "GECEKODU" },
    submitter: MEMBER,
    state: "rejected",
    decided: { kind: "rejected", actor: FORMER_APPROVER, note: "Mert Demir yanlış kişi." },
  });
  skymail.erase({ sub: FORMER_APPROVER.sub, emails: [FORMER_APPROVER.email] });
  skymail.erase(MERT_ACCOUNT);

  await page.goto(`/mail-approvals/show/${id}`);
  await expect(fact(page, "Kitle")).toHaveText("Silinmiş kullanıcı");
  await expect(fact(page, "Sunan")).toHaveText(new RegExp(`^${MEMBER.name}`));
  await expect(page.getByText("Silinmiş kullanıcı için, sunucunun göndereceği hâliyle.")).toBeVisible();
  const decision = page.getByRole("region", { name: "Karar" });
  await expect(decision).toContainText("Silinmiş kullanıcı: “[silindi]”");
  await expect(history(page)).toContainText("Silinmiş kullanıcı reddetti");
  await namesNoTrace(page);

  // The placeholder address never delivers: the form leaves it out and says why.
  await decision.getByRole("button", { name: "Düzenleyip yeniden sun" }).click();
  await expect(page).toHaveURL(`/mail-approvals/edit/${id}`);
  await expect(page.getByText(/^Silinmiş kullanıcı .+ tarihinde reddetti\.$/)).toBeVisible();
  await expect(page.getByText("İsteğin tek kişisi Silinmiş kullanıcı: hesabı silindiği için forma alınmadı. Bir kişi seç.")).toBeVisible();
  await expect(page.getByLabel("1. kişinin e-posta adresi")).toHaveValue("");
  await namesNoTrace(page);
});

test("an erased operator's versions and draft read as Silinmiş kullanıcı, never as the viewer's", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const mail = (text: string) => `<!DOCTYPE html><html><body><p>${text}</p></body></html>`;
  const { id } = skymail.addTemplate({
    name: "Etkinlik duyurusu",
    subject: "Bu hafta SKY LAB'de",
    mainMode: "html",
    html: mail("İlk metin"),
    htmlContent: mail("İlk metin"),
    plainText: "İlk metin",
  });
  skymail.publishAs(id, FORMER_OPERATOR, { html_source: mail("Deniz'in metni"), html_content: mail("Deniz'in metni") });
  skymail.addDraft(id, FORMER_OPERATOR, { html_source: mail("Deniz'in taslağı"), html_content: mail("Deniz'in taslağı") });
  skymail.erase({ sub: FORMER_OPERATOR.sub });

  await page.goto("/templates");
  const row = page.getByRole("row").filter({ hasText: "Etkinlik duyurusu" });
  await expect(row).toContainText("Silinmiş kullanıcı");
  await expect(row.getByText("Sen", { exact: true })).toHaveCount(0);
  await namesNoTrace(page);

  await page.goto(`/templates/edit/${id}`);
  await expect(page.getByText(/^Yayımlanmamış başka taslak var: Silinmiş kullanıcı \(.+\)\./)).toBeVisible();
  await namesNoTrace(page);

  await page.goto(`/templates/history/${id}`);
  const version = (seq: number) => page.getByRole("listitem", { name: `Sürüm #${seq}`, exact: true });
  await expect(version(3)).toContainText("Süren taslak");
  await expect(version(3)).toContainText("Silinmiş kullanıcı");
  await expect(version(2)).toContainText("Gönderilen");
  await expect(version(2)).toContainText("Silinmiş kullanıcı");
  await expect(version(1)).toContainText("Template seed");
  await expect(page.getByRole("list", { name: "Sürümler" })).not.toContainText(/\bsen\b/);
  await namesNoTrace(page);
});
