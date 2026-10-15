"use client";
import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { createTeam, deleteTeam, renameTeam } from "@/lib/actions/admin-teams";
import { updateNight, upsertTable } from "@/lib/actions/admin-seasons";
import { toast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/actions/team";

type Night = { id: string; name: string; weekday: number; start_time: string; slot_times: string[] };
type Team = { id: string; nightId: string; name: string; color: string; joinCode: string; members: { id: string; name: string; role: string; hasAccount: boolean }[] };
const init: ActionState = { ok: false };

function NightForm({ night }: { night: Night }) {
  const [state, action, pending] = useActionState(updateNight.bind(null, night.id), init);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 text-sm">
      <label className="flex flex-col font-semibold">Name<input name="name" defaultValue={night.name} className="input !min-h-[40px] w-32 py-1" /></label>
      <label className="flex flex-col font-semibold">Start<input name="start_time" defaultValue={night.start_time.slice(0, 5)} className="input !min-h-[40px] w-24 py-1" /></label>
      <label className="flex flex-col font-semibold">Slot times<input name="slot_times" defaultValue={night.slot_times.map((s) => s.slice(0, 5)).join(", ")} className="input !min-h-[40px] w-44 py-1" /></label>
      <button className="btn btn-soft !min-h-[40px] px-3" disabled={pending}>Save</button>
      {state.message && <span className={state.ok ? "text-success" : "text-danger"}>{state.message}</span>}
    </form>
  );
}

function NewTeam({ seasonId, nightId }: { seasonId: string; nightId: string }) {
  const [state, action, pending] = useActionState(createTeam.bind(null, seasonId), init);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2 text-sm">
      <input type="hidden" name="night_id" value={nightId} />
      <label className="flex flex-col font-semibold">New team<input name="name" className="input !min-h-[40px] w-44 py-1" placeholder="Team name" required /></label>
      <label className="flex flex-col font-semibold">Color<input name="color" type="color" defaultValue="#2f8f5f" className="input !min-h-[40px] w-14 p-1" /></label>
      <label className="flex flex-col font-semibold">Captain<input name="captain_name" className="input !min-h-[40px] w-36 py-1" placeholder="Name (optional)" /></label>
      <label className="flex flex-col font-semibold">Captain email<input name="captain_email" type="email" className="input !min-h-[40px] w-44 py-1" placeholder="Links their account" /></label>
      <button className="btn btn-primary !min-h-[40px] px-3" disabled={pending}>Add team</button>
      {state.message && <span className={state.ok ? "text-success" : "text-danger"}>{state.message}</span>}
    </form>
  );
}

function TeamRow({ team }: { team: Team }) {
  const [state, action, pending] = useActionState(renameTeam.bind(null, team.id), init);
  const [, start] = useTransition();
  const captain = team.members.find((m) => m.role === "captain");
  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <form action={action} className="flex items-center gap-2">
          <input name="color" type="color" defaultValue={team.color} className="h-8 w-8 rounded border-0 bg-transparent p-0" aria-label="Team color" />
          <input name="name" defaultValue={team.name} className="input !min-h-[40px] w-52 py-1 font-semibold" aria-label="Team name" />
          <button className="btn btn-ghost !min-h-[40px] px-2 text-xs" disabled={pending}>Rename</button>
          {state.message && <span className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</span>}
        </form>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-sm font-bold tracking-widest">{team.joinCode}</span>
          <Link href={`/teams/${team.id}`} className="btn btn-soft !min-h-[36px] px-2">Roster &amp; captain tools</Link>
          <button type="button" className="btn btn-ghost !min-h-[36px] px-2 text-danger" onClick={() => { if (confirm(`Delete ${team.name}?`)) start(async () => { const r = await deleteTeam(team.id); toast(r.ok ? "Deleted" : r.message ?? "Failed", r.ok ? "success" : "error"); }); }}>Delete</button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">Captain: {captain?.name ?? "—"} · {team.members.length} players · {team.members.filter((m) => !m.hasAccount).length} not signed up</p>
    </li>
  );
}

function TableForm({ table }: { table?: { id: string; name: string; active: boolean; token: string } }) {
  const [state, action, pending] = useActionState(upsertTable, init);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="id" value={table?.id ?? ""} />
      <input name="name" defaultValue={table?.name ?? ""} placeholder="Table 3" className="input !min-h-[40px] w-36 py-1" required />
      <label className="flex items-center gap-1 font-semibold"><input type="checkbox" name="active" defaultChecked={table?.active ?? true} className="h-5 w-5" /> Active</label>
      {table && <span className="font-mono text-xs text-subtle">/t/{table.token}</span>}
      <button className="btn btn-soft !min-h-[40px] px-3" disabled={pending}>{table ? "Save" : "Add table"}</button>
      {state.message && <span className={state.ok ? "text-success" : "text-danger"}>{state.message}</span>}
    </form>
  );
}

export function TeamsAdmin({ seasonId, nights, teams, tables }: { seasonId: string; nights: Night[]; teams: Team[]; tables: { id: string; name: string; active: boolean; token: string }[] }) {
  const [open, setOpen] = useState<string | null>(nights[0]?.id ?? null);
  return (
    <div className="mt-4 flex flex-col gap-4">
      {nights.map((n) => (
        <section key={n.id} className="card p-4">
          <button type="button" className="flex w-full items-center justify-between text-left" aria-expanded={open === n.id} onClick={() => setOpen(open === n.id ? null : n.id)}>
            <span className="font-display text-lg font-bold">{n.name} <span className="text-sm font-normal text-muted">· {teams.filter((t) => t.nightId === n.id).length} teams</span></span>
            <span className="text-subtle">{open === n.id ? "−" : "+"}</span>
          </button>
          {open === n.id && (
            <div className="mt-3 flex flex-col gap-3">
              <NightForm night={n} />
              <ul className="flex flex-col gap-2">{teams.filter((t) => t.nightId === n.id).map((t) => <TeamRow key={t.id} team={t} />)}</ul>
              <NewTeam seasonId={seasonId} nightId={n.id} />
            </div>
          )}
        </section>
      ))}
      <section className="card p-4">
        <h2 className="font-display text-lg font-bold">Tables</h2>
        <p className="text-sm text-muted">Each active table gets a QR poster and is used by the schedule generator.</p>
        <ul className="mt-2 flex flex-col gap-2">{tables.map((t) => <li key={t.id}><TableForm table={t} /></li>)}</ul>
        <div className="mt-2"><TableForm /></div>
      </section>
    </div>
  );
}
