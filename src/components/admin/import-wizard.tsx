"use client";
import { useState, useTransition } from "react";
import { analyzeCsv, importCsv } from "@/lib/actions/admin-import";
import type { ImportKind, ImportReport, Mapping } from "@/lib/import/engine";
import type { ResultMapping } from "@/lib/import/results";
import { toast } from "@/components/ui/toast";

type Analysis = Awaited<ReturnType<typeof analyzeCsv>>;

export function ImportWizard({ seasons, defaultSeasonId, templates }: { seasons: { id: string; name: string }[]; defaultSeasonId: string; templates: Record<ImportKind, { col: string; desc: string; required?: boolean }[]> }) {
  const [kind, setKind] = useState<ImportKind>("results");
  const [seasonId, setSeasonId] = useState(defaultSeasonId);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, start] = useTransition();
  const targets = kind === "results" ? ["night", "week", "team", "opponent", "g1", "g1o", "g2", "g2o", "g3", "g3o", "timestamp", "altWeek", "altTeam", "altOpponent", "altWeek2", "altTeam2", "altOpponent2"] : templates[kind].map((t) => t.col);
  const onFile = async (f: File) => { setFileName(f.name); const t = await f.text(); setText(t); setReport(null); start(async () => { const a = await analyzeCsv(kind, t); setAnalysis(a); setMapping(a.mapping as Record<string, string | null>); }); };
  const run = (dryRun: boolean) => start(async () => { const r = await importCsv(kind, seasonId, text, mapping as Mapping | ResultMapping, dryRun); setReport(r); toast(dryRun ? `Dry run: ${r.summary.created} to create, ${r.summary.errors} errors` : `Imported: ${r.summary.created} created, ${r.summary.updated} updated`, r.ok ? "success" : "error"); });
  return (
    <div className="mt-3 flex flex-col gap-4">
      <div className="card flex flex-wrap items-end gap-3 p-4 text-sm">
        <label className="flex flex-col font-semibold">What are you importing?<select value={kind} onChange={(e) => { setKind(e.target.value as ImportKind); setAnalysis(null); setReport(null); }} className="input !min-h-[40px] w-auto py-1"><option value="teams">Teams</option><option value="players">Players / rosters</option><option value="schedule">Schedule</option><option value="results">Past results (Google Form export)</option></select></label>
        <label className="flex flex-col font-semibold">Into season<select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} className="input !min-h-[40px] w-auto py-1">{seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="btn btn-soft !min-h-[40px] cursor-pointer px-3">Choose CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} /></label>
        <a href={`/templates/${kind}.csv`} className="text-accent underline" download>Download {kind} template</a>
        {fileName && <span className="text-muted">{fileName}</span>}
      </div>
      <details className="card p-4 text-sm"><summary className="cursor-pointer font-semibold">Expected columns for {kind}</summary><table className="mt-2 w-full"><tbody>{templates[kind].map((t) => <tr key={t.col} className="border-t border-border"><td className="py-1 font-mono">{t.col}{t.required ? " *" : ""}</td><td className="py-1 text-muted">{t.desc}</td></tr>)}</tbody></table></details>
      {analysis && (
        <div className="card p-4 text-sm">
          <p className="font-semibold">{analysis.rowCount} rows · {analysis.headers.length} columns{analysis.errors.length ? ` · ${analysis.errors.length} parse warnings` : ""}</p>
          <p className="mt-1 text-xs text-muted">Map each field to a column in your file. Detected automatically where possible.</p>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            {targets.map((t) => (
              <label key={t} className="flex items-center justify-between gap-2"><span className="font-mono text-xs">{t}</span><select value={mapping[t] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [t]: e.target.value || null }))} className="input !min-h-[36px] w-60 py-0 text-xs"><option value="">— not mapped —</option>{analysis.headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></label>
            ))}
          </div>
          <details className="mt-2"><summary className="cursor-pointer text-xs text-muted">Preview first rows</summary><div className="overflow-x-auto"><table className="mt-1 text-xs"><thead><tr>{analysis.headers.map((h) => <th key={h} className="px-1 text-left">{h}</th>)}</tr></thead><tbody>{analysis.sample.map((r, i) => <tr key={i} className="border-t border-border">{analysis.headers.map((h) => <td key={h} className="px-1">{r[h]}</td>)}</tr>)}</tbody></table></div></details>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-soft" disabled={pending} onClick={() => run(true)}>{pending ? "Working…" : "Dry run"}</button>
            <button className="btn btn-primary" disabled={pending || !report?.dryRun || !report.ok} onClick={() => { if (confirm("Write these rows to the database?")) run(false); }}>Import for real</button>
            {report && !report.ok && report.dryRun && <span className="self-center text-xs text-danger">Fix the errors (or remove those rows) before importing.</span>}
          </div>
        </div>
      )}
      {report && (
        <div className="card p-4 text-sm">
          <p className="font-semibold">{report.dryRun ? "Dry run" : "Import"} result: {report.summary.created} create · {report.summary.updated} update · {report.summary.skipped} skip · <span className={report.summary.errors ? "text-danger" : ""}>{report.summary.errors} errors</span></p>
          <ul className="mt-2 max-h-96 overflow-y-auto text-xs">{report.rows.map((r, i) => <li key={i} className={`border-t border-border py-1 ${r.status === "error" ? "text-danger" : r.status === "skip" ? "text-muted" : ""}`}>Row {r.row}: {r.message}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
