import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeasonBySlug } from "@/lib/data/league";
import { getSeasonStandings } from "@/lib/data/standings";
import { StandingsTable } from "@/components/standings/standings-table";
import { createClient } from "@/lib/supabase/server";
import { getSeasonRecords } from "@/lib/data/records";

export async function generateMetadata(props: PageProps<"/history/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const s = await getSeasonBySlug(slug);
  return { title: s?.name ?? "Season" };
}
export const dynamic = "force-dynamic";

export default async function SeasonHistoryPage(props: PageProps<"/history/[slug]">) {
  const { slug } = await props.params;
  const season = await getSeasonBySlug(slug);
  if (!season) notFound();
  const [standings, records] = await Promise.all([getSeasonStandings(season), getSeasonRecords(season.id)]);
  const supabase = await createClient();
  const { data: brackets } = await supabase.from("playoff_brackets").select("name, status, champion:teams(id, name)").eq("season_id", season.id);
  const spots = Number((season.playoff_config as { teams_per_night?: number } | null)?.teams_per_night ?? 4);
  return (
    <>
      <Link href="/history" className="text-sm font-semibold text-accent">← History</Link>
      <h1 className="mt-1 font-display text-3xl font-extrabold">{season.name}</h1>
      {season.notes && <p className="mt-1 text-sm text-muted">{season.notes}</p>}
      {brackets?.length ? (
        <ul className="mt-3 flex flex-col gap-1 text-sm">{brackets.map((b, i) => <li key={i}>🏆 {b.name}: {(b.champion as unknown as { name: string } | null)?.name ?? (b.status === "complete" ? "—" : "in progress")}</li>)}</ul>
      ) : null}
      <section className="mt-5" aria-labelledby="records">
        <h2 id="records" className="font-display text-lg font-bold">Season records</h2>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          {records.map((r) => (
            <div key={r.label} className="card p-3"><dt className="text-[11px] uppercase text-subtle">{r.label}</dt><dd className="font-semibold">{r.holder}</dd><dd className="font-display text-xl font-extrabold text-accent">{r.value}</dd></div>
          ))}
          {!records.length && <p className="col-span-2 text-sm text-muted">No records yet.</p>}
        </dl>
      </section>
      {standings.map((s) => (
        <section key={s.night.id} className="mt-6" aria-labelledby={`n-${s.night.id}`}>
          <h2 id={`n-${s.night.id}`} className="mb-2 font-display text-lg font-bold">{s.night.name} — final standings</h2>
          <StandingsTable rows={s.rows} spots={spots} showClinch={false} />
        </section>
      ))}
    </>
  );
}
