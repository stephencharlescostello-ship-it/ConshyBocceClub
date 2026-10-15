import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Table QR deep link: /t/<token> → the match on that table happening now (or next), or the schedule.
 * Captains land on the scorekeeper; everyone else on the live view.
 */
export async function GET(_req: Request, ctx: RouteContext<"/t/[token]">) {
  const { token } = await ctx.params;
  const admin = createAdminClient();
  const { data: table } = await admin.from("tables").select("id, name").eq("qr_token", token).maybeSingle();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  if (!table) return NextResponse.redirect(new URL("/schedule", origin));
  const now = Date.now();
  const from = new Date(now - 3 * 3600_000).toISOString();
  const to = new Date(now + 12 * 3600_000).toISOString();
  const { data: matches } = await admin.from("matches").select("id, scheduled_at, status, home_team_id, away_team_id").eq("table_id", table.id).gte("scheduled_at", from).lte("scheduled_at", to).in("status", ["scheduled", "live", "submitted"]).order("scheduled_at");
  const live = matches?.find((m) => m.status === "live");
  const current = live ?? matches?.find((m) => new Date(m.scheduled_at).getTime() <= now + 20 * 60_000 && m.status !== "submitted") ?? matches?.[0];
  if (!current) return NextResponse.redirect(new URL(`/schedule?table=${table.id}`, origin));
  const supabase = await createClient();
  const { data: canScore } = await supabase.rpc("can_score_match", { p_match: current.id });
  return NextResponse.redirect(new URL(canScore ? `/matches/${current.id}/score` : `/matches/${current.id}`, origin));
}
