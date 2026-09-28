/**
 * Silinmiş kullanıcı (ADR-0051, ticket 27): once a person's account is
 * erased, skymail-backend (#34) keeps SkyMail's records and puts one stand-in
 * where they named that person. An actor field — who sent, submitted,
 * decided, wrote or archived — holds a fixed subject; a Mail onayı request's
 * person holds a placeholder address; a sent or failed mail to them keeps its
 * row with the address emptied. Every screen names all three the same way.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ERASED_PERSON,
  ERASED_RECIPIENT_EMAIL,
  ERASED_SUBJECT,
  isErasedAddress,
  isErasedSubject,
  mailRecipientLabel,
  personLabel,
  recipientLabel,
  samePerson,
} from "./people";

const SOMEONE = "8d0f5c2e-6b1a-4c3e-9f27-5a1d3b7e9c41";
const UNKNOWN = "Adı bilinmeyen üye";

describe("Silinmiş kullanıcı", () => {
  it("is skymail-backend's one subject and one address for everyone erased", () => {
    assert.equal(ERASED_SUBJECT, "00000000-0000-4000-8000-000000000000");
    assert.equal(ERASED_RECIPIENT_EMAIL, "silinmis-kullanici@invalid");
    assert.equal(ERASED_PERSON, "Silinmiş kullanıcı");
  });

  it("is told by its subject, and by its address, whatever their case", () => {
    assert.equal(isErasedSubject(ERASED_SUBJECT), true);
    assert.equal(isErasedSubject(" 00000000-0000-4000-8000-000000000000 "), true);
    assert.equal(isErasedSubject(SOMEONE), false);
    assert.equal(isErasedSubject(null), false);
    assert.equal(isErasedAddress("silinmis-kullanici@invalid"), true);
    assert.equal(isErasedAddress("Silinmis-Kullanici@INVALID"), true);
    assert.equal(isErasedAddress("ali@ornek.com"), false);
    assert.equal(isErasedAddress(""), false);
    assert.equal(isErasedAddress(null), false);
  });
});

describe("someone who acted", () => {
  // The sender (sent_by) and the archiver (archived_by) are a bare subject.
  it("is Silinmiş kullanıcı for the erased subject, with or without a name on record", () => {
    assert.equal(personLabel({ sub: ERASED_SUBJECT }, UNKNOWN), "Silinmiş kullanıcı");
    assert.equal(personLabel({ sub: ERASED_SUBJECT, name: null, email: null }, UNKNOWN), "Silinmiş kullanıcı");
    assert.equal(personLabel({ sub: ERASED_SUBJECT, name: "Ali Can", email: "ali@ornek.com" }, UNKNOWN), "Silinmiş kullanıcı");
  });

  it("is anyone else by name, else by address, else unknown", () => {
    assert.equal(personLabel({ sub: SOMEONE, name: " Ali Can ", email: "ali@ornek.com" }, UNKNOWN), "Ali Can");
    assert.equal(personLabel({ sub: SOMEONE, name: " ", email: "ali@ornek.com" }, UNKNOWN), "ali@ornek.com");
    assert.equal(personLabel({ sub: SOMEONE, name: null }, UNKNOWN), UNKNOWN);
    assert.equal(personLabel({ sub: null, name: null }, UNKNOWN), UNKNOWN);
  });
});

describe("whether two subjects are one person", () => {
  it("is so for the same known subject", () => {
    assert.equal(samePerson(SOMEONE, SOMEONE), true);
    assert.equal(samePerson(SOMEONE, "4c2a9e17-5b3d-4f60-8a21-7e9d0c3b5f12"), false);
  });

  // Everyone erased has the one subject, so two of them are not one person, and no viewer is ever one.
  it("is never so for Silinmiş kullanıcı, nor for a subject nobody knows", () => {
    assert.equal(samePerson(ERASED_SUBJECT, ERASED_SUBJECT), false);
    assert.equal(samePerson(null, null), false);
    assert.equal(samePerson(SOMEONE, null), false);
    assert.equal(samePerson("", ""), false);
  });
});

describe("someone mail goes to", () => {
  it("is their name with the address beside it, or the address alone", () => {
    assert.deepEqual(recipientLabel(" Ali Can ", "ali@ornek.com"), { name: "Ali Can", address: "ali@ornek.com" });
    assert.deepEqual(recipientLabel("", "ali@ornek.com"), { name: "ali@ornek.com", address: null });
    assert.deepEqual(recipientLabel(null, " ali@ornek.com "), { name: "ali@ornek.com", address: null });
    assert.deepEqual(recipientLabel("Ali Can", null), { name: "Ali Can", address: null });
  });

  // A Mail onayı request keeps the erased person's place with a placeholder address.
  it("is Silinmiş kullanıcı for the placeholder address, which is never shown", () => {
    assert.deepEqual(recipientLabel("Silinmiş kullanıcı", "silinmis-kullanici@invalid"), { name: "Silinmiş kullanıcı", address: null });
    assert.deepEqual(recipientLabel("", "silinmis-kullanici@invalid"), { name: "Silinmiş kullanıcı", address: null });
  });

  // An address missing from a request is not an erased one: the submitter's token may have carried none.
  it("is not Silinmiş kullanıcı for an empty address on a request", () => {
    assert.deepEqual(recipientLabel("Ayşe Yılmaz", ""), { name: "Ayşe Yılmaz", address: null });
  });
});

describe("someone a sent or failed mail went to", () => {
  it("is named as anyone mail goes to", () => {
    assert.deepEqual(mailRecipientLabel("Ali Can", "ali@ornek.com"), { name: "Ali Can", address: "ali@ornek.com" });
    assert.deepEqual(mailRecipientLabel("", "ali@ornek.com"), { name: "ali@ornek.com", address: null });
  });

  // A queue row always has a recipient, so a row with no address is one erasure emptied.
  it("is Silinmiş kullanıcı once erasure has emptied the address, whatever name the row kept", () => {
    assert.deepEqual(mailRecipientLabel("Silinmiş kullanıcı", ""), { name: "Silinmiş kullanıcı", address: null });
    assert.deepEqual(mailRecipientLabel("", " "), { name: "Silinmiş kullanıcı", address: null });
    assert.deepEqual(mailRecipientLabel("Ali Can", null), { name: "Silinmiş kullanıcı", address: null });
  });
});
