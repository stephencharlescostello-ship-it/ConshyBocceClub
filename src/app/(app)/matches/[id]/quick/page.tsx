import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getMatch, getSeasonBySlug } from "@/lib/data/league";
import { getViewer } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { parseFormat } from "@/lib/engine/format";
import { QuickEntryForm } from "./quick-form";
import { fmtDateTime } from "@/lib/util/time";

export const metadata: Metadata = { title: "Quick entry" };

export default async function QuickPage(props: PageProps<"/matches/[id]/quick">) {
  const { id } = await props.params;
  const [m, viewer] = await Promise.all([getMatch(id), getViewer()]);
  if (!m || !m.home || !m.away) notFound();
  if (!viewer) redirect(`/sign-in?next=/matches/${id}/quick`);
  const supabase = await createClient();
  const { data: season } = await supabase.from("seasons").select("format, slug").eq("id", m.season_id).maybeSingle();
  void getSeasonBySlug;
  const format = parseFormat(season?.format);
  const canScore = viewer.isAdmin || viewer.captainTeamIds.includes(m.home_team_id!) || viewer.captainTeamIds.includes(m.away_team_id!) || m.scorekeeper_player_id === viewer.player.id;
  const [{ data: homeRoster }, { data: awayRoster }] = await Promise.all([
    supabase.from("team_memberships").select("player_id, player:player_profiles(display_name)").eq("team_id", m.home_team_id!),
    supabase.from("team_memberships").select("player_id, player:player_profiles(display_name)").eq("team_id", m.away_team_id!),
  ]);
  const roster = (rows: typeof homeRoster) => (rows ?? []).map((r) => ({ id: r.player_id, name: (r.player as unknown as { display_name: string } | null)?.display_name ?? "?" }));
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Quick entry</h1>
      <p className="mt-1 text-muted">{m.home.name} vs {m.away.name} · {fmtDateTime(m.scheduled_at)}</p>
      {!canScore ? (
        <p className="mt-4 rounded-xl bg-elev-2 px-4 py-3">Only a captain, the designated scorekeeper or an admin can enter scores for this match.</p>
      ) : !["scheduled", "live", "postponed"].includes(m.status) ? (
        <p className="mt-4 rounded-xl bg-elev-2 px-4 py-3">This match is already {m.status}.</p>
      ) : (
        <QuickEntryForm matchId={id} format={format} home={{ id: m.home.id, name: m.home.name, roster: roster(homeRoster) }} away={{ id: m.away.id, name: m.away.name, roster: roster(awayRoster) }} />
      )}
    </>
  );
}
