/**
 * A JSX source is code, and opening a template in the editor compiles and
 * runs it. It must run where the operator's session is out of reach: in the
 * render sandbox, an iframe with an opaque origin. Here a template written to
 * steal the session tries everything it can from inside its render and
 * writes down what it got; it gets nothing, and the editor's own session
 * carries on untouched.
 */
import { expect, preview, test, writeSource } from "./fixtures";
import { E2E_BASE_URL } from "./fixtures/env";
import { SESSION_COOKIE, accessToken, readSession } from "./fixtures/session";

// The session endpoint by its full address: the code runs in a worker started
// from a blob URL, where a relative URL would not even name the panel.
const PROBE = `import * as React from "react";
import { use } from "react";
import { Text } from "@react-email/components";

const tried = (attempt) => {
  try {
    return "ULAŞTI " + String(attempt()).slice(0, 80);
  } catch (error) {
    return "engellendi:" + (error && error.name);
  }
};

const scope = typeof WorkerGlobalScope !== "undefined" ? "worker" : "frame";
const cookie = tried(() => document.cookie);
const parentPage = tried(() => window.parent.document.title);
const storage = tried(() => window.localStorage.getItem("colorMode"));
const session = fetch("${E2E_BASE_URL}/api/auth/session", { credentials: "include" }).then(
  (response) => response.text().then((text) => "ULAŞTI " + text.slice(0, 80)),
  (error) => "engellendi:" + error.name,
);
try {
  window.top.location.href = "/api/auth/signout";
} catch (error) {}

export default function Probe() {
  return (
    <Text>
      scope={scope} cookie={cookie} parent={parentPage} storage={storage} session={use(session)}
    </Text>
  );
}
`;

test("a template's code cannot reach the operator's session", async ({ page, context, skymail, signIn }) => {
  await signIn("writer");
  const { id } = skymail.addTemplate({
    name: "Zararsız görünen template",
    subject: "Merhaba",
    mainMode: "jsx",
    jsx: PROBE,
    htmlContent: "<p>stored</p>",
    plainText: "stored",
    author: { kind: "operator", sub: "another-operator", name: "Kötü niyetli operatör" },
  });
  const sessionRequests: Promise<{ cookie: string | undefined; frame: string }>[] = [];
  page.on("request", (request) => {
    if (!request.url().endsWith("/api/auth/session")) return;
    let frame = "worker";
    try {
      frame = request.frame().url();
    } catch {
      // A worker's request has no frame.
    }
    sessionRequests.push(request.allHeaders().then((headers) => ({ cookie: headers.cookie, frame })));
  });

  await page.goto(`/templates/edit/${id}`);
  const body = preview(page, "Mail önizlemesi");
  await expect(body).toContainText("session=", { timeout: 30_000 });

  // It ran in the sandbox's worker, which has no document, parent or storage
  // at all (an engine without the worker runs it in the frame, where each
  // of them is another origin's: SecurityError).
  await expect(body).toContainText("scope=worker");
  await expect(body).toContainText(/cookie=engellendi:(ReferenceError|SecurityError)/);
  await expect(body).toContainText(/parent=engellendi:(ReferenceError|SecurityError)/);
  await expect(body).toContainText(/storage=engellendi:(ReferenceError|SecurityError)/);
  await expect(body).toContainText("session=engellendi:TypeError");
  await expect(body).not.toContainText("ULAŞTI");

  // The probe's request left without the session cookie.
  const fromSandbox = (await Promise.all(sessionRequests)).filter((request) => !request.frame.startsWith(`${E2E_BASE_URL}/templates/`));
  expect(fromSandbox.length).toBeGreaterThan(0);
  for (const request of fromSandbox) expect(request.cookie ?? "").not.toContain(SESSION_COOKIE);

  // It ran in the sandbox: a frame with scripts and an origin of its own, and
  // the preview a frame with no scripts at all.
  const sandboxes = page.locator("iframe[data-render-sandbox]");
  expect(await sandboxes.count()).toBeGreaterThan(0);
  for (const flags of await sandboxes.evaluateAll((frames) => frames.map((frame) => frame.getAttribute("sandbox")))) {
    expect(flags).toBe("allow-scripts");
  }
  await expect(page.locator('iframe[title="Mail önizlemesi"]')).toHaveAttribute("sandbox", "");

  // The editor's session is untouched: same page, the same session in its
  // cookie (Auth.js re-encrypts it as it extends it, so compare what it holds),
  // still signed in.
  expect(page.url()).toContain(`/templates/edit/${id}`);
  const cookie = (await context.cookies()).find((candidate) => candidate.name === SESSION_COOKIE);
  const session = await readSession(cookie?.value ?? "");
  expect(session?.accessToken).toBe(accessToken("writer"));
  expect(session?.error).toBeUndefined();
  const own = await page.evaluate(() => fetch("/api/auth/session").then((response) => response.json()));
  expect(own.user?.name).toBe("DENEME OPERATÖR");
  expect(skymail.requests.every((request) => request.authorized && !request.frameUrl.includes("/render-sandbox/"))).toBe(true);
  await page.getByLabel("Konu").fill("Merhaba, oturum hâlâ yerinde");
  await page.getByRole("button", { name: "Taslağı kaydet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Taslak kaydedildi" })).toBeVisible();
  expect(skymail.writes().at(-1)?.authorized).toBe(true);
});

test("a script in an HTML body does not run in the preview", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const html = `<!DOCTYPE html><html><body><p id="text">durağan metin</p><script>document.getElementById("text").textContent = "script çalıştı"; parent.document.title = "ele geçirildi";</script></body></html>`;
  const { id } = skymail.addTemplate({
    name: "Script taşıyan gövde",
    subject: "Merhaba",
    mainMode: "html",
    html,
    htmlContent: html,
    plainText: "durağan metin",
  });
  await page.goto(`/templates/edit/${id}`);
  await expect(preview(page, "Mail önizlemesi")).toContainText("durağan metin");
  await expect(preview(page, "Mail önizlemesi")).not.toContainText("script çalıştı");
  expect(await page.title()).not.toContain("ele geçirildi");
});

// Stored JSX renders the moment the editor opens. A source stuck in a loop
// must not take the editor down with it, or the template could never be
// fixed from the panel: the render is stopped and says so, and meanwhile the
// page keeps answering — its own timers run and its fields take typing.
const LOOP = `import * as React from "react";
import { Text } from "@react-email/components";

export default function Mail() {
  while (true) {}
  return <Text>hiç gelmez</Text>;
}
`;

test("a template stuck in a loop is stopped, and the editor stays usable", async ({ page, skymail, signIn }) => {
  await signIn("writer");
  const { id } = skymail.addTemplate({
    name: "Takılan template",
    subject: "Merhaba",
    mainMode: "jsx",
    jsx: LOOP,
    htmlContent: "<p>stored</p>",
    plainText: "stored",
  });
  await page.addInitScript(() => {
    if (window.top !== window) return;
    const clock = window as unknown as { ticks: number };
    clock.ticks = 0;
    setInterval(() => {
      clock.ticks += 1;
    }, 100);
  });

  await page.goto(`/templates/edit/${id}`);
  await expect(page.getByLabel("Konu")).toBeVisible();
  // By now the loop has started in the render sandbox.
  await page.waitForTimeout(3_000);
  const before = await page.evaluate(() => (window as unknown as { ticks: number }).ticks);
  await page.waitForTimeout(2_000);
  const after = await page.evaluate(() => (window as unknown as { ticks: number }).ticks);
  expect(after - before, "the editor's own timer keeps running").toBeGreaterThanOrEqual(10);
  await page.getByLabel("Konu").fill("Döngüye rağmen yazılıyor");
  await expect(page.getByText("Döngüye rağmen yazılıyor")).toBeVisible();

  await expect(page.getByRole("alert").filter({ hasText: "bitmedi" })).toBeVisible({ timeout: 30_000 });

  // And the source can be fixed from the panel.
  await writeSource(page, "jsx", LOOP.replace("  while (true) {}\n", ""));
  await expect(preview(page, "Mail önizlemesi")).toContainText("hiç gelmez");
});
