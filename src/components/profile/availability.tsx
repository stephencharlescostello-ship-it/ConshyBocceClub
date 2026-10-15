"use client";
import { useState, useTransition } from "react";
import { setAvailability } from "@/lib/actions/profile";
import { toast } from "@/components/ui/toast";

export function AvailabilityPicker({ current, nights }: { current: number[]; nights: { weekday: number; name: string }[] }) {
  const [sel, setSel] = useState<number[]>(current);
  const [pending, start] = useTransition();
  const toggle = (d: number) => {
    const next = sel.includes(d) ? sel.filter((x) => x !== d) : [...sel, d];
    setSel(next);
    start(async () => { const r = await setAvailability(next); if (!r.ok) toast(r.message ?? "Failed", "error"); });
  };
  return (
    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Nights available to sub">
      {nights.sort((a, b) => a.weekday - b.weekday).map((n) => (
        <button key={n.weekday} type="button" aria-pressed={sel.includes(n.weekday)} disabled={pending} className={`btn ${sel.includes(n.weekday) ? "btn-accent" : "btn-soft"}`} onClick={() => toggle(n.weekday)}>{n.name}</button>
      ))}
    </div>
  );
}
