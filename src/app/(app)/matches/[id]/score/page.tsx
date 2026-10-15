import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMatch } from "@/lib/data/league";
import { getViewer } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { parseFormat } from "@/lib/engine/format";
import { Scorekeeper } from "./scorekeeper";
import type { LiveState } from "@/components/match/use-match-realtime";

export const metadata: Metadata = { title: "Keep score" };
export const dynamic = "force-dynamic";

export default async function ScorePage(props: PageProps<"/matches/[id]/score">) {
  const { id } = await props.params;
  const [m, viewer] = await Promise.all([getMatch(id), getViewer()]);
  if (!m || !m.home || !m.away) notFound();
  if (!viewer) redirect(`/sign-in?next=/matches/${id}/score`);
  const supabase = await createClient();
  const [{ data: season }, { data: state }, { data: homeRoster }, { data: awayRoster }] = await Promise.all([
    supabase.from("seasons").select("format").eq("id", m.season_id).maybeSingle(),
    supabase.rpc("match_state", { p_match: id }),
    supabase.from("team_memberships").select("player_id, player:player_profiles(display_name)").eq("team_id", m.home_team_id!),
    supabase.from("team_memberships").select("player_id, player:player_profiles(display_name)").eq("team_id", m.away_team_id!),
  ]);
  const canScore = viewer.isAdmin || viewer.captainTeamIds.includes(m.home_team_id!) || viewer.captainTeamIds.includes(m.away_team_id!) || m.scorekeeper_player_id === viewer.player.id;
  if (!canScore) {
    return (
      <>
        <h1 className="font-display text-2xl font-extrabold">Keep score</h1>
        <p className="mt-3 rounded-xl bg-elev-2 px-4 py-3">Only a captain, the designated scorekeeper or an admin can run the scorekeeper. Ask your captain to make you scorekeeper from the match page.</p>
        <Link href={`/matches/${id}`} className="btn btn-primary mt-4">Watch live instead</Link>
      </>
    );
  }
  if (!["scheduled", "live", "postponed"].includes(m.status)) {
    return (
      <>
        <h1 className="font-display text-2xl font-extrabold">Keep score</h1>
        <p className="mt-3 rounded-xl bg-elev-2 px-4 py-3">This match is {m.status} and can&apos;t be scored.</p>
        <Link href={`/matches/${id}`} className="btn btn-primary mt-4">Back to match</Link>
      </>
    );
  }
  const roster = (rows: typeof homeRoster) => (rows ?? []).map((r) => ({ id: r.player_id, name: (r.player as unknown as { display_name: string } | null)?.display_name ?? "?" }));
  return (
    <Scorekeeper
      matchId={id}
      format={parseFormat(season?.format)}
      home={{ id: m.home.id, name: m.home.name, color: m.home.color, roster: roster(homeRoster) }}
      away={{ id: m.away.id, name: m.away.name, color: m.away.color, roster: roster(awayRoster) }}
      initial={(state ?? null) as unknown as LiveState | null}
    />
  );
}
