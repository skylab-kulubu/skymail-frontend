/**
 * The six checks emails:render holds the repo's templates to live in
 * scripts/mail-checks.ts. They moved there from render-templates.ts to be
 * shared, and must behave exactly as they did: each catches a defect that
 * reached an inbox once.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkBackgroundLayersAreThemed,
  checkBalancedActions,
  checkOpaqueSurfaces,
  checkPlainTextIsReadable,
  checkSubjectVariables,
} from "../../../scripts/mail-checks";

describe("the emails:render checks", () => {
  // The pretty printer breaks a long line inside an action in a JSX template's
  // HTML (keycloak.generic has one); Go parses it, so the checks must too.
  it("pass a body whose actions the pretty printer wrapped across lines", () => {
    const html =
      '<table class="email-bg" style="background-color:#f4f1f7"><tbody><tr><td class="card" style="background-color:#fbfafc;border:1px solid #e2d7e6">' +
      '<a href="{{if\n        .link}}{{.link}}{{end\n}}">Devam et</a>{{\n  range .Items}}{{.Name}}{{\tend}}</td></tr></tbody></table>';
    const plainText = "Devam et {{if\n        .link}}{{.link}}{{end\n}} {{\n  range .Items}}{{.Name}}{{\tend}}";
    const problems: string[] = [];

    checkBalancedActions("k", html, problems);
    checkOpaqueSurfaces("k", html, problems);
    checkBackgroundLayersAreThemed("k", html, problems);
    checkPlainTextIsReadable("k", html, plainText, problems);
    checkSubjectVariables("k", "{{if\n  .link}}Bağlantın{{end\n}}", ["link"], problems);

    assert.deepEqual(problems, []);
  });

  it("still stop a link glued to the next word in the plain text, in the words they always used", () => {
    const html = '<p>Ayrıntılar <a href="https://skyl.app/e">burada</a>dan öğren.</p>';
    const problems: string[] = [];

    checkPlainTextIsReadable("k", html, "Ayrıntılar burada https://skyl.app/edan öğren.", problems);
    checkPlainTextIsReadable("k", html, "Ayrıntılar burada https://skyl.app/e dan öğren.", problems);

    assert.deepEqual(problems, ["k: düz metinde bitişik yazılmış bağlantı → https://skyl.app/edan öğren. — araya boşluk gerekiyor"]);
  });
});
