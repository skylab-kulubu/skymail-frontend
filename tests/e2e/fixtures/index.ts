/**
 * The browser tests' fixtures: a page whose SkyMail API is the mock, which
 * cannot reach any other host, and a way to sign in as a writer or a reader.
 */
import { test as base, expect, type Page } from "@playwright/test";
import { E2E_BASE_URL } from "./env";
import { MockSkymail } from "./mock-api";
import { sessionCookie, type Profile } from "./session";

export { expect };

export const test = base.extend<{ skymail: MockSkymail; signIn: (profile?: Profile) => Promise<void> }>({
  // Playwright hands each fixture its value through the second argument; it is
  // named `provide` here so the React hooks lint does not take it for `use`.
  page: async ({ page }, provide) => {
    // The mails' logo and anything else outside the panel: nothing leaves the machine.
    await page.route((url) => !url.href.startsWith(E2E_BASE_URL) && /^https?:/.test(url.protocol), (route) => route.abort());
    await provide(page);
  },
  skymail: async ({ page }, provide) => {
    const skymail = new MockSkymail();
    await skymail.attach(page);
    await provide(skymail);
  },
  signIn: async ({ context }, provide) => {
    await provide(async (profile = "writer") => {
      await context.addCookies([await sessionCookie(profile)]);
    });
  },
});

type Monaco = {
  editor: { getModels(): { uri: { path: string }; getValue(): string; setValue(value: string): void }[] };
};

/** Waits for the code editor to hold a model for `mode`: Monaco loads after the page. */
async function modelFor(page: Page, mode: "jsx" | "html") {
  await page.waitForFunction((prefix) => {
    const monaco = (window as unknown as { monaco?: Monaco }).monaco;
    return monaco?.editor.getModels().some((candidate) => candidate.uri.path.startsWith(prefix)) ?? false;
  }, `/${mode}/`);
}

/**
 * The text of the code editor's model for a mode. Monaco's own global (its
 * AMD build defines `monaco`) is the one way in: typing into it would go
 * through its bracket and tag completion.
 */
export async function sourceIn(page: Page, mode: "jsx" | "html"): Promise<string> {
  await modelFor(page, mode);
  return page.evaluate((prefix) => {
    const monaco = (window as unknown as { monaco: Monaco }).monaco;
    return monaco.editor.getModels().find((candidate) => candidate.uri.path.startsWith(prefix))!.getValue();
  }, `/${mode}/`);
}

export async function writeSource(page: Page, mode: "jsx" | "html", text: string): Promise<void> {
  await modelFor(page, mode);
  await page.evaluate(
    ({ prefix, value }) => {
      const monaco = (window as unknown as { monaco: Monaco }).monaco;
      monaco.editor.getModels().find((candidate) => candidate.uri.path.startsWith(prefix))!.setValue(value);
    },
    { prefix: `/${mode}/`, value: text },
  );
}

/** The body of the preview frame with this title. */
export function preview(page: Page, title: string) {
  return page.frameLocator(`iframe[title="${title}"]`).locator("body");
}
