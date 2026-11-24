/**
 * "Kim açtı" on a send's page (hub ticket skymail-frontend-rewrite 32) against
 * the mock of skynotify-backend's GET /mail_tasks/{id}/content-views (#135):
 * DK (skynotify:audit:read) sees who opened the masked content, newest first,
 * with the recipient whose mail was opened; SkyNotify's administrator, who may
 * open the content without the audit role, sees no section and the page never
 * asks. Every person here is made up.
 */
import { expect, test } from "./fixtures";
import type { MockSkyNotify } from "./fixtures/mock-api";

function maskedSend(skynotify: MockSkyNotify) {
  const { id: templateId } = skynotify.addTemplate({
    name: "Etkinlik giriş kodu",
    subject: "Giriş kodun",
    mainMode: "html",
    html: "<p>Kodun: {{.Code}}</p>",
    htmlContent: "<p>Kodun: {{.Code}}</p>",
    plainText: "Kodun: {{.Code}}",
    contentSensitive: true,
  });
  const listId = skynotify.addList({
    name: "Atölye katılımcıları",
    recipients: [
      { full_name: "Deneme Bir", email: "deneme.bir@example.test" },
      { full_name: "Deneme İki", email: "deneme.iki@example.test" },
      { full_name: "", email: "adsiz@example.test" },
    ],
  });
  const id = skynotify.addSend({ templateId, listId });
  skynotify.recordContentViews(id, [
    { id: "v3", queue_item_id: `${id}-1`, actor: { sub: "s-ayse", name: "Ayşe Denetçi" }, masked_by: "variables", masked_variables: ["Code"], created_at: "2026-11-22T10:42:00Z" },
    { id: "v2", queue_item_id: `${id}-2`, actor: { sub: "s-mert", name: "Mert Yönetici" }, masked_by: "variables", masked_variables: ["Code"], created_at: "2026-11-22T09:15:00Z" },
    { id: "v1", queue_item_id: `${id}-0`, actor: { sub: "00000000-0000-4000-8000-000000000000", name: "Silinmiş kullanıcı" }, masked_by: "patterns", masked_variables: [], created_at: "2026-11-21T16:05:00Z" },
  ]);
  return id;
}

test("DK sees who opened the masked content, newest first, with the recipient of each mail", async ({ page, skynotify, signIn }) => {
  await signIn("dk");
  const id = maskedSend(skynotify);
  await page.goto(`/mail-tasks/show/${id}`);

  const section = page.getByRole("region", { name: "Kim açtı" });
  await expect(section.getByRole("columnheader")).toHaveText(["Kim", "Ne zaman", "Alıcı"]);
  const rows = section.getByRole("row");
  await expect(rows).toHaveCount(1 + 3);
  await expect(rows.nth(1)).toContainText("Ayşe Denetçi");
  await expect(rows.nth(1)).toContainText("Deneme İki");
  await expect(rows.nth(2)).toContainText("Mert Yönetici");
  // A recipient without a name reads by address, as in the recipients table.
  await expect(rows.nth(2)).toContainText("adsiz@example.test");
  await expect(rows.nth(3)).toContainText("Silinmiş kullanıcı");
  await expect(rows.nth(3)).toContainText("Deneme Bir");
});

test("SkyNotify's administrator, without the audit role, gets no section and the page never asks", async ({ page, skynotify, signIn }) => {
  await signIn("admin");
  const id = maskedSend(skynotify);
  await page.goto(`/mail-tasks/show/${id}`);

  await expect(page.getByRole("region", { name: "Alıcılar" }).or(page.getByRole("heading", { name: "Alıcılar" })).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Kim açtı" })).toHaveCount(0);
  expect(skynotify.contentViewRequests()).toHaveLength(0);
});
