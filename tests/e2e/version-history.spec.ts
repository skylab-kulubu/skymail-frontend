/**
 * Stories 37–39 and 41: a Mail template's history says who wrote each version
 * and how it stands; any two versions are compared as rendered mail; restoring
 * one opens a new draft in the editor and leaves live mail as it was; and a
 * Template seed refused because of an operator's change is said on the
 * template. A reader sees and compares, and restores nothing.
 */
import { OTHER_OPERATOR, TEMPLATE_SEED } from "./fixtures/mock-api";
import { VIEWER } from "./fixtures/session";
import { expect, preview, test } from "./fixtures";
import type { Page } from "@playwright/test";

const mail = (text: string) => `<!DOCTYPE html><html><body><p>${text}</p><p>Merhaba {{.FirstName}}</p></body></html>`;

/** A template's first version as the migration made it: no author on record. */
const MIGRATED = { kind: "operator" as const, sub: null, name: null };

const item = (page: Page, seq: number) => page.getByRole("listitem", { name: `Sürüm #${seq}`, exact: true });

test("two versions compare side by side, and restoring one opens a new draft while live mail stays", async ({
  page,
  skymail,
  signIn,
}) => {
  await signIn("writer");
  const { id, versionId: first } = skymail.addTemplate({
    name: "Etkinlik duyurusu",
    subject: "Bu hafta SKY LAB'de",
    mainMode: "html",
    html: mail("İlk metin"),
    htmlContent: mail("İlk metin"),
    plainText: "İlk metin",
    author: MIGRATED,
  });
  skymail.publishAs(id, TEMPLATE_SEED, { html_source: mail("Seed'in metni"), html_content: mail("Seed'in metni") });
  const sent = skymail.publishAs(id, OTHER_OPERATOR, {
    subject: "Mehmet'in konusu",
    html_source: mail("Mehmet'in metni"),
    html_content: mail("Mehmet'in metni"),
  });
  const theirs = skymail.addDraft(id, OTHER_OPERATOR, { html_source: mail("Mehmet'in taslağı"), html_content: mail("Mehmet'in taslağı") });
  skymail.refuseSeed(id, ["published_by_operator", "newer_operator_version"]);
  const live = structuredClone(skymail.row(id));

  // The editor's header says a seed is waiting, and leads to the history.
  await page.goto(`/templates/edit/${id}`);
  await expect(page.getByRole("link", { name: "Template seed reddedildi · 23 Eyl 2026 00:10" })).toBeVisible();
  await page.getByRole("link", { name: "Sürüm geçmişi" }).click();
  await expect(page.getByRole("heading", { name: "Sürüm geçmişi", level: 1 })).toBeVisible();

  const refusal = page.getByRole("region", { name: "Template seed reddedildi" });
  await expect(refusal).toContainText("23 Eyl 2026 00:10 tarihinde bir Template seed, bir operatör değişikliği yüzünden reddedildi");
  await expect(refusal).toContainText("Gönderilen sürümü son Template seed değil, bir operatör yayımladı.");
  await expect(refusal).toContainText("Son Template seed'den sonra bir operatör yeni bir sürüm yazdı");
  await expect(refusal).toContainText("Seed bu template için zorlanırsa repodaki hâli hemen yayımlanır");

  // Newest first: who wrote each, and how it stands.
  await expect(page.getByRole("list", { name: "Sürümler" }).getByRole("listitem")).toHaveCount(4);
  await expect(item(page, 4)).toContainText("Süren taslak");
  await expect(item(page, 4)).toContainText("Mehmet Kaya");
  await expect(item(page, 3)).toContainText("Gönderilen");
  await expect(item(page, 3)).toContainText("Mehmet'in konusu");
  await expect(item(page, 2)).toContainText("Yayımlanmış");
  await expect(item(page, 2)).toContainText("Template seed");
  await expect(item(page, 1)).toContainText("Adı bilinmeyen operatör");
  await expect(item(page, 1)).toContainText("Sürüm geçmişi tutulmadan önceki içerik");
  await expect(item(page, 1)).toContainText("HTML");

  // The Taslak filter asks the API for drafts only.
  const drafts = page.waitForRequest((request) => /\/versions\?state=draft&_start=0&_end=20$/.test(request.url()));
  await page.getByRole("group", { name: "Gösterilen sürümler" }).getByRole("button", { name: "Taslak" }).click();
  await drafts;
  await expect(page).toHaveURL(/\?state=draft$/);
  await expect(page.getByRole("list", { name: "Sürümler" }).getByRole("listitem")).toHaveCount(1);
  await expect(item(page, 4)).toBeVisible();
  await page.getByRole("group", { name: "Gösterilen sürümler" }).getByRole("button", { name: "Hepsi" }).click();

  // Any two, side by side as rendered mail, the older first.
  await page.getByRole("checkbox", { name: "Karşılaştırmak için seç: sürüm #3" }).check();
  await page.getByRole("checkbox", { name: "Karşılaştırmak için seç: sürüm #1" }).check();
  await page.getByRole("button", { name: "Seçilenleri karşılaştır" }).click();
  const comparison = page.getByRole("dialog", { name: "Sürümleri karşılaştır" });
  await expect(preview(page, "Sürüm #1")).toContainText("İlk metin");
  await expect(preview(page, "Sürüm #3")).toContainText("Mehmet'in metni");
  // Both filled with the same sample values.
  await expect(preview(page, "Sürüm #1")).toContainText("Merhaba Ayşe");
  await expect(preview(page, "Sürüm #3")).toContainText("Merhaba Ayşe");
  const facts = comparison.getByRole("definition");
  await expect(facts.nth(1)).toContainText("“Bu hafta SKY LAB'de”");
  await expect(facts.nth(1)).toContainText("“Mehmet'in konusu”");
  await expect(facts.nth(2)).toContainText("Aynı: HTML");
  await expect(facts.nth(3)).toContainText("Farklı");
  const frames = comparison.locator("iframe");
  await expect(frames.first()).toHaveAttribute("title", "Sürüm #1");

  // Both mail themes.
  await comparison.getByRole("button", { name: "Koyu tema" }).click();
  await expect(page.locator('iframe[title="Sürüm #1"]')).toHaveCSS("color-scheme", "dark");
  await expect(page.locator('iframe[title="Sürüm #3"]')).toHaveCSS("color-scheme", "dark");

  // The version sent is not restored; the other one is, as a new draft.
  await expect(comparison.getByRole("button", { name: "Geri getir: sürüm #3" })).toHaveCount(0);
  await comparison.getByRole("button", { name: "Geri getir: sürüm #1" }).click();
  const confirm = page.getByRole("dialog", { name: "Sürümü geri getir" });
  await expect(confirm).toContainText("Gönderilen mail değişmez");
  await confirm.getByRole("button", { name: "Taslak olarak geri getir" }).click();

  // The editor opens that draft, and says what happened.
  await expect(page).toHaveURL(new RegExp(`/templates/edit/${id}$`));
  await expect(
    page.getByRole("status").filter({ hasText: "Sürüm #1 yeni bir taslak olarak geri getirildi (#5). Canlı mail değişmedi" }),
  ).toBeVisible();
  await expect(page.getByText("Taslağını düzenliyorsun: #5")).toBeVisible();
  await expect(page.getByLabel("Konu", { exact: true })).toHaveValue("Bu hafta SKY LAB'de");
  await expect(preview(page, "Mail önizlemesi")).toContainText("İlk metin");

  // One restore, nothing published; the row still sends Mehmet's version.
  expect(skymail.writes().map((request) => [request.method, request.path])).toEqual([
    ["POST", `/templates/${id}/versions/${first}/restore`],
  ]);
  const restored = skymail.versionsOf(id)[0];
  expect(restored).toMatchObject({
    seq: 5,
    published_at: null,
    base_version_id: sent.id,
    author: { kind: "operator", sub: VIEWER.sub },
    subject: "Bu hafta SKY LAB'de",
    html_content: mail("İlk metin"),
  });
  expect(skymail.row(id)).toEqual(live);
  expect(skymail.version(theirs.id).published_at).toBeNull();
});

test("restoring what is sent already opens no draft and stays in the history", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const { id, versionId: first } = skymail.addTemplate({
    name: "Bülten",
    subject: "Eylül bülteni",
    mainMode: "html",
    html: mail("Eylül"),
    htmlContent: mail("Eylül"),
    plainText: "Eylül",
    author: OTHER_OPERATOR,
  });
  skymail.publishAs(id, OTHER_OPERATOR, { html_source: mail("Ekim"), html_content: mail("Ekim") });
  // Someone put the first wording back.
  const sent = skymail.publishAs(id, OTHER_OPERATOR, { html_source: mail("Eylül"), html_content: mail("Eylül") });

  await page.goto(`/templates/history/${id}`);
  await item(page, 1).getByRole("button", { name: "Geri getir: sürüm #1" }).click();
  await page.getByRole("dialog", { name: "Sürümü geri getir" }).getByRole("button", { name: "Taslak olarak geri getir" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Sürüm #1, şu an gönderilen sürümle aynı; yeni taslak açılmadı." })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/templates/history/${id}$`));
  expect(skymail.writes().map((request) => request.path)).toEqual([`/templates/${id}/versions/${first}/restore`]);
  expect(skymail.versionsOf(id)).toHaveLength(3);
  expect(skymail.row(id).published_version_id).toBe(sent.id);
});

test("a reader pages through the history and compares, and is offered no restore", async ({ page, skymail, signIn }) => {
  await signIn("reader");
  const { id } = skymail.addTemplate({
    name: "Hoş geldin",
    subject: "SKY LAB'e hoş geldin",
    mainMode: "html",
    html: mail("Sürüm 1"),
    htmlContent: mail("Sürüm 1"),
    plainText: "Sürüm 1",
    author: TEMPLATE_SEED,
  });
  for (let seq = 2; seq <= 22; seq += 1) {
    skymail.publishAs(id, OTHER_OPERATOR, { html_source: mail(`Sürüm ${seq}`), html_content: mail(`Sürüm ${seq}`) });
  }

  await page.goto(`/templates/show/${id}`);
  await expect(page.getByRole("heading", { name: "Hoş geldin" })).toBeVisible();
  // No seed is refused: nothing says one was.
  await expect(page.getByText("Template seed reddedildi")).toHaveCount(0);
  await page.getByRole("link", { name: "Sürüm geçmişi" }).click();

  await expect(page.getByText("22 sürüm")).toBeVisible();
  await expect(page.getByRole("region", { name: "Template seed reddedildi" })).toHaveCount(0);
  await expect(item(page, 22)).toContainText("Gönderilen");
  await expect(page.getByRole("button", { name: /^Geri getir/ })).toHaveCount(0);

  await page.getByRole("navigation", { name: "Sürüm sayfaları" }).getByRole("button", { name: "Sayfa 2" }).click();
  await expect(page).toHaveURL(/\?page=2$/);
  await expect(page.getByRole("list", { name: "Sürümler" }).getByRole("listitem")).toHaveCount(2);
  await item(page, 1).getByRole("button", { name: "Gönderilenle karşılaştır: sürüm #1" }).click();

  const comparison = page.getByRole("dialog", { name: "Sürümleri karşılaştır" });
  await expect(preview(page, "Sürüm #1")).toContainText("Sürüm 1");
  await expect(preview(page, "Sürüm #22")).toContainText("Sürüm 22");
  await expect(comparison.getByRole("button", { name: /^Geri getir/ })).toHaveCount(0);
  expect(skymail.writes()).toHaveLength(0);
});
