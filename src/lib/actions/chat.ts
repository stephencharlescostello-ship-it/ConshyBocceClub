"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPlayers } from "@/lib/server/notify";
import type { ActionState } from "./team";

function clean(msg: string) {
  return msg.replace(/^[A-Z0-9]+: /, "");
}

export async function postMessage(input: { channelId: string; body: string; replyTo?: string | null; photoUrl?: string | null; gifUrl?: string | null; clientId: string }): Promise<ActionState & { message?: string; id?: string }> {
  const parsed = z.object({ channelId: z.string().uuid(), body: z.string().max(2000), replyTo: z.string().uuid().nullish(), photoUrl: z.string().url().nullish(), gifUrl: z.string().url().nullish(), clientId: z.string().min(8).max(64) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid message" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_message", { p_channel: parsed.data.channelId, p_body: parsed.data.body, p_reply_to: parsed.data.replyTo ?? undefined, p_photo_url: parsed.data.photoUrl ?? undefined, p_gif_url: parsed.data.gifUrl ?? undefined, p_client_id: parsed.data.clientId });
  if (error) return { ok: false, message: clean(error.message) };
  const msg = data as unknown as { id: string; mentions: string[]; author_id: string; channel_id: string; body: string };
  // Push the mentioned players (and anyone with "all" on this channel)
  const admin = createAdminClient();
  const [{ data: author }, { data: channel }, { data: allMode }] = await Promise.all([
    admin.from("players").select("display_name").eq("id", msg.author_id).maybeSingle(),
    admin.from("channels").select("name, slug").eq("id", msg.channel_id).maybeSingle(),
    admin.from("channel_settings").select("player_id").eq("channel_id", msg.channel_id).eq("mode", "all"),
  ]);
  const name = author?.display_name ?? "Someone";
  const url = `/chat/${channel?.slug ?? ""}?m=${msg.id}`;
  const mentioned = (msg.mentions ?? []).filter((id) => id !== msg.author_id);
  if (mentioned.length) await notifyPlayers(mentioned, { type: "mention", title: `${name} mentioned you in ${channel?.name ?? "chat"}`, body: msg.body.slice(0, 140), url, tag: `chat-${msg.channel_id}` }, { forcePush: true });
  const others = (allMode ?? []).map((r) => r.player_id).filter((id) => id !== msg.author_id && !mentioned.includes(id));
  if (others.length) await notifyPlayers(others, { type: "chat", title: `${name} in ${channel?.name ?? "chat"}`, body: msg.body.slice(0, 140) || "📷 Photo", url, tag: `chat-${msg.channel_id}` }, { forcePush: true });
  return { ok: true, id: msg.id };
}

export async function editMessage(messageId: string, body: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("edit_message", { p_message: messageId, p_body: body });
  return error ? { ok: false, message: clean(error.message) } : { ok: true };
}

export async function deleteMessage(messageId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_message", { p_message: messageId });
  return error ? { ok: false, message: clean(error.message) } : { ok: true };
}

export async function toggleReaction(messageId: string, emoji: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("toggle_reaction", { p_message: messageId, p_emoji: emoji.slice(0, 8) });
  return error ? { ok: false, message: clean(error.message) } : { ok: true };
}

export async function reportMessage(messageId: string, reason: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("current_player_id");
  if (!me) return { ok: false, message: "Sign in first" };
  const { error } = await supabase.from("message_reports").upsert({ message_id: messageId, reporter_id: me, reason: reason.slice(0, 300) }, { onConflict: "message_id,reporter_id" });
  if (error) return { ok: false, message: clean(error.message) };
  const admin = createAdminClient();
  const { data: admins } = await admin.from("players").select("id").eq("is_admin", true);
  await notifyPlayers((admins ?? []).map((a) => a.id), { type: "dispute", title: "Message reported", body: reason.slice(0, 120) || "A player reported a chat message.", url: "/admin/moderation" });
  return { ok: true, message: "Reported. An admin will take a look." };
}

export async function setChannelMode(channelId: string, mode: "all" | "mentions" | "off"): Promise<ActionState> {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("current_player_id");
  if (!me) return { ok: false, message: "Sign in first" };
  const { error } = await supabase.from("channel_settings").upsert({ channel_id: channelId, player_id: me, mode }, { onConflict: "channel_id,player_id" });
  return error ? { ok: false, message: clean(error.message) } : { ok: true };
}

export async function markRead(channelId: string) {
  const supabase = await createClient();
  await supabase.rpc("mark_channel_read", { p_channel: channelId });
}
