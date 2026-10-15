import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { CardFrame, CARD_H, CARD_W } from "@/lib/cards/frame";
import { fmtDate } from "@/lib/util/time";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/cards/match/[id]">) {
  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { data: m } = await admin.from("matches").select("*, home:teams!matches_home_team_id_fkey(name, color), away:teams!matches_away_team_id_fkey(name, color), night:league_nights(name), week:weeks(number)").eq("id", id).maybeSingle();
  if (!m || !m.home || !m.away) return new Response("Not found", { status: 404 });
  const { data: games } = await admin.from("games").select("number, home_score, away_score").eq("match_id", id).order("number");
  const homeWon = m.winner_team_id === m.home_team_id;
  const Row = ({ name, color, games: g, pts, won }: { name: string; color: string; games: number; pts: number; won: boolean }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "28px 36px", borderRadius: 28, background: won ? "rgba(212,167,58,0.16)" : "rgba(255,255,255,0.05)", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, maxWidth: 640 }}>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: color, display: "flex" }} />
        <div style={{ fontSize: 48, fontWeight: won ? 800 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <div style={{ fontSize: 110, fontWeight: 800, color: won ? "#d4a73a" : "#b9c8bf" }}>{g}</div>
        <div style={{ fontSize: 30, color: "#7f978c" }}>{pts} pts</div>
      </div>
    </div>
  );
  return new ImageResponse(
    (
      <CardFrame kicker={`${m.night?.name ?? ""} · Week ${m.week?.number ?? ""} · ${m.status === "forfeit" ? "Forfeit" : "Final"}`} title={`${homeWon ? m.home.name : m.away.name} win`} footer={fmtDate(m.scheduled_at)}>
        <Row name={m.home.name} color={m.home.color} games={m.home_games} pts={m.home_points} won={homeWon} />
        <Row name={m.away.name} color={m.away.color} games={m.away_games} pts={m.away_points} won={!homeWon} />
        {games?.length ? (
          <div style={{ display: "flex", gap: 20, marginTop: 30 }}>
            {games.map((g) => (
              <div key={g.number} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 28px", borderRadius: 20, background: "rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 22, color: "#7f978c", textTransform: "uppercase", letterSpacing: 3 }}>Game {g.number}</div>
                <div style={{ fontSize: 54, fontWeight: 800 }}>{g.home_score}–{g.away_score}</div>
              </div>
            ))}
          </div>
        ) : null}
      </CardFrame>
    ),
    { width: CARD_W, height: CARD_H, headers: { "cache-control": "public, max-age=300" } },
  );
}
