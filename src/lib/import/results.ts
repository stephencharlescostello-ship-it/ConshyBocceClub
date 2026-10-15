/**
 * Imports match results from the league's Google Form export (one row per team
 * submission, so every match appears twice) or from the simple CBC template
 * (one row per match). Pure functions: used by the admin importer and the seed.
 */
import { type Format, validateMatchGames } from "@/lib/engine/format";

export type RawRow = Record<string, string>;

export type ResultMapping = {
  night: string | null;
  week: string | null; // may contain "Week 3"
  team: string | null;
  opponent: string | null;
  g1: string | null; g1o: string | null;
  g2: string | null; g2o: string | null;
  g3: string | null; g3o: string | null;
  timestamp: string | null;
  // Google Forms put the Wednesday questions in separate columns; these are merged with the primary ones.
  altWeek: string | null; altTeam: string | null; altOpponent: string | null;
};

// PapaParse renames duplicate headers to "Name_1", "Name_2" — strip that suffix for matching.
const H = (h: string) => h.trim().toLowerCase().replace(/_\d+$/, "");

/** Guess a mapping from the header row. Works for the league's current form export out of the box. */
export function detectResultMapping(headers: string[]): ResultMapping {
  const find = (pred: (h: string) => boolean, skip = 0) => {
    let n = 0;
    for (const h of headers) if (pred(H(h))) { if (n === skip) return h; n++; }
    return null;
  };
  return {
    timestamp: find((h) => h.includes("timestamp") || h === "date" || h.includes("played")),
    night: find((h) => h.includes("night") || h === "weekday" || h === "day"),
    week: find((h) => h.includes("week"), 0),
    altWeek: find((h) => h.includes("week"), 1),
    team: find((h) => h === "your team" || h === "team" || h === "home" || h === "home team", 0),
    altTeam: find((h) => h === "your team", 1),
    opponent: find((h) => h.includes("oppos") || h === "away" || h === "away team", 0),
    altOpponent: find((h) => h.includes("oppos"), 1),
    g1: find((h) => h.startsWith("game 1") && (h.includes("your") || h.includes("home"))) ?? find((h) => h === "g1" || h === "game 1 home"),
    g1o: find((h) => h.startsWith("game 1") && (h.includes("oppo") || h.includes("away"))) ?? find((h) => h === "g1 opp" || h === "game 1 away"),
    g2: find((h) => h.startsWith("game 2") && (h.includes("your") || h.includes("home"))) ?? find((h) => h === "g2" || h === "game 2 home"),
    g2o: find((h) => h.startsWith("game 2") && (h.includes("oppo") || h.includes("away"))) ?? find((h) => h === "g2 opp" || h === "game 2 away"),
    g3: find((h) => h.startsWith("game 3") && (h.includes("your") || h.includes("home"))) ?? find((h) => h === "g3" || h === "game 3 home"),
    g3o: find((h) => h.startsWith("game 3") && (h.includes("oppo") || h.includes("away"))) ?? find((h) => h === "g3 opp" || h === "game 3 away"),
  };
}

export type ParsedSubmission = {
  rowIndex: number; // 1-based data row
  night: string;
  week: number;
  team: string;
  opponent: string;
  games: { mine: number; theirs: number }[];
  timestamp: string | null;
  errors: string[];
};

export function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseWeek(s: string | undefined): number | null {
  if (!s) return null;
  const m = String(s).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
export function normalizeNight(s: string | undefined): string | null {
  if (!s) return null;
  const n = normalizeName(s);
  for (const d of WEEKDAYS) if (n.startsWith(d.slice(0, 3))) return d[0].toUpperCase() + d.slice(1);
  return null;
}

export function parseSubmissions(rows: RawRow[], map: ResultMapping): ParsedSubmission[] {
  const out: ParsedSubmission[] = [];
  const get = (r: RawRow, k: string | null) => (k ? (r[k] ?? "").trim() : "");
  rows.forEach((r, i) => {
    const errors: string[] = [];
    const isEmpty = Object.values(r).every((v) => !String(v ?? "").trim());
    if (isEmpty) return;
    const night = normalizeNight(get(r, map.night));
    const week = parseWeek(get(r, map.week)) ?? parseWeek(get(r, map.altWeek));
    const team = get(r, map.team) || get(r, map.altTeam);
    const opponent = get(r, map.opponent) || get(r, map.altOpponent);
    if (!night) errors.push("Missing or unrecognised league night");
    if (!week) errors.push("Missing week number");
    if (!team) errors.push("Missing team");
    if (!opponent) errors.push("Missing opponent");
    if (team && opponent && normalizeName(team) === normalizeName(opponent)) errors.push("Team and opponent are the same");
    const games: { mine: number; theirs: number }[] = [];
    const pairs: [string | null, string | null][] = [[map.g1, map.g1o], [map.g2, map.g2o], [map.g3, map.g3o]];
    pairs.forEach(([a, b], gi) => {
      const sa = get(r, a);
      const sb = get(r, b);
      if (sa === "" && sb === "") return;
      const na = Number(sa);
      const nb = Number(sb);
      if (!Number.isInteger(na) || !Number.isInteger(nb)) errors.push(`Game ${gi + 1}: scores must be whole numbers`);
      else games.push({ mine: na, theirs: nb });
    });
    if (!games.length) errors.push("No game scores");
    out.push({ rowIndex: i + 1, night: night ?? "", week: week ?? 0, team, opponent, games, timestamp: get(r, map.timestamp) || null, errors });
  });
  return out;
}

export type PairedMatch = {
  night: string;
  week: number;
  teamA: string; // the team that reported first (becomes "home")
  teamB: string;
  games: { home: number; away: number }[];
  sources: number[]; // row indexes
  warnings: string[];
  errors: string[];
  forfeitTeam: string | null;
  playedAt: string | null;
};

function sameMatch(a: ParsedSubmission, b: ParsedSubmission) {
  return a.night === b.night && a.week === b.week && normalizeName(a.team) === normalizeName(b.opponent) && normalizeName(a.opponent) === normalizeName(b.team);
}

/**
 * Pairs the two submissions of each match (one from each team). A single submission
 * still imports (with a warning). Conflicting scores become an error on the match.
 */
export function pairSubmissions(subs: ParsedSubmission[], format: Format): PairedMatch[] {
  const used = new Set<number>();
  const out: PairedMatch[] = [];
  for (const a of subs) {
    if (used.has(a.rowIndex) || a.errors.length) continue;
    used.add(a.rowIndex);
    const b = subs.find((x) => !used.has(x.rowIndex) && !x.errors.length && sameMatch(a, x));
    const games = a.games.map((g) => ({ home: g.mine, away: g.theirs }));
    const warnings: string[] = [];
    const errors: string[] = [];
    if (b) {
      used.add(b.rowIndex);
      const mirrored = b.games.map((g) => ({ home: g.theirs, away: g.mine }));
      const same = mirrored.length === games.length && mirrored.every((g, i) => g.home === games[i].home && g.away === games[i].away);
      if (!same) errors.push(`Rows ${a.rowIndex} and ${b.rowIndex} disagree: ${fmtGames(games)} vs ${fmtGames(mirrored)}`);
    } else {
      warnings.push(`Only one team reported this match (row ${a.rowIndex})`);
    }
    // Forfeit heuristic: one side scored zero in every game.
    let forfeitTeam: string | null = null;
    const zeroHome = games.length && games.every((g) => g.home === 0);
    const zeroAway = games.length && games.every((g) => g.away === 0);
    if (zeroHome !== zeroAway && games.length >= Math.floor(format.games_per_match / 2) + 1) {
      forfeitTeam = zeroHome ? a.team : a.opponent;
      warnings.push(`Looks like a forfeit by ${forfeitTeam} (all zeros)`);
    } else {
      const err = validateMatchGames(games, format);
      if (err) errors.push(err);
    }
    out.push({ night: a.night, week: a.week, teamA: a.team, teamB: a.opponent, games, sources: b ? [a.rowIndex, b.rowIndex] : [a.rowIndex], warnings, errors, forfeitTeam, playedAt: a.timestamp ?? b?.timestamp ?? null });
  }
  // rows with errors are reported individually
  for (const s of subs) if (s.errors.length && !used.has(s.rowIndex)) {
    out.push({ night: s.night, week: s.week, teamA: s.team, teamB: s.opponent, games: [], sources: [s.rowIndex], warnings: [], errors: s.errors, forfeitTeam: null, playedAt: s.timestamp });
  }
  return out.sort((x, y) => x.week - y.week || x.night.localeCompare(y.night));
}

function fmtGames(g: { home: number; away: number }[]) {
  return g.map((x) => `${x.home}-${x.away}`).join(", ");
}

/** Parse a US form timestamp like "4/27/2026 18:50:15" into ISO (America/New_York assumed by caller). */
export function parseUsTimestamp(s: string | null): { y: number; m: number; d: number; hh: number; mm: number } | null {
  if (!s) return null;
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  return { y: Number(m[3]), m: Number(m[1]), d: Number(m[2]), hh: m[4] ? Number(m[4]) : 18, mm: m[5] ? Number(m[5]) : 0 };
}
