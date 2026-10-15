"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, CalendarDays, MessageCircle, Menu } from "lucide-react";

const TABS = [
  { href: "/", label: "Tonight", icon: Home, match: (p: string) => p === "/" },
  { href: "/standings", label: "Standings", icon: Trophy, match: (p: string) => p.startsWith("/standings") },
  { href: "/schedule", label: "Schedule", icon: CalendarDays, match: (p: string) => p.startsWith("/schedule") || p.startsWith("/matches") },
  { href: "/chat", label: "Trash Talk", icon: MessageCircle, match: (p: string) => p.startsWith("/chat") },
  { href: "/more", label: "More", icon: Menu, match: (p: string) => p.startsWith("/more") || ["/events", "/subs", "/stats", "/rules", "/history", "/playoffs", "/profile", "/settings", "/notifications", "/teams", "/players", "/announcements"].some((x) => p.startsWith(x)) },
];

export function BottomNav({ unread = 0 }: { unread?: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-elev/95 backdrop-blur safe-bottom">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {TABS.map((t) => {
          const active = t.match(path);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined} className={`relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? "text-accent" : "text-muted"}`}>
                <Icon className="h-6 w-6" aria-hidden="true" />
                {t.href === "/chat" && unread > 0 && (
                  <span className="absolute right-[22%] top-1.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>
                )}
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
