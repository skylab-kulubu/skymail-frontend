/**
 * Individual people as a send's audience (ticket 16): name and e-mail rows,
 * each sent on its own (`POST /mail_tasks/single`). What the form catches
 * before anything goes out, row by row; the API checks addresses properly
 * and a refusal is reported per person (send.ts).
 */
import { isPlausibleEmail } from "../mailing-lists";

export type PersonRow = Readonly<{ name: string; email: string }>;

/** What is wrong with one row, by field. */
export type RowProblems = Readonly<{ name?: string; email?: string }>;

export type PeopleCheck = Readonly<{
  /** The filled rows, trimmed: the people sent to once nothing is wrong. */
  people: readonly PersonRow[];
  /** One entry per row as given, empty where the row is fine or empty. */
  rows: readonly RowProblems[];
  /** No row names anyone. */
  none: boolean;
}>;

export const NAME_NEEDED = "Bu mail alıcıyı adıyla anıyor ({{.FullName}}); adını yaz.";

export function peopleProblems(rows: readonly PersonRow[], { nameRequired = false }: { nameRequired?: boolean } = {}): PeopleCheck {
  const seen = new Map<string, number>();
  const people: PersonRow[] = [];
  const problems = rows.map((row, index): RowProblems => {
    const name = row.name.trim();
    const email = row.email.trim();
    if (name === "" && email === "") return {};
    people.push({ name, email });
    const found: { name?: string; email?: string } = {};
    if (nameRequired && name === "") found.name = NAME_NEEDED;
    if (email === "") {
      found.email = "E-posta adresini yaz.";
    } else if (!isPlausibleEmail(email)) {
      found.email = "Geçerli bir e-posta adresi gir.";
    } else {
      // An address is not Turkish text: ALI@ is ali@, not alı@.
      const key = email.toLowerCase();
      const first = seen.get(key);
      if (first === undefined) seen.set(key, index);
      else found.email = `Bu adres ${first + 1}. satırda da var; herkese bir kez gönderilir.`;
    }
    return found;
  });
  return { people, rows: problems, none: people.length === 0 };
}

/** Whether the people may be sent to: someone, and nothing wrong with any row. */
export const peopleReady = (check: PeopleCheck) => !check.none && check.rows.every((row) => !row.name && !row.email);

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
