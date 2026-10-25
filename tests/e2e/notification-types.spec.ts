/**
 * The template list shows a template's Notification type beside it
 * (iletişim-servisi 10, dilim 2; skymail-backend docs/notifications.md):
 * required or its category, and the default channels.
 */
import { expect, test } from "./fixtures";

test("a template that is a Notification type says so in the list", async ({ page, skymail, signIn }) => {
  await signIn("reader");
  skymail.addTemplate({
    name: "Etkinlik · Bilet Oluşturuldu",
    subject: "{{.EventName}} biletin hazır",
    key: "event.ticket-created",
    mainMode: "html",
    html: "<p>Biletin hazır</p>",
    htmlContent: "<p>Biletin hazır</p>",
    plainText: "Biletin hazır",
  });
  skymail.addTemplate({
    name: "Serbest Gönderim",
    subject: "{{.Subject}}",
    key: "free.basic",
    mainMode: "html",
    html: "<p>x</p>",
    htmlContent: "<p>x</p>",
    plainText: "x",
  });
  skymail.notificationTypes = [{
    key: "event.ticket-created",
    category: null,
    required: true,
    default_channels: ["email", "inbox"],
    lane: "system",
    archived_at: null,
    inbox: { title: "{{.EventName}} biletin hazır", summary: "", link: "/events/{{.EventId}}" },
  }];

  await page.goto("/templates");
  const ticket = page.getByRole("row").filter({ hasText: "Etkinlik · Bilet Oluşturuldu" });
  await expect(ticket).toContainText("Bildirim türü: Zorunlu · E-posta, Uygulama içi kutu");
  await expect(page.getByRole("row").filter({ hasText: "Serbest Gönderim" })).not.toContainText("Bildirim türü");
});
