import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { getViewer } from "@/lib/data/session";
import { getActiveSeason, getMatches, getNights, getWeeks } from "@/lib/data/league";
import { MatchCard } from "@/components/match/match-card";
import { Empty } from "@/components/ui/empty";
import { NightTabs } from "@/components/schedule/night-tabs";
import { publicEnv } from "@/lib/env";
import { fmtDate } from "@/lib/util/time";
import { isoWeekday } from "@/lib/util/time";

export const metadata: Metadata = { title: "Schedule" };
export const dynamic = "force-dynamic";

export default async function SchedulePage(props: PageProps<"/schedule">) {
  const sp = await props.searchParams;
  const [viewer, season] = await Promise.all([getViewer(), getActiveSeason()]);
  if (!season) return <Empty title="No active season" />;
  const [nights, weeks] = await Promise.all([getNights(season.id), getWeeks(season.id)]);
  const myTeamIds = viewer?.teamIds ?? [];
  const view = sp.view === "results" ? "results" : sp.view === "week" ? "week" : sp.view === "mine" ? "mine" : "night";
  const todayWd = isoWeekday();
  const nightSlug = typeof sp.night === "string" ? sp.night : (nights.find((n) => n.weekday === todayWd) ?? nights[0])?.slug;
  const night = nights.find((n) => n.slug === nightSlug) ?? nights[0];
  const now = new Date();
  const currentWeek = weeks.filter((w) => new Date(w.starts_on + "T00:00:00-04:00") <= now).slice(-1)[0] ?? weeks[0];
  const weekNumber = typeof sp.week === "string" ? Number(sp.week) : currentWeek?.number ?? 1;
  const week = weeks.find((w) => w.number === weekNumber) ?? currentWeek;

  let matches = [] as Awaited<ReturnType<typeof getMatches>>;
  if (view === "mine" && myTeamIds.length) {
    const all = await Promise.all(myTeamIds.map((t) => getMatches({ seasonId: season.id, teamId: t })));
    matches = all.flat().sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  } else if (view === "results") {
    matches = (await getMatches({ seasonId: season.id, statuses: ["confirmed", "forfeit", "submitted", "disputed"], limit: 300 })).reverse();
  } else if (view === "week" && week) {
    matches = await getMatches({ seasonId: season.id, weekId: week.id });
  } else if (night) {
    matches = await getMatches({ seasonId: season.id, nightId: night.id });
  }
  // group by week (or by night for the week view)
  const groups = new Map<string, typeof matches>();
  for (const m of matches) {
    const key = view === "week" ? (m.night?.name ?? "") : `Week ${m.week?.number ?? "?"}${m.week?.label ? ` · ${m.week.label}` : ""} · ${fmtDate(m.scheduled_at)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }
  const icsUrl = view === "mine" && myTeamIds.length === 1 ? `${publicEnv.siteUrl}/api/ics/team/${myTeamIds[0]}` : night ? `${publicEnv.siteUrl}/api/ics/night/${night.id}` : null;

  return (
    <>
      <div className="flex items-end justify-between gap-2">
        <h1 className="font-display text-3xl font-extrabold">Schedule</h1>
        {icsUrl && (
          <a href={icsUrl.replace(/^https?:/, "webcal:")} className="btn btn-ghost !min-h-[44px] px-3 text-sm" title="Subscribe in your calendar app">
            <CalendarPlus className="h-4 w-4" /> Subscribe
          </a>
        )}
      </div>
      <NightTabs nights={nights.map((n) => ({ slug: n.slug, name: n.name }))} active={view === "night" ? night?.slug ?? "" : view} hasTeam={myTeamIds.length > 0} weeks={weeks.map((w) => w.number)} week={weekNumber} />
      {groups.size === 0 ? (
        <Empty title={view === "mine" ? "No matches for your team yet" : "Nothing scheduled"}>{view === "mine" && !myTeamIds.length ? <Link href="/join" className="font-semibold text-accent underline">Join your team</Link> : "The commissioner hasn't generated this schedule yet."}</Empty>
      ) : (
        Array.from(groups.entries()).map(([label, list]) => (
          <section key={label} className="mt-5" aria-label={label}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-subtle">{label}</h2>
            <div className="flex flex-col gap-2">{list.map((m) => <MatchCard key={m.id} match={m} highlightTeamIds={myTeamIds} showDate={view !== "week" && view !== "night"} />)}</div>
          </section>
        ))
      )}
    </>
  );
}
