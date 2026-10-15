"use client";
import { getBrowserClient } from "./client";

/**
 * Realtime channels must carry the user's JWT or RLS-protected tables (chat) deliver nothing.
 * Call before subscribing: it loads the session from cookies and attaches the token to the socket.
 */
export async function realtimeClient() {
  const supabase = getBrowserClient();
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
  return supabase;
}
