import { describe, it, expect } from "vitest";
import { computeStandings, markPlayoffStatus, type MatchResult, type TeamRef } from "@/lib/engine/standings";

const T: TeamRef[] = ["A", "B", "C", "D"].map((id) => ({ id, name: `Team ${id}` }));
let n = 0;
function m(home: string, away: string, hg: number, ag: number, hp: number, ap: number, day = n++): MatchResult {
  return { id: `m${day}`, homeTeamId: home, awayTeamId: away, winnerTeamId: hg > ag ? home : away, homeGames: hg, awayGames: ag, homePoints: hp, awayPoints: ap, status: "confirmed", scheduledAt: new Date(2026, 8, 1 + day).toISOString() };
}

describe("standings", () => {
  it("ranks by match win % first", () => {
    const rows = computeStandings(T, [m("A", "B", 2, 0, 30, 10), m("C", "D", 2, 1, 40, 35), m("A", "C", 2, 1, 40, 38)]);
    // B and D are both 0-1: D lost 1-2 (game diff -1) and sits above B who lost 0-2 (game diff -2)
    expect(rows.map((r) => r.teamId)).toEqual(["A", "C", "D", "B"]);
    expect(rows[0].wins).toBe(2);
    expect(rows[0].winPct).toBe(1);
    expect(rows[1].tiebreakNote).toBeNull();
    expect(rows[2].tiebreakNote).toMatch(/game differential/);
  });
  it("uses head-to-head before differentials", () => {
    // A and B both 1-1; B beat A head to head but A has a better point diff
    const rows = computeStandings(T, [m("A", "B", 0, 2, 20, 30), m("A", "C", 2, 0, 30, 2), m("B", "D", 1, 2, 25, 30), m("C", "D", 0, 2, 5, 30)]);
    const a = rows.find((r) => r.teamId === "A")!;
    const b = rows.find((r) => r.teamId === "B")!;
    expect(b.rank).toBeLessThan(a.rank);
    expect(b.tiebreakNote).toMatch(/head-to-head/);
  });
  it("falls through to game differential, then point differential", () => {
    const rows = computeStandings(T, [m("A", "C", 2, 0, 30, 10), m("B", "D", 2, 1, 40, 30)]);
    // A and B both 1-0 and never met: A has +2 games vs B +1
    expect(rows[0].teamId).toBe("A");
    expect(rows[0].tiebreakNote).toMatch(/game differential/);
    const rows2 = computeStandings(T, [m("A", "C", 2, 0, 30, 10), m("B", "D", 2, 0, 30, 20)]);
    expect(rows2[0].teamId).toBe("A");
    expect(rows2[0].tiebreakNote).toMatch(/point differential/);
  });
  it("honours a custom tiebreaker order", () => {
    const rows = computeStandings(T, [m("A", "C", 2, 0, 30, 10), m("B", "D", 2, 1, 40, 20)], ["win_pct", "point_diff", "game_diff"]);
    // B has +20 points vs A +20 → tie on point diff, then game diff A (+2) over B (+1)
    expect(rows[0].teamId).toBe("A");
    const rows2 = computeStandings(T, [m("A", "C", 2, 0, 30, 10), m("B", "D", 2, 1, 45, 20)], ["win_pct", "point_diff", "game_diff"]);
    expect(rows2[0].teamId).toBe("B");
    expect(rows2[0].tiebreakNote).toMatch(/point differential/);
  });
  it("uses the admin decision as the last resort and flags unresolved ties", () => {
    const games = [m("A", "C", 2, 0, 30, 10), m("B", "D", 2, 0, 30, 10)];
    const flagged = computeStandings(T, games);
    expect(flagged[0].tiebreakNote).toMatch(/commissioner/);
    const decided = computeStandings(T, games, undefined, { B: 1, A: 2 });
    expect(decided[0].teamId).toBe("B");
    expect(decided[0].tiebreakNote).toMatch(/commissioner decision/);
  });
  it("computes streaks and last five", () => {
    const rows = computeStandings(T, [m("A", "B", 2, 0, 30, 10, 1), m("A", "C", 2, 0, 30, 10, 2), m("A", "D", 0, 2, 10, 30, 3), m("A", "B", 2, 1, 30, 10, 4), m("A", "C", 2, 0, 30, 10, 5), m("A", "D", 2, 0, 30, 10, 6)]);
    const a = rows.find((r) => r.teamId === "A")!;
    expect(a.streak).toBe("W3");
    expect(a.last5).toEqual(["W", "L", "W", "W", "W"]);
    const d = rows.find((r) => r.teamId === "D")!;
    expect(d.streak).toBe("L1");
  });
  it("counts forfeits", () => {
    const f: MatchResult = { ...m("A", "B", 2, 0, 30, 0), status: "forfeit", forfeitTeamId: "B" };
    const rows = computeStandings(T, [f]);
    expect(rows.find((r) => r.teamId === "B")!.forfeits).toBe(1);
  });
  it("marks clinched and eliminated", () => {
    const rows = computeStandings(T, [m("A", "B", 2, 0, 30, 10), m("A", "C", 2, 0, 30, 10), m("A", "D", 2, 0, 30, 10), m("B", "C", 2, 0, 30, 10)]);
    const marked = markPlayoffStatus(rows, { A: 0, B: 0, C: 0, D: 0 }, 2);
    expect(marked.find((r) => r.teamId === "A")!.clinched).toBe(true);
    expect(marked.find((r) => r.teamId === "D")!.eliminated).toBe(true);
    const open = markPlayoffStatus(rows, { A: 3, B: 3, C: 3, D: 3 }, 2);
    expect(open.find((r) => r.teamId === "D")!.eliminated).toBe(false);
  });
});
