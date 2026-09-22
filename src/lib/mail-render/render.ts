/**
 * Turns a React Email element into the two bodies a Mail template stores.
 *
 * These are @react-email/render's own rules — its prettier setup for the HTML,
 * its html-to-text selectors for the plain text, its XHTML doctype — because
 * they are what the Template seed has always written, and a template rendered
 * here has to come out byte for byte the same.
 *
 * What is not its `render()` is the React call. Its Node build rethrows a
 * component's error from inside React's work loop, where nothing can catch it:
 * a template that throws took the whole process down, and the promise never
 * settled. The browser build rejects instead. Streaming here, with the error
 * collected and rethrown after, behaves the same in both, and one render feeds
 * both bodies rather than rendering the element twice.
 */
import { Suspense, createElement, type ReactElement } from "react";
import { pretty, toPlainText } from "@react-email/render";
import { sparingActions } from "./go-template";

const XHTML_DOCTYPE =
  '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';

export interface Bodies {
  html: string;
  plainText: string;
  /** The markup React produced, before the doctype and the formatting. */
  markup: string;
}

type ReactDomServer = typeof import("react-dom/server");

async function renderMarkup(element: ReactElement): Promise<string> {
  // react-dom/server is CommonJS, and a browser bundle may hand it over only as
  // the default export of the dynamic import; react-email unwraps it the same way.
  const loaded: ReactDomServer & { default?: ReactDomServer } = await import("react-dom/server");
  const { renderToReadableStream } = loaded.default ?? loaded;

  const errors: unknown[] = [];
  // The Suspense boundary is react-email's, and it shows in the output as the
  // <!--$--> markers, so dropping it would change every stored body.
  const stream = await renderToReadableStream(createElement(Suspense, null, element), {
    progressiveChunkSize: Number.POSITIVE_INFINITY,
    onError(error) {
      errors.push(error);
    },
  });
  await stream.allReady;
  const markup = await new Response(stream).text();

  // An error inside the boundary does not reject: React renders the fallback
  // and leaves the rest to a client that will never run.
  if (errors.length > 0) {
    throw errors[0];
  }
  return markup;
}

export async function renderElement(element: ReactElement): Promise<Bodies> {
  const markup = await renderMarkup(element);
  const document = `${XHTML_DOCTYPE}${markup.replace(/<!DOCTYPE.*?>/, "")}`;

  return {
    html: await pretty(document),
    plainText: toPlainText(markup),
    markup,
  };
}

/**
 * The plain-text part of markup someone wrote by hand, by the same rules, with
 * its Go template actions kept as written: the mailer parses the plain text as
 * a template too.
 */
export function plainTextFromHtml(html: string): string {
  return sparingActions(html, (masked) => toPlainText(masked));
}
