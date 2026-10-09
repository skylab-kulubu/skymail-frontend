import { unstable_isUnrecognizedActionError } from "next/navigation";

/**
 * Reloads the page when `error` says a Server Action came from another build:
 * the page was loaded before a deploy, and the new server salts its action IDs
 * differently. The reload brings the new build's page, whose actions it knows.
 * `deploymentId` (next.config.ts) already turns a navigation across builds
 * into a full reload; Next.js does not do the same for Server Actions.
 *
 * Returns whether it reloaded.
 */
export function recoverFromVersionSkew(error: unknown, reload: () => void): boolean {
  if (!unstable_isUnrecognizedActionError(error)) return false;
  reload();
  return true;
}
