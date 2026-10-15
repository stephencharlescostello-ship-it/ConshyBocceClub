import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getActiveSeason, getNights } from "@/lib/data/league";
import { AnnouncementForm } from "@/components/admin/announcement-form";
import { deleteAnnouncement, toggleAnnouncementPin } from "@/lib/actions/admin-content";
import { fmtDateTime } from "@/lib/util/time";

export const metadata: Metadata = { title: "Announcements admin" };
export const dynamic = "force-dynamic";

export default async function AnnouncementsAdmin() {
  const supabase = await createClient();
  const season = await getActiveSeason();
  const nights = season ? await getNights(season.id) : [];
  const { data } = await supabase.from("announcements").select("*").order("published_at", { ascending: false }).limit(50);
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Announcements</h1>
      <AnnouncementForm nights={nights.map((n) => ({ id: n.id, name: n.name }))} />
      <ul className="mt-6 flex flex-col gap-2">
        {(data ?? []).map((a) => (
          <li key={a.id} className="card flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span><span className="font-semibold">{a.pinned ? "📌 " : ""}{a.title}</span><span className="block text-xs text-muted">{fmtDateTime(a.published_at)}{a.push ? " · pushed" : ""}</span></span>
            <span className="flex gap-1"><form action={toggleAnnouncementPin.bind(null, a.id, !a.pinned)}><button className="btn btn-ghost !min-h-[36px] px-2 text-xs">{a.pinned ? "Unpin" : "Pin to home"}</button></form><form action={deleteAnnouncement.bind(null, a.id)}><button className="btn btn-ghost !min-h-[36px] px-2 text-xs text-danger">Delete</button></form></span>
          </li>
        ))}
      </ul>
    </>
  );
}
