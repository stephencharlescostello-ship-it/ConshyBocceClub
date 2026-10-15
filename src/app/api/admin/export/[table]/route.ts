import { NextResponse } from "next/server";
import { getViewer } from "@/lib/data/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv } from "@/lib/import/csv";

export const dynamic = "force-dynamic";

const EXPORTS: Record<string, { select: string; from: string; order?: string }> = {
  teams: { from: "teams", select: "id, name, slug, color, night:league_nights(name), season:seasons(name)" },
  players: { from: "players", select: "id, display_name, nickname, email, phone, is_admin, created_at, team_memberships(role, teams(name, night:league_nights(name), season:seasons(name)))" },
  matches: { from: "matches", select: "id, scheduled_at, status, entry_mode, home:teams!matches_home_team_id_fkey(name), away:teams!matches_away_team_id_fkey(name), home_games, away_games, home_points, away_points, winner:teams!matches_winner_team_id_fkey(name), forfeit:teams!matches_forfeit_team_id_fkey(name), night:league_nights(name), week:weeks(number), table:tables(name), season:seasons(name), notes", order: "scheduled_at" },
  games: { from: "games", select: "id, match_id, number, home_score, away_score, status, home_lineup, away_lineup, frame_count" },
  frames: { from: "frames", select: "id, game_id, number, scoring_team_id, points, hangers, weights, recorded_at" },
  standings: { from: "team_records", select: "*" },
  events: { from: "events", select: "id, title, kind, starts_at, ends_at, location, description, rsvps(status)" },
  rsvps: { from: "rsvps", select: "event:events(title), player:players(display_name), status, updated_at" },
  announcements: { from: "announcements", select: "id, title, body, pinned, push, published_at" },
  dues: { from: "dues", select: "season:seasons(name), player:players(display_name, email), amount_cents, paid, paid_at, note" },
  sub_requests: { from: "sub_requests", select: "id, team:teams(name), needed_at, status, note, claimed_by, created_at" },
  messages: { from: "messages", select: "id, channel:channels(name), author:players(display_name), is_bot, body, created_at, deleted_at" },
  audit_log: { from: "audit_log", select: "*", order: "created_at" },
  badges: { from: "player_badges", select: "player:players(display_name), badge_slug, awarded_at" },
  awards: { from: "awards", select: "season:seasons(name), kind, week_number, player:players(display_name), team:teams(name), value, details" },
};
export const EXPORT_TABLES = Object.keys(EXPORTS);

function flatten(row: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v as Record<string, unknown>, `${prefix}${k}_`));
    else out[`${prefix}${k}`] = Array.isArray(v) ? JSON.stringify(v) : v;
  }
  return out;
}

export async function GET(_req: Request, ctx: RouteContext<"/api/admin/export/[table]">) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return new NextResponse("Admins only", { status: 403 });
  const { table } = await ctx.params;
  const spec = EXPORTS[table];
  if (!spec) return new NextResponse("Unknown export", { status: 404 });
  const admin = createAdminClient();
  let q = admin.from(spec.from as never).select(spec.select).limit(50000);
  if (spec.order) q = q.order(spec.order);
  const { data, error } = await q;
  if (error) return new NextResponse(error.message, { status: 500 });
  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => flatten(r));
  return new NextResponse(toCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="cbc-${table}-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
