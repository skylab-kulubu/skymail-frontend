/**
 * The console's Content-Security-Policy (src/lib/content-security-policy.ts),
 * enforced here (CSP_MODE=enforce in fixtures/env.ts) so that every browser
 * test runs under the blocking policy. These pages load the most: Next.js's
 * scripts and the theme scripts with the nonce, Monaco with its workers and
 * <style> elements, and a mail preview, an srcdoc frame that inherits the
 * policy, with the mail's own <style> block and an image.
 */
import type { Page } from "@playwright/test";
import { expect, preview, test } from "./fixtures";

/** What the browser says when the policy blocks something. */
function violations(page: Page): string[] {
  const seen: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) seen.push(message.text());
  });
  return seen;
}

test("a console page carries the policy, and every inline script the nonce", async ({ page, signIn }) => {
  await signIn("writer");
  const response = await page.goto("/mail-tasks");
  const headers = response!.headers();
  const policy = headers["content-security-policy"];
  expect(policy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(policy).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy-report-only"]).toBeUndefined();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");

  const nonce = /'nonce-([^']+)'/.exec(policy)![1];
  const inline = await page.evaluate(() =>
    [...document.querySelectorAll("script:not([src])")].map((script) => (script as HTMLScriptElement).nonce),
  );
  expect(inline.length).toBeGreaterThan(0);
  expect(inline.every((value) => value === nonce)).toBe(true);
  // The theme scripts ran: data-theme is set before React.
  await expect(page.locator("html")).toHaveAttribute("data-theme", /.+/);
});

test("each response has a nonce of its own", async ({ page, signIn }) => {
  await signIn("writer");
  const first = (await page.goto("/mail-tasks"))!.headers()["content-security-policy"];
  const second = (await page.goto("/mail-tasks"))!.headers()["content-security-policy"];
  expect(first).not.toBe(second);
});

test("the template editor, Monaco and the mail preview run under it", async ({ page, skynotify, signIn }) => {
  const blocked = violations(page);
  await signIn("writer");
  const html = `<!DOCTYPE html><html><head><style>.boyali { color: rgb(255, 0, 0); }</style></head><body><p class="boyali">stilli metin</p><img alt="logo" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></body></html>`;
  const { id } = skynotify.addTemplate({
    name: "Stilli gövde",
    subject: "Merhaba",
    mainMode: "html",
    html,
    htmlContent: html,
    plainText: "stilli metin",
  });

  await page.goto(`/templates/edit/${id}`);
  await page.waitForFunction(() => "monaco" in window);
  const body = preview(page, "Mail önizlemesi");
  await expect(body).toContainText("stilli metin");
  // The mail's own <style> block applied inside the frame.
  await expect(body.locator(".boyali")).toHaveCSS("color", "rgb(255, 0, 0)");

  expect(blocked).toEqual([]);
});
