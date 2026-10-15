import { createClient } from "@/lib/supabase/server";
import { setScorekeeper } from "@/lib/actions/scoring";

/** Captains can hand the scorekeeper role to any player on either team. */
export async function ScorekeeperPicker({ matchId, current, teamIds }: { matchId: string; current: string | null; teamIds: string[] }) {
  const supabase = await createClient();
  const { data } = await supabase.from("team_memberships").select("player_id, team:teams(name), player:player_profiles(display_name)").in("team_id", teamIds);
  const options = (data ?? []).map((r) => ({ id: r.player_id, label: `${(r.player as unknown as { display_name: string } | null)?.display_name ?? "?"} (${(r.team as unknown as { name: string } | null)?.name ?? ""})` })).sort((a, b) => a.label.localeCompare(b.label));
  async function action(formData: FormData) {
    "use server";
    const v = String(formData.get("player") ?? "");
    await setScorekeeper(matchId, v || null);
  }
  return (
    <form action={action} className="mt-3 flex items-center gap-2 text-sm">
      <label htmlFor="sk" className="shrink-0 font-semibold">Scorekeeper</label>
      <select id="sk" name="player" defaultValue={current ?? ""} className="input !min-h-[44px] flex-1 py-1 text-sm">
        <option value="">Captains only</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <button className="btn btn-soft !min-h-[44px] px-3 text-sm">Save</button>
    </form>
  );
}
