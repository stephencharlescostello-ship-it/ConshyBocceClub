"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSeasonStandings } from "@/lib/data/standings";
import { seedBracket, firstRoundPairs } from "@/lib/engine/playoffs";
import { notifyPlayers, teamPlayerIds } from "@/lib/server/notify";
import { requireAdmin } from "@/lib/data/session";
import type { ActionState } from "./team";

/** Seeds (or re-seeds) the playoff bracket for every night from the current standings. Admin only. */
export async function seedPlayoffs(seasonId: string, opts: { replace?: boolean } = {}): Promise<ActionState> {
  try { await requireAdmin(); } catch { return { ok: false, message: "Admins only" }; }
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: season } = await supabase.from("seasons").select("*").eq("id", seasonId).maybeSingle();
  if (!season) return { ok: false, message: "Season not found" };
  const cfg = (season.playoff_config as { teams_per_night?: number }) ?? {};
  const n = Number(cfg.teams_per_night ?? 4);
  const standings = await getSeasonStandings(season);
  const { data: weeks } = await supabase.from("weeks").select("id, number, starts_on").eq("season_id", seasonId).eq("kind", "playoff").order("number");
  if (!weeks?.length) return { ok: false, message: "This season has no playoff weeks. Add them in Season settings." };
  const { data: existing } = await admin.from("playoff_brackets").select("id, status").eq("season_id", seasonId).eq("kind", "night");
  if (existing?.length && !opts.replace) return { ok: false, message: "Brackets already exist. Use re-seed to replace them." };
  if (existing?.length) {
    await admin.from("matches").delete().in("bracket_id", existing.map((b) => b.id));
    await admin.from("playoff_brackets").delete().in("id", existing.map((b) => b.id));
  }
  const { data: tables } = await admin.from("tables").select("id").eq("active", true).order("sort_order");
  const { data: nights } = await admin.from("league_nights").select("id, weekday, slot_times").eq("season_id", seasonId);
  let created = 0;
  for (const s of standings) {
    const night = nights?.find((x) => x.id === s.night.id);
    if (!night) continue;
    const slots = seedBracket(s.rows, n);
    if (!slots.length) continue;
    const { data: bracket } = await admin.from("playoff_brackets").insert({ season_id: seasonId, night_id: s.night.id, kind: "night", name: `${s.night.name} playoffs`, status: "live" }).select("id").single();
    if (!bracket) continue;
    const rounds = Math.max(...slots.map((x) => x.round));
    const slotIds = new Map<string, string>();
    // create slots round by round so feeds can reference
    for (let r = rounds; r >= 1; r--) {
      for (const sl of slots.filter((x) => x.round === r)) {
        const feeds = sl.feedsPosition ? slotIds.get(`${r + 1}:${sl.feedsPosition}`) ?? null : null;
        const { data: row } = await admin.from("playoff_slots").insert({ bracket_id: bracket.id, round: r, position: sl.position, seed: sl.seed, team_id: sl.teamId, feeds_slot_id: feeds }).select("id").single();
        if (row) slotIds.set(`${r}:${sl.position}`, row.id);
      }
    }
    // first-round matches in playoff week 1
    const week = weeks[0];
    const pairs = firstRoundPairs(slots);
    for (let i = 0; i < pairs.length; i++) {
      const [a, b] = pairs[i];
      if (!a.teamId || !b.teamId) continue;
      const slotTime = (night.slot_times as string[])[i % Math.max(1, (night.slot_times as string[]).length)] ?? "18:00";
      const date = new Date(`${week.starts_on}T${slotTime}:00`);
      date.setDate(date.getDate() + (night.weekday - 1));
      const scheduledAt = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
      void scheduledAt;
      const iso = `${week.starts_on}T00:00:00`;
      const base = new Date(iso);
      base.setDate(base.getDate() + (night.weekday - 1));
      const ymd = base.toISOString().slice(0, 10);
      const { data: match } = await admin.from("matches").insert({ season_id: seasonId, night_id: s.night.id, week_id: week.id, home_team_id: a.teamId, away_team_id: b.teamId, table_id: tables?.[i % Math.max(1, tables.length)]?.id ?? null, slot_index: i, scheduled_at: `${ymd}T${slotTime}:00-04:00`, status: "scheduled", bracket_id: bracket.id, playoff_round: 1 }).select("id").single();
      if (match) {
        await admin.from("playoff_slots").update({ match_id: match.id }).eq("id", slotIds.get(`1:${a.position}`)!);
        await admin.from("playoff_slots").update({ match_id: match.id }).eq("id", slotIds.get(`1:${b.position}`)!);
        created++;
        for (const tid of [a.teamId, b.teamId]) await notifyPlayers(await teamPlayerIds(tid), { type: "schedule_change", title: "Playoffs are set!", body: `${s.night.name}: you're in. Check the bracket.`, url: "/playoffs" });
      }
    }
  }
  revalidatePath("/playoffs");
  revalidatePath("/schedule");
  return { ok: true, message: `Seeded ${standings.length} brackets, ${created} first-round matches.` };
}

/** After a playoff match confirms: advance the winner and create the next round's match when both feeders are done. */
export async function advancePlayoffs(matchId: string) {
  const admin = createAdminClient();
  const { data: m } = await admin.from("matches").select("id, bracket_id, winner_team_id, playoff_round, season_id, night_id, table_id").eq("id", matchId).maybeSingle();
  if (!m?.bracket_id || !m.winner_team_id) return;
  const { data: slots } = await admin.from("playoff_slots").select("*").eq("bracket_id", m.bracket_id);
  const mine = (slots ?? []).filter((s) => s.match_id === matchId);
  const winnerSlot = mine.find((s) => s.team_id === m.winner_team_id);
  if (!winnerSlot?.feeds_slot_id) {
    // final: crown the champion
    await admin.from("playoff_brackets").update({ status: "complete", champion_team_id: m.winner_team_id }).eq("id", m.bracket_id);
    await admin.from("awards").upsert({ season_id: m.season_id, kind: "night_champion", team_id: m.winner_team_id, details: { note: "Playoff champion" } }, { onConflict: "season_id,kind,week_number,player_id,team_id", ignoreDuplicates: true });
    return;
  }
  await admin.from("playoff_slots").update({ team_id: m.winner_team_id }).eq("id", winnerSlot.feeds_slot_id);
  const next = (slots ?? []).find((s) => s.id === winnerSlot.feeds_slot_id)!;
  const { data: siblings } = await admin.from("playoff_slots").select("*").eq("bracket_id", m.bracket_id).eq("round", next.round);
  const partner = (siblings ?? []).find((s) => s.id !== next.id && Math.ceil(s.position / 2) === Math.ceil(next.position / 2));
  const { data: fresh } = await admin.from("playoff_slots").select("team_id").eq("id", next.id).maybeSingle();
  if (!partner?.team_id || !fresh?.team_id) return;
  const { data: weeks } = await admin.from("weeks").select("id, starts_on").eq("season_id", m.season_id).eq("kind", "playoff").order("number");
  const week = weeks?.[Math.min((weeks?.length ?? 1) - 1, next.round - 1)];
  if (!week) return;
  const { data: night } = await admin.from("league_nights").select("weekday, slot_times").eq("id", m.night_id).maybeSingle();
  const base = new Date(`${week.starts_on}T00:00:00`);
  base.setDate(base.getDate() + ((night?.weekday ?? 1) - 1));
  const ymd = base.toISOString().slice(0, 10);
  const slotTime = ((night?.slot_times as string[]) ?? ["18:00"])[(partner.position - 1) % Math.max(1, ((night?.slot_times as string[]) ?? ["18:00"]).length)] ?? "19:00";
  const { data: match } = await admin.from("matches").insert({ season_id: m.season_id, night_id: m.night_id, week_id: week.id, home_team_id: Math.min(partner.position, next.position) === partner.position ? partner.team_id : fresh.team_id, away_team_id: Math.min(partner.position, next.position) === partner.position ? fresh.team_id : partner.team_id, table_id: m.table_id, slot_index: 0, scheduled_at: `${ymd}T${slotTime}:00-04:00`, status: "scheduled", bracket_id: m.bracket_id, playoff_round: next.round }).select("id").single();
  if (match) await admin.from("playoff_slots").update({ match_id: match.id }).in("id", [partner.id, next.id]);
}
