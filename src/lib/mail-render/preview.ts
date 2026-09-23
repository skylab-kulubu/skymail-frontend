/**
 * Previews only: a stored body, or a subject, with sample values in place of
 * its Go actions, so a template is judged the way a recipient reads it. The
 * result is shown and never saved or sent.
 *
 * It reads the actions the club's templates use, found by the same scanner
 * the rest of the module uses, and is not the mailer:
 *
 *  - `.X` and `$.X` become the sample value, HTML-escaped as html/template
 *    would, or «X» when there is none; `safeHTML .X` goes in as markup;
 *  - `if` with a single field, `not` a single field or an `eq` against
 *    literals shows the branch the sample values select, `else if` and `else`
 *    included; any other condition shows as true;
 *  - an action holding only a literal prints it (the Visual editor writes
 *    braces an operator typed as {{`{{`}});
 *  - `range`, `with`, `define` and `block` stay as written, with everything
 *    inside them, since their dot is not the sample data;
 *  - comments go, trim markers trim, and any other action stays as written.
 */
import { actionInside, findActions, splitKeyword } from "./go-template";

/** Sample values by field name, as a template's `meta.sample` holds them. */
export type SampleValues = Record<string, unknown>;

export interface FillOptions {
  /** "html" escapes values for a body; "text" is for a subject shown as text. */
  as?: "html" | "text";
}

type Frame =
  /** An if: whether its current branch shows, and whether a branch already has. */
  | { kind: "if"; outer: boolean; shown: boolean; decided: boolean }
  /** A block whose inside is copied as written. */
  | { kind: "verbatim"; shown: boolean };

const NAME = String.raw`[\p{L}_][\p{L}\p{N}_]*`;
const ONLY_FIELD = new RegExp(String.raw`^\$?\.(${NAME})$`, "u");
const SAFE_HTML = new RegExp(String.raw`^safeHTML\s+\$?\.(${NAME})$`, "u");
const NOT_FIELD = new RegExp(String.raw`^not\s+\$?\.(${NAME})$`, "u");
const EQ = new RegExp(String.raw`^eq\s+\$?\.(${NAME})\s+([\s\S]+)$`, "u");
const LITERAL = /"(?:[^"\\\n]|\\.)*"|`[^`]*`|[+-]?\d+(?:\.\d+)?/gy;

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Go's truth: false, 0, nil and empty strings, lists and maps are false. */
function truthy(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value !== null && typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return Boolean(value);
}

/** The literals after `eq .X`, or null when they are not all plain strings or numbers. */
function literals(text: string): string[] | null {
  const found: string[] = [];
  let rest = text.trim();
  while (rest !== "") {
    LITERAL.lastIndex = 0;
    const match = LITERAL.exec(rest);
    if (!match) {
      return null;
    }
    const literal = match[0];
    found.push(literal.startsWith('"') ? (JSON.parse(literal) as string) : literal.startsWith("`") ? literal.slice(1, -1) : literal);
    rest = rest.slice(literal.length).trimStart();
  }
  return found.length > 0 ? found : null;
}

function holds(condition: string, sample: SampleValues): boolean {
  const field = ONLY_FIELD.exec(condition);
  if (field) {
    return truthy(sample[field[1]]);
  }
  const not = NOT_FIELD.exec(condition);
  if (not) {
    return !truthy(sample[not[1]]);
  }
  const eq = EQ.exec(condition);
  const candidates = eq ? literals(eq[2]) : null;
  if (eq && candidates) {
    const value = sample[eq[1]];
    return value !== undefined && value !== null && candidates.includes(String(value));
  }
  return true;
}

export function fillSampleValues(body: string, sample: SampleValues, { as = "html" }: FillOptions = {}): string {
  const frames: Frame[] = [];
  const shown = () => frames.at(-1)?.shown ?? true;
  const verbatim = () => frames.some((frame) => frame.kind === "verbatim");
  const value = (name: string) =>
    sample[name] === undefined || sample[name] === null ? `«${name}»` : String(sample[name]);

  /** What an action leaves in the preview, and whether its trim markers apply. */
  function evaluate(action: string): { emit: string; trims: boolean } {
    const inside = actionInside(action);
    const [keyword, rest] = inside === null ? ["", ""] : splitKeyword(inside);

    if (verbatim()) {
      const visible = shown();
      if (["if", "range", "with", "define", "block"].includes(keyword)) {
        frames.push({ kind: "verbatim", shown: visible });
      } else if (keyword === "end") {
        frames.pop();
      }
      return { emit: visible ? action : "", trims: false };
    }
    if (inside === null) {
      return { emit: "", trims: true };
    }

    switch (keyword) {
      case "if": {
        const outer = shown();
        const holdsNow = outer && holds(rest, sample);
        frames.push({ kind: "if", outer, shown: holdsNow, decided: holdsNow });
        return { emit: "", trims: true };
      }
      case "else": {
        const frame = frames.at(-1);
        if (frame?.kind === "if") {
          const [branch, condition] = splitKeyword(rest);
          const holdsNow = !frame.decided && frame.outer && (branch === "if" ? holds(condition, sample) : true);
          frame.shown = holdsNow;
          frame.decided ||= holdsNow;
        }
        return { emit: "", trims: true };
      }
      case "end":
        frames.pop();
        return { emit: "", trims: true };
      case "range":
      case "with":
      case "define":
      case "block": {
        const visible = shown();
        frames.push({ kind: "verbatim", shown: visible });
        return { emit: visible ? action : "", trims: false };
      }
    }

    if (!shown()) {
      return { emit: "", trims: true };
    }
    const field = ONLY_FIELD.exec(inside);
    if (field) {
      const text = value(field[1]);
      return { emit: as === "html" ? escapeHtml(text) : text, trims: true };
    }
    const printed = literals(inside);
    if (printed?.length === 1) {
      return { emit: as === "html" ? escapeHtml(printed[0]) : printed[0], trims: true };
    }
    const safe = SAFE_HTML.exec(inside);
    if (safe) {
      return { emit: String(sample[safe[1]] ?? ""), trims: true };
    }
    return { emit: action, trims: false };
  }

  let filled = "";
  let copied = 0;
  let trimNext = false;
  for (const { start, end } of findActions(body)) {
    const action = body.slice(start, end);
    let text = body.slice(copied, start);
    const visible = shown();
    const { emit, trims } = evaluate(action);

    if (trimNext) {
      text = text.trimStart();
    }
    if (trims && /^\{\{-\s/.test(action)) {
      text = text.trimEnd();
    }
    filled += (visible ? text : "") + emit;
    trimNext = trims && /\s-\}\}$/.test(action);
    copied = end;
  }
  const tail = body.slice(copied);
  return filled + (shown() ? (trimNext ? tail.trimStart() : tail) : "");
}
