import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getNights, getResultsForStandings, getTeams } from "./league";
import { computeStandings } from "@/lib/engine/standings";

export type SeasonRecord = { label: string; holder: string; value: string | number };

/** Records for a season: most hangers (player & team), longest streak, best point diff, biggest blowout. */
export async function getSeasonRecords(seasonId: string): Promise<SeasonRecord[]> {
  const supabase = await createClient();
  const out: SeasonRecord[] = [];
  const [nights, teams, results] = await Promise.all([getNights(seasonId), getTeams(seasonId), getResultsForStandings(seasonId)]);
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? "?";
  // longest streak & best record across nights
  let bestStreak = { team: "", n: 0 };
  let bestPct = { team: "", v: -1, rec: "" };
  for (const n of nights) {
    const rows = computeStandings(teams.filter((t) => t.night_id === n.id).map((t) => ({ id: t.id, name: t.name })), results.filter((r) => r.nightId === n.id));
    for (const r of rows) {
      // longest W streak in history requires scanning; approximate with current streak + computed max below
      if (r.played && r.winPct > bestPct.v) bestPct = { team: r.name, v: r.winPct, rec: `${r.wins}–${r.losses}` };
    }
  }
  // longest streak: scan results chronologically per team
  const streaks = new Map<string, { cur: number; max: number }>();
  for (const r of results.slice().sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))) {
    for (const id of [r.homeTeamId, r.awayTeamId]) {
      const s = streaks.get(id) ?? { cur: 0, max: 0 };
      if (r.winnerTeamId === id) { s.cur++; s.max = Math.max(s.max, s.cur); } else s.cur = 0;
      streaks.set(id, s);
    }
  }
  for (const [id, s] of streaks) if (s.max > bestStreak.n) bestStreak = { team: teamName(id), n: s.max };
  if (bestPct.team) out.push({ label: "Best record", holder: bestPct.team, value: bestPct.rec });
  if (bestStreak.n) out.push({ label: "Longest win streak", holder: bestStreak.team, value: bestStreak.n });
  // biggest blowout (points)
  let blowout = { label: "", diff: 0 };
  for (const r of results) {
    const d = Math.abs(r.homePoints - r.awayPoints);
    if (d > blowout.diff && r.status === "confirmed") blowout = { label: `${teamName(r.winnerTeamId)} by ${d}`, diff: d };
  }
  if (blowout.diff) out.push({ label: "Biggest blowout", holder: blowout.label, value: `+${blowout.diff}` });
  // hangers
  const { data: games } = await supabase.from("games").select("id, home_lineup, away_lineup, match:matches!inner(season_id, home_team_id, away_team_id, status)").eq("match.season_id", seasonId).eq("match.status", "confirmed");
  if (games?.length) {
    const { data: frames } = await supabase.from("frames").select("game_id, scoring_team_id, hangers").in("game_id", games.map((g) => g.id)).gt("hangers", 0);
    const byTeam = new Map<string, number>();
    const byPlayer = new Map<string, number>();
    for (const f of frames ?? []) {
      if (!f.scoring_team_id) continue;
      byTeam.set(f.scoring_team_id, (byTeam.get(f.scoring_team_id) ?? 0) + f.hangers);
      const g = games.find((x) => x.id === f.game_id)!;
      const m = g.match as unknown as { home_team_id: string };
      for (const pid of ((f.scoring_team_id === m.home_team_id ? g.home_lineup : g.away_lineup) as string[]) ?? []) byPlayer.set(pid, (byPlayer.get(pid) ?? 0) + f.hangers);
    }
    const topTeam = Array.from(byTeam.entries()).sort((a, b) => b[1] - a[1])[0];
    const topPlayer = Array.from(byPlayer.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topTeam) out.push({ label: "Most hangers (team)", holder: teamName(topTeam[0]), value: topTeam[1] });
    if (topPlayer) {
      const { data: p } = await supabase.from("player_profiles").select("display_name").eq("id", topPlayer[0]).maybeSingle();
      out.push({ label: "Most hangers (player)", holder: p?.display_name ?? "?", value: topPlayer[1] });
    }
  }
  return out;
}
