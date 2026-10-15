import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Megaphone, CalendarDays, MessageCircle, Trophy, Gauge } from "lucide-react";
import { getViewer } from "@/lib/data/session";
import { getActiveSeason, getMatches, getNights, type MatchRow } from "@/lib/data/league";
import { getSeasonStandings } from "@/lib/data/standings";
import { createClient } from "@/lib/supabase/server";
import { MatchCard } from "@/components/match/match-card";
import { Countdown } from "@/components/match/countdown";
import { fmtDateTime, fmtTime, inTz, isoWeekday, relative, WEEKDAY_NAMES } from "@/lib/util/time";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { signed } from "@/lib/util/strings";

export const dynamic = "force-dynamic";

export default function TonightPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <Tonight />
    </Suspense>
  );
}

async function Tonight() {
  const [viewer, season] = await Promise.all([getViewer(), getActiveSeason()]);
  const supabase = await createClient();
  if (!season) {
    return <Empty title="No active season yet">The commissioner is setting things up. Check back soon.</Empty>;
  }
  // Lazy auto-confirm (cron is also configured on Vercel)
  await supabase.rpc("auto_confirm_due");
  const nights = await getNights(season.id);
  const now = new Date();
  const weekday = isoWeekday(now);
  const tonight = nights.find((n) => n.weekday === weekday) ?? null;
  const startOfDay = inTz(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = inTz(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const myTeamIds = viewer?.teamIds ?? [];

  const [todayMatches, pinned, nextEvent, latestChat, standings] = await Promise.all([
    tonight ? getMatches({ seasonId: season.id, nightId: tonight.id, from: startOfDay.toISOString(), to: endOfDay.toISOString() }) : Promise.resolve([] as MatchRow[]),
    supabase.from("announcements").select("id, title, body, published_at").eq("pinned", true).or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`).order("published_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("events").select("id, title, starts_at, location, kind").gte("starts_at", now.toISOString()).order("starts_at").limit(1).maybeSingle(),
    viewer ? supabase.from("messages").select("id, body, created_at, is_bot, author:player_profiles!messages_author_id_fkey(display_name), channel:channels!inner(slug, kind, name)").in("channel.kind", ["league", "night"]).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    getSeasonStandings(season),
  ]);

  const myMatchTonight = todayMatches.find((m) => myTeamIds.includes(m.home_team_id ?? "") || myTeamIds.includes(m.away_team_id ?? ""));
  let nextMatch: MatchRow | null = null;
  if (!myMatchTonight && myTeamIds.length) {
    const upcoming = await getMatches({ seasonId: season.id, statuses: ["scheduled", "live", "postponed"], from: now.toISOString(), limit: 40 });
    nextMatch = upcoming.find((m) => myTeamIds.includes(m.home_team_id ?? "") || myTeamIds.includes(m.away_team_id ?? "")) ?? null;
  }
  // league-wide happenings for off nights
  const weekAhead = new Date(now.getTime() + 7 * 86400000);
  const acrossLeague = !tonight || todayMatches.length === 0 ? await getMatches({ seasonId: season.id, from: startOfDay.toISOString(), to: weekAhead.toISOString(), limit: 6 }) : [];
  const recent = await getMatches({ seasonId: season.id, statuses: ["confirmed", "forfeit"], to: now.toISOString(), limit: 200 });
  const recentDesc = recent.slice(-4).reverse();

  const myRows = standings.flatMap((s) => s.rows.map((r) => ({ ...r, night: s.night.name }))).filter((r) => myTeamIds.includes(r.teamId));
  const canScore = (m: MatchRow) => Boolean(viewer && (viewer.isAdmin || viewer.captainTeamIds.includes(m.home_team_id ?? "") || viewer.captainTeamIds.includes(m.away_team_id ?? "") || m.scorekeeper_player_id === viewer.player.id));

  return (
    <div className="flex flex-col gap-5">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wider text-subtle">{WEEKDAY_NAMES[weekday]} · {season.name}</p>
        <h1 className="font-display text-3xl font-extrabold">{tonight ? `${tonight.name} night` : "Tonight"}</h1>
      </section>

      {myMatchTonight && (
        <section className="card border-accent/40 bg-elev p-4 shadow-card" aria-labelledby="mymatch">
          <p id="mymatch" className="text-xs font-semibold uppercase tracking-wider text-accent">Your match tonight</p>
          <p className="mt-1 font-display text-2xl font-extrabold leading-tight">
            {myTeamIds.includes(myMatchTonight.home_team_id ?? "") ? myMatchTonight.away?.name : myMatchTonight.home?.name}
          </p>
          <p className="mt-1 text-muted">
            {myMatchTonight.table?.name ?? "Table TBD"} · {fmtTime(myMatchTonight.scheduled_at)} · {myMatchTonight.status === "live" ? <span className="font-bold text-danger">LIVE</span> : <Countdown to={myMatchTonight.scheduled_at} className="font-semibold text-fg" />}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {["scheduled", "live", "postponed"].includes(myMatchTonight.status) && canScore(myMatchTonight) ? (
              <Link href={`/matches/${myMatchTonight.id}/score`} className="btn btn-accent btn-lg text-2xl">Keep Score</Link>
            ) : (
              <Link href={`/matches/${myMatchTonight.id}`} className="btn btn-primary btn-lg">{myMatchTonight.status === "submitted" ? "Confirm result" : "Watch live"}</Link>
            )}
            {["scheduled", "live"].includes(myMatchTonight.status) && canScore(myMatchTonight) && (
              <Link href={`/matches/${myMatchTonight.id}/quick`} className="btn btn-ghost">Enter final scores instead</Link>
            )}
          </div>
        </section>
      )}

      {!myMatchTonight && nextMatch && (
        <section className="card p-4" aria-labelledby="nextmatch">
          <p id="nextmatch" className="text-xs font-semibold uppercase tracking-wider text-accent">Your next match</p>
          <p className="mt-1 font-display text-xl font-extrabold">{myTeamIds.includes(nextMatch.home_team_id ?? "") ? nextMatch.away?.name : nextMatch.home?.name}</p>
          <p className="text-muted">{fmtDateTime(nextMatch.scheduled_at)} · {nextMatch.table?.name ?? "Table TBD"} · <Countdown to={nextMatch.scheduled_at} className="font-semibold text-fg" /></p>
          <Link href={`/matches/${nextMatch.id}`} className="btn btn-soft mt-3 w-full">Match details</Link>
        </section>
      )}

      {!viewer && (
        <section className="card flex flex-col gap-2 p-4">
          <p className="font-semibold">Playing this season?</p>
          <p className="text-sm text-muted">Sign in to keep score, confirm results and join the trash talk.</p>
          <Link href="/sign-in" className="btn btn-primary">Sign in</Link>
        </section>
      )}

      {tonight && todayMatches.length > 0 && (
        <section aria-labelledby="tonight-matches">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="tonight-matches" className="font-display text-lg font-bold">Tonight&apos;s matches</h2>
            <Link href={`/schedule?night=${tonight.slug}`} className="text-sm font-semibold text-accent">Full schedule</Link>
          </div>
          <div className="flex flex-col gap-2">
            {todayMatches.map((m) => <MatchCard key={m.id} match={m} highlightTeamIds={myTeamIds} />)}
          </div>
        </section>
      )}

      {(!tonight || todayMatches.length === 0) && (
        <section aria-labelledby="across">
          <h2 id="across" className="mb-2 font-display text-lg font-bold">{tonight ? "Nothing scheduled tonight" : "Around the league this week"}</h2>
          {acrossLeague.length ? <div className="flex flex-col gap-2">{acrossLeague.map((m) => <MatchCard key={m.id} match={m} highlightTeamIds={myTeamIds} showDate />)}</div> : <Empty title="The schedule is quiet">Check the Events tab for what&apos;s next.</Empty>}
        </section>
      )}

      {myRows.length > 0 && (
        <section className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Your teams">
          {myRows.map((r) => (
            <Link key={r.teamId} href={`/teams/${r.teamId}`} className="card flex items-center justify-between p-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{r.name}</span>
                <span className="block text-xs text-muted">{r.night} · {r.streak !== "—" ? `Streak ${r.streak}` : "No matches yet"}</span>
              </span>
              <span className="text-right">
                <span className="block font-display text-lg font-extrabold tabular">{r.wins}–{r.losses}</span>
                <span className="block text-xs text-muted">#{r.rank} · {signed(r.pointDiff)}</span>
              </span>
            </Link>
          ))}
        </section>
      )}

      {pinned.data && (
        <Link href="/announcements" className="card flex items-start gap-3 border-accent/40 p-4">
          <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <span className="min-w-0">
            <span className="block font-semibold">{pinned.data.title}</span>
            <span className="line-clamp-2 block text-sm text-muted">{pinned.data.body}</span>
          </span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-2">
        {nextEvent.data && (
          <Link href={`/events/${nextEvent.data.id}`} className="card flex items-center gap-3 p-3">
            <CalendarDays className="h-5 w-5 shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold uppercase tracking-wider text-subtle">Next event</span>
              <span className="block truncate font-semibold">{nextEvent.data.title}</span>
              <span className="block text-sm text-muted">{fmtDateTime(nextEvent.data.starts_at)}</span>
            </span>
            <ChevronRight className="h-5 w-5 text-subtle" />
          </Link>
        )}
        {latestChat.data && (
          <Link href={`/chat/${(latestChat.data.channel as unknown as { slug: string }).slug}`} className="card flex items-center gap-3 p-3">
            <MessageCircle className="h-5 w-5 shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold uppercase tracking-wider text-subtle">Latest trash talk · {(latestChat.data.channel as unknown as { name: string }).name}</span>
              <span className="line-clamp-2 block text-sm"><span className="font-semibold">{latestChat.data.is_bot ? "League Bot" : (latestChat.data.author as unknown as { display_name: string } | null)?.display_name ?? "Someone"}:</span> {latestChat.data.body}</span>
              <span className="block text-xs text-muted">{relative(latestChat.data.created_at)}</span>
            </span>
            <ChevronRight className="h-5 w-5 text-subtle" />
          </Link>
        )}
      </div>

      {recentDesc.length > 0 && (
        <section aria-labelledby="recent">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="recent" className="font-display text-lg font-bold">Recent results</h2>
            <Link href="/schedule?view=results" className="text-sm font-semibold text-accent">All results</Link>
          </div>
          <div className="flex flex-col gap-2">{recentDesc.map((m) => <MatchCard key={m.id} match={m} highlightTeamIds={myTeamIds} showDate />)}</div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link href="/standings" className="card flex items-center gap-2 p-3 font-semibold"><Trophy className="h-5 w-5 text-accent" /> Standings</Link>
        <Link href="/stats" className="card flex items-center gap-2 p-3 font-semibold"><Gauge className="h-5 w-5 text-accent" /> Stats</Link>
      </div>
    </div>
  );
}
