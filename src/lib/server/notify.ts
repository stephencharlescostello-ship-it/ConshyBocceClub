import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import type { Json } from "@/lib/supabase/database.types";

export type NotificationType = "score_confirm_request" | "score_confirmed" | "score_disputed" | "dispute_resolved" | "mention" | "announcement" | "event_reminder" | "sub_request" | "sub_claimed" | "sub_confirmed" | "schedule_change" | "badge" | "chat" | "dispute";

const PREF_FOR_TYPE: Record<NotificationType, keyof PrefRow | null> = {
  score_confirm_request: "scores", score_confirmed: "scores", score_disputed: "scores", dispute_resolved: "scores", dispute: null,
  mention: "mentions", announcement: "announcements", event_reminder: "events", sub_request: "subs", sub_claimed: "subs", sub_confirmed: "subs",
  schedule_change: "schedule", badge: null, chat: "chat",
};
type PrefRow = { scores: boolean; mentions: boolean; announcements: boolean; events: boolean; subs: boolean; schedule: boolean; chat: boolean };

let configured = false;
function ensureVapid() {
  if (configured) return true;
  const pub = publicEnv.vapidPublicKey;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", pub, priv);
  configured = true;
  return true;
}

export type Notice = { type: NotificationType; title: string; body?: string; url?: string; data?: Record<string, unknown>; tag?: string };

/**
 * Writes inbox rows for each player (always) and sends a Web Push to their devices
 * (when they have a subscription and their preference for this type is on).
 */
export async function notifyPlayers(playerIds: string[], notice: Notice, opts: { forcePush?: boolean } = {}) {
  const ids = Array.from(new Set(playerIds.filter(Boolean)));
  if (!ids.length) return { inbox: 0, pushed: 0 };
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("notifications")
    .insert(ids.map((player_id) => ({ player_id, type: notice.type, title: notice.title, body: notice.body ?? null, url: notice.url ?? null, data: (notice.data ?? {}) as NonNullable<Json> })))
    .select("id, player_id");
  let pushed = 0;
  if (!ensureVapid()) return { inbox: rows?.length ?? 0, pushed };
  const prefKey = PREF_FOR_TYPE[notice.type];
  const [{ data: subs }, { data: prefs }] = await Promise.all([
    admin.from("push_subscriptions").select("id, player_id, endpoint, p256dh, auth, failures").in("player_id", ids),
    admin.from("notification_prefs").select("*").in("player_id", ids),
  ]);
  const prefMap = new Map((prefs ?? []).map((p) => [p.player_id, p as unknown as PrefRow]));
  const payload = JSON.stringify({ title: notice.title, body: notice.body ?? "", url: notice.url ?? "/", tag: notice.tag });
  await Promise.all(
    (subs ?? []).map(async (s) => {
      const pref = prefMap.get(s.player_id);
      if (!opts.forcePush && prefKey && pref && pref[prefKey] === false) return;
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12 });
        pushed++;
        await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString(), failures: 0 }).eq("id", s.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        else await admin.from("push_subscriptions").update({ failures: (s.failures ?? 0) + 1 }).eq("id", s.id);
      }
    }),
  );
  const notified = rows?.map((r) => r.id) ?? [];
  if (pushed && notified.length) await admin.from("notifications").update({ pushed_at: new Date().toISOString() }).in("id", notified);
  return { inbox: rows?.length ?? 0, pushed };
}

/** Player ids of captains (or all members) of a team. */
export async function teamPlayerIds(teamId: string, role?: "captain") {
  const admin = createAdminClient();
  let q = admin.from("team_memberships").select("player_id").eq("team_id", teamId);
  if (role) q = q.eq("role", role);
  const { data } = await q;
  return (data ?? []).map((r) => r.player_id);
}

/** Player ids of everyone on a league night (or the whole active season). */
export async function nightPlayerIds(nightIds: string[] | null, seasonId: string) {
  const admin = createAdminClient();
  let q = admin.from("team_memberships").select("player_id, teams!inner(night_id, season_id)").eq("teams.season_id", seasonId);
  if (nightIds && nightIds.length) q = q.in("teams.night_id", nightIds);
  const { data } = await q;
  return Array.from(new Set((data ?? []).map((r) => r.player_id)));
}
