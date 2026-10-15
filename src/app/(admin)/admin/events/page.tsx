import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/util/time";

export const metadata: Metadata = { title: "Events admin" };
export const dynamic = "force-dynamic";

export default async function EventsAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("id, title, kind, starts_at, rsvps(status)").order("starts_at", { ascending: false }).limit(100);
  return (
    <>
      <div className="flex items-center justify-between"><h1 className="font-display text-2xl font-extrabold">Events</h1><Link href="/admin/events/new" className="btn btn-primary !min-h-[40px] px-3 text-sm">New event</Link></div>
      <ul className="mt-4 flex flex-col gap-2">
        {(data ?? []).map((e) => <li key={e.id}><Link href={`/admin/events/${e.id}`} className="card flex items-center justify-between p-3 text-sm"><span><span className="font-semibold">{e.title}</span><span className="block text-xs text-muted">{e.kind} · {fmtDateTime(e.starts_at)}</span></span><span className="text-xs text-muted">{((e.rsvps as { status: string }[]) ?? []).filter((r) => r.status === "going").length} going</span></Link></li>)}
      </ul>
    </>
  );
}
