"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "./team";

export async function setMemberRole(teamId: string, playerId: string, role: "captain" | "player" | "sub"): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("team_memberships").update({ role }).eq("team_id", teamId).eq("player_id", playerId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/teams/${teamId}`);
  return { ok: true };
}

export async function removeMember(teamId: string, playerId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("team_memberships").delete().eq("team_id", teamId).eq("player_id", playerId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/teams/${teamId}`);
  return { ok: true };
}

export async function rotateJoinCode(teamId: string): Promise<ActionState & { code?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rotate_join_code", { p_team: teamId });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/teams/${teamId}`);
  return { ok: true, code: data ?? undefined };
}

export async function addRosterPlayer(teamId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = z.string().trim().min(2).max(60).safeParse(formData.get("name"));
  const email = z.string().trim().toLowerCase().email().optional().or(z.literal("")).safeParse(formData.get("email"));
  if (!name.success) return { ok: false, message: "Enter the player's name." };
  const supabase = await createClient();
  const { data: player, error } = await supabase.from("players").insert({ display_name: name.data, email: email.success && email.data ? email.data : null }).select("id").single();
  if (error) return { ok: false, message: error.message };
  const { error: e2 } = await supabase.from("team_memberships").insert({ team_id: teamId, player_id: player.id, role: "player" });
  if (e2) return { ok: false, message: e2.message };
  revalidatePath(`/teams/${teamId}`);
  return { ok: true, message: `${name.data} added. They can claim this spot when they sign in.` };
}
