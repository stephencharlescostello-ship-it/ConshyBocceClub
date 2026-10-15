import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalScoreLine, milestoneLine } from "@/lib/engine/bot";
import { computeStandings } from "@/lib/engine/standings";
import { biggestComeback, deriveState, type FrameRecord } from "@/lib/engine/scoring";
import { parseFormat } from "@/lib/engine/format";
import { notifyPlayers, teamPlayerIds } from "./notify";

/**
 * Runs once a match becomes confirmed (captain confirm, admin resolve, auto-confirm):
 * bot posts to the match thread and night channel, badges, notifications, awards.
 * Idempotent: skipped when the bot already posted for this match.
 */
export async function afterConfirm(matchId: string) {
  const admin = createAdminClient();
  const { data: m } = await admin
    .from("matches")
    .select("*, home:teams!matches_home_team_id_fkey(id, name, night_id), away:teams!matches_away_team_id_fkey(id, name, night_id), night:league_nights(id, name), week:weeks(number), season:seasons(id, format)")
    .eq("id", matchId)
    .maybeSingle();
  if (!m || !m.home || !m.away || !m.winner_team_id) return;
  const { data: channel } = await admin.from("channels").select("id").eq("match_id", matchId).maybeSingle();
  if (channel) {
    const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("channel_id", channel.id).eq("is_bot", true);
    if ((count ?? 0) > 0) return; // already announced
  }
  const winner = m.winner_team_id === m.home.id ? m.home : m.away;
  const loser = winner.id === m.home.id ? m.away : m.home;
  const winnerPoints = winner.id === m.home.id ? m.home_points : m.away_points;
  const loserPoints = winner.id === m.home.id ? m.away_points : m.home_points;

  // standings before this match (for upset detection) and streak
  const { data: results } = await admin.from("matches").select("id, home_team_id, away_team_id, winner_team_id, home_games, away_games, home_points, away_points, status, scheduled_at, forfeit_team_id").eq("night_id", m.night_id).in("status", ["confirmed", "forfeit"]).is("playoff_round", null);
  const { data: teams } = await admin.from("teams").select("id, name").eq("night_id", m.night_id);
  const shaped = (results ?? []).filter((r) => r.home_team_id && r.away_team_id).map((r) => ({ id: r.id, homeTeamId: r.home_team_id!, awayTeamId: r.away_team_id!, winnerTeamId: r.winner_team_id, homeGames: r.home_games, awayGames: r.away_games, homePoints: r.home_points, awayPoints: r.away_points, status: r.status as "confirmed" | "forfeit", scheduledAt: r.scheduled_at, forfeitTeamId: r.forfeit_team_id }));
  const before = computeStandings((teams ?? []).map((t) => ({ id: t.id, name: t.name })), shaped.filter((r) => r.id !== matchId));
  const after = computeStandings((teams ?? []).map((t) => ({ id: t.id, name: t.name })), shaped);
  const rankBefore = (id: string) => before.find((r) => r.teamId === id)?.rank ?? 99;
  const upset = rankBefore(loser.id) + 2 < rankBefore(winner.id) && before.some((r) => r.played > 2);
  const winnerRow = after.find((r) => r.teamId === winner.id);
  const streak = winnerRow?.streak.startsWith("W") ? Number(winnerRow.streak.slice(1)) : 0;

  // frames → hangers, comebacks, shutouts
  const { data: games } = await admin.from("games").select("id, number, home_score, away_score, winner_team_id, home_lineup, away_lineup").eq("match_id", matchId).order("number");
  const { data: frames } = await admin.from("frames").select("id, game_id, number, scoring_team_id, points, hangers, weights").in("game_id", (games ?? []).map((g) => g.id));
  const hangers = (frames ?? []).reduce((a, f) => a + f.hangers, 0);
  const shutoutGame = (games ?? []).some((g) => g.home_score === 0 || g.away_score === 0);
  const sweep = Math.min(m.home_games, m.away_games) === 0;
  const line = finalScoreLine({ winner: winner.name, loser: loser.name, winnerGames: Math.max(m.home_games, m.away_games), loserGames: Math.min(m.home_games, m.away_games), winnerPoints, loserPoints, night: m.night?.name ?? "", week: m.week?.number ?? 0, upset, streak, sweep, shutoutGame, hangers, forfeit: m.status === "forfeit" });
  const posts: { channel_id: string; is_bot: boolean; body: string }[] = [];
  if (channel) posts.push({ channel_id: channel.id, is_bot: true, body: line });
  const { data: nightChannel } = await admin.from("channels").select("id").eq("night_id", m.night_id).eq("kind", "night").maybeSingle();
  if (nightChannel) posts.push({ channel_id: nightChannel.id, is_bot: true, body: line });
  if (winnerRow && [5, 10].includes(winnerRow.wins) && nightChannel) posts.push({ channel_id: nightChannel.id, is_bot: true, body: milestoneLine(winner.name, winnerRow.wins) });
  if (posts.length) await admin.from("messages").insert(posts);

  // badges
  const badges: { player_id: string; badge_slug: string; season_id: string; match_id: string }[] = [];
  const add = (pids: string[], slug: string) => pids.forEach((player_id) => badges.push({ player_id, badge_slug: slug, season_id: m.season_id, match_id: matchId }));
  const winnerIds = await teamPlayerIds(winner.id);
  const fmt = parseFormat((m.season as { format?: unknown } | null)?.format);
  for (const g of games ?? []) {
    const hl = (g.home_lineup as string[]) ?? [];
    const al = (g.away_lineup as string[]) ?? [];
    const gFrames = (frames ?? []).filter((f) => f.game_id === g.id);
    const homeH = gFrames.filter((f) => f.scoring_team_id === m.home_team_id).reduce((a, f) => a + f.hangers, 0);
    const awayH = gFrames.filter((f) => f.scoring_team_id === m.away_team_id).reduce((a, f) => a + f.hangers, 0);
    if (homeH) add(hl, "first_hanger");
    if (awayH) add(al, "first_hanger");
    if (homeH >= 3) add(hl, "hat_trick");
    if (awayH >= 3) add(al, "hat_trick");
    if (g.away_score === 0 && g.home_score > 0) add(hl, "shutout");
    if (g.home_score === 0 && g.away_score > 0) add(al, "shutout");
    if (gFrames.length) {
      const recs: FrameRecord[] = gFrames.sort((a, b) => a.number - b.number).map((f) => ({ id: f.id, gameNumber: g.number, number: f.number, team: f.scoring_team_id === m.home_team_id ? "home" : f.scoring_team_id === m.away_team_id ? "away" : null, points: f.points, hangers: f.hangers, weights: (f.weights as number[]) ?? [] }));
      const st = deriveState(recs, fmt);
      const gs = st.games[0];
      if (gs && biggestComeback(gs) >= 8) add(gs.winner === "home" ? hl : al, "comeback_kid");
    }
  }
  if (sweep) add(winnerIds, "sweep");
  if (winnerRow?.wins === 1) add(winnerIds, "first_win");
  if (streak >= 5) add(winnerIds, "streak_5");
  if (streak >= 10) add(winnerIds, "streak_10");
  if (upset) add(winnerIds, "giant_slayer");
  if (badges.length) {
    const { data: inserted } = await admin.from("player_badges").upsert(badges, { onConflict: "player_id,badge_slug,season_id", ignoreDuplicates: true }).select("player_id, badge_slug");
    for (const b of inserted ?? []) {
      const { data: badge } = await admin.from("badges").select("name").eq("slug", b.badge_slug).maybeSingle();
      await notifyPlayers([b.player_id], { type: "badge", title: `New badge: ${badge?.name ?? b.badge_slug}`, body: "Check your profile.", url: `/players/${b.player_id}` });
    }
  }
  // tell both rosters
  const loserIds = await teamPlayerIds(loser.id);
  await notifyPlayers([...winnerIds, ...loserIds], { type: "score_confirmed", title: `Final: ${winner.name} ${Math.max(m.home_games, m.away_games)}–${Math.min(m.home_games, m.away_games)} ${loser.name}`, body: "Result confirmed. Standings are updated.", url: `/matches/${matchId}`, tag: `match-${matchId}` });
  // Hanger of the Week (recomputed for this match's week from live-scored games)
  await recomputeHangerOfWeek(m.season_id, m.week?.number ?? null);
}

export async function recomputeHangerOfWeek(seasonId: string, weekNumber: number | null) {
  if (!weekNumber) return;
  const admin = createAdminClient();
  const { data: week } = await admin.from("weeks").select("id").eq("season_id", seasonId).eq("number", weekNumber).maybeSingle();
  if (!week) return;
  const { data: games } = await admin.from("games").select("id, home_lineup, away_lineup, match:matches!inner(id, week_id, home_team_id, away_team_id, status)").eq("match.week_id", week.id).in("match.status", ["confirmed"]);
  if (!games?.length) return;
  const { data: frames } = await admin.from("frames").select("game_id, scoring_team_id, hangers").in("game_id", games.map((g) => g.id)).gt("hangers", 0);
  const tally = new Map<string, number>();
  for (const f of frames ?? []) {
    const g = games.find((x) => x.id === f.game_id)!;
    const match = g.match as unknown as { home_team_id: string; away_team_id: string };
    const lineup = (f.scoring_team_id === match.home_team_id ? g.home_lineup : g.away_lineup) as string[];
    for (const pid of lineup ?? []) tally.set(pid, (tally.get(pid) ?? 0) + f.hangers);
  }
  let best: [string, number] | null = null;
  for (const e of tally) if (!best || e[1] > best[1]) best = e;
  if (!best) return;
  await admin.from("awards").delete().eq("season_id", seasonId).eq("kind", "hanger_of_week").eq("week_number", weekNumber);
  await admin.from("awards").insert({ season_id: seasonId, kind: "hanger_of_week", week_number: weekNumber, player_id: best[0], value: best[1], details: { hangers: best[1] } });
}
