"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/data/session";
import { seedBracket, firstRoundPairs } from "@/lib/engine/playoffs";
import type { StandingRow } from "@/lib/engine/standings";
import type { ActionState } from "./team";

/** Bracket of the night champions, seeded by regular-season win % then point differential. */
export async function seedChampionOfChampions(seasonId: string): Promise<ActionState> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: brackets } = await admin.from("playoff_brackets").select("id, night_id, champion_team_id, kind").eq("season_id", seasonId);
  const champs = (brackets ?? []).filter((b) => b.kind === "night" && b.champion_team_id);
  if (champs.length < 2) return { ok: false, message: "Need at least two night champions first." };
  const old = (brackets ?? []).filter((b) => b.kind === "champions");
  if (old.length) { await admin.from("matches").delete().in("bracket_id", old.map((b) => b.id)); await admin.from("playoff_brackets").delete().in("id", old.map((b) => b.id)); }
  const { data: records } = await admin.from("team_records").select("*").in("team_id", champs.map((c) => c.champion_team_id!));
  const rows: StandingRow[] = (records ?? []).map((r) => ({ rank: 0, teamId: r.team_id!, name: r.name!, played: (r.wins ?? 0) + (r.losses ?? 0), wins: r.wins ?? 0, losses: r.losses ?? 0, winPct: (r.wins ?? 0) / Math.max(1, (r.wins ?? 0) + (r.losses ?? 0)), gamesWon: r.games_won ?? 0, gamesLost: r.games_lost ?? 0, gameDiff: (r.games_won ?? 0) - (r.games_lost ?? 0), pointsFor: r.points_for ?? 0, pointsAgainst: r.points_against ?? 0, pointDiff: (r.points_for ?? 0) - (r.points_against ?? 0), forfeits: r.forfeits ?? 0, streak: "—", last5: [], tiebreakNote: null }))
    .sort((a, b) => b.winPct - a.winPct || b.pointDiff - a.pointDiff).map((r, i) => ({ ...r, rank: i + 1 }));
  const size = rows.length <= 2 ? 2 : rows.length <= 4 ? 4 : 8;
  const slots = seedBracket(rows, size);
  const { data: bracket } = await admin.from("playoff_brackets").insert({ season_id: seasonId, kind: "champions", name: "Champion of Champions", status: "live" }).select("id").single();
  if (!bracket) return { ok: false, message: "Could not create bracket" };
  const rounds = Math.max(...slots.map((s) => s.round));
  const ids = new Map<string, string>();
  for (let r = rounds; r >= 1; r--) for (const sl of slots.filter((x) => x.round === r)) {
    const { data: row } = await admin.from("playoff_slots").insert({ bracket_id: bracket.id, round: r, position: sl.position, seed: sl.seed, team_id: sl.teamId, feeds_slot_id: sl.feedsPosition ? ids.get(`${r + 1}:${sl.feedsPosition}`) ?? null : null }).select("id").single();
    if (row) ids.set(`${r}:${sl.position}`, row.id);
  }
  // matches: on the last playoff week, Friday, 6pm onwards (editable in Schedule)
  const { data: weeks } = await admin.from("weeks").select("id, starts_on").eq("season_id", seasonId).order("number", { ascending: false }).limit(1);
  const { data: nights } = await admin.from("league_nights").select("id, weekday").eq("season_id", seasonId).order("weekday", { ascending: false }).limit(1);
  const week = weeks?.[0]; const night = nights?.[0];
  if (week && night) {
    const base = new Date(`${week.starts_on}T00:00:00`); base.setDate(base.getDate() + (night.weekday - 1));
    const ymd = base.toISOString().slice(0, 10);
    let i = 0;
    for (const [a, b] of firstRoundPairs(slots)) {
      if (!a.teamId || !b.teamId) { // bye: advance the seeded team
        const adv = a.teamId ?? b.teamId; const slot = a.teamId ? a : b;
        if (adv && slot.feedsPosition) await admin.from("playoff_slots").update({ team_id: adv }).eq("id", ids.get(`2:${slot.feedsPosition}`)!);
        continue;
      }
      const { data: match } = await admin.from("matches").insert({ season_id: seasonId, night_id: night.id, week_id: week.id, home_team_id: a.teamId, away_team_id: b.teamId, slot_index: i, scheduled_at: `${ymd}T${18 + i}:00:00-04:00`, status: "scheduled", bracket_id: bracket.id, playoff_round: 1 }).select("id").single();
      if (match) await admin.from("playoff_slots").update({ match_id: match.id }).in("id", [ids.get(`1:${a.position}`)!, ids.get(`1:${b.position}`)!]);
      i++;
    }
  }
  revalidatePath("/playoffs");
  return { ok: true, message: `Champion of Champions bracket created with ${rows.length} teams.` };
}
