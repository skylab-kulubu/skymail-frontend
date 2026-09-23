/**
 * The Template seed: writes the Mail templates in emails/ into SkyMail by
 * Template key (`PUT /v1/templates/by-key/{key}`).
 *
 * Each template goes with its own .tsx source as the JSX source, and with the
 * render the render module makes of that source — the same text the panel's
 * JSX mode compiles, so the panel opens exactly what was seeded and sends the
 * same mail (jsx.test.ts compares that render with the component's).
 *
 * SkyMail refuses a template an operator changed since the last seed
 * (ADR-0047) with 409 `template.seed_conflict`, and writes nothing to it. The
 * run goes on with the other templates, then lists the refused ones with the
 * rules that held and the command that forces each, and fails. A forced
 * template is written anyway; the operator's versions stay in its history.
 *
 * scripts/seed-templates.ts is the command; this module is what it does, with
 * the network and the terminal handed in.
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { TemplateMeta } from "../../../emails/types";
import { apiErrorFromResponse } from "../api/errors";
import { renderSource } from "../mail-render";

const EMAILS_DIR = join(import.meta.dirname, "..", "..", "..", "emails");

/** The Template key a template's file declares in its meta. */
const DECLARED_KEY = /\bkey:\s*"([^"]+)"/;

/** How the seed is run, for the commands the report prints. */
export const SEED_COMMAND = "corepack yarn emails:seed";

/** A template as the repo holds it: its meta and the text of its .tsx file. */
export interface RepoTemplate {
  meta: TemplateMeta;
  source: string;
}

/**
 * Each template with the text of the .tsx file that declares its key — what
 * the seed sends as its JSX source. The folder also holds shared pieces
 * (theme, action-mail) that declare none. Two files declaring one key, or a
 * registered template with no file, is an error: the wrong text would be
 * seeded, or none.
 */
export async function templateSources(
  templates: { meta: TemplateMeta }[],
  dir = EMAILS_DIR,
): Promise<RepoTemplate[]> {
  const files = new Map<string, { file: string; text: string }>();
  for (const file of (await readdir(dir)).filter((name) => name.endsWith(".tsx")).sort()) {
    const text = await readFile(join(dir, file), "utf8");
    const key = DECLARED_KEY.exec(text)?.[1];
    if (key === undefined) {
      continue;
    }
    const other = files.get(key);
    if (other) {
      throw new Error(`key: "${key}" iki dosyada tanımlı: ${other.file} ve ${file}.`);
    }
    files.set(key, { file, text });
  }
  return templates.map(({ meta }) => {
    const found = files.get(meta.key);
    if (!found) {
      throw new Error(`${dir} içinde key: "${meta.key}" tanımlayan bir .tsx yok.`);
    }
    return { meta, source: found.text };
  });
}

/** Which templates a run writes over an operator's change. */
export interface ForceOption {
  all: boolean;
  keys: string[];
}

export interface SeedRun {
  /** The SkyMail API root, without /v1. */
  baseUrl: string;
  token: string;
  templates: RepoTemplate[];
  dryRun: boolean;
  force: ForceOption;
  fetch: typeof globalThis.fetch;
  /** Prints one line of the run's report. */
  print: (line: string) => void;
}

export type SeedArgs = { ok: true; dryRun: boolean; force: ForceOption } | { ok: false; message: string };

/**
 * Reads the command line: --dry-run, --force=<key>[,<key>] (repeatable) and
 * --force-all. keys are the templates the run seeds; forcing any other is a
 * mistake, since it would run a seed that forces nothing.
 */
export function parseSeedArgs(argv: string[], keys: string[]): SeedArgs {
  let dryRun = false;
  let all = false;
  const forced: string[] = [];
  for (const arg of argv) {
    if (arg === "--") {
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--force-all") {
      all = true;
    } else if (arg === "--force" || arg.startsWith("--force=")) {
      const named = arg.slice("--force=".length).split(",").filter((key) => key !== "");
      if (named.length === 0) {
        return {
          ok: false,
          message: "--force hangi şablonların zorlanacağını söylemeli: --force=<anahtar>[,<anahtar>] ya da --force-all.",
        };
      }
      const unknown = named.filter((key) => !keys.includes(key));
      if (unknown.length > 0) {
        return {
          ok: false,
          message: `--force bilinmeyen anahtar: ${unknown.join(", ")}. Seed'in anahtarları emails/CATALOG.md'de.`,
        };
      }
      forced.push(...named.filter((key) => !forced.includes(key)));
    } else {
      return {
        ok: false,
        message: `Bilinmeyen seçenek: ${arg}. Seçenekler: --dry-run, --force=<anahtar>[,<anahtar>], --force-all.`,
      };
    }
  }
  return { ok: true, dryRun, force: { all, keys: all ? [] : forced } };
}

/** A version a refusal or a force names: its summary, as skymail-backend's version routes serve it. */
interface ConflictVersion {
  id: string;
  seq: number;
  subject: string;
  author: { kind: string; name: string | null };
  created_at: string;
  published_at: string | null;
}

/** What a forced seed wrote over (skymail-backend handlers.SeedOverride). */
interface Override {
  rules: string[];
  published_version: ConflictVersion | null;
  operator_versions: ConflictVersion[];
}

/** The params of 409 template.seed_conflict, as far as the report reads them. */
interface SeedConflict {
  rules: string[];
  published_version: ConflictVersion | null;
  last_seed_version: ConflictVersion | null;
  operator_versions: ConflictVersion[];
  subject: string;
  requested_subject: string;
}

/** What a refusal that names nothing reads as. */
const NO_CONFLICT: SeedConflict = {
  rules: [],
  published_version: null,
  last_seed_version: null,
  operator_versions: [],
  subject: "",
  requested_subject: "",
};

interface Refusal {
  key: string;
  conflict: SeedConflict;
}

/** A template's upsert body: what the repo holds, and the module's render of its source. */
interface SeedPayload {
  name: string;
  subject: string;
  html_content: string;
  plain_text_content: string;
  react_email_content: string;
  system: boolean;
  contract_required_variables: NonNullable<TemplateMeta["requiredVariables"]>;
}

/** Runs the seed and resolves to the exit code the command should end with. */
export async function runSeed(run: SeedRun): Promise<number> {
  // Every template renders before anything is sent: a broken one stops the
  // run with nothing half-written.
  const payloads: { meta: TemplateMeta; payload: SeedPayload }[] = [];
  for (const { meta, source } of run.templates) {
    const rendered = await renderSource({ mode: "jsx", source });
    if (!rendered.ok) {
      run.print(`${meta.key}: ${rendered.message}`);
      run.print("Hiçbir şey gönderilmedi.");
      return 1;
    }
    payloads.push({
      meta,
      payload: {
        name: meta.name,
        subject: meta.subject,
        html_content: rendered.html,
        plain_text_content: rendered.plainText,
        react_email_content: source,
        system: meta.system,
        // The repo is where the sending service's contract is known, so the
        // seed always sends it: none declared is an empty set, not a set left
        // alone.
        contract_required_variables: meta.requiredVariables ?? [],
      },
    });
  }

  if (run.dryRun) {
    run.print(`[kuru çalışma] ${run.baseUrl} üzerine hiçbir şey yazılmayacak.\n`);
    for (const { meta } of payloads) {
      const marks = [meta.system && "[sistem]", isForced(run.force, meta.key) && "[zorla]"].filter(Boolean).join(" ");
      run.print(`· ${meta.key.padEnd(34)} ${marks ? `${marks} ` : ""}"${meta.subject}"`);
    }
    return 0;
  }

  let written = 0;
  let failed = false;
  const refusals: Refusal[] = [];
  for (const [index, { meta, payload }] of payloads.entries()) {
    const forced = isForced(run.force, meta.key);
    const outcome = await upsert(run, meta.key, payload, forced);
    if (outcome.kind === "written") {
      written += 1;
      run.print(`✓ ${meta.key.padEnd(34)} ${outcome.id}${forced ? `  (${forceNote(outcome.overrode)})` : ""}`);
    } else if (outcome.kind === "refused") {
      refusals.push({ key: meta.key, conflict: outcome.conflict });
      run.print(`✗ ${meta.key.padEnd(34)} reddedildi: son seed'den sonra bir operatör değiştirmiş`);
    } else {
      // Anything else — a token that expired, a server that fails — would
      // fail the rest the same way.
      failed = true;
      run.print(`✗ ${meta.key.padEnd(34)} yazılamadı: ${outcome.reason}`);
      const untried = payloads.slice(index + 1).map(({ meta }) => meta.key);
      if (untried.length > 0) {
        run.print(`Seed durdu; denenmeyenler: ${untried.join(", ")}`);
      }
      break;
    }
  }

  run.print(`\n${written} şablon ${run.baseUrl} üzerine yazıldı.`);
  reportRefusals(run.print, refusals);
  run.print(
    "\nRepoda olmayan anahtarlar silinmedi — canlı bir servisin çağırdığı şablonu arşivlemek postayı sessizce durdurur.",
  );
  return failed || refusals.length > 0 ? 1 : 0;
}

const isForced = (force: ForceOption, key: string) => force.all || force.keys.includes(key);

type Outcome =
  | { kind: "written"; id: string; overrode: Override | null }
  | { kind: "refused"; conflict: SeedConflict }
  | { kind: "failed"; reason: string };

async function upsert(run: SeedRun, key: string, payload: SeedPayload, forced: boolean): Promise<Outcome> {
  const url = `${run.baseUrl}/v1/templates/by-key/${encodeURIComponent(key)}${forced ? "?force=true" : ""}`;
  let response: Response;
  try {
    response = await run.fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${run.token}` },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    return { kind: "failed", reason: `sunucuya ulaşılamadı (${cause})` };
  }
  if (response.ok) {
    let saved: { id?: unknown; overrode?: Override };
    try {
      saved = (await response.json()) as typeof saved;
    } catch {
      saved = {};
    }
    if (typeof saved.id !== "string") {
      return { kind: "failed", reason: `sunucudan okunamayan bir yanıt geldi (HTTP ${response.status})` };
    }
    return { kind: "written", id: saved.id, overrode: saved.overrode ?? null };
  }
  const error = apiErrorFromResponse(response.status, await response.text());
  if (response.status === 409 && error.code === "template.seed_conflict") {
    return { kind: "refused", conflict: { ...NO_CONFLICT, ...(error.params as Partial<SeedConflict> | undefined) } };
  }
  return { kind: "failed", reason: `HTTP ${response.status} ${error.code} — ${error.message}` };
}

function reportRefusals(print: (line: string) => void, refusals: Refusal[]): void {
  if (refusals.length === 0) {
    return;
  }
  print(
    `\n${refusals.length} şablon reddedildi: son seed'den sonra bir operatör değiştirmiş, üzerlerine hiçbir şey yazılmadı.`,
  );
  for (const { key, conflict } of refusals) {
    print(`\n  ${key}`);
    for (const reason of reasons(conflict)) {
      print(`    ${reason}`);
    }
    print(`    Zorlamak için: ${SEED_COMMAND} --force=${key}`);
  }
  const keys = refusals.map(({ key }) => key).join(",");
  print(`\nReddedilenlerin hepsini zorlamak için: ${SEED_COMMAND} --force=${keys}`);
  print(`Her şablonu zorlamak için: ${SEED_COMMAND} --force-all`);
  print(
    "Zorlamak operatörün çalışmasını silmez: sürümleri SkyMail'de şablonun geçmişinde kalır ve oradan geri getirilebilir.",
  );
  print("Repo, operatörün yayımladığı içeriği aynen tutarsa seed o şablonda çakışmadan geçer.");
}

const who = (version: ConflictVersion) => version.author.name ?? "adı bilinmiyor";

const DAY = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "Europe/Istanbul" });

// A report must not be more fragile than what it reports on: a missing or
// malformed timestamp says so instead of throwing (and losing the list of
// refused templates) or printing 1 January 1970 for a null.
function dayOf(value: string | null | undefined): string {
  const at = value ? new Date(value) : null;
  return at && !Number.isNaN(at.getTime()) ? DAY.format(at) : "tarih yok";
}

/**
 * What a forced seed says it wrote over: each operator version by number,
 * state, author and day, and an operator's subject — or that it overrode
 * nothing, when the template was the last seed's all along.
 */
function forceNote(overrode: Override | null): string {
  if (!overrode) {
    return "zorlandı, ezilen yok";
  }
  const versions = new Map<string, ConflictVersion>();
  const published = overrode.published_version;
  if (published && published.author.kind === "operator") {
    versions.set(published.id, published);
  }
  for (const version of overrode.operator_versions) {
    versions.set(version.id, version);
  }
  const replaced = [...versions.values()]
    .sort((a, b) => a.seq - b.seq)
    .map((version) => {
      const state = version.published_at === null ? "taslak" : "yayımlanmış sürüm";
      const day = dayOf(version.published_at ?? version.created_at);
      return `#${version.seq} ${state}, ${who(version)}, ${day}`;
    });
  if (overrode.rules.includes("operator_subject") && published) {
    replaced.push(`operatörün konusu "${published.subject}"`);
  }
  if (replaced.length === 0) {
    replaced.push(overrode.rules.join(", "));
  }
  return `zorlandı: ${replaced.join("; ")} — geçmişte duruyor, geri getirilebilir`;
}

const numbered = (version: ConflictVersion) =>
  `#${version.seq} ${version.published_at === null ? "taslak" : "yayımlı"} (${who(version)})`;

/** Each rule that held, in words, with the versions involved. */
function reasons(conflict: SeedConflict): string[] {
  const lastSeed = conflict.last_seed_version;
  return conflict.rules.map((rule) => {
    switch (rule) {
      case "published_by_operator": {
        const since = lastSeed ? `son seed #${lastSeed.seq}` : "bu şablonu hiçbir seed yazmamış";
        const published = conflict.published_version;
        return published
          ? `Gönderilen sürüm #${published.seq} bir operatörün (${who(published)}); ${since}.`
          : `Gönderilen sürüm son seed'in değil; ${since}.`;
      }
      case "newer_operator_version":
        return `Son seed'den sonra operatör sürümleri var: ${conflict.operator_versions.map(numbered).join(", ")}.`;
      case "operator_subject":
        return `Konu operatörün: şu an "${conflict.subject}", repo "${conflict.requested_subject}" istiyor.`;
      default:
        return `Kural: ${rule}.`;
    }
  });
}
