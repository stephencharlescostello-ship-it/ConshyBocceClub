"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/data/session";
import { afterConfirm } from "@/lib/server/after-confirm";
import { notifyPlayers, teamPlayerIds } from "@/lib/server/notify";
import { advancePlayoffs } from "./playoffs";
import type { ActionState } from "./team";

function clean(e: { message: string } | null) {
  return e?.message.replace(/^[A-Z0-9]+: /, "") ?? "Failed";
}

async function settle(matchId: string) {
  await afterConfirm(matchId);
  await advancePlayoffs(matchId);
  revalidatePath("/", "layout");
}

export async function resolveDispute(disputeId: string, action: "uphold" | "correct" | "replay" | "void", games: { home: number; away: number }[] | null, resolution: string): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: d } = await supabase.from("disputes").select("match_id, opened_by").eq("id", disputeId).maybeSingle();
  const { error } = await supabase.rpc("resolve_dispute", { p_dispute: disputeId, p_action: action, p_games: games as never, p_resolution: resolution || undefined });
  if (error) return { ok: false, message: clean(error) };
  if (d) {
    const admin = createAdminClient();
    const { data: m } = await admin.from("matches").select("status, home_team_id, away_team_id").eq("id", d.match_id).maybeSingle();
    const ids = m ? [...(await teamPlayerIds(m.home_team_id!, "captain")), ...(await teamPlayerIds(m.away_team_id!, "captain"))] : [];
    await notifyPlayers(ids, { type: "dispute_resolved", title: "Dispute resolved", body: `Commissioner decision: ${action}${resolution ? ` — ${resolution}` : ""}`, url: `/matches/${d.match_id}` });
    if (m?.status === "confirmed") await settle(d.match_id);
  }
  revalidatePath("/admin/results");
  return { ok: true, message: "Resolved" };
}

export async function adminSetResult(matchId: string, games: { home: number; away: number }[], note: string): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  // reset first so the RPC accepts a fresh submission, then it auto-confirms for admins
  const { error: e1 } = await supabase.rpc("admin_reset_match", { p_match: matchId, p_note: note || undefined });
  if (e1) return { ok: false, message: clean(e1) };
  const { error } = await supabase.rpc("submit_match_result", { p_match: matchId, p_games: games as never, p_entry_mode: "admin", p_idempotency_key: `admin-${matchId}-${Date.now()}`, p_note: note || undefined });
  if (error) return { ok: false, message: clean(error) };
  await settle(matchId);
  revalidatePath(`/admin/results/${matchId}`);
  return { ok: true, message: "Result saved and confirmed" };
}

export async function adminForfeit(matchId: string, forfeitingTeamId: string, note: string): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_forfeit", { p_match: matchId, p_forfeiting_team: forfeitingTeamId, p_note: note || undefined });
  if (error) return { ok: false, message: clean(error) };
  await settle(matchId);
  return { ok: true, message: "Forfeit recorded" };
}

export async function adminResetMatch(matchId: string, note: string): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reset_match", { p_match: matchId, p_note: note || undefined });
  if (error) return { ok: false, message: clean(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Match reset to scheduled" };
}

export async function adminConfirmNow(matchId: string): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_match", { p_match: matchId, p_note: "Confirmed by admin" });
  if (error) return { ok: false, message: clean(error) };
  await settle(matchId);
  return { ok: true, message: "Confirmed" };
}

export async function adminVoidMatch(matchId: string, note: string): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("matches").update({ status: "void", winner_team_id: null, notes: note || null }).eq("id", matchId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Match voided" };
}

export async function saveAdminOrder(seasonId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const order: Record<string, number> = {};
  for (const [k, v] of formData.entries()) if (k.startsWith("order:") && String(v).trim()) order[k.slice(6)] = Number(v);
  const supabase = await createClient();
  const { error } = await supabase.from("settings").upsert({ key: `admin_order:${seasonId}`, value: order, is_public: true }, { onConflict: "key" });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/standings");
  return { ok: true, message: "Saved" };
}
