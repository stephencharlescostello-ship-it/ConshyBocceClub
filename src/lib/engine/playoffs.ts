import type { StandingRow } from "./standings";

export type BracketSlot = {
  round: number; // 1 = first round
  position: number; // 1-based within round
  seed: number | null;
  teamId: string | null;
  feedsPosition: number | null; // position in next round this slot's winner feeds
};

/**
 * Seeds a single-elimination bracket from standings. Supports 2, 4 or 8 teams
 * (4 by default: 1v4 and 2v3, then a final). Uses the standings order, which
 * already has the tiebreakers applied.
 */
export function seedBracket(rows: StandingRow[], teams = 4): BracketSlot[] {
  const size = [2, 4, 8].includes(teams) ? teams : 4;
  const seeds = rows.slice(0, size);
  if (seeds.length < 2) return [];
  const order = size === 2 ? [1, 2] : size === 4 ? [1, 4, 2, 3] : [1, 8, 4, 5, 2, 7, 3, 6];
  const slots: BracketSlot[] = [];
  const rounds = Math.log2(size);
  for (let i = 0; i < size; i++) {
    const seed = order[i];
    const team = seeds[seed - 1];
    slots.push({ round: 1, position: i + 1, seed, teamId: team?.teamId ?? null, feedsPosition: Math.floor(i / 2) + 1 });
  }
  let count = size / 2;
  for (let r = 2; r <= rounds; r++) {
    for (let p = 1; p <= count; p++) slots.push({ round: r, position: p, seed: null, teamId: null, feedsPosition: r < rounds ? Math.floor((p - 1) / 2) + 1 : null });
    count /= 2;
  }
  return slots;
}

/** Pairs of first-round slot positions that play each other. */
export function firstRoundPairs(slots: BracketSlot[]): [BracketSlot, BracketSlot][] {
  const r1 = slots.filter((s) => s.round === 1).sort((a, b) => a.position - b.position);
  const pairs: [BracketSlot, BracketSlot][] = [];
  for (let i = 0; i < r1.length; i += 2) pairs.push([r1[i], r1[i + 1]]);
  return pairs;
}

export function roundName(round: number, totalRounds: number): string {
  if (round === totalRounds) return "Final";
  if (round === totalRounds - 1) return "Semifinals";
  if (round === totalRounds - 2) return "Quarterfinals";
  return `Round ${round}`;
}
