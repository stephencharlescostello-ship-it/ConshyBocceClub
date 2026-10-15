"use client";
import { useState, useTransition } from "react";
import { rsvp } from "@/lib/actions/events";
import { toast } from "@/components/ui/toast";

export function RsvpButtons({ eventId, current }: { eventId: string; current: "going" | "maybe" | "no" | null }) {
  const [val, setVal] = useState(current);
  const [pending, start] = useTransition();
  const opts: { v: "going" | "maybe" | "no"; label: string }[] = [{ v: "going", label: "Going" }, { v: "maybe", label: "Maybe" }, { v: "no", label: "Can't" }];
  return (
    <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="RSVP">
      {opts.map((o) => (
        <button key={o.v} type="button" aria-pressed={val === o.v} disabled={pending} className={`btn ${val === o.v ? (o.v === "going" ? "btn-primary" : o.v === "maybe" ? "btn-accent" : "btn-danger") : "btn-soft"}`} onClick={() => { setVal(o.v); start(async () => { const r = await rsvp(eventId, o.v); if (!r.ok) toast(r.message ?? "Failed", "error"); }); }}>{o.label}</button>
      ))}
    </div>
  );
}
