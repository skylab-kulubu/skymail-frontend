import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig: NextConfig = {
  // The image runs `node server.js` from the standalone output; every setting
  // that differs between sandbox and production is read from the process
  // environment at request time, so one image serves both.
  output: "standalone",
  // Names the build (release.yml passes the commit SHA as a Docker build
  // argument). A start-first deploy runs the old and the new task side by side
  // for a few seconds; a page from one that navigates or calls a Server Action
  // on the other then reloads in full instead of mixing two builds' chunks and
  // action IDs. Unset (local builds) Next.js behaves as before.
  deploymentId: process.env.SKYMAIL_BUILD_ID || undefined,
  poweredByHeader: false,
  // The workspace above this repo holds other lockfiles; pin the root so the
  // traced output has the same shape locally as in the image.
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  // `next dev` would otherwise write AGENTS.md and CLAUDE.md into the repo on every start.
  agentRules: false,
  async headers() {
    return [
      {
        // The Mail template editor's render sandbox (src/lib/template-editor/
        // sandbox-frame.ts). The iframe that loads it is sandboxed already;
        // the CSP sandboxes the document itself too, so it has an opaque
        // origin even when opened or framed some other way.
        source: "/render-sandbox/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "sandbox allow-scripts" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        // Its scripts are named by a hash of their content.
        source: "/render-sandbox/:file((?:frame|worker)\\.[0-9a-f]{16}\\.js)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // Monaco, under the version it was copied from (scripts/build-editor-assets.ts).
        source: "/monaco/:version(\\d+\\.\\d+\\.\\d+)/vs/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

// Local development only (`next dev`). The club's edge does not let a page on
// http://localhost:3000 call its hosts cross-origin, so the browser calls this
// dev server on its own origin and the server forwards /sandbox-api/* to the
// sandbox API, never to production. Locally API_URL is
// http://localhost:3000/sandbox-api/api/skymail/v1 (.env.example). `next build`
// never adds this rewrite, so the image forwards nothing.
const sandboxApi = {
  source: "/sandbox-api/:path*",
  destination: "https://sandbox-api.yildizskylab.com/:path*",
};

export default function config(phase: string): NextConfig {
  if (phase !== PHASE_DEVELOPMENT_SERVER) return nextConfig;
  const api = process.env.API_URL ?? "";
  if (/^https:\/\/([\w-]+\.)*yildizskylab\.com(\/|$)/.test(api)) {
    console.warn(
      `⚠ API_URL=${api}: the browser would call that host from http://localhost:3000, which the edge does not allow. Use http://localhost:3000/sandbox-api/api/skymail/v1 (.env.example).`,
    );
  }
  return { ...nextConfig, rewrites: async () => [sandboxApi] };
}
