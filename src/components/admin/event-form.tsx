"use client";
import { useActionState, useRef, useState } from "react";
import { saveEvent } from "@/lib/actions/admin-content";
import { getBrowserClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/util/image";
import { toast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/actions/team";
import type { Tables } from "@/lib/supabase/database.types";

const toLocal = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

export function EventForm({ event, nights }: { event: Tables<"events"> | null; nights: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(saveEvent.bind(null, event?.id ?? null), { ok: false } as ActionState);
  const [cover, setCover] = useState(event?.cover_url ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = async (f: File) => {
    try {
      const blob = await compressImage(f, 1600, 0.85);
      const supabase = getBrowserClient();
      const path = `covers/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("event-covers").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      setCover(supabase.storage.from("event-covers").getPublicUrl(path).data.publicUrl);
    } catch (e) { toast(e instanceof Error ? e.message : "Upload failed", "error"); }
  };
  return (
    <form action={action} className="card mt-3 grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
      <input type="hidden" name="cover_url" value={cover} />
      <label className="flex flex-col gap-1 text-sm font-semibold md:col-span-2">Title<input name="title" defaultValue={event?.title ?? ""} className="input" required /></label>
      <label className="flex flex-col gap-1 text-sm font-semibold">Kind<select name="kind" defaultValue={event?.kind ?? "social"} className="input">{["tournament", "social", "playoffs", "banquet", "deadline", "other"].map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm font-semibold">Location<input name="location" defaultValue={event?.location ?? ""} className="input" /></label>
      <label className="flex flex-col gap-1 text-sm font-semibold">Starts<input name="starts_at" type="datetime-local" defaultValue={toLocal(event?.starts_at ?? null)} className="input" required /></label>
      <label className="flex flex-col gap-1 text-sm font-semibold">Ends (optional)<input name="ends_at" type="datetime-local" defaultValue={toLocal(event?.ends_at ?? null)} className="input" /></label>
      <label className="flex flex-col gap-1 text-sm font-semibold md:col-span-2">Description (Markdown)<textarea name="description" rows={5} defaultValue={event?.description ?? ""} className="input" /></label>
      <div className="md:col-span-2"><p className="text-sm font-semibold">Cover image</p>{cover && /* eslint-disable-next-line @next/next/no-img-element */ <img src={cover} alt="" className="mt-1 h-32 rounded-lg object-cover" />}<input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} /><button type="button" className="btn btn-soft mt-1 !min-h-[40px] px-3 text-sm" onClick={() => fileRef.current?.click()}>Upload cover</button></div>
      <fieldset className="md:col-span-2"><legend className="text-sm font-semibold">Who is it for?</legend><div className="mt-1 flex flex-wrap gap-2">{nights.map((n) => <label key={n.id} className="chip"><input type="checkbox" name="night_ids" value={n.id} defaultChecked={event?.target_night_ids.includes(n.id)} className="mr-1" />{n.name}</label>)}<span className="text-xs text-subtle">(none = whole league)</span></div></fieldset>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="rsvp_enabled" defaultChecked={event?.rsvp_enabled ?? true} className="h-6 w-6" /> RSVP enabled</label>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="notify" className="h-6 w-6" /> Notify players now</label>
      {state.message && <p className={`md:col-span-2 text-sm font-semibold ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
      <button className="btn btn-primary md:col-span-2" disabled={pending}>{pending ? "Saving…" : "Save event"}</button>
    </form>
  );
}
