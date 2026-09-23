/**
 * Who may send what (ticket 16), as skymail-backend decides it: a send to a
 * mailing list needs `mails:write`, a send to one person `mails:send` or
 * `mails:write` (main.go). Anyone who can use SkyMail may submit a send for
 * approval instead (ticket 20, `POST /mail_approvals`). The form reads Mail
 * templates to offer one and lists to pick one, so it needs their read roles
 * whichever way the send goes. The page itself is gated by RoleGate
 * (access.ts requiredRolesFor); this says what it offers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROLE } from "../access";
import { directSend, sendAccess } from "./access";

const roles = (...granted: string[]) => [ROLE.access, ...granted];

describe("what the send form offers", () => {
  it("offers a list and people, sent at once, to a writer who reads templates and lists, and the send's page to a reader of sends", () => {
    assert.deepEqual(sendAccess(roles(ROLE.templatesRead, ROLE.listsRead, ROLE.mailsWrite, ROLE.mailsRead)), {
      list: true,
      people: true,
      send: { list: true, people: true },
      detail: true,
      listNote: null,
    });
  });

  it("sends only to people with mails:send, and offers a list for approval", () => {
    const access = sendAccess(roles(ROLE.templatesRead, ROLE.listsRead, ROLE.mailsSend));
    assert.deepEqual(access, { list: true, people: true, send: { list: false, people: true }, detail: false, listNote: null });
  });

  it("offers a list and people for approval to someone who reads templates and lists and sends nothing", () => {
    const access = sendAccess(roles(ROLE.templatesRead, ROLE.listsRead));
    assert.deepEqual(access, { list: true, people: true, send: { list: false, people: false }, detail: false, listNote: null });
  });

  it("does not offer a list it cannot show, and says why", () => {
    const writer = sendAccess(roles(ROLE.templatesRead, ROLE.mailsWrite));
    assert.equal(writer.list, false);
    assert.equal(writer.people, true);
    assert.deepEqual(writer.send, { list: false, people: true });
    assert.equal(writer.listNote, "Mail listelerini görmek için skymail:lists:read rolü gerekiyor; bu hesapla kişilere gönderebilirsin.");
    const member = sendAccess(roles(ROLE.templatesRead));
    assert.equal(member.listNote, "Mail listelerini görmek için skymail:lists:read rolü gerekiyor; bu hesapla bir kişiye gönderimi onaya sunabilirsin.");
  });

  it("offers nothing without a template to send", () => {
    assert.deepEqual(sendAccess(roles(ROLE.listsRead, ROLE.mailsWrite)), {
      list: false,
      people: false,
      send: { list: false, people: false },
      detail: false,
      listNote: null,
    });
    assert.equal(sendAccess([ROLE.templatesRead, ROLE.mailsWrite, ROLE.listsRead]).people, false);
  });
});

describe("whether the audience chosen is sent at once or submitted for approval", () => {
  it("is sent at once where the viewer may send to it", () => {
    const sender = sendAccess(roles(ROLE.templatesRead, ROLE.listsRead, ROLE.mailsSend));
    assert.equal(directSend(sender, "people"), true);
    assert.equal(directSend(sender, "list"), false);
    const member = sendAccess(roles(ROLE.templatesRead, ROLE.listsRead));
    assert.equal(directSend(member, "people"), false);
    assert.equal(directSend(member, "list"), false);
  });
});
