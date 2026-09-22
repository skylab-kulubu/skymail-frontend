/**
 * Who sees what. The API enforces the same roles on every route
 * (skymail-backend `main.go`), so the panel's job is only to not offer a
 * screen that would answer 403.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasAccess, requiredRoleFor, sectionLabel, visibleNavigation } from "./access";

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
  it("needs the read role of the section it belongs to", () => {
    assert.equal(requiredRoleFor("/templates"), "skymail:templates:read");
    assert.equal(requiredRoleFor("/templates/edit/123"), "skymail:templates:read");
    assert.equal(requiredRoleFor("/mailing-lists/show/abc"), "skymail:lists:read");
    assert.equal(requiredRoleFor("/mail-tasks/create"), "skymail:mails:read");
  });

  it("needs nothing beyond access on the home screen or an unknown address", () => {
    assert.equal(requiredRoleFor("/"), undefined);
    assert.equal(requiredRoleFor("/templatesx"), undefined);
  });
});
