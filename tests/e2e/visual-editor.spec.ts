/**
 * Visual mode (ticket 15): someone who writes no code puts a Mail template's
 * body together from blocks, and it becomes the Main source like any other
 * source. The Visual source starts empty — nothing is converted from the JSX
 * — and the JSX source stays exactly as it was. What is saved is the
 * document itself and the mail rendered from it, its variables and
 * conditions as Go template actions.
 */
import type { Page } from "@playwright/test";
import { expect, preview, sourceIn, test } from "./fixtures";

const JSX = `import * as React from "react";
import { Heading, Paragraph, Shell } from "./theme";
import { v } from "./go";

export default function Duyuru() {
  return (
    <Shell preview="GECEKODU">
      <Heading>Merhaba {v("FirstName")}</Heading>
      <Paragraph>JSX ile yazılmış metin</Paragraph>
    </Shell>
  );
}
`;

/** The document's text area. */
const textbox = (page: Page) => page.getByRole("textbox", { name: "Visual kaynağı" });

async function insertVariable(page: Page, name: string, how: "known" | "typed") {
  await page.getByRole("button", { name: "Değişken ekle" }).click();
  if (how === "known") {
    await page.getByRole("group", { name: "Bu template'in bildiği değişkenler" }).getByRole("button", { name }).click();
  } else {
    await page.getByLabel("Başka bir değişken").fill(name);
    await page.getByRole("button", { name: "Ekle", exact: true }).click();
  }
  await expect(textbox(page).getByLabel(`Değişken ${name}`)).toBeVisible();
  await expect(textbox(page)).toBeFocused();
}

test("a Visual source is written from blocks and made the Main source, the JSX source untouched", async ({ page, skymail, signIn }) => {
  // The sandbox renders one Visual edit after another in the same frame; none of that may throw.
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn("writer");
  const { id } = skymail.addTemplate({
    name: "GECEKODU duyurusu",
    subject: "{{.FirstName}}, GECEKODU'nda görüşelim",
    mainMode: "jsx",
    jsx: JSX,
    htmlContent: "<p>stored render</p>",
    plainText: "stored render",
  });

  await page.goto(`/templates/edit/${id}`);
  await expect(preview(page, "Mail önizlemesi")).toContainText("JSX ile yazılmış metin");

  // A new Visual source starts empty, and says it converts nothing.
  await page.getByRole("tab", { name: /Visual/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText("JSX ya da HTML kaynağından dönüştürülmez");
  await page.getByRole("button", { name: "Visual kaynağı ekle" }).click();
  await expect(textbox(page)).toBeVisible();
  await expect(textbox(page)).toHaveText("");

  // A heading with a variable the template already references.
  await textbox(page).click();
  await page.getByRole("button", { name: "Başlık" }).click();
  await page.keyboard.type("Merhaba ");
  await insertVariable(page, "FirstName", "known");
  await page.keyboard.press("Enter");

  // A paragraph with a variable typed by name.
  await page.keyboard.type("GECEKODU başvuruları açıldı. Takımın: ");
  await insertVariable(page, "TeamName", "typed");
  await page.keyboard.press("Enter");

  // A button whose link is a variable.
  await page.getByRole("button", { name: "Buton ekle" }).click();
  const button = page.getByRole("group", { name: "Buton" });
  await button.getByLabel("Etiket").fill("Bilete git");
  await button.getByRole("radio", { name: "Değişken" }).click();
  await button.getByLabel("Bağlantının değişkeni").fill("TicketUrl");
  await expect(button).toContainText("TicketUrl boş gelirse buton hiç görünmez");

  // A section shown only when a variable is set, around the line under the button.
  await textbox(page).locator("p").last().click();
  await page.keyboard.type("Yer: ");
  await insertVariable(page, "Venue", "typed");
  await page.getByRole("button", { name: "Koşullu bölüm ekle" }).click();
  const section = page.getByRole("group", { name: "Koşullu bölüm" });
  await section.getByRole("group", { name: "Bilinen değişkenler" }).getByRole("button", { name: "Venue" }).click();
  await expect(section).toContainText("Venue doluysa görünür");

  await expect(preview(page, "Mail önizlemesi")).toContainText("Bilete git");
  await expect(preview(page, "Mail önizlemesi")).toContainText("GECEKODU başvuruları açıldı.");

  // Made main after the dialog shows what will be sent.
  await page.getByRole("button", { name: "Bu kaynağı Main source yap" }).click();
  const dialog = page.getByRole("dialog", { name: "Visual kaynağını Main source yap" });
  await expect(preview(page, "Main source adayı")).toContainText("Bilete git");
  await expect(dialog).toContainText("JSX kaynağı olduğu gibi korunur");
  expect(skymail.writes()).toHaveLength(0);
  await dialog.getByRole("button", { name: "Main source yap" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Main source artık Visual" })).toBeVisible();

  // One draft: the document itself and its render, the JSX source left for the API to keep.
  const [change] = skymail.writes();
  expect(change.path).toBe(`/templates/${id}/drafts`);
  const body = change.body as Record<string, unknown>;
  expect(body.main_mode).toBe("visual");
  expect(body).not.toHaveProperty("jsx_source");
  const document = body.visual_source as { type: string; version: number; blocks: { type: string; content?: unknown[] }[] };
  expect(document.type).toBe("skymail.visual");
  expect(document.version).toBe(1);
  // The editor keeps a line to type in under the last block; it is empty and renders nothing.
  const written = document.blocks.filter((block) => !(block.type === "paragraph" && block.content?.length === 0));
  expect(written).toEqual([
    { type: "heading", content: [{ type: "text", text: "Merhaba " }, { type: "variable", name: "FirstName" }] },
    {
      type: "paragraph",
      content: [{ type: "text", text: "GECEKODU başvuruları açıldı. Takımın: " }, { type: "variable", name: "TeamName" }],
    },
    { type: "button", label: "Bilete git", link: { variable: "TicketUrl" } },
    {
      type: "conditional",
      variable: "Venue",
      when: "set",
      blocks: [{ type: "paragraph", content: [{ type: "text", text: "Yer: " }, { type: "variable", name: "Venue" }] }],
    },
  ]);

  const html = body.html_content as string;
  for (const action of ["{{.FirstName}}", "{{.TeamName}}", "{{if .TicketUrl}}", 'href="{{.TicketUrl}}"', "{{if .Venue}}", "{{.Venue}}", "{{end}}"]) {
    expect(html).toContain(action);
  }
  expect(html).toContain('class="cta"');
  expect(body.plain_text_content).toContain("{{if .TicketUrl}}");

  const draft = skymail.versionsOf(id)[0];
  expect(draft).toMatchObject({ main_mode: "visual", jsx_source: JSX, published_at: null });
  expect(skymail.row(id).html_content).toBe("<p>stored render</p>");

  // Opened again: the document as the API keeps it (jsonb, keys in its own order) is no unsaved change.
  await page.reload();
  await expect(page.getByRole("tab", { name: /Visual/ })).toContainText("Main source");
  await expect(textbox(page)).toContainText("GECEKODU başvuruları açıldı.");
  await expect(page.getByRole("group", { name: "Buton" }).getByLabel("Etiket")).toHaveValue("Bilete git");
  await expect(page.getByText("Kaydedilmemiş değişiklikler var.")).toHaveCount(0);
  await page.getByRole("tab", { name: /JSX/ }).click();
  expect(await sourceIn(page, "jsx")).toBe(JSX);
  expect(errors).toEqual([]);
});

// The block refuses what Gmail and Outlook do not show, and what the model
// refuses is never saved: the render says why.
test("an SVG image is refused, and the save with it", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const { id } = skymail.addTemplate({
    name: "Afiş",
    subject: "Afiş",
    mainMode: "jsx",
    jsx: JSX,
    htmlContent: "<p>stored render</p>",
    plainText: "stored render",
  });

  await page.goto(`/templates/edit/${id}`);
  await page.getByRole("tab", { name: /Visual/ }).click();
  await page.getByRole("button", { name: "Visual kaynağı ekle" }).click();
  await textbox(page).click();
  await page.keyboard.type("Afişimiz:");
  await page.getByRole("button", { name: "Görsel ekle" }).click();
  const image = page.getByRole("group", { name: "Görsel" });
  await expect(image).toContainText("Saydam zeminli bir PNG kullan");

  await image.getByLabel("Görsel adresi (PNG ya da JPG)").fill("https://cdn.yildizskylab.com/afis.svg");
  await expect(image).toContainText("SVG kabul edilmez");
  await expect(page.getByRole("alert").filter({ hasText: "Render edilemedi" })).toContainText("SVG kabul edilmez");
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Kaydedilmedi" })).toContainText("Visual kaynağı render edilemedi");
  expect(skymail.writes()).toHaveLength(0);

  // A PNG is shown on both themes' surfaces, and saves.
  await image.getByLabel("Görsel adresi (PNG ya da JPG)").fill("https://cdn.yildizskylab.com/afis.png");
  await expect(image.getByRole("group", { name: "Görsel iki temada" })).toContainText("Koyu tema");
  await expect(preview(page, "Mail önizlemesi").locator('img[src="https://cdn.yildizskylab.com/afis.png"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Taslak kaydedildi" })).toBeVisible();
  const saved = skymail.versionsOf(id)[0];
  expect(saved.main_mode).toBe("jsx");
  expect(JSON.stringify(saved.visual_source)).toContain("afis.png");
});
