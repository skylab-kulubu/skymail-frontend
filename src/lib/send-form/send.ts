/**
 * A send, as skymail-backend takes it (internal/requests/mail.go and
 * internal/handlers/mail.go, unchanged by the rewrite):
 *
 *  - to a mailing list — an internal list or a Keycloak group —
 *    `POST /mail_tasks {template_id, mail_list_id, body_variables}`, one send;
 *  - to people, `POST /mail_tasks/single {template_id, recipient_email,
 *    recipient_full_name, body_variables, tracking?}` once per person: there is no
 *    route for a set of people, so each is a send of its own, and one that
 *    fails does not stop the others.
 *
 * A free announcement is free.basic sent the same way, its body the Visual
 * editor's render (free-body.ts). Only the template row's published copy is
 * ever sent (ticket 04); a draft in progress is said to stay unsent.
 *
 * A failed send is said plainly and never mails anyone twice by accident. A
 * refusal (403, 404, 400, 422…) is final: trying again gets the same answer.
 * A request the server never took (401, 429) may be tried again. A server
 * error or no answer at all means the send may already be open — the API
 * may have queued it before failing — so it is said so, and sending again
 * takes a confirmation that names who may get the mail twice.
 */
import type { ApiClient } from "../api/client";
import type { FormSource } from "../form-mail-source";
import { ApiError, apiErrorMessage, asApiError } from "../api/errors";
import { fetchList, fetchRecipientPage, isInternal, toListRow, type ListRow, type MailingList } from "../mailing-lists";
import { authorName, fetchTemplate, type MailTemplate } from "../templates";
import { peopleProblems, peopleReady, type PeopleCheck, type PersonRow } from "./audience";
import { formatCount } from "../sends";
import { bodyVariables, fieldValues, fieldWarnings, usesRecipientName, variableFields, withRecipientName, type FieldInput, type VariableField } from "./fields";
import { CATEGORY_REFUSALS, PURPOSE_REFUSALS, type PurposeFields } from "./purpose";

/** The Template key of the free-form template a free announcement is sent with. */
export const FREE_TEMPLATE_KEY = "free.basic";

/** free.basic's body: a free announcement without one is warned about. */
export const FREE_BODY_VARIABLE = "BodyHtml";

export type ListSendRequest = {
  template_id: string;
  mail_list_id: string;
  body_variables: Record<string, string>;
  /** Open and click tracking (tracking.ts); present only when asked for. */
  tracking?: boolean;
} & Partial<PurposeFields>;

/** `POST /mail_tasks`'s answer: the new send, and whether it got the tracking it asked for (absent from a backend before tracking). */
export type CreatedSend = Readonly<{ id: string; tracking?: boolean }>;
export type FormSourceSendRequest = { template_id: string; form_source_id: string; body_variables: Record<string, string> } & Partial<PurposeFields>;

export type SingleSendRequest = {
  template_id: string;
  recipient_email: string;
  recipient_full_name: string;
  body_variables: Record<string, string>;
  /** Open and click tracking (tracking.ts); present only when asked for. */
  tracking?: boolean;
} & Partial<PurposeFields>;

/** The list a send goes to, as the form knows it. */
export type ChosenList = Pick<ListRow, "id" | "name" | "external">;

/** Everything the form holds when the sender asks to send. */
export type SendDraft = Readonly<{
  /** A Mail template, or a free announcement (free.basic). */
  what: "template" | "free";
  /** The template chosen, or free.basic for a free announcement; null when there is none. */
  template: MailTemplate | null;
  fields: FieldInput;
  audience: "list" | "people" | "form";
  formSource?: FormSource | null;
  list: ChosenList | null;
  people: readonly PersonRow[];
  /** Open and click tracking: true when the form offered its box (tracking.ts trackingOffered) and it is ticked, or while SkyMail tracks every send (trackingAsked). A list or people send asks for it. */
  tracking?: boolean;
  /** The purpose and category the send carries (purpose.ts); none while the backend takes no purpose. */
  purpose?: PurposeFields | null;
}>;

export type SendPlan = { kind: "list"; request: ListSendRequest } | { kind: "people"; requests: SingleSendRequest[] } | { kind: "form"; request: FormSourceSendRequest; source: FormSource };

/** What keeps a draft from going out, by part of the form. */
export type SendProblems = Readonly<{
  template: string | null;
  list: string | null;
  /** Null unless the audience is people. */
  people: PeopleCheck | null;
  fields: Readonly<Record<string, string>>;
}>;

/** What may be a slip but goes if the sender wants: by field, by person row, and all of it in words for the confirmation. */
export type SendWarnings = Readonly<{
  fields: Readonly<Record<string, string>>;
  people: readonly (string | null)[];
  lines: readonly string[];
}>;

/** Said when a mail that greets its recipient by name goes to a Forms audience with respondents who gave none. */
export const unnamedRespondents = (count: number) =>
  `Forms kaynağında ${formatCount(count)} yanıtlayanın adı yok: alıcının adı yerine yedek metin gider, yedek yoksa boş kalır.`;

export const NO_FREE_TEMPLATE = `Serbest duyuru template'i (${FREE_TEMPLATE_KEY}) SkyMail'de yok ya da arşivlenmiş; serbest duyuru gönderilemez.`;

/** The requests a draft sends, or what keeps it from going out; and either way, what may be a slip in it. */
export function sendPlan(
  draft: SendDraft,
): { ok: true; plan: SendPlan; warnings: SendWarnings } | { ok: false; problems: SendProblems; warnings: SendWarnings } {
  const { template } = draft;
  const fields = template ? variableFields(template) : [];
  const templateProblem = template ? null : draft.what === "free" ? NO_FREE_TEMPLATE : "Gönderilecek Mail template'i seç.";
  const listProblem = draft.audience === "list" && !draft.list ? "Gönderilecek mail listesini seç." : null;
  const nameExpected = template ? usesRecipientName(template, { fields, values: fieldValues(fields, draft.fields) }) : false;
  const people = draft.audience === "people" ? peopleProblems(draft.people, { nameExpected }) : null;
  const variables = template ? bodyVariables(fields, draft.fields) : null;

  const fieldWarned = fieldWarnings(fields, draft.fields, { expected: draft.what === "free" ? [FREE_BODY_VARIABLE] : [] });
  const peopleWarned = people?.warnings ?? [];
  const unnamed = draft.audience === "form" && nameExpected ? (draft.formSource?.unnamed_count ?? 0) : 0;
  const warnings: SendWarnings = {
    fields: fieldWarned,
    people: peopleWarned,
    lines: [
      ...fields.flatMap((field) => (fieldWarned[field.name] ? [`${field.label}: ${fieldWarned[field.name]}`] : [])),
      ...peopleWarned.flatMap((warning, index) => (warning ? [`${index + 1}. kişi (${draft.people[index].email.trim()}): ${warning}`] : [])),
      ...(unnamed > 0 ? [unnamedRespondents(unnamed)] : []),
    ],
  };

  const sourceProblem = draft.audience === "form" && !draft.formSource ? "Forms kaynağı kullanılamıyor. Forms'tan yeniden hazırla." : null;
  if (!template || !variables?.ok || listProblem || sourceProblem || (people && !peopleReady(people))) {
    return {
      ok: false,
      problems: { template: templateProblem, list: listProblem ?? sourceProblem, people, fields: variables && !variables.ok ? variables.problems : {} },
      warnings,
    };
  }
  const body_variables = variables.variables;
  const purpose = draft.purpose ?? {};
  if (draft.audience === "form") return {
    ok: true, plan: { kind: "form", source: draft.formSource!, request: { template_id: template.id, form_source_id: draft.formSource!.id, body_variables, ...purpose } }, warnings,
  };
  if (draft.audience === "list") {
    return {
      ok: true,
      plan: {
        kind: "list",
        request: { template_id: template.id, mail_list_id: draft.list!.id, body_variables, ...(draft.tracking ? { tracking: true } : {}), ...purpose },
      },
      warnings,
    };
  }
  return {
    ok: true,
    plan: {
      kind: "people",
      requests: people!.people.map((person) => ({
        template_id: template.id,
        recipient_email: person.email,
        recipient_full_name: person.name,
        body_variables,
        ...(draft.tracking ? { tracking: true } : {}),
        ...purpose,
      })),
    },
    warnings,
  };
}

/** Sends to a list; the new send's id, and whether it is tracked. */
export async function sendToList(api: ApiClient, request: ListSendRequest): Promise<CreatedSend> {
  const { id, tracking } = await api.post<CreatedSend>("/mail_tasks", request);
  return { id, tracking };
}

/** One bulk task using the server's immutable snapshot; an exact retry returns the same task. */
export async function sendToFormSource(api: ApiClient, request: FormSourceSendRequest): Promise<string> {
  const { id } = await api.post<{ id: string }>("/mail_tasks/form-source", request);
  return id;
}

/**
 * How a failed send stands: `final` — refused, and trying again gets the
 * same answer; `notSent` — the server never took it, so trying again is
 * safe; `uncertain` — a server error or no answer, so it may already be open.
 */
export type FailureKind = "final" | "notSent" | "uncertain";

/** `code`: the API's, when it named one (the form puts a category's refusal under the category). */
export type SendFailure = Readonly<{ kind: FailureKind; reason: string; code?: string }>;

/** How a send to one person went; a sent one says whether it got the tracking it asked for (absent from a backend before tracking). */
export type PersonOutcome = Readonly<
  { name: string; email: string } & ({ status: "sent"; sendId: string; tracking?: boolean } | { status: FailureKind; reason: string; code?: string })
>;

/** Who the send's outcome can be checked by: the viewer, if they read sends (`mails:read`). */
export type Checking = Readonly<{ canSeeSends: boolean }>;

/**
 * Sends to each person in turn, going on past a failure: each is a send of
 * its own, and the ones before a failure have already gone. `onEach` hears
 * how many are done.
 */
export async function sendToPeople(
  api: ApiClient,
  requests: readonly SingleSendRequest[],
  { canSeeSends, onEach }: Checking & { onEach?: (done: number) => void },
): Promise<PersonOutcome[]> {
  const outcomes: PersonOutcome[] = [];
  for (const request of requests) {
    const person = { name: request.recipient_full_name, email: request.recipient_email };
    try {
      const { id, tracking } = await api.post<CreatedSend>("/mail_tasks/single", request);
      outcomes.push({ ...person, status: "sent", sendId: id, ...(tracking === undefined ? {} : { tracking }) });
    } catch (error) {
      const failure = sendFailure(error, "person", { canSeeSends });
      outcomes.push({ ...person, status: failure.kind, reason: failure.reason, ...(failure.code ? { code: failure.code } : {}) });
      // The category is every person's: refused for the first, it is refused for all, and nobody has been sent to.
      if (outcomes.length === 1 && failure.code && CATEGORY_REFUSALS.has(failure.code)) return outcomes;
    }
    onEach?.(outcomes.length);
  }
  return outcomes;
}

/** A send to people the category kept from going: refused for the first person, nobody sent to. */
export function categoryRefused(outcomes: readonly PersonOutcome[]): SendFailure | null {
  const [first] = outcomes;
  if (outcomes.length !== 1 || !first || first.status === "sent" || !first.code || !CATEGORY_REFUSALS.has(first.code)) return null;
  return { kind: first.status, reason: first.reason, code: first.code };
}

/** Who a retry would send to: the ones who have not got the mail for sure — never a refusal — and who of them may get it twice. */
export type Retry = Readonly<{
  requests: readonly SingleSendRequest[];
  /** The send may already be open for them: sending again may mail them twice. */
  uncertain: readonly PersonRow[];
  /** The server never took their send. */
  notSent: readonly PersonRow[];
}>;

export function retryOf(requests: readonly SingleSendRequest[], outcomes: readonly PersonOutcome[]): Retry {
  const who = (status: FailureKind) =>
    outcomes.filter((outcome) => outcome.status === status).map(({ name, email }) => ({ name, email }));
  const again = new Set(outcomes.filter((outcome) => outcome.status === "uncertain" || outcome.status === "notSent").map((outcome) => outcome.email));
  return {
    requests: requests.filter((request) => again.has(request.recipient_email)),
    uncertain: who("uncertain"),
    notSent: who("notSent"),
  };
}

/** The outcomes, each person's latest in place of the one before. */
export function mergeOutcomes(previous: readonly PersonOutcome[], again: readonly PersonOutcome[]): PersonOutcome[] {
  return previous.map((outcome) => again.find((next) => next.email === outcome.email) ?? outcome);
}

/** A list send that may already be open: the same template to the same list waits for a confirmed re-send. */
export type UncertainListSend = Readonly<{ templateId: string; listId: string; listName: string }>;

export function repeatsUncertainSend(draft: Pick<SendDraft, "audience" | "template" | "list">, uncertain: UncertainListSend | null): boolean {
  return (
    uncertain !== null &&
    draft.audience === "list" &&
    draft.template?.id === uncertain.templateId &&
    draft.list?.id === uncertain.listId
  );
}

/** How to find out whether a send that may be open is: the send list, or someone who can read it. */
function checkAdvice({ canSeeSends }: Checking): string {
  return canSeeSends
    ? "Yeniden göndermeden önce Gönderimler listesine bak: orada görünüyorsa açılmıştır."
    : "Gönderimleri görme yetkin (skymail:mails:read) yok: yeniden göndermeden önce bu yetkisi olan birine gönderimin açılıp açılmadığını sor.";
}

/** A failed send in plain words, and whether trying again is safe: to a list, or to one person. */
export function sendFailure(error: unknown, to: "list" | "person", checking: Checking): SendFailure {
  const refusal = asApiError(error);
  const { status } = refusal;
  // core's preferences could not be read (ticket 09): nothing was queued, so it may be sent again as it is.
  if (refusal.code === "mail_task.preference_unavailable") return { kind: "notSent", reason: refusal.message, code: refusal.code };
  if (status === 0 || status === 408 || status >= 500) {
    const cause = status === 0 ? "Sunucudan yanıt gelmedi." : `Sunucu bir hatayla yanıt verdi (HTTP ${status}).`;
    const open = to === "list" ? "Gönderim açılmış olabilir." : "Bu kişiye gönderim açılmış olabilir.";
    return { kind: "uncertain", reason: `${cause} ${open} ${checkAdvice(checking)}` };
  }
  if (status === 401) {
    return { kind: "notSent", reason: "Oturumun sona erdi; gönderim açılmadı. Yeniden giriş yapınca tekrar deneyebilirsin." };
  }
  if (status === 429) {
    return { kind: "notSent", reason: "Kısa sürede çok fazla istek gönderildi; gönderim açılmadı. Biraz bekleyip tekrar dene." };
  }
  if (status === 403) {
    return {
      kind: "final",
      reason:
        to === "list"
          ? "Bu hesap bir mail listesine gönderemez: skymail:mails:write rolü gerekiyor."
          : "Bu hesap mail gönderemez: skymail:mails:send ya da skymail:mails:write rolü gerekiyor.",
    };
  }
  if (status === 404) {
    return {
      kind: "final",
      reason:
        to === "list"
          ? "Mail template ya da liste bulunamadı: template arşivlenmiş, liste arşivlenmiş ya da Keycloak grubu boş olabilir."
          : "Mail template arşivlenmiş ya da artık yok; arşivlenmiş bir template gönderilmez.",
    };
  }
  if (refusal.code === "validation.error" && invalidField(refusal) === "recipient_email") {
    return { kind: "final", reason: "SkyMail bu adresi geçerli bir e-posta adresi saymadı." };
  }
  if (PURPOSE_REFUSALS.has(refusal.code)) return { kind: "final", reason: refusal.message, code: refusal.code };
  return { kind: "final", reason: `SkyMail gönderimi reddetti: ${apiErrorMessage(refusal)}` };
}

/** The first field a validation error names (`params.errors[].field`). */
function invalidField(error: ApiError): string | null {
  const errors = error.params?.errors;
  if (!Array.isArray(errors)) return null;
  const first = errors.find((entry): entry is { field: string } => typeof entry?.field === "string");
  return first?.field ?? null;
}

const isNotFound = (error: unknown) => asApiError(error).status === 404;

/**
 * Why a send to a list answered 404, found out by asking for its parts: the
 * template is archived (every read of an archived template answers 404),
 * the list is gone, or a Keycloak group has no members (the API refuses
 * those with 404 too).
 */
export async function whyNotFound(api: ApiClient, { templateId, list }: { templateId: string; list: ChosenList | null }): Promise<string> {
  const fallback = sendFailure(new ApiError(404, "server.not_found"), list ? "list" : "person", { canSeeSends: false }).reason;
  try {
    await fetchTemplate(api, templateId);
  } catch (error) {
    return isNotFound(error)
      ? "Bu Mail template arşivlenmiş; arşivlenmiş bir template gönderilmez. Başka bir template seç ya da template'i geri getir."
      : fallback;
  }
  if (!list) return fallback;
  try {
    await fetchList(api, list.id);
  } catch (error) {
    return isNotFound(error) ? "Bu liste arşivlenmiş ya da artık yok. Başka bir liste seç." : fallback;
  }
  return list.external ? "Keycloak grubunda üye yok; boş bir gruba gönderim açılmaz." : fallback;
}

const PICKER_PAGE = 100;

/** Every current Mail template, a page at a time. */
export async function fetchSendableTemplates(api: ApiClient, signal?: AbortSignal): Promise<MailTemplate[]> {
  const templates: MailTemplate[] = [];
  for (let start = 0; ; start += PICKER_PAGE) {
    const page = await api.getPage<MailTemplate>("/templates", {
      query: { lifecycle: "current", _start: start, _end: start + PICKER_PAGE },
      signal,
    });
    templates.push(...page.items);
    if (page.items.length < PICKER_PAGE) return templates;
  }
}

/** free.basic among the templates, or null when it is not there (not seeded, or archived). */
export function freeTemplate(templates: readonly MailTemplate[]): MailTemplate | null {
  return templates.find((template) => template.key === FREE_TEMPLATE_KEY) ?? null;
}

/** The templates to pick from, by name; free.basic is the free announcement, offered apart. */
export function templateChoices(templates: readonly MailTemplate[]): MailTemplate[] {
  return templates
    .filter((template) => template.key !== FREE_TEMPLATE_KEY)
    .sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));
}

/**
 * Every current list and Keycloak group, internal lists first. The API
 * pages internal lists and appends every group to each page, so a page with
 * fewer internal lists than asked for is the last.
 */
export async function fetchSendableLists(api: ApiClient, signal?: AbortSignal): Promise<ListRow[]> {
  const lists = new Map<string, MailingList>();
  for (let start = 0; ; start += PICKER_PAGE) {
    const page = await api.getPage<MailingList>("/mailing_lists", {
      query: { lifecycle: "current", _start: start, _end: start + PICKER_PAGE },
      signal,
    });
    for (const list of page.items) lists.set(list.id, list);
    if (page.items.filter(isInternal).length < PICKER_PAGE) break;
  }
  const all = [...lists.values()];
  return [...all.filter(isInternal), ...all.filter((list) => !isInternal(list))].map(toListRow);
}

/** How many a list sends to: its recipients, or a group's members (those without an address are skipped by the API). */
export async function audienceSize(api: ApiClient, list: Pick<ListRow, "id" | "external">, signal?: AbortSignal): Promise<number> {
  return (await fetchRecipientPage(api, list, 1, signal)).total;
}

/** Said beside a template with a draft in progress: the draft is not what goes out. */
export function publishedOnlyNote(template: Pick<MailTemplate, "drafts">): string | null {
  const drafts = template.drafts ?? [];
  if (drafts.length === 0) return null;
  const who = drafts.map((draft) => authorName(draft.author)).join(", ");
  return `Bu template'te yayımlanmamış ${drafts.length === 1 ? "bir taslak" : `${drafts.length} taslak`} var (${who}). Gönderilen: yayımlanmış sürüm.`;
}

/** Who the preview reads as when no person is named: the mailer fills these per recipient. */
const SAMPLE_RECIPIENT: PersonRow = { name: "Ayşe Yılmaz", email: "ayse.yilmaz@example.com" };

/**
 * The values the preview fills the published body with: exactly what the
 * send carries — an empty field as nothing — and a recipient, the first
 * person named or a sample one.
 */
export function previewValues(
  variables: Readonly<Record<string, string>>,
  recipient: PersonRow | null,
  fields: readonly VariableField[] = [],
): Record<string, string> {
  const person = recipient ?? SAMPLE_RECIPIENT;
  // The recipient's name tags, filled as the mailer fills them (recipient-name.ts).
  return { ...withRecipientName(fields, variables, person.name), FullName: person.name, Email: person.email };
}
