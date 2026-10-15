import "server-only";
import { createClient } from "@/lib/supabase/server";
import { roundName } from "@/lib/engine/playoffs";

export type BracketView = {
  id: string; name: string; status: string; nightId: string | null; championId: string | null; kind: string;
  rounds: { round: number; name: string; matches: { position: number; a: SlotView; b: SlotView; match: { id: string; status: string; home_team_id: string | null; home_games: number; away_games: number; winner_team_id: string | null; scheduled_at: string } | null }[] }[];
};
export type SlotView = { seed: number | null; teamId: string | null; teamName: string | null; color: string | null };

export async function getBrackets(seasonId: string): Promise<BracketView[]> {
  const supabase = await createClient();
  const { data: brackets } = await supabase.from("playoff_brackets").select("*, slots:playoff_slots(*)").eq("season_id", seasonId).order("kind");
  if (!brackets?.length) return [];
  const teamIds = new Set<string>();
  const matchIds = new Set<string>();
  for (const b of brackets) for (const s of b.slots as { team_id: string | null; match_id: string | null }[]) { if (s.team_id) teamIds.add(s.team_id); if (s.match_id) matchIds.add(s.match_id); }
  const [{ data: teams }, { data: matches }] = await Promise.all([
    teamIds.size ? supabase.from("teams").select("id, name, color").in("id", Array.from(teamIds)) : Promise.resolve({ data: [] }),
    matchIds.size ? supabase.from("matches").select("id, status, home_team_id, home_games, away_games, winner_team_id, scheduled_at").in("id", Array.from(matchIds)) : Promise.resolve({ data: [] }),
  ]);
  const team = (id: string | null) => (id ? teams?.find((t) => t.id === id) ?? null : null);
  return brackets.map((b) => {
    const slots = (b.slots as { round: number; position: number; seed: number | null; team_id: string | null; match_id: string | null }[]).sort((x, y) => x.round - y.round || x.position - y.position);
    const total = Math.max(...slots.map((s) => s.round));
    const rounds: BracketView["rounds"] = [];
    for (let r = 1; r <= total; r++) {
      const rs = slots.filter((s) => s.round === r);
      const ms: BracketView["rounds"][number]["matches"] = [];
      for (let i = 0; i < rs.length; i += 2) {
        const a = rs[i], bb = rs[i + 1];
        const toView = (s: typeof a): SlotView => ({ seed: s?.seed ?? null, teamId: s?.team_id ?? null, teamName: team(s?.team_id ?? null)?.name ?? null, color: team(s?.team_id ?? null)?.color ?? null });
        ms.push({ position: i / 2 + 1, a: toView(a), b: toView(bb), match: (matches ?? []).find((m) => m.id === (a?.match_id ?? bb?.match_id)) ?? null });
      }
      rounds.push({ round: r, name: roundName(r, total), matches: ms });
    }
    return { id: b.id, name: b.name, status: b.status, nightId: b.night_id, championId: b.champion_team_id, kind: b.kind, rounds };
  });
}
