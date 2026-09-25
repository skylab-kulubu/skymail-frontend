/**
 * What the send form (`/mail-tasks/create`, ticket 16) offers the person
 * looking at it, by the roles skymail-backend checks (main.go): a send to a
 * mailing list needs `mails:write`, a send to one person `mails:send` or
 * `mails:write`. What the viewer may not send they submit for approval
 * (ticket 20): to a list, or to 1..100 people as one request (ticket 22);
 * `POST /mail_approvals` asks for read access to what it submits. Either way the form
 * sends a Mail template, so it needs `templates:read` to offer anything, and
 * `lists:read` to pick a list. Who may open the page at all is RoleGate's to
 * say (access.ts requiredRolesFor).
 */
import { ROLE, hasRole } from "../access";
import { APPROVAL_PEOPLE_LIMIT } from "../mail-approvals/approvals";

const PEOPLE_LIMIT_NOTE = `Onaya en çok ${APPROVAL_PEOPLE_LIMIT} kişi sunulur.`;

export type SendAccess = Readonly<{
  /** A mailing list can be picked: `lists:read` and `templates:read`. */
  list: boolean;
  /** People can be named: `templates:read`. */
  people: boolean;
  /** What goes at once rather than for approval: a list with `mails:write`, people with `mails:send` or `mails:write`. */
  send: Readonly<{ list: boolean; people: boolean }>;
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
        ? `Mail listelerini görmek için ${ROLE.listsRead} rolü gerekiyor; bu hesapla kişilere gönderebilirsin.`
        : `Mail listelerini görmek için ${ROLE.listsRead} rolü gerekiyor; bu hesapla kişilere gönderimi onaya sunabilirsin.`;
  return {
    list,
    people: templates,
    send: { list: list && write, people: templates && sendsPeople },
    detail: hasRole(roles, ROLE.mailsRead),
    listNote,
  };
}

/** Whether a send to `audience` goes at once; if not, it is submitted for approval. */
export function directSend(access: SendAccess, audience: "list" | "people"): boolean {
  return audience === "list" ? access.send.list : access.send.people;
}

/**
 * What the form says when a send to `audience` goes for approval: the role a
 * direct send takes, and how many people one request takes. A resubmission
 * goes for approval whoever makes it: only the latter. Null when it goes at
 * once.
 */
export function approvalNote(access: SendAccess, audience: "list" | "people", { resubmit = false }: { resubmit?: boolean } = {}): string | null {
  if (resubmit) return audience === "people" ? PEOPLE_LIMIT_NOTE : null;
  if (directSend(access, audience)) return null;
  return audience === "list"
    ? `Bu hesap bir mail listesine doğrudan gönderemez (${ROLE.mailsWrite} rolü gerekiyor): gönderim onaya sunulur, bir onaycı onaylayınca gider.`
    : `Bu hesap mail gönderemez (${ROLE.mailsSend} ya da ${ROLE.mailsWrite} rolü gerekiyor): gönderim onaya sunulur, bir onaycı onaylayınca her kişiye ayrı gider. ${PEOPLE_LIMIT_NOTE}`;
}

/**
 * The audience the form starts on: a list a link names (`presetList`) when
 * the viewer can pick one; else one they send to at once — a list with
 * `mails:write`, people with `mails:send` — so the form's main action is a
 * send; else, for someone who sends nothing, a list if they can pick one.
 */
export function defaultAudience(access: SendAccess, { presetList }: { presetList: boolean }): "list" | "people" {
  if (presetList && access.list) return "list";
  if (access.send.list) return "list";
  if (access.send.people) return "people";
  return access.list ? "list" : "people";
}
