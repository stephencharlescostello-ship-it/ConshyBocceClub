import type { Metadata } from "next";
import Link from "next/link";
import { getActiveSeason } from "@/lib/data/league";
import { getSeasonStandings } from "@/lib/data/standings";
import { computePowerRankings, POWER_FORMULA_TEXT } from "@/lib/engine/power";
import { createClient } from "@/lib/supabase/server";
import { Empty } from "@/components/ui/empty";
import { getViewer } from "@/lib/data/session";
import { signed } from "@/lib/util/strings";

export const metadata: Metadata = { title: "Power rankings" };
export const dynamic = "force-dynamic";

export default async function PowerPage() {
  const [season, viewer] = await Promise.all([getActiveSeason(), getViewer()]);
  if (!season) return <Empty title="No active season" />;
  const standings = await getSeasonStandings(season);
  const rows = computePowerRankings(standings.map((s) => ({ night: s.night.name, rows: s.rows })));
  const supabase = await createClient();
  const { data: blurbs } = await supabase.from("power_rankings").select("team_id, week_number, blurb").eq("season_id", season.id).order("week_number", { ascending: false });
  const blurbFor = (teamId: string) => blurbs?.find((b) => b.team_id === teamId);
  return (
    <>
      <Link href="/standings" className="text-sm font-semibold text-accent">← Standings</Link>
      <h1 className="mt-1 font-display text-3xl font-extrabold">Power rankings</h1>
      <p className="mt-1 text-sm text-muted">All {rows.length} teams across every night. Formula: {POWER_FORMULA_TEXT}</p>
      <ol className="mt-4 flex flex-col gap-2">
        {rows.map((r) => {
          const b = blurbFor(r.teamId);
          const mine = viewer?.teamIds.includes(r.teamId);
          return (
            <li key={r.teamId} className={`card p-3 ${mine ? "border-accent/50" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="w-8 font-display text-2xl font-extrabold text-accent tabular">{r.powerRank}</span>
                <Link href={`/teams/${r.teamId}`} className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.name}</span>
                  <span className="block text-xs text-muted">{r.night} · {r.wins}–{r.losses} · games {r.gamesWon}–{r.gamesLost} · {signed(r.pointDiff)} pts</span>
                </Link>
                <span className="font-bold tabular">{r.score}</span>
              </div>
              {b && <p className="mt-2 border-t border-border pt-2 text-sm text-muted"><span className="font-semibold text-fg">Commish, week {b.week_number}:</span> {b.blurb}</p>}
            </li>
          );
        })}
      </ol>
    </>
  );
}
