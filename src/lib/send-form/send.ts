/**
 * A send, as skymail-backend takes it (internal/requests/mail.go and
 * internal/handlers/mail.go, unchanged by the rewrite):
 *
 *  - to a mailing list — an internal list or a Keycloak group —
 *    `POST /mail_tasks {template_id, mail_list_id, body_variables}`, one send;
 *  - to people, `POST /mail_tasks/single {template_id, recipient_email,
 *    recipient_full_name, body_variables}` once per person: there is no
 *    route for a set of people, so each is a send of its own, and one that
 *    fails does not stop the others.
 *
 * A free announcement is free.basic sent the same way, its body the Visual
 * editor's render (free-body.ts). Only the template row's published copy is
 * ever sent (ticket 04); a draft in progress is said to stay unsent.
 * Whatever the API refuses is said in plain words, with what to do next.
 */
import type { ApiClient } from "../api/client";
import { ApiError, apiErrorMessage, asApiError } from "../api/errors";
import { sanitizeLikeServer } from "../mail-render/server-allowlist";
import { fetchList, fetchRecipientPage, isInternal, toListRow, type ListRow, type MailingList } from "../mailing-lists";
import { authorName, fetchTemplate, type MailTemplate } from "../templates";
import { peopleProblems, peopleReady, type PeopleCheck, type PersonRow } from "./audience";
import { bodyVariables, usesRecipientName, variableFields, type FieldInput } from "./fields";

/** The Template key of the free-form template a free announcement is sent with. */
export const FREE_TEMPLATE_KEY = "free.basic";

/** What a free announcement must have beyond free.basic's own fields: a body. */
export const FREE_BODY_VARIABLE = "BodyHtml";

export type ListSendRequest = { template_id: string; mail_list_id: string; body_variables: Record<string, string> };

export type SingleSendRequest = {
  template_id: string;
  recipient_email: string;
  recipient_full_name: string;
  body_variables: Record<string, string>;
};

/** The list a send goes to, as the form knows it. */
export type ChosenList = Pick<ListRow, "id" | "name" | "external">;

/** Everything the form holds when the sender asks to send. */
export type SendDraft = Readonly<{
  /** A Mail template, or a free announcement (free.basic). */
  what: "template" | "free";
  /** The template chosen, or free.basic for a free announcement; null when there is none. */
  template: MailTemplate | null;
  fields: FieldInput;
  audience: "list" | "people";
  list: ChosenList | null;
  people: readonly PersonRow[];
}>;

export type SendPlan = { kind: "list"; request: ListSendRequest } | { kind: "people"; requests: SingleSendRequest[] };

/** What keeps a draft from going out, by part of the form. */
export type SendProblems = Readonly<{
  template: string | null;
  list: string | null;
  /** Null unless the audience is people. */
  people: PeopleCheck | null;
  fields: Readonly<Record<string, string>>;
}>;

export const NO_FREE_TEMPLATE = `Serbest duyuru template'i (${FREE_TEMPLATE_KEY}) SkyMail'de yok ya da arşivlenmiş; serbest duyuru gönderilemez.`;

/** The requests a draft sends, or what keeps it from going out. */
export function sendPlan(draft: SendDraft): { ok: true; plan: SendPlan } | { ok: false; problems: SendProblems } {
  const { template } = draft;
  const templateProblem = template ? null : draft.what === "free" ? NO_FREE_TEMPLATE : "Gönderilecek Mail template'i seç.";
  const listProblem = draft.audience === "list" && !draft.list ? "Gönderilecek mail listesini seç." : null;
  const people =
    draft.audience === "people" ? peopleProblems(draft.people, { nameRequired: template ? usesRecipientName(template) : false }) : null;
  const variables = template
    ? bodyVariables(variableFields(template), draft.fields, { require: draft.what === "free" ? [FREE_BODY_VARIABLE] : [] })
    : null;

  if (!template || !variables?.ok || listProblem || (people && !peopleReady(people))) {
    return {
      ok: false,
      problems: { template: templateProblem, list: listProblem, people, fields: variables && !variables.ok ? variables.problems : {} },
    };
  }
  const body_variables = variables.variables;
  if (draft.audience === "list") {
    return { ok: true, plan: { kind: "list", request: { template_id: template.id, mail_list_id: draft.list!.id, body_variables } } };
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
      })),
    },
  };
}

/** Sends to a list; the new send's id. */
export async function sendToList(api: ApiClient, request: ListSendRequest): Promise<string> {
  const { id } = await api.post<{ id: string }>("/mail_tasks", request);
  return id;
}

/** How a send to one person went. */
export type PersonOutcome = Readonly<
  { name: string; email: string } & ({ ok: true; sendId: string } | { ok: false; reason: string })
>;

/**
 * Sends to each person in turn, going on past a failure: each is a send of
 * its own, and the ones before a failure have already gone. `onEach` hears
 * how many are done.
 */
export async function sendToPeople(
  api: ApiClient,
  requests: readonly SingleSendRequest[],
  onEach?: (done: number) => void,
): Promise<PersonOutcome[]> {
  const outcomes: PersonOutcome[] = [];
  for (const request of requests) {
    const person = { name: request.recipient_full_name, email: request.recipient_email };
    try {
      const { id } = await api.post<{ id: string }>("/mail_tasks/single", request);
      outcomes.push({ ...person, ok: true, sendId: id });
    } catch (error) {
      outcomes.push({ ...person, ok: false, reason: sendRefusal(error, "person") });
    }
    onEach?.(outcomes.length);
  }
  return outcomes;
}

const CHECK_THE_LIST = "Gönderimler listesine bakıp gerekirse tekrar dene.";

/** A refused send in plain words: to a list, or to one person. */
export function sendRefusal(error: unknown, to: "list" | "person"): string {
  const refusal = asApiError(error);
  if (refusal.status === 403) {
    return to === "list"
      ? "Bu hesap bir mail listesine gönderemez: skymail:mails:write rolü gerekiyor."
      : "Bu hesap mail gönderemez: skymail:mails:send ya da skymail:mails:write rolü gerekiyor.";
  }
  if (refusal.status === 404) {
    return to === "list"
      ? "Mail template ya da liste bulunamadı: template arşivlenmiş, liste arşivlenmiş ya da Keycloak grubu boş olabilir."
      : "Mail template arşivlenmiş ya da artık yok; arşivlenmiş bir template gönderilmez.";
  }
  if (refusal.code === "validation.error" && invalidField(refusal) === "recipient_email") {
    return "SkyMail bu adresi geçerli bir e-posta adresi saymadı.";
  }
  if (refusal.status === 0) {
    return to === "list"
      ? `Sunucuya ulaşılamadı; gönderimin açılıp açılmadığı bilinmiyor. ${CHECK_THE_LIST}`
      : `Sunucuya ulaşılamadı; bu kişiye gidip gitmediği bilinmiyor. ${CHECK_THE_LIST}`;
  }
  if (refusal.status >= 500) return `Sunucuda beklenmeyen bir hata oluştu. Gönderim açılmamış olabilir: ${CHECK_THE_LIST}`;
  return apiErrorMessage(refusal);
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
  const fallback = sendRefusal(new ApiError(404, "server.not_found"), list ? "list" : "person");
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
 * The values the preview fills the published body with: the send's own
 * variables, a markup field as the server's allow-list keeps it, and a
 * recipient — the first person named, or a sample one. An empty field is
 * left out, so the preview shows «Name» where its value will go (and an
 * `{{if}}` on it stays shut, as it will).
 */
export function previewValues(
  variables: Readonly<Record<string, string>>,
  recipient: PersonRow | null,
  markup: readonly string[],
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of Object.entries(variables)) {
    if (value !== "") values[name] = markup.includes(name) ? sanitizeLikeServer(value) : value;
  }
  const person = recipient ?? SAMPLE_RECIPIENT;
  return { ...values, FullName: person.name, Email: person.email };
}
