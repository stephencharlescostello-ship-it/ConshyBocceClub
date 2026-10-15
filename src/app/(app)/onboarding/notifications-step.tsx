"use client";
import Link from "next/link";
import { BellRing } from "lucide-react";
import { usePush } from "@/components/push/use-push";

export function NotificationsStep() {
  const { supported, subscribed, subscribe, busy, error, iosNeedsInstall } = usePush();
  return (
    <div className="card flex flex-col gap-3 p-4">
      <p className="flex items-center gap-2 font-semibold"><BellRing className="h-5 w-5 text-accent" /> Get a nudge when it matters</p>
      <p className="text-sm text-muted">Score confirmations, @mentions, sub requests on your nights, and the occasional announcement. You choose which in Settings.</p>
      {iosNeedsInstall && <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm">On iPhone, notifications work after you <Link href="/install" className="font-semibold underline">add the app to your Home Screen</Link>. You can turn them on later in Settings.</p>}
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      {supported && !subscribed && !iosNeedsInstall && (
        <button className="btn btn-primary btn-lg" onClick={subscribe} disabled={busy}>{busy ? "Turning on…" : "Turn on notifications"}</button>
      )}
      {subscribed && <p className="text-sm font-semibold text-success">Notifications are on.</p>}
      <Link href="/onboarding?step=done" className={subscribed ? "btn btn-accent btn-lg" : "btn btn-ghost"}>{subscribed ? "Continue" : "Maybe later"}</Link>
    </div>
  );
}
