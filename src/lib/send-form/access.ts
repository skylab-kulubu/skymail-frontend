/**
 * What the send form (`/mail-tasks/create`, ticket 16) offers the person
 * looking at it, by the roles skymail-backend checks (main.go): a send to a
 * mailing list needs `mails:write`, a send to one person `mails:send` or
 * `mails:write`. The form sends a Mail template, so it needs `templates:read`
 * to offer anything, and `lists:read` to pick a list. Who may open the page
 * at all is RoleGate's to say (access.ts requiredRolesFor).
 */
import { ROLE, hasRole } from "../access";

export type SendAccess = Readonly<{
  /** A send to a mailing list: `mails:write`, `lists:read` to pick the list, `templates:read`. */
  list: boolean;
  /** Sends to people one by one: `mails:send` or `mails:write`, and `templates:read`. */
  people: boolean;
  /** The new send's page, and the send list, open (`mails:read`). */
  detail: boolean;
  /** Why a list is not offered while people are. */
  listNote: string | null;
}>;

export function sendAccess(roles: readonly string[]): SendAccess {
  const templates = hasRole(roles, ROLE.templatesRead);
  const write = hasRole(roles, ROLE.mailsWrite);
  const people = templates && (write || hasRole(roles, ROLE.mailsSend));
  const list = people && write && hasRole(roles, ROLE.listsRead);
  const listNote =
    !people || list
      ? null
      : write
        ? `Mail listelerini görmek için ${ROLE.listsRead} rolü gerekiyor; bu hesapla tek tek kişilere gönderebilirsin.`
        : `Bir mail listesine göndermek ${ROLE.mailsWrite} rolü ister; bu hesapla tek tek kişilere gönderebilirsin.`;
  return { list, people, detail: hasRole(roles, ROLE.mailsRead), listNote };
}
