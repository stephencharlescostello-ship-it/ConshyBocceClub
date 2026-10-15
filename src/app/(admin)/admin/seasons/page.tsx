import type { Metadata } from "next";
import Link from "next/link";
import { getSeasons } from "@/lib/data/league";
import { SeasonForm } from "@/components/admin/season-form";
import { setSeasonStatus } from "@/lib/actions/admin-seasons";
import { fmtDate } from "@/lib/util/time";

export const metadata: Metadata = { title: "Seasons" };
export const dynamic = "force-dynamic";

export default async function SeasonsAdmin() {
  const seasons = await getSeasons();
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Seasons &amp; format</h1>
      <ul className="mt-4 flex flex-col gap-2">
        {seasons.map((s) => (
          <li key={s.id} className="card flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <Link href={`/admin/seasons/${s.id}`} className="font-display text-lg font-bold">{s.name}</Link>
              <p className="text-xs text-muted">{s.status} · starts {fmtDate(s.starts_on + "T12:00:00")} · to {(s.format as { target_score?: number }).target_score} · {s.regular_weeks}+{s.playoff_weeks} weeks</p>
            </div>
            <div className="flex gap-2">
              {s.status !== "active" && <form action={async () => { "use server"; await setSeasonStatus(s.id, "active"); }}><button className="btn btn-primary !min-h-[40px] px-3 text-sm">Make active</button></form>}
              {s.status === "active" && <form action={async () => { "use server"; await setSeasonStatus(s.id, "archived"); }}><button className="btn btn-ghost !min-h-[40px] px-3 text-sm">Archive</button></form>}
              <Link href={`/admin/seasons/${s.id}`} className="btn btn-soft !min-h-[40px] px-3 text-sm">Edit</Link>
            </div>
          </li>
        ))}
      </ul>
      <h2 className="mt-8 font-display text-lg font-bold">Create a season</h2>
      <p className="text-sm text-muted">Creates Monday–Friday nights and the week calendar. Then add teams and generate the schedule.</p>
      <SeasonForm mode="create" />
    </>
  );
}
