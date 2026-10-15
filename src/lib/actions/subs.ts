"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPlayers, teamPlayerIds } from "@/lib/server/notify";
import { fmtDateTime, WEEKDAY_NAMES } from "@/lib/util/time";
import type { ActionState } from "./team";

export async function createSubRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ team_id: z.string().uuid(), match_id: z.string().uuid().optional().or(z.literal("")), needed_at: z.string().min(10), note: z.string().max(300).optional().or(z.literal("")) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Pick a team and a date/time." };
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("current_player_id");
  if (!me) return { ok: false, message: "Sign in first" };
  const { data: team } = await supabase.from("teams").select("id, name, night_id, night:league_nights(weekday, name)").eq("id", parsed.data.team_id).maybeSingle();
  if (!team) return { ok: false, message: "Team not found" };
  const neededAt = new Date(parsed.data.needed_at);
  const { data: req, error } = await supabase.from("sub_requests").insert({ team_id: team.id, match_id: parsed.data.match_id || null, night_id: team.night_id, needed_at: neededAt.toISOString(), note: parsed.data.note || null, created_by: me }).select("id").single();
  if (error) return { ok: false, message: error.message.includes("policy") ? "Only captains can post sub requests." : error.message };
  // notify players available on that weekday (excluding the team's own roster)
  const admin = createAdminClient();
  const weekday = (team.night as unknown as { weekday: number } | null)?.weekday ?? 0;
  const [{ data: avail }, roster] = await Promise.all([admin.from("sub_availability").select("player_id").eq("weekday", weekday), teamPlayerIds(team.id)]);
  const targets = (avail ?? []).map((a) => a.player_id).filter((id) => !roster.includes(id));
  await notifyPlayers(targets, { type: "sub_request", title: `Sub needed: ${team.name}, ${WEEKDAY_NAMES[weekday]}`, body: `${fmtDateTime(neededAt)}${parsed.data.note ? ` — ${parsed.data.note}` : ""}. First to claim gets it.`, url: `/subs?claim=${req.id}` });
  revalidatePath("/subs");
  return { ok: true, message: `Posted. ${targets.length} available player${targets.length === 1 ? "" : "s"} notified.` };
}

export async function claimSub(requestId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_sub_request", { p_request: requestId });
  if (error) return { ok: false, message: error.message.replace(/^.*?: /, "") };
  const r = data as unknown as { team_id: string; claimed_by: string };
  const admin = createAdminClient();
  const { data: claimer } = await admin.from("players").select("display_name").eq("id", r.claimed_by).maybeSingle();
  await notifyPlayers(await teamPlayerIds(r.team_id, "captain"), { type: "sub_claimed", title: `${claimer?.display_name ?? "A player"} can sub`, body: "Confirm them on the Sub board.", url: "/subs" });
  revalidatePath("/subs");
  return { ok: true, message: "You claimed the spot. The captain will confirm." };
}

export async function confirmSub(requestId: string, accept: boolean): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_sub_claim", { p_request: requestId, p_accept: accept });
  if (error) return { ok: false, message: error.message.replace(/^.*?: /, "") };
  const r = data as unknown as { team_id: string; claimed_by: string | null; needed_at: string; match_id: string | null };
  if (accept && r.claimed_by) {
    const admin = createAdminClient();
    const { data: team } = await admin.from("teams").select("name").eq("id", r.team_id).maybeSingle();
    await notifyPlayers([r.claimed_by], { type: "sub_confirmed", title: `You're in for ${team?.name}`, body: fmtDateTime(r.needed_at), url: r.match_id ? `/matches/${r.match_id}` : "/subs" });
  }
  revalidatePath("/subs");
  return { ok: true };
}

export async function cancelSubRequest(requestId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("sub_requests").update({ status: "cancelled" }).eq("id", requestId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/subs");
  return { ok: true };
}
