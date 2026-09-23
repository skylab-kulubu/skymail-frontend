/**
 * Who sees what. The API enforces the same roles on every route
 * (skymail-backend `main.go`), so the panel's job is only to not offer a
 * screen that would answer 403.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROLE, hasAccess, hasAnyRole, requiredRolesFor, sectionLabel, visibleNavigation } from "./access";

const hrefs = (roles: string[]) => visibleNavigation(roles).map((item) => item.href);

describe("the menu", () => {
  it("shows only the home screen to someone with access and no read roles", () => {
    assert.deepEqual(hrefs(["skymail:access"]), ["/"]);
  });

  it("adds each section for its read role", () => {
    assert.deepEqual(hrefs(["skymail:access", "skymail:templates:read"]), ["/", "/templates"]);
    assert.deepEqual(hrefs(["skymail:access", "skymail:lists:read"]), ["/", "/mailing-lists"]);
    assert.deepEqual(hrefs(["skymail:access", "skymail:mails:read"]), ["/", "/mail-tasks"]);
  });

  it("shows every section to someone with every read role, in a fixed order", () => {
    assert.deepEqual(
      hrefs(["skymail:mails:read", "skymail:lists:read", "skymail:templates:read", "skymail:access"]),
      ["/", "/templates", "/mailing-lists", "/mail-tasks"],
    );
  });

  it("does not count a write role as permission to read the list", () => {
    assert.deepEqual(hrefs(["skymail:access", "skymail:templates:write", "skymail:mails:send"]), ["/"]);
  });

  it("is empty without skymail:access, whatever else the token carries", () => {
    assert.deepEqual(hrefs(["skymail:templates:read", "skymail:lists:read"]), []);
    assert.equal(hasAccess(["skymail:templates:read"]), false);
    assert.equal(hasAccess(["skymail:access"]), true);
  });

  it("labels the sections in Turkish", () => {
    assert.deepEqual(
      visibleNavigation([
        "skymail:access",
        "skymail:templates:read",
        "skymail:lists:read",
        "skymail:mails:read",
      ]).map((item) => item.label),
      ["Ana sayfa", "Mail template'ler", "Mail listeleri", "Gönderimler"],
    );
    assert.equal(sectionLabel("/mailing-lists"), "Mail listeleri");
  });
});

describe("a page opened by its address", () => {
  // Any one of the roles opens it.
  it("needs the read role of the section it belongs to", () => {
    assert.deepEqual(requiredRolesFor("/templates"), ["skymail:templates:read"]);
    assert.deepEqual(requiredRolesFor("/templates/edit/123"), ["skymail:templates:read"]);
    assert.deepEqual(requiredRolesFor("/mailing-lists/show/abc"), ["skymail:lists:read"]);
    assert.deepEqual(requiredRolesFor("/mail-tasks/show/abc"), ["skymail:mails:read"]);
    assert.deepEqual(requiredRolesFor("/mail-tasks"), ["skymail:mails:read"]);
  });

  it("needs a send role on the send form, not the send list's read role", () => {
    assert.deepEqual(requiredRolesFor("/mail-tasks/create"), ["skymail:mails:send", "skymail:mails:write"]);
  });

  it("needs nothing beyond access on the home screen or an unknown address", () => {
    assert.deepEqual(requiredRolesFor("/"), []);
    assert.deepEqual(requiredRolesFor("/templatesx"), []);
  });
});

describe("any of some roles", () => {
  it("is held when one is, with access", () => {
    assert.equal(hasAnyRole([ROLE.access, ROLE.mailsSend], [ROLE.mailsSend, ROLE.mailsWrite]), true);
    assert.equal(hasAnyRole([ROLE.access, ROLE.mailsRead], [ROLE.mailsSend, ROLE.mailsWrite]), false);
    assert.equal(hasAnyRole([ROLE.mailsSend], [ROLE.mailsSend]), false);
    assert.equal(hasAnyRole([ROLE.access], []), true);
  });
});
