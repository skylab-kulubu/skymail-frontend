/**
 * A free announcement's body read back into the Visual editor (ticket 20): an
 * approver edits a submitted BodyHtml, a submitter a returned or rejected
 * one, in the same restricted editor it was written in. What the form sent is
 * free-body.ts's render, so reading it back must give a document that renders
 * to the very same markup; anything else is read as well as it can be, and
 * said not to be exact.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { freeBodyFromSource, renderFreeBody } from "./free-body";
import { readFreeBody } from "./free-body-read";
import { buildVisual as b, visualSource, type VisualBlock, type VisualDocument, type VisualInline, type VisualMark } from "./visual-document";

const bold: VisualMark = { type: "bold" };
const italic: VisualMark = { type: "italic" };
const link = (href: string): VisualMark => ({ type: "link", href });

function html(document: VisualDocument): string {
  const body = renderFreeBody(document);
  assert.ok(body.ok, body.ok ? "" : body.problems.join("; "));
  return body.html;
}

describe("reading a free announcement's body back", () => {
  it("gives every block, level, mark and line break the renderer writes", () => {
    const document = b.document([
      b.heading([b.text("Başvurular açıldı")]),
      b.heading([b.text("Program")], 3),
      b.paragraph([b.text("Son gün "), b.text("5 Nisan", [bold]), b.text(". Ayrıntılar "), b.text("burada", [link("https://skyl.app/gecekodu")]), b.text(".")]),
      b.paragraph([b.text("a"), b.hardBreak(), b.text("b", [bold, italic, link("mailto:ayse@ornek.com")])]),
      b.list(false, [[b.text("24 saat")], [b.text("3–5 kişi", [italic])]]),
      b.list(true, [[b.text("bir"), b.hardBreak(), b.text("iki")]]),
      b.quote([b.text("Bir gecede bir ürün.")]),
    ]);
    const read = readFreeBody(html(document));
    assert.equal(read.exact, true);
    assert.deepEqual(read.document, document);
  });

  it("gives back what the sender typed as text, escaped or not", () => {
    const typed = `Davutpaşa'da "tırnak" a & b 3 < 5 > 2 <script>x</script> &amp; {{.Secret}}`;
    const read = readFreeBody(html(b.document([b.paragraph([b.text(typed)])])));
    assert.equal(read.exact, true);
    assert.deepEqual(read.document.blocks, [b.paragraph([b.text(typed)])]);
  });

  it("is empty for an empty body", () => {
    assert.deepEqual(readFreeBody(""), { document: b.document([]), exact: true });
    assert.deepEqual(readFreeBody("   ").document, b.document([]));
  });

  // A body written some other way — the old markdown converter, another client
  // — is read as well as it can be: its text is never lost.
  it("reads markup it did not write as well as it can, and says it is not exact", () => {
    const read = readFreeBody('<div class="x">Merhaba <b>dünya</b></div><h1>Başlık</h1><h4>Alt</h4><p><u>altı</u> <a>çizili</a></p><img src="x">');
    assert.equal(read.exact, false);
    assert.deepEqual(read.document.blocks, [
      b.paragraph([b.text("Merhaba "), b.text("dünya", [bold])]),
      b.heading([b.text("Başlık")]),
      b.heading([b.text("Alt")], 3),
      b.paragraph([b.text("altı"), b.text(" "), b.text("çizili")]),
    ]);
  });

  it("keeps a link's text but not an address the editor cannot hold", () => {
    const read = readFreeBody('<p><a href="javascript:alert(1)">tıkla</a> ve <a href="https://ornek.com/{{.X}}">bu</a></p>');
    assert.equal(read.exact, false);
    assert.deepEqual(read.document.blocks, [b.paragraph([b.text("tıkla"), b.text(" ve "), b.text("bu")])]);
  });

  it("takes marks and breaks out of a heading, which has none", () => {
    const read = readFreeBody("<h2><strong>Kalın</strong><br>başlık</h2>");
    assert.equal(read.exact, false);
    assert.deepEqual(read.document.blocks, [b.heading([b.text("Kalın"), b.text("başlık")])]);
  });

  it("decodes named and numbered character references", () => {
    const read = readFreeBody("<p>&lt;a&gt; &quot;b&quot; &#39;c&#x27; d&nbsp;e &copy;</p>");
    assert.deepEqual(read.document.blocks, [b.paragraph([b.text(`<a> "b" 'c' d\u00a0e &copy;`)])]);
  });
});

/** A small generator with a fixed seed, so a failure names a body that can be run again. */
function generator(seed: number) {
  let state = seed;
  const next = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)];
  return { next, pick };
}

const TEXTS = [
  "Merhaba",
  "Davutpaşa'da",
  '"tırnak"',
  "a & b",
  "3 < 5 > 2",
  "<script>alert(1)</script>",
  "&amp; &lt; &#39; &nbsp;",
  "{{.Secret}}",
  "</p><p>",
  "🎉 İstanbul ığüşöç",
  "\t",
  " ",
];

const HREFS = [
  "https://skyl.app/gecekodu",
  "HTTPS://Ornek.COM/Yol",
  "https://ornek.com/a b",
  "https://ornek.com/ş?q=ç#bölüm",
  "https://ornek.com/a|b^c#x{y}|z",
  "https://ornek.com/it's(1)!*[x]\"><script>",
  "mailto:ayse@ornek.com?subject=Merhaba Dünya",
  "https://[::1]/",
];

function randomDocument(seed: number): VisualDocument {
  const { next, pick } = generator(seed);
  const marks = (): VisualMark[] => [
    ...(next() < 0.3 ? [bold] : []),
    ...(next() < 0.3 ? [italic] : []),
    ...(next() < 0.3 ? [link(pick(HREFS))] : []),
  ];
  const line = (rich: boolean): VisualInline[] =>
    Array.from({ length: 1 + Math.floor(next() * 4) }, () => (rich && next() < 0.15 ? b.hardBreak() : b.text(pick(TEXTS), rich ? marks() : [])));
  return b.document(
    Array.from({ length: 1 + Math.floor(next() * 5) }, (): VisualBlock => {
      const kind = next();
      if (kind < 0.15) return b.heading(line(false));
      if (kind < 0.25) return b.heading(line(false), 3);
      if (kind < 0.35) return b.quote(line(true));
      if (kind < 0.7) return b.paragraph(line(true));
      return b.list(next() < 0.5, Array.from({ length: 1 + Math.floor(next() * 3) }, () => line(true)));
    }),
  );
}

describe("a body the form wrote, read back and written again", () => {
  it("is the same markup, byte for byte, through the editor's source", () => {
    for (let seed = 1; seed <= 400; seed += 1) {
      const written = html(randomDocument(seed));
      const read = readFreeBody(written);
      assert.equal(read.exact, true, `seed ${seed}: ${written}`);
      const again = freeBodyFromSource(visualSource(read.document));
      assert.ok(again.ok, `seed ${seed}`);
      assert.equal(again.html, written, `seed ${seed}`);
    }
  });
});
