/**
 * Exercises the compose form's text → HTML conversion. The property that has to
 * hold is that nothing the sender types can become markup: every tag in the
 * output is one toEmailHtml emitted itself.
 */
import { extractVariables, toEmailHtml } from "../src/lib/rich-text";

const ALLOWED_TAGS = new Set(["p", "br", "strong", "em", "a", "ul", "ol", "li", "h2", "h3", "blockquote"]);

const cases: { name: string; input: string; expect?: string; mustNotContain?: string[] }[] = [
  { name: "paragraf", input: "Merhaba.\n\nİkinci paragraf.", expect: "<p>Merhaba.</p><p>İkinci paragraf.</p>" },
  { name: "kalın ve italik", input: "**kalın** ve *italik*", expect: "<p><strong>kalın</strong> ve <em>italik</em></p>" },
  { name: "başlık", input: "## Duyuru", expect: "<h2>Duyuru</h2>" },
  { name: "madde listesi", input: "- bir\n- iki", expect: "<ul><li>bir</li><li>iki</li></ul>" },
  { name: "sıralı liste", input: "1. bir\n2. iki", expect: "<ol><li>bir</li><li>iki</li></ol>" },
  { name: "alıntı", input: "> not", expect: "<blockquote>not</blockquote>" },
  {
    name: "bağlantı",
    input: "[site](https://yildizskylab.com)",
    expect: '<p><a href="https://yildizskylab.com">site</a></p>',
  },
  {
    name: "script etiketi metne döner",
    input: "<script>alert(1)</script>",
    mustNotContain: ["<script", "</script"],
  },
  {
    // The dangerous string survives as visible text — escaped, so it is words on
    // the page rather than an attribute the client acts on.
    name: "ham html metne döner",
    input: '<img src=x onerror="steal()">',
    expect: "<p>&lt;img src=x onerror=&quot;steal()&quot;&gt;</p>",
    mustNotContain: ["<img"],
  },
  {
    name: "javascript bağlantısı geçmez",
    input: "[tıkla](javascript:steal())",
    mustNotContain: ['href="javascript'],
  },
  {
    name: "tırnak kaçışı",
    input: 'o "şey" burada',
    mustNotContain: ['"şey"'],
  },
];

let failed = 0;

for (const testCase of cases) {
  const output = toEmailHtml(testCase.input);

  const tags = [...output.matchAll(/<\/?([a-zA-Z0-9]+)/g)].map((match) => match[1].toLowerCase());
  const rogue = tags.filter((tag) => !ALLOWED_TAGS.has(tag));
  if (rogue.length > 0) {
    console.error(`✗ ${testCase.name}: izin listesi dışında etiket → ${rogue.join(", ")}`);
    failed += 1;
    continue;
  }

  if (testCase.expect && output !== testCase.expect) {
    console.error(`✗ ${testCase.name}\n    beklenen: ${testCase.expect}\n    çıkan   : ${output}`);
    failed += 1;
    continue;
  }

  const leaked = (testCase.mustNotContain ?? []).filter((needle) => output.includes(needle));
  if (leaked.length > 0) {
    console.error(`✗ ${testCase.name}: çıktıda olmaması gereken parça → ${leaked.join(", ")}\n    çıkan: ${output}`);
    failed += 1;
    continue;
  }

  console.log(`✓ ${testCase.name}`);
}

const variables = extractVariables(
  "<p>{{.Subject}} {{if .CtaUrl}}{{.CtaLabel}}{{end}} {{safeHTML .BodyHtml}} {{.FullName}}</p>",
  "{{.Subject}}",
);
const expected = ["BodyHtml", "CtaLabel", "CtaUrl", "Heading", "Subject"].filter((name) => name !== "Heading");
if (JSON.stringify(variables) !== JSON.stringify(expected)) {
  console.error(`✗ değişken çıkarımı: ${JSON.stringify(variables)} (beklenen ${JSON.stringify(expected)})`);
  failed += 1;
} else {
  console.log("✓ değişken çıkarımı (FullName mailer'dan geldiği için listede yok)");
}

if (failed > 0) {
  console.error(`\n${failed} kontrol başarısız.`);
  process.exit(1);
}
console.log("\nHepsi geçti.");
