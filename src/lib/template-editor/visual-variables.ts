/**
 * The variables the Visual editor offers to insert, for a button's link or as
 * a section's condition: the template's Required variables (the contract's
 * and the ones operators marked), and every one it already references — in
 * the stored body, in the render of each source in hand, and in the subject.
 * Each once, sorted. The editor adds the ones its own document uses; any
 * other name can still be typed.
 */
import { referencedVariables } from "../mail-render/go-template";
import type { MailTemplate } from "../templates";
import type { Renders } from "./editor-state";

export function offeredVariables(
  template: Pick<MailTemplate, "contract_required_variables" | "operator_required_variables">,
  referencedIn: Readonly<{ storedHtml: string; renders: Renders; subject: string }>,
): string[] {
  const names = new Set<string>([
    ...(template.contract_required_variables ?? []).map(({ name }) => name),
    ...(template.operator_required_variables ?? []),
    ...referencedVariables(referencedIn.storedHtml),
    ...referencedVariables(referencedIn.subject),
  ]);
  for (const render of Object.values(referencedIn.renders)) {
    if (render?.ok) for (const name of render.variables) names.add(name);
  }
  return [...names].sort();
}
