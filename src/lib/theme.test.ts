/**
 * The move to skylcn-ui's theme keeps everyone's theme: an old "colorMode"
 * choice carries over, nobody who never chose is switched to dark, and a
 * choice made in skylcn's menu is never overwritten.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { LEGACY_THEME_STORAGE_KEY, SKYLCN_THEME_STORAGE_KEY, themeMigrationScript } from "./theme";

function browser(initial: Record<string, string> | "blocked") {
  const store = new Map(initial === "blocked" ? [] : Object.entries(initial));
  const storage = {
    getItem(key: string) {
      if (initial === "blocked") throw new Error("SecurityError");
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (initial === "blocked") throw new Error("SecurityError");
      store.set(key, value);
    },
  };
  Object.assign(globalThis, { window: { localStorage: storage }, localStorage: storage });
  return store;
}

afterEach(() => {
  for (const name of ["window", "localStorage"]) delete (globalThis as Record<string, unknown>)[name];
});

describe("the theme choice moving to skylcn-ui", () => {
  for (const [legacy, expected] of [
    ["light", "light"],
    ["dark", "dark"],
    [undefined, "system"],
    ["sepia", "system"],
  ] as const) {
    it(`turns colorMode=${String(legacy)} into ${expected}`, () => {
      const store = browser(legacy === undefined ? {} : { [LEGACY_THEME_STORAGE_KEY]: legacy });

      new Function(themeMigrationScript)();

      assert.equal(store.get(SKYLCN_THEME_STORAGE_KEY), expected);
    });
  }

  it("leaves a choice made in skylcn alone", () => {
    const store = browser({ [LEGACY_THEME_STORAGE_KEY]: "light", [SKYLCN_THEME_STORAGE_KEY]: "dark" });

    new Function(themeMigrationScript)();

    assert.equal(store.get(SKYLCN_THEME_STORAGE_KEY), "dark");
  });

  it("does not throw when storage is blocked", () => {
    browser("blocked");

    assert.doesNotThrow(() => new Function(themeMigrationScript)());
  });

  it("uses skylcn-ui's own key", async () => {
    const { THEME_STORAGE_KEY } = await import("@skylab-kulubu/skylcn-ui");
    assert.equal(SKYLCN_THEME_STORAGE_KEY, THEME_STORAGE_KEY);
  });
});
