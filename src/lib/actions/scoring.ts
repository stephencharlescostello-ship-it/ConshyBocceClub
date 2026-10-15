"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { afterConfirm } from "@/lib/server/after-confirm";
import { notifyPlayers, teamPlayerIds } from "@/lib/server/notify";
import { rateLimit } from "@/lib/util/rate-limit";
import type { ActionState } from "./team";

const gamesSchema = z.array(z.object({ home: z.number().int().min(0).max(99), away: z.number().int().min(0).max(99), home_lineup: z.array(z.string().uuid()).optional(), away_lineup: z.array(z.string().uuid()).optional() })).min(1).max(9);

function cleanError(e: { message: string } | null) {
  return e?.message.replace(/^[A-Z0-9]+: /, "").replace(/^.*?Error: /, "") ?? "Something went wrong";
}

async function notifyOpponentToConfirm(matchId: string) {
  const admin = createAdminClient();
  const { data: m } = await admin.from("matches").select("id, status, home_team_id, away_team_id, submitting_team_id, home_games, away_games, home:teams!matches_home_team_id_fkey(name), away:teams!matches_away_team_id_fkey(name)").eq("id", matchId).maybeSingle();
  if (!m || m.status !== "submitted") return;
  const other = m.submitting_team_id === m.home_team_id ? m.away_team_id : m.home_team_id;
  if (!other) return;
  const captains = await teamPlayerIds(other, "captain");
  const submitter = m.submitting_team_id === m.home_team_id ? m.home?.name : m.away?.name;
  await notifyPlayers(captains, { type: "score_confirm_request", title: "Confirm your match result", body: `${submitter} submitted ${m.home?.name} ${m.home_games}–${m.away_games} ${m.away?.name}. Confirm or dispute within 12 hours.`, url: `/matches/${matchId}/confirm`, tag: `confirm-${matchId}` }, { forcePush: true });
}

/** Quick Entry or admin entry of final game scores. Idempotent via the client-generated key. */
export async function submitResult(input: { matchId: string; games: unknown; entryMode: "quick" | "live" | "admin"; idempotencyKey: string; note?: string }): Promise<ActionState> {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("current_player_id");
  if (!me) return { ok: false, message: "Sign in first" };
  if (!rateLimit(`submit:${me}`, 30, 60_000)) return { ok: false, message: "Slow down" };
  const games = input.entryMode === "live" ? null : gamesSchema.safeParse(input.games);
  if (games && !games.success) return { ok: false, message: "Enter whole-number scores for each game" };
  const { error } = await supabase.rpc("submit_match_result", {
    p_match: input.matchId,
    p_games: games ? (games.data as unknown as never) : (null as unknown as never),
    p_entry_mode: input.entryMode,
    p_idempotency_key: input.idempotencyKey,
    p_note: input.note ?? undefined,
  });
  if (error) return { ok: false, message: cleanError(error) };
  await notifyOpponentToConfirm(input.matchId);
  // admin submissions confirm immediately
  const { data: m } = await supabase.from("matches").select("status").eq("id", input.matchId).maybeSingle();
  if (m?.status === "confirmed") await afterConfirm(input.matchId);
  revalidatePath(`/matches/${input.matchId}`);
  revalidatePath("/");
  revalidatePath("/standings");
  return { ok: true };
}

export async function confirmResult(matchId: string, note?: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_match", { p_match: matchId, p_note: note ?? undefined });
  if (error) return { ok: false, message: cleanError(error) };
  await afterConfirm(matchId);
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/");
  revalidatePath("/standings");
  return { ok: true };
}

export async function disputeResult(matchId: string, note: string): Promise<ActionState> {
  const supabase = await createClient();
  const text = note.trim();
  if (text.length < 3) return { ok: false, message: "Tell the commissioner what's wrong (a few words is fine)." };
  const { error } = await supabase.rpc("dispute_match", { p_match: matchId, p_note: text });
  if (error) return { ok: false, message: cleanError(error) };
  const admin = createAdminClient();
  const { data: admins } = await admin.from("players").select("id").eq("is_admin", true);
  const { data: m } = await admin.from("matches").select("submitting_team_id, home:teams!matches_home_team_id_fkey(name), away:teams!matches_away_team_id_fkey(name)").eq("id", matchId).maybeSingle();
  await notifyPlayers((admins ?? []).map((a) => a.id), { type: "dispute", title: "Result disputed", body: `${m?.home?.name} vs ${m?.away?.name}: "${text.slice(0, 120)}"`, url: `/admin/results?tab=disputes` });
  if (m?.submitting_team_id) await notifyPlayers(await teamPlayerIds(m.submitting_team_id, "captain"), { type: "score_disputed", title: "Your submitted result was disputed", body: text.slice(0, 140), url: `/matches/${matchId}` });
  revalidatePath(`/matches/${matchId}`);
  return { ok: true };
}

/** Called by the cron route and lazily; announces anything that auto-confirmed. */
export async function runAutoConfirm(): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("auto_confirm_due");
  const ids = (data ?? []) as string[];
  for (const id of ids) await afterConfirm(id);
  return ids;
}

export async function setScorekeeper(matchId: string, playerId: string | null): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_scorekeeper", { p_match: matchId, p_player: playerId as unknown as string });
  if (error) return { ok: false, message: cleanError(error) };
  if (playerId) await notifyPlayers([playerId], { type: "schedule_change", title: "You're keeping score", body: "The captain made you scorekeeper for tonight's match.", url: `/matches/${matchId}/score` });
  revalidatePath(`/matches/${matchId}`);
  return { ok: true };
}
