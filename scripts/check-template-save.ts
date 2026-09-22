/**
 * Exercises the rule that decides whether the template editor may save. The
 * property that has to hold is that a body which did not render is never
 * written over a template a live service sends.
 */
import { isSavable, type TemplateRenderState } from "../src/lib/template-render";

// What seed-templates.ts actually writes into react_email_content.
const SEEDED_STUB =
  "// Kaynak: skymail-frontend/emails/core.welcome.tsx — burada düzenlersen repodaki kaynakla ayrışır.\n";

const GOOD_CODE = "export default () => <p>Merhaba</p>;";

const cases: { name: string; state: TemplateRenderState; expect: boolean }[] = [
  {
    // The reason this rule exists.
    name: "seed'lenen şablon açıldı, derlenmedi",
    state: { code: SEEDED_STUB, renderedCode: null, previewHtml: "", error: "No default export found" },
    expect: false,
  },
  {
    name: "derlenen şablon",
    state: { code: GOOD_CODE, renderedCode: GOOD_CODE, previewHtml: "<p>Merhaba</p>", error: null },
    expect: true,
  },
  {
    // The preview still holds the last good HTML, which is not this code's.
    name: "önce derlendi, sonra bozuldu",
    state: { code: GOOD_CODE + " oops", renderedCode: GOOD_CODE, previewHtml: "<p>Merhaba</p>", error: "Unexpected token" },
    expect: false,
  },
  {
    // The 500ms debounce has not run yet, so the preview belongs to older code.
    name: "debounce henüz koşmadı",
    state: { code: GOOD_CODE + "\n", renderedCode: GOOD_CODE, previewHtml: "<p>Merhaba</p>", error: null },
    expect: false,
  },
  {
    name: "boş önizleme, hata yok",
    state: { code: "", renderedCode: "", previewHtml: "", error: null },
    expect: false,
  },
];

let failed = 0;
for (const { name, state, expect } of cases) {
  const actual = isSavable(state);
  if (actual === expect) {
    console.log(`✓ ${name}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}: beklenen ${expect}, gelen ${actual}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} durum başarısız.`);
  process.exit(1);
}
console.log(`\n${cases.length} durum geçti.`);
