/**
 * Loads the real league into a fresh production database (nothing fake):
 *  - content: league settings, badges, blocked words, rules page, FAQ, tables
 *  - Spring 2026 from data/s26/scores.csv as an archived season (results, champions)
 *  - Fall 2026 from data/f26/fall-2026.json as the ACTIVE season: three nights, 18 teams with
 *    their captains as roster players, every scheduled match, the bye and playoff weeks.
 *    Results are not in the repo; enter them in Admin → Results or import the score sheet.
 *
 * Usage:  npm run load:prod -- [--dry-run] [--print]   (--dry-run executes everything, then rolls back)
 * Refuses to run when a season already exists. Everything is one transaction.
 * Connection: DATABASE_URL, or SUPABASE_DB_PASSWORD (+ supabase/.temp/project-ref) through the
 * Supabase pooler (SUPABASE_POOLER_HOST, default aws-1-ca-central-1.pooler.supabase.com), read from
 * .env.production.local or the environment. Never prints secrets.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { DEFAULT_FORMAT, type Format } from "../src/lib/engine/format";
import { buildS26, j, q, slug } from "./s26-import";
import { BADGES, BLOCKED_WORDS, TEAM_COLORS } from "./seed-data";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const print = args.includes("--print");

const fileEnv: Record<string, string> = {};
const envFile = path.join(root, ".env.production.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#")) fileEnv[m[1]] = m[2];
  }
}
const env = (k: string, fallback?: string) => process.env[k] ?? fileEnv[k] ?? fallback;

function connectionString(): string {
  const direct = env("DATABASE_URL");
  if (direct) return direct;
  const pw = env("SUPABASE_DB_PASSWORD");
  const refFile = path.join(root, "supabase/.temp/project-ref");
  const ref = env("SUPABASE_PROJECT_REF") ?? (fs.existsSync(refFile) ? fs.readFileSync(refFile, "utf8").trim() : undefined);
  if (!pw || !ref) throw new Error("Set DATABASE_URL, or SUPABASE_DB_PASSWORD plus a linked project (supabase link).");
  const host = env("SUPABASE_POOLER_HOST", "aws-1-ca-central-1.pooler.supabase.com");
  return `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@${host}:5432/postgres`;
}

type Fall = {
  name: string; slug: string; format: Partial<Format>; slot_times: string[];
  nights: Record<string, { team: string; captains: string[] }[]>;
  weeks: { number: number; week_of: string; kind?: string; label?: string; slots?: [number, number][] }[];
  playoffs: { teams_per_night: number; champion_of_champions: boolean; note?: string };
};
const fall = JSON.parse(fs.readFileSync(path.join(root, "data/f26/fall-2026.json"), "utf8")) as Fall;
const WEEKDAY: Record<string, number> = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };
const adminEmail = (env("ADMIN_BOOTSTRAP_EMAILS", "").split(",")[0] ?? "").trim().toLowerCase();

const out: string[] = [];
const sql = (s: string) => out.push(s);

// ------------------------------------------------------------ content
sql(`insert into public.settings (key, value, is_public) values
  ('league', ${j({ app_name: "CBC Shuffle", club_name: "Conshohocken Bocce Club", tagline: "Shuffleboard league at the Conshohocken Bocce Club", timezone: "America/New_York" })}, true),
  ('club', ${j({ address: "Conshohocken Bocce Club, 229 W 5th Ave, Conshohocken, PA 19428", map_url: "https://maps.google.com/?q=Conshohocken+Bocce+Club", contact_name: "Commissioner", contact_email: adminEmail, contact_phone: "" })}, true),
  ('dues', ${j({ amount_cents: 0, label: "League dues" })}, false),
  ('chat', ${j({ edit_window_minutes: 5, rate_limit_per_minute: 20 })}, true),
  ('branding', ${j({ logo_path: "/branding/logo.png", colors: { primary: "#1f6f4a", cream: "#f4efe3", gold: "#d4a73a" } })}, true)
on conflict (key) do nothing;`);
sql(`insert into public.badges (slug, name, description, icon) values
${BADGES.map((b) => `  (${q(b.slug)}, ${q(b.name)}, ${q(b.description)}, ${q(b.icon)})`).join(",\n")}
on conflict (slug) do nothing;`);
sql(`insert into public.blocked_words (word) values ${BLOCKED_WORDS.map((w) => `(${q(w)})`).join(", ")} on conflict (word) do nothing;`);
sql(`insert into public.rules_pages (slug, title, body_md, sort_order) values ('rules', 'Rules & Policies', ${q(fs.readFileSync(path.join(root, "content/rules.md"), "utf8"))}, 0) on conflict (slug) do nothing;`);
const faq = JSON.parse(fs.readFileSync(path.join(root, "content/faq.json"), "utf8")) as { q: string; a: string }[];
sql(`insert into public.faq_items (question, answer_md, sort_order)
select * from (values\n${faq.map((f, i) => `  (${q(f.q)}, ${q(f.a)}, ${i})`).join(",\n")}) as v(question, answer_md, sort_order)
where not exists (select 1 from public.faq_items);`);
const TABLE1 = randomUUID();
const TABLE2 = randomUUID();
sql(`insert into public.tables (id, name, sort_order) values (${q(TABLE1)}, 'Table 1', 0), (${q(TABLE2)}, 'Table 2', 1) on conflict (name) do nothing;`);

// ------------------------------------------------------------ Spring 2026 (archived)
const s26 = buildS26({ uuid: randomUUID, tableId: TABLE1, status: "archived" });
for (const stmt of s26.sql) sql(stmt);

// ------------------------------------------------------------ Fall 2026 (active)
const F = { id: randomUUID(), format: { ...DEFAULT_FORMAT, ...fall.format } as Format };
const firstWeek = fall.weeks.filter((w) => !w.kind || w.kind === "regular");
const playoffWeeks = fall.weeks.filter((w) => w.kind === "playoff");
sql(`insert into public.seasons (id, name, slug, status, starts_on, regular_weeks, playoff_weeks, format, playoff_config, notes) values
  (${q(F.id)}, ${q(fall.name)}, ${q(fall.slug)}, 'active', ${q(fall.weeks[0].week_of)}, ${firstWeek.length}, ${playoffWeeks.length}, ${j(F.format)}, ${j({ teams_per_night: fall.playoffs.teams_per_night, champion_of_champions: fall.playoffs.champion_of_champions })}, ${q(`Schedule entered from the printed Fall 2026 sheet. Games to ${F.format.target_score}, best of ${F.format.games_per_match}. ${fall.playoffs.note ?? ""}`.trim())});`);
const weekIds = new Map<number, string>();
for (const w of fall.weeks) {
  const id = randomUUID();
  weekIds.set(w.number, id);
  sql(`insert into public.weeks (id, season_id, number, starts_on, kind, label) values (${q(id)}, ${q(F.id)}, ${w.number}, ${q(w.week_of)}, ${q(w.kind ?? "regular")}, ${q(w.label ?? null)});`);
}
const slotTimes = fall.slot_times.map((t) => `'${t}'::time`).join(",");
let colorIdx = 0;
let matchCount = 0;
const teamStmts: string[] = [];
const playerStmts: string[] = [];
const membershipStmts: string[] = [];
const matchStmts: string[] = [];
let captainCount = 0;
for (const [nightName, teams] of Object.entries(fall.nights)) {
  const nightId = randomUUID();
  const weekday = WEEKDAY[nightName];
  sql(`insert into public.league_nights (id, season_id, weekday, name, slug, start_time, slot_times, sort_order) values (${q(nightId)}, ${q(F.id)}, ${weekday}, ${q(nightName)}, ${q(nightName.toLowerCase())}, '${fall.slot_times[0]}', array[${slotTimes}], ${weekday});`);
  const teamIds: string[] = [];
  teams.forEach((t) => {
    const teamId = randomUUID();
    teamIds.push(teamId);
    teamStmts.push(`insert into public.teams (id, season_id, night_id, name, slug, color) values (${q(teamId)}, ${q(F.id)}, ${q(nightId)}, ${q(t.team)}, ${q(slug(t.team))}, ${q(TEAM_COLORS[colorIdx++ % TEAM_COLORS.length])});`);
    for (const captain of t.captains) {
      captainCount++;
      // Captains become roster players (no account yet; they claim the row when they sign in). The
      // commissioner's own row is renamed below before this runs, so it is reused rather than duplicated.
      playerStmts.push(`insert into public.players (id, display_name) select ${q(randomUUID())}, ${q(captain)} where not exists (select 1 from public.players where lower(display_name) = lower(${q(captain)}) and deleted_at is null);`);
      membershipStmts.push(`insert into public.team_memberships (team_id, player_id, role) select ${q(teamId)}, p.id, 'captain' from public.players p where lower(p.display_name) = lower(${q(captain)}) and p.deleted_at is null order by (p.user_id is not null) desc limit 1 on conflict (team_id, player_id) do nothing;`);
    }
  });
  for (const w of fall.weeks) {
    if (!w.slots) continue;
    w.slots.forEach(([homeNo, awayNo], slotIdx) => {
      const when = `(${q(w.week_of)}::date + ${weekday - 1} + ${q(fall.slot_times[slotIdx])}::time) at time zone 'America/New_York'`;
      matchStmts.push(`insert into public.matches (season_id, night_id, week_id, home_team_id, away_team_id, table_id, slot_index, scheduled_at, status) values (${q(F.id)}, ${q(nightId)}, ${q(weekIds.get(w.number)!)}, ${q(teamIds[homeNo - 1])}, ${q(teamIds[awayNo - 1])}, ${q(TABLE1)}, ${slotIdx}, ${when}, 'scheduled');`);
      matchCount++;
    });
  }
}
for (const s of teamStmts) sql(s);
if (adminEmail) sql(`update public.players set display_name = 'Steve Costello' where email = ${q(adminEmail)} and is_admin and display_name = split_part(${q(adminEmail)}, '@', 1);`);
for (const s of playerStmts) sql(s);
for (const s of membershipStmts) sql(s);
for (const s of matchStmts) sql(s);

// ------------------------------------------------------------ run
async function main() {
  console.log(`Statements: ${out.length}. Spring 2026: ${s26.importedCount} matches, ${s26.teamCount} teams${s26.skipped.length ? `, ${s26.skipped.length} skipped` : ""}. Fall 2026: ${Object.keys(fall.nights).length} nights, ${Object.values(fall.nights).flat().length} teams, ${captainCount} captains, ${matchCount} scheduled matches, ${fall.weeks.length} week rows.`);
  for (const s of s26.skipped) console.log(`  skipped S26 week ${s.week} ${s.night} ${s.teams}: ${s.errors.join("; ")}`);
  if (print) console.log(out.join("\n"));
  const client = new Client({ connectionString: connectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const { rows } = await client.query("select (select count(*)::int from public.seasons) as seasons, (select count(*)::int from public.players) as players");
    console.log(`Database has ${rows[0].seasons} season(s) and ${rows[0].players} player(s).`);
    if (rows[0].seasons > 0) throw new Error("A season already exists; refusing to load. Remove it first or use Admin → Seasons.");
    await client.query("begin");
    for (const stmt of out) await client.query(stmt);
    const { rows: after } = await client.query(`select
      (select count(*) from public.seasons) seasons, (select count(*) from public.league_nights) nights, (select count(*) from public.teams) teams,
      (select count(*) from public.players) players, (select count(*) from public.team_memberships) memberships, (select count(*) from public.matches) matches,
      (select count(*) from public.games) games, (select count(*) from public.channels) channels, (select count(*) from public.awards) awards`);
    console.log(dryRun ? "Rehearsal counts (rolled back):" : "Loaded:", after[0]);
    await client.query(dryRun ? "rollback" : "commit");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}
main().catch((err) => { console.error(err.message ?? err); process.exit(1); });
