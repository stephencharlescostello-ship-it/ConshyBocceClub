import { NextResponse, type NextRequest } from "next/server";
import { runAutoConfirm } from "@/lib/actions/scoring";

export const dynamic = "force-dynamic";

/** Vercel cron (daily on Hobby, hourly on Pro): confirms results past their confirmation window and announces them. */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ids = await runAutoConfirm();
  return NextResponse.json({ ok: true, confirmed: ids });
}
