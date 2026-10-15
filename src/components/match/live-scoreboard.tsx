"use client";
import { useMatchRealtime, type LiveState } from "./use-match-realtime";
import { parseFormat } from "@/lib/engine/format";

/** Read-only live view of a match that updates on every phone watching it. */
export function LiveScoreboard({ matchId, initial, homeName, awayName, homeColor, awayColor }: { matchId: string; initial: LiveState | null; homeName: string; awayName: string; homeColor?: string; awayColor?: string }) {
  const { state, connected } = useMatchRealtime(matchId, initial);
  if (!state) return null;
  const f = parseFormat(state.format);
  const games = state.games.slice().sort((a, b) => a.number - b.number);
  const current = games.find((g) => g.status === "live") ?? games[games.length - 1];
  const m = state.match;
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between text-xs text-muted">
        <span>{m.status === "live" ? `Game ${current?.number ?? m.current_game} · first to ${f.target_score}` : `Best of ${f.games_per_match} · to ${f.target_score}`}</span>
        <span className="flex items-center gap-1">{connected ? <span className="h-2 w-2 rounded-full bg-success" /> : <span className="h-2 w-2 rounded-full bg-subtle" />}{connected ? "Live" : "Reconnecting…"}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="min-w-0 text-center">
          <p className="truncate font-semibold" style={{ color: homeColor }}>{homeName}</p>
          <p className="font-display text-5xl font-extrabold tabular text-home">{current?.home_score ?? 0}</p>
          <p className="text-sm text-muted">Games {m.home_games}</p>
        </div>
        <p className="text-xl font-bold text-subtle">vs</p>
        <div className="min-w-0 text-center">
          <p className="truncate font-semibold" style={{ color: awayColor }}>{awayName}</p>
          <p className="font-display text-5xl font-extrabold tabular text-away">{current?.away_score ?? 0}</p>
          <p className="text-sm text-muted">Games {m.away_games}</p>
        </div>
      </div>
      {games.length > 0 && (
        <table className="mt-4 w-full text-sm">
          <thead className="text-[11px] uppercase text-subtle"><tr><th className="text-left">Game</th>{games.map((g) => <th key={g.id} className="text-right">{g.number}</th>)}</tr></thead>
          <tbody className="tabular">
            <tr><td className="py-1 text-muted">{homeName}</td>{games.map((g) => <td key={g.id} className={`py-1 text-right ${g.winner_team_id === m.home_team_id ? "font-bold text-fg" : "text-muted"}`}>{g.home_score}</td>)}</tr>
            <tr><td className="py-1 text-muted">{awayName}</td>{games.map((g) => <td key={g.id} className={`py-1 text-right ${g.winner_team_id === m.away_team_id ? "font-bold text-fg" : "text-muted"}`}>{g.away_score}</td>)}</tr>
          </tbody>
        </table>
      )}
      {current && state.frames.some((fr) => fr.game_id === current.id) && (
        <div className="mt-3">
          <p className="text-[11px] uppercase text-subtle">Frames · game {current.number}</p>
          <ol className="mt-1 flex flex-wrap gap-1">
            {state.frames.filter((fr) => fr.game_id === current.id).sort((a, b) => a.number - b.number).map((fr) => (
              <li key={fr.id} className={`rounded-md px-2 py-0.5 text-xs font-semibold ${fr.scoring_team_id === m.home_team_id ? "bg-home/20 text-home" : fr.scoring_team_id === m.away_team_id ? "bg-away/20 text-away" : "bg-elev-2 text-subtle"}`}>
                {fr.points === 0 ? "—" : `+${fr.points}`}{fr.hangers ? "🪝".repeat(fr.hangers) : ""}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
