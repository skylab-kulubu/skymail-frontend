/**
 * The Required variable panel's rules (ticket 13), over ticket 08's API.
 *
 * A Mail template's Required variables are two sets (CONTEXT.md, Required
 * variable). The sending service's contract declares one beside the Template
 * key; the Template seed writes it and no operator can release it, so the
 * panel shows it locked with the reason the repo gives. Operators mark the
 * other one, and release only what they marked.
 *
 * The server checks every save and publish and refuses one whose HTML body no
 * longer references a Required variable; it is the authority. The panel reads
 * bodies with the same rule (the render module's referencedVariables, held to
 * the server's cases), so it can say beforehand what the server will say:
 *
 *  - an operator may mark only what the published body — the mail being sent —
 *    references: the server refuses anything else, since a Required variable
 *    is a promise about that mail. A variable only the draft references is
 *    named with that explanation, never offered;
 *  - a Required variable the edited body no longer references is warned about
 *    before the save, and one a refused save or publish named is pointed at.
 */
import { asApiError } from "../api/errors";
import { referencedVariables } from "../mail-render/go-template";
import type { ContractRequiredVariable, MailTemplate } from "../templates";
import { mainBody, type EditorState } from "./editor-state";
import { whyRequired, type MissingVariable, type VersionProblem } from "./refusals";

/** A name the server takes for a Required variable (skymail-backend `IsVariableName`). */
export function isVariableName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name);
}

/** A template's Required variables, and what its published body references. */
export type RequiredSets = Readonly<{
  contract: readonly ContractRequiredVariable[];
  operator: readonly string[];
  /** The variables the published body references: the only ones an operator may mark. */
  published: readonly string[];
}>;

/** The variables a body references, or none for a body the client cannot read. */
function variablesOf(html: string): string[] {
  try {
    return referencedVariables(html);
  } catch {
    return [];
  }
}

/** Null from a backend before ticket 08, which has no Required variables to show. */
export function requiredSetsOf(template: MailTemplate): RequiredSets | null {
  const { contract_required_variables: contract, operator_required_variables: operator } = template;
  if (contract === undefined && operator === undefined) return null;
  return { contract: contract ?? [], operator: operator ?? [], published: variablesOf(template.html_content) };
}

/**
 * The sets with what a refused save or publish named and they lack: a
 * variable marked, or taken into the contract, after the editor opened. The
 * refusal says where each comes from and why, so the panel can point at it.
 */
export function withRefusal(sets: RequiredSets, problem: VersionProblem | null): RequiredSets {
  if (problem?.kind !== "missing-variables") return sets;
  const known = new Set([...sets.contract.map((variable) => variable.name), ...sets.operator]);
  const unknown = problem.missing.filter((missing) => !known.has(missing.name));
  if (unknown.length === 0) return sets;
  return {
    ...sets,
    contract: [
      ...sets.contract,
      ...unknown.filter((missing) => missing.source === "contract").map(({ name, why }) => ({ name, reason: why })),
    ],
    operator: [...sets.operator, ...unknown.filter((missing) => missing.source === "operator").map(({ name }) => name)],
  };
}

/**
 * The variables of the body a save would send now: the Main source's render,
 * or the stored body while that source is untouched. Null while it is not
 * known — the edited source has no render of its own yet, or it fails.
 */
export function bodyVariables(state: EditorState): readonly string[] | null {
  const body = mainBody(state);
  return body ? variablesOf(body.html) : null;
}

/**
 * How a Required variable stands against the edited body: `kept` when it
 * references it, `dropped` when it no longer does — a save would be
 * refused — and `refused` when a save or publish the server refused named it
 * and the body does not reference it again yet. With the body not known,
 * only a refusal says anything.
 */
export type RowState = "kept" | "dropped" | "refused";

export type RequiredRow = Readonly<{
  name: string;
  source: MissingVariable["source"];
  /** Why the mail needs it. */
  why: string;
  /** From the sending service's contract: shown locked, never offered for release. */
  locked: boolean;
  /** The viewer may release it here. */
  removable: boolean;
  state: RowState;
}>;

export type RequiredPanel = Readonly<{
  /** The contract's first, then the operators'. */
  rows: readonly RequiredRow[];
  /** What the published body references and is not required yet: what the viewer may mark. */
  candidates: readonly string[];
  /** What only the edited body references: it can be marked once published. */
  draftOnly: readonly string[];
}>;

export function requiredPanel({
  sets,
  body,
  problem = null,
  canWrite,
}: {
  sets: RequiredSets;
  /** The edited body's variables (bodyVariables); null when not known, or nothing is edited. */
  body: readonly string[] | null;
  /** What the last refused save or publish said; the sets know what it named (withRefusal). */
  problem?: VersionProblem | null;
  /** The viewer may mark and release (`templates:write`). */
  canWrite: boolean;
}): RequiredPanel {
  const refused = problem?.kind === "missing-variables" ? problem.missing : [];
  const state = (name: string): RowState => {
    if (body?.includes(name)) return "kept";
    if (refused.some((entry) => entry.name === name)) return "refused";
    return body === null ? "kept" : "dropped";
  };
  const row = (name: string, source: RequiredRow["source"], why: string): RequiredRow => ({
    name,
    source,
    why,
    locked: source === "contract",
    removable: canWrite && source === "operator",
    state: state(name),
  });

  const rows = [
    ...sets.contract.map(({ name, reason }) => row(name, "contract", whyRequired("contract", reason))),
    ...sets.operator.map((name) => row(name, "operator", whyRequired("operator", null))),
  ];

  if (!canWrite) return { rows, candidates: [], draftOnly: [] };
  const required = new Set(rows.map((known) => known.name));
  const markable = (name: string) => !required.has(name) && isVariableName(name);
  return {
    rows,
    candidates: sets.published.filter(markable),
    draftOnly: (body ?? []).filter((name) => markable(name) && !sets.published.includes(name)),
  };
}

/** What the panel says when marking or releasing `name` failed. */
export function requiredVariableProblem(error: unknown, name: string): string {
  const refusal = asApiError(error);
  const variable = `{{.${name}}}`;
  switch (refusal.code) {
    // Marking one the published body does not reference.
    case "template.required_variables_missing":
      return `${variable} gönderilen mailde geçmiyor. SkyMail yalnız yayımlanmış gövdenin başvurduğu değişkeni zorunlu işaretler; ona başvuran taslağı yayımladıktan sonra işaretleyebilirsin.`;
    case "template.unparseable":
      return "Gönderilen gövde mailer'ın okuyabileceği bir Go template değil; SkyMail değişkenlerini okuyamadığı için zorunlu işaretleyemiyor.";
    // Releasing one the contract took over since the panel was loaded.
    case "template.required_variable_in_contract":
      return `${variable} gönderen servisin sözleşmesinde; panelden çıkarılamaz.`;
    default:
      return refusal.message;
  }
}
