import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Users, BarChart3, BookOpen, History, GitBranch, Megaphone, UserCircle2, Settings, Bell, Shield, Download, FileText, LogIn, Activity } from "lucide-react";
import { getViewer } from "@/lib/data/session";

export const metadata: Metadata = { title: "More" };

export default async function MorePage() {
  const viewer = await getViewer();
  const items = [
    { href: "/events", label: "Events", icon: CalendarDays },
    { href: "/announcements", label: "Announcements", icon: Megaphone },
    { href: "/subs", label: "Sub board", icon: Users },
    { href: "/stats", label: "Stats & awards", icon: BarChart3 },
    { href: "/playoffs", label: "Playoffs", icon: GitBranch },
    { href: "/history", label: "History & Hall of Fame", icon: History },
    { href: "/rules", label: "Rules, FAQ & contact", icon: BookOpen },
    { href: "/install", label: "Install the app", icon: Download },
    { href: "/quickstart", label: "Player quickstart", icon: FileText },
  ];
  const account = viewer
    ? [
        { href: "/profile", label: "Profile & teams", icon: UserCircle2 },
        { href: "/notifications", label: "Notifications", icon: Bell },
        { href: "/settings", label: "Settings", icon: Settings },
        ...(viewer.isAdmin ? [{ href: "/admin", label: "Admin console", icon: Shield }] : []),
      ]
    : [{ href: "/sign-in", label: "Sign in", icon: LogIn }];
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">More</h1>
      <ul className="mt-4 flex flex-col gap-2">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="card flex items-center gap-3 p-4 font-semibold"><i.icon className="h-5 w-5 text-accent" /> {i.label}</Link>
          </li>
        ))}
      </ul>
      <h2 className="mt-6 font-display text-lg font-bold">Account</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {account.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="card flex items-center gap-3 p-4 font-semibold"><i.icon className="h-5 w-5 text-accent" /> {i.label}</Link>
          </li>
        ))}
        <li><Link href="/health" className="flex items-center gap-2 px-2 py-2 text-sm text-subtle"><Activity className="h-4 w-4" /> System health</Link></li>
      </ul>
    </>
  );
}
