/**
 * An open is not a read (design note 07 §3.2): Apple Mail loads a mail's
 * images by itself and Outlook blocks them. The panel says "Açılma görüldü" /
 * "Açılma görülmedi" and never that someone read, or did not read, a mail.
 * This walks every source file under src/ for the forms of "okumak" that
 * would say so.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const SRC = join(import.meta.dirname, "..");
const SELF = relative(SRC, import.meta.filename);

// The forms that say a person read or did not read, spelled in parts so this
// file does not hold them. "okunamadı" (a file could not be parsed) and
// "okunur" (a list is readable) say nothing of a recipient and stay allowed.
const STEMS = ["oku" + "du", "oku" + "madı", "oku" + "mamış", "oku" + "yan", "oku" + "mayan", "oku" + "ndu", "oku" + "nmadı"];
// A form at the start of a word: "dokunmadığın" (touch) is not a reading.
const READ = new RegExp(`(?<![\\p{L}])(${STEMS.join("|")})\\p{L}*`, "giu");

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (/\.(tsx?|jsx?|json|md)$/.test(entry.name)) yield path;
  }
}

describe("the panel's words for opens", () => {
  it("never say a recipient read or did not read a mail", () => {
    const hits: string[] = [];
    for (const file of sourceFiles(SRC)) {
      if (relative(SRC, file) === SELF) continue;
      for (const match of readFileSync(file, "utf8").matchAll(READ)) hits.push(`${relative(SRC, file)}: ${match[0]}`);
    }
    assert.deepEqual(hits, []);
  });

  it("would catch them", () => {
    const sample = ["Ali postayı " + "oku" + "du", "Oku" + "madı", "oku" + "nmadı", "oku" + "yanlar"].join(" ");
    assert.equal([...sample.matchAll(READ)].length, 4);
    assert.equal([..."Ona dokunmadığın sürece; dosya oku".concat("namadı; liste oku", "nur").matchAll(READ)].length, 0);
  });
});
