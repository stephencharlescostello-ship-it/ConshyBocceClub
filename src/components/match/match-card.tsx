import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { fmtTime, fmtDate } from "@/lib/util/time";
import type { MatchRow } from "@/lib/data/league";

export function TeamDot({ color, className = "" }: { color?: string | null; className?: string }) {
  return <span aria-hidden="true" className={`inline-block h-3 w-3 shrink-0 rounded-full ${className}`} style={{ background: color ?? "var(--primary)" }} />;
}

/** Compact match row used on Tonight, Schedule, Team and Results. */
export function MatchCard({ match, highlightTeamIds = [], showDate = false, href }: { match: MatchRow; highlightTeamIds?: string[]; showDate?: boolean; href?: string }) {
  const played = ["confirmed", "forfeit", "submitted", "disputed", "live"].includes(match.status);
  const mine = (id: string | null) => Boolean(id && highlightTeamIds.includes(id));
  const bye = !match.away || !match.home;
  const link = href ?? `/matches/${match.id}`;
  const winner = match.winner_team_id;
  const row = (team: MatchRow["home"], games: number, points: number, side: "home" | "away") => (
    <div className={`flex items-center justify-between gap-3 ${winner && team && winner !== team.id && match.status === "confirmed" ? "text-muted" : ""}`}>
      <span className="flex min-w-0 items-center gap-2">
        <TeamDot color={team?.color} />
        <span className={`truncate ${mine(team?.id ?? null) ? "font-extrabold text-accent" : "font-semibold"}`}>{team?.name ?? "Bye"}</span>
        {mine(team?.id ?? null) && <span className="chip bg-accent-soft text-accent">You</span>}
      </span>
      {played && !bye && (
        <span className="flex items-baseline gap-2 tabular">
          <span className={`text-xl font-extrabold ${side === "home" ? "text-home" : "text-away"}`}>{games}</span>
          <span className="w-8 text-right text-xs text-subtle">{points}</span>
        </span>
      )}
    </div>
  );
  return (
    <Link href={link} className="card block p-3 transition hover:border-accent focus-visible:border-accent" aria-label={`${match.home?.name ?? "Bye"} vs ${match.away?.name ?? "Bye"}`}>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-fg">{showDate ? fmtDate(match.scheduled_at) + " · " : ""}{fmtTime(match.scheduled_at)}</span>
          {match.table && <span>· {match.table.name}</span>}
          {match.week && <span>· Wk {match.week.number}</span>}
        </span>
        <StatusBadge status={match.status} />
      </div>
      <div className="flex flex-col gap-1.5">
        {row(match.home, match.home_games, match.home_points, "home")}
        {row(match.away, match.away_games, match.away_points, "away")}
      </div>
      {match.status === "postponed" && match.postponed_from && <p className="mt-2 text-xs text-warning">Postponed — originally {fmtDate(match.postponed_from)}</p>}
      {match.is_makeup && match.status !== "postponed" && <p className="mt-2 text-xs text-warning">Make-up match</p>}
    </Link>
  );
}
