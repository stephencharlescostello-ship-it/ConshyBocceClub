import { describe, it, expect } from "vitest";
import { finalScoreLine, milestoneLine, type BotContext } from "@/lib/engine/bot";
import { computePowerRankings } from "@/lib/engine/power";
import { computeStandings } from "@/lib/engine/standings";

const ctx: BotContext = { winner: "Old Pucks", loser: "Lite Work", winnerGames: 2, loserGames: 0, winnerPoints: 30, loserPoints: 11, night: "Monday", week: 3, sweep: true, streak: 4, upset: true, hangers: 3, shutoutGame: true };

describe("league bot", () => {
  it("fills every placeholder and adds flavour tags", () => {
    const line = finalScoreLine(ctx, () => 0);
    expect(line).not.toMatch(/\{/);
    expect(line).toContain("Old Pucks");
    expect(line).toContain("Lite Work");
    expect(line).toMatch(/sweep|Straight games|Two and done/i);
    expect(line).toMatch(/UPSET|Bracket|supposed/);
    expect(line).toMatch(/4 straight|4 in a row|4-match/);
  });
  it("varies with the rng", () => {
    const a = finalScoreLine(ctx, () => 0);
    const b = finalScoreLine(ctx, () => 0.99);
    expect(a).not.toBe(b);
  });
  it("has a forfeit line and milestone line", () => {
    expect(finalScoreLine({ ...ctx, forfeit: true }, () => 0)).toMatch(/forfeit|walkover|No-show/i);
    expect(milestoneLine("Old Pucks", 10, () => 0)).toContain("10");
  });
});

describe("power rankings", () => {
  it("ranks across nights by the documented formula", () => {
    const mon = computeStandings([{ id: "a", name: "A" }, { id: "b", name: "B" }], [{ id: "1", homeTeamId: "a", awayTeamId: "b", winnerTeamId: "a", homeGames: 2, awayGames: 0, homePoints: 30, awayPoints: 5, status: "confirmed", scheduledAt: "2026-09-01" }]);
    const tue = computeStandings([{ id: "c", name: "C" }, { id: "d", name: "D" }], [{ id: "2", homeTeamId: "c", awayTeamId: "d", winnerTeamId: "c", homeGames: 2, awayGames: 1, homePoints: 40, awayPoints: 38, status: "confirmed", scheduledAt: "2026-09-02" }]);
    const rows = computePowerRankings([{ night: "Monday", rows: mon }, { night: "Tuesday", rows: tue }]);
    expect(rows[0].teamId).toBe("a");
    expect(rows[0].powerRank).toBe(1);
    expect(rows[0].score).toBe(50 + 30 + 2 * 25 + 3);
    // team b lost 0-2 by 25 points: 0 + 0 + 2 × (−25) + 0
    expect(rows[rows.length - 1].teamId).toBe("b");
    expect(rows[rows.length - 1].score).toBe(-50);
  });
});
