import "server-only";
/**
 * CSV import engine (admin). Four kinds: teams, players, schedule, results.
 * Every kind supports column mapping, per-row validation and a dry run that
 * reports exactly what would change without writing.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { parseFormat } from "@/lib/engine/format";
import { normalizeName, normalizeNight, pairSubmissions, parseSubmissions, parseUsTimestamp, parseWeek, type RawRow, type ResultMapping } from "./results";
import { teamSlugify } from "@/lib/util/strings";

export type ImportKind = "teams" | "players" | "schedule" | "results";
export type RowReport = { row: number; status: "ok" | "skip" | "error"; message: string };
export type ImportReport = { ok: boolean; dryRun: boolean; summary: Record<string, number>; rows: RowReport[]; message?: string };

export const TEMPLATE_COLUMNS: Record<ImportKind, { col: string; desc: string; required?: boolean }[]> = {
  teams: [
    { col: "night", desc: "Monday … Friday", required: true },
    { col: "team", desc: "Team name (unique per night)", required: true },
    { col: "color", desc: "Hex color like #2f8f5f (optional)" },
    { col: "captain_name", desc: "Captain's name (optional, creates a roster spot)" },
    { col: "captain_email", desc: "Captain's email (optional, links their account on sign-in)" },
  ],
  players: [
    { col: "night", desc: "Monday … Friday", required: true },
    { col: "team", desc: "Team name (must exist, or will be created)", required: true },
    { col: "name", desc: "Player display name", required: true },
    { col: "email", desc: "Email (optional, links their account)" },
    { col: "phone", desc: "Phone (optional)" },
    { col: "role", desc: "captain | player | sub (default player)" },
    { col: "nickname", desc: "Nickname (optional)" },
  ],
  schedule: [
    { col: "night", desc: "Monday … Friday", required: true },
    { col: "week", desc: "Week number (1–N)", required: true },
    { col: "home", desc: "Home team name", required: true },
    { col: "away", desc: "Away team name (blank = bye)" },
    { col: "time", desc: "Start time HH:MM (24h, default 18:00)" },
    { col: "table", desc: "Table name (optional)" },
  ],
  results: [
    { col: "League Night", desc: "Monday … Friday (the Google Form column)", required: true },
    { col: "Match Week", desc: "e.g. Week 3", required: true },
    { col: "Your Team", desc: "Reporting team", required: true },
    { col: "Opposing Team", desc: "Opponent", required: true },
    { col: "Game 1 [Your Score]", desc: "Game 1, reporting team", required: true },
    { col: "Game 1 [Opponent's Score]", desc: "Game 1, opponent", required: true },
    { col: "Game 2 [Your Score]", desc: "Game 2" },
    { col: "Game 2 [Opponent's Score]", desc: "Game 2" },
    { col: "Game 3 (If necessary) [Your Score]", desc: "Game 3" },
    { col: "Game 3 (If necessary) [Opponent's Score]", desc: "Game 3" },
    { col: "Timestamp", desc: "Optional, M/D/YYYY HH:MM (sets the match date)" },
  ],
};

export type Mapping = Record<string, string | null>; // target column → source header

/** Guess the mapping for teams/players/schedule from headers. */
export function detectMapping(kind: ImportKind, headers: string[]): Mapping {
  const H = headers.map((h) => h.trim().toLowerCase().replace(/_\d+$/, ""));
  const find = (...cands: string[]) => { for (const c of cands) { const i = H.findIndex((h) => h === c || h.includes(c)); if (i >= 0) return headers[i]; } return null; };
  if (kind === "teams") return { night: find("night", "day"), team: find("team", "name"), color: find("color", "colour"), captain_name: find("captain_name", "captain"), captain_email: find("captain_email", "email") };
  if (kind === "players") return { night: find("night", "day"), team: find("team"), name: find("name", "player"), email: find("email"), phone: find("phone", "mobile"), role: find("role"), nickname: find("nick") };
  if (kind === "schedule") return { night: find("night", "day"), week: find("week"), home: find("home"), away: find("away", "visitor"), time: find("time"), table: find("table", "board") };
  return {};
}

const get = (r: RawRow, m: Mapping, k: string) => (m[k] ? String(r[m[k]!] ?? "").trim() : "");

export async function runImport(kind: ImportKind, seasonId: string, rows: RawRow[], mapping: Mapping | ResultMapping, dryRun: boolean, actorId: string): Promise<ImportReport> {
  const admin = createAdminClient();
  const { data: season } = await admin.from("seasons").select("*").eq("id", seasonId).maybeSingle();
  if (!season) return { ok: false, dryRun, summary: {}, rows: [], message: "Season not found" };
  const { data: nights } = await admin.from("league_nights").select("id, name, weekday").eq("season_id", seasonId);
  const { data: teams } = await admin.from("teams").select("id, name, night_id").eq("season_id", seasonId);
  const nightByName = (n: string | null) => (nights ?? []).find((x) => x.name.toLowerCase() === (n ?? "").toLowerCase()) ?? null;
  const teamByName = (nightId: string, name: string) => (teams ?? []).find((t) => t.night_id === nightId && normalizeName(t.name) === normalizeName(name)) ?? null;
  const report: RowReport[] = [];
  const summary: Record<string, number> = { created: 0, updated: 0, skipped: 0, errors: 0 };
  const err = (row: number, message: string) => { report.push({ row, status: "error", message }); summary.errors++; };
  const ok = (row: number, message: string, created = true) => { report.push({ row, status: "ok", message }); if (created) summary.created++; else summary.updated++; };
  const skip = (row: number, message: string) => { report.push({ row, status: "skip", message }); summary.skipped++; };

  async function ensureTeam(nightId: string, name: string, color?: string): Promise<{ id: string; created: boolean }> {
    const existing = teamByName(nightId, name);
    if (existing) return { id: existing.id, created: false };
    if (dryRun) { const fake = { id: `dry-${name}`, name, night_id: nightId }; teams!.push(fake); return { id: fake.id, created: true }; }
    const { data } = await admin.from("teams").insert({ season_id: seasonId, night_id: nightId, name, slug: teamSlugify(name), color: color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#2f8f5f" }).select("id").single();
    teams!.push({ id: data!.id, name, night_id: nightId });
    return { id: data!.id, created: true };
  }
  async function ensurePlayer(name: string, email: string | null, phone: string | null, nickname: string | null): Promise<{ id: string; created: boolean }> {
    if (email) {
      const { data: byEmail } = await admin.from("players").select("id").eq("email", email).maybeSingle();
      if (byEmail) return { id: byEmail.id, created: false };
    }
    const { data: byName } = await admin.from("players").select("id").ilike("display_name", name).is("user_id", null).is("deleted_at", null).maybeSingle();
    if (byName) return { id: byName.id, created: false };
    if (dryRun) return { id: `dry-${name}`, created: true };
    const { data } = await admin.from("players").insert({ display_name: name, email, phone, nickname }).select("id").single();
    return { id: data!.id, created: true };
  }

  if (kind === "teams") {
    const m = mapping as Mapping;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; const row = i + 1;
      const night = nightByName(normalizeNight(get(r, m, "night")));
      const name = get(r, m, "team");
      if (!night) { err(row, `Unknown night “${get(r, m, "night")}”`); continue; }
      if (name.length < 2) { err(row, "Missing team name"); continue; }
      const t = await ensureTeam(night.id, name, get(r, m, "color"));
      const cap = get(r, m, "captain_name");
      let capMsg = "";
      if (cap) {
        const p = await ensurePlayer(cap, get(r, m, "captain_email").toLowerCase() || null, null, null);
        if (!dryRun) await admin.from("team_memberships").upsert({ team_id: t.id, player_id: p.id, role: "captain" }, { onConflict: "team_id,player_id" });
        capMsg = ` · captain ${cap}${p.created ? " (new)" : ""}`;
      }
      t.created ? ok(row, `Create ${name} on ${night.name}${capMsg}`) : skip(row, `${name} already exists on ${night.name}${capMsg}`);
    }
  } else if (kind === "players") {
    const m = mapping as Mapping;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; const row = i + 1;
      const night = nightByName(normalizeNight(get(r, m, "night")));
      const teamName = get(r, m, "team"); const name = get(r, m, "name");
      if (!night) { err(row, `Unknown night “${get(r, m, "night")}”`); continue; }
      if (!teamName || !name) { err(row, "Team and name are required"); continue; }
      const email = get(r, m, "email").toLowerCase() || null;
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err(row, `Invalid email ${email}`); continue; }
      const role = (get(r, m, "role").toLowerCase() || "player");
      if (!["captain", "player", "sub"].includes(role)) { err(row, `Role must be captain, player or sub (got ${role})`); continue; }
      const t = await ensureTeam(night.id, teamName);
      const p = await ensurePlayer(name, email, get(r, m, "phone") || null, get(r, m, "nickname") || null);
      if (!dryRun) await admin.from("team_memberships").upsert({ team_id: t.id, player_id: p.id, role }, { onConflict: "team_id,player_id" });
      ok(row, `${p.created ? "Create" : "Link"} ${name} → ${teamName}${t.created ? " (new team)" : ""} as ${role}`, p.created);
    }
  } else if (kind === "schedule") {
    const m = mapping as Mapping;
    const { data: weeks } = await admin.from("weeks").select("id, number, starts_on").eq("season_id", seasonId);
    const { data: tables } = await admin.from("tables").select("id, name");
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; const row = i + 1;
      const night = nightByName(normalizeNight(get(r, m, "night")));
      const wk = parseWeek(get(r, m, "week"));
      const week = (weeks ?? []).find((w) => w.number === wk);
      if (!night) { err(row, `Unknown night “${get(r, m, "night")}”`); continue; }
      if (!week) { err(row, `Unknown week “${get(r, m, "week")}” (season has ${weeks?.length ?? 0})`); continue; }
      const homeName = get(r, m, "home"); const awayName = get(r, m, "away");
      const home = homeName ? teamByName(night.id, homeName) : null;
      const away = awayName ? teamByName(night.id, awayName) : null;
      if (!home) { err(row, `Unknown home team “${homeName}” on ${night.name}`); continue; }
      if (awayName && !away) { err(row, `Unknown away team “${awayName}” on ${night.name}`); continue; }
      if (away && away.id === home.id) { err(row, "Home and away are the same team"); continue; }
      const time = /^\d{1,2}:\d{2}$/.test(get(r, m, "time")) ? get(r, m, "time").padStart(5, "0") : "18:00";
      const tableName = get(r, m, "table");
      const table = tableName ? (tables ?? []).find((t) => t.name.toLowerCase() === tableName.toLowerCase()) : null;
      if (tableName && !table) { err(row, `Unknown table “${tableName}”`); continue; }
      const base = new Date(`${week.starts_on}T00:00:00`); base.setDate(base.getDate() + (night.weekday - 1));
      const scheduledAt = `${base.toISOString().slice(0, 10)}T${time}:00-04:00`;
      const { data: dup } = await admin.from("matches").select("id").eq("week_id", week.id).eq("home_team_id", home.id).eq("away_team_id", away?.id ?? "00000000-0000-0000-0000-000000000000").maybeSingle();
      if (dup) { skip(row, `Already scheduled: ${homeName} vs ${awayName || "bye"} week ${wk}`); continue; }
      if (!dryRun) await admin.from("matches").insert({ season_id: seasonId, night_id: night.id, week_id: week.id, home_team_id: home.id, away_team_id: away?.id ?? null, table_id: table?.id ?? null, scheduled_at: scheduledAt, status: away ? "scheduled" : "bye" });
      ok(row, `Week ${wk} ${night.name} ${time}: ${homeName} vs ${awayName || "BYE"}${table ? ` on ${table.name}` : ""}`);
    }
  } else if (kind === "results") {
    const format = parseFormat(season.format);
    const subs = parseSubmissions(rows, mapping as ResultMapping);
    const paired = pairSubmissions(subs, format);
    const { data: weeks } = await admin.from("weeks").select("id, number, starts_on").eq("season_id", seasonId);
    for (const p of paired) {
      const row = p.sources[0];
      if (p.errors.length) { err(row, p.errors.join("; ")); continue; }
      const night = nightByName(p.night);
      const week = (weeks ?? []).find((w) => w.number === p.week);
      if (!night) { err(row, `Unknown night “${p.night}”`); continue; }
      if (!week) { err(row, `Week ${p.week} does not exist in this season`); continue; }
      const home = teamByName(night.id, p.teamA) ?? (await ensureTeam(night.id, p.teamA.trim()) && teamByName(night.id, p.teamA));
      const away = teamByName(night.id, p.teamB) ?? (await ensureTeam(night.id, p.teamB.trim()) && teamByName(night.id, p.teamB));
      if (!home || !away) { err(row, "Could not resolve teams"); continue; }
      // find or create the match for this pair in this week
      const { data: existing } = await admin.from("matches").select("id, status").eq("week_id", week.id).or(`and(home_team_id.eq.${home.id},away_team_id.eq.${away.id}),and(home_team_id.eq.${away.id},away_team_id.eq.${home.id})`).maybeSingle();
      if (existing && ["confirmed", "forfeit"].includes(existing.status)) { skip(row, `Week ${p.week} ${p.teamA} vs ${p.teamB}: already confirmed`); continue; }
      const ts = parseUsTimestamp(p.playedAt);
      const base = new Date(`${week.starts_on}T00:00:00`); base.setDate(base.getDate() + (night.weekday - 1));
      const when = ts ? `${ts.y}-${String(ts.m).padStart(2, "0")}-${String(ts.d).padStart(2, "0")}T${String(Math.min(23, Math.max(0, ts.hh - 1))).padStart(2, "0")}:00:00-04:00` : `${base.toISOString().slice(0, 10)}T18:00:00-04:00`;
      const hg = p.games.filter((g) => g.home > g.away).length, ag = p.games.length - hg;
      const hp = p.games.reduce((a, g) => a + g.home, 0), ap = p.games.reduce((a, g) => a + g.away, 0);
      const warn = p.warnings.length ? ` (${p.warnings.join("; ")})` : "";
      if (dryRun) { ok(row, `Week ${p.week} ${night.name}: ${p.teamA} ${hg}–${ag} ${p.teamB}${p.forfeitTeam ? ` forfeit by ${p.forfeitTeam}` : ""}${warn}`, !existing); continue; }
      let matchId = existing?.id;
      if (!matchId) {
        const { data: created } = await admin.from("matches").insert({ season_id: seasonId, night_id: night.id, week_id: week.id, home_team_id: home.id, away_team_id: away.id, scheduled_at: when, status: "scheduled" }).select("id").single();
        matchId = created!.id;
      } else {
        await admin.from("frames").delete().in("game_id", (await admin.from("games").select("id").eq("match_id", matchId)).data?.map((g) => g.id) ?? []);
        await admin.from("games").delete().eq("match_id", matchId);
      }
      const orient = existing && (await admin.from("matches").select("home_team_id").eq("id", matchId).maybeSingle()).data?.home_team_id === away.id; // existing match stored the other way round
      const g = orient ? p.games.map((x) => ({ home: x.away, away: x.home })) : p.games;
      const H = orient ? away : home; const A = orient ? home : away;
      if (p.forfeitTeam) {
        const ff = normalizeName(p.forfeitTeam) === normalizeName(p.teamA) ? home : away;
        const winner = ff.id === H.id ? A : H;
        const need = Math.floor(format.games_per_match / 2) + 1;
        await admin.from("matches").update({ status: "forfeit", entry_mode: "import", forfeit_team_id: ff.id, winner_team_id: winner.id, home_games: winner.id === H.id ? need : 0, away_games: winner.id === A.id ? need : 0, home_points: winner.id === H.id ? need * format.target_score : 0, away_points: winner.id === A.id ? need * format.target_score : 0, confirmed_at: new Date().toISOString(), notes: "Imported forfeit" }).eq("id", matchId);
      } else {
        await admin.from("games").insert(g.map((x, i) => ({ match_id: matchId!, number: i + 1, home_score: x.home, away_score: x.away, status: "final", winner_team_id: x.home > x.away ? H.id : A.id })));
        const HG = g.filter((x) => x.home > x.away).length, AG = g.length - HG;
        await admin.from("matches").update({ status: "confirmed", entry_mode: "import", winner_team_id: HG > AG ? H.id : A.id, home_games: HG, away_games: AG, home_points: g.reduce((a, x) => a + x.home, 0), away_points: g.reduce((a, x) => a + x.away, 0), submitted_at: new Date().toISOString(), confirmed_at: new Date().toISOString(), notes: `Imported from CSV rows ${p.sources.join(", ")}` }).eq("id", matchId);
        await admin.from("confirmations").insert({ match_id: matchId, decision: "auto", note: "Imported result" });
      }
      void hp; void ap;
      ok(row, `Week ${p.week} ${night.name}: ${p.teamA} ${hg}–${ag} ${p.teamB}${p.forfeitTeam ? ` forfeit by ${p.forfeitTeam}` : ""}${warn}`, !existing);
    }
  }
  if (!dryRun) await admin.from("import_jobs").insert({ kind, dry_run: false, mapping: mapping as never, summary: summary as never, created_by: actorId });
  return { ok: summary.errors === 0, dryRun, summary, rows: report };
}
