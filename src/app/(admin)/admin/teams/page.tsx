import type { Metadata } from "next";
import Link from "next/link";
import { getActiveSeason, getNights, getTables, getSeasons } from "@/lib/data/league";
import { createClient } from "@/lib/supabase/server";
import { TeamsAdmin } from "@/components/admin/teams-admin";

export const metadata: Metadata = { title: "Teams" };
export const dynamic = "force-dynamic";

export default async function TeamsAdminPage(props: PageProps<"/admin/teams">) {
  const sp = await props.searchParams;
  const seasons = await getSeasons();
  const season = (typeof sp.season === "string" ? seasons.find((s) => s.id === sp.season) : null) ?? (await getActiveSeason()) ?? seasons[0];
  if (!season) return <p>Create a season first. <Link href="/admin/seasons" className="text-accent underline">Seasons</Link></p>;
  const supabase = await createClient();
  const [nights, tables, { data: teams }] = await Promise.all([
    getNights(season.id), getTables(),
    supabase.from("teams").select("id, night_id, name, color, slug, team_secrets(join_code), team_memberships(role, player:player_profiles(id, display_name, has_account))").eq("season_id", season.id).order("name"),
  ]);
  const { data: allTables } = await supabase.from("tables").select("*").order("sort_order");
  void tables;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="font-display text-2xl font-extrabold">Nights, teams &amp; rosters</h1>
        <form className="flex items-center gap-2 text-sm"><label htmlFor="season" className="font-semibold">Season</label><select id="season" name="season" defaultValue={season.id} className="input !min-h-[40px] w-auto py-1" onChange={undefined}>{seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button className="btn btn-soft !min-h-[40px] px-3">Go</button></form>
      </div>
      <TeamsAdmin
        seasonId={season.id}
        nights={nights.map((n) => ({ id: n.id, name: n.name, weekday: n.weekday, start_time: n.start_time, slot_times: n.slot_times as string[] }))}
        teams={(teams ?? []).map((t) => ({ id: t.id, nightId: t.night_id, name: t.name, color: t.color, joinCode: (t.team_secrets as unknown as { join_code: string } | null)?.join_code ?? "", members: ((t.team_memberships as unknown as { role: string; player: { id: string; display_name: string; has_account: boolean } | null }[]) ?? []).filter((m) => m.player).map((m) => ({ id: m.player!.id, name: m.player!.display_name, role: m.role, hasAccount: m.player!.has_account })) }))}
        tables={(allTables ?? []).map((t) => ({ id: t.id, name: t.name, active: t.active, token: t.qr_token }))}
      />
    </>
  );
}
