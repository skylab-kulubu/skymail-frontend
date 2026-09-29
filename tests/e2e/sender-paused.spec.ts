/**
 * A paused sender (skymail-backend ticket 28): while SkyMail runs with
 * MAIL_SENDER=paused, as during a restore from backup, the summary answers
 * `sender_paused: true` and nothing queued goes out. The home screen and the
 * send list say so above everything else, with nothing to close it; once the
 * sender runs again, the notice is gone. The mock API's summary says what
 * `pauseSender` set.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const NOTICE = "Gönderim duraklatıldı: yeni gönderimler kuyruğa alınıyor ama hiçbiri gönderilmiyor (geri yükleme sürüyor).";

const notice = (page: Page) => page.getByRole("status").filter({ hasText: NOTICE });
const isSummary = (url: string | URL) => new URL(url).pathname.endsWith("/mail_tasks/summary");
const summaryAnswered = (page: Page) => page.waitForResponse((response) => isSummary(response.url()));
/** The send list has loaded: it counts its sends. */
const sendCount = (page: Page) => page.getByText("0 gönderim", { exact: true });

test("the home screen and the send list say the sender is paused, until it runs again", async ({ page, skymail, signIn }) => {
  await signIn("watcher");
  skymail.pauseSender();

  await page.goto("/");
  await expect(notice(page)).toBeVisible();
  await expect(notice(page).getByRole("button")).toHaveCount(0);
  // The rest of the home screen is all still there under it.
  await expect(page.getByRole("region", { name: "Sayılar" })).toContainText("Bekleyen mail");
  await expect(page.getByText("Henüz gönderim yok.")).toBeVisible();

  const asked = page.waitForRequest((request) => isSummary(request.url()));
  await page.getByRole("link", { name: "Tümünü gör" }).click();
  await expect(page).toHaveURL("/mail-tasks");
  // The send list shows no summary: it asks for the smallest one there is.
  expect(new URL((await asked).url()).search).toBe("?days=1&recent=1");
  await expect(notice(page)).toBeVisible();
  await expect(notice(page).getByRole("button")).toHaveCount(0);
  await expect(sendCount(page)).toBeVisible();

  skymail.pauseSender(false);
  let answered = summaryAnswered(page);
  await page.reload();
  await answered;
  await expect(sendCount(page)).toBeVisible();
  await expect(page.getByText(NOTICE)).toHaveCount(0);

  answered = summaryAnswered(page);
  await page.goto("/");
  await answered;
  await expect(page.getByRole("region", { name: "Sayılar" })).toContainText("Bekleyen mail");
  await expect(page.getByText(NOTICE)).toHaveCount(0);
});

test("a summary that does not come leaves the send list without the notice, and the list still loads", async ({ page, skymail, signIn }) => {
  await signIn("watcher");
  skymail.pauseSender();
  await page.route(isSummary, (route) => route.fulfill({ status: 500, contentType: "application/json", body: '{"code":"server.internal"}' }));

  const answered = summaryAnswered(page);
  await page.goto("/mail-tasks");
  await answered;
  await expect(sendCount(page)).toBeVisible();
  await expect(page.getByText(NOTICE)).toHaveCount(0);
});
