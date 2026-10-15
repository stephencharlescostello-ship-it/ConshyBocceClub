"use client";
import { useActionState, useMemo, useState } from "react";
import { KeyRound, Search } from "lucide-react";
import { claimRoster, joinWithCode, type ActionState } from "@/lib/actions/team";

const init: ActionState = { ok: false };

export function JoinForms({ spots, alreadyOn }: { spots: { playerId: string; name: string; team: string; night: string }[]; alreadyOn: string[] }) {
  const [codeState, codeAction, codePending] = useActionState(joinWithCode, init);
  const [claimState, claimAction, claimPending] = useActionState(claimRoster, init);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return spots.filter((s) => s.name.toLowerCase().includes(q) || s.team.toLowerCase().includes(q)).slice(0, 12);
  }, [query, spots]);
  return (
    <div className="mt-6 flex flex-col gap-6">
      {alreadyOn.length > 0 && (
        <p className="rounded-xl bg-primary-soft px-4 py-3 text-sm">You&apos;re on <span className="font-semibold">{alreadyOn.join(", ")}</span>. You can join another team on a different night.</p>
      )}
      <form action={codeAction} className="card flex flex-col gap-3 p-4">
        <label htmlFor="code" className="flex items-center gap-2 font-semibold"><KeyRound className="h-5 w-5 text-accent" /> Team join code</label>
        <input id="code" name="code" className="input text-center font-mono text-2xl uppercase tracking-[0.4em]" maxLength={6} autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="ABC123" required />
        {codeState.message && <p role="alert" className="text-sm font-semibold text-danger">{codeState.message}</p>}
        <button className="btn btn-primary btn-lg" disabled={codePending}>{codePending ? "Joining…" : "Join team"}</button>
      </form>
      <div className="card flex flex-col gap-3 p-4">
        <label htmlFor="roster" className="flex items-center gap-2 font-semibold"><Search className="h-5 w-5 text-accent" /> Or claim your name from the roster</label>
        <input id="roster" className="input" placeholder="Start typing your name or team" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query.trim().length >= 2 && filtered.length === 0 && <p className="text-sm text-muted">No unclaimed spots match. Ask your captain for the join code instead.</p>}
        {filtered.length > 0 && (
          <ul className="flex flex-col divide-y divide-border">
            {filtered.map((s) => (
              <li key={s.playerId}>
                <form action={claimAction} className="flex items-center justify-between gap-3 py-2">
                  <input type="hidden" name="player_id" value={s.playerId} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.name}</p>
                    <p className="truncate text-sm text-muted">{s.team} · {s.night}</p>
                  </div>
                  <button className="btn btn-soft !min-h-[44px] px-3 text-sm" disabled={claimPending}>That&apos;s me</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {claimState.message && <p role="alert" className="text-sm font-semibold text-danger">{claimState.message}</p>}
      </div>
    </div>
  );
}
