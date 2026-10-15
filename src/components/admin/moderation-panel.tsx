"use client";
import { useActionState, useTransition } from "react";
import { banPlayer, mutePlayer, resolveReport, saveBlockedWords, unmutePlayer } from "@/lib/actions/admin-users";
import { toast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/actions/team";

export function ModerationPanel({ reports, mutes, bans, words }: { reports: { id: string; reason: string | null; at: string; reporter: string; body: string; authorId: string | null; author: string; channel: string; deleted: boolean }[]; mutes: { playerId: string; name: string; until: string; reason: string | null }[]; bans: { playerId: string; name: string; reason: string | null }[]; words: string[] }) {
  const [pending, start] = useTransition();
  const [ws, waction, wpending] = useActionState(saveBlockedWords, { ok: false } as ActionState);
  const run = (fn: () => Promise<ActionState>) => start(async () => { const r = await fn(); if (!r.ok) toast(r.message ?? "Failed", "error"); else if (r.message) toast(r.message, "success"); });
  const mute = (pid: string) => { const h = Number(prompt("Mute for how many hours?", "24")); if (h > 0) run(() => mutePlayer(pid, h, prompt("Reason (optional)") ?? "")); };
  return (
    <div className="mt-3 flex flex-col gap-5">
      <section className="card p-4">
        <h2 className="font-display font-bold">Reported messages ({reports.length})</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {reports.map((r) => (
            <li key={r.id} className="rounded-xl border border-border p-3 text-sm">
              <p className="text-xs text-muted">{r.at} · {r.channel} · reported by {r.reporter}{r.reason ? `: “${r.reason}”` : ""}</p>
              <p className="mt-1"><span className="font-semibold">{r.author}:</span> {r.deleted ? <em className="text-muted">deleted</em> : r.body}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn btn-soft !min-h-[36px] px-2 text-xs" disabled={pending} onClick={() => run(() => resolveReport(r.id, "dismiss"))}>Dismiss</button>
                <button className="btn btn-danger !min-h-[36px] px-2 text-xs" disabled={pending} onClick={() => run(() => resolveReport(r.id, "delete"))}>Delete message</button>
                {r.authorId && <><button className="btn btn-ghost !min-h-[36px] px-2 text-xs" disabled={pending} onClick={() => mute(r.authorId!)}>Mute author</button><button className="btn btn-ghost !min-h-[36px] px-2 text-xs text-danger" disabled={pending} onClick={() => { if (confirm(`Ban ${r.author} from chat?`)) run(() => banPlayer(r.authorId!, prompt("Reason") ?? "", true)); }}>Ban author</button></>}
              </div>
            </li>
          ))}
          {!reports.length && <li className="text-sm text-muted">No open reports.</li>}
        </ul>
      </section>
      <section className="card p-4">
        <h2 className="font-display font-bold">Active mutes</h2>
        <ul className="mt-2 text-sm">{mutes.map((m) => <li key={m.playerId} className="flex items-center justify-between py-1"><span>{m.name} · until {m.until}{m.reason ? ` · ${m.reason}` : ""}</span><button className="text-xs text-accent underline" onClick={() => run(() => unmutePlayer(m.playerId))}>Unmute</button></li>)}{!mutes.length && <li className="text-muted">Nobody is muted.</li>}</ul>
        <h2 className="mt-4 font-display font-bold">Bans</h2>
        <ul className="mt-2 text-sm">{bans.map((b) => <li key={b.playerId} className="flex items-center justify-between py-1"><span>{b.name}{b.reason ? ` · ${b.reason}` : ""}</span><button className="text-xs text-accent underline" onClick={() => run(() => banPlayer(b.playerId, "", false))}>Unban</button></li>)}{!bans.length && <li className="text-muted">Nobody is banned.</li>}</ul>
        <p className="mt-2 text-xs text-subtle">Mute or ban other players from the Users page.</p>
      </section>
      <form action={waction} className="card flex flex-col gap-2 p-4">
        <h2 className="font-display font-bold">Blocked words</h2>
        <p className="text-sm text-muted">Profanity is allowed. Slurs and hate terms listed here are rejected (with common letter substitutions). One per line.</p>
        <textarea name="words" rows={6} className="input font-mono text-sm" defaultValue={words.join("\n")} />
        {ws.message && <p className={`text-sm font-semibold ${ws.ok ? "text-success" : "text-danger"}`}>{ws.message}</p>}
        <button className="btn btn-primary self-start" disabled={wpending}>Save list</button>
      </form>
    </div>
  );
}
