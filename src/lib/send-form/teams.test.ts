/**
 * Ekip postası on the send form (ekip-postasi 05): the Teams the viewer
 * leads as skymail-backend lists them, the ones a request goes to once a
 * Team above covers a Sub-team, and what the form says of them.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { json, scriptedClient } from "../api/testing";
import {
  coveredTeams,
  droppedTeamIds,
  fetchFreeTemplate,
  fetchTeamAudiences,
  namedTeams,
  pickedCountText,
  requestTeams,
  teamName,
  teamNamesFrom,
  teamProblem,
  teamsWords,
  type TeamAudience,
} from "./teams";

const team = (id: string, parent: string | null, depth: number, count: number | null = 10, name = id.toUpperCase()): TeamAudience => ({
  id,
  path: `/UYELER/ARGE/${name}`,
  code: name,
  display_name: { tr: name },
  parent_id: parent,
  depth,
  category: `team:${id}:duyuru`,
  recipient_count: count,
});

// WEBLAB with FRONTEND under it and REACT under that; ALGOLAB apart.
const TEAMS = [team("web", null, 0, 40), team("front", "web", 1, 12), team("react", "front", 2, 5), team("algo", null, 0, 20)];

describe("the Teams the viewer leads", () => {
  it("reads the list", async () => {
    const { api, calls } = scriptedClient(json(200, { teams: TEAMS }));
    assert.deepEqual(await fetchTeamAudiences(api), { status: "ready", teams: TEAMS });
    assert.match(calls[0].url, /\/me\/team_audiences$/);
  });

  it("reads none when the switch is off, the viewer may not ask, or leads nothing", async () => {
    for (const answer of [
      json(404, { code: "team_mail.off" }),
      json(403, { code: "server.forbidden" }),
      json(401, { code: "server.unauthorized" }),
      json(200, { teams: [] }),
    ]) {
      const { api } = scriptedClient(answer);
      assert.deepEqual(await fetchTeamAudiences(api), { status: "ready", teams: [] });
    }
  });

  it("says core did not answer, which is not none", async () => {
    const { api } = scriptedClient(json(503, { code: "team_mail.leadership_unavailable" }, { "Retry-After": "30" }));
    const answer = await fetchTeamAudiences(api);
    assert.equal(answer.status, "unavailable");
    assert.match(answer.status === "unavailable" ? answer.message : "", /liderliğin şu an doğrulanamadı/);
  });

  it("reads any other refusal as none, and a server error or no answer as unavailable", async () => {
    const refused = scriptedClient(json(400, { code: "validation.error" }));
    assert.deepEqual(await fetchTeamAudiences(refused.api), { status: "ready", teams: [] });
    const broken = scriptedClient(json(500, { code: "server.internal_server_error" }));
    assert.equal((await fetchTeamAudiences(broken.api)).status, "unavailable");
  });

  it("names a Team by its Turkish name, else its code, else its path", () => {
    assert.equal(teamName({ display_name: { tr: "Web Lab" }, code: "WEBLAB", path: "/UYELER/ARGE/WEBLAB" }), "Web Lab");
    assert.equal(teamName({ display_name: null, code: "WEBLAB", path: "/UYELER/ARGE/WEBLAB" }), "WEBLAB");
    assert.equal(teamName({ display_name: { tr: " " }, code: "", path: "/UYELER/ARGE/WEBLAB" }), "WEBLAB");
  });
});

describe("the Teams a request goes to", () => {
  it("drops a Sub-team picked with a Team above it, at any depth", () => {
    const picked = new Set(["web", "react", "algo"]);
    assert.deepEqual([...coveredTeams(picked, TEAMS)].sort(), ["front", "react"]);
    assert.deepEqual(requestTeams(picked, TEAMS).map((row) => row.id), ["web", "algo"]);
  });

  it("keeps a Sub-team picked alone, in the list's order", () => {
    assert.deepEqual(requestTeams(new Set(["algo", "front"]), TEAMS).map((row) => row.id), ["front", "algo"]);
  });

  it("asks for at least one Team and at most fifty", () => {
    assert.equal(teamProblem([]), "En az bir ekip seç.");
    assert.equal(teamProblem([TEAMS[0]]), null);
    const many = Array.from({ length: 51 }, (_, index) => team(`t${index}`, null, 0));
    assert.match(teamProblem(many) ?? "", /en çok 50 ekip/);
  });

  it("says how many the Teams reach: one exactly, several at most", () => {
    assert.equal(pickedCountText([]), null);
    assert.equal(pickedCountText([TEAMS[0]]), "40 üye. E-posta adresi olmayan üye sayılmaz.");
    assert.equal(pickedCountText([TEAMS[0], TEAMS[3]]), "2 ekip, en çok 60 üye. Birden çok ekipte olan kişiye tek posta gider.");
    assert.equal(pickedCountText([team("x", null, 0, null)]), "Seçilen ekiplerin üye sayısı alınamadı.");
  });

  it("says whom it goes to", () => {
    assert.equal(teamsWords([TEAMS[0]]), "“WEB” ekibine");
    assert.equal(teamsWords([TEAMS[0], TEAMS[3]]), "2 ekibe (WEB, ALGO)");
  });
});

describe("a Team request on the approval screens", () => {
  it("finds the Teams an approval took out, from the history's audience changes", () => {
    const history = [
      { changes: null },
      { changes: [{ field: "variable", before: "a", after: "b" }] },
      { changes: [{ field: "audience", before: { team_ids: ["web", "algo", "front"] }, after: { team_ids: ["web"] } }] },
      { changes: [{ field: "audience", before: '{"team_ids":["web"]}', after: '{"team_ids":[]}' }] },
    ];
    assert.deepEqual(droppedTeamIds(history), ["algo", "front", "web"]);
    assert.deepEqual(droppedTeamIds(null), []);
  });

  it("names the Teams it can and counts the rest", () => {
    const names = teamNamesFrom(TEAMS);
    assert.equal(names("WEB"), "WEB");
    assert.equal(namedTeams(["web", "algo"], names), "WEB, ALGO");
    assert.equal(namedTeams(["web", "x", "y"], names), "WEB ve 2 ekip daha");
    assert.equal(namedTeams(["x"], names), "1 ekip");
  });
});

describe("the free announcement for the team seat", () => {
  it("reads free.basic by its key, and none when it is not there", async () => {
    const free = { id: "f", key: "free.basic" };
    const { api, calls } = scriptedClient(json(200, free), json(404, { code: "server.not_found" }));
    assert.deepEqual(await fetchFreeTemplate(api), free);
    assert.match(calls[0].url, /\/templates\/by-key\/free\.basic$/);
    assert.equal(await fetchFreeTemplate(api), null);
  });
});
