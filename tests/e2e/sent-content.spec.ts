/**
 * A send's content (Yusuf, 2026-10-12): each recipient's mail as it went out —
 * subject, HTML and plain text — opens from the send's page, except mail that
 * carries a code or a one-time link, which no one sees. The HTML is shown in a
 * sandboxed frame that reaches nothing on the network until the operator asks
 * for images: a tracking pixel must not count the operator as the recipient.
 * The mock API decides who sees what as skymail-backend does.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import type { MockSkymail } from "./fixtures/mock-api";
import { VIEWER } from "./fixtures/session";

const PIXEL_HOST = "iz.example.test";
const SOMEONE_ELSE = "0c9e4f6a-1b2d-4c3e-8f7a-9d0e1f2a3b4c";

function newsletter(skymail: MockSkymail) {
  return skymail.addTemplate({
    name: "Bülten",
    subject: "{{.Heading}}",
    mainMode: "html",
    html: "<p>…</p>",
    htmlContent: `<!DOCTYPE html><html><head><style>p{color:#222}</style></head><body><p>Merhaba {{.FullName}}, {{.Heading}}</p><img alt="logo" src="https://${PIXEL_HOST}/p.gif?to={{.Email}}"></body></html>`,
    plainText: "Merhaba {{.FullName}}, {{.Heading}}",
  });
}

/**
 * The page's requests to the pixel's host: those the frame's content policy
 * stopped in the browser (Chromium reports them failed with "csp") and those
 * that went out (a .test name never resolves, so none gets anywhere).
 */
function watchPixel(page: Page) {
  const seen = { blocked: 0, sent: 0 };
  const isPixel = (url: string) => new URL(url).hostname === PIXEL_HOST;
  page.context().on("requestfailed", (request) => {
    if (!isPixel(request.url())) return;
    if (request.failure()?.errorText === "csp") seen.blocked += 1;
    else seen.sent += 1;
  });
  page.context().on("requestfinished", (request) => {
    if (isPixel(request.url())) seen.sent += 1;
  });
  return seen;
}

test("the sender opens a recipient's mail as sent, with remote images held back until asked for", async ({ page, skymail, signIn }) => {
  await signIn("sender");
  const pixel = watchPixel(page);
  const { id: templateId } = newsletter(skymail);
  const listId = skymail.addList({ name: "WebLab", recipients: [{ full_name: "Ali Can", email: "ali@ornek.com" }, { full_name: "Ece Ak", email: "ece@ornek.com" }] });
  const sendId = skymail.addSend({ templateId, listId, variables: { Heading: "Ekim buluşması" }, sentBy: SOMEONE_ELSE });

  await page.goto(`/mail-tasks/show/${sendId}`);
  await expect(page.getByText(/Her alıcının postasını gönderildiği hâliyle açabilirsin\. İçerik .+ tarihine kadar saklanır\./)).toBeVisible();

  await page.getByRole("button", { name: "Ali Can: içeriği gör" }).click();
  const dialog = page.getByRole("dialog", { name: "Gönderilen posta · Ali Can" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Ekim buluşması", { exact: true })).toBeVisible();

  const frame = dialog.locator("iframe");
  await expect(frame).toHaveAttribute("sandbox", "");
  const srcdoc = await frame.getAttribute("srcdoc");
  expect(srcdoc).toMatch(/^<!DOCTYPE html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:;/);
  await expect(frame.contentFrame().getByText("Merhaba Ali Can, Ekim buluşması")).toBeVisible();
  await expect(dialog.getByText(/Resimler ve dış içerik engellendi/)).toBeVisible();
  // The frame tries the image and its policy stops it in the browser: nothing goes out.
  await expect.poll(() => pixel.blocked).toBeGreaterThan(0);
  expect(pixel.sent).toBe(0);

  await dialog.getByRole("button", { name: "Resimleri göster" }).click();
  await expect(frame).toHaveAttribute("srcdoc", /img-src data: https:/);
  await expect.poll(() => pixel.sent).toBeGreaterThan(0);
  await expect(dialog.getByRole("button", { name: "Resimleri gizle" })).toBeVisible();

  await dialog.getByRole("button", { name: "Düz metin" }).click();
  await expect(dialog.locator("pre")).toHaveText("Merhaba Ali Can, Ekim buluşması");
});

test("a mail with a code or a one-time link shows that it went, never what it said", async ({ page, skymail, signIn }) => {
  await signIn("admin");
  const { id: templateId } = skymail.addTemplate({
    name: "Keycloak · Parola Sıfırlama",
    key: "keycloak.reset-password",
    system: true,
    contentSensitive: true,
    subject: "SKY LAB parola sıfırlama isteği",
    mainMode: "html",
    htmlContent: "<p>{{.link}}</p>",
    plainText: "{{.link}}",
  });
  const sendId = skymail.addSend({ templateId, recipients: [{ full_name: "Ali Can", email: "ali@ornek.com" }], variables: { link: "https://sso.example.test/reset?key=secret" } });

  await page.goto(`/mail-tasks/show/${sendId}`);
  await expect(page.getByText(/Bu postanın içeriği gizli/)).toBeVisible();
  await expect(page.getByRole("button", { name: /içeriği gör/ })).toHaveCount(0);
  expect(await page.content()).not.toContain("reset?key=secret");
});

/** A welcome mail (single, shown) and a newsletter to a list, both sent by someone else, and an old newsletter of the viewer's the sweep emptied. */
function sends(skymail: MockSkymail) {
  const { id: welcomeId } = skymail.addTemplate({
    name: "Hoş Geldin",
    key: "core.welcome",
    system: true,
    contentSensitive: false,
    subject: "SKY LAB ekosistemine hoş geldin",
    mainMode: "html",
    htmlContent: "<p>Hoş geldin {{.FullName}}</p>",
    plainText: "Hoş geldin {{.FullName}}",
  });
  const welcome = skymail.addSend({ templateId: welcomeId, recipients: [{ full_name: "Ali Can", email: "ali@ornek.com" }], sentBy: SOMEONE_ELSE });
  const { id: newsletterId } = newsletter(skymail);
  const listId = skymail.addList({ name: "WebLab", recipients: [{ full_name: "Ece Ak", email: "ece@ornek.com" }] });
  const listSend = skymail.addSend({ templateId: newsletterId, listId, variables: { Heading: "Duyuru" }, sentBy: SOMEONE_ELSE });
  const old = skymail.addSend({ templateId: newsletterId, listId, variables: { Heading: "Eski" }, sentBy: VIEWER.sub, cleared: true });
  return { welcome, listSend, old };
}

test("someone who sends to lists cannot open another's single mail, and an emptied send says why", async ({ page, skymail, signIn }) => {
  await signIn("sender");
  const { welcome, old } = sends(skymail);
  await page.goto(`/mail-tasks/show/${welcome}`);
  await expect(page.getByText(/Bu gönderimin içeriğini göremezsin/)).toBeVisible();
  await expect(page.getByRole("button", { name: /içeriği gör/ })).toHaveCount(0);
  await page.goto(`/mail-tasks/show/${old}`);
  await expect(page.getByText(/İçerik saklama süresi dolduğu için silindi/)).toBeVisible();
  await expect(page.getByRole("button", { name: /içeriği gör/ })).toHaveCount(0);
});

test("someone who only reads sends cannot open a list send's content", async ({ page, skymail, signIn }) => {
  await signIn("watcher");
  const { listSend } = sends(skymail);
  await page.goto(`/mail-tasks/show/${listSend}`);
  await expect(page.getByText(/Bu gönderimin içeriğini göremezsin/)).toBeVisible();
  await expect(page.getByRole("button", { name: /içeriği gör/ })).toHaveCount(0);
});

test("the administrator opens a single mail whose template may be shown", async ({ page, skymail, signIn }) => {
  await signIn("admin");
  const { welcome } = sends(skymail);
  await page.goto(`/mail-tasks/show/${welcome}`);
  await page.getByRole("button", { name: "Ali Can: içeriği gör" }).click();
  const dialog = page.getByRole("dialog", { name: "Gönderilen posta · Ali Can" });
  await expect(dialog.getByText("SKY LAB ekosistemine hoş geldin", { exact: true })).toBeVisible();
  await expect(dialog.locator("iframe").contentFrame().getByText("Hoş geldin Ali Can")).toBeVisible();
});

test("a mail that starts with a byte-order mark is held back all the same", async ({ page, skymail, signIn }) => {
  await signIn("sender");
  const pixel = watchPixel(page);
  const { id: templateId } = skymail.addTemplate({
    name: "Bülten",
    subject: "Duyuru",
    mainMode: "html",
    htmlContent: `\uFEFF<!DOCTYPE html><html><body><p>Merhaba {{.FullName}}</p><img alt="logo" src="https://${PIXEL_HOST}/bom.gif"></body></html>`,
    plainText: "Merhaba {{.FullName}}",
  });
  const listId = skymail.addList({ name: "WebLab", recipients: [{ full_name: "Ali Can", email: "ali@ornek.com" }] });
  const sendId = skymail.addSend({ templateId, listId, sentBy: SOMEONE_ELSE });

  await page.goto(`/mail-tasks/show/${sendId}`);
  await page.getByRole("button", { name: "Ali Can: içeriği gör" }).click();
  const frame = page.getByRole("dialog", { name: "Gönderilen posta · Ali Can" }).locator("iframe");
  await expect(frame).toHaveAttribute("srcdoc", /^<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:;[^"]*"><meta name="referrer" content="no-referrer">\uFEFF<!DOCTYPE html>/);
  await expect(frame.contentFrame().getByText("Merhaba Ali Can")).toBeVisible();
  await expect.poll(() => pixel.blocked).toBeGreaterThan(0);
  expect(pixel.sent).toBe(0);
});

test("the template editor's switch shows or hides a template's content, after asking; a credential template's stays off", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const { id: welcomeId } = skymail.addTemplate({
    name: "Hoş Geldin",
    key: "core.welcome",
    system: true,
    contentSensitive: null,
    subject: "Hoş geldin",
    mainMode: "html",
    html: "<p>Hoş geldin {{.FullName}}</p>",
    htmlContent: "<p>Hoş geldin {{.FullName}}</p>",
    plainText: "Hoş geldin {{.FullName}}",
  });
  const toggles = () => skymail.requests.filter((request) => request.method === "PUT" && request.path === `/templates/${welcomeId}/content-sensitive`);

  await page.goto(`/templates/edit/${welcomeId}`);
  const panel = page.getByRole("region", { name: "Gönderilen içerik" });
  const toggle = panel.getByRole("switch", { name: /İçerik panelde görünsün/ });
  await expect(panel).toContainText("Ayarlanmadı");
  await expect(toggle).not.toBeChecked();

  // Asked first; cancelling writes nothing.
  await toggle.click();
  const ask = page.getByRole("dialog", { name: "İçerik panelde görünsün mü?" });
  await expect(ask).toContainText("kod ya da tek kullanımlık bağlantı varsa açma");
  await ask.getByRole("button", { name: "İptal" }).click();
  await expect(toggle).not.toBeChecked();
  expect(toggles()).toHaveLength(0);

  await toggle.click();
  await page.getByRole("dialog", { name: "İçerik panelde görünsün mü?" }).getByRole("button", { name: "Göster" }).click();
  await expect(toggle).toBeChecked();
  expect(toggles().map((request) => request.body)).toEqual([{ content_sensitive: false }]);

  await toggle.click();
  const hide = page.getByRole("dialog", { name: "İçerik gizlensin mi?" });
  await expect(hide).toContainText("kalıcı olarak silinir");
  await hide.getByRole("button", { name: "Gizle" }).click();
  await expect(toggle).not.toBeChecked();
  expect(toggles().map((request) => request.body)).toEqual([{ content_sensitive: false }, { content_sensitive: true }]);

  const { id: resetId } = skymail.addTemplate({
    name: "Keycloak · Parola Sıfırlama",
    key: "keycloak.reset-password",
    system: true,
    contentSensitive: true,
    subject: "SKY LAB parola sıfırlama isteği",
    mainMode: "html",
    html: "<p>{{.link}}</p>",
    htmlContent: "<p>{{.link}}</p>",
    plainText: "{{.link}}",
  });
  await page.goto(`/templates/edit/${resetId}`);
  const locked = page.getByRole("region", { name: "Gönderilen içerik" });
  await expect(locked).toContainText("her zaman gizli kalır");
  await expect(locked.getByRole("switch", { name: /İçerik panelde görünsün/ })).toBeDisabled();
});
