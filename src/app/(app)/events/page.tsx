import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/data/session";
import { fmtDateTime } from "@/lib/util/time";
import { Empty } from "@/components/ui/empty";

export const metadata: Metadata = { title: "Events" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { tournament: "Tournament", social: "Social", playoffs: "Playoffs", banquet: "Banquet", deadline: "Deadline", other: "Event" };

export default async function EventsPage() {
  const supabase = await createClient();
  const viewer = await getViewer();
  const now = new Date().toISOString();
  const [{ data: upcoming }, { data: past }, { data: mine }] = await Promise.all([
    supabase.from("events").select("id, title, kind, starts_at, location, cover_url, target_night_ids, rsvps(status)").gte("starts_at", now).order("starts_at"),
    supabase.from("events").select("id, title, kind, starts_at, location").lt("starts_at", now).order("starts_at", { ascending: false }).limit(10),
    viewer ? supabase.from("rsvps").select("event_id, status").eq("player_id", viewer.player.id) : Promise.resolve({ data: [] }),
  ]);
  const myStatus = new Map((mine ?? []).map((r) => [r.event_id, r.status]));
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Events</h1>
      {!upcoming?.length && <div className="mt-4"><Empty title="Nothing on the calendar yet" /></div>}
      <ul className="mt-4 flex flex-col gap-3">
        {(upcoming ?? []).map((e) => {
          const going = ((e.rsvps as { status: string }[]) ?? []).filter((r) => r.status === "going").length;
          return (
            <li key={e.id}>
              <Link href={`/events/${e.id}`} className="card block overflow-hidden">
                {e.cover_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={e.cover_url} alt="" className="h-32 w-full object-cover" />}
                <div className="p-4">
                  <div className="flex items-center justify-between"><span className="chip">{KIND_LABEL[e.kind] ?? e.kind}</span>{myStatus.get(e.id) && <span className="chip bg-primary-soft text-success">You: {myStatus.get(e.id)}</span>}</div>
                  <p className="mt-2 font-display text-lg font-bold">{e.title}</p>
                  <p className="flex items-center gap-1 text-sm text-muted"><CalendarDays className="h-4 w-4" /> {fmtDateTime(e.starts_at)}</p>
                  {e.location && <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="h-4 w-4" /> {e.location}</p>}
                  {e.kind !== "deadline" && <p className="mt-1 text-xs text-subtle">{going} going</p>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {past?.length ? (
        <>
          <h2 className="mt-6 font-display text-lg font-bold">Past</h2>
          <ul className="mt-2 flex flex-col gap-2">{past.map((e) => <li key={e.id}><Link href={`/events/${e.id}`} className="card flex items-center justify-between p-3 text-sm"><span className="font-semibold">{e.title}</span><span className="text-muted">{fmtDateTime(e.starts_at)}</span></Link></li>)}</ul>
        </>
      ) : null}
    </>
  );
}
