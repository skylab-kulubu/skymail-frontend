/**
 * The send form (ticket 16): a Mail template or a free announcement, to a
 * mailing list or to people one by one. superadmin links an Event's list to
 * /mail-tasks/create?mail_list_id=<id>, so that list is preselected. A free
 * announcement's body is written in the Visual editor and goes out as the
 * markup the server's allow-list keeps, byte for byte. People are sent to one
 * by one, and one who fails does not stop the others.
 */
import type { Page } from "@playwright/test";
import { sanitizeLikeServer } from "../../src/lib/mail-render/server-allowlist";
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

const listRadio = (page: Page, name: string) =>
  page.getByRole("group", { name: "Mail listesi" }).getByRole("radio", { name: new RegExp(name) });

const body = (page: Page) => page.getByRole("textbox", { name: "Gövde" });
const toolbar = (page: Page) => page.getByRole("toolbar", { name: "Visual editör araçları" });

async function typeWith(page: Page, mark: "Kalın" | "İtalik", text: string) {
  await toolbar(page).getByRole("button", { name: mark }).click();
  await page.keyboard.type(text);
  await toolbar(page).getByRole("button", { name: mark }).click();
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

test("a free announcement written in the Visual editor goes to a list as the markup the server keeps", async ({ page, skymail, signIn }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn("sender");
  const free = freeBasic(skymail);
  const gecekodu = skymail.addList({ name: "GECEKODU katılımcıları", recipients: PARTICIPANTS });

  await page.goto(`/mail-tasks/create?mail_list_id=${gecekodu}`);
  await expect(page.getByRole("button", { name: "Serbest duyuru" })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Konu").fill("GECEKODU başvuruları açıldı");

  // Only what the server keeps is offered: no variables, sections, images or rules.
  await body(page).click();
  for (const missing of ["Değişken ekle", "Görsel ekle", "Ayraç ekle", "Koşullu bölüm ekle"]) {
    await expect(toolbar(page).getByRole("button", { name: missing })).toHaveCount(0);
  }

  await toolbar(page).getByRole("radio", { name: "Başlık" }).click();
  await page.keyboard.type("Başvurular açıldı");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Davutpaşa'da, son gün ");
  await typeWith(page, "Kalın", "5 Nisan");
  await page.keyboard.type(". Ayrıntılar burada");
  for (let step = 0; step < "burada".length; step += 1) await page.keyboard.press("Shift+ArrowLeft");
  await toolbar(page).getByRole("button", { name: "Bağlantı" }).click();
  await page.getByLabel("Bağlantı adresi").fill("https://skyl.app/gecekodu?kaynak=mail&tur='duyuru'");
  await page.getByRole("button", { name: "Bağlantıyı uygula" }).click();
  await expect(body(page).getByRole("link", { name: "burada" })).toBeVisible();
  await expect(body(page)).toBeFocused();
  // The link's text is still selected: ArrowRight goes past it (End would not, with a selection).
  await page.keyboard.press("ArrowRight");
  await page.keyboard.type(".");
  await page.keyboard.press("Enter");
  await toolbar(page).getByRole("button", { name: "Buton ekle" }).click();
  await page.getByRole("group", { name: "Buton" }).getByLabel("Etiket").fill("Başvuruya git");
  await page.getByRole("group", { name: "Buton" }).getByLabel("Adres").fill("https://skyl.app/gecekodu");

  // The preview is the published free.basic with this body, as the server keeps it.
  await expect(page.getByText(/^Konu\s*GECEKODU başvuruları açıldı$/)).toBeVisible();
  const mail = preview(page, "Gönderim önizlemesi");
  await expect(mail.locator("h2")).toHaveText("Başvurular açıldı");
  await expect(mail.getByRole("link", { name: "burada" })).toHaveAttribute("target", "_blank");
  await expect(mail).toContainText("Başvuruya git");

  await page.getByRole("button", { name: "Gönder…" }).click();
  const dialog = page.getByRole("dialog", { name: "Gönderimi onayla" });
  await expect(dialog).toContainText("Serbest duyuru “GECEKODU başvuruları açıldı”");
  await expect(dialog).toContainText("“GECEKODU katılımcıları” listesi (3 alıcı)");
  await dialog.getByRole("button", { name: "Gönder", exact: true }).click();

  await expect(page).toHaveURL(/\/mail-tasks\/show\/b1c2d3e4-/);
  await expect(page.getByRole("status").filter({ hasText: "Gönderim kuyruğa alındı" })).toHaveText(
    "Gönderim kuyruğa alındı: Serbest duyuru “GECEKODU başvuruları açıldı”, “GECEKODU katılımcıları” listesine.",
  );
  await expect(page.getByRole("heading", { name: "Serbest Gönderim" })).toBeVisible();

  const sends = skymail.sendRequests();
  expect(sends.map((send) => send.path)).toEqual(["/mail_tasks"]);
  const bodyHtml =
    "<h2>Başvurular açıldı</h2>" +
    "<p>Davutpaşa&#39;da, son gün <strong>5 Nisan</strong>. Ayrıntılar " +
    '<a href="https://skyl.app/gecekodu?kaynak=mail&amp;tur=%27duyuru%27">burada</a>.</p>' +
    '<p><a href="https://skyl.app/gecekodu"><strong>Başvuruya git</strong></a></p>';
  expect(sends[0].body).toEqual({
    template_id: free.id,
    mail_list_id: gecekodu,
    body_variables: { Subject: "GECEKODU başvuruları açıldı", Heading: "", BodyHtml: bodyHtml, CtaUrl: "", CtaLabel: "" },
  });
  // Nothing in it is dropped or rewritten on the way.
  expect(sanitizeLikeServer(bodyHtml, { serverAdditions: false })).toBe(bodyHtml);
  expect(errors).toEqual([]);
});

test("people are sent to one by one, and the one who failed is said to have", async ({ page, skymail, signIn }) => {
  await signIn("sender");
  freeBasic(skymail);
  const { id } = reminder(skymail);
  skymail.refuseSingle("ali@ornek.com", { status: 500, body: { code: "server.internal_server_error", message: "boom" } });

  await page.goto("/mail-tasks/create");
  await page.getByRole("button", { name: "Mail template" }).click();
  await page.getByRole("group", { name: "Mail template" }).getByRole("radio", { name: /Etkinlik hatırlatması/ }).check();
  await page.getByRole("button", { name: "Kişiler" }).click();

  // The mail greets people by name, so a row without one is refused before anything goes out.
  await page.getByLabel("1. kişinin e-posta adresi").fill("ayse@ornek.com");
  await page.getByLabel("EventName").fill("GECEKODU");
  await page.getByLabel("DetailsUrl").fill("https://skyl.app/gecekodu");
  await page.getByRole("button", { name: "Gönder…" }).click();
  await expect(page.getByText("Bu mail alıcıyı adıyla anıyor ({{.FullName}}); adını yaz.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByLabel("1. kişinin adı soyadı").fill("Ayşe Yılmaz");
  await page.getByRole("button", { name: "Kişi ekle" }).click();
  await page.getByLabel("2. kişinin adı soyadı").fill("Ali Can");
  await page.getByLabel("2. kişinin e-posta adresi").fill("ali@ornek.com");
  await page.getByRole("button", { name: "Kişi ekle" }).click();
  await page.getByLabel("3. kişinin adı soyadı").fill("Zeynep Kaya");
  await page.getByLabel("3. kişinin e-posta adresi").fill("zeynep@ornek.com");
  await expect(preview(page, "Gönderim önizlemesi")).toContainText("Merhaba Ayşe Yılmaz, GECEKODU yarın.");

  await page.getByRole("button", { name: "Gönder…" }).click();
  const dialog = page.getByRole("dialog", { name: "Gönderimi onayla" });
  await expect(dialog).toContainText("3 kişi, her biri ayrı bir gönderim");
  await expect(dialog).toContainText("Ayşe Yılmaz, Ali Can, Zeynep Kaya");
  await dialog.getByRole("button", { name: "Gönder", exact: true }).click();

  const summary = page.getByRole("region", { name: "Gönderim sonucu" });
  await expect(summary).toContainText("3 kişiden 2 kişiye gönderim açıldı, 1 kişiye açılamadı.");
  const people = summary.getByRole("list", { name: "Kişiler" }).getByRole("listitem");
  await expect(people.nth(0)).toContainText("Kuyruğa alındı");
  await expect(people.nth(1)).toContainText("Açılamadı");
  await expect(people.nth(1)).toContainText("Sunucuda beklenmeyen bir hata oluştu.");
  await expect(people.nth(2)).toContainText("Kuyruğa alındı");
  await expect(people.nth(2).getByRole("link", { name: "Gönderimi gör" })).toHaveAttribute("href", /\/mail-tasks\/show\/b1c2d3e4-/);

  const sends = skymail.sendRequests();
  expect(sends.map((send) => [send.path, (send.body as { recipient_email: string }).recipient_email])).toEqual([
    ["/mail_tasks/single", "ayse@ornek.com"],
    ["/mail_tasks/single", "ali@ornek.com"],
    ["/mail_tasks/single", "zeynep@ornek.com"],
  ]);
  expect(sends[0].body).toEqual({
    template_id: id,
    recipient_email: "ayse@ornek.com",
    recipient_full_name: "Ayşe Yılmaz",
    body_variables: { EventName: "GECEKODU", DetailsUrl: "https://skyl.app/gecekodu" },
  });

  // Trying again sends only to the one who failed.
  await summary.getByRole("button", { name: "Açılamayanlara yeniden dene" }).click();
  await expect(summary).toContainText("3 kişinin hepsine gönderim açıldı.");
  expect(skymail.sendRequests().map((send) => (send.body as { recipient_email: string }).recipient_email)).toEqual([
    "ayse@ornek.com",
    "ali@ornek.com",
    "zeynep@ornek.com",
    "ali@ornek.com",
  ]);
});

test("a template archived since the page opened is refused, and said to be", async ({ page, skymail, signIn }) => {
  await signIn("sender");
  const { id } = reminder(skymail);
  const gecekodu = skymail.addList({ name: "GECEKODU katılımcıları", recipients: PARTICIPANTS });

  await page.goto(`/mail-tasks/create?mail_list_id=${gecekodu}`);
  // Without free.basic, the form starts on a Mail template.
  await page.getByRole("group", { name: "Mail template" }).getByRole("radio", { name: /Etkinlik hatırlatması/ }).check();
  await page.getByLabel("EventName").fill("GECEKODU");
  await page.getByRole("button", { name: "Gönder…" }).click();
  skymail.archiveTemplate(id);
  await page.getByRole("dialog", { name: "Gönderimi onayla" }).getByRole("button", { name: "Gönder", exact: true }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Gönderim açılamadı." })).toContainText(
    "Bu Mail template arşivlenmiş; arşivlenmiş bir template gönderilmez. Başka bir template seç ya da template'i geri getir.",
  );
  await expect(page).toHaveURL(`/mail-tasks/create?mail_list_id=${gecekodu}`);
});

test("who may send what: people only with mails:send, an explanation without a send role", async ({ page, skymail, signIn, context }) => {
  freeBasic(skymail);
  const gecekodu = skymail.addList({ name: "GECEKODU katılımcıları", recipients: PARTICIPANTS });

  await signIn("individual");
  await page.goto(`/mail-tasks/create?mail_list_id=${gecekodu}`);
  await expect(page.getByText("Bu bağlantı bir mail listesine gönderim için, ama bu hesap listeye gönderemez")).toBeVisible();
  await expect(page.getByText("Bir mail listesine göndermek skymail:mails:write rolü ister; bu hesapla tek tek kişilere gönderebilirsin.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mail listesi" })).toHaveCount(0);
  await expect(page.getByLabel("1. kişinin e-posta adresi")).toBeVisible();
  expect(skymail.requests.some((request) => request.path.startsWith("/mailing_lists"))).toBe(false);

  await context.clearCookies();
  await signIn("watcher");
  await page.goto("/mail-tasks/create");
  await expect(page.getByText("Bu hesapla gönderim yapılamaz")).toBeVisible();
  await expect(page.getByText("Mail göndermek için skymail:mails:send ya da skymail:mails:write rolü gerekiyor.")).toBeVisible();
  await expect(page.getByLabel("Konu")).toHaveCount(0);
  await page.goto("/mail-tasks");
  await expect(page.getByRole("heading", { name: "Gönderimler" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Yeni gönderim" })).toHaveCount(0);
});
