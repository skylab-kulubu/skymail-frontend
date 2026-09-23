/**
 * Whether the checkout the seed runs from holds the newest templates.
 *
 * The seed renders from the working tree, so a checkout missing a template
 * commit writes the older wording over the newer one — and the run still
 * prints a tick per template, which is why this is caught before the first
 * request rather than read out of the output. Only missing commits are the
 * hazard: uncommitted edits and a branch ahead of origin/main are what someone
 * seeding on purpose has.
 */

/** Where a missing commit changes what the seed writes: the templates, the command, and what renders them. */
export const SEEDED_PATHS = ["emails", "scripts", "src/lib/mail-render", "src/lib/template-seed"];

/** Runs git with these arguments: its trimmed output, or null when it fails. */
export type GitRunner = (args: string[]) => string | null;

export type Freshness =
  | { state: "fresh" | "unchecked"; notes: string[] }
  | { state: "stale"; commits: string[]; notes: string[] };

/**
 * Compares the checkout with origin/main, fetched first when origin can be
 * reached. It refuses nothing itself; a check it could not make is "unchecked",
 * with a note saying why, since a tarball or an offline machine must still seed.
 */
export function checkFreshness(git: GitRunner): Freshness {
  if (git(["rev-parse", "--is-inside-work-tree"]) !== "true") {
    return { state: "unchecked", notes: [] };
  }

  const fetched = git(["fetch", "--quiet", "origin", "main"]) !== null;
  const ref = fetched ? "FETCH_HEAD" : "origin/main";
  const missing = git(["log", "--format=%h %s", `HEAD..${ref}`, "--", ...SEEDED_PATHS]);
  if (missing === null) {
    return { state: "unchecked", notes: [`Uyarı: ${ref} okunamadı, tazelik kontrolü yapılamadı.`] };
  }

  const notes = fetched ? [] : ["Uyarı: origin'e ulaşılamadı; karşılaştırma yerel origin/main ile yapıldı."];
  if (missing === "") {
    return { state: "fresh", notes };
  }
  return { state: "stale", commits: missing.split("\n"), notes };
}

/** Why a stale run is refused: the missing commits, how to catch up, and how to seed anyway. */
export function staleMessage(commits: string[], seedCommand: string): string {
  return [
    `Çalışma kopyası origin/main'in gerisinde: ${SEEDED_PATHS.map((path) => `${path}/`).join(", ")} altında ${commits.length} commit eksik.`,
    "Bu hâlde seed eski şablonları yeninin üstüne yazar ve çıktı bunu söylemez — her şablon yine ✓ görünür.",
    "",
    ...commits.map((commit) => `  ${commit}`),
    "",
    "  Düzeltmek için:  git pull --ff-only origin main && corepack yarn install",
    `  Bilerek eskiyi yazacaksan: ${seedCommand} --allow-stale`,
  ].join("\n");
}
