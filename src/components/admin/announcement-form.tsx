"use client";
import { useActionState } from "react";
import { postAnnouncement } from "@/lib/actions/admin-content";
import type { ActionState } from "@/lib/actions/team";

export function AnnouncementForm({ nights }: { nights: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(postAnnouncement, { ok: false } as ActionState);
  return (
    <form action={action} className="card mt-3 flex flex-col gap-3 p-4">
      <label className="flex flex-col gap-1 text-sm font-semibold">Title<input name="title" className="input" required placeholder="Club closed Thursday (weather)" /></label>
      <label className="flex flex-col gap-1 text-sm font-semibold">Message (Markdown ok)<textarea name="body" rows={4} className="input" required /></label>
      <fieldset><legend className="text-sm font-semibold">Send to</legend><div className="mt-1 flex flex-wrap gap-2">{nights.map((n) => <label key={n.id} className="chip"><input type="checkbox" name="night_ids" value={n.id} className="mr-1" />{n.name}</label>)}<span className="text-xs text-subtle">(none = everyone)</span></div></fieldset>
      <div className="flex flex-wrap gap-4 text-sm font-semibold">
        <label className="flex items-center gap-2"><input type="checkbox" name="push" defaultChecked className="h-6 w-6" /> Push notification</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="pinned" className="h-6 w-6" /> Pin to Home</label>
        <label className="flex items-center gap-2">Expires<input type="datetime-local" name="expires_at" className="input !min-h-[40px] py-1" /></label>
      </div>
      {state.message && <p className={`text-sm font-semibold ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Posting…" : "Post announcement"}</button>
    </form>
  );
}
