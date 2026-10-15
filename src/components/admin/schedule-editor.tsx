"use client";
import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { createMatch, deleteMatch, postponeMatchAction, swapMatchTeams, updateMatch } from "@/lib/actions/admin-schedule";
import { toast } from "@/components/ui/toast";
import { fmtDateTime } from "@/lib/util/time";
import type { ActionState } from "@/lib/actions/team";

type M = { id: string; scheduledAt: string; status: string; homeId: string | null; awayId: string | null; home: string; away: string; tableId: string | null; week: number };
const init: ActionState = { ok: false };
const toLocal = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

function EditRow({ m, teams, tables }: { m: M; teams: { id: string; name: string }[]; tables: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(updateMatch.bind(null, m.id), init);
  const [, start] = useTransition();
  const locked = ["confirmed", "forfeit", "submitted", "live", "disputed"].includes(m.status);
  return (
    <li className="rounded-xl border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">Wk {m.week} · {m.home} vs {m.away} <span className="chip ml-1">{m.status}</span></span>
        <Link href={`/matches/${m.id}`} className="text-accent underline">Open</Link>
      </div>
      {locked ? <p className="mt-1 text-xs text-muted">{fmtDateTime(m.scheduledAt)} · played matches are edited under Results.</p> : (
        <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs font-semibold">When<input name="scheduled_at" type="datetime-local" defaultValue={toLocal(m.scheduledAt)} className="input !min-h-[40px] py-1" /></label>
          <label className="flex flex-col text-xs font-semibold">Home<select name="home_team_id" defaultValue={m.homeId ?? ""} className="input !min-h-[40px] w-40 py-1">{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="flex flex-col text-xs font-semibold">Away<select name="away_team_id" defaultValue={m.awayId ?? ""} className="input !min-h-[40px] w-40 py-1">{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="flex flex-col text-xs font-semibold">Table<select name="table_id" defaultValue={m.tableId ?? ""} className="input !min-h-[40px] w-28 py-1"><option value="">—</option>{tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="flex items-center gap-1 text-xs font-semibold"><input type="checkbox" name="notify" defaultChecked className="h-5 w-5" /> Notify captains</label>
          <button className="btn btn-soft !min-h-[40px] px-3" disabled={pending}>Save</button>
          <button type="button" className="btn btn-ghost !min-h-[40px] px-2" onClick={() => start(async () => { await swapMatchTeams(m.id); })}>Swap</button>
          <button type="button" className="btn btn-ghost !min-h-[40px] px-2 text-warning" onClick={() => { const note = prompt("Reason (sent to captains):") ?? ""; start(async () => { const r = await postponeMatchAction(m.id, null, note); toast(r.ok ? "Postponed" : r.message ?? "Failed", r.ok ? "success" : "error"); }); }}>Postpone</button>
          <button type="button" className="btn btn-ghost !min-h-[40px] px-2 text-danger" onClick={() => { if (confirm("Delete this match?")) start(async () => { const r = await deleteMatch(m.id); if (!r.ok) toast(r.message ?? "Failed", "error"); }); }}>Delete</button>
          {state.message && <span className={state.ok ? "text-success" : "text-danger"}>{state.message}</span>}
        </form>
      )}
    </li>
  );
}

export function ScheduleEditor({ seasonId, nights, activeNightId, teams, tables, weeks, matches }: { seasonId: string; nights: { id: string; name: string }[]; activeNightId: string; teams: { id: string; name: string }[]; tables: { id: string; name: string }[]; weeks: { id: string; number: number; kind: string }[]; matches: M[] }) {
  const [state, action, pending] = useActionState(createMatch.bind(null, seasonId), init);
  const [week, setWeek] = useState<number | "all">("all");
  const shown = matches.filter((m) => week === "all" || m.week === week);
  return (
    <section className="card mt-4 p-4">
      <h2 className="font-display text-lg font-bold">Edit matches</h2>
      <div className="mt-2 flex flex-wrap gap-1">{nights.map((n) => <Link key={n.id} href={`/admin/schedule?night=${n.id}`} className={`chip ${n.id === activeNightId ? "bg-accent text-accent-fg" : ""}`}>{n.name}</Link>)}</div>
      <label className="mt-2 flex items-center gap-2 text-sm font-semibold">Week<select className="input !min-h-[40px] w-auto py-1" value={week} onChange={(e) => setWeek(e.target.value === "all" ? "all" : Number(e.target.value))}><option value="all">All</option>{weeks.map((w) => <option key={w.id} value={w.number}>Week {w.number}</option>)}</select></label>
      <ul className="mt-3 flex flex-col gap-2">{shown.map((m) => <EditRow key={m.id} m={m} teams={teams} tables={tables} />)}{!shown.length && <li className="text-sm text-muted">No matches for this night yet.</li>}</ul>
      <h3 className="mt-5 font-bold">Add a make-up match</h3>
      <form action={action} className="mt-2 flex flex-wrap items-end gap-2 text-xs">
        <input type="hidden" name="night_id" value={activeNightId} />
        <label className="flex flex-col font-semibold">Week<select name="week_id" className="input !min-h-[40px] py-1">{weeks.map((w) => <option key={w.id} value={w.id}>Week {w.number}</option>)}</select></label>
        <label className="flex flex-col font-semibold">Home<select name="home_team_id" className="input !min-h-[40px] w-40 py-1">{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="flex flex-col font-semibold">Away<select name="away_team_id" className="input !min-h-[40px] w-40 py-1">{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="flex flex-col font-semibold">When<input name="scheduled_at" type="datetime-local" className="input !min-h-[40px] py-1" required /></label>
        <label className="flex flex-col font-semibold">Table<select name="table_id" className="input !min-h-[40px] w-28 py-1"><option value="">—</option>{tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <button className="btn btn-primary !min-h-[40px] px-3" disabled={pending}>Add</button>
        {state.message && <span className={state.ok ? "text-success" : "text-danger"}>{state.message}</span>}
      </form>
    </section>
  );
}
