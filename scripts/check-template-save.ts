/**
 * Exercises the rule that decides whether the template editor may save. Two
 * properties have to hold at once: a body which did not render is never written
 * over a template a live service sends, and an operator who did not touch the
 * code can still reword the template around it (ADR-0045).
 */
import { decideSave, type SaveDecision, type TemplateRenderState } from "../src/lib/template-render";

// What seed-templates.ts actually writes into react_email_content.
const SEEDED_STUB =
  "// Kaynak: skymail-frontend/emails/core.welcome.tsx — burada düzenlersen repodaki kaynakla ayrışır.\n";

const GOOD_CODE = "export default () => <p>Merhaba</p>;";

const cases: {
  name: string;
  state: TemplateRenderState;
  storedCode: string | null;
  expect: SaveDecision;
}[] = [
  {
    // The reason the guard exists: this used to write an empty body.
    name: "seed stub'ı düzenlendi, derlenmiyor",
    state: { code: SEEDED_STUB + "bozuk", renderedCode: null, previewHtml: "", error: "No default export found" },
    storedCode: SEEDED_STUB,
    expect: "blocked",
  },
  {
    // The reason the guard is not a blanket refusal: rewording a system
    // template must not need a release.
    name: "seed stub'ına dokunulmadı, sadece konu değişti",
    state: { code: SEEDED_STUB, renderedCode: null, previewHtml: "", error: "No default export found" },
    storedCode: SEEDED_STUB,
    expect: "keep",
  },
  {
    name: "derlenen şablon",
    state: { code: GOOD_CODE, renderedCode: GOOD_CODE, previewHtml: "<p>Merhaba</p>", error: null },
    storedCode: GOOD_CODE,
    expect: "render",
  },
  {
    // The preview still holds the last good HTML, which is not this code's.
    name: "önce derlendi, sonra bozuldu",
    state: { code: GOOD_CODE + " oops", renderedCode: GOOD_CODE, previewHtml: "<p>Merhaba</p>", error: "Unexpected token" },
    storedCode: GOOD_CODE,
    expect: "blocked",
  },
  {
    // The 500ms debounce has not run yet, so the preview belongs to older code.
    name: "debounce henüz koşmadı",
    state: { code: GOOD_CODE + "\n", renderedCode: GOOD_CODE, previewHtml: "<p>Merhaba</p>", error: null },
    storedCode: GOOD_CODE,
    expect: "blocked",
  },
  {
    // Creating: there is no stored body to fall back on.
    name: "yeni şablon, derlenmemiş",
    state: { code: GOOD_CODE, renderedCode: null, previewHtml: "", error: "Unexpected token" },
    storedCode: null,
    expect: "blocked",
  },
];

let failed = 0;
for (const { name, state, storedCode, expect } of cases) {
  const actual = decideSave(state, storedCode);
  if (actual === expect) {
    console.log(`✓ ${name} → ${actual}`);
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
