/**
 * The Required variable panel's rules (ticket 13), over ticket 08's API.
 *
 * A Mail template's Required variables are two sets (CONTEXT.md, Required
 * variable). The sending service's contract declares one beside the Template
 * key; the Template seed writes it and no operator can release it, so the
 * panel shows it locked with the reason the repo gives. Operators mark the
 * other one, and release only what they marked. The sets are always the
 * template's as the API last answered; a refusal only points at them.
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
 *  - a Required variable the body in the editor no longer references is warned
 *    about before the save, and so is marking one; one a refused save or
 *    publish named is pointed at.
 */
import { asApiError } from "../api/errors";
import { isVariableName, referencedVariables, variableAction } from "../mail-render/go-template";
import type { ContractRequiredVariable, MailTemplate } from "../templates";
import { currentRender, isEditableMode, mainBody, type EditorState } from "./editor-state";
import { versionProblem, whyRequired, type MissingVariable, type VersionProblem } from "./refusals";

/** A name the server takes for a Required variable: the render module's one rule. */
export { isVariableName };

/** A template's Required variables, and what its published body references. */
export type RequiredSets = Readonly<{
  contract: readonly ContractRequiredVariable[];
  operator: readonly string[];
  /** The variables the published body references: the only ones an operator may mark. */
  published: readonly string[];
}>;

/** Null from a backend before ticket 08, which has no Required variables to show. */
export function requiredSetsOf(template: MailTemplate): RequiredSets | null {
  const { contract_required_variables: contract, operator_required_variables: operator } = template;
  if (contract === undefined && operator === undefined) return null;
  return { contract: contract ?? [], operator: operator ?? [], published: referencedVariables(template.html_content) };
}

/**
 * Whose body the editor holds: the operator's edit, their saved draft as it
 * is, or the published version they opened, as it is.
 */
export type BodyKind = "edited" | "draft" | "published";

/** The body a save would send now, and the variables it references. */
export type EditorBody = Readonly<{ variables: readonly string[]; kind: BodyKind }>;

/**
 * The Main source's render and the variables the render module found in it,
 * or the stored body while that source is untouched. Null while it is not
 * known: the edited source has no render of its own yet, or it fails.
 */
export function editorBody(state: EditorState): EditorBody | null {
  const { editing, stored } = state;
  const main = editing.mainMode;
  const edited = main !== stored.mainMode || (isEditableMode(main) && editing.sources[main] !== stored.sources[main]);
  const kind: BodyKind = edited ? "edited" : stored.draftId ? "draft" : "published";
  const render = isEditableMode(main) ? currentRender(state, main) : null;
  if (render) return { variables: render.variables, kind };
  const body = mainBody(state);
  return body ? { variables: referencedVariables(body.html), kind } : null;
}

/**
 * How a Required variable stands against the body in the editor: `kept` when
 * it references it, `dropped` when it no longer does — a save or publish
 * would be refused — and `refused` when a save or publish the server refused
 * named it and the body does not reference it again yet. With the body not
 * known, only a refusal says anything.
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

/** A variable the viewer may mark. */
export type Candidate = Readonly<{
  name: string;
  /** The body in the editor does not reference it: marking it would refuse that body. */
  dropped: boolean;
}>;

export type RequiredPanel = Readonly<{
  /** The contract's first, then the operators'. */
  rows: readonly RequiredRow[];
  /** What the published body references and is not required yet. */
  candidates: readonly Candidate[];
  /** What only the body in the editor references: it can be marked once published. */
  draftOnly: readonly string[];
}>;

export function requiredPanel({
  sets,
  body,
  problem = null,
  canWrite,
}: {
  sets: RequiredSets;
  /** The body in the editor (editorBody); null when not known, or nothing is edited. */
  body: EditorBody | null;
  /** What the last refused save or publish said: it points at rows, and adds none. */
  problem?: VersionProblem | null;
  /** The viewer may mark and release (`templates:write`). */
  canWrite: boolean;
}): RequiredPanel {
  const refused = problem?.kind === "missing-variables" ? problem.missing : [];
  const referenced = (name: string) => body === null || body.variables.includes(name);
  const state = (name: string): RowState => {
    if (body?.variables.includes(name)) return "kept";
    if (refused.some((entry) => entry.name === name)) return "refused";
    return body === null ? "kept" : "dropped";
  };
  const row = (name: string, source: RequiredRow["source"], reason: string | null): RequiredRow => ({
    name,
    source,
    why: whyRequired(source, reason),
    locked: source === "contract",
    removable: canWrite && source === "operator",
    state: state(name),
  });
  const rows = [
    ...sets.contract.map(({ name, reason }) => row(name, "contract", reason)),
    ...sets.operator.map((name) => row(name, "operator", null)),
  ];

  if (!canWrite) return { rows, candidates: [], draftOnly: [] };
  const required = new Set(rows.map((known) => known.name));
  const markable = (name: string) => !required.has(name) && isVariableName(name);
  return {
    rows,
    candidates: sets.published.filter(markable).map((name) => ({ name, dropped: !referenced(name) })),
    draftOnly: (body?.variables ?? []).filter((name) => markable(name) && !sets.published.includes(name)),
  };
}

/** What the panel says when marking or releasing failed, and the variables that blocked it, with why. */
export type PanelProblem = Readonly<{ text: string; blockers: readonly MissingVariable[] }>;

const PUBLISH_FIRST =
  "SkyMail yalnız yayımlanmış gövdenin başvurduğu değişkeni zorunlu işaretler; ona başvuran taslağı yayımladıktan sonra işaretleyebilirsin.";

/**
 * Why marking or releasing `name` failed. Marking is refused by what the
 * server names: it checks every Required variable against the published body,
 * the new one included, so another variable may be what blocks it.
 */
export function requiredVariableProblem(error: unknown, name: string): PanelProblem {
  const refusal = asApiError(error);
  const variable = variableAction(name);
  const said = (text: string, blockers: readonly MissingVariable[] = []): PanelProblem => ({ text, blockers });
  switch (refusal.code) {
    case "template.required_variables_missing": {
      const problem = versionProblem(error);
      const missing = problem.kind === "missing-variables" ? problem.missing : [];
      const others = missing.filter((entry) => entry.name !== name);
      if (missing.length > others.length) {
        const text = `${variable} gönderilen mailde geçmiyor. ${PUBLISH_FIRST}`;
        return others.length === 0 ? said(text) : said(`${text} Gönderilen mail şunlara da başvurmuyor:`, others);
      }
      if (others.length > 0) {
        return said(
          `${variable} işaretlenemedi: SkyMail her işaretlemede bütün Required variable'ları gönderilen maile karşı denetler, ve gönderilen mail şunlara başvurmuyor. Önce onlara başvuran bir sürümü yayımla.`,
          others,
        );
      }
      return said(`${variable} işaretlenemedi: gönderilen mail bu template'in Required variable'larının hepsine başvurmuyor.`);
    }
    case "template.unparseable":
      return said(
        "Gönderilen gövde mailer'ın okuyabileceği bir Go template değil; SkyMail değişkenlerini okuyamadığı için zorunlu işaretleyemiyor.",
      );
    // Releasing one the contract took over since the panel was loaded.
    case "template.required_variable_in_contract":
      return said(`${variable} gönderen servisin sözleşmesinde; panelden çıkarılamaz.`);
    default:
      return said(refusal.message);
  }
}
