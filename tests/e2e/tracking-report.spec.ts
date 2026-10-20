/**
 * A tracked send's "Açılma ve tıklama" section (hub ticket iletisim-servisi
 * 15b) against the mock of skymail-backend's read routes (14b): the counts,
 * the series and its table, the links; the recipients one by one only for
 * skymail:mails:tracking:read or the send's own sender (anyone else's page
 * never asks for them); a year-old send's kept totals; and no section at all
 * for a send that was not tracked. Every person here is made up.
 */
import { expect, test } from "./fixtures";
import type { MockSkymail, TrackingFixture } from "./fixtures/mock-api";

const SOMEONE_ELSE = "0c9e4f6a-1b2d-4c3e-8f7a-9d0e1f2a3b4c";

const REPORT = {
  tracked_recipients: 3,
  untracked_by_reason: { no_account: 1 },
  unique_opens: 2,
  unique_likely_human_opens: 1,
  automated_only_recipients: 1,
  unique_clickers: 1,
  clicks_by_link: [
    { id: 11, position: 0, clicks: 2, unique_clickers: 1 },
    { id: 12, position: 1, clicks: 0, unique_clickers: 0 },
  ],
  series: [
    { at: "2026-10-20T09:00:00Z", interval: "hour", likely_human_opens: 0, automated_opens: 1, likely_human_clicks: 0, automated_clicks: 0 },
    { at: "2026-10-20T11:00:00Z", interval: "hour", likely_human_opens: 0, automated_opens: 0, likely_human_clicks: 2, automated_clicks: 0 },
    { at: "2026-10-24T00:00:00Z", interval: "day", likely_human_opens: 1, automated_opens: 0, likely_human_clicks: 0, automated_clicks: 0 },
  ],
};

const row = (overrides: Partial<TrackingFixture["recipients"][number]> & Pick<TrackingFixture["recipients"][number], "recipient_full_name" | "recipient_email">) => ({
  id: `q-${overrides.recipient_email}`,
  recipient_sub: null,
  tracked: true,
  tracking_skip_reason: null,
  first_open_at: null,
  first_likely_human_open_at: null,
  likely_human_open_source: null,
  open_count: 0,
  last_clicked_at: null,
  automated_only: false,
  source_classes: [],
  clicked_links: [],
  ...overrides,
});

const TRACKED: TrackingFixture = {
  summary: { retained: false, report: REPORT },
  recipients: [
    row({
      recipient_full_name: "Deneme Bir",
      recipient_email: "deneme.bir@example.test",
      first_open_at: "2026-10-24T08:00:00Z",
      first_likely_human_open_at: "2026-10-20T11:00:00Z",
      likely_human_open_source: "click_inferred",
      open_count: 1,
      last_clicked_at: "2026-10-20T11:10:00Z",
      source_classes: ["browser"],
      clicked_links: [{ link_id: 11, clicks: 2, last_clicked_at: "2026-10-20T11:10:00Z" }],
    }),
    row({
      recipient_full_name: "Deneme İki",
      recipient_email: "deneme.iki@example.test",
      first_open_at: "2026-10-20T09:00:03Z",
      open_count: 1,
      automated_only: true,
      source_classes: ["apple_proxy_likely"],
    }),
    row({ recipient_full_name: "Deneme Üç", recipient_email: "deneme.uc@example.test" }),
    row({ recipient_full_name: "Deneme Dört", recipient_email: "deneme.dort@example.test", tracked: false, tracking_skip_reason: "no_account" }),
  ],
};

function trackedSend(skymail: MockSkymail, { sentBy = SOMEONE_ELSE, fixture = TRACKED }: { sentBy?: string; fixture?: TrackingFixture } = {}) {
  const { id: templateId } = skymail.addTemplate({ name: "Ekim bülteni", subject: "Ekim", mainMode: "html", html: "<p>…</p>", htmlContent: "<p>Ekim</p>", plainText: "Ekim" });
  const listId = skymail.addList({
    name: "Deneme listesi",
    recipients: fixture.recipients.map((recipient) => ({ full_name: recipient.recipient_full_name, email: String(recipient.recipient_email) })),
  });
  const id = skymail.addSend({ templateId, listId, sentBy });
  skymail.trackSend(id, fixture);
  return id;
}

test("a tracking reader sees the counts, the series as a table, the links and every recipient with their marks", async ({ page, skymail, signIn }) => {
  await signIn("trackingReader");
  const id = trackedSend(skymail);
  await page.goto(`/mail-tasks/show/${id}`);

  const section = page.getByRole("region", { name: "Açılma ve tıklama" });
  await expect(section.getByText(/^Açılma kesin değildir\. Apple Mail postayı kendisi yükleyebilir/)).toBeVisible();
  await expect(section.locator("[data-slot=stat-card]").filter({ hasText: "Takip edilmeyen" })).toContainText("Hesabı yok: 1");

  // The series' accessible twin: the same counts, hour by hour, then by the day.
  await section.getByRole("button", { name: "Tablo olarak göster" }).click();
  const series = section.getByRole("table", { name: "Zaman içinde" });
  await expect(series.getByRole("columnheader")).toHaveText(["Zaman", "Açılma (insan olası)", "Açılma (muhtemelen otomatik)", "Tıklama"]);
  await expect(series.getByRole("row")).toHaveCount(1 + 3 + 1);

  await expect(section.getByRole("cell", { name: "1. bağlantı", exact: true })).toBeVisible();

  const people = section.getByRole("table").last();
  await expect(people.getByRole("row", { name: /Deneme Bir/ })).toContainText("Tıklamadan çıkarım");
  await expect(people.getByRole("row", { name: /Deneme İki/ })).toContainText("Muhtemelen otomatik (Apple Mail)");
  await expect(people.getByRole("row", { name: /Deneme İki/ })).toContainText("Yalnız otomatik açılma");
  await expect(people.getByRole("row", { name: /Deneme Üç/ })).toContainText("Açılma görülmedi");
  await expect(people.getByRole("row", { name: /Deneme Dört/ })).toContainText("Takip edilmedi: Hesabı yok");

  await section.getByRole("group", { name: "Gösterilen kişiler" }).getByRole("button", { name: /^Tıkladı/ }).click();
  await expect(people.getByRole("row")).toHaveCount(2);
  expect(skymail.trackingRecipientRequests().length).toBeGreaterThanOrEqual(2);

  await expect(page.locator("body")).not.toContainText(/\b(okudu|okumadı|okundu|okunmadı)/i);
});

test("someone who reads sends but neither holds the role nor sent this one gets the counts, and the page never asks for the people", async ({ page, skymail, signIn }) => {
  await signIn("watcher");
  const id = trackedSend(skymail);
  await page.goto(`/mail-tasks/show/${id}`);

  const section = page.getByRole("region", { name: "Açılma ve tıklama" });
  await expect(section.locator("[data-slot=stat-card]").filter({ hasText: "Tıklayan" })).toContainText("1");
  await expect(section.getByRole("heading", { name: "Kişiler", exact: true })).toHaveCount(0);
  await expect(section.getByText("Deneme Bir")).toHaveCount(0);
  expect(skymail.trackingRecipientRequests()).toHaveLength(0);
});

test("the send's own sender sees its recipients without the role", async ({ page, skymail, signIn }) => {
  await signIn("watcher");
  const id = trackedSend(skymail, { sentBy: "8d0f5c2e-6b1a-4c3e-9f27-5a1d3b7e9c41" });
  await page.goto(`/mail-tasks/show/${id}`);

  const section = page.getByRole("region", { name: "Açılma ve tıklama" });
  await expect(section.getByRole("heading", { name: "Kişiler", exact: true })).toBeVisible();
  await expect(section.getByRole("row", { name: /Deneme Bir/ })).toBeVisible();
});

test("a year after the last mail only the kept totals remain, and nobody is asked for", async ({ page, skymail, signIn }) => {
  await signIn("trackingReader");
  // Kept totals carry no series and no automatic-only count.
  const kept = { ...REPORT, series: undefined, automated_only_recipients: undefined };
  const id = trackedSend(skymail, { fixture: { summary: { retained: true, report: kept }, recipients: TRACKED.recipients } });
  await page.goto(`/mail-tasks/show/${id}`);

  const section = page.getByRole("region", { name: "Açılma ve tıklama" });
  await expect(section.getByText(/Kişi bazında kayıt 1 yıl sonra silindi\./)).toBeVisible();
  await expect(section.locator("[data-slot=stat-card]").filter({ has: page.getByText("Takip edilen", { exact: true }) })).toContainText("3");
  await expect(section.getByText("Zaman içinde")).toHaveCount(0);
  expect(skymail.trackingRecipientRequests()).toHaveLength(0);
});

test("a send that was not tracked has no section and asks for nothing of it", async ({ page, skymail, signIn }) => {
  await signIn("trackingReader");
  const { id: templateId } = skymail.addTemplate({ name: "Ekim bülteni", subject: "Ekim", mainMode: "html", html: "<p>…</p>", htmlContent: "<p>Ekim</p>", plainText: "Ekim" });
  const listId = skymail.addList({ name: "Deneme listesi", recipients: [{ full_name: "Deneme Bir", email: "deneme.bir@example.test" }] });
  const id = skymail.addSend({ templateId, listId });
  await page.goto(`/mail-tasks/show/${id}`);

  await expect(page.getByRole("region", { name: "Alıcılar" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Açılma ve tıklama" })).toHaveCount(0);
  expect(skymail.requests.filter((request) => request.path.includes("/tracking"))).toHaveLength(0);
});
