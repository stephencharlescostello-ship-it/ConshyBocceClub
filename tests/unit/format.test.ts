import { describe, it, expect } from "vitest";
import { DEFAULT_FORMAT, gamesNeeded, isGameOver, matchTotals, parseFormat, validateGameScore, validateMatchGames, type Format } from "@/lib/engine/format";

const WB2: Format = { ...DEFAULT_FORMAT, win_by_two: true };
const ELEVEN: Format = { ...DEFAULT_FORMAT, target_score: 11 };

describe("format", () => {
  it("parses with defaults and clamps nonsense", () => {
    expect(parseFormat(null)).toEqual(DEFAULT_FORMAT);
    expect(parseFormat({ target_score: 11, zones: [1, 2, 3], hanger_points: 4 }).target_score).toBe(11);
    expect(parseFormat({ target_score: -5 }).target_score).toBe(15);
    expect(parseFormat({ zones: [] }).zones).toEqual([1, 2, 3]);
  });
  it("needs a majority of games", () => {
    expect(gamesNeeded(DEFAULT_FORMAT)).toBe(2);
    expect(gamesNeeded({ ...DEFAULT_FORMAT, games_per_match: 5 })).toBe(3);
    expect(gamesNeeded({ ...DEFAULT_FORMAT, games_per_match: 1 })).toBe(1);
  });
  it("ends a game at the target with no win-by-two", () => {
    expect(isGameOver(15, 14, DEFAULT_FORMAT)).toBe(true);
    expect(isGameOver(14, 14, DEFAULT_FORMAT)).toBe(false);
    expect(isGameOver(17, 14, DEFAULT_FORMAT)).toBe(true); // hanger past 15 still ends it
  });
  it("applies win-by-two when enabled", () => {
    expect(isGameOver(15, 14, WB2)).toBe(false);
    expect(isGameOver(16, 14, WB2)).toBe(true);
    expect(isGameOver(15, 13, WB2)).toBe(true);
  });
  it("validates final game scores", () => {
    expect(validateGameScore(15, 9, DEFAULT_FORMAT)).toBeNull();
    expect(validateGameScore(15, 15, DEFAULT_FORMAT)).toMatch(/tied/);
    expect(validateGameScore(16, 9, DEFAULT_FORMAT)).toMatch(/exactly 15/);
    expect(validateGameScore(14, 9, DEFAULT_FORMAT)).toMatch(/exactly 15/);
    expect(validateGameScore(-1, 15, DEFAULT_FORMAT)).toMatch(/negative/);
    expect(validateGameScore(11, 5, ELEVEN)).toBeNull();
    expect(validateGameScore(15, 5, ELEVEN)).toMatch(/exactly 11/);
  });
  it("validates win-by-two scores", () => {
    expect(validateGameScore(15, 14, WB2)).toMatch(/win by two/);
    expect(validateGameScore(16, 14, WB2)).toBeNull();
    expect(validateGameScore(17, 14, WB2)).toMatch(/two-point lead/);
    expect(validateGameScore(15, 12, WB2)).toBeNull();
  });
  it("validates whole matches", () => {
    expect(validateMatchGames([{ home: 15, away: 3 }, { home: 15, away: 9 }], DEFAULT_FORMAT)).toBeNull();
    expect(validateMatchGames([{ home: 15, away: 3 }, { home: 9, away: 15 }, { home: 15, away: 14 }], DEFAULT_FORMAT)).toBeNull();
    expect(validateMatchGames([{ home: 15, away: 3 }], DEFAULT_FORMAT)).toMatch(/Not enough games/);
    expect(validateMatchGames([{ home: 15, away: 3 }, { home: 15, away: 3 }, { home: 15, away: 3 }], DEFAULT_FORMAT)).toMatch(/already decided/);
    expect(validateMatchGames([], DEFAULT_FORMAT)).toMatch(/at least one/);
    expect(validateMatchGames(new Array(4).fill({ home: 15, away: 1 }), DEFAULT_FORMAT)).toMatch(/At most 3/);
  });
  it("sums totals", () => {
    expect(matchTotals([{ home: 15, away: 3 }, { home: 9, away: 15 }, { home: 15, away: 14 }])).toEqual({ homeGames: 2, awayGames: 1, homePoints: 39, awayPoints: 32 });
  });
});
