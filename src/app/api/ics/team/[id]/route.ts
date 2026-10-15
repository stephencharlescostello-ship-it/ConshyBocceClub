import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildIcs, matchToIcs } from "@/lib/ics";
import { MATCH_SELECT, type MatchRow } from "@/lib/data/league";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/ics/team/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: team } = await supabase.from("teams").select("id, name").eq("id", id).maybeSingle();
  if (!team) return new NextResponse("Not found", { status: 404 });
  const { data } = await supabase.from("matches").select(MATCH_SELECT).or(`home_team_id.eq.${id},away_team_id.eq.${id}`).not("status", "in", "(void)").order("scheduled_at");
  const { data: club } = await supabase.from("settings").select("value").eq("key", "club").maybeSingle();
  const address = String((club?.value as { address?: string } | null)?.address ?? "Conshohocken Bocce Club");
  const ics = buildIcs(`${team.name} · CBC Shuffle`, ((data ?? []) as unknown as MatchRow[]).map((m) => matchToIcs(m, address)));
  return new NextResponse(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `inline; filename="${team.name.replace(/[^a-z0-9]+/gi, "-")}.ics"`, "cache-control": "public, max-age=900" } });
}
