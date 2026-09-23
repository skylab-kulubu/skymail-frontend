/**
 * Required variables (stories 32–34): a save that drops one — the
 * password-reset link — is refused by name, with why the mail needs it; the
 * contract's are locked; an operator marks what the sent mail references and
 * releases only what operators marked.
 *
 * The mock refuses what the server refuses: it reads the body with the rule
 * the server is held to, so a link left only in an HTML comment is missing
 * there as it is in the mail.
 */
import type { Page } from "@playwright/test";
import { expect, preview, test, writeSource } from "./fixtures";
import type { MockSkymail } from "./fixtures/mock-api";

const RESET_REASON = "Parola sıfırlama bağlantısı; kaldırılırsa kişi parolasını sıfırlayamaz ve mail işe yaramaz.";
const BUTTON = '<a href="{{.link}}" style="display:inline-block;padding:12px 20px;background:#8f5e98;color:#ffffff;">Yeni Parola Belirle</a>';
const FALLBACK = "<p>Buton çalışmazsa bu bağlantıyı tarayıcına yapıştır: {{.link}}</p>";
const GREETING = "<p>{{if .firstName}}Merhaba {{.firstName}}, {{end}}parolanı sıfırlamak için bir istek aldık.</p>";
const RESET_HTML = `<!DOCTYPE html>
<html lang="tr"><body style="margin:0;padding:24px;font-family:Helvetica,Arial,sans-serif;">
<h1>Parolanı Sıfırla</h1>
${GREETING}
<p>${BUTTON}</p>
{{if .linkExpirationMinutes}}<p>Bu bağlantı {{.linkExpirationMinutes}} dakika geçerli.</p>{{end}}
${FALLBACK}
</body></html>`;

/** A System template like the repo's keycloak.reset-password, in HTML: its contract is the link. */
function resetPassword(skymail: MockSkymail, operatorRequired: string[] = []) {
  return skymail.addTemplate({
    name: "Keycloak · Parola Sıfırlama",
    key: "keycloak.reset-password",
    system: true,
    subject: "SKY LAB parola sıfırlama isteği",
    mainMode: "html",
    html: RESET_HTML,
    htmlContent: RESET_HTML,
    plainText: "Parolanı Sıfırla",
    requiredVariables: [{ name: "link", reason: RESET_REASON }],
    operatorRequired,
  }).id;
}

const panelOf = (page: Page) => page.getByRole("region", { name: "Required variable'lar" });
const rowOf = (page: Page, name: string) => panelOf(page).getByRole("listitem").filter({ hasText: `{{.${name}}}` });
const draftSaves = (skymail: MockSkymail, id: string) =>
  skymail.requests.filter((request) => request.method === "POST" && request.path === `/templates/${id}/drafts`);

test("a save that deletes the password-reset link is refused, naming the variable and why", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const id = resetPassword(skymail);

  await page.goto(`/templates/edit/${id}`);
  const link = rowOf(page, "link");
  await expect(link).toContainText(RESET_REASON);
  await expect(link).toContainText("Sözleşme");
  // Locked: nothing in the panel offers to release it.
  await expect(link.getByRole("button")).toHaveCount(0);
  await expect(panelOf(page).getByRole("button", { name: /\{\{\.link\}\}/ })).toHaveCount(0);

  // The link deleted: the panel warns before the save, and the server refuses it by name, with why.
  await writeSource(page, "html", RESET_HTML.replace(BUTTON, "").replace(FALLBACK, ""));
  await expect(preview(page, "Mail önizlemesi")).not.toContainText("Yeni Parola Belirle");
  await expect(link).toContainText("Düzenlediğin gövde buna artık başvurmuyor");
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  const refusal = page.getByRole("alert").filter({ hasText: "Kaydedilmedi" });
  await expect(refusal).toContainText("{{.link}}");
  await expect(refusal).toContainText(RESET_REASON);
  await expect(refusal).toContainText("gönderen servisin sözleşmesi");
  await expect(link).toContainText("Kaydedilmedi: gövde bu değişkene başvurmuyor.");
  expect(draftSaves(skymail, id)).toHaveLength(1);

  // Commenting the button out instead is refused too: the mailer leaves an HTML comment out of the mail.
  const commented = RESET_HTML.replace("Parolanı Sıfırla", "Parolanı yeniden belirle")
    .replace(BUTTON, `<!-- ${BUTTON} -->`)
    .replace(FALLBACK, `<!-- ${FALLBACK} -->`);
  await writeSource(page, "html", commented);
  await expect(preview(page, "Mail önizlemesi")).toContainText("Parolanı yeniden belirle");
  await expect(link).toContainText("Kaydedilmedi: gövde bu değişkene başvurmuyor.");
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await expect.poll(() => draftSaves(skymail, id).length).toBe(2);
  expect(draftSaves(skymail, id)[1].body).toMatchObject({ html_content: commented });
  await expect(refusal).toContainText("{{.link}}");
  await expect(refusal).toContainText(RESET_REASON);

  // Nothing was written; the published mail keeps its link.
  expect(skymail.versionsOf(id)).toHaveLength(1);
  expect(skymail.row(id).html_content).toBe(RESET_HTML);

  // Kept inside a conditional section, the link counts: that saves.
  const conditional = commented.replace(`<!-- ${BUTTON} -->`, `{{if .link}}${BUTTON}{{end}}`);
  await writeSource(page, "html", conditional);
  await expect(preview(page, "Mail önizlemesi")).toContainText("Yeni Parola Belirle");
  await expect(link).not.toContainText("başvurmuyor");
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Taslak kaydedildi" })).toBeVisible();
  expect(skymail.versionsOf(id)[0]).toMatchObject({ html_content: conditional, published_at: null });
});

test("an operator marks what the sent mail references and releases only what operators marked", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const id = resetPassword(skymail);
  await page.goto(`/templates/edit/${id}`);

  // What the published body references and is not required yet; the link is required already.
  const panel = panelOf(page);
  await expect(panel.getByRole("button", { name: "{{.firstName}} değişkenini zorunlu işaretle" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "{{.linkExpirationMinutes}} değişkenini zorunlu işaretle" })).toBeVisible();
  await expect(panel.getByRole("button", { name: /işaretle/ })).toHaveCount(2);

  await panel.getByRole("button", { name: "{{.firstName}} değişkenini zorunlu işaretle" }).click();
  await expect(panel.getByRole("status").filter({ hasText: "{{.firstName}} artık zorunlu" })).toBeVisible();
  await expect(rowOf(page, "firstName")).toContainText("Bir operatör bu değişkeni zorunlu işaretledi.");
  await expect(panel.getByRole("button", { name: "{{.firstName}} değişkenini zorunlu işaretle" })).toHaveCount(0);
  expect(skymail.row(id).operator_required_variables).toEqual(["firstName"]);
  expect(skymail.versionsOf(id)).toHaveLength(1);

  // A variable only the draft has is named, not offered: the server marks only what the sent mail references.
  const edited = RESET_HTML.replace(GREETING, "<p>{{.username}} hesabının parolasını sıfırlamak için bir istek aldık.</p>");
  await writeSource(page, "html", edited);
  await expect(panel).toContainText("Yalnız taslağında geçiyor: {{.username}}");
  await expect(panel).toContainText("Taslağı yayımladıktan sonra burada işaretleyebilirsin.");
  await expect(panel.getByRole("button", { name: /username/ })).toHaveCount(0);
  await expect(rowOf(page, "firstName")).toContainText("Düzenlediğin gövde buna artık başvurmuyor");

  // What an operator marked is refused by name as the contract's is.
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  const refusal = page.getByRole("alert").filter({ hasText: "Kaydedilmedi" });
  await expect(refusal).toContainText("{{.firstName}} Bir operatör bu değişkeni zorunlu işaretledi. (operatör işaretledi)");
  await expect(rowOf(page, "firstName")).toContainText("Kaydedilmedi: gövde bu değişkene başvurmuyor.");
  expect(skymail.versionsOf(id)).toHaveLength(1);

  // Only the operator's has Çıkar; releasing it lets the same save through.
  await expect(rowOf(page, "link").getByRole("button")).toHaveCount(0);
  await rowOf(page, "firstName").getByRole("button", { name: "Çıkar {{.firstName}}" }).click();
  await expect(panel.getByRole("status").filter({ hasText: "{{.firstName}} artık zorunlu değil." })).toBeVisible();
  await expect(rowOf(page, "firstName")).toHaveCount(0);
  expect(skymail.row(id).operator_required_variables).toEqual([]);
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Taslak kaydedildi" })).toBeVisible();

  const writes = skymail.writes().map(({ method, path, body }) => ({ method, path, body }));
  expect(writes.filter((write) => write.path.includes("required-variables"))).toEqual([
    { method: "POST", path: `/templates/${id}/required-variables`, body: { name: "firstName" } },
    { method: "DELETE", path: `/templates/${id}/required-variables/firstName`, body: null },
  ]);
});

test("a publish is refused when the draft dropped a variable marked since it was saved", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const id = resetPassword(skymail);
  await page.goto(`/templates/edit/${id}`);

  const withoutName = RESET_HTML.replace(GREETING, "<p>Parolanı sıfırlamak için bir istek aldık.</p>");
  await writeSource(page, "html", withoutName);
  await expect(preview(page, "Mail önizlemesi")).not.toContainText("Merhaba");
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Taslak kaydedildi" })).toBeVisible();

  // The sent mail still greets by name, so it can be marked; the saved draft no longer does, and the panel says so first.
  await expect(panelOf(page)).toContainText("Taslağın buna başvurmuyor; işaretlersen taslağın yayımlanamaz.");
  await panelOf(page).getByRole("button", { name: "{{.firstName}} değişkenini zorunlu işaretle" }).click();
  await expect(rowOf(page, "firstName")).toContainText("Kaydettiğin taslak buna başvurmuyor; bu hâliyle yayımlanamaz.");
  await expect(rowOf(page, "firstName")).not.toContainText("Düzenlediğin");

  await page.getByRole("button", { name: "Yayımla", exact: true }).click();
  await page.getByRole("dialog", { name: "Taslağı yayımla" }).getByRole("button", { name: "Yayımla", exact: true }).click();
  const refusal = page.getByRole("alert").filter({ hasText: "Yayımlanmadı" });
  await expect(refusal).toContainText("{{.firstName}}");
  await expect(rowOf(page, "firstName")).toContainText("Yayımlanmadı: gövde bu değişkene başvurmuyor.");
  expect(skymail.row(id).html_content).toBe(RESET_HTML);
});

test("a variable the contract took over since the page opened is not released, and the panel re-reads it, again if that fails", async ({
  page,
  skymail,
  signIn,
}) => {
  await signIn("writer");
  const id = resetPassword(skymail, ["linkExpirationMinutes"]);
  await page.goto(`/templates/edit/${id}`);
  const row = rowOf(page, "linkExpirationMinutes");
  await expect(row.getByRole("button", { name: /^Çıkar/ })).toBeVisible();

  // A Template seed moves it into the contract meanwhile.
  const reason = "Bağlantının ne kadar geçerli olduğu; Keycloak her mailde gönderir.";
  const template = skymail.row(id);
  template.contract_required_variables.push({ name: "linkExpirationMinutes", reason });
  template.operator_required_variables = [];
  // The first re-read of the template fails.
  await page.route(
    `**/e2e-api/v1/templates/${id}`,
    (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "server.service_unavailable" }) }),
    { times: 1 },
  );

  await row.getByRole("button", { name: /^Çıkar/ }).click();
  const panel = panelOf(page);
  await expect(panel.getByRole("alert").filter({ hasText: "çıkarılamaz" })).toHaveText(
    "{{.linkExpirationMinutes}} gönderen servisin sözleşmesinde; panelden çıkarılamaz.",
  );
  const stale = panel.getByRole("status").filter({ hasText: "Panel güncel olmayabilir" });
  await expect(stale).toContainText("SkyMail şu anda yanıt vermiyor.");
  await expect(row).not.toContainText(reason);
  await stale.getByRole("button", { name: "Yeniden dene" }).click();

  // Shown as it is now: locked, with the contract's reason.
  await expect(stale).toHaveCount(0);
  await expect(row).toContainText(reason);
  await expect(row).toContainText("Sözleşme");
  await expect(row.getByRole("button")).toHaveCount(0);
});

test("mark and release wait while a save is in flight, and a mark on its way keeps its variable's name", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const id = resetPassword(skymail, ["linkExpirationMinutes"]);
  await page.goto(`/templates/edit/${id}`);
  const panel = panelOf(page);
  const mark = panel.getByRole("button", { name: "{{.firstName}} değişkenini zorunlu işaretle" });
  const release = rowOf(page, "linkExpirationMinutes").getByRole("button", { name: "Çıkar {{.linkExpirationMinutes}}" });
  await expect(mark).toBeEnabled();

  const save = skymail.hold("POST", `/templates/${id}/drafts`, "answer");
  await page.getByLabel("Konu").fill("SKY LAB parolanı sıfırla");
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await save.reached;
  await expect(mark).toBeDisabled();
  await expect(release).toBeDisabled();
  save.release();
  await expect(page.getByRole("status").filter({ hasText: "Taslak kaydedildi" })).toBeVisible();
  await expect(mark).toBeEnabled();
  await expect(release).toBeEnabled();

  const marking = skymail.hold("POST", `/templates/${id}/required-variables`, "answer");
  await mark.click();
  await marking.reached;
  await expect(panel.getByRole("button", { name: "{{.firstName}} işaretleniyor…" })).toBeDisabled();
  marking.release();
  await expect(rowOf(page, "firstName")).toBeVisible();
});

test("a save refused while a release was on its way does not bring the released variable back", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const id = resetPassword(skymail, ["firstName"]);
  await page.goto(`/templates/edit/${id}`);
  await writeSource(page, "html", RESET_HTML.replace(GREETING, "<p>Parolanı sıfırlamak için bir istek aldık.</p>"));
  await expect(rowOf(page, "firstName")).toContainText("Düzenlediğin gövde buna artık başvurmuyor");

  // The release reaches the server after the save, and is answered first.
  const release = skymail.hold("DELETE", `/templates/${id}/required-variables/firstName`, "request");
  const save = skymail.hold("POST", `/templates/${id}/drafts`, "answer");
  await rowOf(page, "firstName").getByRole("button", { name: "Çıkar {{.firstName}}" }).click();
  await release.reached;
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await save.reached;
  release.release();
  await expect(panelOf(page).getByRole("status").filter({ hasText: "{{.firstName}} artık zorunlu değil." })).toBeVisible();
  await expect(rowOf(page, "firstName")).toHaveCount(0);

  // The refusal still names it: firstName was required when the server saw the save.
  const reread = page.waitForResponse((response) => response.request().method() === "GET" && response.url().endsWith(`/templates/${id}`));
  save.release();
  await expect(page.getByRole("alert").filter({ hasText: "Kaydedilmedi" })).toContainText("{{.firstName}}");
  await expect(rowOf(page, "firstName")).toHaveCount(0);
  await reread;
  await expect(rowOf(page, "firstName")).toHaveCount(0);
  expect(skymail.row(id).operator_required_variables).toEqual([]);
});

test("a variable someone marked since the page opened is shown, pointed at, when a save is refused for it", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const id = resetPassword(skymail);
  await page.goto(`/templates/edit/${id}`);
  await expect(preview(page, "Mail önizlemesi")).toContainText("Merhaba");
  skymail.row(id).operator_required_variables = ["firstName"];

  await writeSource(page, "html", RESET_HTML.replace(GREETING, "<p>Parolanı sıfırlamak için bir istek aldık.</p>"));
  // Before the click, the panel says what marking it would do to this body.
  await expect(panelOf(page)).toContainText(
    "Düzenlediğin gövde buna başvurmuyor; işaretlersen bu hâliyle kaydedilemez ve yayımlanamaz.",
  );
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Kaydedilmedi" })).toContainText("{{.firstName}}");
  await expect(rowOf(page, "firstName")).toContainText("Kaydedilmedi: gövde bu değişkene başvurmuyor.");
  await expect(rowOf(page, "firstName").getByRole("button", { name: "Çıkar {{.firstName}}" })).toBeVisible();
});

test("a mark the server refuses for another variable names that one, with why", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  // A contract variable the sent mail does not reference, left from before the check.
  const codeReason = "Account center'a girilecek doğrulama kodu; kaldırılırsa kişisel e-posta onaylanamaz.";
  const id = skymail.addTemplate({
    name: "Keycloak · Parola Sıfırlama",
    key: "keycloak.reset-password",
    system: true,
    subject: "SKY LAB parola sıfırlama isteği",
    mainMode: "html",
    html: RESET_HTML,
    htmlContent: RESET_HTML,
    plainText: "Parolanı Sıfırla",
    requiredVariables: [
      { name: "code", reason: codeReason },
      { name: "link", reason: RESET_REASON },
    ],
  }).id;
  await page.goto(`/templates/edit/${id}`);
  await expect(rowOf(page, "code")).toContainText("Gönderilen sürüm buna başvurmuyor");

  await panelOf(page).getByRole("button", { name: "{{.firstName}} değişkenini zorunlu işaretle" }).click();
  const refusal = panelOf(page).getByRole("alert").filter({ hasText: "işaretlenemedi" });
  await expect(refusal).toContainText("{{.firstName}} işaretlenemedi");
  await expect(refusal).toContainText(`{{.code}} ${codeReason} (gönderen servisin sözleşmesi)`);
  await expect(refusal).not.toContainText("{{.firstName}} gönderilen mailde geçmiyor");
  expect(skymail.row(id).operator_required_variables).toEqual([]);
});

test("marking on a template archived since the page opened is refused as not found", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const id = resetPassword(skymail);
  await page.goto(`/templates/edit/${id}`);
  const mark = panelOf(page).getByRole("button", { name: "{{.firstName}} değişkenini zorunlu işaretle" });
  await expect(mark).toBeVisible();
  skymail.row(id).archived_at = "2026-09-23T07:30:00Z";

  await mark.click();
  await expect(panelOf(page).getByRole("alert")).toHaveText("Aradığın kayıt bulunamadı. Silinmiş ya da arşivlenmiş olabilir.");
  expect(skymail.row(id).operator_required_variables).toEqual([]);
});

test("a reader sees the Required variables locked and read-only", async ({ page, skymail, signIn }) => {
  await signIn("reader");
  const id = resetPassword(skymail, ["firstName"]);
  await page.goto(`/templates/show/${id}`);

  await expect(rowOf(page, "link")).toContainText(RESET_REASON);
  await expect(rowOf(page, "firstName")).toContainText("Bir operatör bu değişkeni zorunlu işaretledi.");
  await expect(panelOf(page).getByRole("button")).toHaveCount(0);
  await expect(panelOf(page)).not.toContainText("Zorunlu işaretle");
  expect(skymail.writes()).toHaveLength(0);
});
