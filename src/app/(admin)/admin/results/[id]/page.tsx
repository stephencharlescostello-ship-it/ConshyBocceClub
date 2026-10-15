import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMatch } from "@/lib/data/league";
import { parseFormat } from "@/lib/engine/format";
import { ResultEditor } from "@/components/admin/result-editor";
import { fmtDateTime } from "@/lib/util/time";
import { StatusBadge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Edit result" };
export const dynamic = "force-dynamic";

export default async function ResultEditPage(props: PageProps<"/admin/results/[id]">) {
  const { id } = await props.params;
  const m = await getMatch(id);
  if (!m || !m.home || !m.away) notFound();
  const supabase = await createClient();
  const [{ data: season }, { data: games }, { data: disputes }, { data: audit }, { data: submissions }] = await Promise.all([
    supabase.from("seasons").select("format").eq("id", m.season_id).maybeSingle(),
    supabase.from("games").select("number, home_score, away_score, frame_count").eq("match_id", id).order("number"),
    supabase.from("disputes").select("id, note, status, resolution, created_at, opener:player_profiles!disputes_opened_by_fkey(display_name)").eq("match_id", id).order("created_at", { ascending: false }),
    supabase.from("audit_log").select("action, before, after, created_at, note, actor:player_profiles!audit_log_actor_id_fkey(display_name)").eq("entity_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("score_submissions").select("created_at, payload, submitter:player_profiles!score_submissions_submitted_by_fkey(display_name)").eq("match_id", id).order("created_at", { ascending: false }),
  ]);
  return (
    <>
      <Link href="/admin/results" className="text-sm font-semibold text-accent">← Results</Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-extrabold">{m.home.name} vs {m.away.name}</h1>
        <StatusBadge status={m.status} />
      </div>
      <p className="text-sm text-muted">{m.night?.name} · Week {m.week?.number} · {fmtDateTime(m.scheduled_at)} · {m.table?.name ?? "no table"} · entered via {m.entry_mode ?? "—"} · <Link href={`/matches/${id}`} className="text-accent underline">public page</Link></p>
      <ResultEditor
        matchId={id}
        format={parseFormat(season?.format)}
        home={{ id: m.home.id, name: m.home.name }}
        away={{ id: m.away.id, name: m.away.name }}
        games={(games ?? []).map((g) => ({ home: g.home_score, away: g.away_score }))}
        status={m.status}
        openDispute={(disputes ?? []).find((d) => d.status === "open") ? { id: (disputes ?? []).find((d) => d.status === "open")!.id, note: (disputes ?? []).find((d) => d.status === "open")!.note ?? "", by: ((disputes ?? []).find((d) => d.status === "open")!.opener as unknown as { display_name: string } | null)?.display_name ?? "captain" } : null}
      />
      {submissions?.length ? (
        <section className="mt-6"><h2 className="font-display font-bold">Submissions</h2><ul className="mt-1 text-xs text-muted">{submissions.map((s, i) => <li key={i}>{fmtDateTime(s.created_at)} · {(s.submitter as unknown as { display_name: string } | null)?.display_name ?? "admin"} · {JSON.stringify((s.payload as { games?: unknown }).games ?? "live")}</li>)}</ul></section>
      ) : null}
      {disputes?.length ? (
        <section className="mt-4"><h2 className="font-display font-bold">Dispute history</h2><ul className="mt-1 text-xs text-muted">{disputes.map((d) => <li key={d.id}>{fmtDateTime(d.created_at)} · {(d.opener as unknown as { display_name: string } | null)?.display_name}: “{d.note}” → {d.status}{d.resolution ? ` (${d.resolution})` : ""}</li>)}</ul></section>
      ) : null}
      <section className="mt-4"><h2 className="font-display font-bold">Audit trail</h2><ul className="mt-1 text-xs text-muted">{(audit ?? []).map((a, i) => <li key={i}>{fmtDateTime(a.created_at)} · {(a.actor as unknown as { display_name: string } | null)?.display_name ?? "system"} · {a.action}{a.before ? ` · before ${JSON.stringify(a.before)}` : ""}{a.after ? ` · after ${JSON.stringify(a.after)}` : ""}{a.note ? ` · ${a.note}` : ""}</li>)}{!audit?.length && <li>No changes logged yet.</li>}</ul></section>
    </>
  );
}
