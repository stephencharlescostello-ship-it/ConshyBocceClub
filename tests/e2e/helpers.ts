import { type Page, type Browser, expect } from "@playwright/test";
import { Client } from "pg";

export const DB_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    return (await c.query(text, params)).rows as T[];
  } finally {
    await c.end();
  }
}

/** Signs a page in as a seeded user through the dev login route (ALLOW_DEV_LOGIN=true locally). */
export async function signIn(page: Page, email: string, next = "/") {
  await page.goto(`/dev/login?as=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
  await page.waitForURL((u) => !u.pathname.startsWith("/dev/") && !u.pathname.startsWith("/auth/"));
}

export async function newSignedInPage(browser: Browser, email: string, next = "/") {
  const ctx = await browser.newContext({ permissions: ["notifications"] });
  const page = await ctx.newPage();
  await signIn(page, email, next);
  return { ctx, page };
}

export type Fixture = { matchId: string; homeName: string; awayName: string; captainHome: string; captainAway: string; playerHome: string; nightSlug: string; homeTeamId: string; awayTeamId: string; adminEmail: string };

export async function fixture(): Promise<Fixture> {
  const [m] = await sql<{ id: string; home_team_id: string; away_team_id: string; home: string; away: string; slug: string }>(`
    select m.id, m.home_team_id, m.away_team_id, h.name home, a.name away, n.slug
    from matches m join teams h on h.id = m.home_team_id join teams a on a.id = m.away_team_id join league_nights n on n.id = m.night_id
    where m.status = 'scheduled' and m.season_id = (select id from seasons where status='active') and m.scheduled_at > now() + interval '2 days'
    order by m.scheduled_at limit 1`);
  const email = async (team: string, role: string) => (await sql<{ email: string }>(`select p.email from team_memberships tm join players p on p.id = tm.player_id where tm.team_id=$1 and tm.role=$2 and p.email is not null limit 1`, [team, role]))[0].email;
  return { matchId: m.id, homeName: m.home, awayName: m.away, homeTeamId: m.home_team_id, awayTeamId: m.away_team_id, captainHome: await email(m.home_team_id, "captain"), captainAway: await email(m.away_team_id, "captain"), playerHome: await email(m.home_team_id, "player"), nightSlug: m.slug, adminEmail: "commissioner@example.com" };
}

export async function resetMatch(matchId: string) {
  await sql(`select public.admin_reset_match($1, 'e2e cleanup')`, [matchId]).catch(() => {});
  await sql(`update matches set status='scheduled', home_games=0, away_games=0, home_points=0, away_points=0, winner_team_id=null, submitted_by=null, submitted_at=null, submitting_team_id=null, confirmed_by=null, confirmed_at=null, auto_confirm_at=null, current_game=1, entry_mode=null where id=$1`, [matchId]);
  await sql(`delete from frames where game_id in (select id from games where match_id=$1)`, [matchId]);
  await sql(`delete from games where match_id=$1`, [matchId]);
  await sql(`delete from confirmations where match_id=$1`, [matchId]);
  await sql(`delete from disputes where match_id=$1`, [matchId]);
  await sql(`delete from score_submissions where match_id=$1`, [matchId]);
  await sql(`delete from messages where channel_id=(select id from channels where match_id=$1) and is_bot`, [matchId]);
}

export { expect };
