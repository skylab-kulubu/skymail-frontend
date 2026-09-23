/**
 * The send form (ticket 16): a Mail template or a free announcement, to a
 * mailing list or to people one by one. superadmin links an Event's list to
 * /mail-tasks/create?mail_list_id=<id>, so that list is preselected. A free
 * announcement's body is written in the Visual editor and goes out as
 * markup the server's allow-list keeps. People are sent to one by one, and
 * one who fails does not stop the others. A send that may already be open is
 * never sent again without a confirmation that says it may mail someone twice.
 */
import type { Page } from "@playwright/test";
import { expect, preview, test } from "./fixtures";
import type { MockSkymail } from "./fixtures/mock-api";

/** free.basic as the Template seed publishes it, trimmed to what the form reads. */
function freeBasic(skymail: MockSkymail) {
  return skymail.addTemplate({
    name: "Serbest Gönderim",
    key: "free.basic",
    subject: "{{.Subject}}",
    mainMode: "jsx",
    jsx: "export default () => null;",
    htmlContent:
      '<!DOCTYPE html><html><body style="font-family:sans-serif"><p style="display:none">{{.Subject}}</p>' +
      '{{if .Heading}}<h1>{{.Heading}}</h1>{{end}}<div class="t-body">{{safeHTML .BodyHtml}}</div>' +
      '{{if .CtaUrl}}<a href="{{.CtaUrl}}">{{if .CtaLabel}}{{.CtaLabel}}{{end}}</a>{{end}}' +
      "<p>Bu e-postayı SKY LAB üyesi olduğun için alıyorsun.</p></body></html>",
    plainText: "{{safeHTML .BodyHtml}}",
  });
}

function reminder(skymail: MockSkymail) {
  return skymail.addTemplate({
    name: "Etkinlik hatırlatması",
    key: "event.reminder",
    subject: "{{.EventName}} yarın",
    mainMode: "html",
    html: "<p>…</p>",
    htmlContent: '<p>Merhaba {{.FullName}}, {{.EventName}} yarın.</p><p><a href="{{.DetailsUrl}}">Ayrıntılar</a></p>',
    plainText: "Merhaba {{.FullName}}, {{.EventName}} yarın.",
  });
}

const PARTICIPANTS = [
  { full_name: "Ayşe Yılmaz", email: "ayse@ornek.com" },
  { full_name: "Ali Can", email: "ali@ornek.com" },
  { full_name: "Zeynep Kaya", email: "zeynep@ornek.com" },
];

const SERVER_ERROR = { status: 500, body: { code: "server.internal_server_error", message: "boom" } };

const listRadio = (page: Page, name: string) =>
  page.getByRole("group", { name: "Mail listesi" }).getByRole("radio", { name: new RegExp(name) });

const body = (page: Page) => page.getByRole("textbox", { name: "Gövde" });
const toolbar = (page: Page) => page.getByRole("toolbar", { name: "Visual editör araçları" });
const send = (page: Page) => page.getByRole("button", { name: "Gönder…", exact: true });
const dialog = (page: Page, name = "Gönderimi onayla") => page.getByRole("dialog", { name });

async function typeWith(page: Page, mark: "Kalın" | "İtalik", text: string) {
  await toolbar(page).getByRole("button", { name: mark }).click();
  await page.keyboard.type(text);
  await toolbar(page).getByRole("button", { name: mark }).click();
}

async function pickReminder(page: Page) {
  await page.getByRole("button", { name: "Mail template" }).click();
  await page.getByRole("group", { name: "Mail template" }).getByRole("radio", { name: /Etkinlik hatırlatması/ }).check();
}

test("superadmin's link preselects the list, and so does the list's own Yeni gönderim", async ({ page, skymail, signIn }) => {
  await signIn("sender");
  freeBasic(skymail);
  skymail.addList({ name: "Beta kullanıcıları", recipients: PARTICIPANTS.slice(0, 1) });
  const gecekodu = skymail.addList({ name: "GECEKODU katılımcıları", recipients: PARTICIPANTS });
  const weblab = skymail.addList({ name: "WEBLAB", source: "keycloak", groupPath: "/UYELER/ARGE/WEBLAB", recipients: PARTICIPANTS.slice(0, 2) });

  await page.goto(`/mail-tasks/create?mail_list_id=${gecekodu}`);
  await expect(listRadio(page, "GECEKODU katılımcıları")).toBeChecked();
  await expect(listRadio(page, "Beta kullanıcıları")).not.toBeChecked();
  await expect(page.getByText("3 alıcı.")).toBeVisible();

  // A Keycloak group is sent to as its members, from its own page too.
  await page.goto(`/mailing-lists/show/${weblab}`);
  await page.getByRole("button", { name: "Yeni gönderim" }).click();
  await expect(page).toHaveURL(`/mail-tasks/create?mail_list_id=${weblab}`);
  await expect(listRadio(page, "WEBLAB")).toBeChecked();
  await expect(page.getByText("2 üye. E-posta adresi olmayan üyeye gönderilmez.")).toBeVisible();

  // A list that is gone is said to be, and nothing is picked for the sender.
  await page.goto("/mail-tasks/create?mail_list_id=3f0c1a52-0000-4000-8000-00000000dead");
  await expect(page.getByText("Bağlantıdaki mail listesi bulunamadı")).toBeVisible();
  await expect(page.getByRole("group", { name: "Mail listesi" }).getByRole("radio", { checked: true })).toHaveCount(0);
});

test("a free announcement written in the Visual editor goes to a list as the allow-listed markup", async ({ page, skymail, signIn }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn("sender");
  const free = freeBasic(skymail);
  const gecekodu = skymail.addList({ name: "GECEKODU katılımcıları", recipients: PARTICIPANTS });

  await page.goto(`/mail-tasks/create?mail_list_id=${gecekodu}`);
  await expect(page.getByRole("button", { name: "Serbest duyuru" })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Konu").fill("GECEKODU başvuruları açıldı");

  // Only what the server keeps is offered: no variables, sections, images, rules or house buttons.
  await body(page).click();
  for (const missing of ["Değişken ekle", "Görsel ekle", "Ayraç ekle", "Koşullu bölüm ekle", "Buton ekle"]) {
    await expect(toolbar(page).getByRole("button", { name: missing })).toHaveCount(0);
  }

  await toolbar(page).getByRole("radio", { name: "Başlık", exact: true }).click();
  await page.keyboard.type("Başvurular açıldı");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Davutpaşa'da, son gün ");
  await typeWith(page, "Kalın", "5 Nisan");
  await page.keyboard.type(". Ayrıntılar burada");
  for (let step = 0; step < "burada".length; step += 1) await page.keyboard.press("Shift+ArrowLeft");
  await toolbar(page).getByRole("button", { name: "Bağlantı" }).click();
  await page.getByLabel("Bağlantı adresi").fill("https://skyl.app/gecekodu?kaynak=mail&tur='duyuru'");
  await page.getByRole("button", { name: "Bağlantıyı uygula" }).click();
  await expect(body(page)).toBeFocused();
  // Typing on after a link follows it: the link's text stays as it was.
  await page.keyboard.type(".");
  await expect(body(page).getByRole("link", { name: "burada", exact: true })).toBeVisible();
  // A line break inside the paragraph, then a bulleted list.
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("Kontenjan sınırlı.");
  await page.keyboard.press("Enter");
  await toolbar(page).getByRole("button", { name: "Madde listesi" }).click();
  await page.keyboard.type("24 saat");
  await page.keyboard.press("Enter");
  await page.keyboard.type("3–5 kişilik takımlar");
  // An empty item ends the list; then a sub-heading and a quote.
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await toolbar(page).getByRole("radio", { name: "Alt başlık" }).click();
  await expect(toolbar(page).getByRole("radio", { name: "Alt başlık" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.type("Program");
  await page.keyboard.press("Enter");
  await toolbar(page).getByRole("button", { name: "Alıntı" }).click();
  await page.keyboard.type("Bir gecede bir ürün.");

  // The preview is the published free.basic with exactly this body.
  await expect(page.getByText(/^Konu\s*GECEKODU başvuruları açıldı$/)).toBeVisible();
  const mail = preview(page, "Gönderim önizlemesi");
  await expect(mail.locator("h2")).toHaveText("Başvurular açıldı");
  await expect(mail.locator("li")).toHaveText(["24 saat", "3–5 kişilik takımlar"]);
  await expect(mail.locator("h3")).toHaveText("Program");
  await expect(mail.locator("blockquote")).toHaveText("Bir gecede bir ürün.");
  await expect(mail.getByRole("link", { name: "burada" })).toBeVisible();

  await send(page).click();
  await expect(dialog(page)).toContainText("Serbest duyuru “GECEKODU başvuruları açıldı”");
  await expect(dialog(page)).toContainText("“GECEKODU katılımcıları” listesi (3 alıcı)");
  await expect(dialog(page)).not.toContainText("Göndermeden önce bak");
  await dialog(page).getByRole("button", { name: "Gönder", exact: true }).click();

  await expect(page).toHaveURL(/\/mail-tasks\/show\/b1c2d3e4-/);
  await expect(page.getByRole("status").filter({ hasText: "Gönderim kuyruğa alındı" })).toHaveText(
    "Gönderim kuyruğa alındı: Serbest duyuru “GECEKODU başvuruları açıldı”, “GECEKODU katılımcıları” listesine.",
  );

  const sends = skymail.sendRequests();
  expect(sends.map((request) => request.path)).toEqual(["/mail_tasks"]);
  expect(sends[0].body).toEqual({
    template_id: free.id,
    mail_list_id: gecekodu,
    body_variables: {
      Subject: "GECEKODU başvuruları açıldı",
      Heading: "",
      BodyHtml:
        "<h2>Başvurular açıldı</h2>" +
        "<p>Davutpaşa&#39;da, son gün <strong>5 Nisan</strong>. Ayrıntılar " +
        '<a href="https://skyl.app/gecekodu?kaynak=mail&amp;tur=%27duyuru%27">burada</a>.<br>Kontenjan sınırlı.</p>' +
        "<ul><li>24 saat</li><li>3–5 kişilik takımlar</li></ul>" +
        "<h3>Program</h3>" +
        "<blockquote>Bir gecede bir ürün.</blockquote>",
      CtaUrl: "",
      CtaLabel: "",
    },
  });
  expect(errors).toEqual([]);
});

test("a list send that may already be open is held back until a re-send is confirmed", async ({ page, skymail, signIn }) => {
  await signIn("sender");
  freeBasic(skymail);
  const gecekodu = skymail.addList({ name: "GECEKODU katılımcıları", recipients: PARTICIPANTS });
  skymail.refuseListSend(SERVER_ERROR);

  await page.goto(`/mail-tasks/create?mail_list_id=${gecekodu}`);
  await page.getByLabel("Konu").fill("Duyuru");
  await body(page).click();
  await page.keyboard.type("Merhaba.");
  await send(page).click();
  await dialog(page).getByRole("button", { name: "Gönder", exact: true }).click();

  const held = page.getByRole("status").filter({ hasText: "Bu listeye gönderim açılmış olabilir." });
  await expect(held).toContainText("Sunucu bir hatayla yanıt verdi (HTTP 500). Gönderim açılmış olabilir.");
  await expect(held).toContainText("Gönderimler listesine bak");
  await expect(send(page)).toBeDisabled();
  expect(skymail.sendRequests()).toHaveLength(1);

  await held.getByRole("button", { name: "Yine de yeniden gönder…" }).click();
  const again = dialog(page, "Listeye yeniden gönder");
  await expect(again).toContainText("Yeniden göndermek listedeki herkese aynı maili ikinci kez gönderebilir.");
  await expect(again).toContainText("“GECEKODU katılımcıları” listesi (3 alıcı)");
  await again.getByRole("button", { name: "Yine de yeniden gönder" }).click();

  await expect(page).toHaveURL(/\/mail-tasks\/show\/b1c2d3e4-/);
  expect(skymail.sendRequests().map((request) => request.path)).toEqual(["/mail_tasks", "/mail_tasks"]);
});

test("people are sent to one by one; one whose send may be open is said so, and sent again only when confirmed", async ({ page, skymail, signIn }) => {
  await signIn("sender");
  freeBasic(skymail);
  const { id } = reminder(skymail);
  skymail.refuseSingle("ali@ornek.com", SERVER_ERROR);

  await page.goto("/mail-tasks/create");
  await pickReminder(page);
  await page.getByRole("button", { name: "Kişiler" }).click();

  // An address that is not one stops the send, and the focus goes to it; a missing name is only pointed out.
  await page.getByLabel("1. kişinin e-posta adresi").fill("ayse@ornek.com");
  await page.getByRole("button", { name: "Kişi ekle" }).click();
  await page.getByLabel("2. kişinin adı soyadı").fill("Ali Can");
  await page.getByLabel("2. kişinin e-posta adresi").fill("ali@");
  await page.getByLabel("EventName").fill("GECEKODU");
  await page.getByLabel("DetailsUrl").fill("https://skyl.app/gecekodu");
  await expect(page.getByText("Bu mail alıcıyı adıyla anıyor ({{.FullName}}); adı boş giderse selamlama eksik kalır.")).toBeVisible();
  await page.getByLabel("DetailsUrl").press("Enter");
  await expect(page.getByText("Geçerli bir e-posta adresi gir.")).toBeVisible();
  await expect(page.getByLabel("2. kişinin e-posta adresi")).toBeFocused();
  await expect(dialog(page)).toHaveCount(0);

  await page.getByLabel("2. kişinin e-posta adresi").fill("ali@ornek.com");
  await page.getByRole("button", { name: "Kişi ekle" }).click();
  await page.getByLabel("3. kişinin adı soyadı").fill("Zeynep Kaya");
  await page.getByLabel("3. kişinin e-posta adresi").fill("zeynep@ornek.com");
  await send(page).click();
  await expect(dialog(page)).toContainText("Göndermeden önce bak");
  await expect(dialog(page)).toContainText("1. kişi (ayse@ornek.com): Bu mail alıcıyı adıyla anıyor");
  await dialog(page).getByRole("button", { name: "İptal" }).click();
  await page.getByLabel("1. kişinin adı soyadı").fill("Ayşe Yılmaz");
  await expect(preview(page, "Gönderim önizlemesi")).toContainText("Merhaba Ayşe Yılmaz, GECEKODU yarın.");

  await send(page).click();
  await expect(dialog(page)).toContainText("3 kişi, her biri ayrı bir gönderim");
  await expect(dialog(page)).toContainText("Ayşe Yılmaz, Ali Can, Zeynep Kaya");
  await dialog(page).getByRole("button", { name: "Gönder", exact: true }).click();

  const summary = page.getByRole("region", { name: "Gönderim sonucu" });
  await expect(summary).toContainText("3 kişiden 2 kişiye gönderim açıldı; 1 kişiye açılıp açılmadığı belli değil.");
  const people = summary.getByRole("list", { name: "Kişiler" }).getByRole("listitem");
  await expect(people.nth(0)).toContainText("Kuyruğa alındı");
  await expect(people.nth(1)).toContainText("Açılmış olabilir");
  await expect(people.nth(1)).toContainText("Sunucu bir hatayla yanıt verdi (HTTP 500). Bu kişiye gönderim açılmış olabilir.");
  await expect(people.nth(2).getByRole("link", { name: "Gönderimi gör" })).toHaveAttribute("href", /\/mail-tasks\/show\/b1c2d3e4-/);

  const sends = skymail.sendRequests();
  expect(sends.map((request) => (request.body as { recipient_email: string }).recipient_email)).toEqual([
    "ayse@ornek.com",
    "ali@ornek.com",
    "zeynep@ornek.com",
  ]);
  expect(sends[0].body).toEqual({
    template_id: id,
    recipient_email: "ayse@ornek.com",
    recipient_full_name: "Ayşe Yılmaz",
    body_variables: { EventName: "GECEKODU", DetailsUrl: "https://skyl.app/gecekodu" },
  });

  // Sending again takes a confirmation that names who may get the mail twice, and goes only to them.
  await summary.getByRole("button", { name: "Yeniden gönder…" }).click();
  const again = dialog(page, "Kişilere yeniden gönder");
  await expect(again).toContainText("aynı maili ikinci kez gönderebilir");
  await expect(again).toContainText("Ali Can <ali@ornek.com>");
  expect(skymail.sendRequests()).toHaveLength(3);
  await again.getByRole("button", { name: "Yine de yeniden gönder" }).click();
  await expect(summary).toContainText("3 kişinin hepsine gönderim açıldı.");
  expect(skymail.sendRequests().map((request) => (request.body as { recipient_email: string }).recipient_email)).toEqual([
    "ayse@ornek.com",
    "ali@ornek.com",
    "zeynep@ornek.com",
    "ali@ornek.com",
  ]);
});

test("a template archived since the page opened is refused, said to be, and not offered again", async ({ page, skymail, signIn }) => {
  await signIn("sender");
  const { id } = reminder(skymail);
  const gecekodu = skymail.addList({ name: "GECEKODU katılımcıları", recipients: PARTICIPANTS });

  await page.goto(`/mail-tasks/create?mail_list_id=${gecekodu}`);
  // Without free.basic, the form starts on a Mail template.
  await page.getByRole("group", { name: "Mail template" }).getByRole("radio", { name: /Etkinlik hatırlatması/ }).check();
  await page.getByLabel("EventName").fill("GECEKODU");
  await send(page).click();
  skymail.archiveTemplate(id);
  await dialog(page).getByRole("button", { name: "Gönder", exact: true }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Gönderim açılmadı." })).toContainText(
    "Bu Mail template arşivlenmiş; arşivlenmiş bir template gönderilmez. Başka bir template seç ya da template'i geri getir.",
  );
  await expect(page.getByRole("button", { name: "Yine de yeniden gönder…" })).toHaveCount(0);
  await expect(page).toHaveURL(`/mail-tasks/create?mail_list_id=${gecekodu}`);
});

test("who may send what: people only with mails:send, who is told to ask about a send that may be open; the rest goes for approval", async ({ page, skymail, signIn, context }) => {
  freeBasic(skymail);
  reminder(skymail);
  const gecekodu = skymail.addList({ name: "GECEKODU katılımcıları", recipients: PARTICIPANTS });
  skymail.refuseSingle("ayse@ornek.com", { status: 502, body: { code: "server.service_unavailable", message: "x" } });

  await signIn("individual");
  await page.goto(`/mail-tasks/create?mail_list_id=${gecekodu}`);
  await expect(page.getByText("Bu bağlantı bir mail listesine gönderim için, ama bu hesap mail listelerini göremiyor (skymail:lists:read)")).toBeVisible();
  await expect(page.getByText("Mail listelerini görmek için skymail:lists:read rolü gerekiyor; bu hesapla kişilere gönderebilirsin.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mail listesi" })).toHaveCount(0);
  expect(skymail.requests.some((request) => request.path.startsWith("/mailing_lists"))).toBe(false);

  await pickReminder(page);
  await page.getByLabel("1. kişinin adı soyadı").fill("Ayşe Yılmaz");
  await page.getByLabel("1. kişinin e-posta adresi").fill("ayse@ornek.com");
  await page.getByLabel("EventName").fill("GECEKODU");
  await send(page).click();
  await dialog(page).getByRole("button", { name: "Gönder", exact: true }).click();
  await expect(page.getByRole("region", { name: "Gönderim sonucu" })).toContainText(
    "Gönderimleri görme yetkin (skymail:mails:read) yok: yeniden göndermeden önce bu yetkisi olan birine gönderimin açılıp açılmadığını sor.",
  );
  await expect(page.getByRole("button", { name: "Gönderimlere git" })).toHaveCount(0);

  // Sending nothing, the watcher submits for approval (ticket 20).
  await context.clearCookies();
  await signIn("watcher");
  await page.goto("/mail-tasks/create");
  await expect(page.getByLabel("Konu")).toBeVisible();
  await expect(page.getByText("Bu hesap mail gönderemez (skymail:mails:send ya da skymail:mails:write rolü gerekiyor)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Onaya sun…" })).toBeVisible();
  await expect(send(page)).toHaveCount(0);
  await page.goto("/mail-tasks");
  await expect(page.getByRole("heading", { name: "Gönderimler" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Yeni gönderim" })).toBeVisible();
});

test("someone who sends to people and reads lists starts on people, sent at once; a list goes for approval", async ({ page, skymail, signIn }) => {
  await signIn("personSender");
  reminder(skymail);
  skymail.addList({ name: "GECEKODU katılımcıları", recipients: PARTICIPANTS });

  await page.goto("/mail-tasks/create");
  await expect(page.getByRole("button", { name: "Kişiler" })).toHaveAttribute("aria-pressed", "true");
  await expect(send(page)).toBeVisible();
  await pickReminder(page);
  await page.getByLabel("1. kişinin adı soyadı").fill("Ayşe Yılmaz");
  await page.getByLabel("1. kişinin e-posta adresi").fill("ayse@ornek.com");
  await page.getByLabel("EventName").fill("GECEKODU");
  // Enter sends, as the main action does.
  await page.getByLabel("EventName").press("Enter");
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole("button", { name: "İptal" }).click();

  await page.getByRole("button", { name: "Mail listesi" }).click();
  await expect(send(page)).toHaveCount(0);
  await expect(page.getByText("Bu hesap bir mail listesine doğrudan gönderemez (skymail:mails:write rolü gerekiyor)")).toBeVisible();
  expect(skymail.sendRequests()).toEqual([]);
});
