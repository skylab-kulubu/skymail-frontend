/**
 * People as every screen names them, Silinmiş kullanıcı among them (ADR-0051,
 * CONTEXT.md; ticket 27).
 *
 * Erasing an account keeps SkyMail's records and takes the person out of them
 * (skymail-backend #34, `internal/database/account_erasure.go`):
 *
 *  - who sent, submitted, decided, wrote or archived something holds one
 *    fixed subject, the same for everyone erased; a name kept beside it is
 *    the stand-in's, and an approval's submitter has no address any more;
 *  - a Mail onayı request keeps the erased person's place among its people,
 *    so `task_ids[i]` stays the send to `recipients[i]`, with a placeholder
 *    address that never delivers;
 *  - a sent or failed mail to them keeps its queue row, so every count stays,
 *    with the address emptied.
 *
 * Each of these reads as "Silinmiş kullanıcı": never the subject, never the
 * placeholder address, never as someone whose name is merely unknown, and
 * never as the viewer.
 */

/** Silinmiş kullanıcı's subject, wherever a record names who acted. */
export const ERASED_SUBJECT = "00000000-0000-4000-8000-000000000000";

/** The address a Mail onayı request keeps for an erased person it goes to: `.invalid` never delivers. */
export const ERASED_RECIPIENT_EMAIL = "silinmis-kullanici@invalid";

/** What every screen calls an erased person. */
export const ERASED_PERSON = "Silinmiş kullanıcı";

export function isErasedSubject(sub: string | null | undefined): boolean {
  return sub?.trim().toLowerCase() === ERASED_SUBJECT;
}

export function isErasedAddress(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === ERASED_RECIPIENT_EMAIL;
}

/**
 * Whether two subjects are one person: the viewer and an author, a submitter
 * and whoever decided their request. Never for Silinmiş kullanıcı, who stands
 * for everyone erased, and never for a subject nobody knows.
 */
export function samePerson(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && a === b && !isErasedSubject(a);
}

/**
 * Someone who acted — sent, submitted, decided, wrote, archived — by name:
 * Silinmiş kullanıcı whatever the record kept beside the subject; anyone else
 * by name, else by address, else as `unknown`.
 */
export function personLabel(
  person: Readonly<{ sub: string | null; name?: string | null; email?: string | null }>,
  unknown: string,
): string {
  if (isErasedSubject(person.sub)) return ERASED_PERSON;
  return person.name?.trim() || person.email?.trim() || unknown;
}

/** Someone mail goes to, as a screen names them: the address beside the name, null when there is none to show. */
export type RecipientShown = Readonly<{ name: string; address: string | null }>;

const ERASED_RECIPIENT: RecipientShown = { name: ERASED_PERSON, address: null };

/**
 * Someone mail goes to: their name with the address beside it, or the address
 * alone. Silinmiş kullanıcı's placeholder address is never shown, so nothing
 * offers to write to it.
 */
export function recipientLabel(fullName: string | null | undefined, email: string | null | undefined): RecipientShown {
  if (isErasedAddress(email)) return ERASED_RECIPIENT;
  const name = fullName?.trim() ?? "";
  const address = email?.trim() || null;
  return name ? { name, address } : { name: address ?? "", address: null };
}

/**
 * Someone a sent or failed mail went to: a queue row always has a recipient,
 * so one with no address is Silinmiş kullanıcı, whatever name it kept.
 */
export function mailRecipientLabel(fullName: string | null | undefined, email: string | null | undefined): RecipientShown {
  return email?.trim() ? recipientLabel(fullName, email) : ERASED_RECIPIENT;
}
