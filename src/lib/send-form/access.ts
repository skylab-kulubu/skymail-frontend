/**
 * What the send form (`/mail-tasks/create`, ticket 16) offers the person
 * looking at it, by the roles skymail-backend checks (main.go): a send to a
 * mailing list needs `mails:write`, a send to one person `mails:send` or
 * `mails:write`. The form reads Mail templates to send one and mailing lists
 * to pick one, so it needs their read roles too. The page is not guarded by
 * its section's read role (access.ts): a sender need not read the send list.
 */
import { ROLE, hasRole } from "../access";

export type SendAccess = Readonly<{
  /** A send to a mailing list: `mails:write`, and `lists:read` to pick the list. */
  list: boolean;
  /** Sends to people one by one: `mails:send` or `mails:write`. */
  people: boolean;
  /** The new send's page opens (`mails:read`). */
  detail: boolean;
  /** Why the form does not open at all; null when it does. */
  blocked: string | null;
  /** Why a list is not offered while people are. */
  listNote: string | null;
}>;

const ASK = "ihtiyacın varsa kulüp yönetimine başvur.";

export function sendAccess(roles: readonly string[]): SendAccess {
  const write = hasRole(roles, ROLE.mailsWrite);
  const people = write || hasRole(roles, ROLE.mailsSend);
  const list = write && hasRole(roles, ROLE.listsRead);
  const detail = hasRole(roles, ROLE.mailsRead);

  let blocked: string | null = null;
  if (!people) {
    blocked = `Mail göndermek için ${ROLE.mailsSend} ya da ${ROLE.mailsWrite} rolü gerekiyor. Gönderim yetkisine ${ASK}`;
  } else if (!hasRole(roles, ROLE.templatesRead)) {
    blocked = `Gönderilecek Mail template'i seçmek için ${ROLE.templatesRead} rolü gerekiyor. Erişime ${ASK}`;
  }
  if (blocked) return { list: false, people: false, detail, blocked, listNote: null };

  const listNote = list
    ? null
    : write
      ? `Mail listelerini görmek için ${ROLE.listsRead} rolü gerekiyor; bu hesapla tek tek kişilere gönderebilirsin.`
      : `Bir mail listesine göndermek ${ROLE.mailsWrite} rolü ister; bu hesapla tek tek kişilere gönderebilirsin.`;
  return { list, people, detail, blocked: null, listNote };
}
