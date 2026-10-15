import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SeasonForm, CloneForm } from "@/components/admin/season-form";
import { AdminOrderForm } from "@/components/admin/admin-order-form";
import { getSeasonStandings } from "@/lib/data/standings";

export const metadata: Metadata = { title: "Season" };
export const dynamic = "force-dynamic";

export default async function SeasonEdit(props: PageProps<"/admin/seasons/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: s } = await supabase.from("seasons").select("*").eq("id", id).maybeSingle();
  if (!s) notFound();
  const standings = await getSeasonStandings(s);
  const { data: order } = await supabase.from("settings").select("value").eq("key", `admin_order:${id}`).maybeSingle();
  return (
    <>
      <Link href="/admin/seasons" className="text-sm font-semibold text-accent">← Seasons</Link>
      <h1 className="mt-1 font-display text-2xl font-extrabold">{s.name}</h1>
      <SeasonForm mode="edit" season={s} />
      <h2 className="mt-8 font-display text-lg font-bold">Commissioner tiebreak decisions</h2>
      <p className="text-sm text-muted">When teams are still tied after every tiebreaker, set the order here (lower number ranks higher).</p>
      <AdminOrderForm seasonId={id} nights={standings.map((n) => ({ name: n.night.name, teams: n.rows.map((r) => ({ id: r.teamId, name: r.name, note: r.tiebreakNote })) }))} current={(order?.value as Record<string, number> | null) ?? {}} />
      <h2 className="mt-8 font-display text-lg font-bold">Clone this season</h2>
      <p className="text-sm text-muted">Copies nights, teams, rosters and format into a new draft season.</p>
      <CloneForm sourceId={id} />
    </>
  );
}
