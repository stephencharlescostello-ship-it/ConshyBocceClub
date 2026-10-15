"use client";
import { useEffect, useState } from "react";

function label(ms: number) {
  if (ms <= 0) return "Now";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function Countdown({ to, className = "" }: { to: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date().getTime());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  const ms = now === null ? null : new Date(to).getTime() - now;
  return (
    <span className={`tabular ${className}`} aria-live="off">
      {ms === null ? "…" : ms <= 0 ? "Starting now" : `in ${label(ms)}`}
    </span>
  );
}
