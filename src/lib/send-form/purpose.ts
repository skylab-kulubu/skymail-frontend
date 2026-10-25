/**
 * A send's purpose and category (hub ticket abonelik-cikisi 04; ADR 0072
 * decision 2, 9; skymail-backend #99). Only while the backend says
 * `purpose_available` (`GET /mail_tasks/tracking-mode` or `/summary`); with
 * an older backend, or with the switch off, the form sends none of it and
 * works as before.
 *
 *  - A list or a Keycloak group gets a duyuru only: no choice, "Duyuru".
 *  - People one by one and a Forms source's respondents may get "Başvuruyla
 *    ilgili bilgi" (`islem`), with its statement ticked; no category then.
 *  - A duyuru has a category, the club's or a team's (a Keycloak group the
 *    panel reads), and a kind; and the statement that it has no commercial
 *    content, which it does not go without.
 *
 * Tracking does not depend on the purpose (orchestrator 2026-10-23, ADR 0072
 * #54): an islem send is tracked like any other.
 */
import type { ListRow } from "../mailing-lists";

export type Purpose = "duyuru" | "islem";
export type CategoryKind = "duyuru" | "haber";

/** The club as a category's source; any other source is a Keycloak group's id. */
export const CLUB = "club";

/** What the form holds. */
export type PurposeChoice = Readonly<{
  purpose: Purpose;
  /** CLUB or a Keycloak group's id; null until the sender picks: the group sent to, else the club. */
  source: string | null;
  /** The source picker's pill: the club, or a team (whose id is `source`). */
  team: boolean;
  kind: CategoryKind;
  transactional: boolean;
  commercialAbsent: boolean;
  /** A list's mail about the list's own event or work (KVKK notice s6 row 15): its guests need no announcement consent. */
  ownEvent: boolean;
}>;

export const PURPOSE_START: PurposeChoice = {
  purpose: "duyuru",
  source: null,
  team: false,
  kind: "duyuru",
  transactional: false,
  commercialAbsent: false,
  ownEvent: false,
};

/** The fields a send, or a request for approval, carries. */
export type PurposeFields = Readonly<{
  purpose: Purpose;
  category?: string;
  transactional_statement?: boolean;
  commercial_content_absent?: boolean;
  own_event_statement?: boolean;
}>;

/** The four fields as the API answers them: null on a record written before the switch. */
export type StoredPurpose = Readonly<{
  purpose?: string | null;
  category?: string | null;
  transactional_statement?: boolean | null;
  commercial_content_absent?: boolean | null;
  own_event_statement?: boolean | null;
}>;

export type PurposeAudience = "list" | "people" | "form";

export const PURPOSE_LABEL: Readonly<Record<Purpose, string>> = { duyuru: "Duyuru", islem: "Başvuruyla ilgili bilgi" };
export const KIND_LABEL: Readonly<Record<CategoryKind, string>> = { duyuru: "Duyuru", haber: "Haber" };

export const PURPOSE_OPTIONS = [
  { value: "duyuru", label: PURPOSE_LABEL.duyuru },
  { value: "islem", label: PURPOSE_LABEL.islem },
] as const;
export const SOURCE_OPTIONS = [
  { value: "club", label: "Kulüp geneli" },
  { value: "team", label: "Ekip" },
] as const;
export const KIND_OPTIONS = [
  { value: "duyuru", label: KIND_LABEL.duyuru },
  { value: "haber", label: KIND_LABEL.haber },
] as const;

export const TRANSACTIONAL_STATEMENT =
  "Bu posta alıcının kendi başvurusu ya da işlemi hakkında (yer veya saat değişikliği, eksik belge, sonuç). Duyuru ya da davet değil.";
/** KVKK notice s6 row 15 (skymail-backend own_event_statement): a list's mail about the list's own event or work goes to its guests without their announcement consent. Optional. */
export const OWN_EVENT_STATEMENT = "Bu posta listenin oluşturulduğu etkinlik ya da çalışmayla ilgili (oturum saati, yer değişikliği, iptal).";
/** KVKK notice s6 §5.10: a short sponsor thanks or logo is not promotion. The same words as duyuru-haber 08's send from a news item. */
export const COMMERCIAL_STATEMENT = "Postanın asıl amacı tanıtım değildir. Kısa sponsor teşekkürü ve logo serbesttir.";

/** The API's refusals of a send's purpose or category (skymail-backend #99; category_unknown, commercial_statement_required: ticket 09); api/errors.ts words each. */
export const PURPOSE_REFUSALS: ReadonlySet<string> = new Set([
  "mail_task.purpose_not_allowed",
  "mail_task.transactional_statement_required",
  "mail_task.commercial_content_not_allowed",
  "mail_task.category_not_allowed",
  "mail_task.category_required",
  "mail_task.category_invalid",
  "mail_task.purpose_required",
  "mail_task.purpose_invalid",
  "mail_task.category_unknown",
  "mail_task.commercial_statement_required",
]);

/** The refusals the form puts under the category picker. */
export const CATEGORY_REFUSALS: ReadonlySet<string> = new Set(["mail_task.category_unknown", "mail_task.category_invalid", "mail_task.category_required"]);

/** Whether the backend takes a purpose: only a `true` does; a missing field (an older backend) does not. */
export function purposeAvailable(mode: Readonly<{ purpose_available?: boolean }>): boolean {
  return mode.purpose_available === true;
}

/** Whether the backend holds a list's guests to their announcement consent (`list_consent_available`): only then is the own event box shown. */
export function listConsentAvailable(mode: Readonly<{ list_consent_available?: boolean }>): boolean {
  return mode.list_consent_available === true;
}

/** Whether the own event box is shown: a list or a group, while the backend holds a list's guests to their consent. */
export function ownEventOffered(audience: PurposeAudience, listConsent: boolean): boolean {
  return audience === "list" && listConsent;
}

/** Whether the sender chooses the purpose: to people and to a Forms source's respondents; a list or a group gets a duyuru. */
export function purposeChoosable(audience: PurposeAudience): boolean {
  return audience === "people" || audience === "form";
}

/** The purpose the send goes with. */
export function purposeOf(choice: PurposeChoice, audience: PurposeAudience): Purpose {
  return purposeChoosable(audience) ? choice.purpose : "duyuru";
}

/** The category's source: the sender's pick, else the Keycloak group sent to, else the club. */
export function sourceOf(choice: PurposeChoice, list: Pick<ListRow, "id" | "external"> | null): string {
  if (choice.source !== null) return choice.source;
  return list?.external ? list.id : CLUB;
}

/** core's category: club:<kind> or team:<group id>:<kind>, the id in lower case. */
export function categoryOf(source: string, kind: CategoryKind): string {
  return source === CLUB ? `club:${kind}` : `team:${source.toLowerCase()}:${kind}`;
}

const CATEGORY = /^(?:club|team:([0-9a-f-]{36})):(duyuru|haber)$/;

/** A stored category read back: its source and kind; null when it is not one. */
export function parseCategory(category: string | null | undefined): { source: string; kind: CategoryKind } | null {
  const match = category ? CATEGORY.exec(category) : null;
  if (!match) return null;
  return { source: match[1] ?? CLUB, kind: match[2] as CategoryKind };
}

/**
 * What keeps the send from going, as far as its purpose goes: the statement
 * its purpose needs is not ticked, or a team is not picked. Null when it may go.
 */
export function purposeProblem(choice: PurposeChoice, audience: PurposeAudience, list: Pick<ListRow, "id" | "external"> | null): string | null {
  if (purposeOf(choice, audience) === "islem") return choice.transactional ? null : "Beyanı işaretle.";
  if (choice.team && sourceOf(choice, list) === CLUB) return "Ekip seç.";
  return choice.commercialAbsent ? null : "Tanıtım beyanını işaretle.";
}

/** The fields the send carries for its purpose. */
export function purposeFields(
  choice: PurposeChoice,
  audience: PurposeAudience,
  list: Pick<ListRow, "id" | "external"> | null,
  listConsent = false,
): PurposeFields {
  if (purposeOf(choice, audience) === "islem") return { purpose: "islem", transactional_statement: true };
  const fields = { purpose: "duyuru" as const, category: categoryOf(sourceOf(choice, list), choice.kind), commercial_content_absent: true };
  return ownEventOffered(audience, listConsent) && choice.ownEvent ? { ...fields, own_event_statement: true } : fields;
}

/** The form as a stored request fills it; the start when it carries no purpose. */
export function purposeChoiceOf(stored: StoredPurpose): PurposeChoice {
  if (stored.purpose === "islem") return { ...PURPOSE_START, purpose: "islem", transactional: stored.transactional_statement === true };
  const category = parseCategory(stored.category);
  if (stored.purpose !== "duyuru" || !category) return PURPOSE_START;
  return {
    ...PURPOSE_START,
    source: category.source,
    team: category.source !== CLUB,
    kind: category.kind,
    commercialAbsent: stored.commercial_content_absent === true,
    ownEvent: stored.own_event_statement === true,
  };
}

/** A team's name by its group id: a Keycloak group the panel reads. */
export type TeamName = (id: string) => string | null;

/** The teams to pick from: the Keycloak groups the panel reads. */
export function teamOptions(lists: readonly Pick<ListRow, "id" | "name" | "external">[]): { value: string; label: string }[] {
  return lists.filter((list) => list.external).map((list) => ({ value: list.id.toLowerCase(), label: list.name }));
}

export function teamNames(lists: readonly Pick<ListRow, "id" | "name" | "external">[]): TeamName {
  const names = new Map(teamOptions(lists).map(({ value, label }) => [value, label]));
  return (id) => names.get(id.toLowerCase()) ?? null;
}

/** The team a stored category names, lower-cased, unless it is `named` (a group already named, the one sent to); null for the club or none. */
export function categoryTeam(category: string | null | undefined, named: string | null | undefined): string | null {
  const source = parseCategory(category)?.source.toLowerCase() ?? CLUB;
  return source === CLUB || source === named?.toLowerCase() ? null : source;
}

/** The purpose in words, as the confirmation and the request's page say it: "Duyuru · Kulüp geneli · Haber". */
export function purposeText(fields: StoredPurpose, team: TeamName = () => null): string | null {
  if (fields.purpose === "islem") return PURPOSE_LABEL.islem;
  if (fields.purpose !== "duyuru") return null;
  const category = parseCategory(fields.category);
  if (!category) return PURPOSE_LABEL.duyuru;
  const source = category.source === CLUB ? "Kulüp geneli" : `Ekip: ${team(category.source) ?? category.source}`;
  return `${PURPOSE_LABEL.duyuru} · ${source} · ${KIND_LABEL[category.kind]}`;
}

/** The statement a send carries, in its words; null for none. */
export function statementText(fields: StoredPurpose): string | null {
  if (fields.purpose === "islem") return fields.transactional_statement === true ? TRANSACTIONAL_STATEMENT : null;
  if (fields.purpose === "duyuru") return fields.commercial_content_absent === true ? COMMERCIAL_STATEMENT : null;
  return null;
}

/** The list's own event statement a duyuru carries, in its words; null for none. The approver reads it: it lifts the guests' consent. */
export function ownEventText(fields: StoredPurpose): string | null {
  return fields.purpose === "duyuru" && fields.own_event_statement === true ? OWN_EVENT_STATEMENT : null;
}

/**
 * What a request's page says of its purpose: the stored one; for a request to
 * a list or a group without one, "Duyuru" while the backend takes a purpose
 * (it goes as one when approved, ticket 08 note); null otherwise.
 */
export function approvalPurposeText(
  approval: StoredPurpose & Readonly<{ audienceKind: string }>,
  { available, team }: { available: boolean; team?: TeamName },
): string | null {
  const said = purposeText(approval, team);
  if (said) return said;
  return available && approval.audienceKind === "mailing_list" ? PURPOSE_LABEL.duyuru : null;
}
