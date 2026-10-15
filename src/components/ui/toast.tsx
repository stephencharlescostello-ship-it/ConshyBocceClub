"use client";
import { useEffect, useState } from "react";

type Toast = { id: number; message: string; kind: "info" | "success" | "error" };
let listeners: ((t: Toast) => void)[] = [];
let seq = 0;

export function toast(message: string, kind: Toast["kind"] = "info") {
  const t = { id: ++seq, message, kind };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const l = (t: Toast) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 3500);
    };
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);
  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[100] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto max-w-md rounded-2xl border px-4 py-3 text-sm font-semibold shadow-card ${
            t.kind === "error" ? "border-danger bg-elev text-danger" : t.kind === "success" ? "border-success bg-elev text-success" : "border-border bg-elev text-fg"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
