/**
 * What the editor loads besides the app (scripts/build-editor-assets.ts): the
 * render sandbox's page, opaque however it is opened, and Monaco, from a path
 * named by its version so it can be cached for good.
 */
import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";

const IMMUTABLE = "public, max-age=31536000, immutable";

const monacoVersion = (JSON.parse(readFileSync("node_modules/monaco-editor/package.json", "utf8")) as { version: string })
  .version;

test("the render sandbox's page is sandboxed by its own header when opened directly", async ({ page }) => {
  const response = await page.goto("/render-sandbox/index.html");
  expect(response?.headers()["content-security-policy"]).toBe("sandbox allow-scripts");
  expect(await page.evaluate(() => self.origin)).toBe("null");
});

test("the editor loads Monaco from a path named by its version, cached for good", async ({ page, request, skymail, signIn }) => {
  await signIn("writer");
  const { id } = skymail.addTemplate({
    name: "Duyuru",
    subject: "Merhaba",
    mainMode: "html",
    html: "<p>Merhaba</p>",
    htmlContent: "<p>Merhaba</p>",
    plainText: "Merhaba",
  });
  const loaded: string[] = [];
  page.on("request", (sent) => {
    if (sent.url().includes("/monaco/")) loaded.push(new URL(sent.url()).pathname);
  });
  await page.goto(`/templates/edit/${id}`);
  await page.waitForFunction(() => "monaco" in window);

  const base = `/monaco/${monacoVersion}/vs`;
  expect(loaded).toContain(`${base}/loader.js`);
  expect(loaded.every((path) => path.startsWith(`${base}/`))).toBe(true);
  const loader = await request.get(`${base}/loader.js`);
  expect(loader.status()).toBe(200);
  expect(loader.headers()["cache-control"]).toBe(IMMUTABLE);
});
