/**
 * What a mail preview frame shows: a body with sample values in place of its
 * Go actions (the render module's fillSampleValues), in one theme.
 *
 * The club's mails carry their dark theme in `@media (prefers-color-scheme:
 * dark)` rules (emails/theme.tsx). Inside a frame those follow the operator's
 * own system, so the light and the dark preview would look the same. The
 * preview rewrites the query instead: in the dark preview the dark rules
 * always apply, in the light one never. Only the preview is rewritten; what is
 * stored and sent is the body as rendered.
 */
import { fillSampleValues, type SampleValues } from "../mail-render/preview";

export type MailScheme = "light" | "dark";

const MEDIA_PRELUDE = /@media([^{;]*)\{/gi;
const SCHEME_FEATURE = /\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)/gi;
/** Always true, where a query needs a feature in the place of the one taken out. */
const ALWAYS = "(min-width: 0px)";

/** One media query of a list, with every colour-scheme feature decided; null when it can never match. */
function decideQuery(query: string, scheme: MailScheme): string | null {
  let matches = true;
  const decided = query.replace(SCHEME_FEATURE, (_feature, wanted: string) => {
    if (wanted.toLowerCase() !== scheme) matches = false;
    return ALWAYS;
  });
  if (!matches) return null;
  return decided.trim() === ALWAYS ? "all" : decided.trim();
}

/** The body with its colour-scheme media queries decided for `scheme`. */
export function forceColorScheme(html: string, scheme: MailScheme): string {
  return html.replace(MEDIA_PRELUDE, (rule, prelude: string) => {
    if (!/prefers-color-scheme/i.test(prelude)) return rule;
    const queries = prelude
      .split(",")
      .map((query) => decideQuery(query, scheme))
      .filter((query): query is string => query !== null);
    const trailing = /\s*$/.exec(prelude)?.[0] ?? "";
    return `@media ${queries.length > 0 ? queries.join(", ") : "not all"}${trailing}{`;
  });
}

/** The document a preview frame shows for `body`. */
export function previewDocument(body: string, { scheme, sample }: { scheme: MailScheme; sample: SampleValues }): string {
  return forceColorScheme(fillSampleValues(body, sample), scheme);
}
