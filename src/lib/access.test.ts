/**
 * Who sees what. The API enforces the same roles on every route
 * (skymail-backend `main.go`), so the panel's job is only to not offer a
 * screen that would answer 403.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROLE, activeNavHref, hasAccess, hasAnyRole, homeScreen, homeView, isApprover, requiredRolesFor, sectionLabel, visibleNavigation } from "./access";

const hrefs = (roles: string[]) => visibleNavigation(roles).map((item) => item.href);

describe("the menu", () => {
  // Anyone who can use SkyMail may submit a send for approval, and sees their
  // own requests (ticket 20).
  it("shows the home screen and the mail approvals to someone with access and no read roles", () => {
    assert.deepEqual(hrefs(["skymail:access"]), ["/", "/mail-approvals"]);
  });

  it("adds each section for its read role", () => {
    assert.deepEqual(hrefs(["skymail:access", "skymail:templates:read"]), ["/", "/mail-tasks/create", "/templates", "/mail-approvals"]);
    assert.deepEqual(hrefs(["skymail:access", "skymail:lists:read"]), ["/", "/mailing-lists", "/mail-approvals"]);
    assert.deepEqual(hrefs(["skymail:access", "skymail:mails:read"]), ["/", "/mail-tasks", "/mail-approvals"]);
  });

  it("shows every section to someone with every read role, in a fixed order", () => {
    assert.deepEqual(
      hrefs(["skymail:mails:read", "skymail:lists:read", "skymail:templates:read", "skymail:access"]),
      ["/", "/mail-tasks/create", "/templates", "/mailing-lists", "/mail-tasks", "/mail-approvals"],
    );
  });

  // A team leader holds access and templates:read only (ALGOLAB today): the
  // menu itself leads to the send form, not only the mail approvals' button.
  it("offers the send form to whoever may compose one, templates:read", () => {
    assert.ok(hrefs(["skymail:access", "skymail:templates:read"]).includes("/mail-tasks/create"));
    assert.ok(!hrefs(["skymail:access"]).includes("/mail-tasks/create"));
    assert.ok(!hrefs(["skymail:access", "skymail:mails:write"]).includes("/mail-tasks/create"));
  });

  it("does not count a write role as permission to read the list", () => {
    assert.deepEqual(hrefs(["skymail:access", "skymail:templates:write", "skymail:mails:send"]), ["/", "/mail-approvals"]);
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
      ["Ana sayfa", "Yeni gönderim", "Mail template'ler", "Mail listeleri", "Gönderimler", "Mail onayları"],
    );
    assert.equal(sectionLabel("/mailing-lists"), "Mail listeleri");
    assert.equal(sectionLabel("/mail-approvals"), "Mail onayları");
  });

  // GET /suppressions takes either role (skymail-backend main.go).
  it("shows the suppression list to one who may remove a bounce or reverse an unsubscribe", () => {
    assert.ok(!hrefs(["skymail:access", "skymail:mails:read"]).includes("/suppressions"));
    assert.ok(hrefs(["skymail:access", "skymail:unsubscribes:reactivate"]).includes("/suppressions"));
    assert.ok(hrefs(["skymail:access", "skymail:suppressions:manage"]).includes("/suppressions"));
    assert.ok(!hrefs(["skymail:suppressions:manage"]).includes("/suppressions"));
    assert.deepEqual(requiredRolesFor("/suppressions"), ["skymail:suppressions:manage", "skymail:unsubscribes:reactivate"]);
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

  // The send form submits for approval what the viewer may not send
  // (ticket 20): it asks for templates:read itself, to offer a template.
  it("needs only access on the send form, not the send list's read role or a send role", () => {
    assert.deepEqual(requiredRolesFor("/mail-tasks/create"), []);
  });

  it("needs only access on the mail approvals: the API shows each viewer what they may see", () => {
    assert.deepEqual(requiredRolesFor("/mail-approvals"), []);
    assert.deepEqual(requiredRolesFor("/mail-approvals/show/abc"), []);
    assert.deepEqual(requiredRolesFor("/mail-approvals/edit/abc"), []);
  });

  it("needs nothing beyond access on the home screen or an unknown address", () => {
    assert.deepEqual(requiredRolesFor("/"), []);
    assert.deepEqual(requiredRolesFor("/templatesx"), []);
  });
});

describe("the menu's current section", () => {
  const all = visibleNavigation([ROLE.access, ROLE.templatesRead, ROLE.listsRead, ROLE.mailsRead]);

  it("is the most specific section the address sits under", () => {
    assert.equal(activeNavHref("/mail-tasks/create", all), "/mail-tasks/create");
    assert.equal(activeNavHref("/mail-tasks", all), "/mail-tasks");
    assert.equal(activeNavHref("/mail-tasks/show/abc", all), "/mail-tasks");
    assert.equal(activeNavHref("/templates/edit/1", all), "/templates");
  });

  it("is the home screen only at its own address, and none for an unknown one", () => {
    assert.equal(activeNavHref("/", all), "/");
    assert.equal(activeNavHref("/nowhere", all), null);
    assert.equal(activeNavHref("/mail-tasksx", all), null);
  });
});

describe("the home screen", () => {
  it("shows the send summary to one who reads the send list", () => {
    assert.equal(homeView([ROLE.access, ROLE.mailsRead]), "summary");
    assert.equal(homeView([ROLE.access, ROLE.mailsRead, ROLE.templatesRead]), "summary");
  });

  // A team leader (access + templates:read) composes and submits for
  // approval: their home leads there and lists their own requests.
  it("leads one who may compose but not read the send list to a new send and their own requests", () => {
    assert.equal(homeView([ROLE.access, ROLE.templatesRead]), "composer");
    assert.equal(homeView([ROLE.access, ROLE.templatesRead, ROLE.mailsSend]), "composer");
  });

  it("says there is nothing to do only to one who can neither read the sends nor compose", () => {
    assert.equal(homeView([ROLE.access]), "none");
    assert.equal(homeView([ROLE.access, ROLE.listsRead]), "none");
  });
});

describe("the home screen once the token is checked", () => {
  // Before the lock, the token is refreshed once: a role granted after it was
  // issued opens the screen it gives instead.
  it("waits for the check before saying there is nothing to do", () => {
    assert.equal(homeScreen([ROLE.access], { confirmed: false }), "checking");
    assert.equal(homeScreen([ROLE.access], { confirmed: true }), "locked");
  });

  it("shows what a refreshed token opens", () => {
    assert.equal(homeScreen([ROLE.access, ROLE.templatesRead], { confirmed: true }), "composer");
    assert.equal(homeScreen([ROLE.access, ROLE.mailsRead], { confirmed: true }), "summary");
  });

  it("needs no check for one who can read the sends or compose", () => {
    assert.equal(homeScreen([ROLE.access, ROLE.mailsRead], { confirmed: false }), "summary");
    assert.equal(homeScreen([ROLE.access, ROLE.templatesRead], { confirmed: false }), "composer");
  });

  // An approver with nothing else decides requests: the lock leads there.
  it("locks an approver who can do nothing else with a way to the mail approvals", () => {
    assert.equal(homeScreen([ROLE.access, ROLE.mailsApprove], { confirmed: true }), "lockedApprover");
  });
});

describe("an approver", () => {
  it("holds skymail:mails:approve, apart from sending, with access", () => {
    assert.equal(ROLE.mailsApprove, "skymail:mails:approve");
    assert.equal(isApprover([ROLE.access, ROLE.mailsApprove]), true);
    assert.equal(isApprover([ROLE.access, ROLE.mailsWrite, ROLE.mailsSend]), false);
    assert.equal(isApprover([ROLE.mailsApprove]), false);
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
