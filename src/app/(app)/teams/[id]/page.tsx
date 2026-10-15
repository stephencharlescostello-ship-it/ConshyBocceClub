import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, CalendarPlus, Crown } from "lucide-react";
import { getViewer } from "@/lib/data/session";
import { getMatches, getSeasonBySlug, getTeams } from "@/lib/data/league";
import { getSeasonStandings } from "@/lib/data/standings";
import { createClient } from "@/lib/supabase/server";
import { MatchCard } from "@/components/match/match-card";
import { Avatar } from "@/components/ui/avatar";
import { TeamDot } from "@/components/match/match-card";
import { RosterAdmin } from "./roster-admin";
import { publicEnv } from "@/lib/env";
import { signed } from "@/lib/util/strings";

export async function generateMetadata(props: PageProps<"/teams/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("teams").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Team" };
}

export default async function TeamPage(props: PageProps<"/teams/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: team }, viewer] = await Promise.all([
    supabase.from("teams").select("*, night:league_nights(id, name, weekday, slug), season:seasons(id, name, slug, status)").eq("id", id).maybeSingle(),
    getViewer(),
  ]);
  if (!team) notFound();
  const season = await getSeasonBySlug((team.season as { slug: string }).slug);
  const [{ data: roster }, matches, standings, teams, { data: secret }] = await Promise.all([
    supabase.from("team_memberships").select("role, joined_at, player:player_profiles(id, display_name, nickname, avatar_url, has_account)").eq("team_id", id),
    getMatches({ teamId: id }),
    season ? getSeasonStandings(season) : Promise.resolve([]),
    season ? getTeams(season.id) : Promise.resolve([]),
    viewer && (viewer.teamIds.includes(id) || viewer.isAdmin) ? supabase.from("team_secrets").select("join_code").eq("team_id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const row = standings.flatMap((s) => s.rows).find((r) => r.teamId === id);
  const isCaptain = Boolean(viewer && (viewer.captainTeamIds.includes(id) || viewer.isAdmin));
  const isMember = Boolean(viewer && viewer.teamIds.includes(id));
  const played = matches.filter((m) => ["confirmed", "forfeit"].includes(m.status));
  const upcoming = matches.filter((m) => ["scheduled", "live", "submitted", "disputed", "postponed"].includes(m.status));
  // head-to-head
  const h2h = new Map<string, { w: number; l: number; name: string; color: string }>();
  for (const m of played) {
    const oppId = m.home_team_id === id ? m.away_team_id : m.home_team_id;
    if (!oppId) continue;
    const opp = teams.find((t) => t.id === oppId);
    const rec = h2h.get(oppId) ?? { w: 0, l: 0, name: opp?.name ?? "?", color: opp?.color ?? "" };
    if (m.winner_team_id === id) rec.w++;
    else rec.l++;
    h2h.set(oppId, rec);
  }
  for (const t of teams.filter((t) => t.night_id === team.night_id && t.id !== id)) if (!h2h.has(t.id)) h2h.set(t.id, { w: 0, l: 0, name: t.name, color: t.color });
  const members = (roster ?? []).map((r) => ({ role: r.role, player: r.player as unknown as { id: string; display_name: string; nickname: string | null; avatar_url: string | null; has_account: boolean } })).filter((r) => r.player).sort((a, b) => (a.role === "captain" ? -1 : b.role === "captain" ? 1 : a.player.display_name.localeCompare(b.player.display_name)));

  return (
    <>
      {sp.joined && <p className="mb-3 rounded-xl bg-primary-soft px-4 py-3 text-sm font-semibold">You&apos;re on the team. Welcome aboard! 🎉</p>}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wider text-subtle">{(team.night as { name: string } | null)?.name} · {(team.season as { name: string }).name}</p>
          <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold leading-tight"><TeamDot color={team.color} className="h-4 w-4" /> <span className="min-w-0 break-words">{team.name}</span></h1>
        </div>
        {row && (
          <div className="shrink-0 text-right">
            <p className="font-display text-3xl font-extrabold tabular">{row.wins}–{row.losses}</p>
            <p className="text-xs text-muted">#{row.rank} · {signed(row.pointDiff)} pts</p>
          </div>
        )}
      </div>
      {row && (
        <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
          {[["Games", `${row.gamesWon}–${row.gamesLost}`], ["Streak", row.streak], ["Last 5", row.last5.join("") || "—"], ["Pts", `${row.pointsFor}/${row.pointsAgainst}`]].map(([k, v]) => (
            <div key={k} className="card p-2"><dt className="text-[11px] uppercase text-subtle">{k}</dt><dd className="font-bold tabular">{v}</dd></div>
          ))}
        </dl>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {viewer && <Link href={`/chat/${(team.night as { slug: string } | null)?.slug ?? "league"}`} className="btn btn-soft !min-h-[44px] px-3 text-sm"><MessageCircle className="h-4 w-4" /> Night chat</Link>}
        <a href={`${publicEnv.siteUrl.replace(/^https?:/, "webcal:")}/api/ics/team/${id}`} className="btn btn-soft !min-h-[44px] px-3 text-sm"><CalendarPlus className="h-4 w-4" /> Calendar feed</a>
      </div>

      <section className="mt-6" aria-labelledby="roster">
        <h2 id="roster" className="mb-2 font-display text-lg font-bold">Roster</h2>
        <ul className="card divide-y divide-border">
          {members.map((m) => (
            <li key={m.player.id} className="flex items-center gap-3 p-3">
              <Link href={`/players/${m.player.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={m.player.display_name} src={m.player.avatar_url} size={40} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 font-semibold">{m.player.display_name} {m.role === "captain" && <Crown className="h-4 w-4 text-accent" aria-label="Captain" />}</span>
                  <span className="block text-xs text-muted">{m.player.nickname ? `“${m.player.nickname}” · ` : ""}{m.role === "sub" ? "Sub" : m.role === "captain" ? "Captain" : "Player"}{!m.player.has_account ? " · not signed up yet" : ""}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {isCaptain && <RosterAdmin teamId={id} members={members.map((m) => ({ id: m.player.id, name: m.player.display_name, role: m.role }))} joinCode={secret?.join_code ?? null} />}
        {!isCaptain && isMember && secret?.join_code && <p className="mt-2 text-sm text-muted">Join code: <span className="font-mono font-bold tracking-widest text-fg">{secret.join_code}</span></p>}
      </section>

      {upcoming.length > 0 && (
        <section className="mt-6" aria-labelledby="upcoming">
          <h2 id="upcoming" className="mb-2 font-display text-lg font-bold">Upcoming</h2>
          <div className="flex flex-col gap-2">{upcoming.slice(0, 4).map((m) => <MatchCard key={m.id} match={m} highlightTeamIds={[id]} showDate />)}</div>
        </section>
      )}

      <section className="mt-6" aria-labelledby="h2h">
        <h2 id="h2h" className="mb-2 font-display text-lg font-bold">Head to head</h2>
        <ul className="card divide-y divide-border">
          {Array.from(h2h.entries()).map(([oid, r]) => (
            <li key={oid}><Link href={`/teams/${oid}`} className="flex items-center justify-between p-3"><span className="flex items-center gap-2"><TeamDot color={r.color} /> <span className="font-semibold">{r.name}</span></span><span className="font-bold tabular">{r.w}–{r.l}</span></Link></li>
          ))}
        </ul>
      </section>

      {played.length > 0 && (
        <section className="mt-6" aria-labelledby="results">
          <h2 id="results" className="mb-2 font-display text-lg font-bold">Results</h2>
          <div className="flex flex-col gap-2">{played.slice().reverse().map((m) => <MatchCard key={m.id} match={m} highlightTeamIds={[id]} showDate />)}</div>
        </section>
      )}
    </>
  );
}
