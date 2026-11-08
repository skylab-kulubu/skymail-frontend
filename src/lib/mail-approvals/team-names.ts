/**
 * A Team request's Teams by name (ekip-postasi 05), on the request's page:
 * the request names them by id (`team_ids`) and its audience only the first.
 * The submitter reads their own Teams (`GET /me/team_audiences`); an approver
 * who reads lists (`skymail:lists:read`, YK) reads each Keycloak group. A
 * Team neither gives stays unnamed and is counted.
 */
import type { ApiClient } from "../api/client";
import { fetchList } from "../mailing-lists";
import { fetchTeamAudiences, teamName, teamsOf, type TeamNames } from "../send-form/teams";

export async function fetchTeamNames(
  api: ApiClient,
  ids: readonly string[],
  { known = {}, canReadLists }: { known?: Readonly<Record<string, string | null>>; canReadLists: boolean },
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const [id, name] of Object.entries(known)) if (name?.trim()) names.set(id.toLowerCase(), name.trim());
  if (ids.length === 0) return names;
  const missing = () => [...new Set(ids.map((id) => id.toLowerCase()))].filter((id) => !names.has(id));
  if (missing().length > 0) {
    for (const team of teamsOf(await fetchTeamAudiences(api, signal))) names.set(team.id.toLowerCase(), teamName(team));
  }
  const unread = missing();
  if (canReadLists && unread.length > 0) {
    const read = await Promise.allSettled(unread.map((id) => fetchList(api, id, signal)));
    read.forEach((answer, index) => {
      if (answer.status === "fulfilled" && answer.value?.name?.trim()) names.set(unread[index], answer.value.name.trim());
    });
  }
  return names;
}

/** The names read, as the page asks for them. */
export function teamNamesOf(names: ReadonlyMap<string, string> | null): TeamNames {
  return (id) => names?.get(id.toLowerCase()) ?? null;
}
