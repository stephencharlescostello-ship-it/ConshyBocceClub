import type { Metadata } from "next";
import Link from "next/link";
import { Share2 } from "lucide-react";
import { getViewer } from "@/lib/data/session";
import { getActiveSeason, getNights } from "@/lib/data/league";
import { getSeasonStandings } from "@/lib/data/standings";
import { Empty } from "@/components/ui/empty";
import { StandingsTable } from "@/components/standings/standings-table";
import { isoWeekday } from "@/lib/util/time";
import { TIEBREAKER_LABELS, type Tiebreaker } from "@/lib/engine/standings";
import { seasonTiebreakers } from "@/lib/data/league";

export const metadata: Metadata = { title: "Standings" };
export const dynamic = "force-dynamic";

export default async function StandingsPage(props: PageProps<"/standings">) {
  const sp = await props.searchParams;
  const [viewer, season] = await Promise.all([getViewer(), getActiveSeason()]);
  if (!season) return <Empty title="No active season" />;
  const [nights, standings] = await Promise.all([getNights(season.id), getSeasonStandings(season)]);
  const today = isoWeekday();
  const myNight = viewer?.memberships[0]?.team.night_id;
  const activeSlug = typeof sp.night === "string" ? sp.night : (nights.find((n) => n.id === myNight) ?? nights.find((n) => n.weekday === today) ?? nights[0])?.slug;
  const current = standings.find((s) => s.night.slug === activeSlug) ?? standings[0];
  const spots = Number((season.playoff_config as { teams_per_night?: number } | null)?.teams_per_night ?? 4);
  const totalWeeks = season.regular_weeks;
  const weeksPlayed = Math.max(0, ...current.rows.map((r) => r.played));
  const lateSeason = weeksPlayed >= totalWeeks * 0.6;
  return (
    <>
      <div className="flex items-end justify-between gap-2">
        <h1 className="font-display text-3xl font-extrabold">Standings</h1>
        <Link href="/standings/power" className="text-sm font-semibold text-accent">Power rankings</Link>
      </div>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-1 overflow-x-auto px-4" role="tablist" aria-label="League night">
        {standings.map((s) => (
          <Link key={s.night.id} href={`/standings?night=${s.night.slug}`} role="tab" aria-selected={s.night.slug === current.night.slug} className={`tap shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${s.night.slug === current.night.slug ? "bg-accent text-accent-fg" : "bg-elev-2 text-muted"}`}>
            {s.night.name.slice(0, 3)}
          </Link>
        ))}
      </div>
      <div className="mt-4">
        <StandingsTable rows={current.rows} highlightTeamIds={viewer?.teamIds ?? []} spots={spots} showClinch={lateSeason} />
      </div>
      <p className="mt-3 text-xs text-muted">
        Tap a rank to see which tiebreaker applied. Order: {seasonTiebreakers(season).map((t: Tiebreaker) => TIEBREAKER_LABELS[t]).join(" → ")}. Top {spots} make the playoffs{lateSeason ? "; ✓ clinched, ✕ eliminated" : ""}.
      </p>
      <a href={`/api/cards/standings/${current.night.id}`} className="btn btn-soft mt-4 w-full" target="_blank" rel="noreferrer"><Share2 className="h-5 w-5" /> Share standings card</a>
    </>
  );
}
