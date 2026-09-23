/**
 * The server's allow-list, reimplemented: a free announcement's body is the
 * sender's input, and skymail-backend narrows it with bluemonday before it
 * reaches anyone (internal/mailer/sanitize.go). The panel runs the same
 * narrowing in JavaScript, so the preview shows what the server keeps and the
 * body renderer's tests have an oracle to hold its output against.
 *
 * The oracle is only as good as its likeness to the server, so it is held to
 * what the server itself did: every input in testdata/server-allowlist.json
 * went through the real sanitizeEmailHTML (server-allowlist-golden.go), and
 * the reimplementation has to give the same bytes back for each. The policy
 * the file records — the lines of sanitize.go — is the list the
 * reimplementation runs.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import golden from "./testdata/server-allowlist.json";
import { SERVER_ALLOWLIST, sanitizeLikeServer, serverHref } from "./server-allowlist";

/** The quoted arguments of one call in the policy's lines. */
function argumentsOf(call: string): string[] {
  const line = golden.policy.find((candidate) => candidate.startsWith(`p.${call}(`));
  assert.ok(line, `sanitize.go no longer calls ${call}; the reimplementation has to follow it`);
  return [...line.slice(line.indexOf("(")).matchAll(/"([^"]*)"/g)].map((match) => match[1]);
}

describe("the server's allow-list, as the panel runs it", () => {
  it("is the list sanitize.go writes, and nothing else", () => {
    assert.deepEqual([...SERVER_ALLOWLIST.elements], argumentsOf("AllowElements"));
    const attributes = golden.policy.find((line) => line.startsWith("p.AllowAttrs("));
    assert.equal(attributes, 'p.AllowAttrs("href").OnElements("a")');
    assert.deepEqual(SERVER_ALLOWLIST.attributes, { a: ["href"] });
    assert.deepEqual([...SERVER_ALLOWLIST.urlSchemes], argumentsOf("AllowURLSchemes"));
    assert.deepEqual(golden.policy.slice(3), ["p.RequireParseableURLs(true)", "p.AddTargetBlankToFullyQualifiedLinks(true)"]);
  });

  for (const { input, output } of golden.cases) {
    it(`gives what the server gave: ${JSON.stringify(input).slice(0, 90)}`, () => {
      assert.equal(sanitizeLikeServer(input), output);
    });
  }

  it("gives what the server gave for each generated body and link address", () => {
    const differ = golden.generated.filter(({ input, output }) => sanitizeLikeServer(input) !== output);
    assert.deepEqual(differ, []);
  });

  it("leaves the server's additions out when asked, and only them", () => {
    const html = '<p><a href="https://skyl.app/gecekodu">site</a> <a href="mailto:ayse@ornek.com">mail</a></p>';
    assert.equal(sanitizeLikeServer(html, { serverAdditions: false }), html);
    assert.equal(
      sanitizeLikeServer(html),
      '<p><a href="https://skyl.app/gecekodu" target="_blank" rel="noopener">site</a> <a href="mailto:ayse@ornek.com">mail</a></p>',
    );
  });
});

describe("a link's address, as the server writes it", () => {
  it("is Go's serialisation of the address, or null when the server drops the link", () => {
    assert.equal(serverHref("https://skyl.app/gecekodu"), "https://skyl.app/gecekodu");
    assert.equal(serverHref("HTTPS://Ornek.COM/Yol"), "https://Ornek.COM/Yol");
    assert.equal(serverHref("https://ornek.com/a|b^c#x{y}|z"), "https://ornek.com/a%7Cb%5Ec#x%7By%7D%7Cz");
    assert.equal(serverHref("https://ornek.com/#"), "https://ornek.com/");
    assert.equal(serverHref("mailto:ayse@ornek.com"), "mailto:ayse@ornek.com");
    for (const dropped of ["javascript:alert(1)", "/goreli", "data:text/html,x", "http://ornek.com/a b", "https://ornek.com/%zz", "ftp://ornek.com/"]) {
      assert.equal(serverHref(dropped), null, dropped);
    }
  });

  it("is written the same way again: what it returns, the server keeps as it is", () => {
    for (const { input } of golden.cases) {
      for (const [, href] of input.matchAll(/href="([^"]*)"/g)) {
        const once = serverHref(href.replaceAll("&amp;", "&").replaceAll("&#39;", "'"));
        if (once !== null) assert.equal(serverHref(once), once, href);
      }
    }
  });
});
