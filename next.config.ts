import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The image runs `node server.js` from the standalone output; every setting
  // that differs between sandbox and production is read from the process
  // environment at request time, so one image serves both.
  output: "standalone",
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

export default nextConfig;
