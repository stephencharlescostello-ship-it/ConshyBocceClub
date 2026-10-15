import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { getActiveSeason, getMatches } from "@/lib/data/league";
import { SubBoard } from "@/components/subs/sub-board";
import { fmtDateTime } from "@/lib/util/time";

export const metadata: Metadata = { title: "Sub board" };
export const dynamic = "force-dynamic";

export default async function SubsPage(props: PageProps<"/subs">) {
  const sp = await props.searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=/subs");
  const supabase = await createClient();
  const season = await getActiveSeason();
  const [{ data: requests }, { data: avail }] = await Promise.all([
    supabase.from("sub_requests").select("*, team:teams(id, name, color), night:league_nights(name, weekday), claimer:player_profiles!sub_requests_claimed_by_fkey(id, display_name)").gte("needed_at", new Date(new Date().getTime() - 6 * 3600_000).toISOString()).neq("status", "cancelled").order("needed_at"),
    supabase.from("sub_availability").select("weekday").eq("player_id", viewer.player.id),
  ]);
  const captainTeams = viewer.memberships.filter((m) => m.role === "captain" || viewer.isAdmin).map((m) => m.team);
  const upcoming = season && captainTeams.length ? (await Promise.all(captainTeams.map((t) => getMatches({ seasonId: season.id, teamId: t.id, statuses: ["scheduled", "postponed"], from: new Date().toISOString(), limit: 6 })))).flat() : [];
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Sub board</h1>
      <p className="mt-1 text-sm text-muted">{avail?.length ? `You're available on ${avail.length} night${avail.length > 1 ? "s" : ""}.` : "Set the nights you can sub on your profile to get notified."} <Link href="/profile" className="text-accent underline">Edit availability</Link></p>
      <SubBoard
        me={{ id: viewer.player.id, teamIds: viewer.teamIds, captainTeamIds: viewer.isAdmin ? captainTeams.map((t) => t.id) : viewer.captainTeamIds, isAdmin: viewer.isAdmin }}
        requests={(requests ?? []).map((r) => ({ id: r.id, status: r.status, neededAt: r.needed_at, note: r.note, teamId: r.team_id, teamName: (r.team as unknown as { name: string } | null)?.name ?? "", teamColor: (r.team as unknown as { color: string } | null)?.color ?? "", night: (r.night as unknown as { name: string } | null)?.name ?? "", claimedBy: r.claimed_by, claimerName: (r.claimer as unknown as { display_name: string } | null)?.display_name ?? null, matchId: r.match_id }))}
        captainTeams={captainTeams.map((t) => ({ id: t.id, name: t.name }))}
        upcomingMatches={upcoming.map((m) => ({ id: m.id, label: `${fmtDateTime(m.scheduled_at)} vs ${m.home?.name}/${m.away?.name}`.replace(` vs ${captainTeams.find((t) => t.id === m.home_team_id)?.name}/`, " vs ").replace(`/${captainTeams.find((t) => t.id === m.away_team_id)?.name}`, ""), teamId: captainTeams.find((t) => t.id === m.home_team_id || t.id === m.away_team_id)!.id, at: m.scheduled_at }))}
        highlight={typeof sp.claim === "string" ? sp.claim : typeof sp.match === "string" ? sp.match : null}
      />
    </>
  );
}
