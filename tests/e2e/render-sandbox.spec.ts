/**
 * A JSX source is code, and opening a template in the editor compiles and
 * runs it. It must run where the operator's session is out of reach: in the
 * render sandbox, an iframe with an opaque origin. Here a template written to
 * steal the session tries everything it can from inside its render and
 * writes down what it got; it gets nothing, and the editor's own session
 * carries on untouched.
 */
import { expect, preview, test } from "./fixtures";
import { SESSION_COOKIE, accessToken, readSession } from "./fixtures/session";

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

const cookie = tried(() => document.cookie);
const parentPage = tried(() => window.parent.document.title);
const storage = tried(() => window.localStorage.getItem("colorMode"));
const session = fetch("/api/auth/session", { credentials: "include" }).then(
  (response) => response.text().then((text) => "ULAŞTI " + text.slice(0, 80)),
  (error) => "engellendi:" + error.name,
);
try {
  window.top.location.href = "/api/auth/signout";
} catch (error) {}

export default function Probe() {
  return (
    <Text>
      cookie={cookie} parent={parentPage} storage={storage} session={use(session)}
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
    const frame = request.frame().url();
    sessionRequests.push(request.allHeaders().then((headers) => ({ cookie: headers.cookie, frame })));
  });

  await page.goto(`/templates/edit/${id}`);
  const body = preview(page, "Mail önizlemesi");
  await expect(body).toContainText("session=", { timeout: 30_000 });

  await expect(body).toContainText("cookie=engellendi:SecurityError");
  await expect(body).toContainText("parent=engellendi:SecurityError");
  await expect(body).toContainText("storage=engellendi:SecurityError");
  await expect(body).toContainText("session=engellendi:TypeError");
  await expect(body).not.toContainText("ULAŞTI");

  // The probe's request left without the session cookie.
  const fromSandbox = (await Promise.all(sessionRequests)).filter((request) => request.frame.includes("/render-sandbox/"));
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
