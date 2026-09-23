/**
 * Whether the checkout the seed runs from holds the newest templates.
 *
 * The seed renders from the working tree, so a checkout missing a template
 * commit writes the older wording over the newer one — and the run still
 * prints a tick per template, which is why this is caught before the first
 * request rather than read out of the output. Only missing commits are the
 * hazard: uncommitted edits and a branch ahead of origin/main are what someone
 * seeding on purpose has.
 *
 * History alone cannot tell a checkout that is behind from one that is only
 * different: a branch synced from main by squash never has main as an
 * ancestor, so every main commit reads as missing though its change is there.
 * So a checkout is refused only when it is an ancestor of origin/main — really
 * behind — and a diverged one is warned about. A refusal that rang on every
 * such run would teach --allow-stale as a reflex, and be passed when it mattered.
 */

/** Where a missing commit changes what the seed writes: the templates, the command, and what renders them. */
export const SEEDED_PATHS = ["emails", "scripts", "src/lib/mail-render", "src/lib/template-seed"];

/** Runs git with these arguments: its trimmed output, or null when it fails. */
export type GitRunner = (args: string[]) => string | null;

export type Freshness =
  | { state: "fresh" | "unchecked"; notes: string[] }
  | { state: "stale" | "diverged"; commits: string[]; notes: string[] };

/**
 * Compares the checkout with origin/main, fetched first when origin can be
 * reached. It refuses nothing itself: "stale" is the checkout to refuse,
 * "diverged" one to warn about, and a check it could not make is "unchecked",
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
    return { state: "unchecked", notes: ["Uyarı: origin/main okunamadı, tazelik kontrolü yapılamadı."] };
  }

  const notes = fetched ? [] : ["Uyarı: origin'e ulaşılamadı; karşılaştırma yerel origin/main ile yapıldı."];
  if (missing === "") {
    return { state: "fresh", notes };
  }
  // After the empty check on purpose: HEAD is its own ancestor, so a checkout
  // at origin/main would read as behind.
  const behind = git(["merge-base", "--is-ancestor", "HEAD", ref]) !== null;
  return { state: behind ? "stale" : "diverged", commits: missing.split("\n"), notes };
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

/** What a diverged run is warned with before it goes on: the commits it cannot vouch for, and how to catch up. */
export function divergedMessage(commits: string[]): string {
  return [
    "Uyarı: çalışma kopyası origin/main ile ayrışmış, tazelik kıyası geride olmayı farklı olmaktan ayıramıyor.",
    `${commits.length} commit bu kopyada yok; eski bir sürümü seed etmediğinden emin ol.`,
    "",
    ...commits.map((commit) => `  ${commit}`),
    "",
    "  Düzeltmek için:  git pull --ff-only origin main && corepack yarn install",
  ].join("\n");
}
