"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/seasons", label: "Seasons & format" },
  { href: "/admin/teams", label: "Nights, teams & rosters" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/results", label: "Results & disputes" },
  { href: "/admin/playoffs", label: "Playoffs" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/rules", label: "Rules & FAQ" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/dues", label: "Dues" },
  { href: "/admin/import", label: "Import CSV" },
  { href: "/admin/export", label: "Export" },
  { href: "/admin/posters", label: "QR posters" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/settings", label: "League settings" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin sections" className="md:w-56 md:shrink-0">
      <ul className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:overflow-visible md:px-0">
        {ITEMS.map((i) => {
          const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
          return (
            <li key={i.href} className="shrink-0">
              <Link href={i.href} aria-current={active ? "page" : undefined} className={`block rounded-xl px-3 py-2 text-sm font-semibold ${active ? "bg-accent text-accent-fg" : "bg-elev-2 text-muted md:bg-transparent"}`}>{i.label}</Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
