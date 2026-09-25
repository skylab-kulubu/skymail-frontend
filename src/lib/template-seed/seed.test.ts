/**
 * The Template seed, driven with a scripted fetch that answers the way
 * skymail-backend's by-key upsert does (`PUT /v1/templates/by-key/{key}`,
 * ticket 09): what each request carries, which templates it forces, and what
 * a run prints and exits with when SkyMail refuses a template an operator
 * changed.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { templates as repoTemplates } from "../../../emails";
import type { TemplateMeta } from "../../../emails/types";
import { json, scriptedFetch, type RecordedCall } from "../api/testing";
import { parseSeedArgs, runSeed, templateSources, type SeedRun, type RepoTemplate } from ".";

const BASE_URL = "https://skymail.example.test";

function template(key: string, text: string, overrides: Partial<TemplateMeta> = {}): RepoTemplate {
  return {
    meta: {
      key,
      name: `Ad ${key}`,
      subject: `Konu ${key}`,
      system: false,
      brand: "skylab",
      trigger: "test",
      variables: [],
      sample: {},
      ...overrides,
    },
    source: `import { Text } from "@react-email/components";\n\nexport default () => <Text>${text}</Text>;\n`,
  };
}

/** A template as the upsert answers with it. */
const seeded = (key: string) => json(200, { id: `id-${key}`, key, subject: `Konu ${key}` });

const operator = (name: string) => ({ kind: "operator", sub: `sub-${name}`, name });
const templateSeed = { kind: "template_seed", sub: "sub-seed", name: "service-account-skymail-seed" };

/** A version as skymail-backend's version routes summarise it. */
function summary(
  seq: number,
  author: { kind: string; sub: string; name: string },
  publishedAt: string | null,
  subject = "Konu",
  createdAt = publishedAt ?? "2026-09-20T09:00:00Z",
) {
  return {
    id: `v${seq}`,
    template_id: "id-template",
    seq,
    name: "Ad",
    subject,
    requested_subject: null,
    main_mode: "html",
    author,
    created_at: createdAt,
    published_at: publishedAt,
    base_version_id: null,
    current: false,
    discarded: false,
  };
}

/** skymail-backend's refusal of a template an operator changed since the last seed. */
function refused(key: string, params: Record<string, unknown>): Response {
  return json(409, {
    code: "template.seed_conflict",
    message:
      "An operator changed this template since the last Template seed, so nothing was written. To overwrite it, seed with ?force=true.",
    params: {
      key,
      template_id: `id-${key}`,
      published_version: null,
      last_seed_version: null,
      operator_versions: [],
      subject: `Konu ${key}`,
      requested_subject: `Konu ${key}`,
      ...params,
    },
  });
}

/** Runs the seed and collects what it printed. */
async function run(options: Partial<SeedRun> & Pick<SeedRun, "templates" | "fetch">) {
  const lines: string[] = [];
  const exitCode = await runSeed({
    baseUrl: BASE_URL,
    token: "seed-token",
    dryRun: false,
    force: { all: false, keys: [] },
    print: (line) => lines.push(line),
    ...options,
  });
  return { exitCode, output: lines.join("\n") };
}

const bodyOf = (call: RecordedCall) => JSON.parse(call.body ?? "null") as Record<string, unknown>;

describe("the Template seed", () => {
  it("sends each template's own source as its JSX source, with the render the module makes of it", async () => {
    const welcome = template("core.welcome", "Hoş geldin", {
      system: true,
      requiredVariables: [{ name: "link", reason: "Bağlantı." }],
    });
    const { fetch, calls } = scriptedFetch(seeded("core.welcome"));

    const { exitCode, output } = await run({ templates: [welcome], fetch });

    assert.equal(exitCode, 0, output);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "PUT");
    assert.equal(calls[0].url, `${BASE_URL}/v1/templates/by-key/core.welcome`);
    assert.equal(calls[0].headers.get("Authorization"), "Bearer seed-token");
    const body = bodyOf(calls[0]);
    assert.equal(body.react_email_content, welcome.source);
    assert.equal(body.plain_text_content, "Hoş geldin");
    assert.match(String(body.html_content), /<p[^>]*>\s*Hoş geldin\s*<\/p>/);
    assert.deepEqual(
      { name: body.name, subject: body.subject, system: body.system, contract: body.contract_required_variables },
      { name: "Ad core.welcome", subject: "Konu core.welcome", system: true, contract: [{ name: "link", reason: "Bağlantı." }] },
    );
    assert.match(output, /✓ core\.welcome\s+id-core\.welcome/);
    assert.match(output, /1 şablon https:\/\/skymail\.example\.test üzerine yazıldı\./);
  });

  it("goes on past a template SkyMail refuses, then lists it with why and how to force it, and fails", async () => {
    const templates = [
      template("free.basic", "Serbest"),
      template("keycloak.reset-password", "Parola"),
      template("core.welcome", "Hoş geldin"),
      template("core.certificate", "Sertifika"),
    ];
    const { fetch, calls } = scriptedFetch(
      seeded("free.basic"),
      refused("keycloak.reset-password", {
        rules: ["published_by_operator", "newer_operator_version"],
        published_version: { id: "v3", seq: 3, author: operator("Ada Yılmaz"), published_at: "2026-09-20T09:00:00Z" },
        last_seed_version: { id: "v1", seq: 1, author: templateSeed, published_at: "2026-09-01T09:00:00Z" },
        operator_versions: [
          { id: "v2", seq: 2, author: operator("Ada Yılmaz"), published_at: null },
          { id: "v3", seq: 3, author: operator("Ada Yılmaz"), published_at: "2026-09-20T09:00:00Z" },
          { id: "v4", seq: 4, author: operator("Can Demir"), published_at: null },
        ],
      }),
      refused("core.welcome", {
        rules: ["operator_subject"],
        subject: "Aramıza hoş geldin",
        requested_subject: "SKY LAB'e hoş geldin",
      }),
      seeded("core.certificate"),
    );

    const { exitCode, output } = await run({ templates, fetch });

    assert.equal(exitCode, 1, output);
    assert.equal(calls.length, 4, "the templates after a refused one are still seeded");
    assert.match(output, /✓ free\.basic/);
    assert.match(output, /✗ keycloak\.reset-password\s+reddedildi/);
    assert.match(output, /✓ core\.certificate/);
    assert.match(output, /2 şablon https:\/\/skymail\.example\.test üzerine yazıldı\./);
    assert.match(output, /2 şablon reddedildi/);

    // Why, in the words of each rule that held, with the versions involved.
    assert.match(output, /Gönderilen sürüm #3 bir operatörün \(Ada Yılmaz\); son seed #1\./);
    assert.match(output, /Son seed'den sonra operatör sürümleri var: #2 taslak \(Ada Yılmaz\), #3 yayımlı \(Ada Yılmaz\), #4 taslak \(Can Demir\)\./);
    assert.match(output, /Konu operatörün: şu an "Aramıza hoş geldin", repo "SKY LAB'e hoş geldin" istiyor\./);

    // How to force each, and all of them at once.
    assert.match(output, /^ {4}Zorlamak için: corepack yarn emails:seed --force=keycloak\.reset-password$/m);
    assert.match(output, /^ {4}Zorlamak için: corepack yarn emails:seed --force=core\.welcome$/m);
    assert.match(output, /^Reddedilenlerin hepsini zorlamak için: corepack yarn emails:seed --force=keycloak\.reset-password,core\.welcome$/m);
    assert.match(output, /corepack yarn emails:seed --force-all/);
    assert.match(output, /geçmiş/, "says the operator's versions stay in the history");
  });

  it("forces only the templates it is told to, and says what each force wrote over", async () => {
    const templates = [
      template("free.basic", "Serbest"),
      template("core.welcome", "Hoş geldin"),
      template("core.certificate", "Sertifika"),
      template("keycloak.reset-password", "Parola"),
    ];
    const named = scriptedFetch(
      seeded("free.basic"),
      json(200, {
        id: "id-core.welcome",
        overrode: {
          rules: ["published_by_operator", "newer_operator_version"],
          published_version: summary(3, operator("Can Demir"), "2026-09-22T09:00:00Z", "Aramıza hoş geldin"),
          operator_versions: [
            summary(3, operator("Can Demir"), "2026-09-22T09:00:00Z", "Aramıza hoş geldin"),
            summary(4, operator("Ada Yılmaz"), null, "Taslak", "2026-09-23T08:00:00Z"),
          ],
        },
      }),
      json(200, {
        id: "id-core.certificate",
        overrode: {
          rules: ["operator_subject"],
          published_version: summary(2, templateSeed, "2026-09-10T09:00:00Z", "Sertifikan hazır 🎓"),
          operator_versions: [],
        },
      }),
      seeded("keycloak.reset-password"),
    );

    const { exitCode, output } = await run({
      templates,
      fetch: named.fetch,
      force: { all: false, keys: ["core.welcome", "core.certificate", "keycloak.reset-password"] },
    });

    assert.equal(exitCode, 0, output);
    assert.deepEqual(
      named.calls.map(({ url }) => url),
      [
        `${BASE_URL}/v1/templates/by-key/free.basic`,
        `${BASE_URL}/v1/templates/by-key/core.welcome?force=true`,
        `${BASE_URL}/v1/templates/by-key/core.certificate?force=true`,
        `${BASE_URL}/v1/templates/by-key/keycloak.reset-password?force=true`,
      ],
    );
    assert.match(output, /✓ free\.basic\s+id-free\.basic$/m);
    assert.match(
      output,
      /✓ core\.welcome\s+id-core\.welcome {2}\(zorlandı: #3 yayımlanmış sürüm, Can Demir, 22 Eyl; #4 taslak, Ada Yılmaz, 23 Eyl — geçmişte duruyor, geri getirilebilir\)$/m,
    );
    assert.match(
      output,
      /✓ core\.certificate\s+id-core\.certificate {2}\(zorlandı: operatörün konusu "Sertifikan hazır 🎓" — geçmişte duruyor, geri getirilebilir\)$/m,
    );
    assert.match(output, /✓ keycloak\.reset-password\s+id-keycloak\.reset-password {2}\(zorlandı, ezilen yok\)$/m);

    const all = scriptedFetch(seeded("free.basic"), seeded("core.welcome"));
    await run({ templates, fetch: all.fetch, force: { all: true, keys: [] } });
    assert.ok(all.calls.every(({ url }) => url.endsWith("?force=true")), "--force-all forces every template");
  });

  // The Actions logs of this public repo are public: a run there names nobody,
  // while a person seeding in their own terminal still sees who changed what.
  it("names no operator when told to hide names, and says the same thing otherwise", async () => {
    const templates = [template("keycloak.reset-password", "Parola"), template("core.welcome", "Hoş geldin")];
    const { fetch } = scriptedFetch(
      refused("keycloak.reset-password", {
        rules: ["published_by_operator", "newer_operator_version"],
        published_version: { id: "v3", seq: 3, author: operator("Ada Yılmaz"), published_at: "2026-09-20T09:00:00Z" },
        last_seed_version: { id: "v1", seq: 1, author: templateSeed, published_at: "2026-09-01T09:00:00Z" },
        operator_versions: [
          { id: "v2", seq: 2, author: operator("Ada Yılmaz"), published_at: null },
          { id: "v4", seq: 4, author: operator("Can Demir"), published_at: null },
        ],
      }),
      json(200, {
        id: "id-core.welcome",
        overrode: {
          rules: ["published_by_operator"],
          published_version: summary(3, operator("Can Demir"), "2026-09-22T09:00:00Z", "Aramıza hoş geldin"),
          operator_versions: [summary(3, operator("Can Demir"), "2026-09-22T09:00:00Z", "Aramıza hoş geldin")],
        },
      }),
    );

    const { output } = await run({ templates, fetch, force: { all: false, keys: ["core.welcome"] }, hideNames: true });

    assert.doesNotMatch(output, /Ada Yılmaz|Can Demir/);
    assert.match(output, /Gönderilen sürüm #3 bir operatörün \(bir operatör\); son seed #1\./);
    assert.match(output, /Son seed'den sonra operatör sürümleri var: #2 taslak \(bir operatör\), #4 taslak \(bir operatör\)\./);
    assert.match(output, /zorlandı: #3 yayımlanmış sürüm, bir operatör, 22 Eyl/);
  });

  // A report must not be more fragile than what it reports on: one malformed
  // timestamp in an answer must not throw away the list of refused templates.
  it("says a missing or malformed date instead of losing the report to it", async () => {
    const templates = [template("core.welcome", "Hoş geldin"), template("core.certificate", "Sertifika")];
    const scripted = scriptedFetch(
      json(200, {
        id: "id-core.welcome",
        overrode: {
          rules: ["published_by_operator"],
          published_version: summary(3, operator("Can Demir"), "bozuk", "Konu", ""),
          operator_versions: [summary(4, operator("Ada Yılmaz"), null, "Taslak", "")],
        },
      }),
      refused("core.certificate", { rules: ["published_by_operator"] }),
    );

    const { exitCode, output } = await run({
      templates,
      fetch: scripted.fetch,
      force: { all: false, keys: ["core.welcome"] },
    });

    assert.equal(exitCode, 1, output);
    assert.match(output, /#3 yayımlanmış sürüm, Can Demir, tarih yok; #4 taslak, Ada Yılmaz, tarih yok/);
    assert.match(output, /core\.certificate/, "the refused template is still reported");
  });

  it("stops at an answer that is not a refusal, says why, and still lists what was refused before it", async () => {
    const templates = [template("free.basic", "Serbest"), template("core.welcome", "Hoş geldin"), template("core.certificate", "Sertifika")];
    const { fetch, calls } = scriptedFetch(
      refused("free.basic", { rules: ["newer_operator_version"], operator_versions: [{ id: "v2", seq: 2, author: operator("Ada Yılmaz"), published_at: null }] }),
      json(401, { code: "server.unauthorized", message: "Unauthorized" }),
    );

    const { exitCode, output } = await run({ templates, fetch });

    assert.equal(exitCode, 1, output);
    assert.equal(calls.length, 2, "nothing is sent after a failure that is not a refusal");
    assert.match(output, /✗ core\.welcome\s+yazılamadı: HTTP 401 server\.unauthorized/);
    assert.match(output, /Oturumun sona erdi/, "says why in Turkish");
    assert.match(output, /core\.certificate/, "names what was not tried");
    assert.match(output, /1 şablon reddedildi/);
    assert.match(output, /--force=free\.basic/);
  });

  it("reports what it refused before an answer it cannot read, and fails", async () => {
    const templates = [template("free.basic", "Serbest"), template("core.welcome", "Hoş geldin"), template("core.certificate", "Sertifika")];
    const { fetch, calls } = scriptedFetch(
      refused("free.basic", { rules: ["newer_operator_version"], operator_versions: [summary(2, operator("Ada Yılmaz"), null)] }),
      new Response("<html>Bad Gateway</html>", { status: 200, headers: { "Content-Type": "text/html" } }),
    );

    const { exitCode, output } = await run({ templates, fetch });

    assert.equal(exitCode, 1, output);
    assert.equal(calls.length, 2);
    assert.match(output, /✗ core\.welcome\s+yazılamadı: sunucudan okunamayan bir yanıt geldi \(HTTP 200\)/);
    assert.match(output, /denenmeyenler: core\.certificate/);
    assert.match(output, /1 şablon reddedildi/);
    assert.match(output, /--force=free\.basic/);
  });

  it("sends nothing when a template's source does not render, and says which", async () => {
    const broken = { ...template("core.welcome", "Hoş geldin"), source: "export default () => <p>Kırık</p" };
    const { fetch, calls } = scriptedFetch();

    const { exitCode, output } = await run({ templates: [template("free.basic", "Serbest"), broken], fetch });

    assert.equal(exitCode, 1, output);
    assert.equal(calls.length, 0);
    assert.match(output, /core\.welcome: Kod derlenemedi/);
  });

  it("sends nothing in a dry run, and lists each template with what the run would force", async () => {
    const templates = [template("free.basic", "Serbest"), template("core.welcome", "Hoş geldin", { system: true })];
    const { fetch, calls } = scriptedFetch();

    const { exitCode, output } = await run({ templates, fetch, dryRun: true, token: "", force: { all: false, keys: ["core.welcome"] } });

    assert.equal(exitCode, 0, output);
    assert.equal(calls.length, 0);
    assert.match(output, /kuru çalışma/);
    assert.match(output, /^· free\.basic\s+"Konu free\.basic"$/m);
    assert.match(output, /^· core\.welcome\s+\[sistem\] \[zorla\] "Konu core\.welcome"$/m);
    assert.doesNotMatch(output, /yazıldı/);
  });
});

describe("the seed's command line", () => {
  const keys = ["free.basic", "core.welcome", "keycloak.reset-password"];

  it("forces nothing, checks freshness and writes by default", () => {
    assert.deepEqual(parseSeedArgs([], keys), { ok: true, dryRun: false, allowStale: false,
      hideNames: false, force: { all: false, keys: [] } });
  });

  it("reads --dry-run, --force=<key>[,<key>] (repeatable), --force-all, --allow-stale and --hide-names", () => {
    assert.deepEqual(parseSeedArgs(["--dry-run"], keys), { ok: true, dryRun: true, allowStale: false,
      hideNames: false, force: { all: false, keys: [] } });
    assert.deepEqual(parseSeedArgs(["--force=core.welcome,keycloak.reset-password"], keys), {
      ok: true,
      dryRun: false,
      allowStale: false,
      hideNames: false,
      force: { all: false, keys: ["core.welcome", "keycloak.reset-password"] },
    });
    assert.deepEqual(parseSeedArgs(["--force=core.welcome", "--force=free.basic,core.welcome", "--"], keys), {
      ok: true,
      dryRun: false,
      allowStale: false,
      hideNames: false,
      force: { all: false, keys: ["core.welcome", "free.basic"] },
    });
    assert.deepEqual(parseSeedArgs(["--force-all", "--dry-run"], keys), {
      ok: true,
      dryRun: true,
      allowStale: false,
      hideNames: false,
      force: { all: true, keys: [] },
    });
    assert.deepEqual(parseSeedArgs(["--allow-stale"], keys), { ok: true, dryRun: false, allowStale: true, hideNames: false, force: { all: false, keys: [] } });
    assert.deepEqual(parseSeedArgs(["--hide-names"], keys), { ok: true, dryRun: false, allowStale: false, hideNames: true, force: { all: false, keys: [] } });
  });

  // A mistyped key would otherwise run a seed that forces nothing, and a
  // mistyped flag one that is not what was asked for.
  for (const [argv, says] of [
    [["--force=core.welcom"], /core\.welcom/],
    [["--force"], /--force=/],
    [["--force="], /--force=/],
    [["--forse=core.welcome"], /--forse/],
  ] as const) {
    it(`refuses ${argv.join(" ")}`, () => {
      const parsed = parseSeedArgs([...argv], keys);
      assert.equal(parsed.ok, false);
      assert.ok(!parsed.ok);
      assert.match(parsed.message, says);
    });
  }
});

describe("the sources the seed sends", () => {
  it("are each registered template's own file, found by the key it declares", async () => {
    const sources = await templateSources(repoTemplates);

    assert.equal(sources.length, repoTemplates.length);
    for (const [index, { meta, source }] of sources.entries()) {
      assert.equal(meta, repoTemplates[index].meta);
      assert.match(source, new RegExp(`\\bkey:\\s*"${meta.key.replaceAll(".", "\\.")}"`), meta.key);
      assert.match(source, /export default function/, meta.key);
    }
  });

  it("refuse two files that declare one key, and a template with no file", async (t) => {
    const dir = await mkdtemp(join(tmpdir(), "seed-sources-"));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const declaring = (key: string) => `export const meta = { key: "${key}" };\nexport default () => null;\n`;
    await writeFile(join(dir, "one.tsx"), declaring("core.welcome"));
    await writeFile(join(dir, "theme.tsx"), "export const colors = {};\n");

    const welcome = { meta: template("core.welcome", "").meta };
    assert.equal((await templateSources([welcome], dir))[0].source, declaring("core.welcome"));
    await assert.rejects(templateSources([{ meta: template("free.basic", "").meta }], dir), /free\.basic/);

    await writeFile(join(dir, "two.tsx"), declaring("core.welcome"));
    await assert.rejects(templateSources([welcome], dir), /one\.tsx.*two\.tsx/);
  });
});

