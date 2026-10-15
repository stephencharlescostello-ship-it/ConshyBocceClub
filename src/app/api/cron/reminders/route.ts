import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPlayers } from "@/lib/server/notify";
import { fmtTime } from "@/lib/util/time";

export const dynamic = "force-dynamic";

/** Daily (9am ET): day-of reminders for events (to RSVP'd going/maybe players) and tonight's matches (to captains). */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const now = new Date();
  const end = new Date(now.getTime() + 24 * 3600_000);
  const { data: events } = await admin.from("events").select("id, title, starts_at, location, rsvps(player_id, status)").gte("starts_at", now.toISOString()).lt("starts_at", end.toISOString()).is("reminder_sent_at", null);
  let sent = 0;
  for (const e of events ?? []) {
    const ids = ((e.rsvps as { player_id: string; status: string }[]) ?? []).filter((r) => r.status !== "no").map((r) => r.player_id);
    const r = await notifyPlayers(ids, { type: "event_reminder", title: `Today: ${e.title}`, body: `${fmtTime(e.starts_at)}${e.location ? ` · ${e.location}` : ""}`, url: `/events/${e.id}` });
    sent += r.inbox;
    await admin.from("events").update({ reminder_sent_at: now.toISOString() }).eq("id", e.id);
  }
  // match-day nudge for captains
  const { data: matches } = await admin.from("matches").select("id, scheduled_at, home_team_id, away_team_id, table:tables(name), home:teams!matches_home_team_id_fkey(name), away:teams!matches_away_team_id_fkey(name)").gte("scheduled_at", now.toISOString()).lt("scheduled_at", end.toISOString()).eq("status", "scheduled");
  for (const m of matches ?? []) {
    const { data: caps } = await admin.from("team_memberships").select("player_id").in("team_id", [m.home_team_id, m.away_team_id].filter(Boolean) as string[]).eq("role", "captain");
    const r = await notifyPlayers((caps ?? []).map((c) => c.player_id), { type: "schedule_change", title: `Tonight: ${m.home?.name} vs ${m.away?.name}`, body: `${fmtTime(m.scheduled_at)} · ${(m.table as unknown as { name: string } | null)?.name ?? "Table TBD"}. Scan the table QR to keep score.`, url: `/matches/${m.id}`, tag: `tonight-${m.id}` });
    sent += r.inbox;
  }
  return NextResponse.json({ ok: true, sent });
}
