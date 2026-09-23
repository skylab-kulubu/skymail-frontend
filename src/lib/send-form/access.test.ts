/**
 * Who may send what (ticket 16), as skymail-backend decides it: a send to a
 * mailing list needs `mails:write`, a send to one person `mails:send` or
 * `mails:write` (main.go). The form also reads Mail templates and lists, so
 * it needs their read roles to offer them. Someone who may send nothing is
 * told why, not shown a form that fails.
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
      blocked: null,
      listNote: null,
    });
  });

  it("offers only people to a sender with mails:send, and says why a list is not offered", () => {
    const access = sendAccess(roles(ROLE.templatesRead, ROLE.listsRead, ROLE.mailsSend));
    assert.equal(access.list, false);
    assert.equal(access.people, true);
    assert.equal(access.detail, false);
    assert.equal(access.listNote, "Bir mail listesine göndermek skymail:mails:write rolü ister; bu hesapla tek tek kişilere gönderebilirsin.");
  });

  it("does not offer a list it cannot show: writing sends without reading lists", () => {
    const access = sendAccess(roles(ROLE.templatesRead, ROLE.mailsWrite));
    assert.equal(access.list, false);
    assert.equal(access.people, true);
    assert.equal(access.listNote, "Mail listelerini görmek için skymail:lists:read rolü gerekiyor; bu hesapla tek tek kişilere gönderebilirsin.");
  });

  it("explains instead of opening when there is nothing to send with", () => {
    assert.equal(
      sendAccess(roles(ROLE.templatesRead, ROLE.listsRead, ROLE.mailsRead)).blocked,
      "Mail göndermek için skymail:mails:send ya da skymail:mails:write rolü gerekiyor. Gönderim yetkisine ihtiyacın varsa kulüp yönetimine başvur.",
    );
    assert.equal(
      sendAccess(roles(ROLE.mailsWrite, ROLE.listsRead)).blocked,
      "Gönderilecek Mail template'i seçmek için skymail:templates:read rolü gerekiyor. Erişime ihtiyacın varsa kulüp yönetimine başvur.",
    );
  });

  it("counts nothing without skymail:access", () => {
    const access = sendAccess([ROLE.templatesRead, ROLE.mailsWrite, ROLE.listsRead]);
    assert.equal(access.list, false);
    assert.equal(access.people, false);
    assert.notEqual(access.blocked, null);
  });
});
