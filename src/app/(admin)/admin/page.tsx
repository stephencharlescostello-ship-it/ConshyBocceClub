import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveSeason } from "@/lib/data/league";
import { fmtDateTime } from "@/lib/util/time";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const supabase = await createClient();
  const season = await getActiveSeason();
  const sid = season?.id ?? "00000000-0000-0000-0000-000000000000";
  const [disputes, pending, teams, players, reports, subs, upcoming] = await Promise.all([
    supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("teams").select("id", { count: "exact", head: true }).eq("season_id", sid),
    supabase.from("team_memberships").select("player_id, teams!inner(season_id)").eq("teams.season_id", sid),
    supabase.from("message_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("sub_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("matches").select("id, scheduled_at, status, home:teams!matches_home_team_id_fkey(name), away:teams!matches_away_team_id_fkey(name)").eq("season_id", sid).in("status", ["live", "submitted", "disputed"]).order("scheduled_at", { ascending: false }).limit(8),
  ]);
  const tiles = [
    { label: "Open disputes", value: disputes.count ?? 0, href: "/admin/results?tab=disputes", warn: (disputes.count ?? 0) > 0 },
    { label: "Awaiting confirmation", value: pending.count ?? 0, href: "/admin/results?tab=pending" },
    { label: "Reported messages", value: reports.count ?? 0, href: "/admin/moderation", warn: (reports.count ?? 0) > 0 },
    { label: "Open sub requests", value: subs.count ?? 0, href: "/subs" },
    { label: "Teams", value: teams.count ?? 0, href: "/admin/teams" },
    { label: "Rostered players", value: new Set((players.data ?? []).map((p) => p.player_id)).size, href: "/admin/users" },
  ];
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{season ? season.name : "No active season"}</h1>
      <p className="mt-1 text-sm text-muted">{season ? `Week schedule, results and chat are live. ` : "Create or activate a season to get started. "}<Link href="/admin/seasons" className="text-accent underline">Season settings</Link></p>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className={`card p-4 ${t.warn ? "border-danger/60" : ""}`}>
            <p className="text-xs uppercase tracking-wider text-subtle">{t.label}</p>
            <p className={`font-display text-3xl font-extrabold ${t.warn ? "text-danger" : ""}`}>{t.value}</p>
          </Link>
        ))}
      </div>
      <h2 className="mt-6 font-display text-lg font-bold">Needs attention</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {(upcoming.data ?? []).map((m) => (
          <li key={m.id}><Link href={`/admin/results/${m.id}`} className="card flex items-center justify-between p-3 text-sm"><span>{m.home?.name} vs {m.away?.name}</span><span className="text-muted">{m.status} · {fmtDateTime(m.scheduled_at)}</span></Link></li>
        ))}
        {!upcoming.data?.length && <li className="text-sm text-muted">Nothing live, pending or disputed right now.</li>}
      </ul>
      <h2 className="mt-6 font-display text-lg font-bold">Quick actions</h2>
      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Link href="/admin/announcements" className="btn btn-soft">Post announcement</Link>
        <Link href="/admin/schedule" className="btn btn-soft">Generate schedule</Link>
        <Link href="/admin/import" className="btn btn-soft">Import CSV</Link>
        <Link href="/admin/posters" className="btn btn-soft">Print QR posters</Link>
      </div>
    </>
  );
}
