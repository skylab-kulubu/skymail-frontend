/**
 * Mail onayı (ticket 20): a member who sends nothing submits a send from the
 * send form; an approver approves it as it is, edits it and sends or returns
 * the edit, or rejects it with a reason; the submitter accepts or declines a
 * returned edit and resubmits a rejected request. An expired request is
 * final, and a template published again since a request is explained rather
 * than refused without a word. The API is the mock's (ticket 19's rules).
 */
import type { Page } from "@playwright/test";
import { expect, preview, test } from "./fixtures";
import { OTHER_OPERATOR, type MockSkymail } from "./fixtures/mock-api";
import { APPROVER, MEMBER, VIEWER } from "./fixtures/session";

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
      "<p>Merhaba {{.FullName}}, bu e-postayı SKY LAB üyesi olduğun için alıyorsun.</p></body></html>",
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
    operatorRequired: ["EventName"],
  });
}

const PARTICIPANTS = [
  { full_name: "Ali Can", email: "ali@ornek.com" },
  { full_name: "Zeynep Kaya", email: "zeynep@ornek.com" },
  { full_name: "Mert Demir", email: "mert@ornek.com" },
];

const SUBMITTED = {
  Subject: "GECEKODU başvuruları açıldı",
  Heading: "",
  BodyHtml: "<p>Başvurular <strong>5 Nisan</strong>&#39;a kadar açık.</p>",
  CtaUrl: "",
  CtaLabel: "",
};

const body = (page: Page) => page.getByRole("textbox", { name: "Gövde" });
const dialog = (page: Page, name: string) => page.getByRole("dialog", { name });
const decision = (page: Page) => page.getByRole("region", { name: "Karar" });
const notice = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });
const menu = (page: Page) => page.getByRole("navigation", { name: "Ana navigasyon" });
const listRadio = (page: Page, name: string) =>
  page.getByRole("group", { name: "Mail listesi" }).getByRole("radio", { name: new RegExp(name) });

/** A request by the member, for free.basic to a list of three. */
function submitted(skymail: MockSkymail, overrides: Partial<Parameters<MockSkymail["addApproval"]>[0]> = {}) {
  const free = freeBasic(skymail);
  const listId = skymail.addList({ name: "GECEKODU katılımcıları", recipients: PARTICIPANTS });
  const id = skymail.addApproval({ templateId: free.id, listId, variables: SUBMITTED, submitter: MEMBER, ...overrides });
  return { id, free, listId };
}

test("a member who sends nothing submits from the send form, held to the Required variables, and lands on the request", async ({ page, skymail, signIn }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn("member");
  const free = freeBasic(skymail);
  reminder(skymail);
  const gecekodu = skymail.addList({ name: "GECEKODU katılımcıları", recipients: PARTICIPANTS });

  await page.goto(`/mail-tasks/create?mail_list_id=${gecekodu}`);
  await expect(listRadio(page, "GECEKODU katılımcıları")).toBeChecked();
  await expect(page.getByText("Bu hesap bir mail listesine doğrudan gönderemez (skymail:mails:write rolü gerekiyor)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Gönder…", exact: true })).toHaveCount(0);

  // A Required variable left empty keeps it from going for approval, as it would a send.
  await page.getByRole("button", { name: "Mail template" }).click();
  await page.getByRole("group", { name: "Mail template" }).getByRole("radio", { name: /Etkinlik hatırlatması/ }).check();
  await page.getByRole("button", { name: "Onaya sun…" }).click();
  await expect(page.getByText("EventName boş bırakılamaz: bir Required variable.")).toBeVisible();
  await expect(page.getByText("Gönderim henüz onaya sunulamaz: işaretli yerleri düzelt.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Serbest duyuru" }).click();
  await page.getByLabel("Konu").fill("GECEKODU başvuruları açıldı");
  await body(page).click();
  await page.keyboard.type("Başvurular açıldı.");
  await page.getByRole("button", { name: "Onaya sun…" }).click();
  const confirm = dialog(page, "Onaya sun");
  await expect(confirm).toContainText("Serbest duyuru “GECEKODU başvuruları açıldı”");
  await expect(confirm).toContainText("“GECEKODU katılımcıları” listesi (3 alıcı)");
  await expect(confirm).toContainText("7 gün içinde karar verilmezse süresi dolar ve gönderilmez.");
  await confirm.getByRole("button", { name: "Onaya sun", exact: true }).click();

  await expect(page).toHaveURL(/\/mail-approvals\/show\/5d1e7c2a-/);
  await expect(notice(page, "Onaya sunuldu")).toHaveText(
    "Onaya sunuldu: Serbest duyuru “GECEKODU başvuruları açıldı”, “GECEKODU katılımcıları” listesine. Bir onaycı onaylayınca gönderilir.",
  );
  await expect(decision(page)).toContainText("Onaycıların kararı bekleniyor");
  await expect(decision(page).getByRole("button")).toHaveCount(0);
  await expect(page.getByText("Onay bekliyor", { exact: true })).toBeVisible();
  await expect(preview(page, "İsteğin önizlemesi").locator(".t-body")).toHaveText("Başvurular açıldı.");
  await expect(preview(page, "İsteğin önizlemesi")).toContainText(`Merhaba ${MEMBER.name}`);

  expect(skymail.approvalRequests().map((request) => [request.path, request.body])).toEqual([
    [
      "/mail_approvals",
      {
        template_id: free.id,
        mail_list_id: gecekodu,
        body_variables: { Subject: "GECEKODU başvuruları açıldı", Heading: "", BodyHtml: "<p>Başvurular açıldı.</p>", CtaUrl: "", CtaLabel: "" },
      },
    ],
  ]);
  expect(skymail.sendRequests()).toEqual([]);

  // Their own requests, in the menu.
  await menu(page).getByRole("link", { name: "Mail onayları" }).click();
  await expect(page.getByRole("heading", { name: "Mail onayları" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hepsi" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Serbest Gönderim" }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("a sender who may send can still choose to submit for approval, one person at a time", async ({ page, skymail, signIn }) => {
  await signIn("individual");
  const { id } = reminder(skymail);

  await page.goto("/mail-tasks/create");
  await expect(page.getByRole("button", { name: "Gönder…", exact: true })).toBeVisible();
  await page.getByRole("group", { name: "Mail template" }).getByRole("radio", { name: /Etkinlik hatırlatması/ }).check();
  await page.getByLabel("EventName").fill("GECEKODU");
  await page.getByLabel("1. kişinin adı soyadı").fill("Ali Can");
  await page.getByLabel("1. kişinin e-posta adresi").fill("ali@ornek.com");
  await page.getByRole("button", { name: "Kişi ekle" }).click();
  await page.getByLabel("2. kişinin e-posta adresi").fill("zeynep@ornek.com");

  await page.getByRole("button", { name: "Onaya sun…" }).click();
  await expect(page.getByText("Onaya tek bir kişi ya da bir mail listesi sunulur: 2 kişiye göndermek için bir liste seç ya da her kişiyi ayrı sun.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "2. kişiyi çıkar" }).click();
  await page.getByRole("button", { name: "Onaya sun…" }).click();
  const confirm = dialog(page, "Onaya sun");
  await expect(confirm).toContainText("Ali Can <ali@ornek.com>");
  await confirm.getByRole("button", { name: "Onaya sun", exact: true }).click();
  await expect(page).toHaveURL(/\/mail-approvals\/show\//);
  expect(skymail.approvalRequests()[0].body).toEqual({
    template_id: id,
    recipient_email: "ali@ornek.com",
    recipient_full_name: "Ali Can",
    body_variables: { EventName: "GECEKODU", DetailsUrl: "" },
  });
  expect(skymail.sendRequests()).toEqual([]);
});

test("an approver finds a pending request in the menu and the list, and approves it as it is", async ({ page, skymail, signIn }) => {
  await signIn("approver");
  const { id } = submitted(skymail);

  await page.goto("/");
  await menu(page).getByRole("link", { name: "Mail onayları (1 bekleyen)" }).click();
  await expect(page.getByRole("button", { name: "Bekleyen" })).toHaveAttribute("aria-pressed", "true");
  const row = page.getByRole("row").filter({ hasText: "Serbest Gönderim" });
  await expect(row).toContainText(MEMBER.name);
  await expect(row).toContainText("GECEKODU katılımcıları");
  await expect(row).toContainText("6 gün kaldı");
  await expect(row).toContainText("Onay bekliyor");
  await row.getByRole("link", { name: "Serbest Gönderim" }).click();

  await expect(page).toHaveURL(`/mail-approvals/show/${id}`);
  await expect(decision(page)).toContainText("Bu istek onayını bekliyor");
  await expect(preview(page, "İsteğin önizlemesi").locator(".t-body")).toHaveText("Başvurular 5 Nisan'a kadar açık.");
  await expect(page.getByText("Listedeki her alıcı kendi adıyla alır")).toBeVisible();

  await decision(page).getByRole("button", { name: "Onayla ve gönder…" }).click();
  const confirm = dialog(page, "Onayla ve gönder");
  await expect(confirm).toContainText("“GECEKODU katılımcıları” listesi (3 alıcı)");
  await confirm.getByRole("button", { name: "Onayla ve gönder" }).click();

  await expect(notice(page, "Onaylandı")).toHaveText("Onaylandı: gönderim kuyruğa alındı.");
  await expect(decision(page)).toContainText("Onaylandı ve gönderildi");
  await expect(decision(page).getByRole("link", { name: "Gönderimi gör" })).toHaveAttribute("href", /\/mail-tasks\/show\/b1c2d3e4-/);
  await expect(page.getByRole("list").filter({ hasText: "onayladı; gönderildi" })).toContainText("Zeynep Arslan onayladı; gönderildi");
  await expect(menu(page).getByRole("link", { name: "Mail onayları", exact: true })).toBeVisible();

  const request = skymail.approvalRequests().at(-1)!;
  expect([request.path, request.body]).toEqual([`/mail_approvals/${id}/approve`, null]);
  expect(skymail.approval(id).body_variables).toEqual(SUBMITTED);
  expect(skymail.approval(id).task_id).toMatch(/^b1c2d3e4-/);
});

test("an approver edits a request and returns it; the submitter sees the edit beside their own and accepts it", async ({ page, skymail, signIn, context }) => {
  await signIn("approver");
  const { id } = submitted(skymail);

  await page.goto(`/mail-approvals/show/${id}`);
  await decision(page).getByRole("button", { name: "Düzenle" }).click();
  await expect(page.getByLabel("Konu")).toHaveValue("GECEKODU başvuruları açıldı");
  await expect(body(page)).toContainText("Başvurular 5 Nisan'a kadar açık.");

  // Nothing changed: there is nothing to return.
  await decision(page).getByRole("button", { name: "Sunana geri gönder…" }).click();
  await expect(page.getByText("Henüz bir değişkeni değiştirmedin")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByLabel("Konu").fill("GECEKODU 2026 başvuruları açıldı");
  await decision(page).getByRole("button", { name: "Sunana geri gönder…" }).click();
  const confirm = dialog(page, "Sunana geri gönder");
  const changed = confirm.getByRole("row").filter({ hasText: "Konu" });
  await expect(changed).toContainText("GECEKODU başvuruları açıldı");
  await expect(changed).toContainText("GECEKODU 2026 başvuruları açıldı");
  await expect(confirm.getByRole("region", { name: "Sunulan" })).toContainText("GECEKODU başvuruları açıldı");
  await expect(confirm.getByRole("region", { name: "Düzenlenmiş" })).toContainText("GECEKODU 2026 başvuruları açıldı");
  await expect(preview(page, "Düzenlenmiş").locator(".t-body")).toHaveText("Başvurular 5 Nisan'a kadar açık.");
  await confirm.getByLabel("Sunana not (isteğe bağlı)").fill("Yılı ekledim.");
  await confirm.getByRole("button", { name: "Sunana geri gönder" }).click();

  await expect(notice(page, "Düzenleme sunana geri gönderildi")).toBeVisible();
  await expect(decision(page)).toContainText("Sunanın kararı bekleniyor");
  const returned = skymail.approvalRequests().at(-1)!;
  expect([returned.path, returned.body]).toEqual([
    `/mail_approvals/${id}/return`,
    { body_variables: { ...SUBMITTED, Subject: "GECEKODU 2026 başvuruları açıldı" }, note: "Yılı ekledim." },
  ]);

  await context.clearCookies();
  await signIn("member");
  await page.goto("/mail-approvals");
  await page.getByRole("button", { name: "Geri dönen" }).click();
  await page.getByRole("row").filter({ hasText: "Sunana döndü" }).getByRole("link", { name: "Serbest Gönderim" }).click();

  await expect(decision(page)).toContainText("Onaycı isteğini düzenleyip sana geri gönderdi");
  await expect(decision(page)).toContainText("Onaycının notu: “Yılı ekledim.”");
  const theirs = decision(page).getByRole("row").filter({ hasText: "Konu" });
  await expect(theirs).toContainText("GECEKODU başvuruları açıldı");
  await expect(theirs).toContainText("GECEKODU 2026 başvuruları açıldı");
  await expect(decision(page).getByRole("region", { name: "Senin sunduğun" })).toContainText("GECEKODU başvuruları açıldı");
  await expect(decision(page).getByRole("region", { name: "Onaycının düzenlemesi" })).toContainText("GECEKODU 2026 başvuruları açıldı");

  await decision(page).getByRole("button", { name: "Kabul et ve gönder…" }).click();
  await dialog(page, "Kabul et ve gönder").getByRole("button", { name: "Kabul et ve gönder" }).click();
  await expect(notice(page, "Düzenlemeyi kabul ettin")).toHaveText("Düzenlemeyi kabul ettin: gönderim kuyruğa alındı.");
  await expect(decision(page)).toContainText("Onaylandı ve gönderildi");
  // The member reads no sends: there is no link to one.
  await expect(decision(page).getByRole("link", { name: "Gönderimi gör" })).toHaveCount(0);
  const history = page.getByRole("list").filter({ hasText: "değişkenleri düzenledi" });
  await expect(history).toContainText("Konu: “GECEKODU başvuruları açıldı” → “GECEKODU 2026 başvuruları açıldı”");
  await expect(history).toContainText(`${MEMBER.name} düzenlemeyi kabul etti; gönderildi`);
  expect(skymail.approvalRequests().at(-1)!.path).toBe(`/mail_approvals/${id}/accept`);
  expect(skymail.approval(id).state).toBe("approved");
});

test("a rejection takes a reason, which the submitter reads before editing and resubmitting", async ({ page, skymail, signIn, context }) => {
  await signIn("approver");
  const { id, free, listId } = submitted(skymail);

  await page.goto(`/mail-approvals/show/${id}`);
  await decision(page).getByRole("button", { name: "Reddet…" }).click();
  const reject = dialog(page, "Reddet");
  await reject.getByRole("button", { name: "Reddet" }).click();
  await expect(reject.getByText("Gerekçe yaz: sunan neden reddedildiğini görecek.")).toBeVisible();
  expect(skymail.approvalRequests()).toEqual([]);
  await reject.getByLabel("Ret gerekçesi").fill("Tarih yanlış: son gün 7 Nisan.");
  await reject.getByRole("button", { name: "Reddet" }).click();
  await expect(notice(page, "Reddedildi")).toBeVisible();
  await expect(decision(page)).toContainText("Zeynep Arslan: “Tarih yanlış: son gün 7 Nisan.”");
  expect(skymail.approvalRequests().at(-1)!.body).toEqual({ reason: "Tarih yanlış: son gün 7 Nisan." });

  await context.clearCookies();
  await signIn("member");
  await page.goto("/mail-approvals?state=rejected");
  await expect(page.getByRole("row").filter({ hasText: "Reddedildi" })).toContainText("“Tarih yanlış: son gün 7 Nisan.”");
  await page.goto(`/mail-approvals/show/${id}`);
  await expect(decision(page)).toContainText("İsteğin reddedildi");
  await decision(page).getByRole("button", { name: "Düzenleyip yeniden sun" }).click();

  await expect(page).toHaveURL(`/mail-approvals/edit/${id}`);
  await expect(page.getByRole("heading", { name: "İsteği yeniden sun" })).toBeVisible();
  await expect(page.getByText("Gerekçe: Tarih yanlış: son gün 7 Nisan.")).toBeVisible();
  await expect(listRadio(page, "GECEKODU katılımcıları")).toBeChecked();
  await expect(page.getByLabel("Konu")).toHaveValue("GECEKODU başvuruları açıldı");
  await expect(body(page)).toContainText("Başvurular 5 Nisan'a kadar açık.");
  await body(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Başvurular 7 Nisan'a kadar açık.");
  await page.getByRole("button", { name: "Yeniden onaya sun…" }).click();
  await dialog(page, "Yeniden onaya sun").getByRole("button", { name: "Yeniden onaya sun" }).click();

  await expect(page).toHaveURL(`/mail-approvals/show/${id}`);
  await expect(notice(page, "Yeniden onaya sunuldu")).toContainText("7 günlük süre yeniden başladı.");
  await expect(page.getByText("Onay bekliyor", { exact: true })).toBeVisible();
  await expect(page.getByRole("list").filter({ hasText: "yeniden onaya sundu" })).toContainText("Gövde: “Başvurular 5 Nisan'a kadar açık.” → “Başvurular 7 Nisan'a kadar açık.”");
  const resubmit = skymail.approvalRequests().at(-1)!;
  expect([resubmit.path, resubmit.body]).toEqual([
    `/mail_approvals/${id}/resubmit`,
    { template_id: free.id, mail_list_id: listId, body_variables: { ...SUBMITTED, BodyHtml: "<p>Başvurular 7 Nisan&#39;a kadar açık.</p>" } },
  ]);
});

test("an expired request offers no action, and its submitter starts a new one from it", async ({ page, skymail, signIn, context }) => {
  await signIn("approver");
  const { id, free, listId } = submitted(skymail, { submittedAgo: 8 * 24 * 3600_000, deadlineIn: -24 * 3600_000 });

  await page.goto("/mail-approvals");
  await expect(page.getByText("Onay bekleyen bir gönderim yok.").filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "Süresi dolan" }).click();
  await expect(page).toHaveURL("/mail-approvals?state=expired");
  await page.getByRole("row").filter({ hasText: "Süresi doldu" }).getByRole("link", { name: "Serbest Gönderim" }).click();

  await expect(decision(page)).toContainText("7 gün içinde karar verilmediği için bu istek gönderilmedi ve artık gönderilmez.");
  await expect(decision(page).getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Onayla|Düzenle|Reddet/ })).toHaveCount(0);

  await context.clearCookies();
  await signIn("member");
  await page.goto(`/mail-approvals/show/${id}`);
  await expect(decision(page).getByRole("button")).toHaveCount(1);
  await decision(page).getByRole("button", { name: "Bu istekten yeni gönderim başlat" }).click();
  await expect(page).toHaveURL(`/mail-tasks/create?from_approval=${id}`);
  await expect(page.getByText("“Serbest Gönderim” isteğinin değerleriyle dolduruldu")).toBeVisible();
  await expect(page.getByLabel("Konu")).toHaveValue("GECEKODU başvuruları açıldı");
  await page.getByRole("button", { name: "Onaya sun…" }).click();
  await dialog(page, "Onaya sun").getByRole("button", { name: "Onaya sun", exact: true }).click();
  await expect(page).toHaveURL(/\/mail-approvals\/show\//);
  expect(page.url()).not.toContain(id);
  const request = skymail.approvalRequests().at(-1)!;
  expect([request.path, request.body]).toEqual(["/mail_approvals", { template_id: free.id, mail_list_id: listId, body_variables: SUBMITTED }]);
});

test("a template published again since the request is explained, and only rejecting is offered", async ({ page, skymail, signIn }) => {
  await signIn("approver");
  const { id, free } = submitted(skymail);

  await page.goto(`/mail-approvals/show/${id}`);
  await expect(decision(page).getByRole("button", { name: "Onayla ve gönder…" })).toBeVisible();
  // Published behind the page's back: the approval is refused and said why.
  skymail.publishAs(free.id, OTHER_OPERATOR, { subject: "{{.Subject}} (yeni)" });
  await decision(page).getByRole("button", { name: "Onayla ve gönder…" }).click();
  await dialog(page, "Onayla ve gönder").getByRole("button", { name: "Onayla ve gönder" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "yeni bir sürümü" })).toHaveText(
    "Bu istek sunulduktan sonra Mail template'in yeni bir sürümü yayımlandı; onaylanırsa sunulan mail gitmez. İsteği gerekçesiyle reddet; sunan yeni sürümle yeniden sunabilir.",
  );
  await expect(decision(page)).toContainText("Bu istek sunulduktan sonra “Serbest Gönderim” template'inin yeni bir sürümü yayımlandı.");
  await expect(decision(page).getByRole("button", { name: "Onayla ve gönder…" })).toHaveCount(0);
  await expect(decision(page).getByRole("button", { name: "Düzenle" })).toHaveCount(0);
  await expect(decision(page).getByRole("button", { name: "Reddet…" })).toBeVisible();
  await expect(page.getByText("Sunulduktan sonra yeni sürümü yayımlandı")).toBeVisible();
  expect(skymail.approval(id).state).toBe("pending");
});

test("an approval refused because someone else is acting on the request says so and reads it again, the edit kept", async ({ page, skymail, signIn }) => {
  await signIn("approver");
  const { id } = submitted(skymail);
  skymail.refuseApproval("approve", { status: 409, body: { code: "mail_approval.busy", message: "busy" } });

  await page.goto(`/mail-approvals/show/${id}`);
  await decision(page).getByRole("button", { name: "Düzenle" }).click();
  await page.getByLabel("Konu").fill("GECEKODU 2026 başvuruları açıldı");
  await decision(page).getByRole("button", { name: "Düzenlemeyle gönder…" }).click();
  await dialog(page, "Düzenlemeyle gönder").getByRole("button", { name: "Düzenlemeyle gönder" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "başka biri" })).toHaveText(
    "Şu anda başka biri bu istek üzerinde işlem yapıyor. İstek yeniden yüklendi; son hâline bakıp tekrar dene.",
  );
  const reads = skymail.requests.filter((request) => request.method === "GET" && request.path === `/mail_approvals/${id}`);
  expect(reads.length).toBeGreaterThan(1);
  await expect(page.getByLabel("Konu")).toHaveValue("GECEKODU 2026 başvuruları açıldı");

  await decision(page).getByRole("button", { name: "Düzenlemeyle gönder…" }).click();
  await dialog(page, "Düzenlemeyle gönder").getByRole("button", { name: "Düzenlemeyle gönder" }).click();
  await expect(notice(page, "Düzenlemeyle onaylandı")).toBeVisible();
  const approved = skymail.approvalRequests().at(-1)!;
  expect(approved.body).toEqual({ body_variables: { ...SUBMITTED, Subject: "GECEKODU 2026 başvuruları açıldı" } });
  await expect(page.getByRole("list").filter({ hasText: "değişkenleri düzenledi" })).toContainText(
    "Zeynep Arslan değişkenleri düzenledi",
  );
});

test("the submitter declines a returned edit, sees the decision, and resubmits from their own values", async ({ page, skymail, signIn }) => {
  await signIn("member");
  const edit = "GECEKODU 2026: başvurular açık";
  const { id, free, listId } = submitted(skymail, {
    state: "returned",
    variables: { ...SUBMITTED, Subject: edit },
    deadlineIn: 6 * 24 * 3600_000,
    decided: [
      { kind: "edited", actor: APPROVER, changes: [{ field: "variable", name: "Subject", before: SUBMITTED.Subject, after: edit }] },
      { kind: "returned", actor: APPROVER, note: "Konuyu kısalttım." },
    ],
  });

  await page.goto(`/mail-approvals/show/${id}`);
  await decision(page).getByRole("button", { name: "Kabul etme…" }).click();
  const decline = dialog(page, "Düzenlemeyi kabul etme");
  await decline.getByLabel("Neden (isteğe bağlı)").fill("Konu böyle kalsın.");
  await decline.getByRole("button", { name: "Düzenlemeyi kabul etme" }).click();

  await expect(notice(page, "Düzenlemeyi kabul etmedin")).toHaveText(
    "Düzenlemeyi kabul etmedin: isteği kendi değerlerinle düzenleyip yeniden sunabilirsin.",
  );
  await expect(decision(page)).toContainText("Onaycının düzenlemesini kabul etmedin");
  await expect(page.getByText("Düzenleme kabul edilmedi", { exact: true })).toBeVisible();
  const history = page.getByRole("list").filter({ hasText: "düzenlemeyi kabul etmedi" });
  await expect(history).toContainText(`${MEMBER.name} düzenlemeyi kabul etmedi`);
  await expect(history).toContainText("Not: “Konu böyle kalsın.”");
  const declined = skymail.approvalRequests().at(-1)!;
  expect([declined.path, declined.body]).toEqual([`/mail_approvals/${id}/decline`, { note: "Konu böyle kalsın." }]);
  expect(skymail.sendRequests()).toEqual([]);

  await page.goto("/mail-approvals");
  await page.getByRole("button", { name: "Kabul edilmedi" }).click();
  await expect(page).toHaveURL("/mail-approvals?state=declined");
  await expect(page.getByRole("row").filter({ hasText: "Düzenleme kabul edilmedi" })).toHaveCount(1);

  // The form starts from what the submitter sent, not the edit they refused.
  await page.goto(`/mail-approvals/show/${id}`);
  await decision(page).getByRole("button", { name: "Düzenleyip yeniden sun" }).click();
  await expect(page.getByText("Onaycının düzenlemesini kabul etmedin (“Konu böyle kalsın.”)")).toBeVisible();
  await expect(page.getByLabel("Konu")).toHaveValue(SUBMITTED.Subject);
  await page.getByRole("button", { name: "Yeniden onaya sun…" }).click();
  await dialog(page, "Yeniden onaya sun").getByRole("button", { name: "Yeniden onaya sun" }).click();
  await expect(page).toHaveURL(`/mail-approvals/show/${id}`);
  const resubmit = skymail.approvalRequests().at(-1)!;
  expect([resubmit.path, resubmit.body]).toEqual([
    `/mail_approvals/${id}/resubmit`,
    { template_id: free.id, mail_list_id: listId, body_variables: SUBMITTED },
  ]);
});

test("an approver narrows the list to the requests they submitted", async ({ page, skymail, signIn }) => {
  await signIn("approver");
  const { free, listId } = submitted(skymail);
  skymail.addApproval({ templateId: free.id, listId, variables: { ...SUBMITTED, Subject: "Kendi duyurum" }, submitter: APPROVER, submittedAgo: 3600_000 });

  await page.goto("/mail-approvals");
  await expect(page.getByText("2 istek")).toBeVisible();
  await page.getByRole("button", { name: "Benim sunduklarım" }).click();
  await expect(page).toHaveURL("/mail-approvals?mine=true");
  await expect(page.getByText("1 istek")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: APPROVER.name })).toHaveCount(1);
  // The mock lists an approver's own only when asked with mine=true, as the API does.
  await expect(page.getByRole("row").filter({ hasText: MEMBER.name })).toHaveCount(0);
});

test("someone without an approver's role sees only their own requests", async ({ page, skymail, signIn }) => {
  await signIn("member");
  const free = freeBasic(skymail);
  const listId = skymail.addList({ name: "GECEKODU katılımcıları", recipients: PARTICIPANTS });
  skymail.addApproval({ templateId: free.id, listId, variables: SUBMITTED, submitter: MEMBER });
  const theirs = skymail.addApproval({ templateId: free.id, listId, variables: { ...SUBMITTED, Subject: "Başkasının" }, submitter: VIEWER });

  await page.goto("/mail-approvals");
  await expect(page.getByText("1 istek")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: VIEWER.name })).toHaveCount(0);
  expect(skymail.requests.find((request) => request.method === "GET" && request.path === "/mail_approvals")).toBeTruthy();

  await page.goto(`/mail-approvals/show/${theirs}`);
  await expect(page.getByText("İstek bulunamadı")).toBeVisible();
});
