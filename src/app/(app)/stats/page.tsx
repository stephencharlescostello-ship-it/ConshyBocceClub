import type { Metadata } from "next";
import Link from "next/link";
import { Flame } from "lucide-react";
import { getActiveSeason, getNights } from "@/lib/data/league";
import { getLeaderboards, type LeaderRow } from "@/lib/data/leaderboards";
import { Empty } from "@/components/ui/empty";

export const metadata: Metadata = { title: "Stats & awards" };
export const dynamic = "force-dynamic";

function Board({ title, rows, unit, href }: { title: string; rows: LeaderRow[]; unit?: string; href?: (r: LeaderRow) => string }) {
  return (
    <section className="card p-4" aria-label={title}>
      <h2 className="font-display font-bold">{title}</h2>
      {rows.length === 0 ? <p className="mt-1 text-sm text-muted">Nothing yet — live-score a match to feed the stats.</p> : (
        <ol className="mt-2 flex flex-col gap-1">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-right font-bold text-subtle">{i + 1}</span>
              {href ? <Link href={href(r)} className="min-w-0 flex-1 truncate font-semibold">{r.name}</Link> : <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>}
              <span className="truncate text-xs text-subtle">{r.sub ?? r.night}</span>
              <span className="font-bold tabular text-accent">{r.value}{unit ?? ""}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default async function StatsPage(props: PageProps<"/stats">) {
  const sp = await props.searchParams;
  const season = await getActiveSeason();
  if (!season) return <Empty title="No active season" />;
  const nights = await getNights(season.id);
  const night = nights.find((n) => n.slug === sp.night) ?? null;
  const lb = await getLeaderboards(season.id, night?.id);
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Stats &amp; awards</h1>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-1 overflow-x-auto px-4" role="tablist" aria-label="Scope">
        <Link href="/stats" role="tab" aria-selected={!night} className={`tap shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${!night ? "bg-accent text-accent-fg" : "bg-elev-2 text-muted"}`}>League</Link>
        {nights.map((n) => <Link key={n.id} href={`/stats?night=${n.slug}`} role="tab" aria-selected={night?.id === n.id} className={`tap shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${night?.id === n.id ? "bg-accent text-accent-fg" : "bg-elev-2 text-muted"}`}>{n.name.slice(0, 3)}</Link>)}
      </div>
      {lb.hangerOfWeek.length > 0 && (
        <section className="card mt-4 border-accent/40 p-4" aria-label="Hanger of the Week">
          <h2 className="flex items-center gap-2 font-display font-bold"><Flame className="h-5 w-5 text-accent" /> Hanger of the Week</h2>
          <p className="mt-1 font-display text-2xl font-extrabold"><Link href={`/players/${lb.hangerOfWeek[0].playerId}`}>{lb.hangerOfWeek[0].name}</Link> <span className="text-base font-semibold text-muted">· {lb.hangerOfWeek[0].hangers} hangers in week {lb.hangerOfWeek[0].week}</span></p>
          {lb.hangerOfWeek.length > 1 && <p className="mt-1 text-xs text-subtle">Previous: {lb.hangerOfWeek.slice(1).map((h) => `Wk ${h.week} ${h.name} (${h.hangers})`).join(" · ")}</p>}
        </section>
      )}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Board title="Hangers — players" rows={lb.playerHangers} href={(r) => `/players/${r.id}`} />
        <Board title="Hangers — teams" rows={lb.teamHangers} href={(r) => `/teams/${r.id}`} />
        <Board title="Points per frame" rows={lb.pointsPerFrame} href={(r) => `/teams/${r.id}`} />
        <Board title="Frame win %" rows={lb.frameWinPct} unit="%" href={(r) => `/teams/${r.id}`} />
        <Board title="Game wins" rows={lb.gameWins} href={(r) => `/teams/${r.id}`} />
        <Board title="Longest match win streak" rows={lb.longestStreak} href={(r) => `/teams/${r.id}`} />
        <Board title="Biggest comebacks (in a game)" rows={lb.biggestComeback} />
      </div>
      <p className="mt-4 text-xs text-subtle">Frame stats come from {lb.liveScoredMatches} live-scored matches; {lb.quickMatches} matches were entered with Quick Entry and count for games, wins and streaks only.</p>
    </>
  );
}
