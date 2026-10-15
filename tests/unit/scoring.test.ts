import { describe, it, expect } from "vitest";
import { DEFAULT_FORMAT, type Format } from "@/lib/engine/format";
import { EMPTY_PENDING, ScoringError, addWeight, biggestComeback, commitFrame, deriveState, pendingHangers, pendingPoints, removeLastWeight, undoLastFrame, type FrameRecord } from "@/lib/engine/scoring";

let seq = 0;
const id = () => `f${++seq}`;
function score(frames: FrameRecord[], team: "home" | "away", weights: number[], f: Format = DEFAULT_FORMAT) {
  let p = EMPTY_PENDING;
  for (const w of weights) p = addWeight(p, team, w, f);
  return commitFrame(frames, p, f, id()).frames;
}

describe("live scoring", () => {
  it("builds a pending frame from taps and only one side scores", () => {
    let p = addWeight(EMPTY_PENDING, "home", 3, DEFAULT_FORMAT);
    p = addWeight(p, "home", 4, DEFAULT_FORMAT);
    expect(pendingPoints(p)).toBe(7);
    expect(pendingHangers(p, DEFAULT_FORMAT)).toBe(1);
    // switching sides restarts the frame for the other team
    p = addWeight(p, "away", 2, DEFAULT_FORMAT);
    expect(p).toEqual({ team: "away", weights: [2] });
    expect(removeLastWeight(p)).toEqual({ team: null, weights: [] });
  });
  it("rejects weights outside the format and too many weights", () => {
    expect(() => addWeight(EMPTY_PENDING, "home", 5, DEFAULT_FORMAT)).toThrow(ScoringError);
    let p = EMPTY_PENDING;
    for (let i = 0; i < 4; i++) p = addWeight(p, "home", 1, DEFAULT_FORMAT);
    expect(() => addWeight(p, "home", 1, DEFAULT_FORMAT)).toThrow(/4 weights/);
  });
  it("detects game end and rolls to the next game", () => {
    let frames: FrameRecord[] = [];
    frames = score(frames, "home", [3, 3, 3]); // 9
    frames = score(frames, "away", [2]); // 9-2
    frames = score(frames, "home", [3, 3]); // 15-2 → game 1 over
    let s = deriveState(frames, DEFAULT_FORMAT);
    expect(s.games[0].status).toBe("final");
    expect(s.games[0].winner).toBe("home");
    expect(s.currentGame).toBe(2);
    expect(s.homeGames).toBe(1);
    frames = score(frames, "away", [4, 4, 4, 3]); // 15 in one frame with three hangers
    s = deriveState(frames, DEFAULT_FORMAT);
    expect(s.games[1].status).toBe("final");
    expect(s.games[1].frames[0].hangers).toBe(3);
    expect(s.awayGames).toBe(1);
    expect(s.currentGame).toBe(3);
    frames = score(frames, "home", [4, 4, 4, 4]); // 16 — hanger past target still ends the game
    s = deriveState(frames, DEFAULT_FORMAT);
    expect(s.complete).toBe(true);
    expect(s.winner).toBe("home");
    expect(s.homePoints).toBe(31);
    expect(s.awayPoints).toBe(17);
    expect(() => score(frames, "away", [1])).toThrow(/over/);
  });
  it("handles washes (nobody scores)", () => {
    const frames = commitFrame([], EMPTY_PENDING, DEFAULT_FORMAT, id()).frames;
    expect(frames[0].team).toBeNull();
    expect(frames[0].points).toBe(0);
    expect(deriveState(frames, DEFAULT_FORMAT).games[0].frames).toHaveLength(1);
  });
  it("respects win-by-two in live play", () => {
    const f: Format = { ...DEFAULT_FORMAT, win_by_two: true };
    let frames: FrameRecord[] = [];
    frames = score(frames, "home", [3, 3, 3, 3], f); // 12
    frames = score(frames, "away", [3, 3, 3, 3], f); // 12-12
    frames = score(frames, "home", [3], f); // 15-12 → over by 3
    expect(deriveState(frames, f).games[0].status).toBe("final");
    let g2: FrameRecord[] = [];
    g2 = score(g2, "home", [3, 3, 3, 3], f);
    g2 = score(g2, "away", [3, 3, 3, 3], f);
    g2 = score(g2, "away", [2], f); // 12-14
    g2 = score(g2, "home", [3], f); // 15-14 not over
    expect(deriveState(g2, f).games[0].status).toBe("live");
    g2 = score(g2, "home", [1], f); // 16-14 over
    expect(deriveState(g2, f).games[0].status).toBe("final");
  });
  it("undoes the last frame across game boundaries", () => {
    let frames: FrameRecord[] = [];
    frames = score(frames, "home", [4, 4, 4, 3]);
    frames = score(frames, "away", [1]);
    expect(deriveState(frames, DEFAULT_FORMAT).currentGame).toBe(2);
    let u = undoLastFrame(frames);
    expect(u.removed?.gameNumber).toBe(2);
    u = undoLastFrame(u.frames);
    expect(u.removed?.gameNumber).toBe(1);
    expect(u.frames).toHaveLength(0);
    expect(undoLastFrame([]).removed).toBeNull();
  });
  it("measures the biggest comeback", () => {
    let frames: FrameRecord[] = [];
    frames = score(frames, "away", [3, 3, 3]); // 0-9
    frames = score(frames, "away", [2]); // 0-11
    frames = score(frames, "home", [4, 4, 4, 3]); // 15-11
    const s = deriveState(frames, DEFAULT_FORMAT);
    expect(biggestComeback(s.games[0])).toBe(11);
  });
});
