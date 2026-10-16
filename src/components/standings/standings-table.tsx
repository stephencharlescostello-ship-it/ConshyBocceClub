"use client";
import { Fragment, useState } from "react";
import Link from "next/link";
import type { StandingRow } from "@/lib/engine/standings";
import { signed } from "@/lib/util/strings";

export function StandingsTable({ rows, highlightTeamIds = [], spots = 4, showClinch = false }: { rows: StandingRow[]; highlightTeamIds?: string[]; spots?: number; showClinch?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-elev-2 text-[11px] uppercase tracking-wider text-muted">
          <tr>
            <th scope="col" className="px-2 py-2 text-left">#</th>
            <th scope="col" className="px-1 py-2 text-left">Team</th>
            <th scope="col" className="whitespace-nowrap px-1 py-2 text-right">W–L</th>
            <th scope="col" className="whitespace-nowrap px-1 py-2 text-right">Games</th>
            <th scope="col" className="whitespace-nowrap px-1 py-2 text-right">+/−</th>
            <th scope="col" className="whitespace-nowrap px-1 py-2 text-right">Strk</th>
            <th scope="col" className="whitespace-nowrap px-2 py-2 text-right">Last 5</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const mine = highlightTeamIds.includes(r.teamId);
            const line = i === spots - 1 && rows.length > spots;
            return (
              <Fragment key={r.teamId}>
                <tr className={`${mine ? "bg-accent-soft" : ""} ${line ? "border-b-2 border-dashed border-accent" : "border-b border-border"}`}>
                  <td className="px-2 py-2">
                    <button className="tap -my-2 flex items-center gap-1 font-bold" aria-expanded={open === r.teamId} aria-label={`Rank ${r.rank}, explain tiebreaker`} onClick={() => setOpen(open === r.teamId ? null : r.teamId)}>
                      {r.rank}
                      {showClinch && r.clinched && <span className="text-success" title="Clinched a playoff spot">✓</span>}
                      {showClinch && r.eliminated && <span className="text-danger" title="Eliminated">✕</span>}
                    </button>
                  </td>
                  <td className="max-w-[7.5rem] px-1 py-2 sm:max-w-[9rem]"><Link href={`/teams/${r.teamId}`} className={`block truncate ${mine ? "font-extrabold text-accent" : "font-semibold"}`}>{r.name}</Link></td>
                  <td className="whitespace-nowrap px-1 py-2 text-right font-bold tabular">{r.wins}–{r.losses}</td>
                  <td className="whitespace-nowrap px-1 py-2 text-right tabular text-muted">{r.gamesWon}–{r.gamesLost}</td>
                  <td className={`whitespace-nowrap px-1 py-2 text-right tabular ${r.pointDiff > 0 ? "text-success" : r.pointDiff < 0 ? "text-danger" : "text-muted"}`}>{signed(r.pointDiff)}</td>
                  <td className="whitespace-nowrap px-1 py-2 text-right tabular text-muted">{r.streak}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <span role="img" className="inline-flex gap-0.5" aria-label={`Last five: ${r.last5.join(" ") || "none"}`}>
                      {r.last5.map((x, k) => <span key={k} className={`inline-block h-2.5 w-2.5 rounded-sm ${x === "W" ? "bg-success" : "bg-danger"}`} />)}
                    </span>
                  </td>
                </tr>
                {open === r.teamId && (
                  <tr className="bg-elev-2">
                    <td colSpan={7} className="px-3 py-2 text-xs text-muted">
                      <span className="font-semibold text-fg">#{r.rank} {r.name}:</span> {r.tiebreakNote ?? (i === 0 ? "Best match win %." : r.winPct !== rows[i - 1].winPct ? "Ranked on match win %." : "Tied on win % with the team above; the team above won the tiebreaker.")}
                      {" "}Win % {Math.round(r.winPct * 1000) / 10}%, games {signed(r.gameDiff)}, points {signed(r.pointDiff)}{r.forfeits ? `, ${r.forfeits} forfeit${r.forfeits > 1 ? "s" : ""}` : ""}.
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
