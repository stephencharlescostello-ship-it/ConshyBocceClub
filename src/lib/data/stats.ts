import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getActiveSeason } from "./league";

export type PlayerStats = { matches: number; wins: number; losses: number; gamesWon: number; gamesLost: number; hangers: number; pointsScored: number; framesPlayed: number; framesWon: number };

/** Season stats for one player from games where they were in the lineup (frame stats need live scoring). */
export async function getPlayerStats(playerId: string): Promise<PlayerStats> {
  const supabase = await createClient();
  const season = await getActiveSeason();
  const out: PlayerStats = { matches: 0, wins: 0, losses: 0, gamesWon: 0, gamesLost: 0, hangers: 0, pointsScored: 0, framesPlayed: 0, framesWon: 0 };
  if (!season) return out;
  const { data: memberships } = await supabase.from("team_memberships").select("team_id, teams!inner(season_id)").eq("player_id", playerId).eq("teams.season_id", season.id);
  const teamIds = (memberships ?? []).map((m) => m.team_id);
  if (!teamIds.length) return out;
  const { data: matches } = await supabase.from("matches").select("id, home_team_id, away_team_id, winner_team_id").eq("season_id", season.id).in("status", ["confirmed", "forfeit"]).or(teamIds.map((t) => `home_team_id.eq.${t},away_team_id.eq.${t}`).join(","));
  for (const m of matches ?? []) {
    out.matches++;
    if (m.winner_team_id && teamIds.includes(m.winner_team_id)) out.wins++;
    else out.losses++;
  }
  const { data: games } = await supabase.from("games").select("id, match_id, home_lineup, away_lineup, winner_team_id, home_score, away_score, matches!inner(season_id, status, home_team_id, away_team_id)").eq("matches.season_id", season.id).eq("matches.status", "confirmed").or(`home_lineup.cs.["${playerId}"],away_lineup.cs.["${playerId}"]`);
  const gameIds: string[] = [];
  const sideByGame = new Map<string, string>(); // game id → my team id
  for (const g of games ?? []) {
    const m = g.matches as unknown as { home_team_id: string; away_team_id: string };
    const mine = ((g.home_lineup as string[]) ?? []).includes(playerId) ? m.home_team_id : m.away_team_id;
    sideByGame.set(g.id, mine);
    gameIds.push(g.id);
    if (g.winner_team_id === mine) out.gamesWon++;
    else out.gamesLost++;
  }
  if (gameIds.length) {
    const { data: frames } = await supabase.from("frames").select("game_id, scoring_team_id, points, hangers").in("game_id", gameIds);
    for (const f of frames ?? []) {
      out.framesPlayed++;
      if (f.scoring_team_id === sideByGame.get(f.game_id)) {
        out.framesWon++;
        out.pointsScored += f.points;
        out.hangers += f.hangers;
      }
    }
  }
  return out;
}
