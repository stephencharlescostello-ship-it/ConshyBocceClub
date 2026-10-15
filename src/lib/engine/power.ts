import type { StandingRow } from "./standings";

/**
 * Power Rankings formula (documented in-app on /standings/power):
 *   score = 50 × match win %  +  30 × game win %  +  2 × point differential per match  +  3 × wins in last 5
 * Teams with no matches played rank last.
 */
export type PowerRow = StandingRow & { night: string; score: number; powerRank: number };

export function computePowerRankings(rowsByNight: { night: string; rows: StandingRow[] }[]): PowerRow[] {
  const all: PowerRow[] = [];
  for (const { night, rows } of rowsByNight) {
    for (const r of rows) {
      const gamePct = r.gamesWon + r.gamesLost ? r.gamesWon / (r.gamesWon + r.gamesLost) : 0;
      const pdPerMatch = r.played ? r.pointDiff / r.played : 0;
      const last5Wins = r.last5.filter((x) => x === "W").length;
      const score = r.played ? 50 * r.winPct + 30 * gamePct + 2 * pdPerMatch + 3 * last5Wins : -1;
      all.push({ ...r, night, score: Math.round(score * 10) / 10, powerRank: 0 });
    }
  }
  all.sort((a, b) => b.score - a.score || b.pointDiff - a.pointDiff || a.name.localeCompare(b.name));
  return all.map((r, i) => ({ ...r, powerRank: i + 1 }));
}

export const POWER_FORMULA_TEXT = "50 × match win % + 30 × game win % + 2 × point differential per match + 3 × wins in the last five matches.";
