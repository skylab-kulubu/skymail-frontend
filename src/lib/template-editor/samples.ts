/**
 * Sample values for the editor's preview, so a template is judged the way a
 * recipient reads it rather than with its `{{.placeholders}}`.
 *
 * A template kept in the repo declares realistic ones in its file's
 * `meta.sample` (emails/types.ts), found here by Template key; the operator
 * can type others, and a variable with neither shows as «Name». Only the
 * preview uses them: nothing here is saved or sent.
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

/** The values for `names`: typed first, then the repo's; a name with neither is left out. */
export function sampleValues(
  names: readonly string[],
  repo: SampleValues,
  typed: Readonly<Record<string, string>>,
): SampleValues {
  const values: SampleValues = {};
  for (const name of names) {
    if (Object.hasOwn(typed, name)) values[name] = typed[name];
    else if (Object.hasOwn(repo, name)) values[name] = repo[name];
  }
  return values;
}
