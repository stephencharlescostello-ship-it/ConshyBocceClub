import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/data/session";
import { relative } from "@/lib/util/time";
import { clearNotifications, markNotificationsRead } from "@/lib/actions/events";
import { Empty } from "@/components/ui/empty";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=/notifications");
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").eq("player_id", viewer.player.id).order("created_at", { ascending: false }).limit(100);
  const unread = (data ?? []).filter((n) => !n.read_at).map((n) => n.id);
  return (
    <>
      <div className="flex items-end justify-between">
        <h1 className="font-display text-3xl font-extrabold">Notifications</h1>
        <div className="flex gap-2">
          {unread.length > 0 && <form action={markNotificationsRead.bind(null, undefined)}><button className="btn btn-ghost !min-h-[40px] px-3 text-sm">Mark all read</button></form>}
          {data?.length ? <form action={clearNotifications}><button className="btn btn-ghost !min-h-[40px] px-3 text-sm text-danger">Clear</button></form> : null}
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">Your inbox keeps everything, even when push notifications are off. <Link href="/settings" className="text-accent underline">Notification settings</Link></p>
      {!data?.length && <div className="mt-4"><Empty title="All quiet" icon={<Bell className="h-8 w-8" />} /></div>}
      <ul className="mt-4 flex flex-col gap-2">
        {(data ?? []).map((n) => (
          <li key={n.id}>
            <Link href={n.url ?? "/notifications"} className={`card block p-3 ${!n.read_at ? "border-accent/50" : ""}`}>
              <div className="flex items-start gap-2">
                {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{n.title}</span>
                  {n.body && <span className="block text-sm text-muted">{n.body}</span>}
                  <span className="block text-xs text-subtle">{relative(n.created_at)}</span>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {unread.length > 0 && <form action={markNotificationsRead.bind(null, unread)} className="hidden" />}
    </>
  );
}
