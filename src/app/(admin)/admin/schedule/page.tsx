import type { Metadata } from "next";
import { getActiveSeason, getMatches, getNights, getTables, getTeams, getWeeks } from "@/lib/data/league";
import { ScheduleGenerator } from "@/components/admin/schedule-generator";
import { ScheduleEditor } from "@/components/admin/schedule-editor";

export const metadata: Metadata = { title: "Schedule admin" };
export const dynamic = "force-dynamic";

export default async function ScheduleAdmin(props: PageProps<"/admin/schedule">) {
  const sp = await props.searchParams;
  const season = await getActiveSeason();
  if (!season) return <p>No active season.</p>;
  const [nights, teams, tables, weeks] = await Promise.all([getNights(season.id), getTeams(season.id), getTables(), getWeeks(season.id)]);
  const nightId = typeof sp.night === "string" ? sp.night : nights[0]?.id;
  const matches = nightId ? await getMatches({ seasonId: season.id, nightId }) : [];
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Schedule</h1>
      <ScheduleGenerator seasonId={season.id} nights={nights.map((n) => ({ id: n.id, name: n.name, teams: teams.filter((t) => t.night_id === n.id).length }))} />
      <ScheduleEditor
        seasonId={season.id}
        nights={nights.map((n) => ({ id: n.id, name: n.name }))}
        activeNightId={nightId ?? ""}
        teams={teams.filter((t) => t.night_id === nightId).map((t) => ({ id: t.id, name: t.name }))}
        tables={tables.map((t) => ({ id: t.id, name: t.name }))}
        weeks={weeks.map((w) => ({ id: w.id, number: w.number, kind: w.kind }))}
        matches={matches.map((m) => ({ id: m.id, scheduledAt: m.scheduled_at, status: m.status, homeId: m.home_team_id, awayId: m.away_team_id, home: m.home?.name ?? "Bye", away: m.away?.name ?? "Bye", tableId: m.table_id, week: m.week?.number ?? 0 }))}
      />
    </>
  );
}
