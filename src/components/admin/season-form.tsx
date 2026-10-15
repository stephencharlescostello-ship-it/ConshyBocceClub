"use client";
import { useActionState } from "react";
import { createSeason, updateSeason, cloneSeason } from "@/lib/actions/admin-seasons";
import type { ActionState } from "@/lib/actions/team";
import type { Tables } from "@/lib/supabase/database.types";

const init: ActionState = { ok: false };

function Field({ label, name, type = "text", def, hint }: { label: string; name: string; type?: string; def?: string | number; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      <input name={name} type={type} defaultValue={def} className="input" required />
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function SeasonForm({ mode, season }: { mode: "create" | "edit"; season?: Tables<"seasons"> }) {
  const [state, action, pending] = useActionState(mode === "edit" && season ? updateSeason.bind(null, season.id) : createSeason, init);
  const f = (season?.format as Record<string, unknown>) ?? {};
  const p = (season?.playoff_config as Record<string, unknown>) ?? {};
  return (
    <form action={action} className="card mt-3 grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
      <Field label="Name" name="name" def={season?.name ?? ""} />
      <Field label="Slug" name="slug" def={season?.slug ?? ""} hint="URL-safe, e.g. spring-2027" />
      <Field label="Start date (Monday of week 1)" name="starts_on" type="date" def={season?.starts_on ?? ""} />
      <Field label="Auto-confirm after (hours)" name="auto_confirm_hours" type="number" def={season?.auto_confirm_hours ?? 12} />
      <Field label="Regular season weeks" name="regular_weeks" type="number" def={season?.regular_weeks ?? 10} />
      <Field label="Playoff weeks" name="playoff_weeks" type="number" def={season?.playoff_weeks ?? 2} />
      <fieldset className="col-span-full grid grid-cols-2 gap-3 rounded-xl border border-border p-3 md:grid-cols-3">
        <legend className="px-1 text-sm font-bold">Scoring format (this season only)</legend>
        <Field label="Game to" name="target_score" type="number" def={(f.target_score as number) ?? 15} />
        <Field label="Games per match" name="games_per_match" type="number" def={(f.games_per_match as number) ?? 3} />
        <Field label="Hanger points" name="hanger_points" type="number" def={(f.hanger_points as number) ?? 4} />
        <Field label="Weights per side" name="weights_per_side" type="number" def={(f.weights_per_side as number) ?? 4} />
        <Field label="Zones (comma separated)" name="zones" def={((f.zones as number[]) ?? [1, 2, 3]).join(",")} />
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="win_by_two" defaultChecked={Boolean(f.win_by_two)} className="h-6 w-6" /> Win by two</label>
      </fieldset>
      <Field label="Tiebreaker order" name="tiebreakers" def={(season?.tiebreakers ?? ["win_pct", "head_to_head", "game_diff", "point_diff", "admin"]).join(",")} hint="win_pct, head_to_head, game_diff, point_diff, admin" />
      <Field label="Playoff teams per night" name="teams_per_night" type="number" def={(p.teams_per_night as number) ?? 4} hint="2, 4 or 8" />
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="champion_of_champions" defaultChecked={p.champion_of_champions !== false} className="h-6 w-6" /> Champion of Champions night</label>
      <label className="col-span-full flex flex-col gap-1 text-sm font-semibold">Notes<textarea name="notes" className="input" rows={2} defaultValue={season?.notes ?? ""} /></label>
      {state.message && <p className={`col-span-full text-sm font-semibold ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
      <button className="btn btn-primary col-span-full" disabled={pending}>{pending ? "Saving…" : mode === "edit" ? "Save season" : "Create season"}</button>
    </form>
  );
}

export function CloneForm({ sourceId }: { sourceId: string }) {
  const [state, action, pending] = useActionState(cloneSeason.bind(null, sourceId), init);
  return (
    <form action={action} className="card mt-3 flex flex-col gap-3 p-4 md:flex-row md:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">New season name<input name="name" className="input" placeholder="Spring 2027" required /></label>
      <label className="flex flex-col gap-1 text-sm font-semibold">Start date<input name="starts_on" type="date" className="input" required /></label>
      <button className="btn btn-soft" disabled={pending}>{pending ? "Cloning…" : "Clone season"}</button>
      {state.message && <p className="text-sm font-semibold text-danger">{state.message}</p>}
    </form>
  );
}
