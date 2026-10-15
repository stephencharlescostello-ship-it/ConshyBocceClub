"use client";
import { useState, useTransition } from "react";
import { generateSchedule, type GeneratePreview } from "@/lib/actions/admin-schedule";
import { toast } from "@/components/ui/toast";

export function ScheduleGenerator({ seasonId, nights }: { seasonId: string; nights: { id: string; name: string; teams: number }[] }) {
  const [sel, setSel] = useState<string[]>(nights.map((n) => n.id));
  const [rounds, setRounds] = useState<1 | 2>(2);
  const [replace, setReplace] = useState(false);
  const [preview, setPreview] = useState<GeneratePreview | null>(null);
  const [pending, start] = useTransition();
  const run = (apply: boolean) => start(async () => {
    const r = await generateSchedule(seasonId, { nightIds: sel, rounds, replace, apply });
    setPreview(r);
    if (!r.ok) toast(r.message ?? "Failed", "error");
    else if (apply) toast("Schedule generated", "success");
  });
  return (
    <section className="card mt-4 p-4">
      <h2 className="font-display text-lg font-bold">Generate round robin</h2>
      <p className="text-sm text-muted">Circle method. Every pair meets once (single) or twice (double). No team plays twice in a week; tables and start times are balanced; odd team counts get a bye.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {nights.map((n) => (
          <label key={n.id} className={`chip cursor-pointer ${sel.includes(n.id) ? "bg-accent text-accent-fg" : ""}`}><input type="checkbox" className="sr-only" checked={sel.includes(n.id)} onChange={() => setSel((s) => (s.includes(n.id) ? s.filter((x) => x !== n.id) : [...s, n.id]))} />{n.name} ({n.teams})</label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 font-semibold">Rounds<select value={rounds} onChange={(e) => setRounds(Number(e.target.value) as 1 | 2)} className="input !min-h-[40px] w-auto py-1"><option value={1}>Single round robin</option><option value={2}>Double round robin</option></select></label>
        <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="h-5 w-5" /> Replace existing unplayed matches</label>
        <button type="button" className="btn btn-soft !min-h-[40px] px-3" disabled={pending || !sel.length} onClick={() => run(false)}>Preview</button>
        <button type="button" className="btn btn-primary !min-h-[40px] px-3" disabled={pending || !sel.length || !preview?.ok} onClick={() => run(true)}>Apply to season</button>
      </div>
      {preview?.ok && (
        <div className="mt-3 flex flex-col gap-2">
          {preview.nights.map((n) => (
            <details key={n.nightId} className="rounded-xl border border-border p-3 text-sm">
              <summary className="cursor-pointer font-semibold">{n.name}: {n.matches.filter((m) => m.away).length} matches over {n.report.weeks} weeks · byes {n.report.byes} · double-booked {n.report.doubleBooked.length} · meetings per pair {Array.from(new Set(n.report.meetingCounts)).join("/") || "—"} · table spread ≤{n.report.maxTableSpread}</summary>
              <table className="mt-2 w-full text-xs"><thead><tr className="text-left text-subtle"><th>Wk</th><th>When</th><th>Home</th><th>Away</th><th>Table</th></tr></thead><tbody>{n.matches.map((m, i) => <tr key={i} className="border-t border-border"><td>{m.week}</td><td>{m.time}</td><td>{m.home}</td><td>{m.away ?? "BYE"}</td><td>{m.table ?? "—"}</td></tr>)}</tbody></table>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
