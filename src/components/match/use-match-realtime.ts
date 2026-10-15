"use client";
import { useEffect, useState, useCallback } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

export type LiveState = { match: Tables<"matches">; games: Tables<"games">[]; frames: Tables<"frames">[]; format: unknown };

/** Subscribes to live changes for one match (frames, games, match row) and keeps a fresh snapshot. */
export function useMatchRealtime(matchId: string, initial: LiveState | null) {
  const [state, setState] = useState<LiveState | null>(initial);
  const [connected, setConnected] = useState(false);
  const refresh = useCallback(async () => {
    const supabase = getBrowserClient();
    const { data } = await supabase.rpc("match_state", { p_match: matchId });
    if (data) setState(data as unknown as LiveState);
  }, [matchId]);
  useEffect(() => {
    const supabase = getBrowserClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 120);
    };
    const channel = supabase
      .channel(`match:${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `match_id=eq.${matchId}` }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "frames" }, (payload) => {
        const gameId = (payload.new as { game_id?: string })?.game_id ?? (payload.old as { game_id?: string })?.game_id;
        if (!gameId || state?.games.some((g) => g.id === gameId) || payload.eventType === "DELETE") bump();
        else bump();
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, refresh]);
  return { state, setState, connected, refresh };
}
