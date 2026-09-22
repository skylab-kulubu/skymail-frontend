/**
 * The rule that decides whether the template editor may save. Two properties
 * have to hold at once: a body which did not render is never written over a
 * template a live service sends, and an operator who did not touch the code
 * can still reword the template around it (ADR-0045).
 *
 * These are the scenarios scripts/check-template-save.ts held, now driven by
 * real renders of the sources rather than by a hand-written editor state.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideSave, renderSource, type SaveDecision, type SourceInput, type SourceRender } from ".";

// What seed-templates.ts writes into react_email_content until ticket 09.
const SEEDED_STUB =
  "// Kaynak: skymail-frontend/emails/core.welcome.tsx — burada düzenlersen repodaki kaynakla ayrışır.\n";

const GOOD_CODE = "export default () => <p>Merhaba</p>;";

const jsx = (source: string): SourceInput => ({ mode: "jsx", source });

const cases: {
  name: string;
  /** What is in the editor when Save is pressed. */
  editing: SourceInput;
  /** Which source the editor last finished rendering, if any. */
  rendered: SourceInput | null;
  /** The source of the same mode the row was loaded with; null while creating. */
  stored: SourceInput | null;
  expect: SaveDecision;
}[] = [
  {
    // The reason the guard exists: this used to write an empty body.
    name: "seed stub'ı düzenlendi, derlenmiyor",
    editing: jsx(SEEDED_STUB + "bozuk"),
    rendered: jsx(SEEDED_STUB + "bozuk"),
    stored: jsx(SEEDED_STUB),
    expect: "blocked",
  },
  {
    // The reason the guard is not a blanket refusal: rewording a system
    // template must not need a release.
    name: "seed stub'ına dokunulmadı, sadece konu değişti",
    editing: jsx(SEEDED_STUB),
    rendered: jsx(SEEDED_STUB),
    stored: jsx(SEEDED_STUB),
    expect: "keep",
  },
  {
    name: "derlenen şablon",
    editing: jsx(GOOD_CODE),
    rendered: jsx(GOOD_CODE),
    stored: jsx(GOOD_CODE),
    expect: "render",
  },
  {
    // The editor still shows the last good render, which is not this code's.
    name: "önce derlendi, sonra bozuldu (önizleme eskisinde)",
    editing: jsx(GOOD_CODE + " oops"),
    rendered: jsx(GOOD_CODE),
    stored: jsx(GOOD_CODE),
    expect: "blocked",
  },
  {
    name: "önce derlendi, sonra bozuldu (bozuk hali render edildi)",
    editing: jsx(GOOD_CODE + " oops"),
    rendered: jsx(GOOD_CODE + " oops"),
    stored: jsx(GOOD_CODE),
    expect: "blocked",
  },
  {
    // The debounce has not run yet, so the render belongs to older code.
    name: "debounce henüz koşmadı",
    editing: jsx(GOOD_CODE + "\n"),
    rendered: jsx(GOOD_CODE),
    stored: jsx(GOOD_CODE),
    expect: "blocked",
  },
  {
    // Creating: there is no stored body to fall back on.
    name: "yeni şablon, hiç render edilmedi",
    editing: jsx(GOOD_CODE),
    rendered: null,
    stored: null,
    expect: "blocked",
  },
  {
    name: "yeni şablon, derlenmiyor",
    editing: jsx("export default () => <p>Merhaba</p"),
    rendered: jsx("export default () => <p>Merhaba</p"),
    stored: null,
    expect: "blocked",
  },
  {
    name: "bileşen render sırasında hata veriyor",
    editing: jsx('export default () => { throw new Error("hata"); };'),
    rendered: jsx('export default () => { throw new Error("hata"); };'),
    stored: jsx(GOOD_CODE),
    expect: "blocked",
  },
  {
    name: "bileşen boş render ediyor",
    editing: jsx("export default () => null;"),
    rendered: jsx("export default () => null;"),
    stored: jsx(GOOD_CODE),
    expect: "blocked",
  },
  {
    // The same text is not the same source in another Authoring mode.
    name: "aynı metin başka modda render edildi",
    editing: { mode: "html", source: GOOD_CODE },
    rendered: jsx(GOOD_CODE),
    stored: null,
    expect: "blocked",
  },
  {
    // Keeping a body is only safe when it is the same source: the same text
    // stored for another mode says nothing about this one.
    name: "aynı metin başka modda saklı, dokunulmadı sanılmasın",
    editing: { mode: "html", source: SEEDED_STUB },
    rendered: null,
    stored: jsx(SEEDED_STUB),
    expect: "blocked",
  },
  {
    name: "HTML kaynağı render edildi",
    editing: { mode: "html", source: "<p>Merhaba {{.FirstName}}</p>" },
    rendered: { mode: "html", source: "<p>Merhaba {{.FirstName}}</p>" },
    stored: null,
    expect: "render",
  },
  {
    name: "HTML kaynağı boşaltıldı",
    editing: { mode: "html", source: "" },
    rendered: { mode: "html", source: "" },
    stored: { mode: "html", source: "<p>Merhaba</p>" },
    expect: "blocked",
  },
];

describe("whether the editor may save", () => {
  for (const { name, editing, rendered, stored, expect } of cases) {
    it(`${name} → ${expect}`, async () => {
      const lastRender: SourceRender | null = rendered ? await renderSource(rendered) : null;

      assert.equal(decideSave(editing, lastRender, stored), expect);
    });
  }
});
