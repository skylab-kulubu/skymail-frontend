import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { confirmTitle } from "./confirm";

describe("the send form's last dialog title", () => {
  it("says a direct send goes now, without approval", () => {
    assert.equal(confirmTitle("send"), "Şimdi gönder (onaysız)");
  });

  it("keeps the approval and resend titles", () => {
    assert.equal(confirmTitle("submit"), "Onaya sun");
    assert.equal(confirmTitle("submit", { resubmit: true }), "Yeniden onaya sun");
    assert.equal(confirmTitle("resendList"), "Listeye yeniden gönder");
    assert.equal(confirmTitle("retryPeople"), "Kişilere yeniden gönder");
  });
});
