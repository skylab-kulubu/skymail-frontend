import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SEEDED_PATHS, checkFreshness, staleMessage, type GitRunner } from "./freshness";

/** A git that answers each command by its first argument; a missing answer is a failure. */
function scriptedGit(answers: Record<string, string | null>): { git: GitRunner; calls: string[][] } {
  const calls: string[][] = [];
  const git: GitRunner = (args) => {
    calls.push(args);
    return Object.hasOwn(answers, args[0]) ? answers[args[0]] : null;
  };
  return { git, calls };
}

describe("whether the checkout seeds the newest templates", () => {
  // The seed renders what the working tree holds, and it renders through the
  // render module, so a checkout behind origin/main in any of these writes an
  // older mail over a newer one — while every template still prints a tick.
  it("watches the templates, the scripts and the modules that render them", () => {
    assert.deepEqual(SEEDED_PATHS, ["emails", "scripts", "src/lib/mail-render", "src/lib/template-seed"]);
  });

  it("is fresh when no commit of those paths is missing", () => {
    const { git, calls } = scriptedGit({ "rev-parse": "true", fetch: "", log: "" });

    assert.deepEqual(checkFreshness(git), { state: "fresh", notes: [] });
    assert.deepEqual(calls.at(-1), ["log", "--format=%h %s", "HEAD..FETCH_HEAD", "--", ...SEEDED_PATHS]);
  });

  it("is stale, naming each missing commit, when the checkout is behind", () => {
    const { git } = scriptedGit({
      "rev-parse": "true",
      fetch: "",
      log: "82e1ebd Stop the declined notice assuming the reader made the edit (#51)\ned63a0e Say what each approval decision actually was (#50)",
    });

    const freshness = checkFreshness(git);
    assert.equal(freshness.state, "stale");
    assert.ok(freshness.state === "stale");
    assert.deepEqual(freshness.commits, [
      "82e1ebd Stop the declined notice assuming the reader made the edit (#51)",
      "ed63a0e Say what each approval decision actually was (#50)",
    ]);
  });

  it("compares with the local origin/main, and says so, when origin cannot be reached", () => {
    const { git, calls } = scriptedGit({ "rev-parse": "true", fetch: null, log: "" });

    const freshness = checkFreshness(git);
    assert.equal(freshness.state, "fresh");
    assert.match(freshness.notes.join("\n"), /origin'e ulaşılamadı/);
    assert.deepEqual(calls.at(-1), ["log", "--format=%h %s", "HEAD..origin/main", "--", ...SEEDED_PATHS]);
  });

  it("says it could not check, and does not refuse, when the history cannot be read", () => {
    const { git } = scriptedGit({ "rev-parse": "true", fetch: "", log: null });

    const freshness = checkFreshness(git);
    assert.equal(freshness.state, "unchecked");
    assert.match(freshness.notes.join("\n"), /tazelik kontrolü yapılamadı/);
  });

  it("does not check outside a git checkout", () => {
    const { git, calls } = scriptedGit({ "rev-parse": null });

    assert.deepEqual(checkFreshness(git), { state: "unchecked", notes: [] });
    assert.equal(calls.length, 1);
  });

  it("tells a stale run what is missing, how to update, and how to seed anyway", () => {
    const message = staleMessage(["82e1ebd Stop the declined notice (#51)"], "corepack yarn emails:seed");

    assert.match(message, /origin\/main'in gerisinde/);
    assert.match(message, /1 commit eksik/);
    assert.match(message, /82e1ebd Stop the declined notice \(#51\)/);
    assert.match(message, /git pull --ff-only origin main/);
    assert.match(message, /corepack yarn emails:seed --allow-stale/);
  });
});
