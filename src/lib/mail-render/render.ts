/**
 * Turns a React Email element into the two bodies a Mail template stores.
 *
 * These are @react-email/render's own rules — its prettier setup for the HTML,
 * its html-to-text selectors for the plain text, its XHTML doctype — because
 * they are what the Template seed has always written, and a template rendered
 * here has to come out byte for byte the same. Two additions: Go actions
 * are kept out of html-to-text's reach, which changes nothing for a template
 * that already kept its actions out of headings; and the content of an element
 * that keeps its whitespace is kept out of the formatter's (keepWhitespace),
 * which changes nothing for a template without one.
 *
 * What is not its `render()` is the React call. Its Node build rethrows a
 * component's error from inside React's work loop, where nothing can catch it:
 * a template that throws took the whole process down, and the promise never
 * settled. The browser build rejects instead. Streaming here, with the error
 * collected and rethrown after, behaves the same in both, and one render feeds
 * both bodies rather than rendering the element twice. A render that waits on
 * something that never settles is cut off at a deadline.
 */
import { Suspense, createElement, type ReactElement } from "react";
import { pretty, toPlainText } from "@react-email/render";
import { maskGoActions, preservingGoActions, tokenMarks } from "./go-template";

const XHTML_DOCTYPE =
  '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';

export interface Bodies {
  html: string;
  plainText: string;
  /** The markup React produced, before the doctype and the formatting. */
  markup: string;
}

type ReactDomServer = typeof import("react-dom/server");

/** Thrown when a render has not finished by its deadline. */
export class DeadlineError extends Error {}

async function renderMarkup(element: ReactElement, deadlineMs: number): Promise<string> {
  // react-dom/server is CommonJS, and a browser bundle may hand it over only as
  // the default export of the dynamic import; react-email unwraps it the same way.
  const loaded: ReactDomServer & { default?: ReactDomServer } = await import("react-dom/server");
  const { renderToReadableStream } = loaded.default ?? loaded;

  const errors: unknown[] = [];
  const render = async () => {
    // The Suspense boundary is react-email's, and it shows in the output as the
    // <!--$--> markers, so dropping it would change every stored body.
    const stream = await renderToReadableStream(createElement(Suspense, null, element), {
      progressiveChunkSize: Number.POSITIVE_INFINITY,
      // Aborting lets React stop the work it is waiting on.
      signal: AbortSignal.timeout(deadlineMs),
      onError(error) {
        errors.push(error);
      },
    });
    await stream.allReady;
    return new Response(stream).text();
  };

  // A component waiting on a promise that never settles would otherwise keep
  // this pending for ever, and emails:render and the seed with it. The abort
  // above usually settles it; this is the guarantee.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new DeadlineError()), deadlineMs + 50);
  });
  let markup: string;
  try {
    markup = await Promise.race([render(), deadline]);
  } catch (error) {
    throw error instanceof DeadlineError || isAbort(error) ? new DeadlineError() : error;
  } finally {
    clearTimeout(timer);
  }

  // An error inside the boundary does not reject: React renders the fallback
  // and leaves the rest to a client that will never run. An abort shows up
  // here the same way.
  if (errors.some(isAbort)) {
    throw new DeadlineError();
  }
  if (errors.length > 0) {
    throw errors[0];
  }
  return markup;
}

const isAbort = (error: unknown) =>
  error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");

export interface ElementOptions {
  /**
   * Keep every Go action on one line, exactly as written, through the HTML's
   * formatting. The formatter otherwise breaks a long line at any space,
   * inside an action too (`{{if\n  .Link}}`): the mailer still parses that,
   * but it is not the action that was written. A JSX template leaves this off,
   * because its HTML must stay what the Template seed has always written.
   */
  keepActionsWhole?: boolean;
}

/**
 * An opening tag whose style keeps whitespace: `white-space: pre`, `pre-wrap`,
 * `pre-line` or `break-spaces`. React writes a style as one double-quoted
 * attribute and escapes `>` inside it.
 */
const KEEPS_WHITESPACE = /<([A-Za-z][\w-]*)\b[^>]*\sstyle="[^"]*\bwhite-space:\s*(?:pre|pre-wrap|pre-line|break-spaces)\b[^"]*"[^>]*>/g;

/** Offset of the tag closing a `tag` whose content starts at `from`, or -1. */
function closingTag(html: string, tag: string, from: number): number {
  const tags = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  tags.lastIndex = from;
  let depth = 1;
  for (let match = tags.exec(html); match; match = tags.exec(html)) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) {
      return match.index;
    }
  }
  return -1;
}

/**
 * The formatter puts an element's content on a line of its own, indented under
 * its tag. An element that keeps whitespace shows those: a note in
 * `white-space: pre-wrap` would open with an empty line and forty spaces and
 * close with another empty line. Its content is swapped for a token while the
 * formatter runs and put back against its tags, exactly as React wrote it.
 */
function keepWhitespace(document: string): { masked: string; unmask(output: string): string } {
  const [open, close] = tokenMarks(document);
  const contents: string[] = [];
  let masked = "";
  let copied = 0;
  for (const opening of document.matchAll(KEEPS_WHITESPACE)) {
    const start = opening.index + opening[0].length;
    // One inside another is kept with the outer one's content.
    if (opening.index < copied) {
      continue;
    }
    const end = closingTag(document, opening[1], start);
    if (end <= start) {
      continue;
    }
    masked += `${document.slice(copied, start)}${open}${contents.push(document.slice(start, end)) - 1}${close}`;
    copied = end;
  }
  if (contents.length === 0) {
    return { masked: document, unmask: (output) => output };
  }
  masked += document.slice(copied);

  // The token is the element's whole content, so the whitespace around it is the formatter's.
  const token = new RegExp(`\\s*${open}(\\d+)${close}\\s*`, "g");
  return { masked, unmask: (output) => output.replace(token, (_token, index: string) => contents[Number(index)]) };
}

export async function renderElement(
  element: ReactElement,
  deadlineMs: number,
  { keepActionsWhole = false }: ElementOptions = {},
): Promise<Bodies> {
  const markup = await renderMarkup(element, deadlineMs);
  const document = `${XHTML_DOCTYPE}${markup.replace(/<!DOCTYPE.*?>/, "")}`;

  const kept = keepWhitespace(document);
  let html: string;
  if (keepActionsWhole) {
    const { masked, unmask } = maskGoActions(kept.masked);
    html = unmask(await pretty(masked));
  } else {
    html = await pretty(kept.masked);
  }
  return { html: kept.unmask(html), plainText: plainTextFromHtml(markup), markup };
}

/**
 * The plain-text part of either mode's markup, by react-email's rules, with
 * its Go template actions kept as written: the mailer parses the plain text as
 * a template too.
 */
export function plainTextFromHtml(html: string): string {
  return preservingGoActions(html, (masked) => toPlainText(masked));
}
