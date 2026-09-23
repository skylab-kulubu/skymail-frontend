/**
 * A free announcement's body (ticket 16): written in the Visual editor,
 * rendered to the plain markup free.basic's `{{safeHTML .BodyHtml}}` takes.
 * The trust boundary does not move: the server narrows the body to its
 * allow-list before anyone gets it. What these tests pin is that the renderer
 * only ever writes what that allow-list keeps — so nothing the sender wrote
 * is dropped on the way — and that nothing a sender types becomes markup.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FREE_BODY_ALLOWANCE, freeBodyFromSource, renderFreeBody } from "./free-body";
import { buildVisual as b, visualSource, type VisualBlock, type VisualDocument, type VisualInline, type VisualMark } from "./visual-document";

/**
 * The server's allow-list, copied from skymail-backend
 * internal/mailer/sanitize.go (origin/main, 2026-09-23): the elements it keeps
 * with no attribute, and `href` on `a`. A change there is a change here.
 */
const SERVER_ALLOWLIST = {
  elements: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h2", "h3", "blockquote"],
  attributes: { a: ["href"] } as Record<string, string[]>,
  schemes: ["http:", "https:", "mailto:"],
};

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
  it("is a heading as h2 and a sub-heading as h3, a paragraph as p, a list as ul or ol, a quote as blockquote, a line break as br", () => {
    assert.equal(
      html(
        doc(
          b.heading([b.text("GECEKODU başvuruları açıldı")]),
          b.heading([b.text("Program")], 3),
          b.quote([b.text("Bir gecede bir ürün."), b.hardBreak(), b.text("— GECEKODU '25", [italic])]),
          b.paragraph([b.text("Bu yıl 12–13 Nisan'da,"), b.hardBreak(), b.text("Davutpaşa'da.")]),
          b.list(false, [[b.text("24 saat")], [b.text("Takım: "), b.text("3–5 kişi", [bold])]]),
          b.list(true, [[b.text("Başvur")], [b.text("Bekle"), b.hardBreak(), b.text("Gel")]]),
        ),
      ),
      "<h2>GECEKODU başvuruları açıldı</h2>" +
        "<h3>Program</h3>" +
        "<blockquote>Bir gecede bir ürün.<br><em>— GECEKODU &#39;25</em></blockquote>" +
        "<p>Bu yıl 12–13 Nisan&#39;da,<br>Davutpaşa&#39;da.</p>" +
        "<ul><li>24 saat</li><li>Takım: <strong>3–5 kişi</strong></li></ul>" +
        "<ol><li>Başvur</li><li>Bekle<br>Gel</li></ol>",
    );
  });

  it("puts a link inside, italic around it and bold outside, as the Visual render does", () => {
    assert.equal(
      html(doc(b.paragraph([b.text("Ayrıntılar "), b.text("burada", [link("https://skyl.app/e"), bold, italic]), b.text(".")]))),
      '<p>Ayrıntılar <strong><em><a href="https://skyl.app/e">burada</a></em></strong>.</p>',
    );
  });

  it("writes what the sender typed as text", () => {
    assert.equal(
      html(doc(b.paragraph([b.text(`<script>alert("x")</script> & 'tek' {{.Secret}}`)]))),
      "<p>&lt;script&gt;alert(&#34;x&#34;)&lt;/script&gt; &amp; &#39;tek&#39; {{.Secret}}</p>",
    );
  });

  it("writes a link's address as the server will write it", () => {
    assert.equal(
      html(doc(b.paragraph([b.text("x", [link("https://ornek.com/a b|c?q=ç&r='1'#bölüm{2}")])]))),
      '<p><a href="https://ornek.com/a%20b%7Cc?q=%C3%A7&amp;r=%271%27#b%C3%B6l%C3%BCm%7B2%7D">x</a></p>',
    );
    assert.equal(
      html(doc(b.paragraph([b.text("Yaz", [link("mailto:ayse@ornek.com?subject=Merhaba Dünya")])]))),
      '<p><a href="mailto:ayse@ornek.com?subject=Merhaba%20D%C3%BCnya">Yaz</a></p>',
    );
  });

  it("refuses a link the server would drop rather than letting it vanish on the way", () => {
    assert.deepEqual(renderFreeBody(doc(b.list(false, [[b.text("bozuk", [link("https://ornek.com/%zz")])]]))), {
      ok: false,
      problems: ['blocks[0].items[0][0]: "https://ornek.com/%zz" adresini sunucu kabul etmiyor; mailde bağlantı düşer. Adresi düzelt.'],
    });
  });

  for (const [what, href, says] of [
    ["a javascript: link", "javascript:alert(1)", "adres https://, http:// ya da mailto: ile başlamalı"],
    ["a data: link", "data:text/html,<script>x</script>", "adres https://, http:// ya da mailto: ile başlamalı"],
    ["a link without a scheme", "skyl.app/gecekodu", '"skyl.app/gecekodu" bir adres değil'],
    ["a relative link", "/gecekodu", '"/gecekodu" bir adres değil'],
  ] as const) {
    it(`refuses ${what}`, () => {
      assert.deepEqual(renderFreeBody(doc(b.paragraph([b.text("tıkla", [link(href)])]))), {
        ok: false,
        problems: [`blocks[0].content[0].marks[0].href: ${says}`],
      });
    });
  }

  it("is nothing when nothing in it shows: empty blocks and empty items render nothing", () => {
    assert.deepEqual(renderFreeBody(doc()), { ok: true, html: "" });
    assert.deepEqual(renderFreeBody(doc(b.paragraph([]), b.heading([]), b.heading([], 3), b.quote([]), b.list(true, [[], []]))), { ok: true, html: "" });
    assert.equal(html(doc(b.list(false, [[], [b.text("bir")], []]))), "<ul><li>bir</li></ul>");
  });

  it("uses only what the server keeps: no variables, sections, images, rules or house buttons", () => {
    const refused = freeBodyFromSource(
      visualSource(
        doc(
          b.paragraph([b.text("Merhaba "), b.variable("FirstName")]),
          b.button("Bilet", { url: "https://skyl.app/bilet" }),
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
        'blocks[1]: "button" bloğu burada kullanılamaz',
        'blocks[2]: "image" bloğu burada kullanılamaz',
        'blocks[3]: "divider" bloğu burada kullanılamaz',
        'blocks[4]: "conditional" bloğu burada kullanılamaz',
      ],
    });
    assert.deepEqual(FREE_BODY_ALLOWANCE, {
      blocks: ["heading", "paragraph", "list", "quote"],
      marks: ["bold", "italic", "link"],
      variables: false,
      lineBreaks: true,
      subheadings: true,
    });
  });

  it("reads a Visual source and says what is wrong with one it cannot", () => {
    assert.deepEqual(freeBodyFromSource(visualSource(doc(b.paragraph([b.text("Merhaba")])))), { ok: true, html: "<p>Merhaba</p>" });
    assert.equal(freeBodyFromSource("{").ok, false);
  });
});

// ---------------------------------------------------------------------------
// Only what the allow-list keeps

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
  '<a href="javascript:x" style="color:red" class="c">',
  "&amp; &lt; &#39; &nbsp;",
  "{{.Secret}}",
  "<!-- yorum -->",
  "</p><p>",
  "🎉 İstanbul ığüşöç",
  "\t",
];

const HREFS = [
  "https://skyl.app/gecekodu",
  "HTTPS://Ornek.COM/Yol",
  "https://ornek.com/a b",
  "https://ornek.com/ş?q=ç#bölüm",
  "https://ornek.com/a|b^c#x{y}|z",
  "https://ornek.com/it's(1)!*[x]\"><script>",
  "https://u:p@ornek.com/",
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
    Array.from({ length: Math.floor(next() * 4) }, () => (rich && next() < 0.15 ? b.hardBreak() : b.text(pick(TEXTS), rich ? marks() : [])));
  return doc(
    ...Array.from({ length: 1 + Math.floor(next() * 5) }, (): VisualBlock => {
      const kind = next();
      if (kind < 0.15) return b.heading(line(false));
      if (kind < 0.25) return b.heading(line(false), 3);
      if (kind < 0.35) return b.quote(line(true));
      if (kind < 0.7) return b.paragraph(line(true));
      return b.list(next() < 0.5, Array.from({ length: Math.floor(next() * 4) }, () => line(true)));
    }),
  );
}

const TAG = /<(\/?)([a-z0-9]+)((?:\s[^>]*)?)>/gi;
const ATTRIBUTE = /\s([a-z-]+)="([^"]*)"/gi;

/** What does not fit the allow-list, in words; empty when everything does. */
function outsideTheAllowList(body: string): string[] {
  const outside: string[] = [];
  for (const [, closing, tag, attributes] of body.matchAll(TAG)) {
    const allowed = SERVER_ALLOWLIST.attributes[tag] ?? [];
    if (!SERVER_ALLOWLIST.elements.includes(tag) && !(tag in SERVER_ALLOWLIST.attributes)) outside.push(`<${tag}>`);
    for (const [, name, value] of attributes.matchAll(ATTRIBUTE)) {
      if (!allowed.includes(name)) outside.push(`${tag}[${name}]`);
      if (name === "href" && !SERVER_ALLOWLIST.schemes.includes(new URL(value.replaceAll("&amp;", "&")).protocol)) outside.push(`href ${value}`);
    }
    if (tag === "a" && !closing && attributes.trim() === "") outside.push("<a> without href");
  }
  return outside;
}

describe("what the renderer writes, against the server's allow-list", () => {
  const every = doc(
    b.heading([b.text("Başlık")]),
    b.heading([b.text("Alt başlık")], 3),
    b.quote([b.text("q", [bold, link("https://skyl.app/q")]), b.hardBreak(), b.text("r")]),
    b.paragraph([b.text("a", [bold, italic, link("https://skyl.app/")]), b.hardBreak(), b.text("b", [link("mailto:a@b.co")])]),
    b.list(false, [[b.text("x", [bold])]]),
    b.list(true, [[b.text("y", [italic]), b.hardBreak(), b.text("z")]]),
  );
  const bodies = [every, ...Array.from({ length: 400 }, (_, seed) => randomDocument(seed + 1))].map((document) => ({
    document,
    html: html(document),
  }));

  it("uses every block, level, mark and line break, and writes only elements and attributes the allow-list keeps", () => {
    assert.deepEqual([...new Set([...bodies[0].html.matchAll(TAG)].map((match) => match[2]))].sort(), ["a", "blockquote", "br", "em", "h2", "h3", "li", "ol", "p", "strong", "ul"]);
    const outside = bodies.flatMap(({ document, html: body }) => outsideTheAllowList(body).map((what) => `${what} in ${JSON.stringify(document)}`));
    assert.deepEqual(outside, []);
  });

  it("never makes markup of what the sender typed: every tag comes from a block, mark or break", () => {
    for (const { html: body } of bodies) {
      const text = body.replace(TAG, "");
      assert.doesNotMatch(text, /[<>]/, body);
    }
  });
});
