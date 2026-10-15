/**
 * Spring 2026 ("S26"): the real league spreadsheet (data/s26/scores.csv) as SQL.
 * Shared by scripts/generate-seed.ts (local seed, archived) and scripts/load-production.ts (live DB).
 * The caller supplies the uuid generator so the seed stays deterministic.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_FORMAT, type Format } from "../src/lib/engine/format";
import { computeStandings, type MatchResult } from "../src/lib/engine/standings";
import { parseCsv } from "../src/lib/import/csv";
import { detectResultMapping, pairSubmissions, parseSubmissions, parseUsTimestamp } from "../src/lib/import/results";
import { TEAM_COLORS } from "./seed-data";

const here = path.dirname(fileURLToPath(import.meta.url));
export const q = (s: string | null | undefined) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
export const j = (v: unknown) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export type S26Options = {
  uuid: () => string;
  tableId: string;
  status: "active" | "archived";
};
export type S26Result = {
  sql: string[];
  seasonId: string;
  importedCount: number;
  teamCount: number;
  skipped: { week: number; night: string; teams: string; errors: string[] }[];
};

export function buildS26(opts: S26Options): S26Result {
  const { uuid, tableId, status } = opts;
  const out: string[] = [];
  const sql = (s: string) => out.push(s);
  const S26 = { id: uuid(), name: "Spring 2026", slug: "spring-2026", format: { ...DEFAULT_FORMAT, target_score: 11 } as Format };
  const archivedAt = status === "archived" ? "'2026-07-20'" : "null";
  sql(`insert into public.seasons (id, name, slug, status, starts_on, regular_weeks, playoff_weeks, format, archived_at, notes) values
  (${q(S26.id)}, ${q(S26.name)}, ${q(S26.slug)}, ${q(status)}, '2026-04-27', 10, 0, ${j(S26.format)}, ${archivedAt}, 'Imported from the league Google Sheet (Monday and Wednesday nights). Games were played to 11.');`);
  const nights: Record<string, { id: string; weekday: number; teams: Map<string, string> }> = {
    Monday: { id: uuid(), weekday: 1, teams: new Map() },
    Wednesday: { id: uuid(), weekday: 3, teams: new Map() },
  };
  for (const [name, n] of Object.entries(nights)) {
    sql(`insert into public.league_nights (id, season_id, weekday, name, slug, sort_order) values (${q(n.id)}, ${q(S26.id)}, ${n.weekday}, ${q(name)}, ${q(name.toLowerCase())}, ${n.weekday});`);
  }
  const weeks: string[] = [];
  for (let w = 1; w <= 10; w++) {
    const id = uuid();
    weeks.push(id);
    const d = new Date(Date.UTC(2026, 3, 27 + (w - 1) * 7));
    sql(`insert into public.weeks (id, season_id, number, starts_on, kind) values (${q(id)}, ${q(S26.id)}, ${w}, '${d.toISOString().slice(0, 10)}', 'regular');`);
  }
  const csv = fs.readFileSync(path.join(here, "../data/s26/scores.csv"), "utf8");
  const parsed = parseCsv(csv);
  const mapping = detectResultMapping(parsed.headers);
  const paired = pairSubmissions(parseSubmissions(parsed.rows, mapping), S26.format);
  const teamRows: string[] = [];
  let colorIdx = 0;
  for (const night of Object.keys(nights)) {
    const names = new Set<string>();
    for (const p of paired.filter((x) => x.night === night)) { names.add(p.teamA.trim()); names.add(p.teamB.trim()); }
    for (const name of names) {
      const id = uuid();
      nights[night].teams.set(name.toLowerCase(), id);
      teamRows.push(`(${q(id)}, ${q(S26.id)}, ${q(nights[night].id)}, ${q(name)}, ${q(slug(name) + "-s26")}, ${q(TEAM_COLORS[colorIdx++ % TEAM_COLORS.length])})`);
    }
  }
  sql(`insert into public.teams (id, season_id, night_id, name, slug, color) values\n${teamRows.join(",\n")};`);
  const results: Record<string, MatchResult[]> = { Monday: [], Wednesday: [] };
  const skipped: S26Result["skipped"] = [];
  let importedCount = 0;
  for (const p of paired) {
    if (p.errors.length) { skipped.push({ week: p.week, night: p.night, teams: `${p.teamA} vs ${p.teamB}`, errors: p.errors }); continue; }
    const night = nights[p.night];
    const home = night.teams.get(p.teamA.trim().toLowerCase())!;
    const away = night.teams.get(p.teamB.trim().toLowerCase())!;
    const t = parseUsTimestamp(p.playedAt);
    const weekIdx = p.week - 1;
    const base = new Date(Date.UTC(2026, 3, 27 + weekIdx * 7 + (night.weekday - 1)));
    const slotIdx = t ? Math.max(0, Math.min(2, t.hh - 18 - (t.mm < 30 && t.hh > 18 ? 1 : 0))) : 0;
    const when = `'${base.toISOString().slice(0, 10)} ${18 + slotIdx}:00:00 America/New_York'::timestamptz`;
    const id = uuid();
    importedCount++;
    if (p.forfeitTeam) {
      const ff = night.teams.get(p.forfeitTeam.trim().toLowerCase())!;
      const winner = ff === home ? away : home;
      sql(`insert into public.matches (id, season_id, night_id, week_id, home_team_id, away_team_id, table_id, slot_index, scheduled_at, status, entry_mode, winner_team_id, forfeit_team_id, home_games, away_games, home_points, away_points, confirmed_at, notes)
  values (${q(id)}, ${q(S26.id)}, ${q(night.id)}, ${q(weeks[weekIdx])}, ${q(home)}, ${q(away)}, ${q(tableId)}, ${slotIdx}, ${when}, 'forfeit', 'import', ${q(winner)}, ${q(ff)}, ${winner === home ? 2 : 0}, ${winner === away ? 2 : 0}, ${winner === home ? 22 : 0}, ${winner === away ? 22 : 0}, ${when} + interval '3 hours', 'Forfeit recorded in the spreadsheet (FF column).');`);
      results[p.night].push({ id, homeTeamId: home, awayTeamId: away, winnerTeamId: winner, homeGames: winner === home ? 2 : 0, awayGames: winner === away ? 2 : 0, homePoints: winner === home ? 22 : 0, awayPoints: winner === away ? 22 : 0, status: "forfeit", scheduledAt: base.toISOString(), forfeitTeamId: ff });
      continue;
    }
    let hg = 0, ag = 0, hp = 0, ap = 0;
    for (const g of p.games) { if (g.home > g.away) hg++; else ag++; hp += g.home; ap += g.away; }
    const winner = hg > ag ? home : away;
    sql(`insert into public.matches (id, season_id, night_id, week_id, home_team_id, away_team_id, table_id, slot_index, scheduled_at, status, entry_mode, winner_team_id, home_games, away_games, home_points, away_points, submitted_at, confirmed_at)
  values (${q(id)}, ${q(S26.id)}, ${q(night.id)}, ${q(weeks[weekIdx])}, ${q(home)}, ${q(away)}, ${q(tableId)}, ${slotIdx}, ${when}, 'confirmed', 'import', ${q(winner)}, ${hg}, ${ag}, ${hp}, ${ap}, ${when} + interval '70 minutes', ${when} + interval '75 minutes');`);
    sql(`insert into public.games (match_id, number, home_score, away_score, status, winner_team_id) values ${p.games.map((g, i) => `(${q(id)}, ${i + 1}, ${g.home}, ${g.away}, 'final', ${q(g.home > g.away ? home : away)})`).join(", ")};`);
    results[p.night].push({ id, homeTeamId: home, awayTeamId: away, winnerTeamId: winner, homeGames: hg, awayGames: ag, homePoints: hp, awayPoints: ap, status: "confirmed", scheduledAt: base.toISOString() });
  }
  // Champions (regular season winners; no playoff data in the sheet)
  for (const night of Object.keys(nights)) {
    const teams = Array.from(nights[night].teams.entries()).map(([k, id]) => ({ id, name: k }));
    const rows = computeStandings(teams, results[night]);
    sql(`insert into public.awards (season_id, kind, team_id, details) values (${q(S26.id)}, 'night_champion', ${q(rows[0].teamId)}, ${j({ night, record: `${rows[0].wins}-${rows[0].losses}`, note: "Regular-season champion (no playoff results in the spreadsheet)" })});`);
  }
  return { sql: out, seasonId: S26.id, importedCount, teamCount: teamRows.length, skipped };
}
