/**
 * What the send form (`/mail-tasks/create`, ticket 16) offers the person
 * looking at it, by the roles skymail-backend checks (main.go): a send to a
 * mailing list or to a Forms source's respondents needs `mails:write`, a send
 * to one person `mails:send` or `mails:write`. What the viewer may not send they submit for approval
 * (ticket 20): to a list, or to 1..100 people as one request (ticket 22);
 * `POST /mail_approvals` asks for read access to what it submits. Either way the form
 * sends a Mail template, so it needs `templates:read` to offer anything, and
 * `lists:read` to pick a list. Who may open the page at all is RoleGate's to
 * say (access.ts requiredRolesFor).
 */
import { ROLE, hasRole } from "../access";
import { APPROVAL_PEOPLE_LIMIT } from "../mail-approvals/approvals";
import { TEAM_APPROVAL_NOTE } from "./teams";

const PEOPLE_LIMIT_NOTE = `Onaya en çok ${APPROVAL_PEOPLE_LIMIT} kişi sunulur.`;

export type SendAccess = Readonly<{
  /** A mailing list can be picked: `lists:read` and `templates:read`. */
  list: boolean;
  /** People can be named: `templates:read`. */
  people: boolean;
  /** What goes at once rather than for approval: a list or a Forms source with `mails:write`, people with `mails:send` or `mails:write`. */
  send: Readonly<{ list: boolean; people: boolean; form: boolean }>;
  /** The new send's page, and the send list, open (`mails:read`). */
  detail: boolean;
  /** Why a list is not offered while people are. */
  listNote: string | null;
}>;

export function sendAccess(roles: readonly string[]): SendAccess {
  const templates = hasRole(roles, ROLE.templatesRead);
  const write = hasRole(roles, ROLE.mailsWrite);
  const sendsPeople = write || hasRole(roles, ROLE.mailsSend);
  const list = templates && hasRole(roles, ROLE.listsRead);
  const listNote =
    !templates || list
      ? null
      : sendsPeople
        ? `Bu hesap mail listelerini göremez; kişilere gönderebilirsin.`
        : `Bu hesap mail listelerini göremez; kişilere gönderimi onaya sunabilirsin.`;
  return {
    list,
    people: templates,
    send: { list: list && write, people: templates && sendsPeople, form: templates && write },
    detail: hasRole(roles, ROLE.mailsRead),
    listNote,
  };
}

/**
 * Whether a send to `audience` goes at once; if not, it is submitted for
 * approval. People a legacy Forms transfer added (`legacyForms`, Eski aktarım:
 * Forms' fallback when SkyMail cannot prepare a source) are Forms respondents,
 * a bulk audience: as a Forms source, they go at once only with `mails:write`.
 */
export function directSend(access: SendAccess, audience: "list" | "people" | "form" | "team", { legacyForms = false }: { legacyForms?: boolean } = {}): boolean {
  // Team mail always goes for approval (ADR 0067 addendum).
  if (audience === "team") return false;
  if (audience === "people") return legacyForms ? access.send.form : access.send.people;
  return access.send[audience];
}

/**
 * What the form says when a send to `audience` goes for approval: the role a
 * direct send takes, and how many people one request takes. A resubmission
 * goes for approval whoever makes it: only the latter. Null when it goes at
 * once.
 */
export function approvalNote(
  access: SendAccess,
  audience: "list" | "people" | "form" | "team",
  { resubmit = false, legacyForms = false }: { resubmit?: boolean; legacyForms?: boolean } = {},
): string | null {
  if (audience === "team") return TEAM_APPROVAL_NOTE;
  if (audience === "form") return resubmit || directSend(access, audience) ? null : `Forms yanıtlayanlarına doğrudan gönderme yetkin yok: sabit Forms alıcıları onaya sunulur; bir onaycı onaylayınca gönderilir.`;
  if (resubmit) return audience === "people" ? PEOPLE_LIMIT_NOTE : null;
  if (directSend(access, audience, { legacyForms })) return null;
  if (audience === "people" && legacyForms)
    return `Forms yanıtlayanlarına doğrudan gönderme yetkin yok: gönderim onaya sunulur, bir onaycı onaylayınca her kişiye ayrı gider. ${PEOPLE_LIMIT_NOTE}`;
  return audience === "list"
    ? `Mail listesine doğrudan gönderme yetkin yok: gönderim onaya sunulur, bir onaycı onaylayınca gider.`
    : `Doğrudan gönderme yetkin yok: gönderim onaya sunulur, bir onaycı onaylayınca her kişiye ayrı gider. ${PEOPLE_LIMIT_NOTE}`;
}

/**
 * The audience the form shows: the one the sender (or the request the form
 * was filled from) chose, else where it starts (defaultAudience). Teams with
 * no Team to pick — the switch off, core not answering, the leadership over —
 * fall back there too, so the form never sits on an empty Ekibim; the team
 * seat has nothing else and stays on its Teams.
 */
export function formAudience<A extends "list" | "people" | "form" | "team">(
  chosen: A | null,
  { access, presetList, teams, teamSeat = false }: { access: SendAccess; presetList: boolean; teams: number; teamSeat?: boolean },
): A | "list" | "people" | "team" {
  if (teamSeat) return "team";
  if (chosen === null || (chosen === "team" && teams === 0)) return defaultAudience(access, { presetList, teams: teams > 0 });
  return chosen;
}

/**
 * The audience the form starts on: a list a link names (`presetList`) when
 * the viewer can pick one; else the Teams they lead (`teams`); else one they send to at once — a list with
 * `mails:write`, people with `mails:send` — so the form's main action is a
 * send; else, for someone who sends nothing, a list if they can pick one.
 */
export function defaultAudience(
  access: SendAccess,
  { presetList, teams = false }: { presetList: boolean; teams?: boolean },
): "list" | "people" | "team" {
  if (presetList && access.list) return "list";
  // A Leader's Teams come first (ekip-postasi 05): what they send is their Team's announcement.
  if (teams) return "team";
  if (access.send.list) return "list";
  if (access.send.people) return "people";
  return access.list ? "list" : "people";
}
