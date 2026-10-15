import type { Metadata } from "next";
import { Megaphone, Pin } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/util/time";
import { Empty } from "@/components/ui/empty";

export const metadata: Metadata = { title: "Announcements" };
export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("announcements").select("id, title, body, pinned, published_at, target_night_ids").lte("published_at", new Date().toISOString()).order("pinned", { ascending: false }).order("published_at", { ascending: false }).limit(50);
  const { data: nights } = await supabase.from("league_nights").select("id, name");
  const nightName = (id: string) => nights?.find((n) => n.id === id)?.name ?? "";
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Announcements</h1>
      {!data?.length && <div className="mt-4"><Empty title="No announcements yet" /></div>}
      <ul className="mt-4 flex flex-col gap-3">
        {(data ?? []).map((a) => (
          <li key={a.id} className={`card p-4 ${a.pinned ? "border-accent/50" : ""}`}>
            <div className="flex items-center gap-2 text-xs text-subtle">{a.pinned ? <Pin className="h-4 w-4 text-accent" /> : <Megaphone className="h-4 w-4" />} {fmtDateTime(a.published_at)}{a.target_night_ids.length ? ` · ${a.target_night_ids.map(nightName).join(", ")}` : " · Everyone"}</div>
            <p className="mt-1 font-display text-lg font-bold">{a.title}</p>
            <div className="prose-md text-sm"><ReactMarkdown>{a.body}</ReactMarkdown></div>
          </li>
        ))}
      </ul>
    </>
  );
}
