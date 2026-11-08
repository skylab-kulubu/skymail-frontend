/**
 * Ekip postası (ADR-0067 addendum of 2026-11-08; hub tickets ekip-postasi 05
 * and 06; skymail-backend #128): a Leader mails their own Team, or Sub-teams
 * below it, through Mail onayı.
 *
 *  - `GET /me/team_audiences` lists the Teams core says the viewer leads, in
 *    path order, as a tree (`parent_id`, `depth`), each with how many it
 *    reaches (members with an address, its Sub-teams' too; never an address).
 *    Empty: the viewer leads no Team. 404 `team_mail.off`: the switch is off.
 *    403: neither skymail:access nor a Team. 503
 *    `team_mail.leadership_unavailable`: core did not answer.
 *  - A request names the Teams in `team_ids` (1..50). A Sub-team picked with
 *    a Team above it is dropped (the Team above reaches its members anyway).
 *    The purpose is always duyuru and each Team's send goes with its own
 *    category, `team:<id>:duyuru`: the form shows it fixed and sends only the
 *    statement that the mail is not promotion.
 *  - A Leader without skymail:access (the "team seat") gets only this: their
 *    Teams, a free announcement (free.basic) and their own requests.
 */
import type { ApiClient } from "../api/client";
import { asApiError } from "../api/errors";
import { formatCount } from "../sends";
import type { MailTemplate } from "../templates";
import { FREE_TEMPLATE_KEY } from "./send";

export type TeamDisplayName = Readonly<{ tr: string; en?: string | null }>;

/** One Team the viewer may mail (`handlers.TeamAudience`). */
export type TeamAudience = Readonly<{
  id: string;
  path: string;
  code: string;
  display_name: TeamDisplayName | null;
  /** The nearest Team above it in the list; null for a top row. */
  parent_id: string | null;
  /** How many Teams above it are in the list: 0 for a top row. */
  depth: number;
  /** Its send's category, fixed: team:<id>:duyuru. */
  category: string;
  /** Members with an address, its Sub-teams' too, each once; null when Keycloak did not say in time. */
  recipient_count: number | null;
}>;

/** The most Teams one request names. */
export const TEAM_LIMIT = 50;

/**
 * What `GET /me/team_audiences` said: the Teams (none for one who leads no
 * Team, for a switch that is off, and for one who may not ask); or that core
 * did not say, which is not the same as none.
 */
export type TeamAudiences =
  | Readonly<{ status: "ready"; teams: readonly TeamAudience[] }>
  | Readonly<{ status: "unavailable"; message: string }>;

export const NO_TEAMS: TeamAudiences = { status: "ready", teams: [] };

/** An answer that may change if asked again: none at all, a timeout, too many requests, a server error (core's 503 among them). */
const unavailable = (status: number) => status === 0 || status === 408 || status === 429 || status >= 500;

/** The viewer's Teams; never throws. A refusal (off 404, not allowed 401/403, any other 4xx) reads as none; no answer or a server error as unavailable. */
export async function fetchTeamAudiences(api: ApiClient, signal?: AbortSignal): Promise<TeamAudiences> {
  try {
    const answer = await api.get<{ teams?: TeamAudience[] | null }>("/me/team_audiences", { signal });
    return { status: "ready", teams: answer?.teams ?? [] };
  } catch (error) {
    if (signal?.aborted) throw error;
    const refusal = asApiError(error);
    if (!unavailable(refusal.status)) return NO_TEAMS;
    return { status: "unavailable", message: teamsUnavailableText(refusal.code) };
  }
}

/** Why the Teams could not be read, in words. */
export function teamsUnavailableText(code: string): string {
  return code === "team_mail.leadership_unavailable"
    ? "Ekip liderliğin şu an doğrulanamadı. Birkaç saniye sonra yeniden dene."
    : "Ekiplerin şu an okunamadı. Birkaç saniye sonra yeniden dene.";
}

/** The Teams read, none while they could not be. */
export const teamsOf = (answer: TeamAudiences): readonly TeamAudience[] => (answer.status === "ready" ? answer.teams : []);

/** A Team's name: its Turkish display name, else its code, else the last part of its path. */
export function teamName(team: Pick<TeamAudience, "display_name" | "code" | "path">): string {
  return team.display_name?.tr?.trim() || team.code?.trim() || team.path.split("/").filter(Boolean).pop() || team.path;
}

/** How many a Team reaches, said beside it. */
export function teamCountText(team: Pick<TeamAudience, "recipient_count">): string {
  return team.recipient_count === null ? "Üye sayısı alınamadı" : `${formatCount(team.recipient_count)} üye`;
}

/** The picked Teams a Team above them, also picked, already covers: they are dropped (ADR 0067 addendum). */
export function coveredTeams(picked: ReadonlySet<string>, teams: readonly TeamAudience[]): Set<string> {
  const byId = new Map(teams.map((team) => [team.id, team]));
  const covered = new Set<string>();
  for (const team of teams) {
    const seen = new Set<string>();
    for (let parent = team.parent_id; parent && !seen.has(parent); parent = byId.get(parent)?.parent_id ?? null) {
      seen.add(parent);
      if (picked.has(parent)) {
        covered.add(team.id);
        break;
      }
    }
  }
  return covered;
}

/** The Teams a request goes to: the picked ones no picked Team above covers, in the list's (path) order. */
export function requestTeams(picked: ReadonlySet<string>, teams: readonly TeamAudience[]): TeamAudience[] {
  const covered = coveredTeams(picked, teams);
  return teams.filter((team) => picked.has(team.id) && !covered.has(team.id));
}

/**
 * What the picked Teams reach, said under the picker: one Team's count; for
 * several the sum, an upper bound (someone in two of them gets one mail);
 * null when nothing is picked.
 */
export function pickedCountText(teams: readonly TeamAudience[]): string | null {
  if (teams.length === 0) return null;
  if (teams.some((team) => team.recipient_count === null)) return "Seçilen ekiplerin üye sayısı alınamadı.";
  const total = teams.reduce((sum, team) => sum + (team.recipient_count ?? 0), 0);
  if (teams.length === 1) return `${formatCount(total)} üye. E-posta adresi olmayan üye sayılmaz.`;
  return `${formatCount(teams.length)} ekip, en çok ${formatCount(total)} üye. Birden çok ekipte olan kişiye tek posta gider.`;
}

/** What keeps the Teams from going: none picked, or more than a request takes. */
export function teamProblem(teams: readonly TeamAudience[]): string | null {
  if (teams.length === 0) return "En az bir ekip seç.";
  if (teams.length > TEAM_LIMIT) return `Bir istekte en çok ${TEAM_LIMIT} ekip olur; burada ${teams.length} ekip var.`;
  return null;
}

/** Who a Team request goes to, as the confirmation and the outcome say it. */
export function teamsWords(teams: readonly Pick<TeamAudience, "display_name" | "code" | "path">[]): string {
  if (teams.length === 1) return `“${teamName(teams[0])}” ekibine`;
  return `${formatCount(teams.length)} ekibe (${teams.map(teamName).join(", ")})`;
}

/** The purpose a Team request goes with, fixed. */
export const TEAM_PURPOSE_TEXT = "Duyuru · Ekip duyurusu (her ekip kendi kategorisiyle)";

/** Said under the fixed purpose. */
export const TEAM_PURPOSE_NOTE = "Ekibin duyurularını kapatan üyeye gitmez.";

/** Said to one who cannot read lists (`lists:read`): the Leader sees counts, never addresses (ADR 0067 addendum). */
export const TEAM_ADDRESSES_NOTE = "Alıcıların adreslerini görmezsin, yalnız sayıyı.";

/** Said beside the Team audience: it always goes for approval. */
export const TEAM_APPROVAL_NOTE = "Ekip postası onaya sunulur: bir onaycı onaylayınca seçtiğin ekiplerin üyelerine gider.";

/** The request's Teams in words, by id: a name the viewer's Teams or lists give, else none. */
export type TeamNames = (id: string) => string | null;

/** Names from the viewer's own Teams. */
export function teamNamesFrom(teams: readonly TeamAudience[]): TeamNames {
  const names = new Map(teams.map((team) => [team.id.toLowerCase(), teamName(team)]));
  return (id) => names.get(id.toLowerCase()) ?? null;
}

/** free.basic as `GET /templates/by-key/free.basic` gives it: the only template the team seat sends. Null when it is not there. */
export async function fetchFreeTemplate(api: ApiClient, signal?: AbortSignal): Promise<MailTemplate | null> {
  try {
    return await api.get<MailTemplate>(`/templates/by-key/${encodeURIComponent(FREE_TEMPLATE_KEY)}`, { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (asApiError(error).status === 404) return null;
    throw error;
  }
}

/** The Teams an approval took out of a request, from its history's audience changes: before less after. */
export function droppedTeamIds(
  history: readonly Readonly<{ changes: readonly Readonly<{ field: string; before: unknown; after: unknown }>[] | null }>[] | null,
): string[] {
  const dropped: string[] = [];
  for (const event of history ?? []) {
    for (const change of event.changes ?? []) {
      if (change.field !== "audience") continue;
      const before = teamIdsIn(change.before);
      const after = new Set(teamIdsIn(change.after).map((id) => id.toLowerCase()));
      for (const id of before) if (!after.has(id.toLowerCase()) && !dropped.includes(id)) dropped.push(id);
    }
  }
  return dropped;
}

/** `{"team_ids": [...]}` as an audience change carries it (JSON, or already read); none otherwise. */
export function teamIdsIn(value: unknown): string[] {
  let read = value;
  if (typeof read === "string") {
    try {
      read = JSON.parse(read);
    } catch {
      return [];
    }
  }
  const ids = read !== null && typeof read === "object" ? (read as { team_ids?: unknown }).team_ids : undefined;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

/** A list of Teams by name, the ones without a name counted. */
export function namedTeams(ids: readonly string[], names: TeamNames): string {
  const named = ids.map(names).filter((name): name is string => name !== null);
  const unnamed = ids.length - named.length;
  if (unnamed === 0) return named.join(", ");
  const rest = `${formatCount(unnamed)} ekip`;
  return named.length === 0 ? rest : `${named.join(", ")} ve ${rest} daha`;
}
