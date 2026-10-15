"use client";
import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cancelSubRequest, claimSub, confirmSub, createSubRequest } from "@/lib/actions/subs";
import { toast } from "@/components/ui/toast";
import { fmtDateTime } from "@/lib/util/time";
import type { ActionState } from "@/lib/actions/team";

type Req = { id: string; status: string; neededAt: string; note: string | null; teamId: string; teamName: string; teamColor: string; night: string; claimedBy: string | null; claimerName: string | null; matchId: string | null };

export function SubBoard({ me, requests, captainTeams, upcomingMatches, highlight }: { me: { id: string; teamIds: string[]; captainTeamIds: string[]; isAdmin: boolean }; requests: Req[]; captainTeams: { id: string; name: string }[]; upcomingMatches: { id: string; label: string; teamId: string; at: string }[]; highlight: string | null }) {
  const [open, setOpen] = useState(Boolean(highlight && upcomingMatches.some((m) => m.id === highlight)));
  const [state, action, pending] = useActionState(createSubRequest, { ok: false } as ActionState);
  const [busy, start] = useTransition();
  const [matchId, setMatchId] = useState(highlight && upcomingMatches.some((m) => m.id === highlight) ? highlight : "");
  const sel = upcomingMatches.find((m) => m.id === matchId);
  const toLocalInput = (iso: string) => { const d = new Date(iso); const pad = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  return (
    <div className="mt-4 flex flex-col gap-4">
      {captainTeams.length > 0 && (
        !open ? <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus className="h-5 w-5" /> Post a sub request</button> : (
          <form action={action} className="card flex flex-col gap-3 p-4" onSubmit={() => setTimeout(() => setOpen(false), 50)}>
            <p className="font-semibold">Need a sub</p>
            <label className="text-sm font-semibold" htmlFor="team_id">Team</label>
            <select id="team_id" name="team_id" className="input" defaultValue={sel?.teamId ?? captainTeams[0]?.id}>{captainTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <label className="text-sm font-semibold" htmlFor="match_id">Match (optional)</label>
            <select id="match_id" name="match_id" className="input" value={matchId} onChange={(e) => setMatchId(e.target.value)}><option value="">Not tied to a match</option>{upcomingMatches.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
            <label className="text-sm font-semibold" htmlFor="needed_at">When</label>
            <input id="needed_at" name="needed_at" type="datetime-local" className="input" required defaultValue={sel ? toLocalInput(sel.at) : ""} key={sel?.id ?? "none"} />
            <label className="text-sm font-semibold" htmlFor="note">Note</label>
            <input id="note" name="note" className="input" placeholder="e.g. Need one for doubles, 7pm" maxLength={300} />
            {state.message && <p className={`text-sm font-semibold ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
            <div className="flex gap-2"><button className="btn btn-primary flex-1" disabled={pending}>{pending ? "Posting…" : "Post & notify subs"}</button><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button></div>
          </form>
        )
      )}
      {state.ok && state.message && !open && <p className="rounded-xl bg-primary-soft px-4 py-3 text-sm font-semibold">{state.message}</p>}
      {requests.length === 0 && <p className="card p-6 text-center text-muted">No open sub requests. Nice and quiet.</p>}
      <ul className="flex flex-col gap-2">
        {requests.map((r) => {
          const isCaptain = me.captainTeamIds.includes(r.teamId) || me.isAdmin;
          const onTeam = me.teamIds.includes(r.teamId);
          const mineClaim = r.claimedBy === me.id;
          return (
            <li key={r.id} className={`card p-4 ${highlight === r.id ? "border-accent" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold"><span className="h-3 w-3 rounded-full" style={{ background: r.teamColor }} /> {r.teamName}</span>
                <span className={`chip ${r.status === "open" ? "bg-primary-soft text-success" : r.status === "claimed" ? "bg-accent-soft text-accent" : "bg-elev-2 text-muted"}`}>{r.status === "open" ? "Open" : r.status === "claimed" ? "Claimed" : "Confirmed"}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{r.night} · {fmtDateTime(r.neededAt)}</p>
              {r.note && <p className="mt-1 text-sm">{r.note}</p>}
              {r.matchId && <Link href={`/matches/${r.matchId}`} className="text-xs text-accent underline">View match</Link>}
              {r.claimerName && <p className="mt-2 text-sm">{r.status === "confirmed" ? "Sub: " : "Claimed by "}<span className="font-semibold">{r.claimerName}</span></p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status === "open" && !onTeam && <button type="button" className="btn btn-accent flex-1" disabled={busy} onClick={() => start(async () => { const x = await claimSub(r.id); toast(x.message ?? (x.ok ? "Claimed" : "Failed"), x.ok ? "success" : "error"); })}>I can sub</button>}
                {r.status === "claimed" && isCaptain && <><button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => start(async () => { const x = await confirmSub(r.id, true); if (!x.ok) toast(x.message ?? "Failed", "error"); })}>Confirm {r.claimerName?.split(" ")[0]}</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={() => start(async () => { const x = await confirmSub(r.id, false); if (!x.ok) toast(x.message ?? "Failed", "error"); })}>Reopen</button></>}
                {r.status === "claimed" && mineClaim && !isCaptain && <p className="text-sm text-muted">Waiting for the captain to confirm you.</p>}
                {isCaptain && r.status !== "confirmed" && <button type="button" className="btn btn-ghost text-sm text-danger" disabled={busy} onClick={() => start(async () => { await cancelSubRequest(r.id); })}>Cancel request</button>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
