import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveSeason, getNights } from "@/lib/data/league";
import { EventForm } from "@/components/admin/event-form";
import { deleteEvent } from "@/lib/actions/admin-content";

export const metadata: Metadata = { title: "Edit event" };
export const dynamic = "force-dynamic";

export default async function EventEdit(props: PageProps<"/admin/events/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const season = await getActiveSeason();
  const nights = season ? await getNights(season.id) : [];
  const { data: e } = id === "new" ? { data: null } : await supabase.from("events").select("*").eq("id", id).maybeSingle();
  return (
    <>
      <Link href="/admin/events" className="text-sm font-semibold text-accent">← Events</Link>
      <h1 className="mt-1 font-display text-2xl font-extrabold">{e ? e.title : "New event"}</h1>
      <EventForm event={e} nights={nights.map((n) => ({ id: n.id, name: n.name }))} />
      {e && <form action={deleteEvent.bind(null, e.id)} className="mt-4"><button className="btn btn-ghost text-danger">Delete event</button></form>}
    </>
  );
}
