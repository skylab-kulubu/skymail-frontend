/**
 * The editor's requests to skymail-backend's template routes (tickets 04, 07
 * and 08), and what it makes of their refusals.
 *
 * A save writes a draft (`POST /templates/{id}/drafts`), which sends nothing
 * to anyone; publishing it (`…/versions/{versionId}/publish`) copies it onto
 * the template row, which is what the mailer sends. A draft started before
 * someone else published is stale, and the API refuses to publish it until
 * the operator has seen both versions and names the one they replace.
 */
import type { ApiClient } from "../api/client";
import { asApiError, apiErrorMessage } from "../api/errors";
import type { MailTemplate, TemplateVersion } from "../templates";
import type { CreateBody, DraftBody } from "./editor-state";

export function fetchTemplate(api: ApiClient, id: string, signal?: AbortSignal): Promise<MailTemplate> {
  return api.get<MailTemplate>(`/templates/${id}`, { signal });
}

export function fetchVersion(api: ApiClient, templateId: string, versionId: string, signal?: AbortSignal): Promise<TemplateVersion> {
  return api.get<TemplateVersion>(`/templates/${templateId}/versions/${versionId}`, { signal });
}

/** Creates a template; the API publishes its first version at once. */
export function createTemplate(api: ApiClient, body: CreateBody): Promise<MailTemplate> {
  return api.post<MailTemplate>("/templates", body);
}

/** Writes a draft: 201 with the new version, or 200 with the one it would have repeated. */
export function saveDraft(api: ApiClient, templateId: string, body: DraftBody): Promise<TemplateVersion> {
  return api.post<TemplateVersion>(`/templates/${templateId}/drafts`, body);
}

export function discardDraft(api: ApiClient, templateId: string, versionId: string): Promise<TemplateVersion> {
  return api.post<TemplateVersion>(`/templates/${templateId}/versions/${versionId}/discard`);
}

/** A draft someone else's publish overtook (409 `template.stale_base`). */
export type StaleConflict = Readonly<{
  draftId: string;
  /** What the draft started from. */
  baseVersionId: string | null;
  /** What is sent now: the version a forced publish replaces. */
  publishedVersionId: string | null;
}>;

export type PublishOutcome =
  | { kind: "published"; template: MailTemplate }
  | { kind: "stale"; conflict: StaleConflict };

const idOrNull = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

/**
 * Publishes a draft. `over` is the published version the operator was shown
 * and chose to replace; only a stale draft needs it. If yet another version
 * was published meanwhile, the answer is stale again, naming that one.
 */
export async function publishDraft(
  api: ApiClient,
  templateId: string,
  versionId: string,
  over?: string,
): Promise<PublishOutcome> {
  try {
    const template = await api.post<MailTemplate>(
      `/templates/${templateId}/versions/${versionId}/publish`,
      over === undefined ? undefined : { force: { over_version_id: over } },
    );
    return { kind: "published", template };
  } catch (error) {
    const refusal = asApiError(error);
    if (refusal.code !== "template.stale_base") throw error;
    return {
      kind: "stale",
      conflict: {
        draftId: idOrNull(refusal.params?.version_id) ?? versionId,
        baseVersionId: idOrNull(refusal.params?.base_version_id),
        publishedVersionId: idOrNull(refusal.params?.published_version_id),
      },
    };
  }
}

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
