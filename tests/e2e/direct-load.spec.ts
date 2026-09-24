/**
 * A page opened or reloaded directly asks the API for its data even in a tab
 * that draws no frames (ticket 24): a tab opened in the background, a
 * minimised or covered window, a browser an agent drives. Chromium runs no
 * requestAnimationFrame callback there until the tab is shown.
 *
 * React reveals a Suspense boundary that the server streamed after the page's
 * shell, and hydrates it, from requestAnimationFrame (react-dom's inline
 * `$RC`/`$RV` script and the boundary's `_reactRetry`). A page that wrapped
 * its client component in <Suspense> was streamed that way, so in such a tab
 * its effects never ran: the sidebar's requests went out, the page's never
 * did, and it sat at its loading card. The pages render in the shell instead.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import type { MockSkymail } from "./fixtures/mock-api";
import { MEMBER } from "./fixtures/session";

/** What a tab that is not drawn does: animation frames never come. */
async function withoutFrames(page: Page) {
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
  });
}

function seed(skymail: MockSkymail) {
  const template = skymail.addTemplate({
    name: "Etkinlik hatırlatması",
    key: "event.reminder",
    subject: "{{.EventName}} yarın",
    mainMode: "html",
    html: "<p>…</p>",
    htmlContent: "<p>{{.EventName}} yarın.</p>",
    plainText: "{{.EventName}} yarın.",
  });
  const list = skymail.addList({ name: "GECEKODU katılımcıları", recipients: [{ full_name: "Ayşe Yılmaz", email: "ayse@ornek.com" }] });
  const approval = skymail.addApproval({
    templateId: template.id,
    listId: list,
    variables: { EventName: "GECEKODU" },
    submitter: MEMBER,
    state: "rejected",
  });
  return { template: template.id, approval, send: "b1c2d3e4-0000-4000-8000-000000000024" };
}

type Ids = ReturnType<typeof seed>;

/** Every page that loads its data in the browser, and a request it makes for it. */
const PAGES: { page: (ids: Ids) => string; asks: (ids: Ids) => string }[] = [
  { page: () => "/templates", asks: () => "/templates" },
  { page: (ids) => `/templates/history/${ids.template}`, asks: (ids) => `/templates/${ids.template}` },
  { page: () => "/mailing-lists", asks: () => "/mailing_lists" },
  { page: () => "/mail-tasks", asks: () => "/mail_tasks" },
  { page: () => "/mail-tasks/create", asks: () => "/templates" },
  { page: (ids) => `/mail-tasks/show/${ids.send}`, asks: (ids) => `/mail_tasks/${ids.send}` },
  { page: () => "/mail-approvals", asks: () => "/mail_approvals" },
  { page: (ids) => `/mail-approvals/show/${ids.approval}`, asks: (ids) => `/mail_approvals/${ids.approval}` },
  { page: (ids) => `/mail-approvals/edit/${ids.approval}`, asks: (ids) => `/mail_approvals/${ids.approval}` },
];

for (const { page: address, asks } of PAGES) {
  const pattern = address({ template: ":template", approval: ":approval", send: ":send" });

  test(`${pattern}, opened in a tab that draws no frames, asks for its data`, async ({ page, skymail, signIn }) => {
    await signIn("sender");
    const ids = seed(skymail);
    await withoutFrames(page);

    await page.goto(address(ids));
    await expect
      .poll(() => skymail.requests.some((request) => request.method === "GET" && request.path === asks(ids)), { timeout: 5_000 })
      .toBe(true);
  });
}

test("the send form, opened in a tab that draws no frames, loads its templates and lists", async ({ page, skymail, signIn }) => {
  await signIn("sender");
  seed(skymail);
  await withoutFrames(page);

  await page.goto("/mail-tasks/create");
  await expect(page.getByRole("group", { name: "Mail template" }).getByRole("radio")).toHaveCount(1, { timeout: 5_000 });
  await expect(page.getByText("GECEKODU katılımcıları")).toBeVisible();
  await expect(page.getByText("Template'ler ve listeler yükleniyor")).toHaveCount(0);
});
