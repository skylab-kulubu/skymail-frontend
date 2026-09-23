/**
 * Sample values for the editor's preview, so a template is judged the way a
 * recipient reads it rather than with its `{{.placeholders}}`.
 *
 * A template kept in the repo declares realistic ones in its file's
 * `meta.sample` (emails/types.ts), found here by Template key. A common
 * variable — a first name, an e-mail address, a link — gets a realistic
 * guess where there is no file; the operator can type others, kept per
 * template in their own browser, and a variable with none shows as «Name».
 * Only the preview uses them: nothing here is saved or sent.
 */
import type { SampleValues } from "../mail-render/preview";
import { referencedVariables } from "../mail-render/go-template";
import type { TemplateMeta } from "../../../emails/types";

/** The variables a preview asks values for: the body's and the subject's, sorted. */
export function sampleNames(bodyVariables: readonly string[], subject: string): string[] {
  let subjectVariables: string[] = [];
  try {
    subjectVariables = referencedVariables(subject);
  } catch {
    // A subject the scanner cannot read has no variables to ask for.
  }
  return [...new Set([...bodyVariables, ...subjectVariables])].sort();
}

/** The repo file's samples for a Template key; none when the repo has no such template. */
export function repoSample(catalog: readonly { meta: TemplateMeta }[], key: string | null): SampleValues {
  if (!key) return {};
  return catalog.find((template) => template.meta.key === key)?.meta.sample ?? {};
}

// A Map, not an object literal: a variable's name comes from the body, and
// "constructor" must not find what every object inherits.
const COMMON: ReadonlyMap<string, string> = new Map([
  ["firstname", "Ayşe"],
  ["lastname", "Yılmaz"],
  ["fullname", "Ayşe Yılmaz"],
  ["name", "Ayşe Yılmaz"],
  ["username", "ayse"],
  ["email", "ayse.yilmaz@example.com"],
  ["eventname", "GECEKODU 2026"],
  ["eventdate", "12 Nisan 2026"],
  ["eventlocation", "Davutpaşa Kampüsü"],
  ["code", "482913"],
  ["skynumber", "2026-0142"],
]);

/** A realistic value for a variable name the club's mails commonly use; none for the rest. */
export function defaultSample(name: string): string | undefined {
  const key = name.replace(/[_-]/g, "").toLowerCase();
  if (/(url|link|href)$/.test(key)) return "https://yildizskylab.com/ornek";
  return COMMON.get(key);
}

/** The values for `names`: typed first, then the repo's, then a guess; a name with none is left out. */
export function sampleValues(
  names: readonly string[],
  repo: SampleValues,
  typed: Readonly<Record<string, string>>,
): SampleValues {
  const values: SampleValues = {};
  for (const name of names) {
    const guess = defaultSample(name);
    if (Object.hasOwn(typed, name)) values[name] = typed[name];
    else if (Object.hasOwn(repo, name)) values[name] = repo[name];
    else if (guess !== undefined) values[name] = guess;
  }
  return values;
}

/** The part of Web Storage this uses. */
export type SampleStorage = Pick<Storage, "getItem" | "setItem">;

const storageKey = (template: string) => `skymail.template-samples.${template}`;

/**
 * What the operator typed for a template's preview, kept in their browser —
 * a convenience, so a reload does not lose it. Storage that is blocked, or
 * holds anything else, gives nothing.
 */
export function readTypedSamples(storage: SampleStorage, template: string): Record<string, string> {
  try {
    const stored: unknown = JSON.parse(storage.getItem(storageKey(template)) ?? "{}");
    if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return {};
    return Object.fromEntries(Object.entries(stored).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

export function writeTypedSamples(storage: SampleStorage, template: string, typed: Readonly<Record<string, string>>): void {
  try {
    storage.setItem(storageKey(template), JSON.stringify(typed));
  } catch {
    // Blocked or full: the values last for this page only.
  }
}
