/**
 * Authoring modes coexist (ADR-0046): a source added in another mode starts
 * from the Main source's rendered HTML and deletes nothing, and making it the
 * Main source is a deliberate, previewed choice that leaves the other source
 * exactly as it was.
 */
import { expect, preview, sourceIn, test, writeSource } from "./fixtures";

const JSX = `import * as React from "react";
import { Heading, Paragraph, Shell } from "./theme";
import { v } from "./go";

export default function Duyuru() {
  return (
    <Shell preview="Bu haftanın duyurusu">
      <Heading>Merhaba {v("FirstName")}</Heading>
      <Paragraph>JSX ile yazılmış metin</Paragraph>
    </Shell>
  );
}
`;

test("making the HTML source main keeps the JSX source as it was", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const { id } = skymail.addTemplate({
    name: "Haftalık duyuru",
    subject: "Bu hafta SKY LAB'de, {{.FirstName}}",
    mainMode: "jsx",
    jsx: JSX,
    htmlContent: "<p>stored render</p>",
    plainText: "stored render",
  });

  await page.goto(`/templates/edit/${id}`);
  await expect(preview(page, "Mail önizlemesi")).toContainText("JSX ile yazılmış metin");
  await expect(page.getByRole("tab", { name: /JSX/ })).toContainText("Main source");

  // A new HTML source starts from the Main source's render, not from nothing.
  await page.getByRole("tab", { name: /HTML/ }).click();
  await page.getByRole("button", { name: "HTML kaynağı ekle" }).click();
  const started = await sourceIn(page, "html");
  expect(started).toContain("<!DOCTYPE html PUBLIC");
  expect(started).toContain("JSX ile yazılmış metin");

  const edited = started.replace("JSX ile yazılmış metin", "HTML ile düzeltilmiş metin");
  await writeSource(page, "html", edited);
  await expect(preview(page, "Mail önizlemesi")).toContainText("HTML ile düzeltilmiş metin");

  // Choosing it shows what will be sent, and waits for a confirmation.
  await page.getByRole("button", { name: "Bu kaynağı Main source yap" }).click();
  const dialog = page.getByRole("dialog", { name: "HTML kaynağını Main source yap" });
  await expect(preview(page, "Main source adayı")).toContainText("HTML ile düzeltilmiş metin");
  await expect(dialog).toContainText("JSX kaynağı olduğu gibi korunur");
  expect(skymail.writes()).toHaveLength(0);
  await dialog.getByRole("button", { name: "Main source yap" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Main source artık HTML" })).toBeVisible();

  // One draft: the new mode and its render, with the JSX source left for the API to keep.
  const [change] = skymail.writes();
  expect(change.path).toBe(`/templates/${id}/drafts`);
  expect(change.body).toMatchObject({ main_mode: "html", html_source: edited, html_content: edited });
  expect(change.body).not.toHaveProperty("jsx_source");
  const draft = skymail.versionsOf(id)[0];
  expect(draft).toMatchObject({ main_mode: "html", html_source: edited, jsx_source: JSX, published_at: null });
  expect(skymail.row(id).html_content).toBe("<p>stored render</p>");

  await expect(page.getByRole("tab", { name: /HTML/ })).toContainText("Main source");
  await page.getByRole("tab", { name: /JSX/ }).click();
  expect(await sourceIn(page, "jsx")).toBe(JSX);

  // Opened again, the draft has both sources.
  await page.reload();
  await expect(page.getByRole("tab", { name: /HTML/ })).toContainText("Main source");
  await expect(preview(page, "Mail önizlemesi")).toContainText("HTML ile düzeltilmiş metin");
  await page.getByRole("tab", { name: /JSX/ }).click();
  expect(await sourceIn(page, "jsx")).toBe(JSX);
});
