/**
 * A free announcement's body (ticket 16): written in the Visual editor,
 * rendered to the plain markup free.basic's `{{safeHTML .BodyHtml}}` takes,
 * and narrowed again by the server's allow-list on the way out. The trust
 * boundary does not move: the server still sanitises. What these tests pin
 * is that the renderer writes nothing the server would drop or rewrite — its
 * output goes through the allow-list (server-allowlist.ts, held to the real
 * one) byte for byte — so what the sender sees in the preview is what goes
 * out, and that nothing a sender types becomes markup.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FREE_BODY_ALLOWANCE, freeBodyFromSource, renderFreeBody } from "./free-body";
import { sanitizeLikeServer } from "./server-allowlist";
import { buildVisual as b, visualSource, type VisualBlock, type VisualDocument, type VisualInline, type VisualMark } from "./visual-document";

const doc = (...blocks: VisualBlock[]) => b.document(blocks);

function html(document: VisualDocument): string {
  const body = renderFreeBody(document);
  assert.ok(body.ok, body.ok ? "" : body.problems.join("; "));
  return body.html;
}

const bold: VisualMark = { type: "bold" };
const italic: VisualMark = { type: "italic" };
const link = (href: string): VisualMark => ({ type: "link", href });

describe("a free announcement's body", () => {
  it("is a heading as h2, a paragraph as p, a button as a link in a paragraph of its own", () => {
    assert.equal(
      html(
        doc(
          b.heading([b.text("GECEKODU başvuruları açıldı")]),
          b.paragraph([b.text("Bu yıl 12–13 Nisan'da.")]),
          b.button("Başvuruya git", { url: "https://skyl.app/gecekodu" }),
        ),
      ),
      "<h2>GECEKODU başvuruları açıldı</h2>" +
        "<p>Bu yıl 12–13 Nisan&#39;da.</p>" +
        '<p><a href="https://skyl.app/gecekodu"><strong>Başvuruya git</strong></a></p>',
    );
  });

  it("puts a link inside, italic around it and bold outside, as the Visual render does", () => {
    assert.equal(
      html(doc(b.paragraph([b.text("Ayrıntılar "), b.text("burada", [link("https://skyl.app/e"), bold, italic]), b.text(".")]))),
      '<p>Ayrıntılar <strong><em><a href="https://skyl.app/e">burada</a></em></strong>.</p>',
    );
    assert.equal(html(doc(b.paragraph([b.text("kalın", [bold]), b.text(" ve "), b.text("italik", [italic])]))), "<p><strong>kalın</strong> ve <em>italik</em></p>");
  });

  it("writes what the sender typed as text, escaped the way the server writes it back", () => {
    assert.equal(
      html(doc(b.paragraph([b.text(`<script>alert("x")</script> & 'tek' {{.Secret}}`)]))),
      "<p>&lt;script&gt;alert(&#34;x&#34;)&lt;/script&gt; &amp; &#39;tek&#39; {{.Secret}}</p>",
    );
    assert.equal(html(doc(b.button(`"Git" & <gör>`, { url: "https://skyl.app/" }))), '<p><a href="https://skyl.app/"><strong>&#34;Git&#34; &amp; &lt;gör&gt;</strong></a></p>');
  });

  it("writes a link's address as the server will write it", () => {
    assert.equal(
      html(doc(b.paragraph([b.text("x", [link("https://ornek.com/a b|c?q=ç&r='1'#bölüm{2}")])]))),
      '<p><a href="https://ornek.com/a%20b%7Cc?q=%C3%A7&amp;r=%271%27#b%C3%B6l%C3%BCm%7B2%7D">x</a></p>',
    );
    assert.equal(html(doc(b.button("Yaz", { url: "mailto:ayse@ornek.com?subject=Merhaba Dünya" }))), '<p><a href="mailto:ayse@ornek.com?subject=Merhaba%20D%C3%BCnya"><strong>Yaz</strong></a></p>');
  });

  it("refuses a link the server would drop rather than letting it vanish on the way", () => {
    const body = renderFreeBody(doc(b.paragraph([b.text("bozuk", [link("https://ornek.com/%zz")])]), b.button("Git", { url: "https://ornek.com/%zz" })));
    assert.deepEqual(body, {
      ok: false,
      problems: [
        'blocks[0].content[0]: "https://ornek.com/%zz" adresini sunucu kabul etmiyor; mailde bağlantı düşer. Adresi düzelt.',
        'blocks[1].link: "https://ornek.com/%zz" adresini sunucu kabul etmiyor; mailde bağlantı düşer. Adresi düzelt.',
      ],
    });
  });

  it("is nothing when nothing in it shows", () => {
    assert.deepEqual(renderFreeBody(doc()), { ok: true, html: "" });
    assert.deepEqual(renderFreeBody(doc(b.paragraph([]), b.heading([]), b.paragraph([]))), { ok: true, html: "" });
  });

  it("uses only what the server keeps: no variables, sections, images or rules", () => {
    const refused = freeBodyFromSource(
      visualSource(
        doc(
          b.paragraph([b.text("Merhaba "), b.variable("FirstName")]),
          b.button("Bilet", { variable: "TicketUrl" }),
          b.image("https://cdn.yildizskylab.com/images/a", "logo"),
          b.divider(),
          b.conditional("Venue", "set", [b.paragraph([b.text("Yer")])]),
        ),
      ),
    );
    assert.deepEqual(refused, {
      ok: false,
      problems: [
        "blocks[0].content[1]: değişken burada kullanılamaz",
        "blocks[1].link: bağlantı burada bir değişken olamaz",
        'blocks[2]: "image" bloğu burada kullanılamaz',
        'blocks[3]: "divider" bloğu burada kullanılamaz',
        'blocks[4]: "conditional" bloğu burada kullanılamaz',
      ],
    });
    assert.deepEqual(FREE_BODY_ALLOWANCE, { blocks: ["heading", "paragraph", "button"], marks: ["bold", "italic", "link"], variables: false });
  });

  it("reads a Visual source and says what is wrong with one it cannot", () => {
    assert.deepEqual(freeBodyFromSource(visualSource(doc(b.paragraph([b.text("Merhaba")])))), { ok: true, html: "<p>Merhaba</p>" });
    assert.equal(freeBodyFromSource("{").ok, false);
  });
});

// ---------------------------------------------------------------------------
// The allow-list keeps every body as it is

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
  '<img src=x onerror="steal()">',
  "&amp; &lt; &#39; &nbsp;",
  "{{.Secret}}",
  "{{safeHTML .X}}",
  "satır\r\nsatır",
  "  ",
  "🎉 İstanbul ığüşöç",
  "<!-- yorum -->",
  "</p><p>",
  "<a href=\"javascript:x\">",
  "\t",
];

const HREFS = [
  "https://skyl.app/gecekodu",
  "https://yildizskylab.com",
  "HTTPS://Ornek.COM/Yol",
  "https://ornek.com/a b",
  "https://ornek.com/ş?q=ç#bölüm",
  "https://ornek.com/a|b^c#x{y}|z",
  "https://ornek.com/it's(1)!*[x]",
  "https://ornek.com/?a=1&b=2",
  "https://ornek.com/#",
  "https://ornek.com/#a#b",
  "https://u:p@ornek.com/",
  "http://ornek.com:8080/x",
  "mailto:ayse@ornek.com",
  "mailto:ayse@ornek.com?subject=Merhaba Dünya",
  "https://[::1]/",
  "https://şirket.com/",
];

function randomDocument(seed: number): VisualDocument {
  const { next, pick } = generator(seed);
  const marks = (): VisualMark[] => [
    ...(next() < 0.3 ? [bold] : []),
    ...(next() < 0.3 ? [italic] : []),
    ...(next() < 0.3 ? [link(pick(HREFS))] : []),
  ];
  const inlines = (withMarks: boolean): VisualInline[] =>
    Array.from({ length: Math.floor(next() * 4) }, () => b.text(pick(TEXTS), withMarks ? marks() : []));
  return doc(
    ...Array.from({ length: 1 + Math.floor(next() * 5) }, (): VisualBlock => {
      const kind = next();
      if (kind < 0.25) return b.heading(inlines(false));
      if (kind < 0.8) return b.paragraph(inlines(true));
      // A button's label is never blank (the model refuses one).
      return b.button(pick(TEXTS.filter((text) => text.trim() !== "")), { url: pick(HREFS) });
    }),
  );
}

const HAND_WRITTEN: VisualDocument[] = [
  doc(
    b.heading([b.text("GECEKODU'26")]),
    b.paragraph([b.text("Bu yıl "), b.text("GECEKODU", [bold]), b.text(" 12–13 Nisan'da "), b.text("Davutpaşa", [italic, link("https://skyl.app/yol")]), b.text(".")]),
    b.button("Başvuruya Git", { url: "https://skyl.app/gecekodu" }),
  ),
  doc(b.paragraph([b.text("<b>kalın değil</b> & <u>altı çizili değil</u>")])),
];

const TAGS = /<\/?([a-z0-9]+)([^>]*)>/g;

describe("the server's allow-list, on a body this renderer wrote", () => {
  const bodies = [...HAND_WRITTEN, ...Array.from({ length: 400 }, (_, seed) => randomDocument(seed + 1))].map((document) => ({
    document,
    html: html(document),
  }));

  it("keeps every body byte for byte: nothing dropped, nothing rewritten", () => {
    const changed = bodies.filter(({ html: body }) => sanitizeLikeServer(body, { serverAdditions: false }) !== body);
    assert.deepEqual(changed.map(({ document }) => JSON.stringify(document)), []);
  });

  it("only adds what it adds to any link to another site: target and rel", () => {
    for (const { html: body } of bodies) {
      const served = sanitizeLikeServer(body);
      const expected = body.replace(/<a href="(https?:[^"]*)">/g, '<a href="$1" target="_blank" rel="noopener">');
      assert.equal(served, expected);
    }
  });

  it("writes only h2, p, strong, em and a with its href: what a sender types never becomes markup", () => {
    for (const { html: body } of bodies) {
      for (const [, tag, attributes] of body.matchAll(TAGS)) {
        assert.ok(["h2", "p", "strong", "em", "a"].includes(tag), `${tag} in ${body}`);
        assert.match(attributes, tag === "a" ? /^( href="[^"]*")?$/ : /^$/, body);
      }
    }
  });
});
