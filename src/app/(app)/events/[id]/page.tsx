import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, CalendarPlus, Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/data/session";
import { fmtDateTime } from "@/lib/util/time";
import { googleCalendarUrl } from "@/lib/ics";
import { RsvpButtons } from "@/components/events/rsvp-buttons";
import { Avatar } from "@/components/ui/avatar";

export async function generateMetadata(props: PageProps<"/events/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("title").eq("id", id).maybeSingle();
  return { title: data?.title ?? "Event" };
}
export const dynamic = "force-dynamic";

export default async function EventPage(props: PageProps<"/events/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const [{ data: e }, viewer] = await Promise.all([supabase.from("events").select("*").eq("id", id).maybeSingle(), getViewer()]);
  if (!e) notFound();
  const { data: rsvps } = await supabase.from("rsvps").select("status, player:player_profiles(id, display_name, avatar_url)").eq("event_id", id);
  const going = (rsvps ?? []).filter((r) => r.status === "going");
  const maybe = (rsvps ?? []).filter((r) => r.status === "maybe");
  const mine = viewer ? (rsvps ?? []).find((r) => (r.player as unknown as { id: string } | null)?.id === viewer.player.id)?.status ?? null : null;
  const start = new Date(e.starts_at);
  const end = e.ends_at ? new Date(e.ends_at) : new Date(start.getTime() + 2 * 3600_000);
  const nightNames = e.target_night_ids.length ? (await supabase.from("league_nights").select("name").in("id", e.target_night_ids)).data?.map((n) => n.name).join(", ") : null;
  return (
    <>
      {e.cover_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={e.cover_url} alt="" className="-mx-4 -mt-4 mb-4 h-44 w-[calc(100%+2rem)] max-w-none object-cover" />}
      <div className="flex items-start justify-between gap-2">
        <h1 className="font-display text-2xl font-extrabold">{e.title}</h1>
        {viewer?.isAdmin && <Link href={`/admin/events/${e.id}`} className="btn btn-ghost !min-h-[40px] px-2 text-sm"><Pencil className="h-4 w-4" /> Edit</Link>}
      </div>
      <p className="mt-2 flex items-center gap-2 text-muted"><CalendarDays className="h-5 w-5" /> {fmtDateTime(e.starts_at)}{e.ends_at ? ` – ${fmtDateTime(e.ends_at).split("· ")[1]}` : ""}</p>
      {e.location && <p className="flex items-center gap-2 text-muted"><MapPin className="h-5 w-5" /> {e.location}</p>}
      {nightNames && <p className="mt-1 text-xs text-subtle">For: {nightNames}</p>}
      {e.description && <div className="prose-md mt-3"><ReactMarkdown>{e.description}</ReactMarkdown></div>}
      <a href={googleCalendarUrl({ summary: e.title, start, end, description: e.description ?? undefined, location: e.location ?? undefined })} target="_blank" rel="noreferrer" className="btn btn-soft mt-4 w-full"><CalendarPlus className="h-5 w-5" /> Add to calendar</a>
      {e.rsvp_enabled && e.kind !== "deadline" && (
        <section className="card mt-4 p-4" aria-labelledby="rsvp">
          <h2 id="rsvp" className="font-display font-bold">Are you in?</h2>
          {viewer ? <RsvpButtons eventId={e.id} current={mine as "going" | "maybe" | "no" | null} /> : <Link href={`/sign-in?next=/events/${e.id}`} className="btn btn-primary mt-3 w-full">Sign in to RSVP</Link>}
          <p className="mt-3 text-sm text-muted">{going.length} going · {maybe.length} maybe</p>
          {going.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {going.map((r, i) => { const p = r.player as unknown as { id: string; display_name: string; avatar_url: string | null } | null; return p ? <li key={i}><Link href={`/players/${p.id}`} className="flex items-center gap-1 text-sm"><Avatar name={p.display_name} src={p.avatar_url} size={24} /> {p.display_name.split(" ")[0]}</Link></li> : null; })}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
