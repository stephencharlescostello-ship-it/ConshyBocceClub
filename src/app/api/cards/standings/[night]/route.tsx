import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { CardFrame, CARD_H, CARD_W } from "@/lib/cards/frame";
import { computeStandings } from "@/lib/engine/standings";
import { parseFormat } from "@/lib/engine/format";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/cards/standings/[night]">) {
  const { night: nightId } = await ctx.params;
  const admin = createAdminClient();
  const { data: night } = await admin.from("league_nights").select("id, name, season:seasons(id, name, tiebreakers, format)").eq("id", nightId).maybeSingle();
  if (!night) return new Response("Not found", { status: 404 });
  const season = night.season as unknown as { id: string; name: string; tiebreakers: string[]; format: unknown };
  void parseFormat(season.format);
  const [{ data: teams }, { data: results }] = await Promise.all([
    admin.from("teams").select("id, name, color").eq("night_id", night.id),
    admin.from("matches").select("id, home_team_id, away_team_id, winner_team_id, home_games, away_games, home_points, away_points, status, scheduled_at, forfeit_team_id").eq("night_id", night.id).in("status", ["confirmed", "forfeit"]).is("playoff_round", null),
  ]);
  const rows = computeStandings((teams ?? []).map((t) => ({ id: t.id, name: t.name })), (results ?? []).filter((r) => r.home_team_id && r.away_team_id).map((r) => ({ id: r.id, homeTeamId: r.home_team_id!, awayTeamId: r.away_team_id!, winnerTeamId: r.winner_team_id, homeGames: r.home_games, awayGames: r.away_games, homePoints: r.home_points, awayPoints: r.away_points, status: r.status as "confirmed" | "forfeit", scheduledAt: r.scheduled_at, forfeitTeamId: r.forfeit_team_id })), (season.tiebreakers as never) ?? undefined);
  const weeks = Math.max(0, ...rows.map((r) => r.played));
  return new ImageResponse(
    (
      <CardFrame kicker={`${season.name} · after ${weeks} match${weeks === 1 ? "" : "es"}`} title={`${night.name} standings`}>
        {rows.map((r, i) => (
          <div key={r.teamId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 32px", borderRadius: 24, background: i < 4 ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)", marginBottom: 16, borderBottom: i === 3 ? "4px dashed #d4a73a" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 22, maxWidth: 700 }}>
              <div style={{ fontSize: 44, fontWeight: 800, color: "#d4a73a", width: 56 }}>{r.rank}</div>
              <div style={{ width: 22, height: 22, borderRadius: 11, background: (teams ?? []).find((t) => t.id === r.teamId)?.color ?? "#2f8f5f", display: "flex" }} />
              <div style={{ fontSize: 42, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
              <div style={{ fontSize: 50, fontWeight: 800 }}>{r.wins}–{r.losses}</div>
              <div style={{ fontSize: 28, color: "#7f978c", width: 90, textAlign: "right" }}>{r.pointDiff > 0 ? "+" : ""}{r.pointDiff}</div>
            </div>
          </div>
        ))}
      </CardFrame>
    ),
    { width: CARD_W, height: CARD_H, headers: { "cache-control": "public, max-age=300" } },
  );
}
