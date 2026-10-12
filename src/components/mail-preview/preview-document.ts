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
import { fillSampleValues, type SampleValues } from "@/lib/mail-render/preview";

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

/**
 * Whether a sent mail may reach the network: blocked until the operator asks
 * to see its images. A mail's images, fonts and stylesheets are requests to
 * wherever the mail points, a tracking pixel among them, and the operator
 * reading a sent mail must not be counted as its recipient opening it.
 */
export type RemoteContent = "blocked" | "allowed";

/**
 * The Content-Security-Policy a sent mail is shown under. Nothing is fetched
 * while blocked: images and fonts only from data: URLs, styles only inline.
 * Allowed, images, fonts and stylesheets may come over https. Never a script,
 * a frame, a form's submission or a base URL; the frame's empty sandbox stops
 * scripts too, the policy keeps that true whatever the frame becomes.
 */
export function contentPolicy(remote: RemoteContent): string {
  const https = remote === "allowed" ? " https:" : "";
  return [
    "default-src 'none'",
    `img-src data:${https}`,
    `font-src data:${https}`,
    `style-src 'unsafe-inline'${https}`,
    "form-action 'none'",
    "base-uri 'none'",
  ].join("; ");
}

/**
 * A doctype the parser meets first: only HTML's own whitespace before it.
 * JavaScript's \s also takes a BOM, a no-break space or a vertical tab, which
 * the parser reads as text: it would close the head there, and a policy put
 * after the doctype would land in the body, where it does not apply.
 */
const LEADING_DOCTYPE = /^[\t\n\f\r ]*<!doctype[^>]*>/i;

/**
 * `html` with the policy and a no-referrer policy as its first elements. A <meta> policy governs only
 * what the parser meets after it, so it goes before anything of the mail's:
 * right after a leading doctype (which keeps the document in standards
 * mode), at the very start otherwise. Searching for the mail's own <head>
 * would not do: the first one in the text can sit in a comment.
 */
export function withRemoteContentPolicy(html: string, { remote }: { remote: RemoteContent }): string {
  // The frame's referrerPolicy covers only its own load; the document's
  // images take the parent's policy, and Safari sends the panel as Referer.
  const meta = `<meta http-equiv="Content-Security-Policy" content="${contentPolicy(remote)}"><meta name="referrer" content="no-referrer">`;
  const doctype = LEADING_DOCTYPE.exec(html);
  if (!doctype) return meta + html;
  return doctype[0] + meta + html.slice(doctype[0].length);
}

/**
 * The document a preview frame shows for `body`: filled with `sample`, or,
 * without one, a mail the server already rendered (a request for approval's
 * preview, a sent mail), shown as it is. `remote` puts a sent mail under the
 * content policy above.
 */
export function previewDocument(
  body: string,
  { scheme, sample, remote }: { scheme: MailScheme; sample?: SampleValues; remote?: RemoteContent },
): string {
  const themed = forceColorScheme(sample ? fillSampleValues(body, sample) : body, scheme);
  return remote ? withRemoteContentPolicy(themed, { remote }) : themed;
}
