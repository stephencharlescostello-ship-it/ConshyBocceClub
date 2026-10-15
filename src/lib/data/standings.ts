import "server-only";
import { computeStandings, markPlayoffStatus, type StandingRow } from "@/lib/engine/standings";
import { getNights, getResultsForStandings, getTeams, seasonTiebreakers, type Season } from "./league";
import { createClient } from "@/lib/supabase/server";

export type NightStandings = { night: { id: string; name: string; weekday: number; slug: string }; rows: StandingRow[] };

/** Standings for every night of a season, with tiebreakers, playoff line markers and admin order. */
export async function getSeasonStandings(season: Season): Promise<NightStandings[]> {
  const [nights, teams, results] = await Promise.all([getNights(season.id), getTeams(season.id), getResultsForStandings(season.id)]);
  const supabase = await createClient();
  const { data: adminOrderRow } = await supabase.from("settings").select("value").eq("key", `admin_order:${season.id}`).maybeSingle();
  const adminOrder = (adminOrderRow?.value as Record<string, number> | null) ?? {};
  const { data: remainingRows } = await supabase.from("matches").select("home_team_id, away_team_id").eq("season_id", season.id).in("status", ["scheduled", "live", "submitted", "disputed", "postponed"]).is("playoff_round", null);
  const remaining: Record<string, number> = {};
  for (const m of remainingRows ?? []) {
    if (m.home_team_id) remaining[m.home_team_id] = (remaining[m.home_team_id] ?? 0) + 1;
    if (m.away_team_id) remaining[m.away_team_id] = (remaining[m.away_team_id] ?? 0) + 1;
  }
  const spots = Number((season.playoff_config as { teams_per_night?: number } | null)?.teams_per_night ?? 4);
  const tiebreakers = seasonTiebreakers(season);
  return nights.map((night) => {
    const nightTeams = teams.filter((t) => t.night_id === night.id).map((t) => ({ id: t.id, name: t.name }));
    const rows = computeStandings(nightTeams, results.filter((r) => r.nightId === night.id), tiebreakers, adminOrder);
    return { night: { id: night.id, name: night.name, weekday: night.weekday, slug: night.slug }, rows: markPlayoffStatus(rows, remaining, spots) };
  });
}
