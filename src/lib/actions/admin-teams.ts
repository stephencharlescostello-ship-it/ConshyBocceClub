"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data/session";
import { teamSlugify } from "@/lib/util/strings";
import type { ActionState } from "./team";

export async function createTeam(seasonId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z.object({ night_id: z.string().uuid(), name: z.string().trim().min(2).max(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), captain_name: z.string().trim().max(60).optional().or(z.literal("")), captain_email: z.string().trim().toLowerCase().email().optional().or(z.literal("")) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Team needs a night and a name (2–40 chars)." };
  const supabase = await createClient();
  const { data: team, error } = await supabase.from("teams").insert({ season_id: seasonId, night_id: parsed.data.night_id, name: parsed.data.name, slug: teamSlugify(parsed.data.name), color: parsed.data.color ?? "#2f8f5f" }).select("id").single();
  if (error) return { ok: false, message: error.message.includes("unique") ? "A team with that name already exists on this night." : error.message };
  if (parsed.data.captain_name) {
    const { data: p } = await supabase.from("players").insert({ display_name: parsed.data.captain_name, email: parsed.data.captain_email || null }).select("id").single();
    if (p) await supabase.from("team_memberships").insert({ team_id: team.id, player_id: p.id, role: "captain" });
  }
  revalidatePath("/admin/teams");
  return { ok: true, message: `${parsed.data.name} created.` };
}

export async function renameTeam(teamId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "");
  if (name.length < 2) return { ok: false, message: "Name too short" };
  const supabase = await createClient();
  const { error } = await supabase.from("teams").update({ name, slug: teamSlugify(name), ...(color ? { color } : {}) }).eq("id", teamId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/teams");
  return { ok: true, message: "Saved" };
}

export async function deleteTeam(teamId: string): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { count } = await supabase.from("matches").select("id", { count: "exact", head: true }).or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`).in("status", ["confirmed", "forfeit", "submitted", "live", "disputed"]);
  if ((count ?? 0) > 0) return { ok: false, message: "This team has played matches; archive the season instead of deleting it." };
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/teams");
  return { ok: true };
}
