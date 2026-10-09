/**
 * Liveness for the container's health check (Dockerfile HEALTHCHECK) and for
 * Swarm's start-first deploy, which keeps the old task until the new one
 * answers here. It answers from this process alone — no Keycloak, no SkyMail
 * API — so an outage of either never restarts the panel. A missing environment
 * already stops the process at start (src/instrumentation-node.ts).
 *
 * src/proxy.ts lets it through without a session.
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}
