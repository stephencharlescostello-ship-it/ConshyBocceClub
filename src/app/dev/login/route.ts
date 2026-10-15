import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { devLoginEnabled } from "@/lib/env";

/**
 * Development only: sign in as any seeded account without opening Mailpit.
 * Enabled when NODE_ENV=development and ALLOW_DEV_LOGIN=true. Returns 404 otherwise.
 */
export async function GET(request: NextRequest) {
  if (!devLoginEnabled) return new NextResponse("Not found", { status: 404 });
  const email = request.nextUrl.searchParams.get("as");
  const next = request.nextUrl.searchParams.get("next") ?? "/";
  const admin = createAdminClient();
  if (!email) {
    const { data } = await admin.from("players").select("display_name, email, is_admin, team_memberships(role, teams(name))").not("email", "is", null).order("is_admin", { ascending: false }).order("display_name").limit(400);
    const rows = (data ?? []).map((p) => {
      const teams = ((p.team_memberships as unknown as { role: string; teams: { name: string } | null }[]) ?? []).map((m) => `${m.teams?.name ?? ""}${m.role === "captain" ? " (C)" : ""}`).join(", ");
      return `<li><a href="/dev/login?as=${encodeURIComponent(p.email!)}&next=${encodeURIComponent(next)}">${p.display_name}</a> ${p.is_admin ? "<b>ADMIN</b>" : ""} <small>${teams}</small></li>`;
    });
    return new NextResponse(`<!doctype html><title>Dev login</title><body style="font-family:system-ui;background:#0b1f17;color:#f4efe3;padding:24px"><h1>Dev login</h1><p>Local development only. Pick an account:</p><ul style="line-height:2">${rows.join("")}</ul><style>a{color:#d4a73a}</style></body>`, { headers: { "content-type": "text/html" } });
  }
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) return new NextResponse(`Could not create link: ${error?.message ?? "unknown"}`, { status: 400 });
  const url = new URL("/auth/callback", request.nextUrl.origin);
  url.searchParams.set("token_hash", data.properties.hashed_token);
  url.searchParams.set("type", "magiclink");
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}
