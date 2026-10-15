import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { CardFrame, CARD_H, CARD_W } from "@/lib/cards/frame";
import { roundName } from "@/lib/engine/playoffs";

export const dynamic = "force-dynamic";

/** Playoff win card for a playoff match (id = match id). */
export async function GET(_req: Request, ctx: RouteContext<"/api/cards/playoff/[id]">) {
  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { data: m } = await admin.from("matches").select("*, home:teams!matches_home_team_id_fkey(name, color), away:teams!matches_away_team_id_fkey(name, color), night:league_nights(name), bracket:playoff_brackets(name, champion_team_id)").eq("id", id).maybeSingle();
  if (!m || !m.home || !m.away || !m.playoff_round || !m.winner_team_id) return new Response("Not a finished playoff match", { status: 404 });
  const { data: slots } = await admin.from("playoff_slots").select("round").eq("bracket_id", m.bracket_id!);
  const total = Math.max(1, ...(slots ?? []).map((s) => s.round));
  const winner = m.winner_team_id === m.home_team_id ? m.home : m.away;
  const loser = winner === m.home ? m.away : m.home;
  const isChamp = (m.bracket as unknown as { champion_team_id: string | null } | null)?.champion_team_id === m.winner_team_id && m.playoff_round === total;
  return new ImageResponse(
    (
      <CardFrame kicker={`${m.night?.name ?? ""} playoffs · ${roundName(m.playoff_round, total)}`} title={isChamp ? `${winner.name} are champions` : `${winner.name} advance`}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 60 }}>
          <div style={{ fontSize: 200 }}>{isChamp ? "🏆" : "🪝"}</div>
          <div style={{ fontSize: 120, fontWeight: 800, color: "#d4a73a" }}>{Math.max(m.home_games, m.away_games)}–{Math.min(m.home_games, m.away_games)}</div>
          <div style={{ fontSize: 40, color: "#b9c8bf" }}>over {loser.name}</div>
          <div style={{ fontSize: 30, color: "#7f978c", marginTop: 20 }}>Points {m.winner_team_id === m.home_team_id ? m.home_points : m.away_points}–{m.winner_team_id === m.home_team_id ? m.away_points : m.home_points}</div>
        </div>
      </CardFrame>
    ),
    { width: CARD_W, height: CARD_H, headers: { "cache-control": "public, max-age=300" } },
  );
}
