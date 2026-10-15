import type { Metadata } from "next";
import { getSettings } from "@/lib/data/league";
import { SettingsAdminForm } from "@/components/admin/settings-admin-form";

export const metadata: Metadata = { title: "League settings" };
export const dynamic = "force-dynamic";

export default async function SettingsAdmin() {
  const s = await getSettings();
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">League settings</h1>
      <p className="text-sm text-muted">Scoring format and tiebreakers live on each season (Seasons &amp; format). Branding: drop your logo at <code>public/branding/logo.png</code>; see README.</p>
      <SettingsAdminForm league={(s.league ?? {}) as Record<string, string>} club={(s.club ?? {}) as Record<string, string>} dues={(s.dues ?? {}) as Record<string, string | number>} />
    </>
  );
}
