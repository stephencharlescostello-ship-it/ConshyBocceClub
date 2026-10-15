import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ModerationPanel } from "@/components/admin/moderation-panel";
import { fmtDateTime } from "@/lib/util/time";

export const metadata: Metadata = { title: "Moderation" };
export const dynamic = "force-dynamic";

export default async function ModerationAdmin() {
  const supabase = await createClient();
  const [{ data: reports }, { data: mutes }, { data: bans }, { data: words }] = await Promise.all([
    supabase.from("message_reports").select("id, reason, status, created_at, reporter:player_profiles!message_reports_reporter_id_fkey(display_name), message:messages(id, body, author_id, deleted_at, author:player_profiles!messages_author_id_fkey(display_name), channel:channels(name))").eq("status", "open").order("created_at", { ascending: false }),
    supabase.from("mutes").select("player_id, until, reason, player:player_profiles(display_name)").gt("until", new Date().toISOString()),
    supabase.from("bans").select("player_id, reason, player:player_profiles(display_name)"),
    supabase.from("blocked_words").select("word").order("word"),
  ]);
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Moderation</h1>
      <ModerationPanel
        reports={(reports ?? []).map((r) => { const m = r.message as unknown as { id: string; body: string; author_id: string | null; deleted_at: string | null; author: { display_name: string } | null; channel: { name: string } | null } | null; return { id: r.id, reason: r.reason, at: fmtDateTime(r.created_at), reporter: (r.reporter as unknown as { display_name: string } | null)?.display_name ?? "?", body: m?.body ?? "", authorId: m?.author_id ?? null, author: m?.author?.display_name ?? "?", channel: m?.channel?.name ?? "", deleted: Boolean(m?.deleted_at) }; })}
        mutes={(mutes ?? []).map((m) => ({ playerId: m.player_id, name: (m.player as unknown as { display_name: string } | null)?.display_name ?? "?", until: fmtDateTime(m.until), reason: m.reason }))}
        bans={(bans ?? []).map((b) => ({ playerId: b.player_id, name: (b.player as unknown as { display_name: string } | null)?.display_name ?? "?", reason: b.reason }))}
        words={(words ?? []).map((w) => w.word)}
      />
    </>
  );
}
