/**
 * Story 27: a template is previewed with realistic values even when the repo
 * has no file for it, and what the operator types stays for their next visit.
 */
import { expect, preview, test } from "./fixtures";

test("a template the repo does not have previews with realistic values, and typed ones survive a reload", async ({
  page,
  skymail,
  signIn,
}) => {
  await signIn("writer");
  const html = "<!DOCTYPE html><html><body><p>Merhaba {{.FirstName}}, {{.EventName}} için yerin ayrıldı.</p><p>{{.Seat}}</p></body></html>";
  const { id } = skymail.addTemplate({
    name: "Etkinlik kaydı",
    subject: "{{.EventName}} kaydın",
    mainMode: "html",
    html,
    htmlContent: html,
    plainText: "Merhaba",
  });

  await page.goto(`/templates/edit/${id}`);
  const body = preview(page, "Mail önizlemesi");
  await expect(body).toContainText("Merhaba Ayşe, GECEKODU 2026 için yerin ayrıldı.");
  await expect(body).toContainText("«Seat»");
  await expect(page.getByText("GECEKODU 2026 kaydın")).toBeVisible();

  await page.getByText(/Örnek değerler/).click();
  await page.getByLabel("FirstName").fill("Zeynep");
  await page.getByLabel("Seat").fill("B-12");
  await expect(body).toContainText("Merhaba Zeynep");
  await expect(body).toContainText("B-12");

  await page.reload();
  await expect(preview(page, "Mail önizlemesi")).toContainText("Merhaba Zeynep");
  await expect(preview(page, "Mail önizlemesi")).toContainText("B-12");
});
