"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/data/session";
import { parseFormat } from "@/lib/engine/format";
import type { ActionState } from "./team";

const seasonSchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/),
  starts_on: z.string().min(10),
  regular_weeks: z.coerce.number().int().min(1).max(52),
  playoff_weeks: z.coerce.number().int().min(0).max(8),
  auto_confirm_hours: z.coerce.number().int().min(0).max(168),
  target_score: z.coerce.number().int().min(1).max(99),
  hanger_points: z.coerce.number().int().min(1).max(20),
  weights_per_side: z.coerce.number().int().min(1).max(8),
  games_per_match: z.coerce.number().int().min(1).max(9),
  zones: z.string().trim(),
  win_by_two: z.string().optional(),
  tiebreakers: z.string().trim(),
  teams_per_night: z.coerce.number().int().min(2).max(8),
  champion_of_champions: z.string().optional(),
  notes: z.string().max(500).optional().or(z.literal("")),
});

function parseSeasonForm(formData: FormData) {
  const parsed = seasonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") } as const;
  const d = parsed.data;
  const zones = d.zones.split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const tiebreakers = d.tiebreakers.split(/[,\s]+/).filter((t) => ["win_pct", "head_to_head", "game_diff", "point_diff", "admin"].includes(t));
  const format = parseFormat({ zones, hanger_points: d.hanger_points, weights_per_side: d.weights_per_side, target_score: d.target_score, win_by_two: d.win_by_two === "on", games_per_match: d.games_per_match });
  return { row: { name: d.name, slug: d.slug, starts_on: d.starts_on, regular_weeks: d.regular_weeks, playoff_weeks: d.playoff_weeks, auto_confirm_hours: d.auto_confirm_hours, format, tiebreakers: tiebreakers.length ? tiebreakers : ["win_pct", "head_to_head", "game_diff", "point_diff", "admin"], playoff_config: { teams_per_night: d.teams_per_night, champion_of_champions: d.champion_of_champions === "on" }, notes: d.notes || null } } as const;
}

async function ensureWeeks(seasonId: string, startsOn: string, regular: number, playoff: number) {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("weeks").select("number").eq("season_id", seasonId);
  const have = new Set((existing ?? []).map((w) => w.number));
  const rows = [];
  for (let n = 1; n <= regular + playoff; n++) {
    if (have.has(n)) continue;
    const d = new Date(`${startsOn}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + (n - 1) * 7);
    rows.push({ season_id: seasonId, number: n, starts_on: d.toISOString().slice(0, 10), kind: n <= regular ? "regular" : "playoff", label: n > regular ? (n === regular + playoff ? "Finals" : "Semifinals") : null });
  }
  if (rows.length) await admin.from("weeks").insert(rows);
}

export async function createSeason(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const r = parseSeasonForm(formData);
  if ("error" in r) return { ok: false, message: r.error };
  const supabase = await createClient();
  const { data, error } = await supabase.from("seasons").insert({ ...r.row, status: "draft" }).select("id").single();
  if (error) return { ok: false, message: error.message };
  await ensureWeeks(data.id, r.row.starts_on, r.row.regular_weeks, r.row.playoff_weeks);
  // default nights Mon–Fri
  await supabase.from("league_nights").insert([1, 2, 3, 4, 5].map((d) => ({ season_id: data.id, weekday: d, name: ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][d], slug: ["", "monday", "tuesday", "wednesday", "thursday", "friday"][d], sort_order: d })));
  revalidatePath("/admin/seasons");
  redirect(`/admin/seasons/${data.id}`);
}

export async function updateSeason(seasonId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const r = parseSeasonForm(formData);
  if ("error" in r) return { ok: false, message: r.error };
  const supabase = await createClient();
  const { data: before } = await supabase.from("seasons").select("*").eq("id", seasonId).maybeSingle();
  const { error } = await supabase.from("seasons").update(r.row).eq("id", seasonId);
  if (error) return { ok: false, message: error.message };
  await ensureWeeks(seasonId, r.row.starts_on, r.row.regular_weeks, r.row.playoff_weeks);
  await supabase.rpc("log_audit", { p_action: "season.update", p_entity: "season", p_entity_id: seasonId, p_before: before as never, p_after: r.row as never });
  revalidatePath("/admin/seasons");
  revalidatePath("/", "layout");
  return { ok: true, message: "Season saved. Format changes apply to this season only." };
}

export async function setSeasonStatus(seasonId: string, status: "draft" | "active" | "archived"): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  if (status === "active") await supabase.from("seasons").update({ status: "archived", archived_at: new Date().toISOString() }).eq("status", "active").neq("id", seasonId);
  const { error } = await supabase.from("seasons").update({ status, ...(status === "archived" ? { archived_at: new Date().toISOString() } : {}) }).eq("id", seasonId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Clone a season's structure (nights, teams, rosters, format) into a new draft season. */
export async function cloneSeason(sourceId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const startsOn = String(formData.get("starts_on") ?? "");
  if (name.length < 2 || startsOn.length < 10) return { ok: false, message: "Give the new season a name and start date." };
  const admin = createAdminClient();
  const { data: src } = await admin.from("seasons").select("*").eq("id", sourceId).maybeSingle();
  if (!src) return { ok: false, message: "Source season not found" };
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { data: created, error } = await admin.from("seasons").insert({ name, slug, status: "draft", starts_on: startsOn, regular_weeks: src.regular_weeks, playoff_weeks: src.playoff_weeks, format: src.format, tiebreakers: src.tiebreakers, auto_confirm_hours: src.auto_confirm_hours, playoff_config: src.playoff_config, notes: `Cloned from ${src.name}` }).select("id").single();
  if (error || !created) return { ok: false, message: error?.message ?? "Failed" };
  await ensureWeeks(created.id, startsOn, src.regular_weeks, src.playoff_weeks);
  const { data: nights } = await admin.from("league_nights").select("*").eq("season_id", sourceId);
  for (const n of nights ?? []) {
    const { data: nn } = await admin.from("league_nights").insert({ season_id: created.id, weekday: n.weekday, name: n.name, slug: n.slug, start_time: n.start_time, slot_times: n.slot_times, sort_order: n.sort_order }).select("id").single();
    const { data: teams } = await admin.from("teams").select("*, team_memberships(player_id, role)").eq("night_id", n.id);
    for (const t of teams ?? []) {
      const { data: nt } = await admin.from("teams").insert({ season_id: created.id, night_id: nn!.id, name: t.name, slug: t.slug, color: t.color }).select("id").single();
      const ms = (t.team_memberships as { player_id: string; role: string }[]) ?? [];
      if (nt && ms.length) await admin.from("team_memberships").insert(ms.map((m) => ({ team_id: nt.id, player_id: m.player_id, role: m.role })));
    }
  }
  revalidatePath("/admin/seasons");
  redirect(`/admin/seasons/${created.id}`);
}

export async function updateNight(nightId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z.object({ name: z.string().trim().min(2).max(30), start_time: z.string().regex(/^\d{2}:\d{2}$/), slot_times: z.string().trim() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Check the night name and times (HH:MM)." };
  const slots = parsed.data.slot_times.split(/[,\s]+/).filter((s) => /^\d{2}:\d{2}$/.test(s));
  const supabase = await createClient();
  const { error } = await supabase.from("league_nights").update({ name: parsed.data.name, start_time: parsed.data.start_time, slot_times: slots.length ? slots : [parsed.data.start_time] }).eq("id", nightId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/teams");
  return { ok: true, message: "Night saved" };
}

export async function upsertTable(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const active = formData.get("active") === "on";
  if (name.length < 1) return { ok: false, message: "Name the table" };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("tables").update({ name, active }).eq("id", id) : await supabase.from("tables").insert({ name, active, sort_order: Number(formData.get("sort_order") ?? 0) });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/teams");
  revalidatePath("/admin/posters");
  return { ok: true, message: "Table saved" };
}
