"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { seedPlayoffs } from "@/lib/actions/playoffs";
import { seedChampionOfChampions } from "@/lib/actions/champions";
import { toast } from "@/components/ui/toast";

export function PlayoffsAdminPanel({ seasonId, hasBrackets, hasChampions, champions }: { seasonId: string; hasBrackets: boolean; hasChampions: boolean; champions: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => start(async () => { const r = await fn(); toast(r.message ?? (r.ok ? "Done" : "Failed"), r.ok ? "success" : "error"); router.refresh(); });
  return (
    <div className="card mt-3 flex flex-col gap-3 p-4">
      <button className="btn btn-primary" disabled={pending} onClick={() => run(() => seedPlayoffs(seasonId, { replace: false }))}>{hasBrackets ? "Brackets exist — use re-seed" : "Seed playoff brackets now"}</button>
      {hasBrackets && <button className="btn btn-ghost text-danger" disabled={pending} onClick={() => { if (confirm("Re-seed replaces the current brackets and unplayed playoff matches.")) run(() => seedPlayoffs(seasonId, { replace: true })); }}>Re-seed (replace)</button>}
      <div className="border-t border-border pt-3">
        <p className="font-semibold">Champion of Champions</p>
        <p className="text-sm text-muted">Available once night champions are decided ({champions} so far). Creates a bracket of the night winners.</p>
        <button className="btn btn-accent mt-2" disabled={pending || champions < 2} onClick={() => run(() => seedChampionOfChampions(seasonId))}>{hasChampions ? "Re-create" : "Create"} Champion of Champions bracket</button>
      </div>
    </div>
  );
}
