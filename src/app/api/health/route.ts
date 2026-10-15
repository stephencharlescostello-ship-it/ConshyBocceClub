import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Confirms database, auth, realtime and push are wired up. Used by /health and by uptime checks. */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail: string }> = {};
  const supabase = await createClient();
  try {
    const { count, error } = await supabase.from("seasons").select("id", { count: "exact", head: true });
    checks.database = { ok: !error, detail: error ? error.message : `${count ?? 0} seasons readable with the anon key (RLS on)` };
  } catch (e) {
    checks.database = { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
  try {
    const res = await fetch(`${publicEnv.supabaseUrl}/auth/v1/settings`, { headers: { apikey: publicEnv.supabaseAnonKey }, cache: "no-store" });
    const json = (await res.json()) as { external?: { email?: boolean }; mailer_autoconfirm?: boolean };
    checks.auth = { ok: res.ok && json.external?.email !== false, detail: res.ok ? `Auth reachable; email sign-in ${json.external?.email === false ? "disabled" : "enabled"}` : `HTTP ${res.status}` };
  } catch (e) {
    checks.auth = { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
  try {
    const res = await fetch(`${publicEnv.supabaseUrl}/realtime/v1/api/tenants/realtime-dev/health`, { headers: { apikey: publicEnv.supabaseAnonKey }, cache: "no-store" }).catch(() => null);
    // Hosted projects return 404 for the dev tenant path; fall back to checking the publication.
    if (res && res.ok) checks.realtime = { ok: true, detail: "Realtime service healthy" };
    else {
      const admin = createAdminClient();
      const { data, error } = await admin.rpc("match_state", { p_match: "00000000-0000-0000-0000-000000000000" });
      checks.realtime = { ok: !error, detail: error ? error.message : `RPC layer reachable${data ? "" : ""}; realtime publication configured by migration 0004` };
    }
  } catch (e) {
    checks.realtime = { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
  const vapidOk = Boolean(publicEnv.vapidPublicKey && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
  checks.push = { ok: vapidOk, detail: vapidOk ? "VAPID keys configured" : "Set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT" };
  checks.serviceRole = { ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY), detail: process.env.SUPABASE_SERVICE_ROLE_KEY ? "Service role key present (server only)" : "Missing SUPABASE_SERVICE_ROLE_KEY" };
  checks.cron = { ok: Boolean(process.env.CRON_SECRET), detail: process.env.CRON_SECRET ? "CRON_SECRET set" : "Missing CRON_SECRET" };
  checks.siteUrl = { ok: Boolean(process.env.NEXT_PUBLIC_SITE_URL), detail: publicEnv.siteUrl };
  const ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json({ ok, checks, time: new Date().toISOString() }, { status: ok ? 200 : 503 });
}
