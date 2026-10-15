"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";
import type { BracketView, SlotView } from "@/lib/data/playoffs";
import { fmtDateTime } from "@/lib/util/time";

function Slot({ s, winner, mine, games }: { s: SlotView; winner: boolean; mine: boolean; games?: number }) {
  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-2 ${winner ? "font-extrabold" : s.teamId ? "" : "text-subtle"} ${mine ? "text-accent" : ""}`}>
      <span className="flex min-w-0 items-center gap-2">
        {s.seed && <span className="w-4 text-xs text-subtle">{s.seed}</span>}
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color ?? "var(--border)" }} />
        <span className="truncate">{s.teamName ?? "TBD"}</span>
      </span>
      {games !== undefined && <span className="tabular">{games}</span>}
    </div>
  );
}

/** Live-updating bracket (re-fetches on any playoff slot or match change). */
export function Bracket({ bracket, highlightTeamIds }: { bracket: BracketView; highlightTeamIds: string[] }) {
  const router = useRouter();
  const [, setTick] = useState(0);
  useEffect(() => {
    const supabase = getBrowserClient();
    const ch = supabase.channel(`bracket:${bracket.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "playoff_slots", filter: `bracket_id=eq.${bracket.id}` }, () => { setTick((t) => t + 1); router.refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `bracket_id=eq.${bracket.id}` }, () => { setTick((t) => t + 1); router.refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [bracket.id, router]);
  return (
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
      {bracket.rounds.map((r) => (
        <div key={r.round} className="flex w-56 shrink-0 flex-col justify-around gap-3">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-subtle">{r.name}</p>
          {r.matches.map((m) => {
            const win = m.match?.winner_team_id ?? null;
            const home = m.match?.home_team_id;
            const gamesFor = (s: SlotView) => (m.match && ["live", "submitted", "confirmed", "disputed"].includes(m.match.status) ? (s.teamId === home ? m.match.home_games : m.match.away_games) : undefined);
            const inner = (
              <div className={`card divide-y divide-border ${m.match?.status === "live" ? "border-danger" : ""}`}>
                <Slot s={m.a} winner={win === m.a.teamId && Boolean(win)} mine={highlightTeamIds.includes(m.a.teamId ?? "")} games={gamesFor(m.a)} />
                <Slot s={m.b} winner={win === m.b.teamId && Boolean(win)} mine={highlightTeamIds.includes(m.b.teamId ?? "")} games={gamesFor(m.b)} />
                <p className="px-3 py-1 text-[11px] text-subtle">{m.match ? (m.match.status === "live" ? "LIVE" : m.match.status === "confirmed" ? "Final" : fmtDateTime(m.match.scheduled_at)) : "Waiting on earlier round"}</p>
              </div>
            );
            return m.match ? <Link key={m.position} href={`/matches/${m.match.id}`}>{inner}</Link> : <div key={m.position}>{inner}</div>;
          })}
        </div>
      ))}
      {bracket.championId && (
        <div className="flex w-40 shrink-0 flex-col justify-center">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-subtle">Champion</p>
          <p className="card mt-2 p-3 text-center font-display font-extrabold">🏆 {bracket.rounds.at(-1)?.matches[0]?.a.teamId === bracket.championId ? bracket.rounds.at(-1)?.matches[0]?.a.teamName : bracket.rounds.at(-1)?.matches[0]?.b.teamName}</p>
        </div>
      )}
    </div>
  );
}
