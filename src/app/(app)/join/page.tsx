import type { Metadata } from "next";
import { getViewer } from "@/lib/data/session";
import { getActiveSeason, getNights } from "@/lib/data/league";
import { createClient } from "@/lib/supabase/server";
import { JoinForms } from "./join-forms";

export const metadata: Metadata = { title: "Join your team" };

export default async function JoinPage() {
  const viewer = await getViewer();
  const season = await getActiveSeason();
  const supabase = await createClient();
  const nights = season ? await getNights(season.id) : [];
  // Unclaimed roster spots (imported players with no account yet) for the active season
  const { data: unclaimed } = season
    ? await supabase
        .from("team_memberships")
        .select("player_id, role, team:teams!inner(id, name, night_id, season_id), player:player_profiles!inner(id, display_name, has_account)")
        .eq("team.season_id", season.id)
        .eq("player.has_account", false)
    : { data: [] };
  const spots = (unclaimed ?? []).map((r) => {
    const team = r.team as unknown as { id: string; name: string; night_id: string };
    const player = r.player as unknown as { id: string; display_name: string };
    return { playerId: player.id, name: player.display_name, team: team.name, night: nights.find((n) => n.id === team.night_id)?.name ?? "" };
  });
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Join your team</h1>
      <p className="mt-2 text-muted">Ask your captain for the 6-character code, or claim your name from the roster.</p>
      <JoinForms spots={spots} alreadyOn={viewer?.memberships.map((m) => m.team.name) ?? []} />
    </>
  );
}
