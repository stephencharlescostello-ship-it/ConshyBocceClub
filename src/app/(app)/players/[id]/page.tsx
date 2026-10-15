import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, Zap, Shield, Flame, TrendingUp, Trophy, Crown, Sword, Hand, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { getPlayerStats } from "@/lib/data/stats";
import { getViewer } from "@/lib/data/session";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = { zap: Zap, shield: Shield, flame: Flame, "trending-up": TrendingUp, trophy: Trophy, crown: Crown, sword: Sword, hand: Hand, broom: Sparkles, award: Award };

export async function generateMetadata(props: PageProps<"/players/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("player_profiles").select("display_name").eq("id", id).maybeSingle();
  return { title: data?.display_name ?? "Player" };
}

export default async function PlayerPage(props: PageProps<"/players/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const [{ data: p }, viewer] = await Promise.all([supabase.from("player_profiles").select("*").eq("id", id).maybeSingle(), getViewer()]);
  if (!p) notFound();
  const [{ data: teams }, { data: badges }, stats] = await Promise.all([
    supabase.from("team_memberships").select("role, team:teams(id, name, color, night:league_nights(name), season:seasons(name, status))").eq("player_id", id),
    supabase.from("player_badges").select("awarded_at, badge:badges(slug, name, description, icon), match_id").eq("player_id", id).order("awarded_at", { ascending: false }),
    getPlayerStats(id),
  ]);
  const isMe = viewer?.player.id === id;
  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar name={p.display_name ?? "Player"} src={p.avatar_url} size={72} />
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold leading-tight">{p.display_name}</h1>
          {p.nickname && <p className="text-muted">“{p.nickname}”</p>}
          {p.is_admin && <span className="chip mt-1 bg-accent-soft text-accent">Commissioner</span>}
        </div>
        {isMe && <Link href="/profile" className="btn btn-ghost !min-h-[44px] ml-auto px-3 text-sm">Edit</Link>}
      </div>
      {p.bio && <p className="mt-3 text-muted">{p.bio}</p>}
      <section className="mt-5" aria-labelledby="teams">
        <h2 id="teams" className="mb-2 font-display text-lg font-bold">Teams</h2>
        <ul className="flex flex-col gap-2">
          {(teams ?? []).map((t) => {
            const team = t.team as unknown as { id: string; name: string; color: string; night: { name: string } | null; season: { name: string; status: string } | null } | null;
            if (!team) return null;
            return (
              <li key={team.id}><Link href={`/teams/${team.id}`} className="card flex items-center justify-between p-3"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: team.color }} /><span className="font-semibold">{team.name}</span></span><span className="text-xs text-muted">{team.night?.name} · {team.season?.name}{t.role === "captain" ? " · Captain" : t.role === "sub" ? " · Sub" : ""}</span></Link></li>
            );
          })}
          {!teams?.length && <li className="text-sm text-muted">Not on a team yet.</li>}
        </ul>
      </section>
      <section className="mt-5" aria-labelledby="stats">
        <h2 id="stats" className="mb-2 font-display text-lg font-bold">Stats (this season)</h2>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[["Matches", stats.matches], ["Match W–L", `${stats.wins}–${stats.losses}`], ["Game W–L", `${stats.gamesWon}–${stats.gamesLost}`], ["Hangers", stats.hangers], ["Pts / frame", stats.framesPlayed ? (stats.pointsScored / stats.framesPlayed).toFixed(2) : "—"], ["Frame win %", stats.framesPlayed ? `${Math.round((stats.framesWon / stats.framesPlayed) * 100)}%` : "—"]].map(([k, v]) => (
            <div key={String(k)} className="card p-3"><dt className="text-[11px] uppercase text-subtle">{k}</dt><dd className="font-display text-xl font-extrabold tabular">{v}</dd></div>
          ))}
        </dl>
        {stats.framesPlayed === 0 && stats.matches > 0 && <p className="mt-2 text-xs text-muted">Frame stats appear for live-scored games where this player was in the lineup.</p>}
      </section>
      <section className="mt-5" aria-labelledby="badges">
        <h2 id="badges" className="mb-2 font-display text-lg font-bold">Badges</h2>
        {badges?.length ? (
          <ul className="grid grid-cols-2 gap-2">
            {badges.map((b, i) => {
              const badge = b.badge as unknown as { slug: string; name: string; description: string; icon: string } | null;
              if (!badge) return null;
              const Icon = ICONS[badge.icon] ?? Award;
              return (
                <li key={i} className="card flex items-start gap-2 p-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <span><span className="block font-semibold">{badge.name}</span><span className="block text-xs text-muted">{badge.description}</span></span>
                </li>
              );
            })}
          </ul>
        ) : <p className="text-sm text-muted">No badges yet. Hangers earn them fast.</p>}
      </section>
    </>
  );
}
