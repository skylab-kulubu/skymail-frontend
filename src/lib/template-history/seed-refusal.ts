/**
 * A Template seed refused for a template because an operator changed it
 * (ADR-0047; ticket 09's `seed_refusal` on the template), in the words the
 * panel shows it in (story 41): when it was first refused with the content it
 * asked for last, which rules held, and what forcing it would do. The record
 * lasts until a seed goes through, so while it is there a repo change is
 * waiting on a decision.
 *
 * The rules are the ones the seed's own report names
 * (src/lib/template-seed/index.ts), said here for an operator rather than a
 * developer: forcing is the developer's step, and the payload hash is only
 * the API's way to tell the same content from new.
 */
import { formatSendTime } from "../sends";
import type { SeedConflictRule, SeedRefusal } from "../templates";

// A Map: the rule comes from the answer, and "constructor" must not find what every object inherits.
const RULE_TEXT: ReadonlyMap<string, string> = new Map<SeedConflictRule, string>([
  ["published_by_operator", "Gönderilen sürümü son Template seed değil, bir operatör yayımladı."],
  [
    "newer_operator_version",
    "Son Template seed'den sonra bir operatör yeni bir sürüm yazdı; yayımlanmamış bir taslak da sayılır.",
  ],
  // After the migration the seed cannot tell an operator's subject from an
  // older repo one; the API errs on the operator's side, and so do the words.
  ["operator_subject", "Gönderilen konuyu bir operatör değiştirdi; seed onun yerine repodaki konuyu yazacaktı."],
]);

/** One conflict rule in plain Turkish; one the panel has no words for is named as it came. */
export function seedRuleText(rule: string): string {
  return RULE_TEXT.get(rule) ?? `Kural: ${rule}.`;
}

export type SeedRefusalText = Readonly<{
  /** When, and that an operator's change is why. */
  headline: string;
  /** Each rule that held. */
  reasons: readonly string[];
  /** What forcing the seed would do. */
  forcing: string;
  /** What not forcing it leaves. */
  unforced: string;
}>;

/** "23 Eyl 2026 00:10", or null for a time that is not one. */
function refusedAt(refusal: SeedRefusal): string | null {
  const when = formatSendTime(refusal.refused_at);
  return when === "—" ? null : when;
}

export function seedRefusalText(refusal: SeedRefusal | null | undefined): SeedRefusalText | null {
  if (!refusal) return null;
  const when = refusedAt(refusal);
  return {
    headline: `${when ? `${when} tarihinde bir` : "Bir"} Template seed, bir operatör değişikliği yüzünden reddedildi; bu template'e hiçbir şey yazılmadı. Repodaki bir değişiklik karar bekliyor.`,
    reasons: refusal.rules.map(seedRuleText),
    forcing:
      "Zorlamak bir geliştiricinin işi. Seed bu template için zorlanırsa repodaki hâli hemen yayımlanır ve gönderilen mail değişir. Operatörlerin sürümleri silinmez: bu geçmişte kalır, karşılaştırılıp geri getirilebilir. Süren taslaklar bayatlar; yayımlanırken yeni sürümle yan yana gösterilir.",
    unforced:
      "Zorlanmazsa repodaki değişiklik bu template'e gelmez ve gönderilen mail olduğu gibi kalır. Repo, gönderilen içeriği aynen tutarsa sonraki seed çakışmadan geçer.",
  };
}

/** The refusal in a few words, for the template's header. */
export function seedRefusalBadge(refusal: SeedRefusal | null | undefined): string | null {
  if (!refusal) return null;
  const when = refusedAt(refusal);
  return when ? `Template seed reddedildi · ${when}` : "Template seed reddedildi";
}
