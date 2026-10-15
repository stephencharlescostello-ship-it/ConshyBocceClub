import { Suspense } from "react";
import { Header } from "@/components/shell/header";
import { BottomNav } from "@/components/shell/bottom-nav";
import { OfflineBanner } from "@/components/shell/offline-banner";
import { getViewer } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { InstallPrompt } from "@/components/shell/install-prompt";

async function Chrome({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  let unreadNotifications = 0;
  let unreadChat = 0;
  if (viewer) {
    const supabase = await createClient();
    const [{ count }, { data: unread }] = await Promise.all([
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("player_id", viewer.player.id).is("read_at", null),
      supabase.rpc("unread_counts"),
    ]);
    unreadNotifications = count ?? 0;
    unreadChat = (unread ?? []).reduce((a, r) => a + Number(r.unread ?? 0), 0);
  }
  return (
    <>
      <Header viewer={viewer} unreadNotifications={unreadNotifications} />
      <OfflineBanner />
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-4 pb-28 pt-4">
        {children}
      </main>
      <InstallPrompt />
      <BottomNav unread={unreadChat} />
    </>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-xl flex-1 px-4 pb-28 pt-4">{children}</main>}>
      <Chrome>{children}</Chrome>
    </Suspense>
  );
}
