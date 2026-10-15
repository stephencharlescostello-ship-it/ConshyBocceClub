import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Empty } from "@/components/ui/empty";
import { fmtDate } from "@/lib/util/time";

export const metadata: Metadata = { title: "History & Hall of Fame" };
export const dynamic = "force-dynamic";

type Champion = { season_id: string; details: { night?: string; record?: string } | null; team: { name: string } | null };

export default async function HistoryIndex() {
  const supabase = await createClient();
  const [{ data: seasons }, { data: awards }, { data: brackets }] = await Promise.all([
    supabase.from("seasons").select("id, name, slug, status, starts_on, regular_weeks, notes").neq("status", "draft").order("starts_on", { ascending: false }),
    supabase.from("awards").select("season_id, details, team:teams(name)").eq("kind", "night_champion"),
    supabase.from("playoff_brackets").select("season_id, name, status, champion:teams(name)").eq("status", "complete"),
  ]);
  const champs = new Map<string, Champion[]>();
  for (const a of (awards ?? []) as unknown as Champion[]) champs.set(a.season_id, [...(champs.get(a.season_id) ?? []), a]);
  const playoffChamps = new Map<string, string[]>();
  for (const b of (brackets ?? []) as unknown as { season_id: string; name: string; champion: { name: string } | null }[]) {
    if (b.champion) playoffChamps.set(b.season_id, [...(playoffChamps.get(b.season_id) ?? []), `${b.name}: ${b.champion.name}`]);
  }
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">History & Hall of Fame</h1>
      <p className="mt-1 text-sm text-muted">Every season, past and present. Tap one for its final standings and records.</p>
      {!seasons?.length ? (
        <div className="mt-4"><Empty title="No seasons yet">The first season appears here once the commissioner creates it.</Empty></div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {seasons.map((s) => {
            const nights = champs.get(s.id) ?? [];
            const playoffs = playoffChamps.get(s.id) ?? [];
            return (
              <li key={s.id}>
                <Link href={`/history/${s.slug}`} className="card flex items-center gap-3 p-4">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-display text-lg font-bold">{s.name}</span>
                      {s.status === "active" && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold uppercase text-accent">Current</span>}
                    </span>
                    <span className="block text-xs text-muted">Started {fmtDate(`${s.starts_on}T12:00:00`)} · {s.regular_weeks} weeks</span>
                    {playoffs.length > 0 && <span className="mt-1 block text-sm"><Trophy className="mr-1 inline h-4 w-4 text-accent" />{playoffs.join(" · ")}</span>}
                    {playoffs.length === 0 && nights.length > 0 && (
                      <span className="mt-1 block text-sm text-muted">
                        {nights.map((n) => `${n.details?.night ?? "Night"}: ${n.team?.name ?? "—"}${n.details?.record ? ` (${n.details.record})` : ""}`).join(" · ")}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-subtle" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
