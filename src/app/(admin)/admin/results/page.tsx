import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveSeason, getMatches } from "@/lib/data/league";
import { fmtDateTime } from "@/lib/util/time";
import { StatusBadge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Results admin" };
export const dynamic = "force-dynamic";

export default async function ResultsAdmin(props: PageProps<"/admin/results">) {
  const sp = await props.searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "pending";
  const season = await getActiveSeason();
  if (!season) return <p>No active season.</p>;
  const supabase = await createClient();
  const statuses = tab === "pending" ? ["submitted", "live"] : tab === "disputes" ? ["disputed"] : tab === "upcoming" ? ["scheduled", "postponed"] : ["confirmed", "forfeit", "void"];
  const matches = await getMatches({ seasonId: season.id, statuses, limit: 200 });
  const { data: disputes } = await supabase.from("disputes").select("match_id, note, status, opener:player_profiles!disputes_opened_by_fkey(display_name)").eq("status", "open");
  const list = tab === "all" ? matches.slice().reverse() : matches;
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Results &amp; disputes</h1>
      <div className="mt-3 flex gap-1">{[["pending", "Pending"], ["disputes", "Disputes"], ["upcoming", "Upcoming"], ["all", "Played"]].map(([k, l]) => <Link key={k} href={`/admin/results?tab=${k}`} className={`chip ${tab === k ? "bg-accent text-accent-fg" : ""}`}>{l}</Link>)}</div>
      <ul className="mt-4 flex flex-col gap-2">
        {list.map((m) => {
          const d = disputes?.find((x) => x.match_id === m.id);
          return (
            <li key={m.id}>
              <Link href={`/admin/results/${m.id}`} className="card flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span><span className="font-semibold">{m.home?.name ?? "Bye"} vs {m.away?.name ?? "Bye"}</span><span className="block text-xs text-muted">{m.night?.name} · Wk {m.week?.number} · {fmtDateTime(m.scheduled_at)}</span>{d && <span className="block text-xs text-danger">Dispute by {(d.opener as unknown as { display_name: string } | null)?.display_name}: “{d.note}”</span>}</span>
                <span className="flex items-center gap-2"><span className="font-bold tabular">{m.home_games}–{m.away_games}</span><StatusBadge status={m.status} /></span>
              </Link>
            </li>
          );
        })}
        {!list.length && <li className="text-sm text-muted">Nothing here.</li>}
      </ul>
    </>
  );
}
