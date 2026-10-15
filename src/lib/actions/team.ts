"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { ok: boolean; message?: string };

export async function joinWithCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const code = z.string().trim().min(6).max(6).safeParse(String(formData.get("code") ?? "").toUpperCase().replace(/\s/g, ""));
  if (!code.success) return { ok: false, message: "Join codes are 6 characters." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_team_with_code", { p_code: code.data });
  if (error) return { ok: false, message: error.message.replace(/^.*?: /, "") };
  revalidatePath("/", "layout");
  redirect(`/teams/${data}?joined=1`);
}

export async function claimRoster(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.string().uuid().safeParse(formData.get("player_id"));
  if (!id.success) return { ok: false, message: "Pick a name." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_roster_player", { p_player: id.data });
  if (error) return { ok: false, message: error.message.replace(/^.*?: /, "") };
  revalidatePath("/", "layout");
  redirect("/onboarding?step=notifications");
}

export async function leaveTeam(teamId: string) {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("current_player_id");
  if (!me) return;
  await supabase.from("team_memberships").delete().eq("team_id", teamId).eq("player_id", me);
  revalidatePath("/", "layout");
}

export async function completeOnboarding() {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("current_player_id");
  if (me) await supabase.from("players").update({ onboarded_at: new Date().toISOString() }).eq("id", me);
  revalidatePath("/", "layout");
  redirect("/");
}
