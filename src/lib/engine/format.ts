/**
 * Season scoring format. Stored as JSON on `seasons.format`; changing it never
 * reinterprets past results because every match is evaluated under its own season.
 */
export type Format = {
  zones: number[];
  hanger_points: number;
  weights_per_side: number;
  target_score: number;
  win_by_two: boolean;
  games_per_match: number;
};

export const DEFAULT_FORMAT: Format = {
  zones: [1, 2, 3],
  hanger_points: 4,
  weights_per_side: 4,
  target_score: 15,
  win_by_two: false,
  games_per_match: 3,
};

export function parseFormat(input: unknown): Format {
  const f = (input ?? {}) as Partial<Record<keyof Format, unknown>>;
  const zones = Array.isArray(f.zones) ? f.zones.map(Number).filter((n) => Number.isInteger(n) && n > 0) : DEFAULT_FORMAT.zones;
  const num = (v: unknown, d: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : d;
  };
  return {
    zones: zones.length ? zones : DEFAULT_FORMAT.zones,
    hanger_points: num(f.hanger_points, DEFAULT_FORMAT.hanger_points, 1, 20),
    weights_per_side: num(f.weights_per_side, DEFAULT_FORMAT.weights_per_side, 1, 8),
    target_score: num(f.target_score, DEFAULT_FORMAT.target_score, 1, 99),
    win_by_two: Boolean(f.win_by_two),
    games_per_match: num(f.games_per_match, DEFAULT_FORMAT.games_per_match, 1, 9),
  };
}

/** Games a team must win to take the match (best-of-N → majority). */
export function gamesNeeded(f: Format): number {
  return Math.floor(f.games_per_match / 2) + 1;
}

export function maxFramePoints(f: Format): number {
  return f.weights_per_side * f.hanger_points;
}

export function isGameOver(home: number, away: number, f: Format): boolean {
  const hi = Math.max(home, away);
  if (f.win_by_two) return hi >= f.target_score && Math.abs(home - away) >= 2;
  return hi >= f.target_score;
}

/** Returns an error message for an impossible final game score, or null when valid. */
export function validateGameScore(home: number, away: number, f: Format, label = "Game"): string | null {
  if (!Number.isInteger(home) || !Number.isInteger(away)) return `${label}: scores must be whole numbers`;
  if (home < 0 || away < 0) return `${label}: scores cannot be negative`;
  if (home === away) return `${label}: a game cannot end tied`;
  const hi = Math.max(home, away);
  const lo = Math.min(home, away);
  if (!f.win_by_two) {
    if (hi !== f.target_score) return `${label}: the winner must have exactly ${f.target_score}`;
    if (lo >= f.target_score) return `${label}: the loser must have fewer than ${f.target_score}`;
    return null;
  }
  if (hi < f.target_score) return `${label}: the winner needs at least ${f.target_score}`;
  if (hi - lo < 2) return `${label}: must win by two`;
  if (hi > f.target_score && hi - lo !== 2) return `${label}: after ${f.target_score} the game ends at a two-point lead`;
  return null;
}

export type GameScore = { home: number; away: number };

/** Validates a full set of final game scores for a match. */
export function validateMatchGames(games: GameScore[], f: Format): string | null {
  if (!games.length) return "Enter at least one game";
  if (games.length > f.games_per_match) return `At most ${f.games_per_match} games per match`;
  const need = gamesNeeded(f);
  let h = 0;
  let a = 0;
  for (let i = 0; i < games.length; i++) {
    if (h >= need || a >= need) return `Game ${i + 1}: the match was already decided`;
    const err = validateGameScore(games[i].home, games[i].away, f, `Game ${i + 1}`);
    if (err) return err;
    if (games[i].home > games[i].away) h++;
    else a++;
  }
  if (h < need && a < need) return `Not enough games: first to ${need} wins the match`;
  return null;
}

export function matchTotals(games: GameScore[]) {
  return games.reduce(
    (acc, g) => {
      if (g.home > g.away) acc.homeGames++;
      else if (g.away > g.home) acc.awayGames++;
      acc.homePoints += g.home;
      acc.awayPoints += g.away;
      return acc;
    },
    { homeGames: 0, awayGames: 0, homePoints: 0, awayPoints: 0 },
  );
}
