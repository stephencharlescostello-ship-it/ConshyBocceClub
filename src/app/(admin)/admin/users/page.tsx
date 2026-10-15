import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UsersTable } from "@/components/admin/users-table";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function UsersAdmin(props: PageProps<"/admin/users">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const supabase = await createClient();
  let query = supabase.from("players").select("id, display_name, nickname, email, phone, is_admin, user_id, created_at, deleted_at, team_memberships(role, teams(name, night:league_nights(name), season:seasons(status)))").is("deleted_at", null).order("display_name").limit(300);
  if (q) query = query.or(`display_name.ilike.%${q}%,email.ilike.%${q}%`);
  const { data } = await query;
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Users</h1>
      <form className="mt-3 flex gap-2"><input name="q" defaultValue={q} className="input" placeholder="Search name or email" /><button className="btn btn-soft">Search</button>{q && <Link href="/admin/users" className="btn btn-ghost">Clear</Link>}</form>
      <p className="mt-1 text-xs text-subtle">Emails and phones are visible to admins only.</p>
      <UsersTable rows={(data ?? []).map((p) => ({ id: p.id, name: p.display_name, email: p.email, phone: p.phone, isAdmin: p.is_admin, hasAccount: Boolean(p.user_id), teams: ((p.team_memberships as unknown as { role: string; teams: { name: string; night: { name: string } | null; season: { status: string } | null } | null }[]) ?? []).filter((m) => m.teams?.season?.status === "active").map((m) => `${m.teams!.name}${m.role === "captain" ? " (C)" : ""}`).join(", ") }))} />
    </>
  );
}
