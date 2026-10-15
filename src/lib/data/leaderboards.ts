import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getNights, getTeams } from "./league";
import { biggestComeback, deriveState, type FrameRecord } from "@/lib/engine/scoring";
import { parseFormat } from "@/lib/engine/format";

export type LeaderRow = { id: string; name: string; night: string; value: number; sub?: string };
export type Leaderboards = {
  teamHangers: LeaderRow[];
  playerHangers: LeaderRow[];
  pointsPerFrame: LeaderRow[];
  frameWinPct: LeaderRow[];
  gameWins: LeaderRow[];
  longestStreak: LeaderRow[];
  biggestComeback: LeaderRow[];
  hangerOfWeek: { week: number; name: string; hangers: number; playerId: string }[];
  liveScoredMatches: number;
  quickMatches: number;
};

export async function getLeaderboards(seasonId: string, nightId?: string): Promise<Leaderboards> {
  const supabase = await createClient();
  const [nights, teams, { data: season }] = await Promise.all([getNights(seasonId), getTeams(seasonId), supabase.from("seasons").select("format").eq("id", seasonId).maybeSingle()]);
  const fmt = parseFormat(season?.format);
  const nightName = (id: string) => nights.find((n) => n.id === id)?.name ?? "";
  const teamList = nightId ? teams.filter((t) => t.night_id === nightId) : teams;
  const teamIds = new Set(teamList.map((t) => t.id));
  let mq = supabase.from("matches").select("id, night_id, home_team_id, away_team_id, winner_team_id, home_games, away_games, entry_mode, scheduled_at, status").eq("season_id", seasonId).in("status", ["confirmed", "forfeit"]);
  if (nightId) mq = mq.eq("night_id", nightId);
  const { data: matches } = await mq;
  const ms = matches ?? [];
  const { data: games } = ms.length ? await supabase.from("games").select("id, match_id, number, home_score, away_score, winner_team_id, home_lineup, away_lineup").in("match_id", ms.map((m) => m.id)) : { data: [] };
  const gs = games ?? [];
  const { data: frames } = gs.length ? await supabase.from("frames").select("id, game_id, number, scoring_team_id, points, hangers, weights").in("game_id", gs.map((g) => g.id)) : { data: [] };
  const fs = frames ?? [];
  const matchById = new Map(ms.map((m) => [m.id, m]));

  // team aggregates
  const team = new Map<string, { hangers: number; frames: number; framesWon: number; points: number; gameWins: number }>();
  const player = new Map<string, { hangers: number; frames: number; framesWon: number; points: number; teamId: string }>();
  for (const t of teamList) team.set(t.id, { hangers: 0, frames: 0, framesWon: 0, points: 0, gameWins: 0 });
  for (const g of gs) {
    const m = matchById.get(g.match_id)!;
    if (g.winner_team_id && team.has(g.winner_team_id)) team.get(g.winner_team_id)!.gameWins++;
    const gFrames = fs.filter((f) => f.game_id === g.id);
    for (const f of gFrames) {
      for (const side of ["home", "away"] as const) {
        const tid = side === "home" ? m.home_team_id! : m.away_team_id!;
        const t = team.get(tid);
        if (!t) continue;
        t.frames++;
        const lineup = (side === "home" ? g.home_lineup : g.away_lineup) as string[];
        for (const pid of lineup ?? []) {
          const p = player.get(pid) ?? { hangers: 0, frames: 0, framesWon: 0, points: 0, teamId: tid };
          p.frames++;
          if (f.scoring_team_id === tid) { p.framesWon++; p.points += f.points; p.hangers += f.hangers; }
          player.set(pid, p);
        }
        if (f.scoring_team_id === tid) { t.framesWon++; t.points += f.points; t.hangers += f.hangers; }
      }
    }
  }
  const tname = (id: string) => teamList.find((t) => t.id === id)?.name ?? "?";
  const tnight = (id: string) => nightName(teamList.find((t) => t.id === id)?.night_id ?? "");
  const playerIds = Array.from(player.keys());
  const { data: profiles } = playerIds.length ? await supabase.from("player_profiles").select("id, display_name").in("id", playerIds) : { data: [] };
  const pname = (id: string) => profiles?.find((p) => p.id === id)?.display_name ?? "?";
  const top = (rows: LeaderRow[], n = 10) => rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, n);

  // streaks (match-level) and comebacks
  const streak = new Map<string, { cur: number; max: number }>();
  for (const m of ms.slice().sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))) for (const id of [m.home_team_id!, m.away_team_id!]) {
    if (!team.has(id)) continue;
    const s = streak.get(id) ?? { cur: 0, max: 0 };
    if (m.winner_team_id === id) { s.cur++; s.max = Math.max(s.max, s.cur); } else s.cur = 0;
    streak.set(id, s);
  }
  const comebacks: LeaderRow[] = [];
  for (const g of gs) {
    const gFrames = fs.filter((f) => f.game_id === g.id).sort((a, b) => a.number - b.number);
    if (!gFrames.length) continue;
    const m = matchById.get(g.match_id)!;
    const recs: FrameRecord[] = gFrames.map((f) => ({ id: f.id, gameNumber: 1, number: f.number, team: f.scoring_team_id === m.home_team_id ? "home" : f.scoring_team_id === m.away_team_id ? "away" : null, points: f.points, hangers: f.hangers, weights: (f.weights as number[]) ?? [] }));
    try {
      const st = deriveState(recs, fmt);
      const cb = biggestComeback(st.games[0]);
      if (cb > 0 && g.winner_team_id) comebacks.push({ id: g.id, name: tname(g.winner_team_id), night: tnight(g.winner_team_id), value: cb, sub: `trailed by ${cb}, won ${Math.max(g.home_score, g.away_score)}–${Math.min(g.home_score, g.away_score)}` });
    } catch { /* malformed */ }
  }
  const { data: awards } = await supabase.from("awards").select("week_number, value, player:player_profiles(id, display_name)").eq("season_id", seasonId).eq("kind", "hanger_of_week").order("week_number", { ascending: false });
  return {
    teamHangers: top(Array.from(team.entries()).map(([id, t]) => ({ id, name: tname(id), night: tnight(id), value: t.hangers }))),
    playerHangers: top(Array.from(player.entries()).map(([id, p]) => ({ id, name: pname(id), night: tnight(p.teamId), value: p.hangers, sub: tname(p.teamId) }))),
    pointsPerFrame: top(Array.from(team.entries()).filter(([, t]) => t.frames >= 20).map(([id, t]) => ({ id, name: tname(id), night: tnight(id), value: Math.round((t.points / t.frames) * 100) / 100, sub: `${t.frames} frames` }))),
    frameWinPct: top(Array.from(team.entries()).filter(([, t]) => t.frames >= 20).map(([id, t]) => ({ id, name: tname(id), night: tnight(id), value: Math.round((t.framesWon / t.frames) * 1000) / 10, sub: `${t.framesWon}/${t.frames}` }))),
    gameWins: top(Array.from(team.entries()).map(([id, t]) => ({ id, name: tname(id), night: tnight(id), value: t.gameWins }))),
    longestStreak: top(Array.from(streak.entries()).map(([id, s]) => ({ id, name: tname(id), night: tnight(id), value: s.max, sub: s.cur === s.max && s.cur > 0 ? "active" : undefined }))),
    biggestComeback: top(comebacks, 5),
    hangerOfWeek: (awards ?? []).map((a) => ({ week: a.week_number ?? 0, name: (a.player as unknown as { display_name: string } | null)?.display_name ?? "?", playerId: (a.player as unknown as { id: string } | null)?.id ?? "", hangers: Number(a.value ?? 0) })),
    liveScoredMatches: ms.filter((m) => m.entry_mode === "live").length,
    quickMatches: ms.filter((m) => m.entry_mode !== "live").length,
  };
}
