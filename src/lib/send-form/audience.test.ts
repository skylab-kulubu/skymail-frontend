/**
 * Individual people as a send's audience: name and e-mail rows, each sent on
 * its own through `POST /mail_tasks/single`. The form catches what it can
 * before anything goes out — an address that is not one, the same address
 * twice, a missing name where the mail greets people by it — and says which
 * row. The API checks addresses properly; this is the early word.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePeople, peopleProblems, peopleReady, type PersonRow } from "./audience";

const row = (name: string, email: string): PersonRow => ({ name, email });

describe("the people a send goes to", () => {
  it("are the filled rows, trimmed; an empty row is no one", () => {
    assert.deepEqual(peopleProblems([row(" Ayşe Yılmaz ", " ayse@ornek.com "), row("", ""), row("Ali", "ali@ornek.com")]), {
      people: [row("Ayşe Yılmaz", "ayse@ornek.com"), row("Ali", "ali@ornek.com")],
      rows: [{}, {}, {}],
      warnings: [null, null, null],
      none: false,
    });
  });

  it("need someone", () => {
    assert.deepEqual(peopleProblems([row("", ""), row(" ", " ")]), { people: [], rows: [{}, {}], warnings: [null, null], none: true });
  });

  it("need an address that looks like one, and say which row lacks it", () => {
    const { rows } = peopleProblems([row("Ayşe", ""), row("Ali", "ali@"), row("", "veli ornek.com"), row("", "zeynep@ornek.com")]);
    assert.deepEqual(rows, [
      { email: "E-posta adresini yaz." },
      { email: "Geçerli bir e-posta adresi gir." },
      { email: "Geçerli bir e-posta adresi gir." },
      {},
    ]);
  });

  it("take each address once, whatever its case, and point at the row it repeats", () => {
    const { rows, people } = peopleProblems([
      row("Ayşe", "ayse@ornek.com"),
      row("Ali", "ali@ornek.com"),
      row("Ayşe Y.", "AYSE@Ornek.com "),
      row("ALİ", "ALI@ORNEK.COM"),
    ]);
    assert.deepEqual(rows, [
      {},
      {},
      { email: "Bu adres 1. satırda da var; herkese bir kez gönderilir." },
      { email: "Bu adres 2. satırda da var; herkese bir kez gönderilir." },
    ]);
    assert.equal(people.length, 4);
  });

  // The API does not need a name, and the old form did not either: a missing one is a slip to point out, not a stop.
  it("warn about a missing name when the mail greets people by it, and still send", () => {
    const check = peopleProblems([row("", "ayse@ornek.com"), row("Ali", "ali@ornek.com")], { nameExpected: true });
    assert.deepEqual(check.rows, [{}, {}]);
    assert.deepEqual(check.warnings, ["Bu mail alıcıyı adıyla anıyor ({{.FullName}}); adı boş giderse selamlama eksik kalır.", null]);
    assert.equal(peopleReady(check), true);
    assert.deepEqual(peopleProblems([row("", "ayse@ornek.com")]).warnings, [null]);
  });
});

describe("people pasted in at once", () => {
  it("are read one per line, or split by commas and semicolons, as 'Ad <adres>', 'Ad⇥adres' or a bare address", () => {
    assert.deepEqual(
      parsePeople("Ayşe Yılmaz <ayse@ornek.com>\nali@ornek.com, veli@ornek.com;\n\nZeynep Kaya\tzeynep@ornek.com\r\n  "),
      [row("Ayşe Yılmaz", "ayse@ornek.com"), row("", "ali@ornek.com"), row("", "veli@ornek.com"), row("Zeynep Kaya", "zeynep@ornek.com")],
    );
  });

  it("keep what is not an address as typed, for the row to say so", () => {
    assert.deepEqual(parsePeople("Mehmet"), [row("", "Mehmet")]);
  });
});
