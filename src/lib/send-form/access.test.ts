/**
 * Who may send what (ticket 16), as skymail-backend decides it: a send to a
 * mailing list needs `mails:write`, a send to one person `mails:send` or
 * `mails:write` (main.go). The form reads Mail templates to send one and
 * lists to pick one, so it needs their read roles too. The page itself is
 * gated by RoleGate (access.ts requiredRolesFor); this says what it offers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROLE } from "../access";
import { sendAccess } from "./access";

const roles = (...granted: string[]) => [ROLE.access, ...granted];

describe("what the send form offers", () => {
  it("offers a list and people to a writer who reads templates and lists, and the send's page to a reader of sends", () => {
    assert.deepEqual(sendAccess(roles(ROLE.templatesRead, ROLE.listsRead, ROLE.mailsWrite, ROLE.mailsRead)), {
      list: true,
      people: true,
      detail: true,
      listNote: null,
    });
  });

  it("offers only people to a sender with mails:send, and says why a list is not offered", () => {
    const access = sendAccess(roles(ROLE.templatesRead, ROLE.listsRead, ROLE.mailsSend));
    assert.deepEqual(access, {
      list: false,
      people: true,
      detail: false,
      listNote: "Bir mail listesine göndermek skymail:mails:write rolü ister; bu hesapla tek tek kişilere gönderebilirsin.",
    });
  });

  it("does not offer a list it cannot show: writing sends without reading lists", () => {
    const access = sendAccess(roles(ROLE.templatesRead, ROLE.mailsWrite));
    assert.equal(access.list, false);
    assert.equal(access.people, true);
    assert.equal(access.listNote, "Mail listelerini görmek için skymail:lists:read rolü gerekiyor; bu hesapla tek tek kişilere gönderebilirsin.");
  });

  it("offers nothing to send without a template to send, or a send role", () => {
    assert.deepEqual(sendAccess(roles(ROLE.listsRead, ROLE.mailsWrite)), { list: false, people: false, detail: false, listNote: null });
    assert.deepEqual(sendAccess(roles(ROLE.templatesRead, ROLE.mailsRead)), { list: false, people: false, detail: true, listNote: null });
    assert.equal(sendAccess([ROLE.templatesRead, ROLE.mailsWrite, ROLE.listsRead]).people, false);
  });
});
