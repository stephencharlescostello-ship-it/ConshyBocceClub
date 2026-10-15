"use client";
import { useActionState } from "react";
import { saveAdminOrder } from "@/lib/actions/admin-results";
import type { ActionState } from "@/lib/actions/team";

export function AdminOrderForm({ seasonId, nights, current }: { seasonId: string; nights: { name: string; teams: { id: string; name: string; note: string | null }[] }[]; current: Record<string, number> }) {
  const [state, action, pending] = useActionState(saveAdminOrder.bind(null, seasonId), { ok: false } as ActionState);
  return (
    <form action={action} className="card mt-3 flex flex-col gap-3 p-4">
      {nights.map((n) => (
        <div key={n.name}>
          <p className="text-sm font-bold">{n.name}</p>
          <div className="mt-1 grid grid-cols-2 gap-2 md:grid-cols-3">
            {n.teams.map((t) => (
              <label key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-elev-2 px-2 py-1 text-sm"><span className="truncate">{t.name}{t.note?.includes("commissioner") ? " ⚠️" : ""}</span><input name={`order:${t.id}`} type="number" min={1} max={99} defaultValue={current[t.id] ?? ""} className="input !min-h-[36px] w-16 py-0 text-center" /></label>
            ))}
          </div>
        </div>
      ))}
      {state.message && <p className={`text-sm font-semibold ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
      <button className="btn btn-soft self-start" disabled={pending}>{pending ? "Saving…" : "Save decisions"}</button>
    </form>
  );
}
