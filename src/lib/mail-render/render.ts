/**
 * Turns a React Email element into the two bodies a Mail template stores.
 *
 * These are @react-email/render's own rules — its prettier setup for the HTML,
 * its html-to-text selectors for the plain text, its XHTML doctype — because
 * they are what the Template seed has always written, and a template rendered
 * here has to come out byte for byte the same. The one addition: Go actions
 * are kept out of html-to-text's reach, which changes nothing for a template
 * that already kept its actions out of headings.
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
import { preservingGoActions } from "./go-template";

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

export async function renderElement(element: ReactElement, deadlineMs: number): Promise<Bodies> {
  const markup = await renderMarkup(element, deadlineMs);
  const document = `${XHTML_DOCTYPE}${markup.replace(/<!DOCTYPE.*?>/, "")}`;

  return {
    html: await pretty(document),
    plainText: plainTextFromHtml(markup),
    markup,
  };
}

/**
 * The plain-text part of either mode's markup, by react-email's rules, with
 * its Go template actions kept as written: the mailer parses the plain text as
 * a template too.
 */
export function plainTextFromHtml(html: string): string {
  return preservingGoActions(html, (masked) => toPlainText(masked));
}
