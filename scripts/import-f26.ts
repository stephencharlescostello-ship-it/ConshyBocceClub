/**
 * Imports Fall 2026 results and rosters from the league's Google Sheet (public by link) into the
 * production database, through the Supabase service-role API. Re-runnable: matches that are already
 * confirmed are skipped, and players are matched by email, then by name, before anything is created.
 *
 * Usage:  npm run import:f26 -- [--dry-run] [--results-only] [--rosters-only] [--from <dir>]
 *   --dry-run   read everything and report what would change, write nothing
 *   --from      read <gid>.csv files from a folder instead of downloading the sheet
 *
 * Sources: data/f26/fall-2026.json → sources (sheet id and tab gids). Scores are the form responses
 * (one row per team per match, three column sets because the form branches per night); registration
 * rows give name, team, captain flag and email. Personal data is never printed.
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY from .env.production.local or the environment.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";
import { parseFormat } from "../src/lib/engine/format";
import { parseCsv } from "../src/lib/import/csv";
import { detectResultMapping, normalizeName, pairSubmissions, parseSubmissions, parseUsTimestamp } from "../src/lib/import/results";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const dryRun = flag("--dry-run");
const doResults = !flag("--rosters-only");
const doRosters = !flag("--results-only");

const fileEnv: Record<string, string> = {};
const envFile = path.join(root, ".env.production.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#")) fileEnv[m[1]] = m[2];
  }
}
const env = (k: string) => process.env[k] ?? fileEnv[k];
const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const admin = createClient<Database>(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

type Fall = { slug: string; sources: { sheet_id: string; scores_gid: string; registration_gid: string } };
const fall = JSON.parse(fs.readFileSync(path.join(root, "data/f26/fall-2026.json"), "utf8")) as Fall;

async function loadCsv(gid: string): Promise<string> {
  const from = opt("--from");
  if (from) return fs.readFileSync(path.join(from, `${gid}.csv`), "utf8");
  const url = `https://docs.google.com/spreadsheets/d/${fall.sources.sheet_id}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Sheet download failed (${res.status}) for gid ${gid}`);
  return res.text();
}
const fail = (msg: string): never => { throw new Error(msg); };

async function main() {
  const { data: season } = await admin.from("seasons").select("*").eq("slug", fall.slug).maybeSingle();
  if (!season) fail(`Season ${fall.slug} not found. Run npm run load:prod first.`);
  const format = parseFormat(season!.format);
  const [{ data: nights }, { data: teams }, { data: weeks }] = await Promise.all([
    admin.from("league_nights").select("id, name, weekday").eq("season_id", season!.id),
    admin.from("teams").select("id, name, night_id").eq("season_id", season!.id),
    admin.from("weeks").select("id, number, starts_on").eq("season_id", season!.id),
  ]);
  const nightByName = (n: string) => (nights ?? []).find((x) => x.name.toLowerCase() === n.toLowerCase()) ?? null;
  const teamByName = (nightId: string, name: string) => (teams ?? []).find((t) => t.night_id === nightId && normalizeName(t.name) === normalizeName(name)) ?? null;
  console.log(`${dryRun ? "DRY RUN · " : ""}${season!.name}: ${nights?.length} nights, ${teams?.length} teams, ${weeks?.length} weeks`);

  if (doResults) await importResults();
  if (doRosters) await importRosters();

  // ---------------------------------------------------------------- results
  async function importResults() {
    const parsed = parseCsv(await loadCsv(fall.sources.scores_gid));
    const mapping = detectResultMapping(parsed.headers);
    const paired = pairSubmissions(parseSubmissions(parsed.rows, mapping), format);
    let imported = 0, skipped = 0, errors = 0;
    const notes: string[] = [];
    const done = new Set<string>();
    for (const p of paired) {
      const label = `W${p.week} ${p.night}: ${p.teamA} vs ${p.teamB}`;
      if (p.errors.length) { errors++; notes.push(`ERROR  ${label} (rows ${p.sources.join(", ")}): ${p.errors.join("; ")}`); continue; }
      const night = nightByName(p.night);
      const week = (weeks ?? []).find((w) => w.number === p.week);
      const home = night && teamByName(night.id, p.teamA);
      const away = night && teamByName(night.id, p.teamB);
      if (!night || !week || !home || !away) { errors++; notes.push(`ERROR  ${label}: could not resolve ${!night ? "night" : !week ? "week" : "team"}`); continue; }
      let refiled: string | null = null;
      const pairFilter = `and(home_team_id.eq.${home.id},away_team_id.eq.${away.id}),and(home_team_id.eq.${away.id},away_team_id.eq.${home.id})`;
      let { data: match } = await admin.from("matches").select("id, status, home_team_id, scheduled_at, week:weeks(number)").eq("week_id", week.id).or(pairFilter).maybeSingle();
      if (!match) {
        // Captains sometimes pick the wrong week in the form. If these two teams are scheduled against
        // each other within three days of the submission time, file the result under that match instead.
        const ts = parseUsTimestamp(p.playedAt);
        const { data: others } = await admin.from("matches").select("id, status, home_team_id, scheduled_at, week:weeks(number)").eq("season_id", season!.id).or(pairFilter);
        const near = ts ? (others ?? []).find((m) => Math.abs(new Date(m.scheduled_at).getTime() - Date.UTC(ts.y, ts.m - 1, ts.d, 12)) < 3 * 86400000) : undefined;
        if (!near) { errors++; notes.push(`ERROR  ${label} (rows ${p.sources.join(", ")}): these teams are not scheduled against each other that week, and no match of theirs is near the submission date. Ignored.`); continue; }
        refiled = `filed as week ${p.week} but submitted ${p.playedAt}; recorded against their week ${(near.week as unknown as { number: number } | null)?.number} match`;
        match = near;
      }
      const scores = p.games.map((g) => `${g.home}-${g.away}`).join(", ");
      if (done.has(match.id)) { skipped++; notes.push(`SKIP   ${label} (rows ${p.sources.join(", ")}, ${scores}): extra report for a match already imported in this run; compare with the imported scores if in doubt`); continue; }
      done.add(match.id);
      if (refiled) notes.push(`CHECK  ${label} (rows ${p.sources.join(", ")}): ${refiled}`);
      if (["confirmed", "forfeit"].includes(match.status)) { skipped++; continue; }
      const flipped = match.home_team_id === away.id; // the schedule lists the other team as home
      const H = flipped ? away : home, A = flipped ? home : away;
      const games = flipped ? p.games.map((g) => ({ home: g.away, away: g.home })) : p.games;
      for (const w of p.warnings) if (w.includes("disagree")) notes.push(`CHECK  ${label}: ${w}`);
      if (dryRun) { imported++; continue; }
      const now = new Date().toISOString();
      if (p.forfeitTeam) {
        const ff = normalizeName(p.forfeitTeam) === normalizeName(p.teamA) ? home : away;
        const winner = ff.id === H.id ? A : H;
        const need = Math.floor(format.games_per_match / 2) + 1;
        const { error } = await admin.from("matches").update({ status: "forfeit", entry_mode: "import", forfeit_team_id: ff.id, winner_team_id: winner.id, home_games: winner.id === H.id ? need : 0, away_games: winner.id === A.id ? need : 0, home_points: winner.id === H.id ? need * format.target_score : 0, away_points: winner.id === A.id ? need * format.target_score : 0, confirmed_at: now, notes: `Forfeit reported on the score form (rows ${p.sources.join(", ")})` }).eq("id", match.id);
        if (error) fail(`${label}: ${error.message}`);
      } else {
        await admin.from("games").delete().eq("match_id", match.id);
        const { error: ge } = await admin.from("games").insert(games.map((g, i) => ({ match_id: match.id, number: i + 1, home_score: g.home, away_score: g.away, status: "final", winner_team_id: g.home > g.away ? H.id : A.id })));
        if (ge) fail(`${label}: ${ge.message}`);
        const HG = games.filter((g) => g.home > g.away).length, AG = games.length - HG;
        const { error: me } = await admin.from("matches").update({ status: "confirmed", entry_mode: "import", winner_team_id: HG > AG ? H.id : A.id, home_games: HG, away_games: AG, home_points: games.reduce((s, g) => s + g.home, 0), away_points: games.reduce((s, g) => s + g.away, 0), submitted_at: now, confirmed_at: now, notes: `Imported from the score form (rows ${p.sources.join(", ")})${p.warnings.length ? `. ${p.warnings.join("; ")}` : ""}` }).eq("id", match.id);
        if (me) fail(`${label}: ${me.message}`);
        await admin.from("confirmations").insert({ match_id: match.id, decision: "auto", note: "Imported result" });
      }
      imported++;
    }
    console.log(`Results: ${imported} ${dryRun ? "to import" : "imported"}, ${skipped} skipped (duplicates or already confirmed), ${errors} errors, ${paired.length} reports paired.`);
    for (const n of notes) console.log("  " + n);
  }

  // ---------------------------------------------------------------- rosters
  async function importRosters() {
    const parsed = parseCsv(await loadCsv(fall.sources.registration_gid));
    const col = (name: string) => parsed.headers.find((h) => h.trim().toLowerCase() === name.toLowerCase()) ?? fail(`Registration sheet has no "${name}" column`);
    const cTeam = col("Team"), cName = col("First and Last Name"), cCaptain = col("Captain"), cEmail = col("Email"), cSeason = col("Season");
    const teamIds = new Set((teams ?? []).map((t) => t.id));
    const [{ data: players }, { data: memberships }] = await Promise.all([
      admin.from("players").select("id, display_name, email, user_id").is("deleted_at", null),
      admin.from("team_memberships").select("team_id, player_id, role").in("team_id", [...teamIds]),
    ]);
    const byEmail = new Map((players ?? []).filter((p) => p.email).map((p) => [String(p.email).toLowerCase(), p]));
    const byName = new Map((players ?? []).map((p) => [normalizeName(p.display_name), p]));
    const have = new Set((memberships ?? []).map((m) => `${m.team_id}:${m.player_id}`));
    let created = 0, linked = 0, joined = 0, skipped = 0;
    const problems: string[] = [];
    const perTeam = new Map<string, number>();
    for (const [i, r] of parsed.rows.entries()) {
      const teamField = (r[cTeam] ?? "").trim();
      if (!teamField || (r[cSeason] ?? "").trim().toLowerCase() !== "fall") { skipped++; continue; }
      const parts = teamField.split(/\s+-\s+/).map((x) => x.trim());
      const night = nightByName(parts[0]);
      const team = night && parts[1] ? teamByName(night.id, parts[1]) : null;
      const name = (r[cName] ?? "").trim().replace(/\s+/g, " ");
      const email = (r[cEmail] ?? "").trim().toLowerCase();
      const isCaptain = (r[cCaptain] ?? "").trim().toLowerCase() === "yes";
      if (!team || !name) { problems.push(`row ${i + 2}: ${!team ? `unknown team "${teamField}"` : "missing name"}`); continue; }
      let player = (email && byEmail.get(email)) || byName.get(normalizeName(name)) || null;
      if (!player && isCaptain) {
        // The captain row created from the printed schedule (no email yet) is this person under a different spelling.
        const current = (memberships ?? []).find((m) => m.team_id === team.id && m.role === "captain");
        const cp = current && (players ?? []).find((p) => p.id === current.player_id && !p.user_id && !p.email);
        if (cp) {
          if (!dryRun) { const { error } = await admin.from("players").update({ display_name: name, email: email || null }).eq("id", cp.id); if (error) fail(error.message); }
          cp.display_name = name; cp.email = email || null; byName.set(normalizeName(name), cp); if (email) byEmail.set(email, cp);
          player = cp; linked++;
        }
      }
      if (!player) {
        if (dryRun) player = { id: `dry-${i}`, display_name: name, email: email || null, user_id: null };
        else { const { data, error } = await admin.from("players").insert({ display_name: name, email: email || null }).select("id, display_name, email, user_id").single(); if (error) fail(error.message); player = data!; }
        byName.set(normalizeName(name), player); if (email) byEmail.set(email, player);
        created++;
      } else if (email && !player.email && !player.user_id) {
        if (!dryRun) { const { error } = await admin.from("players").update({ email }).eq("id", player.id); if (error) fail(error.message); }
        player.email = email; byEmail.set(email, player); linked++;
      }
      const key = `${team.id}:${player.id}`;
      if (!have.has(key)) {
        if (!dryRun) { const { error } = await admin.from("team_memberships").insert({ team_id: team.id, player_id: player.id, role: isCaptain ? "captain" : "player" }); if (error) fail(error.message); }
        have.add(key); joined++;
      }
      perTeam.set(team.name, (perTeam.get(team.name) ?? 0) + 1);
    }
    console.log(`Rosters: ${created} players ${dryRun ? "to create" : "created"}, ${linked} existing rows given their email/name, ${joined} team memberships ${dryRun ? "to add" : "added"}, ${skipped} rows skipped (blank or not Fall).`);
    console.log("  Registrations per team: " + [...perTeam.entries()].sort().map(([t, n]) => `${t} ${n}`).join(" · "));
    for (const p of problems) console.log("  PROBLEM " + p);
  }
}
main().catch((err) => { console.error(err.message ?? err); process.exit(1); });
