/**
 * A render's warnings (src/lib/mail-render/warnings.ts): what emails:render
 * fails a repo template for, but what an operator's own text in any mode may
 * still have — a link glued to the next word in the plain text. It does not
 * stop a save or a publish; it is said next to the preview, and said again in
 * the publish confirmation, because by then the mail is about to go out.
 */
import { expect, preview, test } from "./fixtures";
import { VIEWER } from "./fixtures/session";

const GLUED = '<p>Ayrıntılar <a href="https://skyl.app/e">burada</a>dan öğren.</p>';
const WARNING = "Bağlantıdan sonra bir boşluk bırak: düz metinde bağlantı ile sonraki kelime birleşiyor";

test("a draft with a warning says it by the preview and again before publishing, and still publishes", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const { id } = skymail.addTemplate({
    name: "Duyuru",
    subject: "Duyuru",
    mainMode: "html",
    html: "<p>Eski metin</p>",
    htmlContent: "<p>Eski metin</p>",
    plainText: "Eski metin",
  });
  skymail.addDraft(id, { kind: "operator", sub: VIEWER.sub, name: VIEWER.name }, {
    html_source: GLUED,
    html_content: GLUED,
    plain_text_content: "Ayrıntılar burada https://skyl.app/edan öğren.",
  });

  await page.goto(`/templates/edit/${id}`);
  await expect(preview(page, "Mail önizlemesi")).toContainText("burada");
  const beside = page.getByRole("region", { name: "Önizleme" }).getByRole("status").filter({ hasText: WARNING });
  await expect(beside).toContainText("https://skyl.app/edan");

  await page.getByRole("button", { name: "Yayımla" }).click();
  const dialog = page.getByRole("dialog", { name: "Taslağı yayımla" });
  await expect(dialog).toContainText(WARNING);
  await expect(dialog).toContainText("https://skyl.app/edan");
  await dialog.getByRole("button", { name: "Yayımla" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Yayımlandı" })).toBeVisible();
  expect(skymail.row(id).html_content).toBe(GLUED);
});

test("the publish confirmation says nothing more when there is no warning", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const clean = '<p>Ayrıntılar <a href="https://skyl.app/e">burada</a>, gel.</p>';
  const { id } = skymail.addTemplate({
    name: "Duyuru",
    subject: "Duyuru",
    mainMode: "html",
    html: "<p>Eski metin</p>",
    htmlContent: "<p>Eski metin</p>",
    plainText: "Eski metin",
  });
  skymail.addDraft(id, { kind: "operator", sub: VIEWER.sub, name: VIEWER.name }, {
    html_source: clean,
    html_content: clean,
    plain_text_content: "Ayrıntılar burada https://skyl.app/e, gel.",
  });

  await page.goto(`/templates/edit/${id}`);
  await page.getByRole("button", { name: "Yayımla" }).click();
  const dialog = page.getByRole("dialog", { name: "Taslağı yayımla" });
  await expect(dialog).toContainText("bundan sonra bu sürümle gönderilir");
  await expect(dialog).not.toContainText("Bağlantıdan sonra");
});
