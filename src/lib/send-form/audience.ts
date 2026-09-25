/**
 * Individual people as a send's audience (ticket 16): name and e-mail rows,
 * each sent on its own (`POST /mail_tasks/single`). What the form catches
 * before anything goes out, row by row: an address that is not one and the
 * same address twice stop the send; a missing name where the mail greets by
 * it is pointed out and goes if the sender wants (the API needs no name). The
 * API checks addresses properly and a refusal is reported per person
 * (send.ts), or — for a request for approval, which carries them all — on
 * the row it names (mail-approvals/refusals.ts).
 */
import { isPlausibleEmail } from "../mailing-lists";

export type PersonRow = Readonly<{ name: string; email: string }>;

/** What keeps one row from being sent to. */
export type RowProblems = Readonly<{ email?: string }>;

export type PeopleCheck = Readonly<{
  /** The filled rows, trimmed: the people sent to once nothing is wrong. */
  people: readonly PersonRow[];
  /** One entry per row as given, empty where the row is fine or empty. */
  rows: readonly RowProblems[];
  /** One entry per row as given: what may be a slip in it, or null. */
  warnings: readonly (string | null)[];
  /** No row names anyone. */
  none: boolean;
}>;

export const NAME_EXPECTED = "Bu mail alıcıyı adıyla anıyor ({{.FullName}}); adı boş giderse selamlama eksik kalır.";

export const EMAIL_MISSING = "E-posta adresini yaz.";

/** What a row says when its address is `firstRow`'s (counted from 0) again. */
export const repeatedAddress = (firstRow: number) => `Bu adres ${firstRow + 1}. satırda da var; herkese bir kez gönderilir.`;

/** A row the send goes to: one that names someone. An empty row is left out. */
const namesSomeone = (row: PersonRow) => row.name.trim() !== "" || row.email.trim() !== "";

/** The rows a send goes to, by their place among the rows as given: `[i]` is the row of its `i`th person. */
export const sentRows = (rows: readonly PersonRow[]): number[] => rows.flatMap((row, index) => (namesSomeone(row) ? [index] : []));

/** `nameExpected`: the mail uses the recipient's name. */
export function peopleProblems(rows: readonly PersonRow[], { nameExpected = false }: { nameExpected?: boolean } = {}): PeopleCheck {
  const seen = new Map<string, number>();
  const people: PersonRow[] = [];
  const warnings = rows.map((row) =>
    nameExpected && row.name.trim() === "" && row.email.trim() !== "" ? NAME_EXPECTED : null,
  );
  const problems = rows.map((row, index): RowProblems => {
    if (!namesSomeone(row)) return {};
    const name = row.name.trim();
    const email = row.email.trim();
    people.push({ name, email });
    const found: { email?: string } = {};
    if (email === "") {
      found.email = EMAIL_MISSING;
    } else if (!isPlausibleEmail(email)) {
      found.email = "Geçerli bir e-posta adresi gir.";
    } else {
      // An address is not Turkish text: ALI@ is ali@, not alı@.
      const key = email.toLowerCase();
      const first = seen.get(key);
      if (first === undefined) seen.set(key, index);
      else found.email = repeatedAddress(first);
    }
    return found;
  });
  return { people, rows: problems, warnings, none: people.length === 0 };
}

/** Whether the people may be sent to: someone, and nothing wrong with any row. */
export const peopleReady = (check: PeopleCheck) => !check.none && check.rows.every((row) => !row.email);

/**
 * People pasted in at once: one per line, or split by commas and
 * semicolons; each as `Ad Soyad <adres>`, `Ad Soyad⇥adres` (a spreadsheet's
 * two columns) or a bare address. What is not an address is kept as typed,
 * for its row to say so.
 */
export function parsePeople(text: string): PersonRow[] {
  const people: PersonRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const columns = line.split("\t");
    if (columns.length === 2 && columns[1].includes("@")) {
      people.push({ name: columns[0].trim(), email: columns[1].trim() });
      continue;
    }
    for (const entry of line.split(/[,;]/)) {
      const trimmed = entry.trim();
      if (trimmed === "") continue;
      const named = /^(.*?)\s*<([^>]*)>$/.exec(trimmed);
      people.push(named ? { name: named[1].trim(), email: named[2].trim() } : { name: "", email: trimmed });
    }
  }
  return people;
}
