"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Undo2, Users, CloudOff, Cloud, X, ChevronLeft } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { gamesNeeded, maxFramePoints, type Format } from "@/lib/engine/format";
import { EMPTY_PENDING, addWeight, commitFrame, deriveState, pendingHangers, pendingPoints, removeLastWeight, undoLastFrame, type FrameRecord, type PendingFrame, type Side } from "@/lib/engine/scoring";
import { OfflineQueue, type QueueItem, type SendResult } from "@/lib/engine/offline-queue";
import { IdbStorage } from "@/lib/offline/idb-storage";
import { useMatchRealtime, type LiveState } from "@/components/match/use-match-realtime";
import { submitResult } from "@/lib/actions/scoring";
import { toast } from "@/components/ui/toast";

type TeamInfo = { id: string; name: string; color: string; roster: { id: string; name: string }[] };

function haptic(pattern: number | number[] = 10) {
  try {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  } catch {}
}

function framesFromServer(state: LiveState | null): FrameRecord[] {
  if (!state) return [];
  const gameNo = new Map(state.games.map((g) => [g.id, g.number]));
  return state.frames
    .map((f) => ({ id: f.id, gameNumber: gameNo.get(f.game_id) ?? 1, number: f.number, team: (f.scoring_team_id === state.match.home_team_id ? "home" : f.scoring_team_id === state.match.away_team_id ? "away" : null) as Side | null, points: f.points, hangers: f.hangers, weights: (f.weights as number[]) ?? [] }))
    .sort((a, b) => a.gameNumber - b.gameNumber || a.number - b.number);
}

function isTransient(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message ?? "").toLowerCase();
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("load failed") || msg.includes("timeout")) return true;
  const code = err.code ?? "";
  return code === "" || code.startsWith("5") || code === "PGRST001" || code === "PGRST002" || code === "57014";
}

export function Scorekeeper({ matchId, format, home, away, initial }: { matchId: string; format: Format; home: TeamInfo; away: TeamInfo; initial: LiveState | null }) {
  const router = useRouter();
  const { state, refresh, connected } = useMatchRealtime(matchId, initial);
  const queue = useMemo(() => new OfflineQueue(new IdbStorage(`cbc-queue:${matchId}`)), [matchId]);
  const [localFrames, setLocalFrames] = useState<FrameRecord[]>(() => framesFromServer(initial));
  const [pending, setPending] = useState<PendingFrame>(EMPTY_PENDING);
  const [queued, setQueued] = useState<QueueItem[]>([]);
  const [online, setOnline] = useState(true);
  const [lineupOpen, setLineupOpen] = useState(false);
  const [lineup, setLineup] = useState<{ home: string[]; away: string[] }>({ home: [], away: [] });
  const [submitting, startSubmit] = useTransition();
  const [submitKey] = useState(() => crypto.randomUUID());
  const [lastGameWon, setLastGameWon] = useState<{ game: number; winner: Side } | null>(null);
  const flushing = useRef(false);

  const derived = useMemo(() => deriveState(localFrames, format), [localFrames, format]);
  const need = gamesNeeded(format);
  const currentGame = derived.games.find((g) => g.number === derived.currentGame) ?? { number: derived.currentGame, home: 0, away: 0, status: "live" as const, winner: null, frames: [] };

  // Server state wins whenever nothing is queued (another phone may be scoring too)
  useEffect(() => {
    if (!state) return;
    queue.pending().then((items) => {
      setQueued(items);
      if (!items.length) setLocalFrames(framesFromServer(state));
    });
  }, [state, queue]);

  const sender = useCallback(async (item: QueueItem): Promise<SendResult> => {
    const supabase = getBrowserClient();
    if (item.kind === "frame") {
      const p = item.payload as { gameNumber: number; team: Side | null; points: number; hangers: number; weights: number[] };
      const { error } = await supabase.rpc("record_frame", { p_match: matchId, p_game_number: p.gameNumber, p_frame_id: item.id, p_scoring_team: (p.team === "home" ? home.id : p.team === "away" ? away.id : null) as unknown as string, p_points: p.points, p_hangers: p.hangers, p_weights: p.weights });
      if (!error) return { ok: true };
      return { ok: false, permanent: !isTransient(error), error: error.message };
    }
    if (item.kind === "undo") {
      const { error } = await supabase.rpc("undo_frame", { p_match: matchId });
      if (!error) return { ok: true };
      return { ok: false, permanent: !isTransient(error), error: error.message };
    }
    if (item.kind === "lineup") {
      const p = item.payload as { gameNumber: number; home: string[]; away: string[] };
      const { error } = await supabase.rpc("set_game_lineup", { p_match: matchId, p_game_number: p.gameNumber, p_home: p.home, p_away: p.away });
      if (!error) return { ok: true };
      return { ok: false, permanent: !isTransient(error), error: error.message };
    }
    return { ok: true };
  }, [matchId, home.id, away.id]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      const res = await queue.flush(sender);
      setQueued(res.remaining);
      for (const r of res.rejected) toast(`Entry rejected: ${r.error.replace(/^.*?: /, "")}`, "error");
      if (res.sent.length || res.rejected.length) await refresh();
    } finally {
      flushing.current = false;
    }
  }, [queue, sender, refresh]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", () => { update(); flush(); });
    window.addEventListener("offline", update);
    const id = setInterval(() => { if (navigator.onLine) flush(); }, 8000);
    // make sure the match is live on the server
    Promise.resolve(getBrowserClient().rpc("start_match", { p_match: matchId })).then(() => refresh()).catch(() => {});
    flush();
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tap = (team: Side, value: number) => {
    try {
      setPending((p) => addWeight(p, team, value, format));
      haptic(10);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Nope", "error");
      haptic([30, 30, 30]);
    }
  };

  const commit = async (wash = false) => {
    const p = wash ? EMPTY_PENDING : pending;
    if (!wash && !p.weights.length) return;
    try {
      const id = crypto.randomUUID();
      const { frames, frame } = commitFrame(localFrames, p, format, id);
      setLocalFrames(frames);
      setPending(EMPTY_PENDING);
      const after = deriveState(frames, format);
      const g = after.games.find((x) => x.number === frame.gameNumber);
      if (g?.status === "final") {
        setLastGameWon({ game: g.number, winner: g.winner! });
        haptic([40, 40, 80]);
        setTimeout(() => setLastGameWon(null), 3500);
      } else haptic(20);
      const items = await queue.enqueue({ id, kind: "frame", matchId, payload: { gameNumber: frame.gameNumber, team: frame.team, points: frame.points, hangers: frame.hangers, weights: frame.weights } });
      setQueued(items);
      flush();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not record frame", "error");
    }
  };

  const undo = async () => {
    if (pending.weights.length) {
      setPending(removeLastWeight(pending));
      haptic(10);
      return;
    }
    const { frames, removed } = undoLastFrame(localFrames);
    if (!removed) return;
    setLocalFrames(frames);
    haptic([20, 20]);
    const items = await queue.pending();
    if (items.some((i) => i.id === removed.id)) {
      // never reached the server: just drop it from the queue
      const rest = items.filter((i) => i.id !== removed.id);
      await queue.clear(matchId);
      for (const i of rest) await queue.enqueue(i);
      setQueued(rest);
    } else {
      setQueued(await queue.enqueue({ id: crypto.randomUUID(), kind: "undo", matchId, payload: {} }));
      flush();
    }
  };

  const saveLineup = async () => {
    setLineupOpen(false);
    setQueued(await queue.enqueue({ id: crypto.randomUUID(), kind: "lineup", matchId, payload: { gameNumber: derived.currentGame, home: lineup.home, away: lineup.away } }));
    flush();
    toast("Lineup saved for this game", "success");
  };

  const submit = () => startSubmit(async () => {
    await flush();
    if ((await queue.pending(matchId)).length) {
      toast("Still syncing frames — try again when you have signal.", "error");
      return;
    }
    const r = await submitResult({ matchId, games: null, entryMode: "live", idempotencyKey: submitKey });
    if (r.ok) {
      haptic([50, 50, 50, 50, 120]);
      toast("Submitted! The other captain has been asked to confirm.", "success");
      router.push(`/matches/${matchId}`);
    } else toast(r.message ?? "Could not submit", "error");
  });

  const pts = pendingPoints(pending);
  const maxPts = maxFramePoints(format);
  const renderCol = (side: Side, team: TeamInfo) => (
    <div className="flex flex-col gap-2">
      {format.zones.map((z) => (
        <button key={z} type="button" className={`btn btn-lg !min-h-[64px] text-2xl ${side === "home" ? "bg-home/20 text-home" : "bg-away/20 text-away"}`} disabled={derived.complete} onClick={() => tap(side, z)} aria-label={`${team.name} plus ${z}`}>+{z}</button>
      ))}
      <button type="button" className={`btn btn-lg !min-h-[64px] text-xl font-extrabold ${side === "home" ? "bg-home text-[#06251a]" : "bg-away text-[#2b1700]"}`} disabled={derived.complete} onClick={() => tap(side, format.hanger_points)} aria-label={`${team.name} hanger, ${format.hanger_points} points`}>Hanger +{format.hanger_points}</button>
    </div>
  );

  return (
    <div className="-mx-4 -mt-4 flex min-h-[calc(100dvh-7rem)] flex-col px-3 pt-2">
      <div className="flex items-center justify-between text-xs text-muted">
        <Link href={`/matches/${matchId}`} className="tap flex items-center gap-1 font-semibold"><ChevronLeft className="h-5 w-5" /> Match</Link>
        <span className="flex items-center gap-2">
          {queued.length > 0 ? <span className="flex items-center gap-1 rounded-full bg-warning/20 px-2 py-1 font-semibold text-warning"><CloudOff className="h-4 w-4" /> {queued.length} pending sync</span> : <span className="flex items-center gap-1"><Cloud className={`h-4 w-4 ${online && connected ? "text-success" : "text-subtle"}`} /> {online ? (connected ? "Synced" : "Connecting…") : "Offline"}</span>}
          <button type="button" className="tap flex items-center gap-1 rounded-full bg-elev-2 px-2 font-semibold" onClick={() => setLineupOpen(true)} aria-label="Set lineups"><Users className="h-4 w-4" /> Lineup</button>
        </span>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl bg-elev p-3">
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-semibold text-home">{home.name}</p>
          <p className="font-display text-6xl font-extrabold tabular leading-none text-home">{currentGame.home}</p>
          <p className="mt-1 text-xs text-muted">Games {derived.homeGames}</p>
        </div>
        <div className="text-center">
          <p className="text-xs uppercase text-subtle">Game</p>
          <p className="font-display text-3xl font-extrabold">{derived.currentGame}</p>
          <p className="text-[10px] text-subtle">to {format.target_score}</p>
        </div>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-semibold text-away">{away.name}</p>
          <p className="font-display text-6xl font-extrabold tabular leading-none text-away">{currentGame.away}</p>
          <p className="mt-1 text-xs text-muted">Games {derived.awayGames}</p>
        </div>
      </div>

      {lastGameWon && <p role="status" className="mt-2 rounded-xl bg-accent-soft px-3 py-2 text-center text-sm font-bold text-accent">Game {lastGameWon.game} to {lastGameWon.winner === "home" ? home.name : away.name}! {derived.complete ? "Match over." : `Game ${derived.currentGame} starts now.`}</p>}

      <div className="no-scrollbar mt-2 flex min-h-[32px] items-center gap-1 overflow-x-auto" aria-label="Frame history">
        {currentGame.frames.length === 0 && <span className="text-xs text-subtle">No frames yet this game. Tap the points for whoever scored, then Next frame.</span>}
        {currentGame.frames.map((f) => (
          <span key={f.id} className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${f.team === "home" ? "bg-home/20 text-home" : f.team === "away" ? "bg-away/20 text-away" : "bg-elev-2 text-subtle"}`}>{f.points === 0 ? "wash" : `+${f.points}`}{f.hangers ? ` 🪝${f.hangers > 1 ? f.hangers : ""}` : ""}</span>
        ))}
      </div>

      <div className="mt-2 flex min-h-[44px] items-center justify-between rounded-xl border border-dashed border-border px-3 text-sm">
        {pending.weights.length ? (
          <span className={pending.team === "home" ? "text-home" : "text-away"}><span className="font-bold">{pending.team === "home" ? home.name : away.name}</span> {pending.weights.join(" + ")} = <span className="font-extrabold">{pts}</span>{pendingHangers(pending, format) ? ` (${pendingHangers(pending, format)} hanger${pendingHangers(pending, format) > 1 ? "s" : ""})` : ""}</span>
        ) : (
          <span className="text-subtle">This frame: nobody has scored yet</span>
        )}
        {pts > maxPts && <span className="text-danger">too many</span>}
      </div>

      {derived.complete ? (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-center text-lg font-bold">{derived.winner === "home" ? home.name : away.name} win {Math.max(derived.homeGames, derived.awayGames)}–{Math.min(derived.homeGames, derived.awayGames)}</p>
          <button type="button" className="btn btn-accent btn-lg text-xl" onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit result"}</button>
          <button type="button" className="btn btn-ghost" onClick={undo}><Undo2 className="h-5 w-5" /> Undo last frame</button>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {renderCol("home", home)}
            {renderCol("away", away)}
          </div>
          <div className="mt-3 grid grid-cols-[1fr_1fr_2fr] gap-2 pb-2">
            <button type="button" className="btn btn-ghost !min-h-[64px]" onClick={undo} disabled={!pending.weights.length && !localFrames.length} aria-label="Undo"><Undo2 className="h-6 w-6" /> Undo</button>
            <button type="button" className="btn btn-soft !min-h-[64px]" onClick={() => commit(true)} disabled={pending.weights.length > 0}>Wash</button>
            <button type="button" className="btn btn-primary !min-h-[64px] text-xl" onClick={() => commit(false)} disabled={!pending.weights.length}>Next frame ›</button>
          </div>
          <p className="pb-2 text-center text-xs text-subtle">First to {need} games · Only one side scores per frame · <Link href={`/matches/${matchId}/quick`} className="underline">Quick entry</Link></p>
        </>
      )}

      {lineupOpen && (
        <div role="dialog" aria-modal="true" aria-label="Set lineups" className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setLineupOpen(false)}>
          <div className="card w-full rounded-b-none p-4 safe-bottom" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className="font-bold">Who&apos;s playing game {derived.currentGame}?</p><button className="tap flex items-center justify-center" aria-label="Close" onClick={() => setLineupOpen(false)}><X className="h-5 w-5" /></button></div>
            {(["home", "away"] as const).map((side) => {
              const t = side === "home" ? home : away;
              return (
                <div key={side} className="mt-3">
                  <p className={`text-sm font-semibold ${side === "home" ? "text-home" : "text-away"}`}>{t.name}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {t.roster.map((p) => <button key={p.id} type="button" className={`btn !min-h-[44px] px-3 text-sm ${lineup[side].includes(p.id) ? "btn-accent" : "btn-soft"}`} onClick={() => setLineup((l) => ({ ...l, [side]: l[side].includes(p.id) ? l[side].filter((x) => x !== p.id) : [...l[side], p.id] }))}>{p.name}</button>)}
                    {!t.roster.length && <span className="text-xs text-subtle">No roster yet</span>}
                  </div>
                </div>
              );
            })}
            <button type="button" className="btn btn-primary mt-4 w-full" onClick={saveLineup}>Save lineup</button>
          </div>
        </div>
      )}
    </div>
  );
}
