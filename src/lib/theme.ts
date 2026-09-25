/**
 * Light and dark theme, chosen per browser.
 *
 * The choice lives under the same localStorage key the Refine app used, so an
 * operator's theme survives the rewrite. With no choice stored, the theme
 * follows the system. The attribute is set by an inline script before the
 * first paint, so a light-theme user never sees a dark flash.
 */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "colorMode";

/**
 * The stored choice, or the system's preference when there is none or storage
 * is blocked. It runs twice — as the inline script before the first paint
 * (from its source text) and after React renders — so it must stay
 * self-contained: no imports, no names from outside its body.
 */
function resolveTheme(storageKey: string): Theme {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage blocked (private mode, site data off): use the system preference.
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export const themeInitScript = `document.documentElement.dataset.theme=(${resolveTheme.toString()})(${JSON.stringify(
  THEME_STORAGE_KEY,
)});`;

export function preferredTheme(): Theme {
  return resolveTheme(THEME_STORAGE_KEY);
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the theme still applies to this page.
  }
}
