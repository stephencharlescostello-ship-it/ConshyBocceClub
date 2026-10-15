"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/data/session";
import type { ActionState } from "./team";

export async function setAdmin(playerId: string, isAdmin: boolean): Promise<ActionState> {
  const me = await requireAdmin();
  if (me.player.id === playerId && !isAdmin) return { ok: false, message: "You can't remove your own admin role." };
  const supabase = await createClient();
  const { error } = await supabase.from("players").update({ is_admin: isAdmin }).eq("id", playerId);
  if (error) return { ok: false, message: error.message };
  await supabase.rpc("log_audit", { p_action: isAdmin ? "user.grant_admin" : "user.revoke_admin", p_entity: "player", p_entity_id: playerId, p_before: null as never, p_after: null as never });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function mutePlayer(playerId: string, hours: number, reason: string): Promise<ActionState> {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("mutes").insert({ player_id: playerId, until: new Date(Date.now() + hours * 3600_000).toISOString(), reason: reason || null, created_by: me.player.id });
  if (error) return { ok: false, message: error.message };
  await supabase.rpc("log_audit", { p_action: "moderation.mute", p_entity: "player", p_entity_id: playerId, p_before: null as never, p_after: { hours, reason } as never });
  revalidatePath("/admin/moderation");
  return { ok: true, message: `Muted for ${hours}h` };
}

export async function unmutePlayer(playerId: string): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("mutes").delete().eq("player_id", playerId);
  revalidatePath("/admin/moderation");
  return { ok: true };
}

export async function banPlayer(playerId: string, reason: string, ban: boolean): Promise<ActionState> {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { error } = ban ? await supabase.from("bans").upsert({ player_id: playerId, reason: reason || null, created_by: me.player.id }) : await supabase.from("bans").delete().eq("player_id", playerId);
  if (error) return { ok: false, message: error.message };
  await supabase.rpc("log_audit", { p_action: ban ? "moderation.ban" : "moderation.unban", p_entity: "player", p_entity_id: playerId, p_before: null as never, p_after: { reason } as never });
  revalidatePath("/admin/moderation");
  return { ok: true };
}

export async function resolveReport(reportId: string, action: "dismiss" | "delete"): Promise<ActionState> {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data: r } = await supabase.from("message_reports").select("message_id").eq("id", reportId).maybeSingle();
  if (!r) return { ok: false, message: "Not found" };
  if (action === "delete") await supabase.rpc("delete_message", { p_message: r.message_id });
  await supabase.from("message_reports").update({ status: action === "delete" ? "actioned" : "dismissed", resolved_by: me.player.id }).eq("id", reportId);
  revalidatePath("/admin/moderation");
  return { ok: true };
}

export async function saveBlockedWords(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const words = String(formData.get("words") ?? "").split(/[\n,]+/).map((w) => w.trim().toLowerCase()).filter((w) => w.length > 1);
  const supabase = await createClient();
  await supabase.from("blocked_words").delete().neq("word", "");
  if (words.length) {
    const { error } = await supabase.from("blocked_words").insert(Array.from(new Set(words)).map((word) => ({ word })));
    if (error) return { ok: false, message: error.message };
  }
  return { ok: true, message: `${words.length} blocked words saved` };
}

export async function updateDues(seasonId: string, playerId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z.object({ amount: z.coerce.number().min(0).max(10000), paid: z.string().optional(), note: z.string().max(200).optional().or(z.literal("")) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Check the amount" };
  const supabase = await createClient();
  const paid = parsed.data.paid === "on";
  const { error } = await supabase.from("dues").upsert({ season_id: seasonId, player_id: playerId, amount_cents: Math.round(parsed.data.amount * 100), paid, paid_at: paid ? new Date().toISOString() : null, note: parsed.data.note || null, updated_at: new Date().toISOString() }, { onConflict: "season_id,player_id" });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/dues");
  return { ok: true };
}

export async function markAllDues(seasonId: string, amountCents: number): Promise<ActionState> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: members } = await admin.from("team_memberships").select("player_id, teams!inner(season_id)").eq("teams.season_id", seasonId);
  const ids = Array.from(new Set((members ?? []).map((m) => m.player_id)));
  if (ids.length) await admin.from("dues").upsert(ids.map((player_id) => ({ season_id: seasonId, player_id, amount_cents: amountCents })), { onConflict: "season_id,player_id", ignoreDuplicates: true });
  revalidatePath("/admin/dues");
  return { ok: true, message: `${ids.length} players on the dues list` };
}

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const league = { app_name: String(formData.get("app_name") ?? "CBC Shuffle"), club_name: String(formData.get("club_name") ?? ""), tagline: String(formData.get("tagline") ?? ""), timezone: "America/New_York" };
  const club = { address: String(formData.get("address") ?? ""), map_url: String(formData.get("map_url") ?? ""), contact_name: String(formData.get("contact_name") ?? ""), contact_email: String(formData.get("contact_email") ?? ""), contact_phone: String(formData.get("contact_phone") ?? "") };
  const dues = { amount_cents: Math.round(Number(formData.get("dues_amount") ?? 0) * 100), label: String(formData.get("dues_label") ?? "Dues") };
  const { error } = await supabase.from("settings").upsert([{ key: "league", value: league, is_public: true }, { key: "club", value: club, is_public: true }, { key: "dues", value: dues, is_public: false }], { onConflict: "key" });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved" };
}

export async function adminDeletePlayer(playerId: string): Promise<ActionState> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: p } = await admin.from("players").select("user_id").eq("id", playerId).maybeSingle();
  await admin.from("push_subscriptions").delete().eq("player_id", playerId);
  await admin.from("team_memberships").delete().eq("player_id", playerId);
  await admin.from("players").update({ deleted_at: new Date().toISOString(), display_name: "Former player", email: null, phone: null, avatar_url: null, nickname: null, user_id: null }).eq("id", playerId);
  if (p?.user_id) await admin.auth.admin.deleteUser(p.user_id).catch(() => {});
  revalidatePath("/admin/users");
  return { ok: true, message: "Player removed" };
}
