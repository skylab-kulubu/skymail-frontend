/**
 * Go template actions, found the way skymail-backend's text/template and
 * html/template find them: `{{` to the next `}}` that is not inside a quoted
 * string, and `{{/* … *\/}}` comments, with or without trim markers.
 *
 * Not a parser. It finds where actions are; whether they make a valid template
 * is the server's to say.
 */
import { v } from "../../../emails/go";

/**
 * A variable as the panel writes it for an operator: the action that prints
 * it, `{{.Name}}` — the repo templates' own `v`.
 */
export const variableAction: (name: string) => string = v;

/** A name the mailer's data may have as a field: skymail-backend's rule (pkg/validator IsVariableName). */
export function isVariableName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name);
}

export interface Action {
  /** Offset of the opening `{{`. */
  start: number;
  /** Offset just past the closing `}}`. */
  end: number;
}

const OPEN = "{{";
const CLOSE = "}}";

/** Offset just past a quoted string starting at `from`; a string cannot span a line. */
function skipQuoted(text: string, from: number): number {
  const quote = text[from];
  let at = from + 1;
  while (at < text.length && text[at] !== quote && text[at] !== "\n") {
    at += text[at] === "\\" ? 2 : 1;
  }
  return at + 1;
}

/** Offset just past the `}}` closing an action whose inside starts at `from`, or -1. */
function actionEnd(text: string, from: number): number {
  const afterTrim = /^-\s/.test(text.slice(from, from + 2)) ? from + 2 : from;
  if (text.startsWith("/*", afterTrim)) {
    const commentEnd = text.indexOf("*/", afterTrim + 2);
    const close = commentEnd === -1 ? -1 : text.indexOf(CLOSE, commentEnd + 2);
    return close === -1 ? -1 : close + CLOSE.length;
  }

  let at = from;
  while (at < text.length) {
    if (text.startsWith(CLOSE, at)) {
      return at + CLOSE.length;
    }
    const char = text[at];
    if (char === '"' || char === "'") {
      at = skipQuoted(text, at);
    } else if (char === "`") {
      const close = text.indexOf("`", at + 1);
      if (close === -1) {
        return -1;
      }
      at = close + 1;
    } else {
      at += 1;
    }
  }
  return -1;
}

/** Every action in the text, in order. An unclosed `{{` ends the search. */
export function findActions(text: string): Action[] {
  const actions: Action[] = [];
  let from = 0;
  for (;;) {
    const start = text.indexOf(OPEN, from);
    if (start === -1) {
      return actions;
    }
    const end = actionEnd(text, start + OPEN.length);
    if (end === -1) {
      return actions;
    }
    actions.push({ start, end });
    from = end;
  }
}

/** Two private-use characters the text does not already contain. */
function tokenMarks(text: string): [string, string] {
  for (let code = 0xe000; code < 0xf8ff; code += 2) {
    const open = String.fromCharCode(code);
    const close = String.fromCharCode(code + 1);
    if (!text.includes(open) && !text.includes(close)) {
      return [open, close];
    }
  }
  throw new Error("Metin, Go aksiyonlarını saklamaya yetecek boş karakter bırakmıyor.");
}

/** A text with each Go action swapped for a token, and the way to put them back. */
export interface MaskedActions {
  masked: string;
  /** A transformation's output with every token turned back into its action, byte for byte. */
  unmask(output: string): string;
}

/**
 * Each action swapped for a token of private-use characters and digits, which
 * no formatter or converter breaks, re-spaces, re-cases or decodes. The same
 * action text gets the same token, so a link whose text is its own address
 * still reads once.
 */
export function maskGoActions(text: string): MaskedActions {
  const actions = findActions(text);
  if (actions.length === 0) {
    return { masked: text, unmask: (output) => output };
  }

  const [open, close] = tokenMarks(text);
  const distinct: string[] = [];
  let masked = "";
  let copied = 0;
  for (const { start, end } of actions) {
    const action = text.slice(start, end);
    let index = distinct.indexOf(action);
    if (index === -1) {
      index = distinct.push(action) - 1;
    }
    masked += `${text.slice(copied, start)}${open}${index}${close}`;
    copied = end;
  }
  masked += text.slice(copied);

  const token = new RegExp(`${open}(\\d+)${close}`, "g");
  return { masked, unmask: (output) => output.replace(token, (_token, index: string) => distinct[Number(index)]) };
}

/**
 * Applies a transformation that must not touch a Go action — html-to-text
 * upper-cases headings, collapses whitespace and decodes entities, and any of
 * those turns an action into one the mailer cannot parse. The actions are
 * masked while it runs (maskGoActions) and put back afterwards byte for byte.
 */
export function preservingGoActions(text: string, transform: (masked: string) => string): string {
  const { masked, unmask } = maskGoActions(text);
  return unmask(transform(masked));
}

/** What is between the delimiters, trim markers dropped; null for a comment. */
export function actionInside(action: string): string | null {
  let inside = action.slice(OPEN.length, -CLOSE.length);
  if (/^-\s/.test(inside)) {
    inside = inside.slice(1);
  }
  if (/\s-$/.test(inside)) {
    inside = inside.slice(0, -1);
  }
  inside = inside.trim();
  return inside.startsWith("/*") ? null : inside;
}

/** Strings and characters emptied, so a ".Name" inside one is not read as a field. */
export const blankLiterals = (code: string) => code.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`[^`]*`/g, '""');

const KEYWORDS = new Set(["if", "else", "end", "range", "with", "define", "block", "template", "break", "continue"]);

export function splitKeyword(code: string): [keyword: string, rest: string] {
  const match = /^([a-z]+)(?![\w.])\s*([\s\S]*)$/.exec(code);
  return match && KEYWORDS.has(match[1]) ? [match[1], match[2]] : ["", code];
}

/**
 * `.Name` where dot is the mailer's data, and `$.Name` where `$` is. Only the
 * first field of a chain counts, and a field of a variable (`$event.Title`) or
 * of a call's result (`(index .M 0).Name`) does not.
 */
const FIELD = /(?<![\p{L}\p{N}_$)\].])(\$?)\.([\p{L}_][\p{L}\p{N}_]*)/gu;

interface Scope {
  /** Whether dot is the mailer's data here; range and with rebind it. */
  dot: boolean;
  /** Whether `$` is; a define's body gets its data from whoever calls it. */
  dollar: boolean;
}

interface Frame extends Scope {
  outer: Scope;
}

/**
 * The fields of the mailer's data a body references, each once, sorted: the
 * client's view, for the preview's sample values and the Required variable
 * panel. The server parses the body as a Go template when it checks Required
 * variables (ticket 08), and that check is the one that counts; the two are
 * held to the same cases, testdata/referenced-variables.json. Here:
 *
 *  - only fields count, not functions (`{{now}}`) or a bare `{{.}}`;
 *  - inside `range` and `with`, `.X` is a field of the element, not a variable,
 *    while `$.X` still is; their `else` branch runs with the outer dot again;
 *  - nothing inside a `define` body counts, neither `.X` nor `$.X`: whoever
 *    calls the template decides its data. A `block` body is read the same
 *    way, unless the block is given `.` itself, when it reads like the text
 *    around it;
 *  - an action inside an HTML comment counts for nothing: the mailer's
 *    html/template leaves the comment, and what its actions print, out of the
 *    mail. It still opens and closes its block (see htmlCommentFlags);
 *  - an action React escaped (a `"` written as `&quot;`) is read as written,
 *    which is also how the mailer would fail to parse it.
 */
export function referencedVariables(text: string): string[] {
  const found = new Set<string>();
  const frames: Frame[] = [];
  const top: Scope = { dot: true, dollar: true };
  const current = (): Scope => frames.at(-1) ?? top;
  let commented = false;

  const collect = (code: string, scope: Scope) => {
    if (commented) {
      return;
    }
    for (const [, dollar, name] of code.matchAll(FIELD)) {
      if (dollar ? scope.dollar : scope.dot) {
        found.add(name);
      }
    }
  };

  const actions = findActions(text);
  const inComment = htmlCommentFlags(text, actions);
  for (const [index, { start, end }] of actions.entries()) {
    commented = inComment[index];
    const inside = actionInside(text.slice(start, end));
    if (inside === null) {
      continue;
    }
    const [keyword, rest] = splitKeyword(blankLiterals(inside));
    const scope = current();

    switch (keyword) {
      case "if":
        collect(rest, scope);
        frames.push({ ...scope, outer: scope });
        break;
      case "range":
      case "with":
        collect(rest, scope);
        frames.push({ dot: false, dollar: scope.dollar, outer: scope });
        break;
      case "define":
        frames.push({ dot: false, dollar: false, outer: scope });
        break;
      case "block": {
        collect(rest, scope);
        const givenDot = /^""\s+\.$/.test(rest.trim());
        frames.push({ dot: givenDot && scope.dot, dollar: givenDot && scope.dot, outer: scope });
        break;
      }
      case "else": {
        const frame = frames.at(-1);
        if (!frame) {
          break;
        }
        const [branch, condition] = splitKeyword(rest);
        collect(condition, frame.outer);
        frame.dot = branch === "with" ? false : frame.outer.dot;
        break;
      }
      case "end":
        frames.pop();
        break;
      default:
        // A plain pipeline, or template/break/continue.
        collect(rest, scope);
    }
  }

  return [...found].sort();
}

const COMMENT_START = "<!--";
const COMMENT_END = "-->";

/**
 * Whether each action stands inside an HTML comment, the way html/template
 * reads one in text: `<!--` opens it and the next `-->` after that closes it,
 * across actions if need be. Only the text between actions is read, so a
 * `<!--` in an action's string opens nothing. html/template does not read
 * `<!--` as a comment inside a tag, a <script> or a <style>; taking one there
 * for a comment only makes a reference not count, never a missing one count.
 * skymail-backend reads comments the same way (internal/mailer/variables.go).
 */
function htmlCommentFlags(text: string, actions: Action[]): boolean[] {
  const flags: boolean[] = [];
  let open = false;
  let from = 0;
  for (const { start, end } of actions) {
    const between = text.slice(from, start);
    let at = 0;
    for (;;) {
      const next = between.indexOf(open ? COMMENT_END : COMMENT_START, at);
      if (next === -1) {
        break;
      }
      at = next + (open ? COMMENT_END.length : COMMENT_START.length);
      open = !open;
    }
    flags.push(open);
    from = end;
  }
  return flags;
}

const OPENS_BLOCK = new Set(["if", "range", "with", "define", "block"]);

/** How many blocks the actions open and how many `end`s close them; equal when balanced. */
export function blockBalance(text: string): { opens: number; ends: number } {
  let opens = 0;
  let ends = 0;
  for (const { start, end } of findActions(text)) {
    const inside = actionInside(text.slice(start, end));
    if (inside === null) {
      continue;
    }
    const [keyword] = splitKeyword(blankLiterals(inside));
    if (OPENS_BLOCK.has(keyword)) {
      opens += 1;
    } else if (keyword === "end") {
      ends += 1;
    }
  }
  return { opens, ends };
}
