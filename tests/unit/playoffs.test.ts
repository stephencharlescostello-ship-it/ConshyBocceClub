import { describe, it, expect } from "vitest";
import { firstRoundPairs, roundName, seedBracket } from "@/lib/engine/playoffs";
import { computeStandings, type MatchResult } from "@/lib/engine/standings";

const T = ["A", "B", "C", "D", "E", "F"].map((id) => ({ id, name: id }));
function w(home: string, away: string, i: number): MatchResult {
  return { id: `m${i}`, homeTeamId: home, awayTeamId: away, winnerTeamId: home, homeGames: 2, awayGames: 0, homePoints: 30, awayPoints: 10 + i, status: "confirmed", scheduledAt: new Date(2026, 8, i).toISOString() };
}

describe("playoff seeding", () => {
  it("seeds 1v4 and 2v3 from the tiebroken standings", () => {
    const rows = computeStandings(T, [w("A", "F", 1), w("A", "E", 2), w("A", "D", 3), w("B", "F", 4), w("B", "E", 5), w("C", "F", 6), w("D", "E", 7)]);
    expect(rows.map((r) => r.teamId).slice(0, 4)).toEqual(["A", "B", "C", "D"]);
    const slots = seedBracket(rows, 4);
    const pairs = firstRoundPairs(slots);
    expect(pairs).toHaveLength(2);
    expect(pairs[0].map((s) => s.seed)).toEqual([1, 4]);
    expect(pairs[1].map((s) => s.seed)).toEqual([2, 3]);
    expect(pairs[0][0].teamId).toBe("A");
    expect(pairs[0][1].teamId).toBe("D");
    // the final has two slots (one per finalist); 1v4 feeds slot 1, 2v3 feeds slot 2
    expect(slots.filter((s) => s.round === 2)).toHaveLength(2);
    expect(slots.filter((s) => s.round === 1).map((s) => s.feedsPosition)).toEqual([1, 1, 2, 2]);
    expect(slots.filter((s) => s.round === 2).every((s) => s.feedsPosition === null)).toBe(true);
  });
  it("supports 2 and 8 team brackets and falls back to 4", () => {
    const rows = computeStandings([...T, { id: "G", name: "G" }, { id: "H", name: "H" }], []);
    expect(seedBracket(rows, 8).filter((s) => s.round === 1)).toHaveLength(8);
    expect(seedBracket(rows, 8).filter((s) => s.round === 3)).toHaveLength(2);
    expect(seedBracket(rows, 8).filter((s) => s.round === 2)).toHaveLength(4);
    expect(seedBracket(rows, 2)).toHaveLength(2);
    expect(seedBracket(rows, 5).filter((s) => s.round === 1)).toHaveLength(4);
    expect(seedBracket(rows.slice(0, 1), 4)).toEqual([]);
  });
  it("names rounds", () => {
    expect(roundName(2, 2)).toBe("Final");
    expect(roundName(1, 2)).toBe("Semifinals");
    expect(roundName(1, 3)).toBe("Quarterfinals");
  });
});
