import Link from "next/link";
import { Bell, UserCircle2 } from "lucide-react";
import { Wordmark } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import type { Viewer } from "@/lib/data/session";

export function Header({ viewer, unreadNotifications = 0 }: { viewer: Viewer | null; unreadNotifications?: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-2">
        <Link href="/" className="tap flex items-center">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-1">
          {viewer ? (
            <>
              <Link href="/notifications" className="tap relative flex items-center justify-center rounded-full text-muted" aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ""}`}>
                <Bell className="h-6 w-6" />
                {unreadNotifications > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-danger" />}
              </Link>
              <Link href="/profile" className="tap flex items-center justify-center rounded-full" aria-label="Your profile">
                <Avatar name={viewer.player.display_name} src={viewer.player.avatar_url} size={34} />
              </Link>
            </>
          ) : (
            <Link href="/sign-in" className="btn btn-ghost !min-h-[44px] px-3 text-sm">
              <UserCircle2 className="h-5 w-5" /> Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
