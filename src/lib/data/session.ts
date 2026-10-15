import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type Membership = { team_id: string; role: string; team: { id: string; name: string; night_id: string; season_id: string; slug: string; color: string } };
export type Viewer = {
  userId: string;
  email: string | null;
  player: Tables<"players">;
  memberships: Membership[];
  isAdmin: boolean;
  teamIds: string[];
  captainTeamIds: string[];
};

/** The signed-in viewer (user + player row + memberships) or null. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return null;
  const { data: player } = await supabase.from("players").select("*").eq("user_id", userId).maybeSingle();
  if (!player) return null;
  const { data: memberships } = await supabase
    .from("team_memberships")
    .select("team_id, role, team:teams(id, name, night_id, season_id, slug, color)")
    .eq("player_id", player.id);
  const ms = (memberships ?? []).filter((m) => m.team) as unknown as Membership[];
  return {
    userId,
    email: (claims?.claims?.email as string | undefined) ?? player.email ?? null,
    player,
    memberships: ms,
    isAdmin: player.is_admin,
    teamIds: ms.map((m) => m.team_id),
    captainTeamIds: ms.filter((m) => m.role === "captain").map((m) => m.team_id),
  };
});

export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) throw new Error("Sign in required");
  return v;
}

export async function requireAdmin(): Promise<Viewer> {
  const v = await getViewer();
  if (!v?.isAdmin) throw new Error("Admins only");
  return v;
}
