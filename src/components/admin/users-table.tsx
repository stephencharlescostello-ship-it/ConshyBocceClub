"use client";
import { useTransition } from "react";
import Link from "next/link";
import { adminDeletePlayer, banPlayer, mutePlayer, setAdmin } from "@/lib/actions/admin-users";
import { toast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/actions/team";

export function UsersTable({ rows }: { rows: { id: string; name: string; email: string | null; phone: string | null; isAdmin: boolean; hasAccount: boolean; teams: string }[] }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionState>) => start(async () => { const r = await fn(); if (!r.ok) toast(r.message ?? "Failed", "error"); else if (r.message) toast(r.message, "success"); });
  return (
    <div className="card mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-elev-2 text-left text-xs uppercase text-subtle"><tr><th className="p-2">Player</th><th className="p-2">Contact</th><th className="p-2">Teams</th><th className="p-2">Actions</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="p-2"><Link href={`/players/${r.id}`} className="font-semibold">{r.name}</Link>{r.isAdmin && <span className="chip ml-1 bg-accent-soft text-accent">admin</span>}{!r.hasAccount && <span className="block text-xs text-subtle">no account yet</span>}</td>
              <td className="p-2 text-xs text-muted">{r.email ?? "—"}<br />{r.phone ?? ""}</td>
              <td className="p-2 text-xs">{r.teams || "—"}</td>
              <td className="p-2">
                <div className="flex flex-wrap gap-1">
                  <button className="btn btn-ghost !min-h-[32px] px-2 text-xs" disabled={pending} onClick={() => run(() => setAdmin(r.id, !r.isAdmin))}>{r.isAdmin ? "Remove admin" : "Make admin"}</button>
                  <button className="btn btn-ghost !min-h-[32px] px-2 text-xs" disabled={pending} onClick={() => { const h = Number(prompt("Mute hours", "24")); if (h > 0) run(() => mutePlayer(r.id, h, prompt("Reason") ?? "")); }}>Mute</button>
                  <button className="btn btn-ghost !min-h-[32px] px-2 text-xs text-danger" disabled={pending} onClick={() => { if (confirm(`Ban ${r.name} from chat?`)) run(() => banPlayer(r.id, prompt("Reason") ?? "", true)); }}>Ban</button>
                  <button className="btn btn-ghost !min-h-[32px] px-2 text-xs text-danger" disabled={pending} onClick={() => { if (confirm(`Remove ${r.name} entirely? This deletes their account.`)) run(() => adminDeletePlayer(r.id)); }}>Remove</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
