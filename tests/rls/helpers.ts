import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const DB_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    const r = await c.query(text, params);
    return r.rows as T[];
  } finally {
    await c.end();
  }
}

export const admin = () => createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
export const anon = () => createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

/** Signs in as a seeded user via an admin-generated magic link token (no email needed). */
export async function asUser(email: string): Promise<SupabaseClient<Database>> {
  const a = admin();
  const { data, error } = await a.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error(`generateLink failed for ${email}: ${error?.message}`);
  const c = createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: e2 } = await c.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (e2) throw e2;
  return c;
}

export type Fixture = { seasonId: string; nightId: string; teamA: string; teamB: string; teamC: string; captainA: string; captainB: string; playerA: string; captainC: string; matchAB: string };

/** Finds a scheduled match on the active season and the captains involved, plus a third team's captain. */
export async function fixture(): Promise<Fixture> {
  const [m] = await sql<{ id: string; season_id: string; night_id: string; home_team_id: string; away_team_id: string }>(
    `select id, season_id, night_id, home_team_id, away_team_id from matches where status = 'scheduled' and season_id = (select id from seasons where status='active') and scheduled_at > now() + interval '1 day' order by scheduled_at limit 1`);
  const cap = async (team: string, role = "captain") => (await sql<{ email: string }>(`select p.email from team_memberships tm join players p on p.id = tm.player_id where tm.team_id = $1 and tm.role = $2 and p.email is not null limit 1`, [team, role]))[0].email;
  const [c] = await sql<{ id: string }>(`select id from teams where night_id = $1 and id not in ($2, $3) limit 1`, [m.night_id, m.home_team_id, m.away_team_id]);
  return { seasonId: m.season_id, nightId: m.night_id, teamA: m.home_team_id, teamB: m.away_team_id, teamC: c.id, captainA: await cap(m.home_team_id), captainB: await cap(m.away_team_id), playerA: await cap(m.home_team_id, "player"), captainC: await cap(c.id), matchAB: m.id };
}
