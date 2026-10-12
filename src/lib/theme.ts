/**
 * Light and dark theme, chosen per browser (skylcn-ui's ThemeScript and
 * useTheme). skylcn keeps the choice under its own key — dark, light or
 * following the system — and sets `data-theme` on <html> before the first
 * paint.
 *
 * SkyMail kept the choice under "colorMode" (the key the Refine app used) and
 * followed the system when there was none. The migration script runs before
 * skylcn's, once per browser: it carries an old choice over, and gives
 * everyone who never chose "system", so nobody's theme changes with the move.
 */

export type Theme = "light" | "dark";

/** Where SkyMail kept the theme before skylcn-ui. */
export const LEGACY_THEME_STORAGE_KEY = "colorMode";

/** skylcn-ui's key (THEME_STORAGE_KEY there); repeated so the script needs no import. */
export const SKYLCN_THEME_STORAGE_KEY = "skylcn:theme";

/**
 * Runs from its source text as an inline script, so it must stay
 * self-contained: no imports, no names from outside its body.
 */
function migrateTheme(legacyKey: string, skylcnKey: string): void {
  try {
    if (window.localStorage.getItem(skylcnKey) !== null) return;
    const legacy = window.localStorage.getItem(legacyKey);
    window.localStorage.setItem(skylcnKey, legacy === "light" || legacy === "dark" ? legacy : "system");
  } catch {
    // Storage blocked (private mode, site data off): skylcn falls back to dark.
  }
}

export const themeMigrationScript = `(${migrateTheme.toString()})(${JSON.stringify(LEGACY_THEME_STORAGE_KEY)},${JSON.stringify(
  SKYLCN_THEME_STORAGE_KEY,
)});`;

/** The theme the page shows now (not the stored choice, which may be "system"). */
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
