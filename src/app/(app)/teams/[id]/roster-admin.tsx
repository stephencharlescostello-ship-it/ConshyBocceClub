"use client";
import { useActionState, useState, useTransition } from "react";
import { Copy, RefreshCw, UserPlus } from "lucide-react";
import { addRosterPlayer, removeMember, rotateJoinCode, setMemberRole } from "@/lib/actions/roster";
import { toast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/actions/team";

export function RosterAdmin({ teamId, members, joinCode }: { teamId: string; members: { id: string; name: string; role: string }[]; joinCode: string | null }) {
  const [code, setCode] = useState(joinCode);
  const [pending, start] = useTransition();
  const [addState, addAction, adding] = useActionState(addRosterPlayer.bind(null, teamId), { ok: false } as ActionState);
  const [open, setOpen] = useState(false);
  return (
    <div className="card mt-3 flex flex-col gap-3 p-4">
      <p className="font-semibold">Captain tools</p>
      {code && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-elev-2 p-3">
          <div>
            <p className="text-xs uppercase text-subtle">Join code — share with your team</p>
            <p className="font-mono text-2xl font-bold tracking-[0.3em]">{code}</p>
          </div>
          <div className="flex gap-1">
            <button className="tap flex items-center justify-center rounded-lg" aria-label="Copy join code" onClick={async () => { await navigator.clipboard?.writeText(code); toast("Join code copied", "success"); }}><Copy className="h-5 w-5" /></button>
            <button className="tap flex items-center justify-center rounded-lg" aria-label="Generate a new join code" disabled={pending} onClick={() => start(async () => { const r = await rotateJoinCode(teamId); if (r.ok && r.code) { setCode(r.code); toast("New join code generated", "success"); } else toast(r.message ?? "Failed", "error"); })}><RefreshCw className="h-5 w-5" /></button>
          </div>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-semibold">{m.name}</span>
            <span className="flex items-center gap-1">
              <select className="input !min-h-[40px] w-auto py-1 text-sm" value={m.role} aria-label={`Role for ${m.name}`} onChange={(e) => start(async () => { const r = await setMemberRole(teamId, m.id, e.target.value as "captain" | "player" | "sub"); toast(r.ok ? "Role updated" : r.message ?? "Failed", r.ok ? "success" : "error"); })}>
                <option value="captain">Captain</option><option value="player">Player</option><option value="sub">Sub</option>
              </select>
              <button className="btn btn-ghost !min-h-[40px] px-2 text-xs text-danger" onClick={() => { if (confirm(`Remove ${m.name} from the team?`)) start(async () => { const r = await removeMember(teamId, m.id); toast(r.ok ? "Removed" : r.message ?? "Failed", r.ok ? "success" : "error"); }); }}>Remove</button>
            </span>
          </li>
        ))}
      </ul>
      {!open ? (
        <button className="btn btn-soft" onClick={() => setOpen(true)}><UserPlus className="h-5 w-5" /> Add a player by name</button>
      ) : (
        <form action={addAction} className="flex flex-col gap-2">
          <input name="name" className="input" placeholder="Player name" required autoFocus />
          <input name="email" type="email" className="input" placeholder="Email (optional — links their account automatically)" />
          {addState.message && <p className={`text-sm font-semibold ${addState.ok ? "text-success" : "text-danger"}`}>{addState.message}</p>}
          <button className="btn btn-primary" disabled={adding}>{adding ? "Adding…" : "Add to roster"}</button>
        </form>
      )}
    </div>
  );
}
