"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { validateMatchGames, type Format } from "@/lib/engine/format";
import { adminConfirmNow, adminForfeit, adminResetMatch, adminSetResult, adminVoidMatch, resolveDispute } from "@/lib/actions/admin-results";
import { toast } from "@/components/ui/toast";

export function ResultEditor({ matchId, format, home, away, games: initial, status, openDispute }: { matchId: string; format: Format; home: { id: string; name: string }; away: { id: string; name: string }; games: { home: number; away: number }[]; status: string; openDispute: { id: string; note: string; by: string } | null }) {
  const [games, setGames] = useState(initial.length ? initial : [{ home: format.target_score, away: 0 }, { home: format.target_score, away: 0 }]);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const error = useMemo(() => validateMatchGames(games, format), [games, format]);
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => start(async () => { const r = await fn(); toast(r.message ?? (r.ok ? "Done" : "Failed"), r.ok ? "success" : "error"); if (r.ok) router.refresh(); });
  return (
    <div className="mt-4 flex flex-col gap-4">
      {openDispute && (
        <section className="card border-danger/60 p-4">
          <h2 className="font-display font-bold text-danger">Open dispute from {openDispute.by}</h2>
          <p className="mt-1 text-sm">“{openDispute.note}”</p>
          <p className="mt-2 text-xs text-muted">Uphold keeps the submitted score. Correct uses the scores below. Replay clears everything so the teams play again. Void removes the match from standings.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <button className="btn btn-primary" disabled={pending} onClick={() => run(() => resolveDispute(openDispute.id, "uphold", null, note))}>Uphold</button>
            <button className="btn btn-accent" disabled={pending || Boolean(error)} onClick={() => run(() => resolveDispute(openDispute.id, "correct", games, note))}>Correct to scores below</button>
            <button className="btn btn-soft" disabled={pending} onClick={() => run(() => resolveDispute(openDispute.id, "replay", null, note))}>Order replay</button>
            <button className="btn btn-ghost text-danger" disabled={pending} onClick={() => run(() => resolveDispute(openDispute.id, "void", null, note))}>Void match</button>
          </div>
        </section>
      )}
      <section className="card p-4">
        <h2 className="font-display font-bold">Game scores</h2>
        <table className="mt-2 w-full text-sm">
          <thead className="text-xs uppercase text-subtle"><tr><th className="text-left">Game</th><th className="text-right">{home.name}</th><th className="text-right">{away.name}</th><th /></tr></thead>
          <tbody>
            {games.map((g, i) => (
              <tr key={i} className="border-t border-border">
                <td className="py-1">{i + 1}</td>
                <td className="py-1 text-right"><input inputMode="numeric" className="input !min-h-[40px] w-20 py-1 text-right" value={g.home} aria-label={`Game ${i + 1} ${home.name}`} onChange={(e) => setGames((gs) => gs.map((x, k) => (k === i ? { ...x, home: Number(e.target.value.replace(/\D/g, "")) || 0 } : x)))} /></td>
                <td className="py-1 text-right"><input inputMode="numeric" className="input !min-h-[40px] w-20 py-1 text-right" value={g.away} aria-label={`Game ${i + 1} ${away.name}`} onChange={(e) => setGames((gs) => gs.map((x, k) => (k === i ? { ...x, away: Number(e.target.value.replace(/\D/g, "")) || 0 } : x)))} /></td>
                <td className="py-1 text-right"><button type="button" className="text-xs text-danger" onClick={() => setGames((gs) => gs.filter((_, k) => k !== i))}>remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="btn btn-soft !min-h-[40px] px-3 text-sm" disabled={games.length >= format.games_per_match} onClick={() => setGames((gs) => [...gs, { home: format.target_score, away: 0 }])}>+ Game</button>
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-danger">{error}</p>}
        <label className="mt-3 flex flex-col gap-1 text-sm font-semibold">Note (logged in the audit trail)<input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this change?" /></label>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          <button className="btn btn-primary" disabled={pending || Boolean(error)} onClick={() => run(() => adminSetResult(matchId, games, note))}>Save &amp; confirm result</button>
          {status === "submitted" && <button className="btn btn-accent" disabled={pending} onClick={() => run(() => adminConfirmNow(matchId))}>Confirm as submitted</button>}
          <button className="btn btn-soft" disabled={pending} onClick={() => { if (confirm(`${home.name} forfeits?`)) run(() => adminForfeit(matchId, home.id, note)); }}>Forfeit: {home.name}</button>
          <button className="btn btn-soft" disabled={pending} onClick={() => { if (confirm(`${away.name} forfeits?`)) run(() => adminForfeit(matchId, away.id, note)); }}>Forfeit: {away.name}</button>
          <button className="btn btn-ghost" disabled={pending} onClick={() => { if (confirm("Clear all scores and set the match back to scheduled?")) run(() => adminResetMatch(matchId, note)); }}>Reset to scheduled</button>
          <button className="btn btn-ghost text-danger" disabled={pending} onClick={() => { if (confirm("Void this match? It will not count in standings.")) run(() => adminVoidMatch(matchId, note)); }}>Void</button>
        </div>
      </section>
    </div>
  );
}
