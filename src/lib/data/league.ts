import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { parseFormat } from "@/lib/engine/format";
import type { Tiebreaker } from "@/lib/engine/standings";

export type Season = Tables<"seasons">;
export type Night = Tables<"league_nights">;
export type Team = Tables<"teams">;

export const getActiveSeason = cache(async (): Promise<Season | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("seasons").select("*").eq("status", "active").maybeSingle();
  return data;
});

export const getSeasonBySlug = cache(async (slug: string): Promise<Season | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("seasons").select("*").eq("slug", slug).maybeSingle();
  return data;
});

export const getSeasons = cache(async (): Promise<Season[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("seasons").select("*").order("starts_on", { ascending: false });
  return data ?? [];
});

export const getNights = cache(async (seasonId: string): Promise<Night[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("league_nights").select("*").eq("season_id", seasonId).order("weekday");
  return data ?? [];
});

export const getTeams = cache(async (seasonId: string): Promise<Team[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("teams").select("*").eq("season_id", seasonId).order("name");
  return data ?? [];
});

export const getTables = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("tables").select("*").eq("active", true).order("sort_order");
  return data ?? [];
});

export const getWeeks = cache(async (seasonId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("weeks").select("*").eq("season_id", seasonId).order("number");
  return data ?? [];
});

export const getSettings = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("key, value");
  const map: Record<string, Record<string, unknown>> = {};
  for (const row of data ?? []) map[row.key] = (row.value as Record<string, unknown>) ?? {};
  return map;
});

export function seasonFormat(season: Season | null) {
  return parseFormat(season?.format);
}
export function seasonTiebreakers(season: Season | null): Tiebreaker[] {
  const tb = (season?.tiebreakers ?? []) as string[];
  const valid: Tiebreaker[] = ["win_pct", "head_to_head", "game_diff", "point_diff", "admin"];
  const out = tb.filter((t): t is Tiebreaker => (valid as string[]).includes(t));
  return out.length ? out : valid;
}

export type MatchRow = Tables<"matches"> & {
  home: Pick<Team, "id" | "name" | "slug" | "color"> | null;
  away: Pick<Team, "id" | "name" | "slug" | "color"> | null;
  table: Pick<Tables<"tables">, "id" | "name"> | null;
  week: Pick<Tables<"weeks">, "id" | "number" | "kind" | "label"> | null;
  night: Pick<Night, "id" | "name" | "weekday" | "slug"> | null;
};

export const MATCH_SELECT = "*, home:teams!matches_home_team_id_fkey(id, name, slug, color), away:teams!matches_away_team_id_fkey(id, name, slug, color), table:tables(id, name), week:weeks(id, number, kind, label), night:league_nights(id, name, weekday, slug)";

export async function getMatches(filter: { seasonId?: string; nightId?: string; weekId?: string; teamId?: string; statuses?: string[]; from?: string; to?: string; limit?: number }): Promise<MatchRow[]> {
  const supabase = await createClient();
  let q = supabase.from("matches").select(MATCH_SELECT).order("scheduled_at");
  if (filter.seasonId) q = q.eq("season_id", filter.seasonId);
  if (filter.nightId) q = q.eq("night_id", filter.nightId);
  if (filter.weekId) q = q.eq("week_id", filter.weekId);
  if (filter.teamId) q = q.or(`home_team_id.eq.${filter.teamId},away_team_id.eq.${filter.teamId}`);
  if (filter.statuses) q = q.in("status", filter.statuses);
  if (filter.from) q = q.gte("scheduled_at", filter.from);
  if (filter.to) q = q.lt("scheduled_at", filter.to);
  if (filter.limit) q = q.limit(filter.limit);
  const { data } = await q;
  return (data ?? []) as unknown as MatchRow[];
}

export async function getMatch(id: string): Promise<MatchRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("matches").select(MATCH_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as MatchRow) ?? null;
}

/** Confirmed results for standings, shaped for the engine. */
export async function getResultsForStandings(seasonId: string, nightId?: string) {
  const supabase = await createClient();
  let q = supabase.from("matches").select("id, home_team_id, away_team_id, winner_team_id, home_games, away_games, home_points, away_points, status, scheduled_at, forfeit_team_id, night_id").eq("season_id", seasonId).in("status", ["confirmed", "forfeit"]).is("playoff_round", null);
  if (nightId) q = q.eq("night_id", nightId);
  const { data } = await q;
  return (data ?? []).filter((m) => m.home_team_id && m.away_team_id).map((m) => ({
    id: m.id,
    nightId: m.night_id,
    homeTeamId: m.home_team_id!,
    awayTeamId: m.away_team_id!,
    winnerTeamId: m.winner_team_id,
    homeGames: m.home_games,
    awayGames: m.away_games,
    homePoints: m.home_points,
    awayPoints: m.away_points,
    status: m.status as "confirmed" | "forfeit",
    scheduledAt: m.scheduled_at,
    forfeitTeamId: m.forfeit_team_id,
  }));
}
