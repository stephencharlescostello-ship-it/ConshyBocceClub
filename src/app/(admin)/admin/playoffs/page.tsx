import type { Metadata } from "next";
import { getActiveSeason } from "@/lib/data/league";
import { getBrackets } from "@/lib/data/playoffs";
import { PlayoffsAdminPanel } from "@/components/admin/playoffs-admin";

export const metadata: Metadata = { title: "Playoffs admin" };
export const dynamic = "force-dynamic";

export default async function PlayoffsAdmin() {
  const season = await getActiveSeason();
  if (!season) return <p>No active season.</p>;
  const brackets = await getBrackets(season.id);
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Playoffs</h1>
      <p className="text-sm text-muted">Seeding uses the standings with every tiebreaker (and your commissioner decisions). First-round matches are created in the first playoff week; later rounds are created automatically as results confirm.</p>
      <PlayoffsAdminPanel seasonId={season.id} hasBrackets={brackets.some((b) => b.kind === "night")} hasChampions={brackets.some((b) => b.kind === "champions")} champions={brackets.filter((b) => b.kind === "night" && b.championId).length} />
    </>
  );
}
