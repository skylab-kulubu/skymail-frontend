/**
 * What an approval action that failed says (ticket 20), for each refusal the
 * API names (ticket 19, `mail_approval.*`): in plain Turkish, with what to do
 * next, and whether the page reads the request again. A refusal meaning the
 * request moved under the viewer — someone else acting on it, a change, an
 * expiry, another state, a template published again — is followed by the
 * request as it is now; so is an answer that never came, since the action
 * may have gone through.
 *
 * A submission to people (ticket 21) is refused with the roles it lacks
 * (403 `params.missing_roles`) or, in a 400, with what is wrong with each
 * person (`recipients[i].email`). The form puts that on the person's row
 * and keeps it there while the row still has the address refused.
 */
import { ROLE } from "../access";
import { asApiError, type ApiError } from "../api/errors";
import { EMAIL_MISSING, repeatedAddress, sentRowIndexes, type PeopleCheck, type PersonRow, type RowProblems } from "../send-form/audience";
import { APPROVAL_PEOPLE_LIMIT, APPROVAL_STATE_LABEL, type ApprovalState } from "./approvals";

export type ApprovalActionName =
  | "submit"
  | "resubmit"
  | "approve"
  | "approveEdited"
  | "return"
  | "reject"
  | "accept"
  | "decline";

export type ApprovalRefusal = Readonly<{ text: string; reload: boolean }>;

const APPROVER_ACTIONS: readonly ApprovalActionName[] = ["approve", "approveEdited", "return", "reject"];
const SUBMISSIONS: readonly ApprovalActionName[] = ["submit", "resubmit"];

function missingVariables(error: ApiError): string {
  const missing = error.params?.missing;
  if (!Array.isArray(missing)) return "";
  return missing
    .filter((entry): entry is { name: string; reason?: unknown } => typeof entry?.name === "string")
    .map((entry) => (typeof entry.reason === "string" && entry.reason.trim() ? `${entry.name} (${entry.reason.trim()})` : entry.name))
    .join(", ");
}

function stateLabel(error: ApiError): string | null {
  const state = error.params?.state;
  return typeof state === "string" && Object.hasOwn(APPROVAL_STATE_LABEL, state) ? APPROVAL_STATE_LABEL[state as ApprovalState] : null;
}

/** The roles a refused submission lacks, as the API names them. */
function missingRoles(error: ApiError): string[] {
  const roles = error.params?.missing_roles;
  return Array.isArray(roles) ? roles.filter((role): role is string => typeof role === "string" && role !== "") : [];
}

function forbiddenSubmission(error: ApiError): string {
  const roles = missingRoles(error);
  if (roles.length === 0) return error.message;
  if (roles.length === 1 && roles[0] === ROLE.listsRead) {
    return `Bir mail listesine onaya sunmak için ${ROLE.listsRead} rolü de gerekiyor; kişilere onaya sunabilirsin.`;
  }
  return `Onaya sunmak için ${roles.join(" ve ")} ${roles.length === 1 ? "rolü" : "rolleri"} gerekiyor.`;
}

type FieldError = Readonly<{ field: string; code: string; params?: Readonly<Record<string, unknown>> }>;

function fieldErrors(error: ApiError): FieldError[] {
  const errors = error.params?.errors;
  if (error.code !== "validation.error" || !Array.isArray(errors)) return [];
  return errors.filter((entry): entry is FieldError => typeof entry?.field === "string" && typeof entry?.code === "string");
}

/** `recipients[3].email` → 3. */
function recipientIndex(field: unknown): number | null {
  const match = typeof field === "string" ? /^recipients\[(\d+)\]\.email$/.exec(field) : null;
  return match ? Number(match[1]) : null;
}

/** What a 400 to a submission says of its audience, in words; null when it is about something else. */
function invalidSubmission(error: ApiError): string | null {
  const errors = fieldErrors(error);
  if (errors.some((entry) => recipientIndex(entry.field) !== null)) return "SkyMail bazı adresleri kabul etmedi.";
  const found = (field: string, code: string) => errors.find((entry) => entry.field === field && entry.code === code);
  const tooMany = found("recipients", "max_length");
  if (tooMany) {
    const limit = Number(tooMany.params?.limit) || APPROVAL_PEOPLE_LIMIT;
    return `Onaya en çok ${limit} kişi sunulur; daha kalabalık bir gönderim bir mail listesine gider.`;
  }
  if (found("recipients", "duplicate")) {
    return "SkyMail aynı adresi iki kez buldu; büyük ve küçük harfle yazılmışı da aynı adres sayılır. Her adresi bir kez yaz.";
  }
  if (found("mail_list_id", "exactly_one_of")) return "Onaya ya bir mail listesi ya da kişiler sunulur: birini seç.";
  return null;
}

/** What the API found wrong with an address it was sent; a duplicate names the address it repeats. */
type RefusedAddress = Readonly<{ problem: "missing" }> | Readonly<{ problem: "invalid" }> | Readonly<{ problem: "duplicate"; first: string }>;

/** A refused submission: in words, and — when it named people — what it found, by the address as sent. */
export type SubmissionRefusal = ApprovalRefusal & Readonly<{ addresses: ReadonlyMap<string, RefusedAddress> | null }>;

const address = (row: PersonRow) => row.email.trim();

/**
 * A submission refused, made from the form's rows `rows`: `recipients[i]`
 * is the `i`th row that names someone.
 */
export function submissionRefusal(thrown: unknown, action: "submit" | "resubmit", rows: readonly PersonRow[]): SubmissionRefusal {
  const sent = sentRowIndexes(rows).map((index) => rows[index]);
  const addresses = new Map<string, RefusedAddress>();
  for (const entry of fieldErrors(asApiError(thrown))) {
    const person = sent[recipientIndex(entry.field) ?? -1];
    if (!person) continue;
    const first = sent[recipientIndex(entry.params?.first) ?? -1];
    addresses.set(
      address(person),
      entry.code === "required"
        ? { problem: "missing" }
        : entry.code === "duplicate" && first
          ? { problem: "duplicate", first: address(first) }
          : { problem: "invalid" },
    );
  }
  if (addresses.size === 0) return { ...approvalRefusal(thrown, action), addresses: null };
  return { text: "SkyMail bazı adresleri kabul etmedi: işaretli kişileri düzelt.", reload: false, addresses };
}

/**
 * A refused submission as the form shows it now, its rows `rows`: its words,
 * and what each row still carries — a row keeps what the API found while it
 * has the address refused. Null once every refused address is gone.
 */
export function refusalNow(refusal: SubmissionRefusal, rows: readonly PersonRow[]): { text: string; rows: RowProblems[] | null } | null {
  const { addresses } = refusal;
  if (!addresses) return { text: refusal.text, rows: null };
  const sent = new Set(sentRowIndexes(rows));
  const marks = rows.map((row, index): RowProblems => {
    const found = sent.has(index) ? addresses.get(address(row)) : undefined;
    if (!found) return {};
    if (found.problem === "missing") return { email: EMAIL_MISSING };
    if (found.problem === "invalid") return { email: "SkyMail bu adresi geçerli bir e-posta adresi saymadı." };
    const first = rows.findIndex((other) => address(other) === found.first);
    return { email: first >= 0 ? repeatedAddress(first) : "SkyMail bu adresi başka bir kişininkiyle aynı saydı; herkese bir kez gönderilir." };
  });
  return marks.some((mark) => mark.email) ? { text: refusal.text, rows: marks } : null;
}

/** The rows' problems: the form's own where a row has one, what the API found where it has none. */
export function withRefusedRows(
  check: Pick<PeopleCheck, "rows" | "none"> | null,
  refused: readonly RowProblems[] | null,
): Pick<PeopleCheck, "rows" | "none"> | null {
  if (!refused) return check;
  if (!check) return { rows: [...refused], none: false };
  return { ...check, rows: check.rows.map((row, index) => (row.email ? row : (refused[index] ?? row))) };
}

/** An answer that never came, or a server error: the action may have gone through. */
function unanswered(error: ApiError, action: ApprovalActionName): ApprovalRefusal {
  const cause = error.status === 0 ? "Sunucudan yanıt gelmedi." : `Sunucu bir hatayla yanıt verdi (HTTP ${error.status}).`;
  if (SUBMISSIONS.includes(action)) {
    return { text: `${cause} İstek açılmış olabilir; yeniden sunmadan önce Mail onayları listesine bak.`, reload: false };
  }
  if (action === "approve") {
    return {
      text: `${cause} Onay alınmış ve gönderim açılmış olabilir; istek yeniden yüklendi, durumuna bak. Yeniden onaylamak ikinci bir gönderim açmaz.`,
      reload: true,
    };
  }
  if (action === "approveEdited" || action === "accept") {
    return { text: `${cause} Gönderim açılmış olabilir; istek yeniden yüklendi, durumuna bak.`, reload: true };
  }
  return { text: `${cause} İşlem yapılmış olabilir; istek yeniden yüklendi, durumuna bak.`, reload: true };
}

export function approvalRefusal(thrown: unknown, action: ApprovalActionName): ApprovalRefusal {
  const error = asApiError(thrown);
  const again = (text: string): ApprovalRefusal => ({ text, reload: true });
  const say = (text: string): ApprovalRefusal => ({ text, reload: false });

  switch (error.code) {
    case "mail_approval.template_republished":
      return again(
        action === "accept"
          ? "Bu istek sunulduktan sonra Mail template'in yeni bir sürümü yayımlandı; düzenleme kabul edilirse sunulan mail gitmez. Kabul etme; isteği yeni sürümle yeniden sunabilirsin."
          : "Bu istek sunulduktan sonra Mail template'in yeni bir sürümü yayımlandı; onaylanırsa sunulan mail gitmez. İsteği gerekçesiyle reddet; sunan yeni sürümle yeniden sunabilir.",
      );
    case "mail_approval.busy":
      return again("Şu anda başka biri bu istek üzerinde işlem yapıyor. İstek yeniden yüklendi; son hâline bakıp tekrar dene.");
    case "mail_approval.changed":
      return again("İstek bu işlem hazırlanırken değişti. İstek yeniden yüklendi; son hâline bakıp tekrar dene.");
    case "mail_approval.expired":
      return again("İstek 7 gün içinde karara bağlanmadığı için süresi doldu; artık gönderilmez.");
    case "mail_approval.state_conflict": {
      const label = stateLabel(error);
      return again(label ? `Bu istek artık “${label}” durumunda; bu işlem yapılamaz.` : "Bu istek artık bu işlemin yapılabileceği durumda değil.");
    }
    case "mail_approval.not_submitter":
      return say("Bu işlemi yalnız isteği sunan yapabilir.");
    case "mail_approval.no_edit":
      return say("Düzenleme sunulan değerlerle aynı; sunana geri göndermek için en az bir değişkeni değiştir.");
    case "mail_approval.required_variables_missing": {
      const names = missingVariables(error);
      return say(names ? `Required variable boş bırakılamaz: ${names}.` : "Mail template'in Required variable'larından biri boş.");
    }
    case "mail_approval.unrenderable": {
      const detail = typeof error.params?.error === "string" ? error.params.error : "";
      return say(detail ? `Mail template bu değerlerle işlenemiyor: ${detail}` : "Mail template bu değerlerle işlenemiyor.");
    }
    case "mail_approval.template_unavailable":
      return say("Mail template arşivlenmiş ya da yayımlanmış bir sürümü yok; gönderilemez.");
    case "mail_approval.audience_unavailable":
      return say("Mail listesi arşivlenmiş ya da Keycloak grubu artık yok; gönderilemez.");
    case "mail_approval.audience_empty":
      return say("Mail listesinde gönderilecek kimse yok; gönderilemez.");
  }
  if (error.status === 0 || error.status >= 500) return unanswered(error, action);
  if (error.status === 403) {
    if (SUBMISSIONS.includes(action)) return say(forbiddenSubmission(error));
    return say(APPROVER_ACTIONS.includes(action) ? `Bu işlem için ${ROLE.mailsApprove} rolü gerekiyor.` : error.message);
  }
  if (error.status === 404) return say("İstek bulunamadı: yok ya da görme yetkin yok.");
  if (error.code === "validation.error" && action === "reject") return say("Ret gerekçesi boş olamaz.");
  if (SUBMISSIONS.includes(action)) return say(invalidSubmission(error) ?? error.message);
  return say(error.message);
}
