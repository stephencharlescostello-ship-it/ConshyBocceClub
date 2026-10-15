"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function NightTabs({ nights, active, hasTeam, weeks, week }: { nights: { slug: string; name: string }[]; active: string; hasTeam: boolean; weeks: number[]; week: number }) {
  const router = useRouter();
  const tabs = [
    ...(hasTeam ? [{ key: "mine", label: "My team", href: "/schedule?view=mine" }] : []),
    ...nights.map((n) => ({ key: n.slug, label: n.name.slice(0, 3), href: `/schedule?night=${n.slug}` })),
    { key: "week", label: "By week", href: `/schedule?view=week&week=${week}` },
    { key: "results", label: "Results", href: "/schedule?view=results" },
  ];
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4" role="tablist" aria-label="Schedule view">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href} role="tab" aria-selected={active === t.key} className={`tap shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${active === t.key ? "bg-accent text-accent-fg" : "bg-elev-2 text-muted"}`}>
            {t.label}
          </Link>
        ))}
      </div>
      {active === "week" && (
        <label className="flex items-center gap-2 text-sm">
          <span className="font-semibold">Week</span>
          <select className="input !min-h-[44px] w-auto" value={week} onChange={(e) => router.push(`/schedule?view=week&week=${e.target.value}`)} aria-label="Choose week">
            {weeks.map((w) => <option key={w} value={w}>Week {w}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
