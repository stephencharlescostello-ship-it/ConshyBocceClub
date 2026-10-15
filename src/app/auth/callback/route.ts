import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bootstrapAdminIfListed } from "@/lib/actions/auth";

/** Magic-link landing: exchanges the PKCE code (or token_hash) for a session, then continues. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") ?? "/onboarding";
  const supabase = await createClient();
  let error: string | null = null;
  if (code) {
    const res = await supabase.auth.exchangeCodeForSession(code);
    error = res.error?.message ?? null;
  } else if (tokenHash && type) {
    const res = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "email" | "magiclink" });
    error = res.error?.message ?? null;
  } else {
    error = "Missing sign-in code";
  }
  if (error) {
    const dest = new URL("/sign-in", url.origin);
    dest.searchParams.set("error", "That link has expired or was already used. Request a new one, or enter the 6-digit code from the email.");
    return NextResponse.redirect(dest);
  }
  await bootstrapAdminIfListed();
  const safeNext = next.startsWith("/") ? next : "/onboarding";
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
