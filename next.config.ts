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
};

export default nextConfig;
