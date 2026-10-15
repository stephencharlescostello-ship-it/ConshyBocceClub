/**
 * Circle-method round robin with byes for odd team counts, single or double rounds,
 * balanced table assignment and staggered slot times. No team plays twice in a week.
 */
export type ScheduledMatch = {
  week: number;
  homeTeamId: string;
  awayTeamId: string | null; // null = bye
  tableId: string | null;
  slotIndex: number;
};

export type GenerateOptions = {
  rounds: 1 | 2;
  tableIds: string[];
  slotsPerWeek: number; // number of start times (e.g. 3 → 6pm/7pm/8pm)
  /** deterministic rotation of slot/table assignment; defaults to 0 */
  seed?: number;
};

export function generateRoundRobin(teamIds: string[], opts: GenerateOptions): ScheduledMatch[] {
  const teams = teamIds.slice();
  if (teams.length < 2) return [];
  const BYE = "__bye__";
  if (teams.length % 2 === 1) teams.push(BYE);
  const n = teams.length;
  const roundsPerCycle = n - 1;
  const out: ScheduledMatch[] = [];
  const tableCount = new Map<string, Record<string, number>>(); // team → table → count
  const slotCount = new Map<string, Record<number, number>>();
  const homeCount = new Map<string, number>();
  for (const t of teams) {
    tableCount.set(t, {});
    slotCount.set(t, {});
    homeCount.set(t, 0);
  }
  let week = 0;
  for (let cycle = 0; cycle < opts.rounds; cycle++) {
    // standard circle: fix teams[0], rotate the rest
    const rot = teams.slice();
    for (let r = 0; r < roundsPerCycle; r++) {
      week++;
      const pairs: [string, string][] = [];
      for (let i = 0; i < n / 2; i++) {
        const a = rot[i];
        const b = rot[n - 1 - i];
        pairs.push([a, b]);
      }
      // home/away: alternate per round, swap in the second cycle; balance by home count
      const weekMatches: ScheduledMatch[] = [];
      const real = pairs.filter(([a, b]) => a !== BYE && b !== BYE);
      const byes = pairs.filter(([a, b]) => a === BYE || b === BYE);
      // order the real pairs deterministically but rotate so slot times are shared fairly
      const rotateBy = (week - 1 + (opts.seed ?? 0)) % Math.max(1, real.length);
      const rotated = real.slice(rotateBy).concat(real.slice(0, rotateBy));
      rotated.forEach(([a, b], idx) => {
        let home = a;
        let away = b;
        const swap = cycle % 2 === 1;
        if (swap) [home, away] = [away, home];
        // balance home games
        if ((homeCount.get(home) ?? 0) > (homeCount.get(away) ?? 0) + 1) [home, away] = [away, home];
        homeCount.set(home, (homeCount.get(home) ?? 0) + 1);
        const slotIndex = opts.slotsPerWeek > 0 ? idx % opts.slotsPerWeek : 0;
        // pick the table these two teams have used least
        let tableId: string | null = null;
        if (opts.tableIds.length) {
          let best = Infinity;
          for (const t of opts.tableIds) {
            const score = (tableCount.get(home)![t] ?? 0) + (tableCount.get(away)![t] ?? 0);
            if (score < best) {
              best = score;
              tableId = t;
            }
          }
          tableCount.get(home)![tableId!] = (tableCount.get(home)![tableId!] ?? 0) + 1;
          tableCount.get(away)![tableId!] = (tableCount.get(away)![tableId!] ?? 0) + 1;
        }
        slotCount.get(home)![slotIndex] = (slotCount.get(home)![slotIndex] ?? 0) + 1;
        slotCount.get(away)![slotIndex] = (slotCount.get(away)![slotIndex] ?? 0) + 1;
        weekMatches.push({ week, homeTeamId: home, awayTeamId: away, tableId, slotIndex });
      });
      for (const [a, b] of byes) {
        const team = a === BYE ? b : a;
        weekMatches.push({ week, homeTeamId: team, awayTeamId: null, tableId: null, slotIndex: 0 });
      }
      out.push(...weekMatches);
      // rotate: keep rot[0], move last to position 1
      const last = rot.pop()!;
      rot.splice(1, 0, last);
    }
  }
  return out;
}

/** Validation helpers used by tests and the admin preview. */
export function scheduleReport(matches: ScheduledMatch[], teamIds: string[]) {
  const meetings = new Map<string, number>();
  const perWeek = new Map<number, Set<string>>();
  const doubleBooked: string[] = [];
  const tableUse = new Map<string, Record<string, number>>();
  for (const m of matches) {
    if (!perWeek.has(m.week)) perWeek.set(m.week, new Set());
    const wk = perWeek.get(m.week)!;
    for (const t of [m.homeTeamId, m.awayTeamId]) {
      if (!t) continue;
      if (wk.has(t)) doubleBooked.push(`${t} week ${m.week}`);
      wk.add(t);
    }
    if (m.awayTeamId) {
      const key = [m.homeTeamId, m.awayTeamId].sort().join("|");
      meetings.set(key, (meetings.get(key) ?? 0) + 1);
      if (m.tableId) {
        for (const t of [m.homeTeamId, m.awayTeamId]) {
          if (!tableUse.has(t)) tableUse.set(t, {});
          tableUse.get(t)![m.tableId] = (tableUse.get(t)![m.tableId] ?? 0) + 1;
        }
      }
    }
  }
  const pairs: string[] = [];
  for (let i = 0; i < teamIds.length; i++) for (let j = i + 1; j < teamIds.length; j++) pairs.push([teamIds[i], teamIds[j]].sort().join("|"));
  const meetingCounts = pairs.map((p) => meetings.get(p) ?? 0);
  const byes = matches.filter((m) => !m.awayTeamId).length;
  const maxTableSpread = Math.max(0, ...Array.from(tableUse.values()).map((rec) => {
    const v = Object.values(rec);
    return v.length ? Math.max(...v) - Math.min(...v) : 0;
  }));
  return { meetingCounts, doubleBooked, byes, weeks: perWeek.size, maxTableSpread };
}
