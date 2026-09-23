/**
 * Stories 37–39 and 41: a Mail template's history says who wrote each version
 * and how it stands; any two versions are compared as rendered mail; restoring
 * one opens a new draft in the editor and leaves live mail as it was; and a
 * Template seed refused because of an operator's change is said on the
 * template. A reader sees and compares, and restores nothing.
 */
import type { Page } from "@playwright/test";
import { OTHER_OPERATOR, TEMPLATE_SEED, type Author } from "./fixtures/mock-api";
import { VIEWER } from "./fixtures/session";
import { expect, preview, test } from "./fixtures";

const mail = (text: string) => `<!DOCTYPE html><html><body><p>${text}</p><p>Merhaba {{.FirstName}}</p></body></html>`;

/** A template's first version as the migration made it: no author on record. */
const MIGRATED: Author = { kind: "operator", sub: null, name: null };
const ME: Author = { kind: "operator", sub: VIEWER.sub, name: VIEWER.name };

const item = (page: Page, seq: number) => page.getByRole("listitem", { name: `Sürüm #${seq}`, exact: true });
const versions = (page: Page) => page.getByRole("list", { name: "Sürümler" }).getByRole("listitem");

test("two versions compare side by side, and restoring one opens a new draft while live mail stays", async ({
  page,
  skymail,
  signIn,
}) => {
  await signIn("writer");
  const { id, versionId: first } = skymail.addTemplate({
    name: "Etkinlik duyurusu",
    key: "club.event-announcement",
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
  await expect(page.getByText("Template seed reddedildi · 23 Eyl 2026 00:10")).toBeVisible();
  await page.getByRole("link", { name: "Sürüm geçmişi" }).click();
  await expect(page.getByRole("heading", { name: "Sürüm geçmişi", level: 1 })).toBeVisible();

  const refusal = page.getByRole("region", { name: "Template seed reddedildi" });
  await expect(refusal).toContainText("23 Eyl 2026 00:10 tarihinde bir Template seed, bir operatör değişikliği yüzünden reddedildi");
  await expect(refusal).toContainText("Gönderilen sürümü son Template seed değil, bir operatör yayımladı.");
  await expect(refusal).toContainText("Son Template seed'den sonra bir operatör yeni bir sürüm yazdı");
  await expect(refusal).toContainText("zorla bayrağıyla (--force=club.event-announcement) yeniden koşması demek");
  await expect(refusal).toContainText("Panelde yapman gereken bir şey yok.");

  // Newest first: who wrote each, and how it stands.
  await expect(versions(page)).toHaveCount(4);
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
  await expect(versions(page)).toHaveCount(1);
  await expect(item(page, 4)).toBeVisible();
  await page.getByRole("group", { name: "Gösterilen sürümler" }).getByRole("button", { name: "Hepsi" }).click();

  // Any two, side by side as rendered mail, the older first.
  await page.getByRole("checkbox", { name: "Karşılaştırmak için seç: sürüm #3" }).check();
  await page.getByRole("checkbox", { name: "Karşılaştırmak için seç: sürüm #1" }).check();
  await expect(page.getByText("2 sürüm seçili: #3 ve #1.")).toBeVisible();
  await page.getByRole("button", { name: "Seçilenleri karşılaştır" }).click();
  const comparison = page.getByRole("dialog", { name: "Sürümleri karşılaştır" });
  await expect(preview(page, "Sürüm #1")).toContainText("İlk metin");
  await expect(preview(page, "Sürüm #3")).toContainText("Mehmet'in metni");
  // Both filled with the same sample values.
  await expect(preview(page, "Sürüm #1")).toContainText("Merhaba Ayşe");
  await expect(preview(page, "Sürüm #3")).toContainText("Merhaba Ayşe");
  const differences = comparison.getByRole("table", { name: "Farklar" });
  await expect(differences.getByRole("row", { name: /^Ad / })).toContainText("Aynı: “Etkinlik duyurusu”");
  await expect(differences.getByRole("row", { name: /^Konu / })).toContainText("#1 “Bu hafta SKY LAB'de”");
  await expect(differences.getByRole("row", { name: /^Konu / })).toContainText("#3 “Mehmet'in konusu”");
  await expect(differences.getByRole("row", { name: /^Main source / })).toContainText("Aynı: HTML");
  await expect(differences.getByRole("row", { name: /^Gövde / })).toContainText("Farklı");
  await expect(comparison.locator("iframe").first()).toHaveAttribute("title", "Sürüm #1");

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

// 200 is "nothing written" (ticket 07), whatever the page last knew of the viewer's drafts.
test("restoring what the viewer's draft already is, saved in another tab, opens that draft and writes nothing", async ({
  page,
  skymail,
  signIn,
}) => {
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
  skymail.publishAs(id, OTHER_OPERATOR, { subject: "Ekim bülteni", html_source: mail("Ekim"), html_content: mail("Ekim") });

  await page.goto(`/templates/history/${id}`);
  await expect(item(page, 2)).toContainText("Gönderilen");

  // In another tab, the viewer saves a draft with the first wording back.
  const { subject, html_source, html_content, plain_text_content } = skymail.version(first);
  const mine = skymail.addDraft(id, ME, { subject, html_source, html_content, plain_text_content });

  await item(page, 1).getByRole("button", { name: "Geri getir: sürüm #1" }).click();
  await page.getByRole("dialog", { name: "Sürümü geri getir" }).getByRole("button", { name: "Taslak olarak geri getir" }).click();

  await expect(page).toHaveURL(new RegExp(`/templates/edit/${id}$`));
  await expect(
    page.getByRole("status").filter({ hasText: `Süren taslağın (#${mine.seq}) zaten sürüm #1 ile aynı; yeni taslak açılmadı.` }),
  ).toBeVisible();
  await expect(page.getByText(`Taslağını düzenliyorsun: #${mine.seq}`)).toBeVisible();
  expect(skymail.versionsOf(id)).toHaveLength(3);
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

test("one operator's saves on one base read as one row, stale once someone publishes, and each can be compared", async ({
  page,
  skymail,
  signIn,
}) => {
  await signIn("writer");
  const { id } = skymail.addTemplate({
    name: "Duyuru",
    subject: "Duyuru",
    mainMode: "html",
    html: mail("İlk"),
    htmlContent: mail("İlk"),
    plainText: "İlk",
    author: OTHER_OPERATOR,
  });
  skymail.addDraft(id, OTHER_OPERATOR, { html_source: mail("Taslak 1"), html_content: mail("Taslak 1") });
  skymail.addDraft(id, OTHER_OPERATOR, { html_source: mail("Taslak 2"), html_content: mail("Taslak 2") });
  skymail.publishAs(id, ME, { html_source: mail("Yayımlanan"), html_content: mail("Yayımlanan") });

  await page.goto(`/templates/history/${id}`);
  await expect(versions(page)).toHaveCount(3);
  await expect(item(page, 4)).toContainText("Gönderilen");
  await expect(item(page, 4)).toContainText("sen");
  await expect(item(page, 3)).toContainText("Bayat taslak");
  await expect(item(page, 2)).toBeHidden();

  await item(page, 3).getByRole("button", { name: "Aynı taslağın 1 önceki kaydı (#2)" }).click();
  await expect(item(page, 2)).toContainText("Bayat taslak");
  await page.getByRole("checkbox", { name: "Karşılaştırmak için seç: sürüm #2" }).check();
  await page.getByRole("checkbox", { name: "Karşılaştırmak için seç: sürüm #4" }).check();
  await page.getByRole("button", { name: "Seçilenleri karşılaştır" }).click();
  await expect(preview(page, "Sürüm #2")).toContainText("Taslak 1");
  await expect(preview(page, "Sürüm #4")).toContainText("Yayımlanan");
});

test("a reader pages through the history, compares across pages, and is offered no restore", async ({ page, skymail, signIn }) => {
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
  for (let seq = 2; seq <= 21; seq += 1) {
    skymail.publishAs(id, OTHER_OPERATOR, { html_source: mail(`Sürüm ${seq}`), html_content: mail(`Sürüm ${seq}`) });
  }
  // The version sent is a seed's, which starts from no version.
  skymail.publishAs(id, TEMPLATE_SEED, { html_source: mail("Sürüm 22"), html_content: mail("Sürüm 22") });

  await page.goto(`/templates/show/${id}`);
  await expect(page.getByRole("heading", { name: "Hoş geldin" })).toBeVisible();
  // No seed is refused: nothing says one was.
  await expect(page.getByText("Template seed reddedildi")).toHaveCount(0);
  await page.getByRole("link", { name: "Sürüm geçmişi" }).click();

  await expect(page.getByText("22 sürüm")).toBeVisible();
  await expect(page.getByRole("region", { name: "Template seed reddedildi" })).toHaveCount(0);
  await expect(item(page, 22)).toContainText("Gönderilen");
  await expect(page.getByRole("button", { name: /^Geri getir/ })).toHaveCount(0);

  // What came before a seed's version is asked of the API's published versions.
  const before = page.waitForRequest((request) => /\/versions\?state=published&_start=0&_end=50$/.test(request.url()));
  await item(page, 22).getByRole("button", { name: "Öncekiyle karşılaştır: sürüm #22" }).click();
  await before;
  const comparison = page.getByRole("dialog", { name: "Sürümleri karşılaştır" });
  await expect(preview(page, "Sürüm #21")).toContainText("Sürüm 21");
  await expect(preview(page, "Sürüm #22")).toContainText("Sürüm 22");
  await expect(comparison.getByRole("button", { name: /^Geri getir/ })).toHaveCount(0);
  await comparison.getByRole("button", { name: "Kapat" }).first().click();

  // A pick survives the page it was made on.
  await page.getByRole("checkbox", { name: "Karşılaştırmak için seç: sürüm #22" }).check();
  await page.getByRole("navigation", { name: "Sürüm sayfaları" }).getByRole("button", { name: "Sayfa 2" }).click();
  await expect(page).toHaveURL(/\?page=2$/);
  await expect(versions(page)).toHaveCount(2);
  await expect(page.getByText("1 sürüm seçili: #22; bir tane daha seç.")).toBeVisible();
  await page.getByRole("checkbox", { name: "Karşılaştırmak için seç: sürüm #1" }).check();
  await page.getByRole("button", { name: "Seçilenleri karşılaştır" }).click();
  await expect(preview(page, "Sürüm #1")).toContainText("Sürüm 1");
  await expect(preview(page, "Sürüm #22")).toContainText("Sürüm 22");
  await expect(comparison.getByRole("button", { name: /^Geri getir/ })).toHaveCount(0);
  expect(skymail.writes()).toHaveLength(0);
});
