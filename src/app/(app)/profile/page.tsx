import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile/profile-form";
import { AvailabilityPicker } from "@/components/profile/availability";
import { leaveTeam } from "@/lib/actions/team";
import { WEEKDAY_NAMES } from "@/lib/util/time";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=/profile");
  const supabase = await createClient();
  const [{ data: avail }, { data: nights }] = await Promise.all([
    supabase.from("sub_availability").select("weekday").eq("player_id", viewer.player.id),
    supabase.from("league_nights").select("id, name, weekday"),
  ]);
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Profile</h1>
      <ProfileForm player={{ id: viewer.player.id, display_name: viewer.player.display_name, nickname: viewer.player.nickname, bio: viewer.player.bio, avatar_url: viewer.player.avatar_url }} />
      <section className="mt-6" aria-labelledby="teams">
        <h2 id="teams" className="font-display text-lg font-bold">Your teams</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {viewer.memberships.map((m) => (
            <li key={m.team_id} className="card flex items-center justify-between gap-2 p-3">
              <Link href={`/teams/${m.team_id}`} className="min-w-0"><span className="block truncate font-semibold">{m.team.name}</span><span className="block text-xs text-muted">{WEEKDAY_NAMES[nights?.find((n) => n.id === m.team.night_id)?.weekday ?? 0]} · {m.role}</span></Link>
              <form action={leaveTeam.bind(null, m.team_id)}><button className="btn btn-ghost !min-h-[40px] px-2 text-xs text-danger">Leave</button></form>
            </li>
          ))}
        </ul>
        <Link href="/join" className="btn btn-soft mt-2 w-full">Join another team</Link>
      </section>
      <section className="mt-6" aria-labelledby="sub">
        <h2 id="sub" className="font-display text-lg font-bold">Available to sub</h2>
        <p className="text-sm text-muted">Captains who need a sub on these nights will notify you.</p>
        <AvailabilityPicker current={(avail ?? []).map((a) => a.weekday)} nights={(nights ?? []).map((n) => ({ weekday: n.weekday, name: n.name }))} />
      </section>
      <p className="mt-6 text-center text-sm"><Link href="/settings" className="font-semibold text-accent underline">Notification &amp; theme settings</Link> · <Link href={`/players/${viewer.player.id}`} className="font-semibold text-accent underline">Public profile</Link></p>
    </>
  );
}
