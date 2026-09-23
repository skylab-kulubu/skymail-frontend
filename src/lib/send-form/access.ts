/**
 * What the send form (`/mail-tasks/create`, ticket 16) offers the person
 * looking at it, by the roles skymail-backend checks (main.go): a send to a
 * mailing list needs `mails:write`, a send to one person `mails:send` or
 * `mails:write`. What the viewer may not send they submit for approval
 * (ticket 20): `POST /mail_approvals` needs only access. Either way the form
 * sends a Mail template, so it needs `templates:read` to offer anything, and
 * `lists:read` to pick a list. Who may open the page at all is RoleGate's to
 * say (access.ts requiredRolesFor).
 */
import { ROLE, hasRole } from "../access";

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
        : `Mail listelerini görmek için ${ROLE.listsRead} rolü gerekiyor; bu hesapla bir kişiye gönderimi onaya sunabilirsin.`;
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
