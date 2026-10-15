"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gamesNeeded, validateMatchGames, type Format } from "@/lib/engine/format";
import { submitResult } from "@/lib/actions/scoring";
import { toast } from "@/components/ui/toast";
import { Minus, Plus } from "lucide-react";

type Side = { id: string; name: string; roster: { id: string; name: string }[] };

export function QuickEntryForm({ matchId, format, home, away }: { matchId: string; format: Format; home: Side; away: Side }) {
  const [games, setGames] = useState<{ home: number; away: number }[]>([{ home: format.target_score, away: 0 }]);
  const [lineups, setLineups] = useState<Record<number, { home: string[]; away: string[] }>>({});
  const [showLineups, setShowLineups] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const router = useRouter();
  const error = useMemo(() => validateMatchGames(games, format), [games, format]);
  const need = gamesNeeded(format);
  const decided = (() => {
    let h = 0, a = 0;
    for (const g of games) { if (g.home > g.away) h++; else if (g.away > g.home) a++; }
    return h >= need || a >= need;
  })();
  const set = (i: number, side: "home" | "away", v: number) => setGames((gs) => gs.map((g, k) => (k === i ? { ...g, [side]: Math.max(0, Math.min(99, v)) } : g)));
  const Stepper = ({ i, side }: { i: number; side: "home" | "away" }) => (
    <div className="flex items-center gap-1">
      <button type="button" className="btn btn-soft !min-h-[52px] !px-3" aria-label="minus one" onClick={() => set(i, side, games[i][side] - 1)}><Minus className="h-5 w-5" /></button>
      <input inputMode="numeric" pattern="[0-9]*" aria-label={`${side === "home" ? home.name : away.name} game ${i + 1} score`} className="input w-16 text-center text-2xl font-bold" value={games[i][side]} onChange={(e) => set(i, side, Number(e.target.value.replace(/\D/g, "")) || 0)} />
      <button type="button" className="btn btn-soft !min-h-[52px] !px-3" aria-label="plus one" onClick={() => set(i, side, games[i][side] + 1)}><Plus className="h-5 w-5" /></button>
    </div>
  );
  const toggle = (i: number, side: "home" | "away", pid: string) => setLineups((l) => { const cur = l[i] ?? { home: [], away: [] }; const arr = cur[side].includes(pid) ? cur[side].filter((x) => x !== pid) : [...cur[side], pid]; return { ...l, [i]: { ...cur, [side]: arr } }; });
  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex gap-2">
        <button type="button" className="btn btn-soft flex-1" onClick={() => setGames((gs) => gs.map((g) => ({ ...g })).concat([{ home: format.target_score, away: 0 }]).slice(0, format.games_per_match))} disabled={games.length >= format.games_per_match || decided}>+ Add game</button>
        <button type="button" className="btn btn-ghost" onClick={() => setGames((gs) => gs.slice(0, -1))} disabled={games.length <= 1}>Remove last</button>
      </div>
      {games.map((g, i) => (
        <div key={i} className="card p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-subtle">Game {i + 1}</p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate font-semibold text-home">{home.name}</span><Stepper i={i} side="home" /></div>
            <div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate font-semibold text-away">{away.name}</span><Stepper i={i} side="away" /></div>
            <div className="flex gap-1">
              <button type="button" className="chip" onClick={() => setGames((gs) => gs.map((x, k) => (k === i ? { home: format.target_score, away: x.away >= format.target_score ? 0 : x.away } : x)))}>{home.name.split(" ")[0]} wins</button>
              <button type="button" className="chip" onClick={() => setGames((gs) => gs.map((x, k) => (k === i ? { away: format.target_score, home: x.home >= format.target_score ? 0 : x.home } : x)))}>{away.name.split(" ")[0]} wins</button>
            </div>
          </div>
          {showLineups && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {(["home", "away"] as const).map((side) => (
                <div key={side}>
                  <p className="mb-1 font-semibold text-subtle">{side === "home" ? home.name : away.name} lineup</p>
                  <div className="flex flex-wrap gap-1">{(side === "home" ? home.roster : away.roster).map((p) => <button type="button" key={p.id} className={`chip ${(lineups[i]?.[side] ?? []).includes(p.id) ? "bg-accent text-accent-fg" : ""}`} onClick={() => toggle(i, side, p.id)}>{p.name.split(" ")[0]}</button>)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <button type="button" className="text-left text-sm font-semibold text-accent" onClick={() => setShowLineups((s) => !s)}>{showLineups ? "Hide lineups" : "Record who played (optional)"}</button>
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      <button className="btn btn-accent btn-lg" disabled={Boolean(error) || pending} onClick={() => start(async () => {
        const payload = games.map((g, i) => ({ ...g, home_lineup: lineups[i]?.home ?? [], away_lineup: lineups[i]?.away ?? [] }));
        const r = await submitResult({ matchId, games: payload, entryMode: "quick", idempotencyKey: key });
        if (r.ok) { toast("Submitted — the other captain has been asked to confirm", "success"); router.push(`/matches/${matchId}`); } else toast(r.message ?? "Failed", "error");
      })}>{pending ? "Submitting…" : "Submit result"}</button>
      <p className="text-center text-xs text-subtle">Games go to {format.target_score}{format.win_by_two ? ", win by two" : ""}. First to {need} games wins the match.</p>
    </div>
  );
}
