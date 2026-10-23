/**
 * Keeps the panel's roles in step with the session after the page loaded.
 *
 * The console layout renders with the roles the session had then, and an App
 * Router layout is not rendered again when the viewer moves between pages. A
 * role granted or taken in Keycloak reaches the session cookie with the next
 * token refresh (the access token lives five minutes), but the menu and the
 * page gates kept the roles of the first render until a full reload: people
 * signed out and in again to see a new role (ticket ekip-yetkileri 05).
 *
 * Two reads, as other panels do it (Entra's apps refresh on focus, and retry
 * once with a fresh token when told no):
 *
 * - check(): reads the session as it is (no Keycloak call unless the token is
 *   about to expire), when the tab comes back into view and when the viewer
 *   moves to another page; at most once per CHECK_INTERVAL_MS.
 * - confirm(): refreshes the token now. A page that says the viewer lacks a
 *   role asks for this first, so a role granted minutes ago opens it; at most
 *   once per CONFIRM_INTERVAL_MS, so a page that is simply not theirs does not
 *   send every visit to Keycloak.
 */

/** Whether two role lists hold the same roles, in any order. */
export function sameRoles(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) return false;
  for (const role of left) if (!right.has(role)) return false;
  return true;
}

export const CHECK_INTERVAL_MS = 10_000;
export const CONFIRM_INTERVAL_MS = 60_000;

export type RoleSyncOptions = {
  /** The roles the page shows now. */
  current: () => readonly string[];
  /** The session's roles as they are; null when there is no usable session. */
  read: () => Promise<readonly string[] | null>;
  /** The roles of a token refreshed now; null when the refresh did not happen. */
  refresh: () => Promise<readonly string[] | null>;
  /** Shows `roles`; called only when they differ from current(). */
  apply: (roles: readonly string[]) => void;
  now?: () => number;
};

export type RoleSync = {
  check(): Promise<void>;
  /** Resolves to the roles the page holds afterwards. */
  confirm(): Promise<readonly string[]>;
};

export function createRoleSync({ current, read, refresh, apply, now = Date.now }: RoleSyncOptions): RoleSync {
  // The page was just rendered with the session's roles: nothing to check yet.
  let checkedAt = now();
  let confirmedAt = Number.NEGATIVE_INFINITY;
  let checking: Promise<void> | null = null;
  let confirming: Promise<readonly string[]> | null = null;

  function adopt(roles: readonly string[] | null): readonly string[] {
    if (roles && !sameRoles(roles, current())) {
      apply(roles);
      return roles;
    }
    return current();
  }

  return {
    check() {
      if (checking) return checking;
      if (confirming || now() - checkedAt < CHECK_INTERVAL_MS) return Promise.resolve();
      checkedAt = now();
      checking = read()
        .then(adopt, () => current())
        .then(() => undefined)
        .finally(() => {
          checking = null;
        });
      return checking;
    },
    confirm() {
      if (confirming) return confirming;
      if (now() - confirmedAt < CONFIRM_INTERVAL_MS) return Promise.resolve(current());
      confirmedAt = now();
      confirming = refresh()
        .then(adopt, () => current())
        .finally(() => {
          checkedAt = now();
          confirming = null;
        });
      return confirming;
    },
  };
}
