"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/data/session";
import { generateRoundRobin, scheduleReport } from "@/lib/engine/schedule";
import { notifyPlayers, teamPlayerIds } from "@/lib/server/notify";
import { fmtDateTime } from "@/lib/util/time";
import type { ActionState } from "./team";

export type GeneratePreview = { ok: boolean; message?: string; nights: { nightId: string; name: string; matches: { week: number; home: string; away: string | null; table: string | null; time: string }[]; report: ReturnType<typeof scheduleReport> }[] };

function nyIso(date: string, time: string) {
  // Build an ISO timestamp in America/New_York for a given yyyy-mm-dd and HH:MM (DST aware via Intl)
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offsetMin = tzOffsetMinutes(new Date(guess));
  return new Date(guess - offsetMin * 60_000).toISOString();
}
function tzOffsetMinutes(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return (asUtc - d.getTime()) / 60_000;
}

export async function generateSchedule(seasonId: string, input: { nightIds: string[]; rounds: 1 | 2; replace: boolean; apply: boolean }): Promise<GeneratePreview> {
  await requireAdmin();
  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: season }, { data: nights }, { data: teams }, { data: tables }, { data: weeks }] = await Promise.all([
    supabase.from("seasons").select("*").eq("id", seasonId).maybeSingle(),
    supabase.from("league_nights").select("*").eq("season_id", seasonId).in("id", input.nightIds),
    supabase.from("teams").select("id, name, night_id").eq("season_id", seasonId),
    supabase.from("tables").select("id, name").eq("active", true).order("sort_order"),
    supabase.from("weeks").select("id, number, starts_on").eq("season_id", seasonId).eq("kind", "regular").order("number"),
  ]);
  if (!season) return { ok: false, message: "Season not found", nights: [] };
  if (!weeks?.length) return { ok: false, message: "This season has no regular weeks yet. Save the season first.", nights: [] };
  const out: GeneratePreview["nights"] = [];
  for (const night of nights ?? []) {
    const nightTeams = (teams ?? []).filter((t) => t.night_id === night.id);
    if (nightTeams.length < 2) { out.push({ nightId: night.id, name: night.name, matches: [], report: scheduleReport([], []) }); continue; }
    const { count: existing } = await supabase.from("matches").select("id", { count: "exact", head: true }).eq("night_id", night.id).is("playoff_round", null);
    if ((existing ?? 0) > 0 && !input.replace) return { ok: false, message: `${night.name} already has ${existing} matches. Tick "replace existing" to regenerate (unplayed matches only are removed).`, nights: [] };
    const sched = generateRoundRobin(nightTeams.map((t) => t.id), { rounds: input.rounds, tableIds: (tables ?? []).map((t) => t.id), slotsPerWeek: (night.slot_times as string[]).length, seed: night.weekday });
    const report = scheduleReport(sched, nightTeams.map((t) => t.id));
    const name = (id: string | null) => nightTeams.find((t) => t.id === id)?.name ?? null;
    const slotTimes = night.slot_times as string[];
    const rows = sched.map((m) => {
      const week = weeks[m.week - 1];
      const base = week ? new Date(`${week.starts_on}T12:00:00Z`) : null;
      if (base) base.setUTCDate(base.getUTCDate() + (night.weekday - 1));
      const date = base ? base.toISOString().slice(0, 10) : null;
      const time = slotTimes[m.slotIndex] ?? night.start_time.slice(0, 5);
      return { m, week, date, time };
    });
    out.push({ nightId: night.id, name: night.name, report, matches: rows.map(({ m, date, time }) => ({ week: m.week, home: name(m.homeTeamId)!, away: name(m.awayTeamId), table: (tables ?? []).find((t) => t.id === m.tableId)?.name ?? null, time: date ? `${date} ${time}` : time })) });
    if (input.apply) {
      if (input.replace) await admin.from("matches").delete().eq("night_id", night.id).is("playoff_round", null).in("status", ["scheduled", "postponed", "bye"]);
      const inserts = rows.filter((r) => r.week && r.date).map(({ m, week, date, time }) => ({
        season_id: seasonId, night_id: night.id, week_id: week!.id, home_team_id: m.homeTeamId, away_team_id: m.awayTeamId, table_id: m.awayTeamId ? m.tableId : null, slot_index: m.slotIndex,
        scheduled_at: nyIso(date!, time), status: m.awayTeamId ? "scheduled" : "bye",
      }));
      if (inserts.length) {
        const { error } = await admin.from("matches").insert(inserts);
        if (error) return { ok: false, message: error.message, nights: out };
      }
    }
  }
  if (input.apply) {
    await supabase.rpc("log_audit", { p_action: "schedule.generate", p_entity: "season", p_entity_id: seasonId, p_before: null as never, p_after: { nights: input.nightIds, rounds: input.rounds } as never });
    revalidatePath("/schedule");
    revalidatePath("/admin/schedule");
  }
  return { ok: true, nights: out, message: input.apply ? "Schedule generated." : undefined };
}

export async function updateMatch(matchId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z.object({ scheduled_at: z.string().min(10), table_id: z.string().optional().or(z.literal("")), home_team_id: z.string().uuid(), away_team_id: z.string().uuid(), notify: z.string().optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Check the match fields" };
  if (parsed.data.home_team_id === parsed.data.away_team_id) return { ok: false, message: "A team can't play itself" };
  const supabase = await createClient();
  const { data: before } = await supabase.from("matches").select("scheduled_at, table_id, home_team_id, away_team_id, status").eq("id", matchId).maybeSingle();
  const scheduledAt = new Date(parsed.data.scheduled_at).toISOString();
  const { error } = await supabase.from("matches").update({ scheduled_at: scheduledAt, table_id: parsed.data.table_id || null, home_team_id: parsed.data.home_team_id, away_team_id: parsed.data.away_team_id, status: before?.status === "postponed" ? "scheduled" : before?.status, is_makeup: before?.status === "postponed" ? true : undefined }).eq("id", matchId);
  if (error) return { ok: false, message: error.message };
  if (parsed.data.notify === "on") {
    const captains = [...(await teamPlayerIds(parsed.data.home_team_id, "captain")), ...(await teamPlayerIds(parsed.data.away_team_id, "captain"))];
    await notifyPlayers(captains, { type: "schedule_change", title: "Match updated", body: `Now ${fmtDateTime(scheduledAt)}. Check the match page for details.`, url: `/matches/${matchId}` });
  }
  revalidatePath("/schedule");
  revalidatePath(`/matches/${matchId}`);
  return { ok: true, message: "Match updated" };
}

export async function postponeMatchAction(matchId: string, newAt: string | null, note: string): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("postpone_match", { p_match: matchId, p_new_at: newAt ? new Date(newAt).toISOString() : undefined, p_note: note || undefined });
  if (error) return { ok: false, message: error.message };
  const { data: m } = await supabase.from("matches").select("home_team_id, away_team_id").eq("id", matchId).maybeSingle();
  if (m?.home_team_id && m.away_team_id) {
    const captains = [...(await teamPlayerIds(m.home_team_id, "captain")), ...(await teamPlayerIds(m.away_team_id, "captain"))];
    await notifyPlayers(captains, { type: "schedule_change", title: newAt ? "Match rescheduled" : "Match postponed", body: newAt ? `New time: ${fmtDateTime(newAt)}` : note || "The commissioner will set a make-up date.", url: `/matches/${matchId}` });
  }
  revalidatePath("/schedule");
  revalidatePath(`/matches/${matchId}`);
  return { ok: true };
}

export async function swapMatchTeams(matchId: string): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: m } = await supabase.from("matches").select("home_team_id, away_team_id").eq("id", matchId).maybeSingle();
  if (!m) return { ok: false, message: "Not found" };
  const { error } = await supabase.from("matches").update({ home_team_id: m.away_team_id, away_team_id: m.home_team_id }).eq("id", matchId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/schedule");
  return { ok: true };
}

export async function createMatch(seasonId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z.object({ night_id: z.string().uuid(), week_id: z.string().uuid(), home_team_id: z.string().uuid(), away_team_id: z.string().uuid(), scheduled_at: z.string().min(10), table_id: z.string().optional().or(z.literal("")) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Fill in every field" };
  if (parsed.data.home_team_id === parsed.data.away_team_id) return { ok: false, message: "Pick two different teams" };
  const supabase = await createClient();
  const { error } = await supabase.from("matches").insert({ season_id: seasonId, night_id: parsed.data.night_id, week_id: parsed.data.week_id, home_team_id: parsed.data.home_team_id, away_team_id: parsed.data.away_team_id, scheduled_at: new Date(parsed.data.scheduled_at).toISOString(), table_id: parsed.data.table_id || null, is_makeup: true });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/schedule");
  return { ok: true, message: "Match added" };
}

export async function deleteMatch(matchId: string): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("matches").delete().eq("id", matchId).in("status", ["scheduled", "postponed", "bye", "void"]);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/schedule");
  revalidatePath("/admin/schedule");
  return { ok: true };
}
