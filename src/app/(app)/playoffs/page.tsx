import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { getActiveSeason } from "@/lib/data/league";
import { getSeasonStandings } from "@/lib/data/standings";
import { getBrackets } from "@/lib/data/playoffs";
import { Bracket } from "@/components/playoffs/bracket";
import { Empty } from "@/components/ui/empty";
import { getViewer } from "@/lib/data/session";

export const metadata: Metadata = { title: "Playoffs" };
export const dynamic = "force-dynamic";

export default async function PlayoffsPage() {
  const [season, viewer] = await Promise.all([getActiveSeason(), getViewer()]);
  if (!season) return <Empty title="No active season" />;
  const brackets = await getBrackets(season.id);
  const spots = Number((season.playoff_config as { teams_per_night?: number } | null)?.teams_per_night ?? 4);
  if (!brackets.length) {
    const standings = await getSeasonStandings(season);
    return (
      <>
        <h1 className="font-display text-3xl font-extrabold">Playoffs</h1>
        <p className="mt-1 text-muted">After week {season.regular_weeks}, the top {spots} on each night play {spots === 4 ? "1 v 4 and 2 v 3, then a final" : "a single-elimination bracket"}. Projected seeds from today&apos;s standings:</p>
        {viewer?.isAdmin && <Link href="/admin/playoffs" className="btn btn-accent mt-3 w-full">Admin: seed the brackets</Link>}
        <div className="mt-4 flex flex-col gap-3">
          {standings.map((s) => (
            <section key={s.night.id} className="card p-4" aria-label={`${s.night.name} projected seeds`}>
              <h2 className="font-display font-bold">{s.night.name}</h2>
              <ol className="mt-2 flex flex-col gap-1 text-sm">
                {s.rows.slice(0, spots).map((r) => <li key={r.teamId} className="flex items-center gap-2"><span className="w-5 font-bold text-accent">{r.rank}</span><Link href={`/teams/${r.teamId}`} className="font-semibold">{r.name}</Link><span className="text-xs text-muted">{r.wins}–{r.losses}{r.clinched ? " · clinched" : ""}</span></li>)}
              </ol>
              {s.rows.length > spots && <p className="mt-2 text-xs text-subtle">On the bubble: {s.rows.slice(spots, spots + 2).map((r) => r.name).join(", ")}</p>}
            </section>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Playoffs</h1>
      <div className="mt-4 flex flex-col gap-5">
        {brackets.map((b) => (
          <section key={b.id} aria-label={b.name}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">{b.name}</h2>
              {b.championId && <span className="chip bg-accent-soft text-accent"><Trophy className="h-4 w-4" /> Champion</span>}
            </div>
            <Bracket bracket={b} highlightTeamIds={viewer?.teamIds ?? []} />
          </section>
        ))}
      </div>
    </>
  );
}
