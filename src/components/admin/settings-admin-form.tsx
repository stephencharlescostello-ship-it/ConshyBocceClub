"use client";
import { useActionState } from "react";
import { saveSettings } from "@/lib/actions/admin-users";
import type { ActionState } from "@/lib/actions/team";

function F({ name, label, def, type = "text" }: { name: string; label: string; def?: string | number; type?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      <input name={name} type={type} defaultValue={def ?? ""} className="input" step={type === "number" ? "0.01" : undefined} />
    </label>
  );
}

export function SettingsAdminForm({ league, club, dues }: { league: Record<string, string>; club: Record<string, string>; dues: Record<string, string | number> }) {
  const [state, action, pending] = useActionState(saveSettings, { ok: false } as ActionState);
  return (
    <form action={action} className="card mt-3 grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
      <F name="app_name" label="App name" def={league.app_name ?? "CBC Shuffle"} />
      <F name="club_name" label="Club name" def={league.club_name ?? "Conshohocken Bocce Club"} />
      <F name="tagline" label="Tagline" def={league.tagline} />
      <F name="address" label="Club address (shown on Rules and calendar invites)" def={club.address} />
      <F name="map_url" label="Map link" def={club.map_url} />
      <F name="contact_name" label="Commissioner name" def={club.contact_name} />
      <F name="contact_email" label="Commissioner email" def={club.contact_email} type="email" />
      <F name="contact_phone" label="Commissioner phone (optional)" def={club.contact_phone} />
      <F name="dues_amount" label="Dues amount ($)" def={Number(dues.amount_cents ?? 4000) / 100} type="number" />
      <F name="dues_label" label="Dues label" def={String(dues.label ?? "Season dues")} />
      {state.message && <p className={`md:col-span-2 text-sm font-semibold ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
      <button className="btn btn-primary md:col-span-2" disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
