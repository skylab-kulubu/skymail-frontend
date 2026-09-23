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

const toolbar = (page: Page) => page.getByRole("toolbar", { name: "Visual editör araçları" });

async function insertVariable(page: Page, name: string, how: "known" | "typed") {
  await toolbar(page).getByRole("button", { name: "Değişken ekle" }).click();
  if (how === "known") {
    await page.getByRole("group", { name: "Bu template'in bildiği değişkenler" }).getByRole("button", { name }).click();
  } else {
    await page.getByLabel("Başka bir değişken").fill(name);
    await page.getByRole("button", { name: "Ekle", exact: true }).click();
  }
  await expect(textbox(page).getByLabel(`Değişken ${name}`).last()).toBeVisible();
  await expect(textbox(page)).toBeFocused();
}

/** Toggles a mark from the toolbar and types with it. */
async function typeWith(page: Page, mark: "Kalın" | "İtalik", text: string) {
  await toolbar(page).getByRole("button", { name: mark }).click();
  await page.keyboard.type(text);
  await toolbar(page).getByRole("button", { name: mark }).click();
}

async function addVisualSource(page: Page) {
  await page.getByRole("tab", { name: /Visual/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText("JSX ya da HTML kaynağından dönüştürülmez");
  await page.getByRole("button", { name: "Visual kaynağı ekle" }).click();
  await expect(textbox(page)).toBeVisible();
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
  await addVisualSource(page);
  await expect(textbox(page)).toHaveText("");

  // A heading with a variable the template already references.
  await textbox(page).click();
  await toolbar(page).getByRole("radio", { name: "Başlık" }).click();
  await expect(toolbar(page).getByRole("radio", { name: "Başlık" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.type("Merhaba ");
  await insertVariable(page, "FirstName", "known");
  await page.keyboard.press("Enter");

  // A paragraph: bold, italic and a link from the toolbar, and a variable typed by name.
  await expect(toolbar(page).getByRole("radio", { name: "Paragraf" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.type("GECEKODU ");
  await typeWith(page, "Kalın", "başvuruları");
  await page.keyboard.type(" açıldı. ");
  await typeWith(page, "İtalik", "Takımın");
  await page.keyboard.type(": ");
  await insertVariable(page, "TeamName", "typed");
  await page.keyboard.type(". Ayrıntılar burada");
  for (let step = 0; step < "burada".length; step += 1) await page.keyboard.press("Shift+ArrowLeft");
  await toolbar(page).getByRole("button", { name: "Bağlantı" }).click();
  await page.getByLabel("Bağlantı adresi").fill("https://skyl.app/gecekodu");
  await page.getByRole("button", { name: "Bağlantıyı uygula" }).click();
  await expect(textbox(page).getByRole("link", { name: "burada" })).toBeVisible();
  await expect(textbox(page)).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.type(".");
  await page.keyboard.press("Enter");

  // A button whose link is a variable, and a rule after it, both from the toolbar.
  await toolbar(page).getByRole("button", { name: "Buton ekle" }).click();
  const button = page.getByRole("group", { name: "Buton" });
  await button.getByLabel("Etiket").fill("Bilete git");
  await button.getByRole("group", { name: "Bağlantı" }).getByRole("button", { name: "Değişken" }).click();
  await button.getByLabel("Bağlantının değişkeni").fill("TicketUrl");
  await expect(button).toContainText("TicketUrl boş gelirse buton hiç görünmez");
  await textbox(page).getByRole("group", { name: "Buton" }).locator("p").first().click();
  await toolbar(page).getByRole("button", { name: "Ayraç ekle" }).click();
  await expect(textbox(page).locator("hr")).toHaveCount(1);

  // A section shown when a variable is set, and one shown when it is not ("boşsa").
  await textbox(page).locator("p").last().click();
  await page.keyboard.type("Yer: ");
  await insertVariable(page, "Venue", "typed");
  await toolbar(page).getByRole("button", { name: "Koşullu bölüm ekle" }).click();
  const whenSet = page.getByRole("group", { name: "Koşullu bölüm" }).first();
  await whenSet.getByRole("group", { name: "Bilinen değişkenler" }).getByRole("button", { name: "Venue" }).click();
  await expect(whenSet).toContainText("Venue doluysa görünür");

  await textbox(page).locator("p").last().click();
  await page.keyboard.type("Yer yakında duyurulacak.");
  await toolbar(page).getByRole("button", { name: "Koşullu bölüm ekle" }).click();
  const whenUnset = page.getByRole("group", { name: "Koşullu bölüm" }).last();
  await whenUnset.getByLabel("Koşulun değişkeni").fill("Venue");
  await whenUnset.getByLabel("Ne zaman görünsün").selectOption("unset");
  await expect(whenUnset).toContainText("Venue boşsa görünür");

  await expect(preview(page, "Mail önizlemesi")).toContainText("Bilete git");
  await expect(preview(page, "Mail önizlemesi")).toContainText("Yer yakında duyurulacak.");

  // Made main after the dialog shows what will be sent.
  await page.getByRole("button", { name: "Bu kaynağı Main source yap" }).click();
  const dialog = page.getByRole("dialog", { name: "Visual kaynağını Main source yap" });
  await expect(preview(page, "Main source adayı")).toContainText("Yer yakında duyurulacak.");
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
      content: [
        { type: "text", text: "GECEKODU " },
        { type: "text", text: "başvuruları", marks: [{ type: "bold" }] },
        { type: "text", text: " açıldı. " },
        { type: "text", text: "Takımın", marks: [{ type: "italic" }] },
        { type: "text", text: ": " },
        { type: "variable", name: "TeamName" },
        { type: "text", text: ". Ayrıntılar " },
        { type: "text", text: "burada", marks: [{ type: "link", href: "https://skyl.app/gecekodu" }] },
        { type: "text", text: "." },
      ],
    },
    { type: "button", label: "Bilete git", link: { variable: "TicketUrl" } },
    { type: "divider" },
    {
      type: "conditional",
      variable: "Venue",
      when: "set",
      blocks: [{ type: "paragraph", content: [{ type: "text", text: "Yer: " }, { type: "variable", name: "Venue" }] }],
    },
    {
      type: "conditional",
      variable: "Venue",
      when: "unset",
      blocks: [{ type: "paragraph", content: [{ type: "text", text: "Yer yakında duyurulacak." }] }],
    },
  ]);

  const html = body.html_content as string;
  for (const action of [
    "{{.FirstName}}",
    "{{.TeamName}}",
    "{{if .TicketUrl}}",
    'href="{{.TicketUrl}}"',
    "{{if .Venue}}",
    "{{.Venue}}",
    "{{if not .Venue}}",
    "{{end}}",
  ]) {
    expect(html).toContain(action);
  }
  expect(html).toContain('class="cta"');
  expect(html).toContain('class="divider"');
  expect(html).toContain('href="https://skyl.app/gecekodu"');
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

test("the toolbar is one stop for Tab, and arrow keys move through it", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const { id } = skymail.addTemplate({
    name: "Klavye",
    subject: "Klavye",
    mainMode: "jsx",
    jsx: JSX,
    htmlContent: "<p>stored render</p>",
    plainText: "stored render",
  });
  await page.goto(`/templates/edit/${id}`);
  await addVisualSource(page);

  const paragraph = toolbar(page).getByRole("radio", { name: "Paragraf" });
  const heading = toolbar(page).getByRole("radio", { name: "Başlık" });
  await expect(toolbar(page).getByRole("radiogroup", { name: "Blok türü" })).toBeVisible();
  await expect(toolbar(page).locator('[tabindex="0"]')).toHaveCount(1);
  await paragraph.focus();
  await page.keyboard.press("ArrowRight");
  await expect(heading).toBeFocused();
  await page.keyboard.press("End");
  await expect(toolbar(page).getByRole("button", { name: "İleri al" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(paragraph).toBeFocused();
  await expect(toolbar(page).locator('[tabindex="0"]')).toHaveCount(1);
});

// The block refuses what Gmail and Outlook do not show, and what the model
// refuses is never saved: the render says why.
test("an SVG image is refused, and the save with it; the club CDN's image is taken", async ({ page, skymail, signIn }) => {
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
  await addVisualSource(page);
  await textbox(page).click();
  await page.keyboard.type("Afişimiz:");
  await toolbar(page).getByRole("button", { name: "Görsel ekle" }).click();
  const image = page.getByRole("group", { name: "Görsel" });
  await expect(image).toContainText("Saydam zeminli bir PNG seç");
  const address = image.getByLabel("Görsel adresi");

  await address.fill("https://cdn.yildizskylab.com/images/afis.svg");
  await expect(image).toContainText("SVG kabul edilmez");
  await expect(page.getByRole("alert").filter({ hasText: "Render edilemedi" })).toContainText("SVG kabul edilmez");
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Kaydedilmedi" })).toContainText("Visual kaynağı render edilemedi");
  expect(skymail.writes()).toHaveLength(0);

  await address.fill("https://example.com/afis.webp");
  await expect(image).toContainText("WebP kabul edilmez");

  // The club CDN's addresses name no extension; one is shown on both themes' cards, and saves.
  const cdn = "https://cdn.yildizskylab.com/images/3f9b6c2e-8d41-4a7e-b5c0-1e2d7a9f4c68";
  await address.fill(cdn);
  await expect(image.getByRole("group", { name: "Görsel iki temada" })).toContainText("Koyu tema");
  await expect(preview(page, "Mail önizlemesi").locator(`img[src="${cdn}"]`)).toHaveCount(1);
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Taslak kaydedildi" })).toBeVisible();
  const saved = skymail.versionsOf(id)[0];
  expect(saved.main_mode).toBe("jsx");
  expect(JSON.stringify(saved.visual_source)).toContain(cdn);
});

// POST /templates takes no Visual source, so a template started in Visual is
// created with the plain HTML starter — its first published version, said
// plainly — and opens in the editor on an empty Visual document.
test("a template started in Visual is created with the plain starter and opens on an empty Visual document", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  await page.goto("/templates/create");
  await page.getByLabel("Template adı").fill("Bülten");
  await page.getByLabel("Konu").fill("Eylül bülteni");
  await page.getByRole("group", { name: "İlk kaynağın Authoring mode'u" }).getByRole("button", { name: "Visual ile başla" }).click();
  const explained = page.getByRole("region", { name: "İlk kaynak" });
  await expect(explained).toContainText("ilk yayımlanan sürüm sade bir HTML başlangıcıdır");
  await expect(explained).toContainText("Main source yap");
  await expect(preview(page, "Mail önizlemesi")).toContainText("Mailin metnini buraya yaz.");

  await page.getByRole("button", { name: "Oluştur ve yayımla" }).click();
  await expect(textbox(page)).toBeVisible();
  await expect(page).toHaveURL(/\/templates\/edit\/[^/?]+\?start=visual$/);
  await expect(page.getByRole("tab", { name: /Visual/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /HTML/ })).toContainText("Main source");
  await expect(textbox(page)).toHaveText("");
  await expect(page.getByRole("status").filter({ hasText: "sade bir HTML başlangıcı" })).toContainText("Main source yap");

  const [created] = skymail.writes();
  expect(created.path).toBe("/templates");
  expect(created.body).toMatchObject({ name: "Bülten", subject: "Eylül bülteni" });
  expect((created.body as { html_content: string }).html_content).toContain("Mailin metnini buraya yaz.");
});
