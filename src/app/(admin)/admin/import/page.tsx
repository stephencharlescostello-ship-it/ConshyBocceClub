import type { Metadata } from "next";
import { getActiveSeason, getSeasons } from "@/lib/data/league";
import { ImportWizard } from "@/components/admin/import-wizard";
import { TEMPLATE_COLUMNS } from "@/lib/import/engine";

export const metadata: Metadata = { title: "Import CSV" };
export const dynamic = "force-dynamic";

export default async function ImportAdmin() {
  const [seasons, active] = await Promise.all([getSeasons(), getActiveSeason()]);
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Import CSV</h1>
      <p className="text-sm text-muted">Teams, players, a schedule, or past results (including the league&apos;s Google Form export, which lists every match twice — the importer pairs the two reports and flags disagreements). Always dry-run first.</p>
      <ImportWizard seasons={seasons.map((s) => ({ id: s.id, name: s.name }))} defaultSeasonId={active?.id ?? seasons[0]?.id ?? ""} templates={TEMPLATE_COLUMNS} />
    </>
  );
}
