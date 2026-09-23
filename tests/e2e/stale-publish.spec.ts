/**
 * Publishing a draft someone else's publish overtook (ADR-0047, the other way
 * round): the operator sees their draft and what is sent now side by side, as
 * rendered mail, and publishes only by confirming — and a publish that lands
 * while they compare puts the new version in front of them before anything is
 * replaced.
 */
import { OTHER_OPERATOR, TEMPLATE_SEED } from "./fixtures/mock-api";
import { expect, preview, test, writeSource } from "./fixtures";

const page1 = (text: string) => `<!DOCTYPE html><html><body><p>${text}</p><p>Merhaba {{.FirstName}}</p></body></html>`;

test("a stale draft is published only over the version the operator was shown", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const { id, versionId: first } = skymail.addTemplate({
    name: "Etkinlik duyurusu",
    subject: "Bu hafta SKY LAB'de",
    mainMode: "html",
    html: page1("İlk metin"),
    htmlContent: page1("İlk metin"),
    plainText: "İlk metin",
    author: OTHER_OPERATOR,
  });

  await page.goto(`/templates/edit/${id}`);
  await expect(page.getByRole("heading", { name: "Etkinlik duyurusu" })).toBeVisible();
  await writeSource(page, "html", page1("Benim taslağım"));
  await expect(preview(page, "Mail önizlemesi")).toContainText("Benim taslağım");
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Taslak kaydedildi" })).toBeVisible();
  const draft = skymail.versionsOf(id)[0];
  expect(draft.published_at).toBeNull();
  expect(draft.base_version_id).toBe(first);

  // Meanwhile someone else publishes.
  const theirs = skymail.publishAs(id, OTHER_OPERATOR, {
    html_source: page1("Mehmet'in metni"),
    html_content: page1("Mehmet'in metni"),
  });

  await page.getByRole("button", { name: "Yayımla", exact: true }).click();
  await page.getByRole("dialog", { name: "Taslağı yayımla" }).getByRole("button", { name: "Yayımla", exact: true }).click();

  const comparison = page.getByRole("dialog", { name: "Bu taslak bayat" });
  await expect(comparison).toBeVisible();
  await expect(preview(page, "Senin taslağın")).toContainText("Benim taslağım");
  await expect(preview(page, "Şu an gönderilen")).toContainText("Mehmet'in metni");
  await expect(comparison).toContainText("Mehmet Kaya");
  // Refused, not published: the row still sends their version.
  expect(skymail.row(id).published_version_id).toBe(theirs.id);

  // A Template seed publishes while the operator compares.
  const seeded = skymail.publishAs(id, TEMPLATE_SEED, {
    html_source: page1("Seed'in metni"),
    html_content: page1("Seed'in metni"),
  });
  await comparison.getByRole("button", { name: "Taslağımı yine de yayımla" }).click();

  // Refused again, naming the seed's version: the comparison is shown anew.
  await expect(comparison.getByText("Sen karşılaştırırken bir sürüm daha yayımlandı")).toBeVisible();
  await expect(preview(page, "Şu an gönderilen")).toContainText("Seed'in metni");
  expect(skymail.row(id).published_version_id).toBe(seeded.id);

  await comparison.getByRole("button", { name: "Taslağımı yine de yayımla" }).click();
  await expect(comparison).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Yayımlandı" })).toBeVisible();

  expect(skymail.row(id).published_version_id).toBe(draft.id);
  expect(skymail.row(id).html_content).toContain("Benim taslağım");
  const publishes = skymail.writes().filter((request) => request.path.endsWith("/publish"));
  expect(publishes.map((request) => request.body)).toEqual([
    null,
    { force: { over_version_id: theirs.id } },
    { force: { over_version_id: seeded.id } },
  ]);
});

test("backing out of the comparison publishes nothing", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const { id } = skymail.addTemplate({
    name: "Etkinlik duyurusu",
    subject: "Bu hafta SKY LAB'de",
    mainMode: "html",
    html: page1("İlk metin"),
    htmlContent: page1("İlk metin"),
    plainText: "İlk metin",
  });
  await page.goto(`/templates/edit/${id}`);
  await writeSource(page, "html", page1("Benim taslağım"));
  await expect(preview(page, "Mail önizlemesi")).toContainText("Benim taslağım");
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Taslak kaydedildi" })).toBeVisible();
  const theirs = skymail.publishAs(id, OTHER_OPERATOR, { subject: "Mehmet'in konusu" });

  await page.getByRole("button", { name: "Yayımla", exact: true }).click();
  await page.getByRole("dialog", { name: "Taslağı yayımla" }).getByRole("button", { name: "Yayımla", exact: true }).click();
  const comparison = page.getByRole("dialog", { name: "Bu taslak bayat" });
  await expect(comparison).toContainText("Mehmet'in konusu");
  await comparison.getByRole("button", { name: "Vazgeç" }).click();

  await expect(comparison).toBeHidden();
  expect(skymail.row(id).published_version_id).toBe(theirs.id);
  expect(skymail.writes().filter((request) => request.path.endsWith("/publish"))).toHaveLength(1);
});
