"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/data/session";
import { parseCsv } from "@/lib/import/csv";
import { detectMapping, runImport, type ImportKind, type ImportReport, type Mapping } from "@/lib/import/engine";
import { detectResultMapping, type ResultMapping } from "@/lib/import/results";

export async function analyzeCsv(kind: ImportKind, text: string): Promise<{ headers: string[]; rowCount: number; mapping: Mapping | ResultMapping; sample: Record<string, string>[]; errors: string[] }> {
  await requireAdmin();
  const { headers, rows, errors } = parseCsv(text.slice(0, 5_000_000));
  const mapping = kind === "results" ? detectResultMapping(headers) : detectMapping(kind, headers);
  return { headers, rowCount: rows.length, mapping, sample: rows.slice(0, 5), errors };
}

export async function importCsv(kind: ImportKind, seasonId: string, text: string, mapping: Mapping | ResultMapping, dryRun: boolean): Promise<ImportReport> {
  const viewer = await requireAdmin();
  const { rows } = parseCsv(text.slice(0, 5_000_000));
  const report = await runImport(kind, seasonId, rows, mapping, dryRun, viewer.player.id);
  if (!dryRun) { revalidatePath("/", "layout"); }
  return report;
}
