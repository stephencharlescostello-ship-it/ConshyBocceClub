import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/profile/settings-form";
import { signOut } from "@/lib/actions/auth";
import { deleteAccount } from "@/lib/actions/profile";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?next=/settings");
  const supabase = await createClient();
  const { data: prefs } = await supabase.from("notification_prefs").select("*").eq("player_id", viewer.player.id).maybeSingle();
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Settings</h1>
      <SettingsForm theme={viewer.player.theme as "dark" | "light" | "system"} prefs={{ scores: prefs?.scores ?? true, mentions: prefs?.mentions ?? true, announcements: prefs?.announcements ?? true, events: prefs?.events ?? true, subs: prefs?.subs ?? true, schedule: prefs?.schedule ?? true, chat: prefs?.chat ?? false }} />
      <section className="card mt-6 flex flex-col gap-3 p-4">
        <p className="text-sm text-muted">Signed in as {viewer.email}</p>
        <form action={signOut}><button className="btn btn-soft w-full">Sign out</button></form>
        <form action={deleteAccount} onSubmit={undefined}><button className="btn btn-ghost w-full text-danger" formNoValidate>Delete my account</button></form>
        <p className="text-xs text-subtle">Deleting removes your name, photo, email and phone. Match results stay in the league record.</p>
      </section>
    </>
  );
}
