import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { json, scriptedClient } from "../api/testing";
import { fetchTeamNames, teamNamesOf } from "./team-names";

const WEB = "6d3c9f8e-2a4b-4c1d-8e7f-1a2b3c4d5e6f";
const ALGO = "7e4d0a9f-3b5c-4d2e-9f80-2b3c4d5e6f70";

describe("a Team request's Teams by name", () => {
  it("takes the names it was given, then the viewer's own Teams", async () => {
    const { api, calls } = scriptedClient(
      json(200, { teams: [{ id: ALGO, path: "/UYELER/ARGE/ALGOLAB", code: "ALGOLAB", display_name: { tr: "Algolab" }, parent_id: null, depth: 0, category: "", recipient_count: 1 }] }),
    );
    const names = teamNamesOf(await fetchTeamNames(api, [WEB, ALGO], { known: { [WEB]: "WEBLAB" }, canReadLists: false }));
    assert.equal(names(WEB.toUpperCase()), "WEBLAB");
    assert.equal(names(ALGO), "Algolab");
    assert.equal(calls.length, 1);
  });

  it("reads each group still unnamed for one who reads lists, and leaves one it cannot read unnamed", async () => {
    const { api, calls } = scriptedClient(json(404, { code: "team_mail.off" }), json(200, { id: ALGO, name: "ALGOLAB" }));
    const names = teamNamesOf(await fetchTeamNames(api, [WEB, ALGO], { known: { [WEB]: "WEBLAB" }, canReadLists: true }));
    assert.equal(names(ALGO), "ALGOLAB");
    assert.match(calls[1].url, new RegExp(`/mailing_lists/${ALGO}$`));
    const none = scriptedClient(json(403, { code: "server.forbidden" }));
    assert.equal(teamNamesOf(await fetchTeamNames(none.api, [ALGO], { canReadLists: false }))(ALGO), null);
  });

  it("asks nothing when every Team is named", async () => {
    const { api, calls } = scriptedClient();
    await fetchTeamNames(api, [WEB], { known: { [WEB]: "WEBLAB" }, canReadLists: true });
    assert.equal(calls.length, 0);
  });
});
