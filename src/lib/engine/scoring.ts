import { type Format, gamesNeeded, isGameOver, maxFramePoints } from "./format";

export type Side = "home" | "away";

/** One recorded frame. `id` is generated on the device so retries are idempotent. */
export type FrameRecord = {
  id: string;
  gameNumber: number;
  number: number;
  team: Side | null; // null = wash (nobody scored)
  points: number;
  hangers: number;
  weights: number[];
};

/** The frame currently being built from button taps. */
export type PendingFrame = { team: Side | null; weights: number[] };

export const EMPTY_PENDING: PendingFrame = { team: null, weights: [] };

export type GameState = {
  number: number;
  home: number;
  away: number;
  status: "live" | "final";
  winner: Side | null;
  frames: FrameRecord[];
};

export type MatchScoreState = {
  games: GameState[];
  currentGame: number;
  homeGames: number;
  awayGames: number;
  homePoints: number;
  awayPoints: number;
  complete: boolean;
  winner: Side | null;
};

export class ScoringError extends Error {}

/** Add one weight (zone value or hanger) to the pending frame. Only one side scores per frame. */
export function addWeight(pending: PendingFrame, team: Side, value: number, f: Format): PendingFrame {
  const allowed = new Set([...f.zones, f.hanger_points]);
  if (!allowed.has(value)) throw new ScoringError(`Weight value ${value} is not in this format`);
  if (pending.team && pending.team !== team) {
    // Switching sides starts the frame over for the new side.
    return { team, weights: [value] };
  }
  if (pending.weights.length >= f.weights_per_side) throw new ScoringError(`Only ${f.weights_per_side} weights can score in a frame`);
  return { team, weights: [...pending.weights, value] };
}

export function removeLastWeight(pending: PendingFrame): PendingFrame {
  const weights = pending.weights.slice(0, -1);
  return { team: weights.length ? pending.team : null, weights };
}

export function pendingPoints(pending: PendingFrame): number {
  return pending.weights.reduce((a, b) => a + b, 0);
}

export function pendingHangers(pending: PendingFrame, f: Format): number {
  return pending.weights.filter((w) => w === f.hanger_points).length;
}

/** Derive full match state from the ordered list of frames (the source of truth). */
export function deriveState(frames: FrameRecord[], f: Format): MatchScoreState {
  const need = gamesNeeded(f);
  const games: GameState[] = [];
  const byGame = new Map<number, FrameRecord[]>();
  for (const fr of frames) {
    if (!byGame.has(fr.gameNumber)) byGame.set(fr.gameNumber, []);
    byGame.get(fr.gameNumber)!.push(fr);
  }
  const maxGame = Math.max(1, ...byGame.keys());
  let homeGames = 0;
  let awayGames = 0;
  let homePoints = 0;
  let awayPoints = 0;
  for (let n = 1; n <= maxGame; n++) {
    const list = (byGame.get(n) ?? []).slice().sort((a, b) => a.number - b.number);
    let home = 0;
    let away = 0;
    let status: GameState["status"] = "live";
    let winner: Side | null = null;
    for (const fr of list) {
      if (status === "final") throw new ScoringError(`Game ${n} has frames after it ended`);
      if (fr.team === "home") home += fr.points;
      if (fr.team === "away") away += fr.points;
      if (isGameOver(home, away, f)) {
        status = "final";
        winner = home > away ? "home" : "away";
      }
    }
    if (winner === "home") homeGames++;
    if (winner === "away") awayGames++;
    homePoints += home;
    awayPoints += away;
    games.push({ number: n, home, away, status, winner, frames: list });
  }
  const complete = homeGames >= need || awayGames >= need;
  const last = games[games.length - 1];
  const currentGame = complete ? last.number : last.status === "final" ? last.number + 1 : last.number;
  return {
    games,
    currentGame,
    homeGames,
    awayGames,
    homePoints,
    awayPoints,
    complete,
    winner: complete ? (homeGames > awayGames ? "home" : "away") : null,
  };
}

/** Commit the pending frame as a new frame record. Returns the appended frame list and the record. */
export function commitFrame(frames: FrameRecord[], pending: PendingFrame, f: Format, id: string): { frames: FrameRecord[]; frame: FrameRecord } {
  const state = deriveState(frames, f);
  if (state.complete) throw new ScoringError("The match is over");
  const points = pendingPoints(pending);
  if (points > maxFramePoints(f)) throw new ScoringError(`A frame scores at most ${maxFramePoints(f)}`);
  const gameNumber = state.currentGame;
  const existing = frames.filter((x) => x.gameNumber === gameNumber);
  const frame: FrameRecord = {
    id,
    gameNumber,
    number: existing.length + 1,
    team: points > 0 ? pending.team : null,
    points,
    hangers: pendingHangers(pending, f),
    weights: [...pending.weights],
  };
  return { frames: [...frames, frame], frame };
}

/** Remove the most recent frame (across games). */
export function undoLastFrame(frames: FrameRecord[]): { frames: FrameRecord[]; removed: FrameRecord | null } {
  if (!frames.length) return { frames, removed: null };
  const sorted = frames.slice().sort((a, b) => a.gameNumber - b.gameNumber || a.number - b.number);
  const removed = sorted[sorted.length - 1];
  return { frames: frames.filter((x) => x.id !== removed.id), removed };
}

/** Largest deficit the eventual winner overcame in a game (0 when they never trailed). */
export function biggestComeback(game: GameState): number {
  if (!game.winner) return 0;
  let home = 0;
  let away = 0;
  let worst = 0;
  for (const fr of game.frames) {
    if (fr.team === "home") home += fr.points;
    if (fr.team === "away") away += fr.points;
    const deficit = game.winner === "home" ? away - home : home - away;
    worst = Math.max(worst, deficit);
  }
  return worst;
}
