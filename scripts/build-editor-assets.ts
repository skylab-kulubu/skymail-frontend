/**
 * Builds what the Mail template editor loads besides the Next.js app, into
 * public/ (both folders are generated and ignored by git). `dev` and `build`
 * run it first.
 *
 *  - public/render-sandbox/: the page the editor renders in, inside an iframe
 *    with an opaque origin (src/lib/template-editor/sandbox-frame.ts): the
 *    frame's script and the worker it renders in (src/render-sandbox/).
 *    Classic scripts, bundled here rather than by Next.js: a module script or
 *    a lazily loaded chunk would be a CORS request from the opaque origin,
 *    which the panel's static files do not answer, and Next's client runtime
 *    has no business in a page that only renders mail. Their file names carry
 *    a hash of their content, so they can be cached for good.
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

/** A file name carrying a hash of its content, so it can be cached for good. */
const hashed = (name: string, contents: Uint8Array) =>
  `${name}.${createHash("sha256").update(contents).digest("hex").slice(0, 16)}.js`;

async function buildRenderSandbox(): Promise<string> {
  const out = path.join(PUBLIC, "render-sandbox");
  const result = await build({
    entryPoints: {
      frame: path.join(ROOT, "src/render-sandbox/frame.ts"),
      worker: path.join(ROOT, "src/render-sandbox/worker.ts"),
    },
    outdir: out,
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
  const output = (name: string) => {
    const file = result.outputFiles.find((candidate) => path.basename(candidate.path) === `${name}.js`);
    if (!file) throw new Error(`esbuild wrote no ${name}.js`);
    return { name: hashed(name, file.contents), contents: file.contents };
  };
  const frame = output("frame");
  const worker = output("worker");

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, frame.name), frame.contents);
  await writeFile(path.join(out, worker.name), worker.contents);
  await writeFile(
    path.join(out, "index.html"),
    `<!doctype html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><title>SkyMail render ortamı</title></head>
<body><script src="${frame.name}" data-worker="${worker.name}"></script></body>
</html>
`,
  );
  const size = (bytes: Uint8Array) => `${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB`;
  return `${path.relative(ROOT, out)}/${frame.name} (${size(frame.contents)}), ${worker.name} (${size(worker.contents)})`;
}

async function copyMonaco(): Promise<string> {
  const packageDir = path.join(ROOT, "node_modules/monaco-editor");
  const { version } = JSON.parse(await readFile(path.join(packageDir, "package.json"), "utf8")) as { version: string };
  // The version the editor asks for (src/lib/template-editor/monaco-path.ts); any other goes.
  const out = path.join(PUBLIC, "monaco");
  const target = path.join(out, version, "vs");
  const copied = await readFile(path.join(target, "loader.js")).then(
    () => true,
    () => false,
  );
  if (!copied) {
    await rm(out, { recursive: true, force: true });
    await cp(path.join(packageDir, "min/vs"), target, { recursive: true });
  }
  return `${path.relative(ROOT, target)} (monaco-editor ${version})`;
}

const [sandbox, monaco] = await Promise.all([buildRenderSandbox(), copyMonaco()]);
console.log(`editor assets: ${sandbox}; ${monaco}`);
