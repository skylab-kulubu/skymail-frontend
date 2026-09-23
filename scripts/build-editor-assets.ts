/**
 * Builds what the Mail template editor loads besides the Next.js app, into
 * public/ (both folders are generated and ignored by git). `dev` and `build`
 * run it first.
 *
 *  - public/render-sandbox/: the page the editor renders in, inside an iframe
 *    with an opaque origin (src/lib/template-editor/sandbox-frame.ts). One
 *    classic script, bundled here rather than by Next.js: a module script or
 *    a lazily loaded chunk would be a CORS request from the opaque origin,
 *    which the panel's static files do not answer, and Next's client runtime
 *    has no business in a page that only renders mail. Its file name carries
 *    a hash of its content, so it can be cached for good.
 *  - public/monaco/vs/: Monaco's own AMD build, copied from the monaco-editor
 *    package, so the code editor loads from the panel itself and not from a
 *    CDN (ADR-0046 turned editors down for loading from theirs), at the
 *    version yarn.lock pins.
 */
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");

async function buildRenderSandbox(): Promise<string> {
  const out = path.join(PUBLIC, "render-sandbox");
  const result = await build({
    entryPoints: [path.join(ROOT, "src/render-sandbox/main.ts")],
    tsconfig: path.join(ROOT, "tsconfig.json"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2022"],
    minify: true,
    write: false,
    legalComments: "none",
    logLevel: "warning",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const code = result.outputFiles[0].contents;
  const file = `render.${createHash("sha256").update(code).digest("hex").slice(0, 16)}.js`;

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, file), code);
  await writeFile(
    path.join(out, "index.html"),
    `<!doctype html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><title>SkyMail render ortamı</title></head>
<body><script src="${file}"></script></body>
</html>
`,
  );
  return `${path.relative(ROOT, out)}/${file} (${(code.byteLength / 1024 / 1024).toFixed(1)} MB)`;
}

async function copyMonaco(): Promise<string> {
  const packageDir = path.join(ROOT, "node_modules/monaco-editor");
  const { version } = JSON.parse(await readFile(path.join(packageDir, "package.json"), "utf8")) as { version: string };
  const out = path.join(PUBLIC, "monaco");
  const marker = path.join(out, "VERSION");
  const copied = await readFile(marker, "utf8").catch(() => null);
  if (copied?.trim() !== version) {
    await rm(out, { recursive: true, force: true });
    await cp(path.join(packageDir, "min/vs"), path.join(out, "vs"), { recursive: true });
    await writeFile(marker, `${version}\n`);
  }
  return `${path.relative(ROOT, out)}/vs (monaco-editor ${version})`;
}

const [sandbox, monaco] = await Promise.all([buildRenderSandbox(), copyMonaco()]);
console.log(`editor assets: ${sandbox}; ${monaco}`);
