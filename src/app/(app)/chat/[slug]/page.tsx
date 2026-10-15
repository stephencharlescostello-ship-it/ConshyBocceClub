import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getViewer } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { ChatRoom, type ChatMessage } from "@/components/chat/chat-room";
import { markRead } from "@/lib/actions/chat";
import { getActiveSeason } from "@/lib/data/league";

export async function generateMetadata(props: PageProps<"/chat/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return { title: `#${slug}` };
}
export const dynamic = "force-dynamic";

export default async function ChannelPage(props: PageProps<"/chat/[slug]">) {
  const { slug } = await props.params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in?next=/chat/${slug}`);
  const supabase = await createClient();
  const season = await getActiveSeason();
  const { data: channel } = await supabase.from("channels").select("*, match:matches(id, home_team_id, away_team_id)").eq("slug", slug).eq("season_id", season?.id ?? "00000000-0000-0000-0000-000000000000").maybeSingle();
  if (!channel) notFound();
  const [{ data: messages }, { data: setting }, { data: mentionables }, { data: mute }] = await Promise.all([
    supabase.from("messages").select("id, author_id, is_bot, body, photo_url, gif_url, reply_to, created_at, edited_at, deleted_at, client_id, author:player_profiles!messages_author_id_fkey(display_name, avatar_url), reactions(emoji, player_id)").eq("channel_id", channel.id).order("created_at", { ascending: false }).limit(60),
    supabase.from("channel_settings").select("mode").eq("channel_id", channel.id).eq("player_id", viewer.player.id).maybeSingle(),
    supabase.from("player_profiles").select("id, display_name, nickname").eq("has_account", true).order("display_name").limit(400),
    supabase.from("mutes").select("until").eq("player_id", viewer.player.id).gt("until", new Date().toISOString()).order("until", { ascending: false }).limit(1).maybeSingle(),
  ]);
  await markRead(channel.id);
  const initial: ChatMessage[] = (messages ?? []).reverse().map((m) => ({
    id: m.id,
    authorId: m.author_id,
    isBot: m.is_bot,
    body: m.body,
    photoUrl: m.photo_url,
    gifUrl: m.gif_url,
    replyTo: m.reply_to,
    createdAt: m.created_at,
    editedAt: m.edited_at,
    deletedAt: m.deleted_at,
    authorName: m.is_bot ? "League Bot" : (m.author as unknown as { display_name: string } | null)?.display_name ?? "Former player",
    authorAvatar: (m.author as unknown as { avatar_url: string | null } | null)?.avatar_url ?? null,
    reactions: (m.reactions as { emoji: string; player_id: string }[]) ?? [],
  }));
  return (
    <div className="-mx-4 -mt-4 flex h-[calc(100dvh-7.5rem)] flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Link href="/chat" className="tap flex items-center justify-center" aria-label="All channels"><ChevronLeft className="h-6 w-6" /></Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-bold">{channel.name}</p>
          {channel.match_id && <Link href={`/matches/${channel.match_id}`} className="text-xs text-accent">View match</Link>}
        </div>
      </div>
      <ChatRoom
        channelId={channel.id}
        channelSlug={slug}
        rules={channel.rules}
        initial={initial}
        me={{ id: viewer.player.id, name: viewer.player.display_name, isAdmin: viewer.isAdmin }}
        mode={(setting?.mode as "all" | "mentions" | "off" | undefined) ?? "mentions"}
        mentionables={(mentionables ?? []).map((p) => ({ id: p.id!, name: p.display_name!, nick: p.nickname }))}
        gifsEnabled={Boolean(process.env.GIPHY_API_KEY)}
        mutedUntil={mute?.until ?? null}
      />
    </div>
  );
}
