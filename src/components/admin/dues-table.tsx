"use client";
import { useActionState } from "react";
import { updateDues } from "@/lib/actions/admin-users";
import type { ActionState } from "@/lib/actions/team";

function Row({ seasonId, r }: { seasonId: string; r: { id: string; name: string; email: string | null; teams: string; amount: number; paid: boolean; note: string } }) {
  const [state, action, pending] = useActionState(updateDues.bind(null, seasonId, r.id), { ok: false } as ActionState);
  return (
    <tr className={`border-t border-border ${r.paid ? "" : "bg-danger-soft/30"}`}>
      <td className="p-2"><span className="font-semibold">{r.name}</span><span className="block text-xs text-muted">{r.teams}</span></td>
      <td className="p-2" colSpan={3}>
        <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
          <input name="amount" type="number" step="0.01" defaultValue={r.amount} className="input !min-h-[36px] w-24 py-0" aria-label="Amount" />
          <label className="flex items-center gap-1 font-semibold"><input type="checkbox" name="paid" defaultChecked={r.paid} className="h-5 w-5" /> Paid</label>
          <input name="note" defaultValue={r.note} placeholder="Note (cash, Venmo…)" className="input !min-h-[36px] flex-1 py-0" />
          <button className="btn btn-soft !min-h-[36px] px-2 text-xs" disabled={pending}>Save</button>
          {state.message && <span className="text-xs text-danger">{state.message}</span>}
        </form>
      </td>
    </tr>
  );
}

export function DuesTable({ seasonId, rows }: { seasonId: string; rows: { id: string; name: string; email: string | null; teams: string; amount: number; paid: boolean; note: string }[] }) {
  return (
    <div className="card mt-3 overflow-x-auto">
      <table className="w-full text-sm"><thead className="bg-elev-2 text-left text-xs uppercase text-subtle"><tr><th className="p-2">Player</th><th className="p-2" colSpan={3}>Dues</th></tr></thead><tbody>{rows.map((r) => <Row key={r.id} seasonId={seasonId} r={r} />)}</tbody></table>
    </div>
  );
}
