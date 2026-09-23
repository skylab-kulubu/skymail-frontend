/**
 * Why the API refused a save, a Main source change, a restore or a publish,
 * as the editor shows it: by missing Required variable with why the mail
 * needs it (ticket 08), by the part the mailer could not parse, or else the
 * API error's own sentence.
 */
import { asApiError, apiErrorMessage } from "../api/errors";

/** A Required variable the refused body no longer references, and why the mail needs it. */
export type MissingVariable = Readonly<{ name: string; source: "contract" | "operator"; why: string }>;

/** Why a save, a Main source change or a publish was refused, as the editor shows it. */
export type VersionProblem =
  | { kind: "missing-variables"; message: string; missing: MissingVariable[] }
  | { kind: "unparseable"; message: string; detail: string }
  | { kind: "message"; message: string };

// A Map: the part comes from the answer, and "constructor" must not find what every object inherits.
const PART_LABEL: ReadonlyMap<string, string> = new Map([
  ["subject", "Konu"],
  ["plain_text", "Düz metin"],
  ["html", "HTML gövdesi"],
]);

function missingVariables(value: unknown): MissingVariable[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): MissingVariable[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { name, source, reason } = entry as Record<string, unknown>;
    if (typeof name !== "string" || (source !== "contract" && source !== "operator")) return [];
    const why =
      typeof reason === "string" && reason.trim() !== ""
        ? reason
        : source === "contract"
          ? "Gönderen servisin sözleşmesi bu değişkeni istiyor."
          : "Bir operatör bu değişkeni zorunlu işaretledi.";
    return [{ name, source, why }];
  });
}

export function versionProblem(error: unknown): VersionProblem {
  const refusal = asApiError(error);
  if (refusal.code === "template.required_variables_missing") {
    return {
      kind: "missing-variables",
      message: "Gövde, bu template'in Required variable'larından bazılarına artık başvurmuyor.",
      missing: missingVariables(refusal.params?.missing),
    };
  }
  if (refusal.code === "template.unparseable") {
    const part = typeof refusal.params?.part === "string" ? refusal.params.part : "";
    const detail = typeof refusal.params?.error === "string" ? refusal.params.error : "";
    return {
      kind: "unparseable",
      message: `${PART_LABEL.get(part) ?? "Konu ya da gövde"}, mailer'ın okuyabileceği bir Go template değil.`,
      detail,
    };
  }
  return { kind: "message", message: apiErrorMessage(error) };
}
