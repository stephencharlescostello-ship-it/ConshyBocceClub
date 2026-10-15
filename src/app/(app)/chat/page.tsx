import type { Metadata } from "next";
import Link from "next/link";
import { Hash, MessageSquare } from "lucide-react";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/data/session";
import { getActiveSeason } from "@/lib/data/league";
import { createClient } from "@/lib/supabase/server";
import { relative } from "@/lib/util/time";

export const metadata: Metadata = { title: "Trash Talk" };
export const dynamic = "force-dynamic";

export default async function ChatIndex() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=/chat");
  const season = await getActiveSeason();
  const supabase = await createClient();
  const [{ data: channels }, { data: unread }] = await Promise.all([
    supabase.from("channels").select("id, kind, slug, name, night_id, match_id, match:matches(scheduled_at, status, home_team_id, away_team_id)").eq("season_id", season?.id ?? "00000000-0000-0000-0000-000000000000").order("kind"),
    supabase.rpc("unread_counts"),
  ]);
  const unreadMap = new Map((unread ?? []).map((u) => [u.channel_id, Number(u.unread)]));
  const myNights = new Set(viewer.memberships.map((m) => m.team.night_id));
  const list = (channels ?? []).filter((c) => c.kind !== "match");
  const league = list.filter((c) => c.kind === "league");
  const nights = list.filter((c) => c.kind === "night").sort((a, b) => (myNights.has(a.night_id!) ? -1 : 1) - (myNights.has(b.night_id!) ? -1 : 1));
  const threads = (channels ?? []).filter((c) => c.kind === "match").filter((c) => { const m = c.match as unknown as { home_team_id: string; away_team_id: string; scheduled_at: string } | null; return m && (viewer.teamIds.includes(m.home_team_id) || viewer.teamIds.includes(m.away_team_id)); }).sort((a, b) => ((b.match as unknown as { scheduled_at: string }).scheduled_at).localeCompare((a.match as unknown as { scheduled_at: string }).scheduled_at)).slice(0, 8);
  const Row = ({ c }: { c: (typeof list)[number] }) => {
    const n = unreadMap.get(c.id) ?? 0;
    const m = c.match as unknown as { scheduled_at: string; status: string } | null;
    return (
      <li>
        <Link href={`/chat/${c.slug}`} className="card flex items-center gap-3 p-3">
          {c.kind === "match" ? <MessageSquare className="h-5 w-5 shrink-0 text-accent" /> : <Hash className="h-5 w-5 shrink-0 text-accent" />}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{c.name}</span>
            <span className="block text-xs text-muted">{c.kind === "league" ? "Everyone" : c.kind === "night" ? (myNights.has(c.night_id!) ? "Your night" : "Night channel") : m ? `${m.status === "live" ? "LIVE · " : ""}${relative(m.scheduled_at)}` : "Match thread"}</span>
          </span>
          {n > 0 && <span className="min-w-[24px] rounded-full bg-danger px-2 py-0.5 text-center text-xs font-bold text-white">{n > 99 ? "99+" : n}</span>}
        </Link>
      </li>
    );
  };
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Trash Talk</h1>
      <p className="mt-1 text-sm text-muted">Keep it fun. Slurs get you muted. The League Bot posts every final.</p>
      <ul className="mt-4 flex flex-col gap-2">{league.map((c) => <Row key={c.id} c={c} />)}{nights.map((c) => <Row key={c.id} c={c} />)}</ul>
      {threads.length > 0 && (
        <>
          <h2 className="mt-6 font-display text-lg font-bold">Your match threads</h2>
          <ul className="mt-2 flex flex-col gap-2">{threads.map((c) => <Row key={c.id} c={c} />)}</ul>
        </>
      )}
    </>
  );
}
