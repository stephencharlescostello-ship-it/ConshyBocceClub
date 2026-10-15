import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { publicEnv, requireEnv } from "@/lib/env";

/** Service-role client. Bypasses RLS — only use after an explicit authorization check. */
export function createAdminClient() {
  return createSupabaseClient<Database>(publicEnv.supabaseUrl, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
