import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getActiveSeason, getSettings } from "@/lib/data/league";
import { DuesTable } from "@/components/admin/dues-table";
import { markAllDues } from "@/lib/actions/admin-users";

export const metadata: Metadata = { title: "Dues" };
export const dynamic = "force-dynamic";

export default async function DuesAdmin() {
  const season = await getActiveSeason();
  if (!season) return <p>No active season.</p>;
  const supabase = await createClient();
  const settings = await getSettings();
  const amount = Number((settings.dues?.amount_cents as number | undefined) ?? 4000);
  const [{ data: members }, { data: dues }] = await Promise.all([
    supabase.from("team_memberships").select("player_id, role, player:players(id, display_name, email), teams!inner(name, season_id, night:league_nights(name))").eq("teams.season_id", season.id),
    supabase.from("dues").select("*").eq("season_id", season.id),
  ]);
  const byPlayer = new Map<string, { id: string; name: string; email: string | null; teams: string[] }>();
  for (const m of members ?? []) {
    const p = m.player as unknown as { id: string; display_name: string; email: string | null } | null;
    if (!p) continue;
    const t = m.teams as unknown as { name: string; night: { name: string } | null };
    const e = byPlayer.get(p.id) ?? { id: p.id, name: p.display_name, email: p.email, teams: [] };
    e.teams.push(`${t.name} (${t.night?.name?.slice(0, 3)})`);
    byPlayer.set(p.id, e);
  }
  const rows = Array.from(byPlayer.values()).sort((a, b) => a.name.localeCompare(b.name)).map((p) => { const d = dues?.find((x) => x.player_id === p.id); return { ...p, teams: p.teams.join(", "), amount: (d?.amount_cents ?? amount) / 100, paid: d?.paid ?? false, note: d?.note ?? "" }; });
  const paidCount = rows.filter((r) => r.paid).length;
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Dues — {season.name}</h1>
      <p className="mt-1 text-sm text-muted">{paidCount} of {rows.length} paid · ${(rows.filter((r) => r.paid).reduce((a, r) => a + r.amount, 0)).toFixed(2)} collected. Tracking only; no payments are processed here.</p>
      <form action={async () => { "use server"; await markAllDues(season.id, amount); }} className="mt-2"><button className="btn btn-soft !min-h-[40px] px-3 text-sm">Add every rostered player at ${(amount / 100).toFixed(2)}</button></form>
      <DuesTable seasonId={season.id} rows={rows} />
    </>
  );
}
