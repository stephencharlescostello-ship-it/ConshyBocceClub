"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "./team";

export async function rsvp(eventId: string, status: "going" | "maybe" | "no"): Promise<ActionState> {
  const parsed = z.object({ eventId: z.string().uuid(), status: z.enum(["going", "maybe", "no"]) }).safeParse({ eventId, status });
  if (!parsed.success) return { ok: false, message: "Invalid RSVP" };
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("current_player_id");
  if (!me) return { ok: false, message: "Sign in to RSVP" };
  const { error } = await supabase.from("rsvps").upsert({ event_id: eventId, player_id: me, status, updated_at: new Date().toISOString() }, { onConflict: "event_id,player_id" });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  return { ok: true };
}

export async function markNotificationsRead(ids?: string[]): Promise<void> {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("current_player_id");
  if (!me) return;
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("player_id", me).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  await q;
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function clearNotifications(): Promise<void> {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("current_player_id");
  if (!me) return;
  await supabase.from("notifications").delete().eq("player_id", me);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
