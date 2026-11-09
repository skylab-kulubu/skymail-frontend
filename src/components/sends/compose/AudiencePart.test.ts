/**
 * Who the send goes to, as the server renders it (ekip-postasi 05): Ekibim
 * only while there are Teams, the Team tree with its counts, and a form that
 * never sits on an empty Ekibim (inceleme takibi #162).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SkylcnProvider } from "@skylab-kulubu/skylcn-ui";
import { ROLE } from "@/lib/access";
import { formAudience, sendAccess } from "@/lib/send-form/access";
import type { TeamAudience } from "@/lib/send-form/teams";
import { AudiencePart, type Audience } from "./AudiencePart";
import { TeamPurpose } from "./TeamPicker";

const team = (id: string, parent: string | null, depth: number, count: number): TeamAudience => ({
  id,
  path: `/UYELER/ARGE/${id}`,
  code: id,
  display_name: { tr: id },
  parent_id: parent,
  depth,
  category: `team:${id}:duyuru`,
  recipient_count: count,
});
const TEAMS = [team("WEBLAB", null, 0, 40), team("FRONTEND", "WEBLAB", 1, 12), team("ALGOLAB", null, 0, 20)];
const member = sendAccess([ROLE.access, ROLE.templatesRead, ROLE.listsRead]);

function render(audience: Audience, teams: readonly TeamAudience[], picked: string[] = []) {
  return renderToStaticMarkup(
    createElement(SkylcnProvider, {
      locale: "tr",
      children: createElement(AudiencePart, {
        access: member,
        audience,
        onAudience: () => {},
        lists: [],
        listId: null,
        onList: () => {},
        list: null,
        size: undefined,
        listProblem: null,
        people: [{ id: "kisi-1", name: "", email: "" }],
        onPeople: () => {},
        peopleCheck: null,
        peopleWarnings: [],
        onSend: () => {},
        teams,
        pickedTeams: new Set(picked),
        onPickedTeams: () => {},
      }),
    }),
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the audience part", () => {
  it("offers Ekibim beside a list and people, with the Team tree and each Team's count", () => {
    const html = render("team", TEAMS, ["WEBLAB"]);
    assert.match(text(html), /Ekibim/);
    assert.match(text(html), /Mail listesi/);
    assert.match(text(html), /WEBLAB 40 üye/);
    assert.match(text(html), /FRONTEND 12 üye · Üst ekiple birlikte gider/);
    assert.match(text(html), /40 üye\. E-posta adresi olmayan üye sayılmaz\./);
    assert.equal((html.match(/type="checkbox"/g) ?? []).length, 3);
    assert.doesNotMatch(html, /skymail:/);
  });

  it("offers no Ekibim without Teams, and a Team request filled in again falls back to the list", () => {
    const audience = formAudience("team", { access: member, presetList: false, teams: 0 });
    assert.equal(audience, "list");
    const html = render(audience, []);
    assert.doesNotMatch(text(html), /Ekibim/);
    assert.doesNotMatch(html, /type="checkbox"/);
    assert.match(text(html), /Mail listesi/);
  });
});

describe("a Team request's purpose", () => {
  const purpose = (addressesNote: boolean) =>
    text(
      renderToStaticMarkup(
        createElement(TeamPurpose, { commercialAbsent: false, onCommercialAbsent: () => {}, problem: null, disabled: false, addressesNote }),
      ),
    );

  it("is fixed, and says the sender sees no address only to one who cannot read lists", () => {
    assert.match(purpose(true), /Duyuru · Ekip duyurusu/);
    assert.match(purpose(true), /adreslerini görmezsin/);
    assert.doesNotMatch(purpose(false), /adreslerini görmezsin/);
  });
});
