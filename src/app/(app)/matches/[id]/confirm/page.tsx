import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getMatch } from "@/lib/data/league";
import { getViewer } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { ConfirmForm } from "./confirm-form";
import { fmtDateTime } from "@/lib/util/time";

export const metadata: Metadata = { title: "Confirm result" };

export default async function ConfirmPage(props: PageProps<"/matches/[id]/confirm">) {
  const { id } = await props.params;
  const [m, viewer] = await Promise.all([getMatch(id), getViewer()]);
  if (!m) notFound();
  if (!viewer) redirect(`/sign-in?next=/matches/${id}/confirm`);
  const supabase = await createClient();
  const { data: games } = await supabase.from("games").select("number, home_score, away_score").eq("match_id", id).order("number");
  const other = m.submitting_team_id === m.home_team_id ? m.away_team_id : m.home_team_id;
  const allowed = viewer.isAdmin || (other && viewer.captainTeamIds.includes(other));
  const submitter = m.submitting_team_id === m.home_team_id ? m.home?.name : m.away?.name;
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Confirm the result</h1>
      <p className="mt-1 text-muted">{m.home?.name} vs {m.away?.name} · {fmtDateTime(m.scheduled_at)}</p>
      <div className="card mt-4 p-4">
        <p className="text-xs uppercase text-subtle">Submitted by {submitter}{m.submitted_at ? ` · ${fmtDateTime(m.submitted_at)}` : ""}</p>
        <table className="mt-2 w-full text-lg tabular">
          <thead className="text-xs uppercase text-subtle"><tr><th className="text-left">Game</th><th className="text-right">{m.home?.name}</th><th className="text-right">{m.away?.name}</th></tr></thead>
          <tbody>{(games ?? []).map((g) => <tr key={g.number} className="border-t border-border"><td className="py-1">{g.number}</td><td className="py-1 text-right font-bold">{g.home_score}</td><td className="py-1 text-right font-bold">{g.away_score}</td></tr>)}</tbody>
          <tfoot><tr className="border-t-2 border-border font-extrabold"><td className="py-1">Games</td><td className="py-1 text-right">{m.home_games}</td><td className="py-1 text-right">{m.away_games}</td></tr></tfoot>
        </table>
        {m.notes && <p className="mt-2 text-sm text-muted">Note: {m.notes}</p>}
      </div>
      {m.status !== "submitted" ? (
        <p className="mt-4 rounded-xl bg-elev-2 px-4 py-3">This match is {m.status}. Nothing to confirm.</p>
      ) : !allowed ? (
        <p className="mt-4 rounded-xl bg-elev-2 px-4 py-3">Only the opposing captain can confirm this result. It auto-confirms {m.auto_confirm_at ? fmtDateTime(m.auto_confirm_at) : "soon"}.</p>
      ) : (
        <ConfirmForm matchId={id} />
      )}
    </>
  );
}
