/**
 * Go's net/url as the server's allow-list uses it: bluemonday keeps a link
 * only when url.Parse takes its address, and writes the address back as
 * URL.String() gives it. The free announcement's body renderer uses this to
 * refuse, before anything is sent, a link the server would drop, and to write
 * one the way the server will (free-body.ts).
 *
 * The expected outputs were recorded from Go 1.25.5 net/url (url.Parse, then
 * String(); null where Parse returned an error) on 2026-09-23, the Go that
 * skymail-backend builds with.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { goUrlString, parseGoUrl } from "./go-url";

const GO: ReadonlyArray<readonly [input: string, output: string | null]> = [
  ["https://skyl.app/gecekodu", "https://skyl.app/gecekodu"],
  ["https://yildizskylab.com", "https://yildizskylab.com"],
  ["HTTPS://Ornek.COM/Yol", "https://Ornek.COM/Yol"],
  ["https://ornek.com/ş?q=ç#bölüm", "https://ornek.com/%C5%9F?q=ç#b%C3%B6l%C3%BCm"],
  ["https://ornek.com/%C5%9F?q=%C3%A7#b%C3%B6l%C3%BCm", "https://ornek.com/%C5%9F?q=%C3%A7#b%C3%B6l%C3%BCm"],
  ["https://ornek.com/a|b^c#x{y}|z", "https://ornek.com/a%7Cb%5Ec#x%7By%7D%7Cz"],
  ["https://ornek.com/a%7Cb%5Ec#x%7By%7D%7Cz", "https://ornek.com/a%7Cb%5Ec#x%7By%7D%7Cz"],
  ["https://ornek.com/%zz", null],
  ["https://ornek.com/?a=1&b=2", "https://ornek.com/?a=1&b=2"],
  ["https://ornek.com/it's(1)!*[x]", "https://ornek.com/it's(1)!*[x]"],
  ["https://ornek.com/#", "https://ornek.com/"],
  ["https://ornek.com/?", "https://ornek.com/?"],
  ["https://ornek.com/#a#b", "https://ornek.com/#a%23b"],
  ["https://ornek.com/#x?y=1'z", "https://ornek.com/#x?y=1'z"],
  ["https://user:pass@ornek.com/", "https://user:pass@ornek.com/"],
  ["mailto:ayse@ornek.com", "mailto:ayse@ornek.com"],
  ["Mailto:a@b.com?subject=Merhaba%20D%C3%BCnya", "mailto:a@b.com?subject=Merhaba%20D%C3%BCnya"],
  ["https://[::1]:8080/x", "https://[::1]:8080/x"],
  ["https://[1.2.3.4]/", null],
  ["https://ornek.com:x/", null],
  ["https://şirket.com/", "https://%C5%9Firket.com/"],
  ["javascript:alert(1)", "javascript:alert(1)"],
  ["/goreli", "/goreli"],
  ["ornek.com/yol", "ornek.com/yol"],
  ["https://ornek.com/a\u0001b", null],
];

const serialised = (input: string) => {
  const url = parseGoUrl(input);
  return url === null ? null : goUrlString(url);
};

describe("an address, as Go reads and writes it", () => {
  for (const [input, output] of GO) {
    it(`${JSON.stringify(input)} → ${JSON.stringify(output)}`, () => {
      assert.equal(serialised(input), output);
    });
  }

  it("is written the same way a second time", () => {
    for (const [, output] of GO) {
      if (output !== null) assert.equal(serialised(output), output);
    }
  });
});
