"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data/session";
import { getActiveSeason } from "@/lib/data/league";
import { nightPlayerIds, notifyPlayers } from "@/lib/server/notify";
import type { ActionState } from "./team";

const eventSchema = z.object({
  title: z.string().trim().min(2).max(80), kind: z.enum(["tournament", "social", "playoffs", "banquet", "deadline", "other"]),
  starts_at: z.string().min(10), ends_at: z.string().optional().or(z.literal("")), location: z.string().max(120).optional().or(z.literal("")),
  description: z.string().max(4000).optional().or(z.literal("")), cover_url: z.string().url().optional().or(z.literal("")), rsvp_enabled: z.string().optional(), notify: z.string().optional(),
});

export async function saveEvent(eventId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ") };
  const nights = formData.getAll("night_ids").map(String).filter(Boolean);
  const d = parsed.data;
  const supabase = await createClient();
  const season = await getActiveSeason();
  const row = { season_id: season?.id ?? null, title: d.title, kind: d.kind, starts_at: new Date(d.starts_at).toISOString(), ends_at: d.ends_at ? new Date(d.ends_at).toISOString() : null, location: d.location || null, description: d.description || null, cover_url: d.cover_url || null, rsvp_enabled: d.rsvp_enabled === "on", target_night_ids: nights, created_by: viewer.player.id };
  let id = eventId;
  if (eventId) {
    const { error } = await supabase.from("events").update(row).eq("id", eventId);
    if (error) return { ok: false, message: error.message };
  } else {
    const { data, error } = await supabase.from("events").insert(row).select("id").single();
    if (error) return { ok: false, message: error.message };
    id = data.id;
  }
  if (d.notify === "on" && season) {
    const ids = await nightPlayerIds(nights.length ? nights : null, season.id);
    await notifyPlayers(ids, { type: "event_reminder", title: `New event: ${d.title}`, body: d.location || "", url: `/events/${id}` });
  }
  revalidatePath("/events");
  revalidatePath("/admin/events");
  if (!eventId) redirect(`/admin/events/${id}`);
  return { ok: true, message: "Saved" };
}

export async function deleteEvent(eventId: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("events").delete().eq("id", eventId);
  revalidatePath("/events");
  redirect("/admin/events");
}

export async function postAnnouncement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = z.object({ title: z.string().trim().min(2).max(100), body: z.string().trim().min(2).max(4000), pinned: z.string().optional(), push: z.string().optional(), expires_at: z.string().optional().or(z.literal("")) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Title and body are required." };
  const nights = formData.getAll("night_ids").map(String).filter(Boolean);
  const supabase = await createClient();
  const season = await getActiveSeason();
  const d = parsed.data;
  if (d.pinned === "on") await supabase.from("announcements").update({ pinned: false }).eq("pinned", true);
  const { data, error } = await supabase.from("announcements").insert({ season_id: season?.id ?? null, title: d.title, body: d.body, pinned: d.pinned === "on", push: d.push === "on", target_night_ids: nights, expires_at: d.expires_at ? new Date(d.expires_at).toISOString() : null, created_by: viewer.player.id }).select("id").single();
  if (error) return { ok: false, message: error.message };
  let pushed = 0;
  if (d.push === "on" && season) {
    const ids = await nightPlayerIds(nights.length ? nights : null, season.id);
    const r = await notifyPlayers(ids, { type: "announcement", title: d.title, body: d.body.slice(0, 160), url: "/announcements" });
    pushed = r.inbox;
  }
  void data;
  revalidatePath("/announcements");
  revalidatePath("/");
  return { ok: true, message: `Posted${pushed ? ` and sent to ${pushed} players` : ""}.` };
}

export async function deleteAnnouncement(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("announcements").delete().eq("id", id);
  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
}

export async function toggleAnnouncementPin(id: string, pinned: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  if (pinned) await supabase.from("announcements").update({ pinned: false }).eq("pinned", true);
  await supabase.from("announcements").update({ pinned }).eq("id", id);
  revalidatePath("/");
  revalidatePath("/admin/announcements");
}

export async function saveRules(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const slug = String(formData.get("slug") ?? "rules");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body_md") ?? "");
  if (title.length < 2 || body.length < 10) return { ok: false, message: "Title and body are required." };
  const supabase = await createClient();
  const { error } = await supabase.from("rules_pages").upsert({ slug, title, body_md: body, updated_by: viewer.player.id, updated_at: new Date().toISOString() }, { onConflict: "slug" });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/rules");
  return { ok: true, message: "Rules saved" };
}

export async function saveFaq(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const ids = formData.getAll("id").map(String);
  const qs = formData.getAll("question").map(String);
  const as = formData.getAll("answer_md").map(String);
  await supabase.from("faq_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const rows = qs.map((q, i) => ({ question: q.trim(), answer_md: as[i]?.trim() ?? "", sort_order: i })).filter((r) => r.question && r.answer_md);
  void ids;
  if (rows.length) {
    const { error } = await supabase.from("faq_items").insert(rows);
    if (error) return { ok: false, message: error.message };
  }
  revalidatePath("/rules");
  return { ok: true, message: "FAQ saved" };
}
