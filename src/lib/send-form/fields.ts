/**
 * The variable fields a send asks for, built from the Mail template it sends
 * (ticket 16). Only the published version is ever sent, so they come from
 * the template row — its subject and HTML are the published copy — and its
 * Required variables:
 *
 *  - a Required variable's field is required and says why, with the
 *    contract's reason when the sending service's contract holds it;
 *  - a variable the subject uses is required too: the subject is one line,
 *    and one with a hole reads broken;
 *  - a variable the body takes as markup (`{{safeHTML .X}}`, free.basic's
 *    BodyHtml) is written in the Visual editor and sent as its render
 *    (free-body.ts); one named like a link (…Url, …Link, …Href) is an address;
 *  - what the mailer fills per recipient, Email and FullName, is not asked for.
 *
 * Every field goes out, an empty one as "", so a subject never prints Go's
 * `<no value>` and an `{{if .X}}` sees an empty field as unset.
 */
import { freeBodyFromSource } from "../mail-render/free-body";
import { actionInside, findActions, referencedVariables } from "../mail-render/go-template";
import { linkAddressProblem } from "../mail-render/visual-document";
import type { MailTemplate } from "../templates";

export type FieldKind = "text" | "url" | "rich";

export type VariableField = Readonly<{
  name: string;
  /** In words where the name is a known one (free.basic's), else the name. */
  label: string;
  kind: FieldKind;
  required: boolean;
  /** Why it is required; null when it is not. */
  why: string | null;
}>;

/** What a template's fields are built from: the published copy on its row. */
export type FieldSource = Pick<MailTemplate, "subject" | "html_content" | "contract_required_variables" | "operator_required_variables">;

/** Filled in by the mailer for each recipient (internal/mailer, renderAndQueue). */
export const MAILER_PROVIDED: readonly string[] = ["Email", "FullName"];

// A Map, not an object literal: a name comes from the template, and
// "constructor" must not find what every object inherits.
const LABELS: ReadonlyMap<string, string> = new Map([
  ["Subject", "Konu"],
  ["Heading", "Başlık"],
  ["BodyHtml", "Gövde"],
  ["CtaLabel", "Buton yazısı"],
  ["CtaUrl", "Buton bağlantısı"],
]);

const SAFE_HTML = /^safeHTML\s+\$?\.([\p{L}_][\p{L}\p{N}_]*)$/u;

/** The variables a body takes as markup: `{{safeHTML .X}}`. */
function markupVariables(html: string): Set<string> {
  const found = new Set<string>();
  for (const { start, end } of findActions(html)) {
    const match = SAFE_HTML.exec(actionInside(html.slice(start, end))?.trim() ?? "");
    if (match) found.add(match[1]);
  }
  return found;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `names` in the order `text` first uses them. */
function inOrderOfUse(text: string, names: readonly string[]): string[] {
  const placed: string[] = [];
  for (const { start, end } of findActions(text)) {
    const action = text.slice(start, end);
    for (const name of names) {
      if (!placed.includes(name) && new RegExp(`\\.${escapeRegExp(name)}(?![\\p{L}\\p{N}_])`, "u").test(action)) placed.push(name);
    }
  }
  return [...placed, ...names.filter((name) => !placed.includes(name))];
}

const read = (text: string): string[] => {
  try {
    return referencedVariables(text);
  } catch {
    return [];
  }
};

export function variableFields(template: FieldSource): VariableField[] {
  const inSubject = read(template.subject);
  const inBody = read(template.html_content);
  const names = [...new Set([...inOrderOfUse(template.subject, inSubject), ...inOrderOfUse(template.html_content, inBody)])].filter(
    (name) => !MAILER_PROVIDED.includes(name),
  );
  const markup = markupVariables(template.html_content);
  const contract = new Map((template.contract_required_variables ?? []).map(({ name, reason }) => [name, reason]));
  const operator = new Set(template.operator_required_variables ?? []);

  return names.map((name) => {
    const why = contract.has(name)
      ? `Required variable: ${contract.get(name) ?? "gönderen servisin sözleşmesinde."}`
      : operator.has(name)
        ? "Required variable: bu template'te zorunlu işaretlenmiş."
        : inSubject.includes(name)
          ? "Konuda geçiyor: boş kalırsa konu eksik görünür."
          : null;
    const kind: FieldKind = markup.has(name) ? "rich" : /(url|link|href)$/i.test(name) ? "url" : "text";
    return { name, label: LABELS.get(name) ?? name, kind, required: why !== null, why };
  });
}

/** Whether the mail uses the recipient's name, so a person sent to needs one. */
export function usesRecipientName(template: Pick<FieldSource, "subject" | "html_content">): boolean {
  return [template.subject, template.html_content].some((text) => read(text).includes("FullName"));
}

/** What the sender filled in: a text per field, and a markup field's Visual source. */
export type FieldInput = Readonly<{
  values: Readonly<Record<string, string>>;
  /** A markup field's Visual source (the editor's JSON text); none is an empty body. */
  rich: Readonly<Record<string, string>>;
}>;

/** A markup field's body: its render, or what keeps it from going out. */
function richBody(input: FieldInput, name: string) {
  const source = input.rich[name];
  return source === undefined ? ({ ok: true, html: "" } as const) : freeBodyFromSource(source);
}

/**
 * What is wrong with each field, by name; empty when the send may go.
 * `require` names fields the form needs beyond the template's own — a free
 * announcement's body.
 */
export function fieldProblems(
  fields: readonly VariableField[],
  input: FieldInput,
  { require = [] }: { require?: readonly string[] } = {},
): Record<string, string> {
  const problems: Record<string, string> = {};
  for (const field of fields) {
    const required = field.required || require.includes(field.name);
    if (field.kind === "rich") {
      const body = richBody(input, field.name);
      if (!body.ok) problems[field.name] = `${field.label} gönderilemez: ${body.problems.join("; ")}`;
      else if (required && body.html === "") problems[field.name] = `${field.label} boş bırakılamaz.`;
      continue;
    }
    const value = (input.values[field.name] ?? "").trim();
    if (value === "") {
      if (required) problems[field.name] = `${field.label} boş bırakılamaz.`;
      continue;
    }
    const address = field.kind === "url" ? linkAddressProblem(value) : null;
    if (address) problems[field.name] = `Geçerli bir adres gir: ${address}.`;
  }
  return problems;
}

/** The send's `body_variables`: every field, trimmed, a markup field as its render; or what is wrong. */
export function bodyVariables(
  fields: readonly VariableField[],
  input: FieldInput,
  options: { require?: readonly string[] } = {},
): { ok: true; variables: Record<string, string> } | { ok: false; problems: Record<string, string> } {
  const problems = fieldProblems(fields, input, options);
  if (Object.keys(problems).length > 0) return { ok: false, problems };
  const variables: Record<string, string> = {};
  for (const field of fields) {
    const body = field.kind === "rich" ? richBody(input, field.name) : null;
    variables[field.name] = body?.ok ? body.html : (input.values[field.name] ?? "").trim();
  }
  return { ok: true, variables };
}
