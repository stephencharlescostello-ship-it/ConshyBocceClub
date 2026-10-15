import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSeasons } from "@/lib/data/league";
import { fmtDate } from "@/lib/util/time";

export const metadata: Metadata = { title: "History" };
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const seasons = await getSeasons();
  const supabase = await createClient();
  const { data: champs } = await supabase.from("awards").select("season_id, details, team:teams(id, name, night:league_nights(name))").eq("kind", "night_champion");
  const { data: records } = await supabase.from("awards").select("season_id, kind, value, details, player:player_profiles(display_name), team:teams(name)").in("kind", ["season_record_hangers", "season_record_streak", "season_record_points"]);
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">History &amp; Hall of Fame</h1>
      <p className="mt-1 text-sm text-muted">Seasons are archived, never deleted.</p>
      <ul className="mt-4 flex flex-col gap-3">
        {seasons.map((s) => {
          const c = (champs ?? []).filter((x) => x.season_id === s.id);
          const r = (records ?? []).filter((x) => x.season_id === s.id);
          return (
            <li key={s.id} className="card p-4">
              <div className="flex items-center justify-between">
                <Link href={`/history/${s.slug}`} className="font-display text-xl font-bold">{s.name}</Link>
                <span className={`chip ${s.status === "active" ? "bg-primary-soft text-success" : "bg-elev-2"}`}>{s.status === "active" ? "In progress" : s.status === "archived" ? "Archived" : "Draft"}</span>
              </div>
              <p className="text-xs text-muted">Started {fmtDate(s.starts_on + "T12:00:00")} · {s.regular_weeks} weeks</p>
              {c.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1">
                  {c.map((x, i) => { const t = x.team as unknown as { id: string; name: string; night: { name: string } | null } | null; return t ? <li key={i} className="flex items-center gap-2 text-sm"><Trophy className="h-4 w-4 text-accent" /> <span className="text-muted">{t.night?.name}:</span> <Link href={`/teams/${t.id}`} className="font-semibold">{t.name}</Link>{(x.details as { record?: string })?.record ? <span className="text-xs text-subtle">({(x.details as { record?: string }).record})</span> : null}</li> : null; })}
                </ul>
              )}
              {r.length > 0 && <ul className="mt-2 text-xs text-muted">{r.map((x, i) => <li key={i}>{x.kind.replace("season_record_", "Most ")}: {(x.player as unknown as { display_name: string } | null)?.display_name ?? (x.team as unknown as { name: string } | null)?.name} ({x.value})</li>)}</ul>}
              <Link href={`/history/${s.slug}`} className="mt-3 inline-block text-sm font-semibold text-accent">Final standings &amp; records →</Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
