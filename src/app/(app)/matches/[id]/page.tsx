import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Share2, CalendarPlus, ClipboardList, Pencil } from "lucide-react";
import { getViewer } from "@/lib/data/session";
import { getMatch } from "@/lib/data/league";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/badge";
import { LiveScoreboard } from "@/components/match/live-scoreboard";
import { Countdown } from "@/components/match/countdown";
import { fmtDateTime } from "@/lib/util/time";
import { googleCalendarUrl, matchToIcs } from "@/lib/ics";
import { ScorekeeperPicker } from "./scorekeeper-picker";
import type { LiveState } from "@/components/match/use-match-realtime";

export async function generateMetadata(props: PageProps<"/matches/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const m = await getMatch(id);
  return { title: m ? `${m.home?.name ?? "Bye"} vs ${m.away?.name ?? "Bye"}` : "Match" };
}

export const dynamic = "force-dynamic";

export default async function MatchPage(props: PageProps<"/matches/[id]">) {
  const { id } = await props.params;
  const [m, viewer] = await Promise.all([getMatch(id), getViewer()]);
  if (!m) notFound();
  const supabase = await createClient();
  const [{ data: state }, { data: channel }, { data: confirmations }, { data: subs }, { data: club }] = await Promise.all([
    supabase.rpc("match_state", { p_match: id }),
    supabase.from("channels").select("slug").eq("match_id", id).maybeSingle(),
    supabase.from("confirmations").select("decision, note, created_at, player:player_profiles(display_name)").eq("match_id", id).order("created_at"),
    supabase.from("sub_requests").select("claimed_by, status, player:player_profiles!sub_requests_claimed_by_fkey(display_name)").eq("match_id", id).eq("status", "confirmed"),
    supabase.from("settings").select("value").eq("key", "club").maybeSingle(),
  ]);
  const canScore = Boolean(viewer && (viewer.isAdmin || viewer.captainTeamIds.includes(m.home_team_id ?? "") || viewer.captainTeamIds.includes(m.away_team_id ?? "") || m.scorekeeper_player_id === viewer.player.id));
  const other = m.submitting_team_id === m.home_team_id ? m.away_team_id : m.home_team_id;
  const canConfirm = Boolean(viewer && m.status === "submitted" && (viewer.isAdmin || (other && viewer.captainTeamIds.includes(other))));
  const address = String((club?.value as { address?: string } | null)?.address ?? "Conshohocken Bocce Club");
  const ics = matchToIcs(m, address);
  const isMember = Boolean(viewer && (viewer.teamIds.includes(m.home_team_id ?? "") || viewer.teamIds.includes(m.away_team_id ?? "")));
  const live = (state ?? null) as unknown as LiveState | null;
  const bye = !m.home || !m.away;
  const scheduledFuture = ["scheduled", "postponed"].includes(m.status) && new Date(m.scheduled_at) > new Date();
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-subtle">{m.night?.name} · Week {m.week?.number}{m.week?.label ? ` · ${m.week.label}` : ""}</p>
        <StatusBadge status={m.status} />
      </div>
      <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight">
        <Link href={m.home ? `/teams/${m.home.id}` : "#"} className="underline-offset-4 hover:underline">{m.home?.name ?? "Bye"}</Link>
        <span className="text-subtle"> vs </span>
        <Link href={m.away ? `/teams/${m.away.id}` : "#"} className="underline-offset-4 hover:underline">{m.away?.name ?? "Bye"}</Link>
      </h1>
      <p className="mt-1 text-muted">{fmtDateTime(m.scheduled_at)} · {m.table?.name ?? "Table TBD"}{scheduledFuture && <> · <Countdown to={m.scheduled_at} className="font-semibold text-fg" /></>}</p>
      {m.status === "postponed" && <p className="mt-2 rounded-xl bg-elev-2 px-3 py-2 text-sm text-warning">Postponed. The commissioner will reschedule; both captains will be notified.</p>}
      {m.status === "forfeit" && <p className="mt-2 rounded-xl bg-elev-2 px-3 py-2 text-sm text-muted">Forfeit by {m.forfeit_team_id === m.home_team_id ? m.home?.name : m.away?.name}.</p>}
      {subs?.length ? <p className="mt-2 text-sm text-muted">Subs: {subs.map((s) => (s.player as unknown as { display_name: string } | null)?.display_name).filter(Boolean).join(", ")}</p> : null}

      {!bye && (
        <div className="mt-4 flex flex-col gap-2">
          {canConfirm && <Link href={`/matches/${id}/confirm`} className="btn btn-accent btn-lg">Confirm or dispute this result</Link>}
          {m.status === "submitted" && !canConfirm && <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm">Waiting for the opposing captain to confirm. Auto-confirms {m.auto_confirm_at ? fmtDateTime(m.auto_confirm_at) : "soon"}.</p>}
          {m.status === "disputed" && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">This result is disputed and waiting for the commissioner.</p>}
          {canScore && ["scheduled", "live", "postponed"].includes(m.status) && (
            <>
              <Link href={`/matches/${id}/score`} className="btn btn-accent btn-lg text-xl">{m.status === "live" ? "Continue scoring" : "Keep Score"}</Link>
              <Link href={`/matches/${id}/quick`} className="btn btn-ghost"><ClipboardList className="h-5 w-5" /> Quick entry (final scores only)</Link>
            </>
          )}
          {viewer?.isAdmin && ["submitted", "confirmed", "disputed", "forfeit"].includes(m.status) && <Link href={`/admin/results/${id}`} className="btn btn-ghost"><Pencil className="h-5 w-5" /> Admin: edit result</Link>}
        </div>
      )}

      {!bye && <div className="mt-4"><LiveScoreboard matchId={id} initial={live} homeName={m.home!.name} awayName={m.away!.name} homeColor={m.home!.color} awayColor={m.away!.color} /></div>}

      {canScore && ["scheduled", "live"].includes(m.status) && <ScorekeeperPicker matchId={id} current={m.scorekeeper_player_id} teamIds={[m.home_team_id!, m.away_team_id!]} />}

      {confirmations?.length ? (
        <ul className="mt-4 flex flex-col gap-1 text-sm text-muted">
          {confirmations.map((c, i) => (
            <li key={i}>{c.decision === "auto" ? "Auto-confirmed" : `${(c.player as unknown as { display_name: string } | null)?.display_name ?? "Captain"} ${c.decision === "confirm" ? "confirmed" : "disputed"}`} · {fmtDateTime(c.created_at)}{c.note ? ` — “${c.note}”` : ""}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-2">
        {viewer && channel && <Link href={`/chat/${channel.slug}`} className="btn btn-soft"><MessageCircle className="h-5 w-5" /> Match thread</Link>}
        {!viewer && <Link href="/sign-in" className="btn btn-soft"><MessageCircle className="h-5 w-5" /> Sign in to chat</Link>}
        <a href={googleCalendarUrl(ics)} target="_blank" rel="noreferrer" className="btn btn-soft"><CalendarPlus className="h-5 w-5" /> Add to calendar</a>
        {["confirmed", "forfeit"].includes(m.status) && <a href={`/api/cards/match/${id}`} target="_blank" rel="noreferrer" className="btn btn-soft col-span-2"><Share2 className="h-5 w-5" /> Share result card</a>}
        {isMember && ["scheduled", "postponed"].includes(m.status) && <Link href={`/subs?match=${id}`} className="btn btn-ghost col-span-2 text-sm">Need a sub for this match?</Link>}
      </div>
    </>
  );
}
