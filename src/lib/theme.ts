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

export const themeInitScript = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="dark";}})();`;

/** The stored choice, or the system's preference when there is none. */
export function preferredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage blocked: fall through to the system preference.
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
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
