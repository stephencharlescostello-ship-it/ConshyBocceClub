"use client";
import { useState, useTransition } from "react";
import { Moon, Sun, Monitor, BellRing } from "lucide-react";
import { setTheme, updatePrefs } from "@/lib/actions/profile";
import { usePush } from "@/components/push/use-push";
import { toast } from "@/components/ui/toast";

const PREFS: { key: string; label: string; hint: string }[] = [
  { key: "scores", label: "Scores", hint: "Confirm requests, confirmations, disputes" },
  { key: "mentions", label: "@mentions", hint: "When someone tags you in chat" },
  { key: "announcements", label: "Announcements", hint: "Cancellations, dues, schedule changes" },
  { key: "events", label: "Events", hint: "Day-of reminders for events you RSVP'd to" },
  { key: "subs", label: "Sub requests", hint: "Teams needing a sub on your available nights" },
  { key: "schedule", label: "Schedule changes", hint: "Postponements and reschedules for your team" },
  { key: "chat", label: "All chat messages", hint: "Only for channels set to 'all'" },
];

function applyThemeToDocument(next: "dark" | "light" | "system") {
  document.documentElement.dataset.theme = next === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : next;
}

export function SettingsForm({ theme, prefs }: { theme: "dark" | "light" | "system"; prefs: Record<string, boolean> }) {
  const [t, setT] = useState(theme);
  const [p, setP] = useState(prefs);
  const [pending, start] = useTransition();
  const push = usePush();
  const applyTheme = (next: typeof t) => {
    setT(next);
    applyThemeToDocument(next);
    start(async () => { await setTheme(next); });
  };
  return (
    <div className="mt-4 flex flex-col gap-5">
      <section className="card p-4" aria-labelledby="theme">
        <h2 id="theme" className="font-display font-bold">Theme</h2>
        <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Theme">
          {([["dark", Moon, "Dark"], ["light", Sun, "Light"], ["system", Monitor, "System"]] as const).map(([v, Icon, label]) => (
            <button key={v} type="button" aria-pressed={t === v} className={`btn ${t === v ? "btn-accent" : "btn-soft"}`} onClick={() => applyTheme(v)}><Icon className="h-5 w-5" /> {label}</button>
          ))}
        </div>
      </section>
      <section className="card p-4" aria-labelledby="push">
        <h2 id="push" className="flex items-center gap-2 font-display font-bold"><BellRing className="h-5 w-5 text-accent" /> Push notifications</h2>
        {push.iosNeedsInstall && <p className="mt-2 text-sm text-muted">On iPhone, add the app to your Home Screen first (More → Install).</p>}
        {push.error && <p className="mt-2 text-sm font-semibold text-danger">{push.error}</p>}
        {push.supported && (push.subscribed ? <button type="button" className="btn btn-soft mt-2 w-full" disabled={push.busy} onClick={push.unsubscribe}>Turn off on this device</button> : <button type="button" className="btn btn-primary mt-2 w-full" disabled={push.busy} onClick={push.subscribe}>{push.busy ? "Turning on…" : "Turn on for this device"}</button>)}
        {!push.supported && !push.iosNeedsInstall && <p className="mt-2 text-sm text-muted">This browser doesn&apos;t support push. Your inbox still gets everything.</p>}
      </section>
      <section className="card p-4" aria-labelledby="types">
        <h2 id="types" className="font-display font-bold">Notify me about</h2>
        <ul className="mt-2 divide-y divide-border">
          {PREFS.map((pref) => (
            <li key={pref.key} className="flex items-center justify-between gap-3 py-2">
              <span><span className="block font-semibold">{pref.label}</span><span className="block text-xs text-muted">{pref.hint}</span></span>
              <button type="button" role="switch" aria-checked={p[pref.key]} aria-label={pref.label} disabled={pending} className={`relative h-8 w-14 shrink-0 rounded-full transition ${p[pref.key] ? "bg-primary" : "bg-elev-2"}`} onClick={() => { const next = { ...p, [pref.key]: !p[pref.key] }; setP(next); start(async () => { const r = await updatePrefs(next); if (!r.ok) toast(r.message ?? "Failed", "error"); }); }}>
                <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${p[pref.key] ? "left-7" : "left-1"}`} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
