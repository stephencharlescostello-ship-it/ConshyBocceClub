import { NextResponse } from "next/server";
import { getViewer } from "@/lib/data/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPostersPdf } from "@/lib/pdf/posters";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return new NextResponse("Admins only", { status: 403 });
  const admin = createAdminClient();
  const [{ data: tables }, { data: league }] = await Promise.all([admin.from("tables").select("name, qr_token").eq("active", true).order("sort_order"), admin.from("settings").select("value").eq("key", "league").maybeSingle()]);
  const club = String((league?.value as { club_name?: string } | null)?.club_name ?? "Conshohocken Bocce Club");
  const bytes = await buildPostersPdf((tables ?? []).map((t) => ({ name: t.name, url: `${publicEnv.siteUrl}/t/${t.qr_token}` })), publicEnv.siteUrl, club);
  return new NextResponse(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": 'inline; filename="cbc-shuffle-qr-posters.pdf"' } });
}
