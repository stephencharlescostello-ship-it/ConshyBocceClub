"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "./team";

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({
    display_name: z.string().trim().min(2).max(40),
    nickname: z.string().trim().max(30).optional().or(z.literal("")),
    bio: z.string().trim().max(200).optional().or(z.literal("")),
    avatar_url: z.string().url().optional().or(z.literal("")),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Name must be 2–40 characters." };
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("current_player_id");
  if (!me) return { ok: false, message: "Sign in first" };
  const { error } = await supabase.from("players").update({ display_name: parsed.data.display_name, nickname: parsed.data.nickname || null, bio: parsed.data.bio || null, ...(parsed.data.avatar_url ? { avatar_url: parsed.data.avatar_url } : {}) }).eq("id", me);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved" };
}

export async function setTheme(theme: "dark" | "light" | "system") {
  const store = await cookies();
  store.set("theme", theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("current_player_id");
  if (me) await supabase.from("players").update({ theme }).eq("id", me);
  revalidatePath("/", "layout");
}

export async function updatePrefs(prefs: Record<string, boolean>): Promise<ActionState> {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("current_player_id");
  if (!me) return { ok: false, message: "Sign in first" };
  const allowed = ["scores", "mentions", "announcements", "events", "subs", "schedule", "chat"] as const;
  const row: Record<string, boolean | string> = { player_id: me };
  for (const k of allowed) if (k in prefs) row[k] = Boolean(prefs[k]);
  const { error } = await supabase.from("notification_prefs").upsert(row as never, { onConflict: "player_id" });
  return error ? { ok: false, message: error.message } : { ok: true };
}

export async function setAvailability(weekdays: number[]): Promise<ActionState> {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("current_player_id");
  if (!me) return { ok: false, message: "Sign in first" };
  await supabase.from("sub_availability").delete().eq("player_id", me);
  const rows = weekdays.filter((d) => d >= 1 && d <= 7).map((weekday) => ({ player_id: me, weekday }));
  if (rows.length) {
    const { error } = await supabase.from("sub_availability").insert(rows);
    if (error) return { ok: false, message: error.message };
  }
  revalidatePath("/profile");
  return { ok: true };
}

export async function deleteAccount() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) redirect("/");
  await supabase.rpc("delete_my_account");
  await supabase.auth.signOut();
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(user.user.id).catch(() => {});
  redirect("/?deleted=1");
}
