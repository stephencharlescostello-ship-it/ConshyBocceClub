/**
 * Standings and tiebreakers. Pure function so it can be unit-tested and reused by
 * pages, share cards and the playoff seeder. Only confirmed/forfeit results count.
 */
export type Tiebreaker = "win_pct" | "head_to_head" | "game_diff" | "point_diff" | "admin";

export const TIEBREAKER_LABELS: Record<Tiebreaker, string> = {
  win_pct: "match win %",
  head_to_head: "head-to-head",
  game_diff: "game differential",
  point_diff: "point differential",
  admin: "commissioner decision",
};

export type TeamRef = { id: string; name: string };

export type MatchResult = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  winnerTeamId: string | null;
  homeGames: number;
  awayGames: number;
  homePoints: number;
  awayPoints: number;
  status: "confirmed" | "forfeit";
  scheduledAt: string; // ISO
  forfeitTeamId?: string | null;
};

export type StandingRow = {
  rank: number;
  teamId: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  winPct: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  forfeits: number;
  streak: string; // "W3", "L2" or "—"
  last5: ("W" | "L")[];
  /** Why this team sits above the next one when records were tied. */
  tiebreakNote: string | null;
  clinched?: boolean;
  eliminated?: boolean;
};

type Stats = Omit<StandingRow, "rank" | "tiebreakNote" | "clinched" | "eliminated">;

function emptyStats(t: TeamRef): Stats {
  return { teamId: t.id, name: t.name, played: 0, wins: 0, losses: 0, winPct: 0, gamesWon: 0, gamesLost: 0, gameDiff: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0, forfeits: 0, streak: "—", last5: [] };
}

function accumulate(teams: TeamRef[], matches: MatchResult[]): Map<string, Stats> {
  const map = new Map<string, Stats>();
  for (const t of teams) map.set(t.id, emptyStats(t));
  const results = new Map<string, ("W" | "L")[]>();
  const sorted = matches.slice().sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  for (const m of sorted) {
    if (!m.winnerTeamId) continue;
    for (const side of ["home", "away"] as const) {
      const id = side === "home" ? m.homeTeamId : m.awayTeamId;
      const s = map.get(id);
      if (!s) continue;
      const won = m.winnerTeamId === id;
      s.played++;
      if (won) s.wins++;
      else s.losses++;
      s.gamesWon += side === "home" ? m.homeGames : m.awayGames;
      s.gamesLost += side === "home" ? m.awayGames : m.homeGames;
      s.pointsFor += side === "home" ? m.homePoints : m.awayPoints;
      s.pointsAgainst += side === "home" ? m.awayPoints : m.homePoints;
      if (m.forfeitTeamId === id) s.forfeits++;
      if (!results.has(id)) results.set(id, []);
      results.get(id)!.push(won ? "W" : "L");
    }
  }
  for (const s of map.values()) {
    s.winPct = s.played ? s.wins / s.played : 0;
    s.gameDiff = s.gamesWon - s.gamesLost;
    s.pointDiff = s.pointsFor - s.pointsAgainst;
    const r = results.get(s.teamId) ?? [];
    s.last5 = r.slice(-5);
    if (r.length) {
      const last = r[r.length - 1];
      let n = 0;
      for (let i = r.length - 1; i >= 0 && r[i] === last; i--) n++;
      s.streak = `${last}${n}`;
    }
  }
  return map;
}

function headToHead(ids: string[], matches: MatchResult[]): Map<string, number> {
  // win % among matches between the tied teams only
  const set = new Set(ids);
  const w = new Map<string, { w: number; p: number }>();
  for (const id of ids) w.set(id, { w: 0, p: 0 });
  for (const m of matches) {
    if (!m.winnerTeamId || !set.has(m.homeTeamId) || !set.has(m.awayTeamId)) continue;
    w.get(m.homeTeamId)!.p++;
    w.get(m.awayTeamId)!.p++;
    w.get(m.winnerTeamId)!.w++;
  }
  const out = new Map<string, number>();
  for (const [id, v] of w) out.set(id, v.p ? v.w / v.p : -1);
  return out;
}

/**
 * Orders a group of tied teams by applying the tiebreakers in order. Returns ordered ids
 * and, for each id, the tiebreaker that separated it from the team below it (if any).
 */
function breakTies(ids: string[], stats: Map<string, Stats>, matches: MatchResult[], tiebreakers: Tiebreaker[], adminOrder: Record<string, number>, depth = 0): { id: string; note: string | null }[] {
  if (ids.length === 1) return [{ id: ids[0], note: null }];
  for (const tb of tiebreakers) {
    if (tb === "win_pct") continue; // already applied to form the group
    let key: (id: string) => number;
    if (tb === "head_to_head") {
      const h2h = headToHead(ids, matches);
      key = (id) => h2h.get(id) ?? -1;
    } else if (tb === "game_diff") key = (id) => stats.get(id)!.gameDiff;
    else if (tb === "point_diff") key = (id) => stats.get(id)!.pointDiff;
    else key = (id) => -(adminOrder[id] ?? Number.MAX_SAFE_INTEGER);

    const values = new Map(ids.map((id) => [id, key(id)]));
    const distinct = new Set(values.values());
    if (distinct.size === 1) continue; // this tiebreaker does not separate anyone
    // Group by value, descending
    const groups = Array.from(distinct)
      .sort((a, b) => b - a)
      .map((v) => ids.filter((id) => values.get(id) === v));
    const out: { id: string; note: string | null }[] = [];
    groups.forEach((g, gi) => {
      const sub = breakTies(g, stats, matches, tiebreakers, adminOrder, depth + 1);
      sub.forEach((row, ri) => {
        const isLastInGroup = ri === sub.length - 1;
        const hasNextGroup = gi < groups.length - 1;
        out.push({ id: row.id, note: row.note ?? (isLastInGroup && hasNextGroup ? `Ahead on ${TIEBREAKER_LABELS[tb]}` : null) });
      });
    });
    return out;
  }
  // Nothing separated them: stable alphabetical, flagged for the commissioner
  return ids
    .slice()
    .sort((a, b) => stats.get(a)!.name.localeCompare(stats.get(b)!.name))
    .map((id, i, arr) => ({ id, note: i < arr.length - 1 ? "Still tied — commissioner decision" : null }));
}

export function computeStandings(teams: TeamRef[], matches: MatchResult[], tiebreakers: Tiebreaker[] = ["win_pct", "head_to_head", "game_diff", "point_diff", "admin"], adminOrder: Record<string, number> = {}): StandingRow[] {
  const stats = accumulate(teams, matches);
  const byPct = new Map<number, string[]>();
  for (const s of stats.values()) {
    const k = Math.round(s.winPct * 10000) / 10000;
    if (!byPct.has(k)) byPct.set(k, []);
    byPct.get(k)!.push(s.teamId);
  }
  const ordered: { id: string; note: string | null }[] = [];
  for (const pct of Array.from(byPct.keys()).sort((a, b) => b - a)) {
    const group = byPct.get(pct)!;
    ordered.push(...breakTies(group, stats, matches, tiebreakers, adminOrder));
  }
  return ordered.map((o, i) => ({ ...stats.get(o.id)!, rank: i + 1, tiebreakNote: o.note }));
}

/** Marks clinched / eliminated using remaining matches per team (approximation that ignores tiebreakers). */
export function markPlayoffStatus(rows: StandingRow[], remaining: Record<string, number>, spots: number): StandingRow[] {
  if (rows.length <= spots) return rows.map((r) => ({ ...r, clinched: r.played > 0, eliminated: false }));
  return rows.map((r, i) => {
    const maxOthers = rows.filter((o) => o.teamId !== r.teamId).map((o) => o.wins + (remaining[o.teamId] ?? 0));
    // clinched: even if everyone else wins out, fewer than `spots` teams can finish ahead
    const canPass = maxOthers.filter((w) => w > r.wins).length;
    const clinched = canPass < spots;
    // eliminated: even winning out, at least `spots` teams are already guaranteed more wins
    const guaranteedAhead = rows.filter((o) => o.teamId !== r.teamId && o.wins > r.wins + (remaining[r.teamId] ?? 0)).length;
    const eliminated = guaranteedAhead >= spots;
    void i;
    return { ...r, clinched, eliminated };
  });
}
