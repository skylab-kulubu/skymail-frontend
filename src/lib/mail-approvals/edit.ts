/**
 * The bodies the approval screens send (ticket 20), from the send form's
 * variable fields (ticket 16, send-form/fields.ts).
 *
 *  - A submission, and a resubmission, is the send form's request (ticket
 *    19, 21): `{template_id, mail_list_id, body_variables}` to a list,
 *    `{template_id, recipients: [{email, full_name}], body_variables}` to
 *    1..100 people — one person too, not the deprecated fields for one.
 *    Approvers decide it once; each person gets a send of their own.
 *  - An approver edits only the variables (ticket 18); an edit is the
 *    request's variables whole — a variable left out would read as removed —
 *    with each field they changed in its new value. A field they did not
 *    change goes back exactly as it came: a text untrimmed, a free
 *    announcement's body byte for byte, even one the Visual editor could not
 *    read back exactly (free-body-read.ts).
 *  - What an edit changed, variable by variable, is shown before it is sent
 *    or returned, and to the submitter a returned edit waits on.
 */
import { ROLE } from "../access";
import { freeBodyFromSource } from "../mail-render/free-body";
import { readFreeBody } from "../mail-render/free-body-read";
import { visualSource, type VisualInline } from "../mail-render/visual-document";
import type { ListRow } from "../mailing-lists";
import type { SendAccess } from "../send-form/access";
import type { PersonRow } from "../send-form/audience";
import {
  MAILER_PROVIDED,
  fieldProblems,
  namedField,
  variableFields,
  type FieldInput,
  type FieldSource,
  type VariableField,
} from "../send-form/fields";
import { FREE_BODY_VARIABLE, FREE_TEMPLATE_KEY, type SendPlan } from "../send-form/send";
import { audienceLabel } from "../sends";
import type { ApiClient } from "../api/client";
import { fetchTemplate, fetchVersion, type MailTemplate } from "../templates";
import {
  APPROVAL_PEOPLE_LIMIT,
  approvalPeople,
  type ApprovalChange,
  type ApprovalEvent,
  type ApprovalPerson,
  type ApprovalRecipient,
  type ApprovalTemplate,
  type MailApproval,
} from "./approvals";

type Variables = Readonly<Record<string, unknown>>;

/** A value as a field holds it: text as it is, another value as its JSON, none as empty. */
function asText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

const requestNames = (variables: Variables | null) => Object.keys(variables ?? {}).filter((name) => !MAILER_PROVIDED.includes(name));

/**
 * The fields of a request: the send form's, from the template version it is
 * pinned to, and one more for any value it carries that the version does not
 * use; or, when the version cannot be read (no `templates:read`, or it is
 * gone), one per value, by name — free.basic's body still in the Visual
 * editor.
 */
export function approvalFields(source: FieldSource | null, variables: Variables | null, templateKey: string | null): VariableField[] {
  const names = requestNames(variables);
  if (source) {
    const fields = variableFields(source);
    return [...fields, ...names.filter((name) => !fields.some((field) => field.name === name)).map((name) => namedField(name))];
  }
  return names.map((name) => namedField(name, templateKey === FREE_TEMPLATE_KEY && name === FREE_BODY_VARIABLE ? "rich" : undefined));
}

/** The version a request is pinned to, as a page has it: read, being read, or why it is not. */
export type PinnedSource =
  | Readonly<{ status: "ready"; source: FieldSource }>
  /** The viewer lacks templates:read. */
  | Readonly<{ status: "noRole" }>
  /** It was asked for and could not be read. */
  | Readonly<{ status: "unreadable" }>
  | Readonly<{ status: "loading" }>;

/** Why the mail is not shown before and after an edit; null when it is. */
export function pinnedSourceNote(pinned: PinnedSource): string | null {
  switch (pinned.status) {
    case "ready":
      return null;
    case "loading":
      return "Mailin iki hâli hazırlanıyor…";
    case "noRole":
      return `Mailin iki hâlini yan yana görmek için ${ROLE.templatesRead} rolü gerekiyor; değişen değişkenler yukarıda.`;
    case "unreadable":
      return "Mail template'in bu isteğin bağlı olduğu sürümü okunamadı; mailin iki hâli yan yana gösterilemiyor. Değişen değişkenler yukarıda.";
  }
}

/**
 * The version a request is pinned to, as the fields are built from it: its
 * subject and body, with the template's Required variables — none known when
 * the template cannot be read (archived since). Null when the version cannot
 * be read either: the fields are then the request's values by name.
 */
export async function fetchPinnedSource(
  api: ApiClient,
  template: Pick<ApprovalTemplate, "id" | "version_id">,
  signal?: AbortSignal,
): Promise<FieldSource | null> {
  const [row, version] = await Promise.allSettled([fetchTemplate(api, template.id, signal), fetchVersion(api, template.id, template.version_id, signal)]);
  if (version.status !== "fulfilled") return null;
  const required = row.status === "fulfilled" ? row.value : null;
  return {
    subject: version.value.subject,
    html_content: version.value.html_content,
    contract_required_variables: required?.contract_required_variables ?? [],
    operator_required_variables: required?.operator_required_variables ?? [],
  };
}

/**
 * The form filled with a request's values: each text as it is, a markup
 * field as the Visual source read from its HTML; and the markup fields the
 * editor could not read back exactly.
 */
export function inputFromVariables(fields: readonly VariableField[], variables: Variables | null): { input: FieldInput; inexact: string[] } {
  const values: Record<string, string> = {};
  const rich: Record<string, string> = {};
  const inexact: string[] = [];
  for (const field of fields) {
    const text = asText(variables?.[field.name]);
    if (field.kind !== "rich") {
      values[field.name] = text;
      continue;
    }
    const read = readFreeBody(text);
    rich[field.name] = visualSource(read.document);
    if (!read.exact) inexact.push(field.name);
  }
  return { input: { values, rich }, inexact };
}

export type EditResult =
  | { ok: true; variables: Record<string, unknown>; changed: string[] }
  | { ok: false; problems: Record<string, string> };

/**
 * The request's variables after an edit: `original` whole, each field changed
 * from `initial` (the form as inputFromVariables filled it) to `current` in
 * its new value — a text trimmed, a markup field as its render. A field is
 * changed only when it would send something else: a text taken back to what
 * it was, or a body the editor wrote again that renders the same, is not.
 * A changed field is checked as the send form checks it.
 */
export function editedVariables(fields: readonly VariableField[], original: Variables | null, initial: FieldInput, current: FieldInput): EditResult {
  const variables: Record<string, unknown> = { ...original };
  const changed: string[] = [];
  const touched: VariableField[] = [];
  for (const field of fields) {
    if (field.kind === "rich") {
      const now = current.rich[field.name];
      if (now === undefined || now === initial.rich[field.name]) continue;
      const before = initial.rich[field.name] === undefined ? null : freeBodyFromSource(initial.rich[field.name]);
      const after = freeBodyFromSource(now);
      if (after.ok && before?.ok && before.html === after.html) continue;
      touched.push(field);
      if (after.ok) {
        variables[field.name] = after.html;
        changed.push(field.name);
      }
      continue;
    }
    const now = current.values[field.name] ?? "";
    const was = initial.values[field.name] ?? "";
    if (now === was || now.trim() === was.trim()) continue;
    touched.push(field);
    variables[field.name] = now.trim();
    changed.push(field.name);
  }
  const problems = fieldProblems(touched, current);
  return Object.keys(problems).length > 0 ? { ok: false, problems } : { ok: true, variables, changed };
}

/**
 * A value as the page shows it, or null for none: a text as it is, a free
 * announcement's body as its words — a line a block, a list's items marked —
 * never as markup (the preview shows it as mail).
 */
export function valueText(value: unknown, kind: VariableField["kind"]): string | null {
  if (value === undefined || value === null) return null;
  const text = asText(value);
  if (kind !== "rich") return text;
  const line = (content: readonly VisualInline[]) =>
    content.map((node) => (node.type === "text" ? node.text : node.type === "hardBreak" ? "\n" : "")).join("");
  return readFreeBody(text)
    .document.blocks.map((block) =>
      block.type === "list"
        ? block.items.map((item) => `• ${line(item)}`).join("\n")
        : "content" in block
          ? line(block.content)
          : "",
    )
    .join("\n");
}

export type VariableChange = Readonly<{ name: string; before: unknown; after: unknown }>;

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Each variable whose value differs, before and after (null for none), in `order` and then as they come. */
export function variableChanges(before: Variables | null, after: Variables | null, order: readonly string[]): VariableChange[] {
  const names = [...new Set([...order, ...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  return names
    .filter((name) => (before && name in before) || (after && name in after))
    .filter((name) => !same(before?.[name], after?.[name]))
    .map((name) => ({ name, before: before?.[name] ?? null, after: after?.[name] ?? null }));
}

/** The request before an approver's last edit, what the edit changed, who made it and what they said. */
export type BeforeEdit = Readonly<{
  before: Record<string, unknown>;
  changes: VariableChange[];
  editor: ApprovalPerson | null;
  note: string | null;
}>;

/**
 * What a returned edit waits on the submitter for: the request before the
 * last `edited` event of its history — its variable changes taken back —
 * beside the request now. Null when nothing was edited.
 */
export function valuesBeforeEdit(approval: Pick<MailApproval, "body_variables" | "history">): BeforeEdit | null {
  const history = [...(approval.history ?? [])].sort((a, b) => a.seq - b.seq);
  const edit = history.findLast((event) => event.kind === "edited");
  if (!edit) return null;
  const variableChangesOf = (event: ApprovalEvent) =>
    (event.changes ?? []).filter((change): change is ApprovalChange & { name: string } => change.field === "variable" && change.name !== null);
  const before: Record<string, unknown> = { ...approval.body_variables };
  const changes = variableChangesOf(edit).map((change) => {
    if (change.before === null || change.before === undefined) delete before[change.name];
    else before[change.name] = change.before;
    return { name: change.name, before: change.before ?? null, after: change.after ?? null };
  });
  const decision = history.find((event) => event.seq > edit.seq && (event.kind === "returned" || event.kind === "approved") && event.note);
  return { before, changes, editor: edit.actor, note: decision?.note ?? edit.note ?? null };
}

/**
 * What a resubmission starts from: a declined request carries the approver's
 * edit its submitter refused, so they start from their own values, the ones
 * before it; a rejected one as it stands.
 */
export function resubmission<T extends Pick<MailApproval, "state" | "body_variables" | "history">>(approval: T): T {
  if (approval.state !== "declined") return approval;
  return { ...approval, body_variables: valuesBeforeEdit(approval)?.before ?? approval.body_variables };
}

// ---------------------------------------------------------------------------
// A submission from the send form

/** `POST /mail_approvals` and `…/resubmit`: the send form's request, to a list or to people. */
export type ApprovalRequest =
  | { template_id: string; mail_list_id: string; body_variables: Record<string, string> }
  | { template_id: string; recipients: ApprovalRecipient[]; body_variables: Record<string, string> };

/**
 * A send plan as one request for approval: its people — each of the form's
 * filled rows, in order — or its list. More people than a request takes
 * are pointed to a list; `lists` says whether the viewer can pick one.
 */
export function approvalRequest(
  plan: SendPlan,
  { lists = true }: { lists?: boolean } = {},
): { ok: true; request: ApprovalRequest } | { ok: false; problem: string } {
  if (plan.kind === "list") return { ok: true, request: plan.request };
  const count = plan.requests.length;
  if (count > APPROVAL_PEOPLE_LIMIT) {
    const crowd = lists
      ? "Daha kalabalık bir gönderim için bir mail listesi seç."
      : `Daha kalabalık bir gönderim bir mail listesine gider: listeleri görmek için ${ROLE.listsRead} rolü gerekiyor.`;
    return { ok: false, problem: `Onaya en çok ${APPROVAL_PEOPLE_LIMIT} kişi sunulur; burada ${count} kişi var. ${crowd}` };
  }
  const [first] = plan.requests;
  return {
    ok: true,
    request: {
      template_id: first.template_id,
      recipients: plan.requests.map((request) => ({ email: request.recipient_email, full_name: request.recipient_full_name })),
      body_variables: first.body_variables,
    },
  };
}

/** The send form as a request fills it: to resubmit it, or to start a new one from it. */
export type ComposePrefill = Readonly<{
  what: "template" | "free";
  templateId: string | null;
  audience: "list" | "people";
  listId: string | null;
  people: PersonRow[];
  values: Record<string, string>;
  rich: Record<string, string>;
  /** What could not be filled as the request had it, in words. */
  notes: string[];
}>;

export function composePrefill(
  approval: Pick<MailApproval, "template" | "audience" | "recipients" | "body_variables">,
  { templates, lists, access }: { templates: readonly MailTemplate[]; lists: readonly ListRow[]; access: SendAccess },
): ComposePrefill {
  const notes: string[] = [];
  const template = templates.find((candidate) => candidate.id === approval.template.id) ?? null;
  if (!template) notes.push(`İsteğin Mail template'i (“${approval.template.name}”) artık gönderilemiyor: arşivlenmiş ya da silinmiş. Bir template seç.`);

  let audience: ComposePrefill["audience"] = "people";
  let listId: string | null = null;
  let people: PersonRow[] = [];
  if (approval.audience.kind !== "mailing_list") {
    people = approvalPeople(approval).map((person) => ({ name: person.full_name, email: person.email }));
  } else {
    const name = audienceLabel(approval.audience).name;
    if (!access.list) {
      notes.push(`İstek “${name}” listesine gidiyordu; bu hesap mail listelerini göremiyor (skymail:lists:read). Bir kişi seç.`);
    } else {
      audience = "list";
      listId = lists.find((list) => list.id === approval.audience.mail_list_id)?.id ?? null;
      if (listId === null) notes.push(`İsteğin listesi (“${name}”) artık yok ya da arşivlenmiş. Bir liste seç.`);
    }
  }

  let values: Record<string, string>;
  let rich: Record<string, string> = {};
  if (template) {
    const fields = variableFields(template);
    const filled = inputFromVariables(fields, approval.body_variables);
    ({ values, rich } = filled.input);
    for (const name of filled.inexact) {
      const label = fields.find((field) => field.name === name)?.label ?? name;
      notes.push(`${label} Visual editöre birebir aktarılamadı: gönderilmeden önce bak.`);
    }
  } else {
    values = Object.fromEntries(requestNames(approval.body_variables).map((name) => [name, asText(approval.body_variables?.[name])]));
  }

  return {
    what: template?.key === FREE_TEMPLATE_KEY ? "free" : "template",
    templateId: template?.id ?? null,
    audience,
    listId,
    people,
    values,
    rich,
    notes,
  };
}
