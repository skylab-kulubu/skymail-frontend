/**
 * The theme is chosen twice: by the inline script before the first paint, and
 * by preferredTheme() after React has rendered. If the two disagreed, the page
 * would flash from one theme to the other on every load.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { THEME_STORAGE_KEY, preferredTheme, themeInitScript } from "./theme";

type Stored = string | null | "blocked";

function browser(stored: Stored, system: "light" | "dark") {
  const root = { dataset: {} as Record<string, string> };
  const storage = {
    getItem(key: string) {
      if (stored === "blocked") throw new Error("SecurityError");
      return key === THEME_STORAGE_KEY ? stored : null;
    },
  };
  const matchMedia = (query: string) => ({ matches: query === `(prefers-color-scheme: ${system})` });
  Object.assign(globalThis, {
    window: { localStorage: storage, matchMedia },
    localStorage: storage,
    matchMedia,
    document: { documentElement: root },
  });
  return root;
}

afterEach(() => {
  for (const name of ["window", "localStorage", "matchMedia", "document"]) {
    delete (globalThis as Record<string, unknown>)[name];
  }
});

describe("the theme before and after the first paint", () => {
  for (const stored of [null, "light", "dark", "sepia", "blocked"] as const) {
    for (const system of ["light", "dark"] as const) {
      it(`agree with stored=${String(stored)} and a ${system} system`, () => {
        const root = browser(stored, system);

        new Function(themeInitScript)();

        assert.equal(root.dataset.theme, preferredTheme());
        const expected = stored === "light" || stored === "dark" ? stored : system;
        assert.equal(root.dataset.theme, expected);
      });
    }
  }
});
